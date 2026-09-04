import os
import sys
import uuid
import datetime
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.main import app
from app.database import get_db, Base, get_engine
from app.models import Incident, NormalizedEvent, AuditRecord, WebhookEvent, PaymentState
from app.incident_detector import IncidentReport
from app.state_reconstructor import reconstruct_payment_state
from app.authoritative_rules import apply_authoritative_rules
from app.evidence_package import build_advanced_evidence_package
from app.ai_activation_gate import should_activate_advanced_ai
from app.gemini_investigator import investigate_advanced
from app.claim_verifier import (
    verify_advanced_claims,
    verify_hypotheses,
    verify_causal_chain,
)
from app.confidence_engine import compute_advanced_confidence

client = TestClient(app)


# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def setup_test_data():
    """Seed test incidents, normalized events, and webhooks in SQLite."""
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    db = next(get_db())

    uniq = uuid.uuid4().hex[:8]
    test_pid = f"pay_adv_{uniq}"
    test_oid = f"order_adv_{uniq}"
    now = datetime.datetime.now(datetime.timezone.utc)

    # 1. Persist incident
    incident = Incident(
        payment_id=test_pid,
        order_id=test_oid,
        incident_type="invalid_transition",
        severity="HIGH",
        description="Captured event received without prior authorization",
        evidence_ids=[f"evt_init_{uniq}", f"evt_cap_{uniq}"],
        operational_status="INVESTIGATING",
        priority="HIGH",
        tags=["phase8", "advanced_ai"],
        assignee="ai_tester",
        resolved=False,
    )
    db.add(incident)
    db.flush()
    incident_id = str(incident.id)

    # 2. Persist NormalizedEvents (using valid column event_id & signature_valid=True)
    evt1 = NormalizedEvent(
        event_id=f"evt_init_{uniq}",
        event_type="payment.initiated",
        payment_id=test_pid,
        order_id=test_oid,
        event_timestamp=now - datetime.timedelta(seconds=60),
        source="gateway",
        status="initiated",
        signature_valid=True,
        raw_payload={"amount": 5000, "currency": "INR", "customer_email": "test@example.com"},
    )
    evt2 = NormalizedEvent(
        event_id=f"evt_cap_{uniq}",
        event_type="payment.captured",
        payment_id=test_pid,
        order_id=test_oid,
        event_timestamp=now - datetime.timedelta(seconds=10),
        source="webhook",
        status="captured",
        signature_valid=True,
        raw_payload={"amount": 5000, "currency": "INR", "card_token": "tok_12345"},
    )
    db.add_all([evt1, evt2])

    # 3. Persist WebhookEvent
    wb = WebhookEvent(
        razorpay_event_id=f"evt_rzp_{uniq}",
        trust_status="TRUSTED",
        duplicate_status="ORIGINAL",
        signature_valid=True,
        event_type="payment.captured",
        payment_id=test_pid,
        order_id=test_oid,
        event_timestamp=now - datetime.timedelta(seconds=10),
        ingestion_timestamp=now,
        delivery_delay_seconds=10.0,
        payload_size_bytes=256,
        payload_hash=f"hash_{uniq}",
        raw_payload={"event": "payment.captured", "payload": {"payment": {"entity": {"id": test_pid}}}},
    )
    db.add(wb)

    # 4. Persist PaymentState
    pstate = PaymentState(
        payment_id=test_pid,
        order_id=test_oid,
        current_state="CAPTURED",
        state_history=[
            {"state": "INITIATED", "timestamp": (now - datetime.timedelta(seconds=60)).isoformat()},
            {"state": "CAPTURED", "timestamp": (now - datetime.timedelta(seconds=10)).isoformat()},
        ],
    )
    db.add(pstate)

    db.commit()
    db.close()

    yield {
        "incident_id": incident_id,
        "payment_id": test_pid,
        "order_id": test_oid,
        "uniq": uniq,
    }

    # Teardown
    db = next(get_db())
    db.query(Incident).filter(Incident.payment_id == test_pid).delete()
    db.query(NormalizedEvent).filter(NormalizedEvent.payment_id == test_pid).delete()
    db.query(WebhookEvent).filter(WebhookEvent.payment_id == test_pid).delete()
    db.query(PaymentState).filter(PaymentState.payment_id == test_pid).delete()
    db.query(AuditRecord).filter(AuditRecord.payment_id == test_pid).delete()
    db.commit()
    db.close()


