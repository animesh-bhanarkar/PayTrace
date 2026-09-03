import datetime
import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.models import NormalizedEvent
from app.incident_detector import (
    detect_incidents,
    DUPLICATE_WEBHOOK,
    DELAYED_WEBHOOK,
    OUT_OF_ORDER,
    INVALID_TRANSITION,
    SIGNATURE_VERIFICATION_FAILURE,
    MISSING_EVIDENCE,
    AMBIGUOUS_STATE
)

def test_duplicate_webhook_detected():
    e1 = NormalizedEvent(payload_hash="hash1")
    new_e = NormalizedEvent(payload_hash="hash1")
    incidents = detect_incidents(new_e, [e1], [{"anomaly": None}], True)
    assert any(i.incident_type == DUPLICATE_WEBHOOK for i in incidents)

def test_delayed_webhook_detected():
    t_event = datetime.datetime(2026, 9, 3, 10, 0, tzinfo=datetime.timezone.utc)
    t_ingest = datetime.datetime(2026, 9, 3, 10, 10, tzinfo=datetime.timezone.utc)
    new_e = NormalizedEvent(event_timestamp=t_event, ingestion_timestamp=t_ingest)
    incidents = detect_incidents(new_e, [], [{"anomaly": None}], True)
    assert any(i.incident_type == DELAYED_WEBHOOK for i in incidents)

def test_out_of_order_detected():
    t_old = datetime.datetime(2026, 9, 3, 10, 5, tzinfo=datetime.timezone.utc)
    t_new = datetime.datetime(2026, 9, 3, 10, 0, tzinfo=datetime.timezone.utc)
    e1 = NormalizedEvent(event_timestamp=t_old)
    new_e = NormalizedEvent(event_timestamp=t_new)
    incidents = detect_incidents(new_e, [e1], [{"anomaly": None}], True)
    assert any(i.incident_type == OUT_OF_ORDER for i in incidents)

def test_invalid_transition_detected():
    new_e = NormalizedEvent()
    incidents = detect_incidents(new_e, [], [{"anomaly": "Invalid transition: created -> payment.captured"}], True)
    assert any(i.incident_type == INVALID_TRANSITION for i in incidents)

def test_signature_verification_failure_detected():
    new_e = NormalizedEvent()
    incidents = detect_incidents(new_e, [], [{"anomaly": None}], False)
    assert any(i.incident_type == SIGNATURE_VERIFICATION_FAILURE for i in incidents)

def test_missing_evidence_detected():
    new_e = NormalizedEvent()
    incidents = detect_incidents(new_e, [], [], True)
    assert any(i.incident_type == MISSING_EVIDENCE for i in incidents)

def test_clean_event_no_anomalies():
    t_event = datetime.datetime(2026, 9, 3, 10, 0, tzinfo=datetime.timezone.utc)
    t_ingest = datetime.datetime(2026, 9, 3, 10, 1, tzinfo=datetime.timezone.utc)
    new_e = NormalizedEvent(event_timestamp=t_event, ingestion_timestamp=t_ingest, payload_hash="hash2")
    e1 = NormalizedEvent(event_timestamp=t_event - datetime.timedelta(minutes=1), payload_hash="hash1")
    
    incidents = detect_incidents(new_e, [e1], [{"anomaly": None}], True)
    assert len(incidents) == 0
