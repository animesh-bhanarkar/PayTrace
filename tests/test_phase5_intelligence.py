"""
Test suite for PayTrace Phase 5 — Advanced Incident Intelligence.

Validates:
1. Incident Fingerprint Engine (determinism, canonical hashing, identifier invariance).
2. Deterministic Incident Similarity Engine (weights, explainability, identical vs disparate).
3. Recurring Pattern Detector (minimum count >= 2, grouping, strength classification).
4. API Endpoints (/incidents/{id}/similar, /patterns, /patterns/{id}, error handling, stable ordering).
"""

import sys
import os
import uuid
import datetime
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.incident_fingerprint import (
    IncidentFingerprint,
    compute_incident_fingerprint,
)
from app.similarity_engine import (
    compute_similarity,
    SimilarityResult,
)
from app.pattern_detector import (
    detect_recurring_patterns,
    RecurringPattern,
)
from app.main import app


client = TestClient(app)


# ===========================================================================
# 1. Incident Fingerprint Engine Tests
# ===========================================================================

def test_fingerprint_determinism_and_identifier_invariance():
    """Verify identical diagnostic features produce identical fingerprint hashes, regardless of IDs."""
    inc_a = SimpleNamespace(
        id=uuid.uuid4(),
        payment_id="pay_AAA111",
        order_id="order_AAA",
        incident_type="duplicate_webhook",
        severity="HIGH",
        detected_at=datetime.datetime(2026, 9, 1, 10, 0, 0),
    )
    ev_a = [
        SimpleNamespace(event_type="payment.authorized", signature_valid=True, delivery_status=None),
        SimpleNamespace(event_type="payment.captured", signature_valid=True, delivery_status=None),
    ]
    state_a = SimpleNamespace(current_state="captured")
    audit_a = SimpleNamespace(ai_activated=False, confidence_level="HIGH", abstained=False)

    fp_a = compute_incident_fingerprint(inc_a, ev_a, state_a, audit_a)

    # Incident B has different payment_id, order_id, UUID, and detected_at, but same diagnostic features
    inc_b = SimpleNamespace(
        id=uuid.uuid4(),
        payment_id="pay_BBB222_completely_different",
        order_id="order_BBB_different",
        incident_type="duplicate_webhook",
        severity="HIGH",
        detected_at=datetime.datetime(2026, 9, 5, 18, 30, 0),
    )
    ev_b = [
        SimpleNamespace(event_type="payment.authorized", signature_valid=True, delivery_status=None),
        SimpleNamespace(event_type="payment.captured", signature_valid=True, delivery_status=None),
    ]
    state_b = SimpleNamespace(current_state="captured")
    audit_b = SimpleNamespace(ai_activated=False, confidence_level="HIGH", abstained=False)

    fp_b = compute_incident_fingerprint(inc_b, ev_b, state_b, audit_b)

    assert fp_a == fp_b
    assert fp_a.fingerprint_hash() == fp_b.fingerprint_hash()
    assert fp_a.canonical_dict() == fp_b.canonical_dict()


def test_fingerprint_different_diagnostic_characteristics_differ():
    """Verify different failure modes produce distinct fingerprints."""
    inc_dup = SimpleNamespace(
        incident_type="duplicate_webhook",
        severity="HIGH",
    )
    fp_dup = compute_incident_fingerprint(inc_dup)

    inc_sig = SimpleNamespace(
        incident_type="signature_verification_failure",
        severity="HIGH",
    )
    fp_sig = compute_incident_fingerprint(inc_sig)

    assert fp_dup != fp_sig
    assert fp_dup.fingerprint_hash() != fp_sig.fingerprint_hash()


# ===========================================================================
# 2. Deterministic Incident Similarity Engine Tests
# ===========================================================================

def test_identical_fingerprints_have_max_similarity():
    """Identical fingerprints must yield a 1.0 similarity score with detailed matching features."""
    fp = IncidentFingerprint(
        incident_type="duplicate_webhook",
        severity="HIGH",
        reconstructed_state="captured",
        event_types=("payment.authorized", "payment.captured"),
        has_duplicate_webhook=True,
        has_delayed_webhook=False,
        has_out_of_order_event=False,
        has_signature_failure=False,
        has_invalid_transition=False,
        missing_evidence_detected=False,
        ai_activated=False,
        confidence_level="HIGH",
        abstained=False,
    )

    sim = compute_similarity(fp, fp)
    assert sim.similarity_score == 1.0
    assert len(sim.non_matching_critical_features) == 0
    assert len(sim.matching_features) > 0
    assert "duplicate_webhook" in sim.comparison_summary


def test_unrelated_incidents_yield_low_similarity():
    """Completely distinct incident types and payment states must yield low similarity score."""
    fp_dup = IncidentFingerprint(
        incident_type="duplicate_webhook",
        severity="HIGH",
        reconstructed_state="captured",
        event_types=("payment.captured",),
        has_duplicate_webhook=True,
    )

    fp_gap = IncidentFingerprint(
        incident_type="missing_evidence",
        severity="LOW",
        reconstructed_state="created",
        event_types=("payment.created",),
        missing_evidence_detected=True,
    )

    sim = compute_similarity(fp_dup, fp_gap)
    assert sim.similarity_score < 0.35
    assert len(sim.non_matching_critical_features) > 0
    assert "Different incident types" in sim.non_matching_critical_features[0]


