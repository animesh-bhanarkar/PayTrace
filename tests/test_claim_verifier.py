"""Pure unit tests for claim_verifier.py - no DB, no Gemini."""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import pytest
from app.claim_verifier import verify_claims, VerifiedClaim

EVIDENCE_PACKAGE = {
    "evidence_id": "pkg-001",
    "events": [
        {"evidence_id": "evt_001", "event_type": "payment.authorized", "payment_id": "pay_001"},
        {"evidence_id": "evt_002", "event_type": "payment.captured",   "payment_id": "pay_001"},
    ],
    "reconstructed_state": {"current_state": "captured", "state_history": []}
}


def test_valid_claim_supported():
    """Claim with existing evidence_id -> SUPPORTED."""
    claims = [
        {
            "claim_id": "C1",
            "statement": "Payment was authorized.",
            "evidence_ids": ["evt_001"],
            "counter_evidence_ids": [],
            "confidence": "HIGH",
        }
    ]
    result = verify_claims(claims, EVIDENCE_PACKAGE)
    assert len(result) == 1
    assert result[0].verdict == "SUPPORTED"
    assert result[0].rejection_reason is None
    assert result[0].claim_id == "C1"


def test_nonexistent_evidence_id_rejected():
    """Claim citing a nonexistent evidence_id -> REJECTED with reason."""
    claims = [
        {
            "claim_id": "C2",
            "statement": "Something happened.",
            "evidence_ids": ["evt_999"],
            "counter_evidence_ids": [],
            "confidence": "MEDIUM",
        }
    ]
    result = verify_claims(claims, EVIDENCE_PACKAGE)
    assert len(result) == 1
    assert result[0].verdict == "REJECTED"
    assert "evt_999" in result[0].rejection_reason


def test_empty_evidence_ids_rejected():
    """Claim with empty evidence_ids list -> REJECTED 'Claim cites no evidence'."""
    claims = [
        {
            "claim_id": "C3",
            "statement": "Nothing cited.",
            "evidence_ids": [],
            "counter_evidence_ids": [],
            "confidence": "LOW",
        }
    ]
    result = verify_claims(claims, EVIDENCE_PACKAGE)
    assert len(result) == 1
    assert result[0].verdict == "REJECTED"
    assert result[0].rejection_reason == "Claim cites no evidence"


def test_null_evidence_ids_unverifiable():
    """Claim with null evidence_ids -> UNVERIFIABLE."""
    claims = [
        {
            "claim_id": "C4",
            "statement": "Unknown claim.",
            "evidence_ids": None,
            "counter_evidence_ids": [],
            "confidence": "LOW",
        }
    ]
    result = verify_claims(claims, EVIDENCE_PACKAGE)
    assert len(result) == 1
    assert result[0].verdict == "UNVERIFIABLE"
    assert result[0].rejection_reason is None


def test_mixed_claims_returns_correct_verdicts():
    """Multiple claims: mix of SUPPORTED and REJECTED returned correctly."""
    claims = [
        {
            "claim_id": "C1",
            "statement": "Valid claim.",
            "evidence_ids": ["evt_001"],
            "counter_evidence_ids": [],
            "confidence": "HIGH",
        },
        {
            "claim_id": "C2",
            "statement": "Bad evidence.",
            "evidence_ids": ["evt_MISSING"],
            "counter_evidence_ids": [],
            "confidence": "LOW",
        },
        {
            "claim_id": "C3",
            "statement": "Another valid claim.",
            "evidence_ids": ["evt_002"],
            "counter_evidence_ids": [],
            "confidence": "MEDIUM",
        },
    ]
    result = verify_claims(claims, EVIDENCE_PACKAGE)
    assert len(result) == 3
    verdicts = {r.claim_id: r.verdict for r in result}
    assert verdicts["C1"] == "SUPPORTED"
    assert verdicts["C2"] == "REJECTED"
    assert verdicts["C3"] == "SUPPORTED"
