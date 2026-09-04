import pytest
import datetime
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.models import NormalizedEvent, PaymentState
from app.incident_detector import IncidentReport
from app.evidence_package import build_evidence_package

def test_package_contains_correct_keys():
    state = PaymentState(payment_id="pay_test", current_state="created", state_history=[])
    pkg = build_evidence_package("pay_test", [], state, [])
    
    assert "payment_id" in pkg
    assert "evidence_id" in pkg
    assert "generated_at" in pkg
    assert "events" in pkg
    assert "reconstructed_state" in pkg
    assert "incidents" in pkg
    assert "missing_evidence_hint" in pkg

def test_no_raw_payload_in_package():
    e1 = NormalizedEvent(
        event_id="evt_1",
        event_type="payment.created",
        payment_id="pay_test",
        raw_payload={"secret": "data"},
        source="webhook",
        status="created",
        signature_valid=True
    )
    state = PaymentState(payment_id="pay_test", current_state="created", state_history=[])
    pkg = build_evidence_package("pay_test", [e1], state, [])
    
    assert "raw_payload" not in pkg["events"][0]
    assert pkg["events"][0]["evidence_id"] == "evt_1"

def test_evidence_id_is_unique_per_call():
    state = PaymentState(payment_id="pay_test", current_state="created", state_history=[])
    pkg1 = build_evidence_package("pay_test", [], state, [])
    pkg2 = build_evidence_package("pay_test", [], state, [])
    
    assert pkg1["evidence_id"] != pkg2["evidence_id"]

def test_missing_evidence_hint_set_when_state_history_empty():
    state = PaymentState(payment_id="pay_test", current_state="created", state_history=[])
    pkg = build_evidence_package("pay_test", [], state, [])
    
    assert pkg["missing_evidence_hint"] is not None
    assert "No state history available" in pkg["missing_evidence_hint"]

def test_events_correctly_serialized_with_iso_timestamps():
    t_now = datetime.datetime.now(datetime.timezone.utc)
    e1 = NormalizedEvent(
        event_id="evt_1",
        event_timestamp=t_now
    )
    state = PaymentState(payment_id="pay_test", current_state="created", state_history=[{"anomaly": None}])
    pkg = build_evidence_package("pay_test", [e1], state, [])
    
    assert pkg["events"][0]["event_timestamp"] == t_now.isoformat()
