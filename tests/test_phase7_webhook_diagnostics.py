"""
Unit and integration tests for PayTrace Phase 7: Razorpay & Webhook Diagnostics.

Tests deterministic ingestion, timing-safe HMAC SHA-256 verification, trust classification,
x-razorpay-event-id duplicate detection, delay calculations, out-of-order delivery diagnostics,
late authorization pattern detection, error object parsing, three-way state reconciliation,
evidence trust isolation, security limits, and claim verifier integration.
"""

import datetime
import hashlib
import hmac
import json
import os
import sys
import time
import uuid
from typing import Dict, Any

import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.main import app
from app.config import settings
from app.models import WebhookEvent, NormalizedEvent, PaymentState, Incident
from app.database import get_db
from app.webhook_verifier import verify_razorpay_signature, SignatureVerificationError
from app.webhook_diagnostics import (
    calculate_delivery_delay,
    extract_razorpay_error,
    detect_out_of_order,
    detect_late_authorization,
    reconcile_states,
    sanitize_webhook_payload,
)
from app.claim_verifier import verify_claims

client = TestClient(app)
SECRET = settings.RAZORPAY_WEBHOOK_SECRET or "test_secret_paytrace_phase7"


def compute_signature(raw_bytes: bytes, secret: str = SECRET) -> str:
    return hmac.new(secret.encode("utf-8"), raw_bytes, hashlib.sha256).hexdigest()


def build_webhook_payload(
    event_type: str,
    payment_id: str | None = None,
    order_id: str | None = None,
    event_id: str | None = None,
    created_at: int | None = None,
    error_info: dict | None = None,
) -> bytes:
    pid = payment_id or f"pay_{uuid.uuid4().hex[:14]}"
    oid = order_id or f"order_{uuid.uuid4().hex[:14]}"
    payment_entity: Dict[str, Any] = {
        "id": pid,
        "order_id": oid,
        "amount": 50000,
        "currency": "INR",
        "status": "captured" if "captured" in event_type else ("failed" if "failed" in event_type else "authorized"),
    }
    if error_info:
        payment_entity.update(error_info)

    payload_dict: Dict[str, Any] = {
        "entity": "event",
        "event": event_type,
        "payload": {
            "payment": {
                "entity": payment_entity,
            }
        },
    }
    if created_at is not None:
        payload_dict["created_at"] = created_at
    if event_id:
        payload_dict["id"] = event_id

    return json.dumps(payload_dict, separators=(",", ":")).encode("utf-8")


# ── TEST GROUP 1: Signature Verification & Secret Protection ─────────────────

def test_signature_verification_valid():
    raw_body = b'{"event":"payment.authorized","test":true}'
    sig = compute_signature(raw_body, SECRET)
    assert verify_razorpay_signature(raw_body, sig, SECRET) is True


def test_signature_verification_invalid():
    raw_body = b'{"event":"payment.authorized","test":true}'
    bad_sig = "0" * 64
    assert verify_razorpay_signature(raw_body, bad_sig, SECRET) is False


def test_signature_verification_missing_header():
    raw_body = b'{"event":"payment.authorized","test":true}'
    assert verify_razorpay_signature(raw_body, "", SECRET) is False


def test_signature_verification_raw_body_strictness():
    raw_body = b'{"event":"payment.authorized","test": true}'
    altered_spacing = b'{"event": "payment.authorized", "test": true}'
    sig = compute_signature(raw_body, SECRET)
    assert verify_razorpay_signature(altered_spacing, sig, SECRET) is False


def test_signature_verification_missing_secret():
    raw_body = b'{"test":true}'
    with pytest.raises(SignatureVerificationError):
        verify_razorpay_signature(raw_body, "any_sig", "")