# ─────────────────────────────────────────────────────────────────────────────
# 1. ADVANCED EVIDENCE PACKAGE TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_advanced_evidence_package_structure(setup_test_data):
    info = setup_test_data
    db = next(get_db())

    events = db.query(NormalizedEvent).filter(NormalizedEvent.payment_id == info["payment_id"]).all()
    inc_reports = [
        IncidentReport(
            incident_type="invalid_transition",
            payment_id=info["payment_id"],
            order_id=info["order_id"],
            description="Captured without auth",
            severity="HIGH",
            evidence_ids=[f"evt_init_{info['uniq']}"],
        )
    ]
    pstate = reconstruct_payment_state(events)

    pkg = build_advanced_evidence_package(
        payment_id=info["payment_id"],
        existing_events=events,
        reconstructed_state=pstate,
        incidents=inc_reports,
        webhook_diagnostics={"reconciliation": {"status": "MATCHED"}},
    )

    assert pkg["payment_id"] == info["payment_id"]
    assert "evidence_package_hash" in pkg
    assert len(pkg["evidence_package_hash"]) == 64  # SHA-256
    assert "events" in pkg
    assert len(pkg["events"]) == 2
    assert "authoritative_state" in pkg
    assert "incidents" in pkg
    assert "deterministic_diagnostics" in pkg


def test_evidence_package_hash_stability(setup_test_data):
    info = setup_test_data
    db = next(get_db())
    events = db.query(NormalizedEvent).filter(NormalizedEvent.payment_id == info["payment_id"]).all()
    inc_reports = [
        IncidentReport(
            incident_type="invalid_transition",
            payment_id=info["payment_id"],
            order_id=info["order_id"],
            description="Captured without auth",
            severity="HIGH",
            evidence_ids=[],
        )
    ]
    pstate = reconstruct_payment_state(events)

    pkg1 = build_advanced_evidence_package(
        payment_id=info["payment_id"],
        existing_events=events,
        reconstructed_state=pstate,
        incidents=inc_reports,
    )
    pkg2 = build_advanced_evidence_package(
        payment_id=info["payment_id"],
        existing_events=events,
        reconstructed_state=pstate,
        incidents=inc_reports,
    )

    assert pkg1["evidence_package_hash"] == pkg2["evidence_package_hash"]


def test_advanced_evidence_pii_sanitization():
    """Verify that sensitive credential patterns in payloads are redacted."""
    raw = {"key_secret": "sec_secret123", "password": "supersecretpassword", "amount": 1000}
    evt = NormalizedEvent(
        event_id="evt_pii_test",
        event_type="payment.captured",
        payment_id="pay_pii",
        event_timestamp=datetime.datetime.now(datetime.timezone.utc),
        source="gateway",
        status="captured",
        signature_valid=True,
        raw_payload=raw,
    )
    pstate = reconstruct_payment_state([evt])
    pkg = build_advanced_evidence_package(
        payment_id="pay_pii",
        existing_events=[evt],
        reconstructed_state=pstate,
        incidents=[],
    )
    pkg_str = str(pkg)
    assert "supersecretpassword" not in pkg_str
    assert "sec_secret123" not in pkg_str


# ─────────────────────────────────────────────────────────────────────────────
# 2. AI ACTIVATION GATE TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_ai_activation_gate_webhook_out_of_order():
    evt = NormalizedEvent(
        event_id="evt_1",
        event_type="payment.captured",
        event_timestamp=datetime.datetime.now(datetime.timezone.utc),
        source="webhook",
        status="captured",
        signature_valid=True,
    )
    should_run, reason = should_activate_advanced_ai(
        authoritative_result={},
        incidents=[],
        existing_events=[evt],
        webhook_diagnostics={"out_of_order_diagnostics": {"detected": True}},
    )
    assert should_run is True
    assert "webhook" in reason.lower() or "order" in reason.lower()


def test_ai_activation_gate_late_auth():
    evt = NormalizedEvent(
        event_id="evt_1",
        event_type="payment.captured",
        event_timestamp=datetime.datetime.now(datetime.timezone.utc),
        source="webhook",
        status="captured",
        signature_valid=True,
    )
    should_run, reason = should_activate_advanced_ai(
        authoritative_result={},
        incidents=[],
        existing_events=[evt],
        webhook_diagnostics={"late_authorization_diagnostics": {"detected": True}},
    )
    assert should_run is True
    assert "late" in reason.lower() or "auth" in reason.lower()


