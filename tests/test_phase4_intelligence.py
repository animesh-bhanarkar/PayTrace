import os
import sys
import uuid
import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, get_engine, Base
from app.models import Incident, NormalizedEvent, AuditRecord
from app.missing_evidence_engine import evaluate_missing_evidence

client = TestClient(app)

_engine = get_engine()
Base.metadata.create_all(bind=_engine)


def test_missing_evidence_engine_evaluations():
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # 1. Clean and complete timeline
    ev_c1 = NormalizedEvent(
        event_id="evt_c1",
        event_type="payment.created",
        payment_id="pay_clean_1",
        order_id="order_clean_1",
        event_timestamp=now,
        ingestion_timestamp=now,
        source="webhook",
        status="created",
        signature_valid=True,
    )
    ev_c2 = NormalizedEvent(
        event_id="evt_c2",
        event_type="payment.authorized",
        payment_id="pay_clean_1",
        order_id="order_clean_1",
        event_timestamp=now + datetime.timedelta(seconds=5),
        ingestion_timestamp=now + datetime.timedelta(seconds=6),
        source="webhook",
        status="authorized",
        signature_valid=True,
    )
    ev_c3 = NormalizedEvent(
        event_id="evt_c3",
        event_type="payment.captured",
        payment_id="pay_clean_1",
        order_id="order_clean_1",
        event_timestamp=now + datetime.timedelta(seconds=10),
        ingestion_timestamp=now + datetime.timedelta(seconds=11),
        source="webhook",
        status="captured",
        signature_valid=True,
    )
    from app.models import PaymentState
    from app.claim_verifier import VerifiedClaim
    
    state_clean = PaymentState(
        payment_id="pay_clean_1",
        current_state="captured",
        state_history=[{"state": "captured", "event_id": "evt_c3"}]
    )

    report_clean = evaluate_missing_evidence(
        payment_id="pay_clean_1",
        events=[ev_c1, ev_c2, ev_c3],
        reconstructed_state=state_clean,
        incidents=[],
        verified_claims=[]
    )
    assert report_clean.has_missing_evidence is False
    assert report_clean.lifecycle_completeness == 1.0

    # 2. Missing payment.created & delayed capture & unverifiable claim
    ev_g1 = NormalizedEvent(
        event_id="evt_g1",
        event_type="payment.authorized",
        payment_id="pay_gap_1",
        order_id="order_gap_1",
        event_timestamp=now,
        ingestion_timestamp=None, # missing ingestion timestamp
        source="webhook",
        status="authorized",
        signature_valid=True,
    )
    state_gap = PaymentState(
        payment_id="pay_gap_1",
        current_state="authorized",
        state_history=[]
    )
    unsupported_claim = VerifiedClaim(
        claim_id="clm_unsupp_1",
        statement="Customer cancelled before payment created",
        verdict="REJECTED",
        rejection_reason="Evidence evt_non_existent not in payload package",
        evidence_ids=["evt_non_existent"],
        confidence="LOW"
    )

    report_gap = evaluate_missing_evidence(
        payment_id="pay_gap_1",
        events=[ev_g1],
        reconstructed_state=state_gap,
        incidents=[],
        verified_claims=[unsupported_claim]
    )
    assert report_gap.has_missing_evidence is True
    assert len(report_gap.missing_evidence) >= 2
    assert any("payment.created" in item for item in report_gap.missing_evidence)
    assert any("Ingestion timestamp" in item for item in report_gap.missing_evidence)
    assert any("clm_unsupp_1" in item for item in report_gap.missing_evidence)


