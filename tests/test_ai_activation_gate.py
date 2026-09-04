import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.models import NormalizedEvent
from app.incident_detector import IncidentReport, DUPLICATE_WEBHOOK, DELAYED_WEBHOOK
from app.ai_activation_gate import should_activate_ai

def _make_incident(severity="LOW", incident_type="some_incident") -> IncidentReport:
    return IncidentReport(
        incident_type=incident_type,
        payment_id="pay_test",
        order_id="order_test",
        description="test",
        severity=severity,
        evidence_ids=[]
    )

def test_ai_trigger_on_requires_ai_investigation_true():
    auth_result = {"requires_ai_investigation": True}
    activate, reason = should_activate_ai(auth_result, [_make_incident("HIGH")], [NormalizedEvent()])
    assert activate is True
    assert "High-severity incident requires AI investigation" in reason

def test_no_activation_on_empty_events():
    auth_result = {"requires_ai_investigation": False}
    activate, reason = should_activate_ai(auth_result, [_make_incident("LOW")], [])
    assert activate is False
    assert reason == "No events to investigate"

def test_no_activation_on_all_low_incidents():
    auth_result = {"requires_ai_investigation": False}
    activate, reason = should_activate_ai(
        auth_result, 
        [_make_incident("LOW"), _make_incident("LOW")], 
        [NormalizedEvent()]
    )
    assert activate is False
    assert "All incidents low severity" in reason

def test_no_activation_on_only_duplicate_webhook():
    auth_result = {"requires_ai_investigation": False}
    activate, reason = should_activate_ai(
        auth_result, 
        [_make_incident("HIGH", DUPLICATE_WEBHOOK)], 
        [NormalizedEvent()]
    )
    assert activate is False
    assert "Duplicate webhook is deterministic" in reason

def test_default_no_activation():
    auth_result = {"requires_ai_investigation": False}
    activate, reason = should_activate_ai(
        auth_result, 
        [], 
        [NormalizedEvent()]
    )
    assert activate is False
    assert reason == "Deterministic diagnosis sufficient"