def test_ai_activation_gate_high_severity():
    evt = NormalizedEvent(
        event_id="evt_1",
        event_type="payment.captured",
        event_timestamp=datetime.datetime.now(datetime.timezone.utc),
        source="webhook",
        status="captured",
        signature_valid=True,
    )
    inc = IncidentReport(
        incident_type="invalid_transition",
        payment_id="pay_1",
        order_id="ord_1",
        description="High severity error",
        severity="HIGH",
        evidence_ids=[],
    )
    should_run, reason = should_activate_advanced_ai(
        authoritative_result={},
        incidents=[inc],
        existing_events=[evt],
    )
    assert should_run is True
    assert "severity" in reason.lower() or "high" in reason.lower() or "incident" in reason.lower()


def test_ai_activation_gate_clean_flow_skipped():
    evt = NormalizedEvent(
        event_id="evt_1",
        event_type="payment.captured",
        event_timestamp=datetime.datetime.now(datetime.timezone.utc),
        source="webhook",
        status="captured",
        signature_valid=True,
    )
    should_run, _ = should_activate_advanced_ai(
        authoritative_result={"valid": True},
        incidents=[],
        existing_events=[evt],
        webhook_diagnostics={"out_of_order_diagnostics": {"detected": False}},
    )
    assert should_run is False


# ─────────────────────────────────────────────────────────────────────────────
# 3. GEMINI INVESTIGATOR (FALLBACK & SCHEMA) TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_investigate_advanced_fallback_structure(setup_test_data):
    info = setup_test_data
    db = next(get_db())
    events = db.query(NormalizedEvent).filter(NormalizedEvent.payment_id == info["payment_id"]).all()
    pstate = reconstruct_payment_state(events)

    pkg = build_advanced_evidence_package(
        payment_id=info["payment_id"],
        existing_events=events,
        reconstructed_state=pstate,
        incidents=[],
    )

    # In test mode without GEMINI_API_KEY, fallback produces schema-compliant dictionary
    res = investigate_advanced(pkg)

    assert "summary" in res or "error" in res or "primary_hypothesis" in res
    assert isinstance(res, dict)


# ─────────────────────────────────────────────────────────────────────────────
# 4. CLAIM VERIFIER (5-VERDICTS & CONTRADICTIONS) TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_verify_advanced_claims_verified():
    claims = [
        {
            "claim_id": "c1",
            "statement": "Payment was captured via webhook",
            "evidence_ids": ["evt_1"],
            "claim_type": "OBSERVATION",
        }
    ]
    evidence_package = {
        "events": [
            {"evidence_id": "evt_1", "event_type": "payment.captured", "source": "webhook"}
        ],
        "authoritative_state": {"current_state": "captured"},
    }

    verified = verify_advanced_claims(claims, evidence_package)
    assert len(verified) == 1
    assert verified[0].verdict == "VERIFIED"
    assert verified[0].claim_id == "c1"


def test_verify_advanced_claims_unsupported():
    claims = [
        {
            "claim_id": "c2",
            "statement": "Customer initiated chargeback through issuing bank",
            "evidence_ids": [],
            "claim_type": "OBSERVATION",
        }
    ]
    evidence_package = {
        "events": [
            {"evidence_id": "evt_1", "event_type": "payment.captured"}
        ],
        "authoritative_state": {"current_state": "captured"},
    }

    verified = verify_advanced_claims(claims, evidence_package)
    assert len(verified) == 1
    assert verified[0].verdict == "UNSUPPORTED"


def test_verify_advanced_claims_unverifiable():
    claims = [
        {
            "claim_id": "c2_missing",
            "statement": "Customer initiated chargeback through issuing bank",
            "evidence_ids": ["evt_nonexistent_999"],
            "claim_type": "OBSERVATION",
        }
    ]
    evidence_package = {
        "events": [
            {"evidence_id": "evt_1", "event_type": "payment.captured"}
        ],
        "authoritative_state": {"current_state": "captured"},
    }

    verified = verify_advanced_claims(claims, evidence_package)
    assert len(verified) == 1
    assert verified[0].verdict == "UNVERIFIABLE"


def test_verify_advanced_claims_contradicted():
    claims = [
        {
            "claim_id": "c3",
            "statement": "transaction failed and never completed",
            "evidence_ids": ["evt_1"],
            "claim_type": "OBSERVATION",
        }
    ]
    # Authoritative state is captured, so "transaction failed" contradicts
    evidence_package = {
        "events": [
            {"evidence_id": "evt_1", "event_type": "payment.captured"}
        ],
        "authoritative_state": {"current_state": "captured"},
    }

    verified = verify_advanced_claims(claims, evidence_package)
    assert len(verified) == 1
    assert verified[0].verdict == "CONTRADICTED"