def test_evidence_endpoints_and_sanitization():
    db_gen = get_db()
    db = next(db_gen)

    uniq = uuid.uuid4().hex[:8]
    test_payment_id = f"pay_ev_{uniq}"
    test_evt_trusted = f"evt_tr_{uniq}"
    test_evt_untrusted = f"evt_un_{uniq}"
    now = datetime.datetime.now(datetime.timezone.utc)

    # Add trusted event with sensitive payload
    ev_tr = NormalizedEvent(
        event_id=test_evt_trusted,
        event_type="payment.authorized",
        payment_id=test_payment_id,
        order_id=f"order_{uniq}",
        event_timestamp=now,
        ingestion_timestamp=now,
        source="webhook",
        status="authorized",
        signature_valid=True,
        raw_payload={
            "id": test_evt_trusted,
            "entity": "event",
            "token": "tok_secret_value_12345",
            "key_secret": "rzp_live_secret_key_abcdef",
            "amount": 50000
        }
    )
    # Add untrusted event
    ev_un = NormalizedEvent(
        event_id=test_evt_untrusted,
        event_type="payment.captured",
        payment_id=test_payment_id,
        order_id=f"order_{uniq}",
        event_timestamp=now,
        ingestion_timestamp=now,
        source="webhook",
        status="captured",
        signature_valid=False,
        raw_payload={"tampered": True}
    )
    db.add_all([ev_tr, ev_un])
    db.commit()

    # 1. Test GET /evidence
    res_list = client.get(f"/evidence?payment_id={test_payment_id}")
    assert res_list.status_code == 200
    items = res_list.json()
    assert len(items) == 2
    tr_item = next(i for i in items if i["evidence_id"] == test_evt_trusted)
    assert tr_item["trust_status"] == "TRUSTED"
    un_item = next(i for i in items if i["evidence_id"] == test_evt_untrusted)
    assert un_item["trust_status"] == "UNTRUSTED"

    # 2. Test GET /evidence with trust_status filter
    res_filt = client.get(f"/evidence?payment_id={test_payment_id}&trust_status=TRUSTED")
    assert res_filt.status_code == 200
    filt_items = res_filt.json()
    assert len(filt_items) == 1
    assert filt_items[0]["evidence_id"] == test_evt_trusted

    # 3. Test GET /evidence/{event_id} and token sanitization
    res_detail = client.get(f"/evidence/{test_evt_trusted}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["evidence_id"] == test_evt_trusted
    assert detail["trust_status"] == "TRUSTED"
    # Verify sanitization
    payload = detail["raw_payload_sanitized"]
    assert payload["token"] == "[REDACTED_SECURITY_SENSITIVE]"
    assert payload["key_secret"] == "[REDACTED_SECURITY_SENSITIVE]"
    assert payload["amount"] == 50000


def test_investigation_history_versioning_and_claims_summary():
    db_gen = get_db()
    db = next(db_gen)

    uniq = uuid.uuid4().hex[:8]
    test_payment_id = f"pay_hist_{uniq}"
    now = datetime.datetime.now(datetime.timezone.utc)

    # Insert two audit records for version comparison
    rec1 = AuditRecord(
        payment_id=test_payment_id,
        evidence_package_id=f"pkg_1_{uniq}",
        ai_activated=False,
        confidence_level="HIGH",
        confidence_score=0.90,
        gemini_raw_output={"hypothesis": "Initial state failed"},
        verified_claims=[
            {
                "claim_id": "c1",
                "statement": "Initial failure state determined",
                "verified": True,
                "confidence": 0.90,
                "evidence_ids": [f"evt_1_{uniq}"]
            }
        ],
        timestamp=now - datetime.timedelta(minutes=10)
    )
    rec2 = AuditRecord(
        payment_id=test_payment_id,
        evidence_package_id=f"pkg_2_{uniq}",
        ai_activated=True,
        confidence_level="HIGH",
        confidence_score=0.95,
        gemini_raw_output={"hypothesis": "State recovered to authorized"},
        verified_claims=[
            {
                "claim_id": "c1",
                "statement": "State recovered to authorized",
                "verified": True,
                "confidence": 0.95,
                "evidence_ids": [f"evt_2_{uniq}"]
            },
            {
                "claim_id": "c2",
                "statement": "Late webhook verified signature",
                "verified": True,
                "confidence": 0.92,
                "evidence_ids": [f"evt_2_{uniq}"]
            }
        ],
        timestamp=now
    )
    db.add_all([rec1, rec2])
    db.commit()

    # 1. GET /investigations/history
    res_hist = client.get(f"/investigations/history?payment_id={test_payment_id}")
    assert res_hist.status_code == 200
    hist_items = res_hist.json()
    assert len(hist_items) == 2

    # 2. GET /investigations/history/{payment_id}/versions
    res_versions = client.get(f"/investigations/history/{test_payment_id}/versions")
    assert res_versions.status_code == 200
    versions = res_versions.json()
    assert len(versions) == 2
    assert versions[0]["version_number"] == 1
    assert versions[1]["version_number"] == 2

    # 3. GET /investigations/compare
    res_cmp = client.get(f"/investigations/compare?v1_audit_id={rec1.id}&v2_audit_id={rec2.id}")
    assert res_cmp.status_code == 200
    cmp_data = res_cmp.json()
    assert cmp_data["payment_id"] == test_payment_id
    assert cmp_data["confidence_changed"] is True
    assert cmp_data["ai_activated_changed"] is True
    assert cmp_data["claims_count_diff"] == 1

    # 4. GET /investigations/claims/summary
    res_claims = client.get(f"/investigations/claims/summary?limit=50")
    assert res_claims.status_code == 200
    summary = res_claims.json()
    assert "total_claims" in summary
    assert "verified_claims" in summary
    assert "verification_rate" in summary
    assert summary["total_claims"] >= 3