def test_secret_never_exposed_in_api_response():
    raw = build_webhook_payload("payment.authorized")
    res = client.post(
        "/webhooks/razorpay",
        content=raw,
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 403
    text = res.text.lower()
    assert SECRET.lower() not in text
    assert "key_secret" not in text


# ── TEST GROUP 2: Diagnostic Helpers (Delay, Error, Out-of-Order, Late Auth) ───

def test_calculate_delivery_delay_normal():
    now = datetime.datetime.now(datetime.timezone.utc)
    event_time = now - datetime.timedelta(seconds=12)
    diag = calculate_delivery_delay(event_time, now)
    assert diag["classification"] == "LOW"
    assert 11.0 <= diag["delay_seconds"] <= 13.0


def test_calculate_delivery_delay_significant():
    now = datetime.datetime.now(datetime.timezone.utc)
    event_time = now - datetime.timedelta(minutes=35)
    diag = calculate_delivery_delay(event_time, now)
    assert diag["classification"] == "SIGNIFICANTLY_DELAYED"
    assert diag["delay_seconds"] > 2000


def test_calculate_delivery_delay_missing():
    diag = calculate_delivery_delay(None, datetime.datetime.now(datetime.timezone.utc))
    assert diag["classification"] == "UNAVAILABLE"
    assert diag["delay_seconds"] is None


def test_extract_razorpay_error_present():
    payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_fail_1",
                    "error_code": "BAD_REQUEST_ERROR",
                    "error_description": "Card was declined by bank",
                    "error_source": "bank",
                    "error_step": "payment_authorization",
                    "error_reason": "card_declined",
                }
            }
        }
    }
    err = extract_razorpay_error(payload)
    assert err["has_error"] is True
    assert err["code"] == "BAD_REQUEST_ERROR"
    assert err["description"] == "Card was declined by bank"
    assert err["source"] == "bank"
    assert err["reason"] == "card_declined"


def test_extract_razorpay_error_missing():
    payload = {"event": "payment.captured", "payload": {}}
    err = extract_razorpay_error(payload)
    assert err["has_error"] is False
    assert err["code"] == "Not provided"
    assert err["description"] == "Not provided"


def test_detect_out_of_order_detection():
    now = datetime.datetime.now(datetime.timezone.utc)
    # Event A occurred at 10:05, ingested at 10:06
    # Event B occurred at 10:02 (earlier occurrence!), ingested at 10:07 (later arrival!)
    class MockEv:
        def __init__(self, eid, etype, ets, its):
            self.razorpay_event_id = eid
            self.event_type = etype
            self.event_timestamp = ets
            self.ingestion_timestamp = its

    ev_a = MockEv("ev_a", "payment.authorized", now - datetime.timedelta(minutes=5), now - datetime.timedelta(minutes=4))
    ev_b = MockEv("ev_b", "payment.created", now - datetime.timedelta(minutes=10), now - datetime.timedelta(minutes=3))

    res = detect_out_of_order([ev_a, ev_b])
    assert res["detected"] is True
    assert "order anomaly" in res["description"].lower()


def test_detect_late_authorization_pattern():
    now = datetime.datetime.now(datetime.timezone.utc)
    class MockEv:
        def __init__(self, eid, etype, ets):
            self.razorpay_event_id = eid
            self.event_type = etype
            self.event_timestamp = ets
            self.ingestion_timestamp = ets

    ev_failed = MockEv("ev_f", "payment.failed", now - datetime.timedelta(minutes=10))
    ev_captured = MockEv("ev_c", "payment.captured", now - datetime.timedelta(minutes=2))

    res = detect_late_authorization([ev_failed, ev_captured])
    assert res["detected"] is True
    assert res["pattern"] == "Late authorization pattern"
    assert "Pattern detected; root cause not established" in res["description"]


# ── TEST GROUP 3: Controlled Test Cases (Cases 1 to 10) ──────────────────────