def test_verify_hypotheses_scoring():
    raw_hypotheses = [
        {
            "hypothesis_id": "H1",
            "title": "Missing Auth Webhook",
            "status": "PLAUSIBLE",
            "supporting_evidence_ids": ["evt_1"],
        },
        {
            "hypothesis_id": "H2",
            "title": "Direct Capture Flow",
            "status": "PLAUSIBLE",
            "supporting_evidence_ids": ["evt_missing_999"],
        },
    ]
    evidence_package = {
        "events": [{"evidence_id": "evt_1"}],
    }

    evaluated = verify_hypotheses(raw_hypotheses, evidence_package)
    assert len(evaluated) == 2
    assert evaluated[0].evidence_verdict == "VERIFIED"
    assert evaluated[1].evidence_verdict == "UNVERIFIABLE"


def test_verify_causal_chain_transitions():
    raw_steps = [
        {"step_id": "step_1", "description": "Order created", "supporting_evidence_ids": ["evt_1"]},
        {"step_id": "step_2", "description": "Capture received", "supporting_evidence_ids": []},
    ]
    evidence_package = {
        "events": [
            {"evidence_id": "evt_1"},
        ]
    }

    steps = verify_causal_chain(raw_steps, evidence_package)
    assert len(steps) == 2
    assert steps[0].verification_state == "VERIFIED"
    assert steps[1].verification_state == "UNVERIFIED"


# ─────────────────────────────────────────────────────────────────────────────
# 5. ADVANCED CONFIDENCE ENGINE TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_confidence_engine_authoritative_confirmed():
    claims = [
        {"claim_id": "c1", "verdict": "VERIFIED"},
        {"claim_id": "c2", "verdict": "VERIFIED"},
    ]
    res = compute_advanced_confidence(
        advanced_claims=claims,
        hypothesis_verifications=[{"evidence_verdict": "VERIFIED"}],
        causal_step_verifications=[{"verification_state": "VERIFIED"}],
        incidents=[],
        authoritative_result={"valid": True},
        ai_activated=True,
        ai_abstention_signal="NONE",
    )
    assert res["outcome"] in ("RESOLVED_WITH_HIGH_CONFIDENCE", "RESOLVED_WITH_MEDIUM_CONFIDENCE")
    assert res["score"] >= 0.70
    assert res["abstain"] is False


def test_confidence_engine_contradiction_penalty():
    claims = [
        {"claim_id": "c1", "verdict": "VERIFIED"},
        {"claim_id": "c2", "verdict": "CONTRADICTED"},
        {"claim_id": "c3", "verdict": "CONTRADICTED"},
    ]
    res = compute_advanced_confidence(
        advanced_claims=claims,
        hypothesis_verifications=[],
        causal_step_verifications=[],
        incidents=[],
        authoritative_result={"valid": False},
        ai_activated=True,
        ai_abstention_signal="NONE",
    )
    assert res["outcome"] in ("LOW_CONFIDENCE", "INCONCLUSIVE")
    assert res["score"] < 0.60


def test_confidence_engine_abstention_propagation():
    claims = [{"claim_id": "c1", "verdict": "VERIFIED"}]
    res = compute_advanced_confidence(
        advanced_claims=claims,
        hypothesis_verifications=[],
        causal_step_verifications=[],
        incidents=[],
        authoritative_result={},
        ai_activated=True,
        ai_abstention_signal="INSUFFICIENT_EVIDENCE",
    )
    assert res["abstain"] is True
    assert res["outcome"] == "INCONCLUSIVE"


# ─────────────────────────────────────────────────────────────────────────────
# 6. API ENDPOINTS TESTS
# ─────────────────────────────────────────────────────────────────────────────

def test_post_run_advanced_investigation(setup_test_data):
    info = setup_test_data
    incident_id = info["incident_id"]

    res = client.post(f"/investigations/{incident_id}/investigate/advanced")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["incident_id"] == incident_id
    assert data["payment_id"] == info["payment_id"]
    assert data["investigation_type"] == "advanced"
    assert "investigation_outcome" in data
    assert "confidence" in data
    assert "audit_record_id" in data


