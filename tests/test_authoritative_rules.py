"""
tests/test_authoritative_rules.py

Pure unit tests for apply_authoritative_rules().
No DB connection required.
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.models import PaymentState
from app.incident_detector import (
    IncidentReport,
    DUPLICATE_WEBHOOK,
    DELAYED_WEBHOOK,
    OUT_OF_ORDER,
    INVALID_TRANSITION,
    AMBIGUOUS_STATE,
    SIGNATURE_VERIFICATION_FAILURE,
    MISSING_EVIDENCE,
)
from app.authoritative_rules import apply_authoritative_rules


def _make_state(current_state: str = "captured") -> PaymentState:
    return PaymentState(
        payment_id="pay_test_001",
        order_id="order_test_001",
        current_state=current_state,
        state_history=[],
    )


def _make_incident(incident_type: str, severity: str) -> IncidentReport:
    return IncidentReport(
        incident_type=incident_type,
        payment_id="pay_test_001",
        order_id="order_test_001",
        description="test incident",
        severity=severity,
        evidence_ids=["evt_001"],
    )


# ── Test 1: No incidents → HIGH confidence ──────────────────────────────────

def test_no_incidents_returns_high_confidence():
    result = apply_authoritative_rules(_make_state(), [])
    assert result["confidence_hint"] == "HIGH"
    assert result["requires_ai_investigation"] is False
    assert result["authoritative_state"] == "captured"


# ── Test 2: Only MEDIUM incidents → MEDIUM confidence ───────────────────────

def test_only_medium_incidents_returns_medium():
    incidents = [
        _make_incident(DELAYED_WEBHOOK, "MEDIUM"),
        _make_incident(OUT_OF_ORDER, "MEDIUM"),
    ]
    result = apply_authoritative_rules(_make_state(), incidents)
    assert result["confidence_hint"] == "MEDIUM"
    assert result["requires_ai_investigation"] is False


# ── Test 3: One HIGH incident → LOW confidence, ai_required=True ────────────

def test_one_high_incident_returns_low_confidence():
    incidents = [_make_incident(SIGNATURE_VERIFICATION_FAILURE, "HIGH")]
    result = apply_authoritative_rules(_make_state(), incidents)
    assert result["confidence_hint"] == "LOW"
    assert result["requires_ai_investigation"] is True


# ── Test 4: INVALID_TRANSITION forces ai_required regardless of severity ─────

def test_invalid_transition_forces_ai_investigation():
    # Give it MEDIUM severity to check that type alone triggers AI
    incidents = [_make_incident(INVALID_TRANSITION, "HIGH")]
    result = apply_authoritative_rules(_make_state(), incidents)
    assert result["requires_ai_investigation"] is True


# ── Test 5: reason string names the specific incident types ─────────────────

def test_reason_names_incident_types():
    incidents = [
        _make_incident(DUPLICATE_WEBHOOK, "HIGH"),
        _make_incident(DELAYED_WEBHOOK, "MEDIUM"),
    ]
    result = apply_authoritative_rules(_make_state(), incidents)
    reason = result["reason"]
    assert "duplicate_webhook" in reason
    assert "delayed_webhook" in reason

def test_duplicate_webhook_alone_does_not_require_ai():
    incidents = [_make_incident(DUPLICATE_WEBHOOK, "HIGH")]
    result = apply_authoritative_rules(_make_state(), incidents)
    assert result["requires_ai_investigation"] is False
    assert result["confidence_hint"] == "HIGH"