def test_case_1_valid_captured_webhook():
    """CASE 1: Valid captured webhook -> TRUSTED, ORIGINAL, canonical evidence created."""
    ev_id = f"c1_evt_{uuid.uuid4().hex[:8]}"
    pid = f"pay_c1_{uuid.uuid4().hex[:8]}"
    body = build_webhook_payload("payment.captured", payment_id=pid, event_id=ev_id, created_at=int(time.time()))
    sig = compute_signature(body)

    res = client.post(
        "/webhooks/razorpay",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": sig,
            "x-razorpay-event-id": ev_id,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["trust_status"] == "TRUSTED"
    assert data["duplicate_status"] == "ORIGINAL"
    assert data["event_type"] == "payment.captured"

    # Verify diagnostic endpoint reflects TRUSTED
    wh_list = client.get(f"/webhooks?payment_id={pid}").json()
    assert wh_list["count"] >= 1
    assert wh_list["webhooks"][0]["trust_status"] == "TRUSTED"
    assert wh_list["webhooks"][0]["signature_valid"] is True


def test_case_2_invalid_signature():
    """CASE 2: Invalid signature -> UNTRUSTED, 403 returned, audit-only, not trusted evidence."""
    ev_id = f"c2_evt_{uuid.uuid4().hex[:8]}"
    pid = f"pay_c2_{uuid.uuid4().hex[:8]}"
    body = build_webhook_payload("payment.captured", payment_id=pid, event_id=ev_id)
    tampered_sig = "a" * 64

    res = client.post(
        "/webhooks/razorpay",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": tampered_sig,
            "x-razorpay-event-id": ev_id,
        },
    )
    assert res.status_code == 403

    # Verify stored in webhook_events as UNTRUSTED for security audit
    wh_list = client.get(f"/webhooks?payment_id={pid}").json()
    assert wh_list["count"] == 1
    assert wh_list["webhooks"][0]["trust_status"] == "UNTRUSTED"
    assert wh_list["webhooks"][0]["signature_valid"] is False


def test_case_3_duplicate_webhook_event():
    """CASE 3: Duplicate webhook event -> DUPLICATE identified, 200 returned, does not duplicate canonical NormalizedEvent."""
    ev_id = f"c3_evt_{uuid.uuid4().hex[:8]}"
    pid = f"pay_c3_{uuid.uuid4().hex[:8]}"
    body = build_webhook_payload("payment.captured", payment_id=pid, event_id=ev_id, created_at=int(time.time()))
    sig = compute_signature(body)

    # First delivery: ORIGINAL
    r1 = client.post(
        "/webhooks/razorpay",
        content=body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig, "x-razorpay-event-id": ev_id},
    )
    assert r1.status_code == 200
    assert r1.json()["duplicate_status"] == "ORIGINAL"

    # Second delivery: DUPLICATE
    r2 = client.post(
        "/webhooks/razorpay",
        content=body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig, "x-razorpay-event-id": ev_id},
    )
    assert r2.status_code == 200
    assert r2.json()["duplicate_status"] == "DUPLICATE"

    # Verify diagnostic endpoint tracks observations
    wh_list = client.get(f"/webhooks?payment_id={pid}").json()
    assert wh_list["count"] == 2
    statuses = [w["duplicate_status"] for w in wh_list["webhooks"]]
    assert "DUPLICATE" in statuses
    assert "ORIGINAL" in statuses


def test_case_4_out_of_order_observations():
    """CASE 4: Out-of-order webhook observations -> order anomaly detected."""
    pid = f"pay_c4_{uuid.uuid4().hex[:8]}"
    now = int(time.time())

    # Delivery 1: payment.captured with newer event time
    ev1_id = f"c4_evt1_{uuid.uuid4().hex[:8]}"
    body1 = build_webhook_payload("payment.captured", payment_id=pid, event_id=ev1_id, created_at=now)
    client.post(
        "/webhooks/razorpay",
        content=body1,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": compute_signature(body1), "x-razorpay-event-id": ev1_id},
    )

    # Delivery 2: payment.authorized with older event time (arrived after captured!)
    ev2_id = f"c4_evt2_{uuid.uuid4().hex[:8]}"
    body2 = build_webhook_payload("payment.authorized", payment_id=pid, event_id=ev2_id, created_at=now - 300)
    client.post(
        "/webhooks/razorpay",
        content=body2,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": compute_signature(body2), "x-razorpay-event-id": ev2_id},
    )

    # Inspect incident webhooks endpoint
    diag_res = client.get(f"/incidents/{pid}/webhooks").json()
    assert diag_res["out_of_order_diagnostics"]["detected"] is True
    assert "order anomaly" in diag_res["out_of_order_diagnostics"]["description"].lower()