def test_advanced_investigation_safety_non_mutation(setup_test_data):
    """Verify that running Advanced AI does NOT mutate incident status, priority, or payment state."""
    info = setup_test_data
    incident_id = info["incident_id"]

    db = next(get_db())
    inc_before = db.query(Incident).filter(Incident.id == incident_id).first()
    status_before = inc_before.operational_status
    priority_before = inc_before.priority
    assignee_before = inc_before.assignee
    db.close()

    # Run investigation
    res = client.post(f"/investigations/{incident_id}/investigate/advanced")
    assert res.status_code == 200

    db = next(get_db())
    inc_after = db.query(Incident).filter(Incident.id == incident_id).first()
    assert inc_after.operational_status == status_before
    assert inc_after.priority == priority_before
    assert inc_after.assignee == assignee_before

    pstate = db.query(PaymentState).filter(PaymentState.payment_id == info["payment_id"]).first()
    assert pstate.current_state == "CAPTURED"
    db.close()


def test_get_latest_advanced_investigation(setup_test_data):
    info = setup_test_data
    incident_id = info["incident_id"]

    # First run investigation to ensure an audit record exists
    client.post(f"/investigations/{incident_id}/investigate/advanced")

    res = client.get(f"/investigations/{incident_id}/advanced/latest")
    assert res.status_code == 200
    data = res.json()

    assert data["incident_id"] == incident_id
    assert data["payment_id"] == info["payment_id"]
    assert data["investigation_type"] == "advanced"
    assert "investigation_outcome" in data
    assert "confidence_score" in data


def test_get_advanced_investigation_history(setup_test_data):
    info = setup_test_data
    incident_id = info["incident_id"]

    # Run twice
    client.post(f"/investigations/{incident_id}/investigate/advanced")
    client.post(f"/investigations/{incident_id}/investigate/advanced")

    res = client.get(f"/investigations/{incident_id}/advanced/history")
    assert res.status_code == 200
    data = res.json()

    assert data["incident_id"] == incident_id
    assert data["total_versions"] >= 2
    assert len(data["versions"]) >= 2
    assert data["versions"][0]["version_number"] == 1
    assert data["versions"][1]["version_number"] == 2


def test_advanced_investigation_nonexistent_incident_404():
    res = client.post("/investigations/nonexistent_incident_99999/investigate/advanced")
    assert res.status_code == 404


def test_ai_activation_gate_multiple_incidents():
    evt = NormalizedEvent(
        event_id="evt_multi_1",
        event_type="payment.captured",
        event_timestamp=datetime.datetime.now(datetime.timezone.utc),
        source="webhook",
        status="captured",
        signature_valid=True,
    )
    inc1 = IncidentReport(
        incident_type="invalid_transition",
        payment_id="pay_m",
        order_id="ord_m",
        description="Invalid transition",
        severity="MEDIUM",
        evidence_ids=[],
    )
    inc2 = IncidentReport(
        incident_type="delayed_webhook",
        payment_id="pay_m",
        order_id="ord_m",
        description="Delayed delivery",
        severity="MEDIUM",
        evidence_ids=[],
    )
    should_run, reason = should_activate_advanced_ai(
        authoritative_result={},
        incidents=[inc1, inc2],
        existing_events=[evt],
    )
    assert should_run is True
    assert "multiple" in reason.lower()


def test_ai_activation_gate_merchant_not_updated():
    evt = NormalizedEvent(
        event_id="evt_recon_1",
        event_type="payment.captured",
        event_timestamp=datetime.datetime.now(datetime.timezone.utc),
        source="webhook",
        status="captured",
        signature_valid=True,
    )
    should_run, reason = should_activate_advanced_ai(
        authoritative_result={},
        incidents=[],
        existing_events=[evt],
        webhook_diagnostics={"reconciliation": {"status": "MERCHANT_NOT_UPDATED"}},
    )
    assert should_run is True
    assert "merchant" in reason.lower()


def test_ai_activation_gate_conflicting_observations():
    evt = NormalizedEvent(
        event_id="evt_recon_2",
        event_type="payment.captured",
        event_timestamp=datetime.datetime.now(datetime.timezone.utc),
        source="webhook",
        status="captured",
        signature_valid=True,
    )
    should_run, reason = should_activate_advanced_ai(
        authoritative_result={},
        incidents=[],
        existing_events=[evt],
        webhook_diagnostics={"reconciliation": {"status": "CONFLICTING_OBSERVATIONS"}},
    )
    assert should_run is True
    assert "conflicting" in reason.lower()