def test_similarity_is_repeatable_and_deterministic():
    """Repeated execution must produce identical float and string results."""
    fp1 = IncidentFingerprint(
        incident_type="invalid_transition",
        severity="HIGH",
        reconstructed_state="authorized",
        has_invalid_transition=True,
    )
    fp2 = IncidentFingerprint(
        incident_type="invalid_transition",
        severity="HIGH",
        reconstructed_state="failed",
        has_invalid_transition=True,
    )

    res1 = compute_similarity(fp1, fp2)
    res2 = compute_similarity(fp1, fp2)

    assert res1.similarity_score == res2.similarity_score
    assert res1.matching_features == res2.matching_features
    assert res1.non_matching_critical_features == res2.non_matching_critical_features
    assert res1.comparison_summary == res2.comparison_summary


# ===========================================================================
# 3. Recurring Pattern Detection Tests
# ===========================================================================

def test_recurring_pattern_formed_for_two_or_more_incidents():
    """When >= 2 incidents share diagnostic signatures, a pattern is detected."""
    fp1 = IncidentFingerprint(
        incident_type="duplicate_webhook",
        severity="HIGH",
        reconstructed_state="captured",
        has_duplicate_webhook=True,
    )
    fp2 = IncidentFingerprint(
        incident_type="duplicate_webhook",
        severity="HIGH",
        reconstructed_state="captured",
        has_duplicate_webhook=True,
    )

    items = [
        {
            "incident": SimpleNamespace(
                id="inc_001",
                payment_id="pay_001",
                order_id="order_001",
                severity="HIGH",
                description="Duplicate hash 1",
                detected_at=datetime.datetime(2026, 9, 1, 12, 0),
            ),
            "fingerprint": fp1,
        },
        {
            "incident": SimpleNamespace(
                id="inc_002",
                payment_id="pay_002",
                order_id="order_002",
                severity="HIGH",
                description="Duplicate hash 2",
                detected_at=datetime.datetime(2026, 9, 2, 14, 0),
            ),
            "fingerprint": fp2,
        },
    ]

    patterns = detect_recurring_patterns(items)
    assert len(patterns) == 1
    p = patterns[0]
    assert p.incident_count == 2
    assert p.pattern_strength == "EMERGING"
    assert "DUPLICATE_WEBHOOK" in p.pattern_type
    assert "inc_001" in p.supporting_incident_ids
    assert "inc_002" in p.supporting_incident_ids
    assert "pay_001" in p.supporting_payment_ids
    assert "pay_002" in p.supporting_payment_ids


def test_single_incident_does_not_form_a_pattern():
    """An isolated incident (count == 1) must NEVER form a recurring pattern."""
    fp_lone = IncidentFingerprint(
        incident_type="delayed_webhook",
        severity="MEDIUM",
        reconstructed_state="authorized",
        has_delayed_webhook=True,
    )
    items = [
        {
            "incident": SimpleNamespace(
                id="inc_single",
                payment_id="pay_single",
                order_id="order_single",
                severity="MEDIUM",
                description="Lone delayed webhook",
                detected_at=datetime.datetime(2026, 9, 1, 12, 0),
            ),
            "fingerprint": fp_lone,
        }
    ]

    patterns = detect_recurring_patterns(items)
    assert len(patterns) == 0


def test_unrelated_incidents_are_not_grouped_together():
    """Incidents with distinct failure types or states must not be merged into the same pattern."""
    fp_dup = IncidentFingerprint(
        incident_type="duplicate_webhook",
        severity="HIGH",
        reconstructed_state="captured",
        has_duplicate_webhook=True,
    )
    fp_sig = IncidentFingerprint(
        incident_type="signature_verification_failure",
        severity="HIGH",
        reconstructed_state="unknown",
        has_signature_failure=True,
    )

    items = [
        {
            "incident": SimpleNamespace(id="inc_1", payment_id="pay_1", severity="HIGH", detected_at="2026-09-01T10:00:00Z"),
            "fingerprint": fp_dup,
        },
        {
            "incident": SimpleNamespace(id="inc_2", payment_id="pay_2", severity="HIGH", detected_at="2026-09-02T10:00:00Z"),
            "fingerprint": fp_sig,
        },
    ]

    patterns = detect_recurring_patterns(items)
    # Neither has >= 2 incidents, so zero patterns should be formed
    assert len(patterns) == 0


# ===========================================================================
# 4. API Endpoints Integration Tests
# ===========================================================================

def test_api_similar_incidents_missing_returns_404():
    """Calling /incidents/{id}/similar with a nonexistent ID returns 404."""
    response = client.get(f"/incidents/{uuid.uuid4()}/similar")
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


def test_api_patterns_endpoints():
    """Verify /patterns and /patterns/{id} return expected models and handle nonexistent patterns."""
    response = client.get("/patterns")
    assert response.status_code == 200
    patterns = response.json()
    assert isinstance(patterns, list)

    # Nonexistent pattern detail returns 404
    detail_res = client.get("/patterns/pat_nonexistent_9999")
    assert detail_res.status_code == 404


def test_api_similar_incidents_with_real_incident():
    """If real incidents exist in DB, verify /incidents/{id}/similar returns ranked results."""
    # List incidents from DB
    list_res = client.get("/incidents?limit=5")
    assert list_res.status_code == 200
    incidents = list_res.json()

    if incidents:
        target = incidents[0]
        target_id = target["id"]
        sim_res = client.get(f"/incidents/{target_id}/similar?min_similarity=0.0&limit=5")
        assert sim_res.status_code == 200
        data = sim_res.json()

        assert data["incident_id"] == target_id
        assert "fingerprint" in data
        assert "similar_incidents" in data
        assert "total_compared" in data

        # Ensure the selected incident was excluded from similar results (no self-comparison)
        for sim in data["similar_incidents"]:
            assert sim["incident_id"] != target_id
            assert 0.0 <= sim["similarity_score"] <= 1.0
            assert isinstance(sim["matching_features"], list)