def test_case_5_late_authorization_pattern():
    """CASE 5: payment.failed followed by payment.captured -> Late authorization pattern detected."""
    pid = f"pay_c5_{uuid.uuid4().hex[:8]}"
    now = int(time.time())

    # 1. payment.failed
    ev_fail = f"c5_f_{uuid.uuid4().hex[:8]}"
    b_fail = build_webhook_payload("payment.failed", payment_id=pid, event_id=ev_fail, created_at=now - 600)
    client.post(
        "/webhooks/razorpay",
        content=b_fail,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": compute_signature(b_fail), "x-razorpay-event-id": ev_fail},
    )

    # 2. payment.captured
    ev_cap = f"c5_c_{uuid.uuid4().hex[:8]}"
    b_cap = build_webhook_payload("payment.captured", payment_id=pid, event_id=ev_cap, created_at=now)
    client.post(
        "/webhooks/razorpay",
        content=b_cap,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": compute_signature(b_cap), "x-razorpay-event-id": ev_cap},
    )

    # Check late authorization diagnostic
    diag_res = client.get(f"/incidents/{pid}/webhooks").json()
    assert diag_res["late_authorization_diagnostics"]["detected"] is True
    assert diag_res["late_authorization_diagnostics"]["pattern"] == "Late authorization pattern"


def test_case_6_large_delivery_delay():
    """CASE 6: Large delivery delay -> delay calculated and classified as DELAYED or SIGNIFICANTLY_DELAYED."""
    pid = f"pay_c6_{uuid.uuid4().hex[:8]}"
    ev_id = f"c6_evt_{uuid.uuid4().hex[:8]}"
    # 40 minutes old
    old_time = int(time.time()) - 2400
    body = build_webhook_payload("payment.captured", payment_id=pid, event_id=ev_id, created_at=old_time)
    sig = compute_signature(body)

    res = client.post(
        "/webhooks/razorpay",
        content=body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig, "x-razorpay-event-id": ev_id},
    )
    assert res.status_code == 200
    assert res.json()["delivery_delay_seconds"] >= 2300

    # Detail diagnostic
    wh_list = client.get(f"/webhooks?payment_id={pid}").json()
    wh_id = wh_list["webhooks"][0]["id"]
    detail = client.get(f"/webhooks/{wh_id}/diagnostics").json()
    assert detail["delivery_delay"]["classification"] in ("DELAYED", "SIGNIFICANTLY_DELAYED")


def test_case_7_missing_event_timestamp():
    """CASE 7: Missing event timestamp -> handled safely as 'UNAVAILABLE'."""
    pid = f"pay_c7_{uuid.uuid4().hex[:8]}"
    ev_id = f"c7_evt_{uuid.uuid4().hex[:8]}"
    body = build_webhook_payload("payment.authorized", payment_id=pid, event_id=ev_id, created_at=None)
    sig = compute_signature(body)

    res = client.post(
        "/webhooks/razorpay",
        content=body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig, "x-razorpay-event-id": ev_id},
    )
    assert res.status_code == 200
    assert res.json()["delivery_delay_seconds"] is None


def test_case_8_missing_payment_correlation():
    """CASE 8: Missing payment correlation -> explicitly indicated as Correlation unavailable."""
    ev_id = f"c8_evt_{uuid.uuid4().hex[:8]}"
    # Payload with no payment or order entity
    raw_payload = json.dumps({"event": "unknown.test", "id": ev_id}).encode("utf-8")
    sig = compute_signature(raw_payload)

    res = client.post(
        "/webhooks/razorpay",
        content=raw_payload,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig, "x-razorpay-event-id": ev_id},
    )
    assert res.status_code == 200

    wh_list = client.get(f"/webhooks?event_type=unknown.test").json()
    wh_id = wh_list["webhooks"][0]["id"]
    diag = client.get(f"/webhooks/{wh_id}/diagnostics").json()
    assert diag["payment_id"] == "Correlation unavailable"
    assert diag["order_id"] == "Correlation unavailable"


def test_case_9_trusted_webhook_conflicts_with_merchant_state():
    """CASE 9: Trusted webhook captured, but merchant state remains stale/failed -> MERCHANT_NOT_UPDATED or CONFLICTING_OBSERVATIONS."""
    recon = reconcile_states(
        authoritative_state="captured",
        trusted_webhook_events=[type("Obj", (), {"event_type": "payment.captured", "event_timestamp": None, "ingestion_timestamp": None})()],
        merchant_state="failed",
    )
    assert recon["status"] == "MERCHANT_NOT_UPDATED"
    assert "stale or un-updated" in recon["explanation"].lower()