def test_advanced_evidence_package_historical_context():
    evt = NormalizedEvent(
        event_id="evt_ctx_1",
        event_type="payment.captured",
        payment_id="pay_ctx",
        event_timestamp=datetime.datetime.now(datetime.timezone.utc),
        source="gateway",
        status="captured",
        signature_valid=True,
    )
    pstate = reconstruct_payment_state([evt])
    similar = [{
        "incident_type": "invalid_transition",
        "severity": "HIGH",
        "similarity_score": 0.88,
        "comparison_summary": "Identical missing auth signature",
        "matching_features": ["event_type", "gateway"],
        "resolved": True,
    }]

    pkg = build_advanced_evidence_package(
        payment_id="pay_ctx",
        existing_events=[evt],
        reconstructed_state=pstate,
        incidents=[],
        similar_incidents=similar,
    )

    assert len(pkg["historical_context"]) == 1
    assert pkg["historical_context"][0]["trust_category"] == "HISTORICAL_CONTEXT"
    assert "NOT evidence" in pkg["historical_context"][0]["note"]


def test_advanced_evidence_package_pattern_context():
    evt = NormalizedEvent(
        event_id="evt_pat_1",
        event_type="payment.captured",
        payment_id="pay_pat",
        event_timestamp=datetime.datetime.now(datetime.timezone.utc),
        source="gateway",
        status="captured",
        signature_valid=True,
    )
    pstate = reconstruct_payment_state([evt])
    patterns = [{
        "pattern_name": "Late Auth Surge",
        "pattern_type": "WEBHOOK_DELAY",
        "incident_count": 12,
        "severity": "MEDIUM",
        "pattern_strength": 0.95,
        "diagnostic_characteristics": ["webhook_delay > 10s"],
    }]

    pkg = build_advanced_evidence_package(
        payment_id="pay_pat",
        existing_events=[evt],
        reconstructed_state=pstate,
        incidents=[],
        recurring_patterns=patterns,
    )

    assert len(pkg["pattern_context"]) == 1
    assert pkg["pattern_context"][0]["trust_category"] == "PATTERN_CONTEXT"
    assert "NOT evidence" in pkg["pattern_context"][0]["note"]


def test_claim_verifier_causal_claim_partial_verification():
    claims = [
        {
            "claim_id": "c_causal_1",
            "statement": "Gateway timeout caused webhook to arrive late",
            "evidence_ids": ["evt_1"],
            "claim_type": "CAUSAL",
        }
    ]
    evidence_package = {
        "events": [{"evidence_id": "evt_1", "event_type": "payment.captured"}],
        "authoritative_state": {"current_state": "captured"},
    }

    verified = verify_advanced_claims(claims, evidence_package)
    assert len(verified) == 1
    assert verified[0].verdict == "PARTIALLY_VERIFIED"
    assert "CAUSAL claim" in verified[0].verdict_reason


def test_confidence_engine_signals_structure():
    claims = [
        {"claim_id": "c1", "verdict": "VERIFIED"},
        {"claim_id": "c2", "verdict": "PARTIALLY_VERIFIED"},
        {"claim_id": "c3", "verdict": "UNSUPPORTED"},
        {"claim_id": "c4", "verdict": "CONTRADICTED"},
    ]
    res = compute_advanced_confidence(
        advanced_claims=claims,
        hypothesis_verifications=[{"evidence_verdict": "VERIFIED"}],
        causal_step_verifications=[{"verification_state": "VERIFIED"}],
        incidents=[],
        authoritative_result={"valid": False},
        ai_activated=True,
    )

    signals = res.get("signals", {})
    assert "verified_claims" in signals
    assert signals["verified_claims"] == 1
    assert signals["partially_verified_claims"] == 1
    assert signals["unsupported_claims"] == 1
    assert signals["contradicted_claims"] == 1
    assert signals["total_claims"] == 4
    assert "causal_chain_verification_rate" in signals
    assert "authoritative_agreement" in signals


def test_audit_record_hash_stability(setup_test_data):
    info = setup_test_data
    incident_id = info["incident_id"]

    res = client.post(f"/investigations/{incident_id}/investigate/advanced")
    assert res.status_code == 200
    data = res.json()

    db = next(get_db())
    record = db.query(AuditRecord).filter(AuditRecord.id == data["audit_record_id"]).first()
    assert record is not None
    assert record.investigation_type == "advanced"
    assert record.evidence_package_hash is not None
    assert len(record.evidence_package_hash) == 64
    db.close()