def test_case_10_untrusted_webhook_contains_plausible_payload():
    """CASE 10: Untrusted webhook with plausible payload is isolated and does not enter canonical NormalizedEvent."""
    pid = f"pay_c10_{uuid.uuid4().hex[:8]}"
    ev_id = f"c10_evt_{uuid.uuid4().hex[:8]}"
    body = build_webhook_payload("payment.captured", payment_id=pid, event_id=ev_id)
    bad_sig = "deadbeef" * 8

    res = client.post(
        "/webhooks/razorpay",
        content=body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": bad_sig, "x-razorpay-event-id": ev_id},
    )
    assert res.status_code == 403

    # Verify reconciliation reports insufficient evidence because untrusted webhook was NOT promoted to payment state
    recon_res = client.get(f"/webhooks/reconciliation/{pid}").json()
    assert recon_res["reconciliation"]["status"] == "INSUFFICIENT_EVIDENCE"
    assert recon_res["trusted_webhook_count"] == 0


# ── TEST GROUP 4: Security & Resource Limits ─────────────────────────────────

def test_oversized_payload_rejected():
    large_body = b'{"event":"test","junk":"' + (b"X" * (1024 * 1024 + 10)) + b'"}'
    res = client.post(
        "/webhooks/razorpay",
        content=large_body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": "abc"},
    )
    assert res.status_code == 413


def test_malformed_json_body_handled():
    bad_json = b'{not valid json at all}'
    res = client.post(
        "/webhooks/razorpay",
        content=bad_json,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": compute_signature(bad_json)},
    )
    assert res.status_code == 400


def test_payload_sanitization():
    dirty_payload = {
        "id": "test_1",
        "secret": "SUPER_SECRET_123",
        "api_key": "KEY_999",
        "nested": {
            "token": "BEARER_XYZ",
            "safe_field": "public_data",
        }
    }
    clean = sanitize_webhook_payload(dirty_payload)
    assert clean["secret"] == "[REDACTED]"
    assert clean["api_key"] == "[REDACTED]"
    assert clean["nested"]["token"] == "[REDACTED]"
    assert clean["nested"]["safe_field"] == "public_data"


# ── TEST GROUP 5: Claim Verifier Integration ─────────────────────────────────

def test_claim_verifier_rejects_unsupported_signature_failure_claim():
    evidence_package = {
        "events": [
            {
                "evidence_id": "ev_trusted_1",
                "signature_valid": True,
                "event_type": "payment.captured",
            }
        ],
        "reconstructed_state": {"current_state": "captured"}
    }
    # Claim asserts signature was invalid, but evidence shows it was valid!
    claims = [
        {
            "claim_id": "claim_1",
            "statement": "The webhook signature was invalid and failed verification.",
            "evidence_ids": ["ev_trusted_1"],
            "confidence": "HIGH",
        }
    ]
    verified = verify_claims(claims, evidence_package)
    assert len(verified) == 1
    assert verified[0].verdict == "REJECTED"
    assert "contradicted by evidence" in verified[0].rejection_reason.lower()


def test_claim_verifier_rejects_unsupported_duplicate_claim():
    evidence_package = {
        "events": [
            {
                "evidence_id": "ev_single_1",
                "signature_valid": True,
                "event_type": "payment.captured",
                "duplicate_status": "ORIGINAL",
            }
        ],
        "reconstructed_state": {"current_state": "captured"}
    }
    # Claim asserts webhook was delivered twice, but only 1 observation exists!
    claims = [
        {
            "claim_id": "claim_2",
            "statement": "Webhook ev_single_1 was delivered twice by Razorpay.",
            "evidence_ids": ["ev_single_1"],
            "confidence": "HIGH",
        }
    ]
    verified = verify_claims(claims, evidence_package)
    assert len(verified) == 1
    assert verified[0].verdict == "REJECTED"
    assert "not supported by evidence" in verified[0].rejection_reason.lower()
