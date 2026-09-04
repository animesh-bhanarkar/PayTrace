"""
Pre-Phase-9 Regression Tests: Payment-State Authority Model & MCP Safety Boundary.

Invariants verified:
1. Razorpay payment/API state is strictly authoritative for Razorpay-side financial/payment state.
2. Merchant-side records represent merchant belief/state and may disagree with Razorpay.
3. Webhooks are event-observation/delivery evidence, not automatically authoritative financial truth.
4. AI must NEVER decide which payment state is financially authoritative.
5. Deterministic separation: "What is the payment state?" is deterministic; "Why did systems disagree?" may involve AI/causal diagnostics.
6. Prohibited MCP financial mutations (capture, refund, payout, transfer, links, SQL, shell) are strictly blocked.
7. Allowed MCP tools are read-only and evidence-oriented.
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.webhook_diagnostics import reconcile_states
from app.claim_verifier import (
    verify_claims,
    verify_advanced_claims,
    _check_authoritative_contradiction,
)
from app.confidence_engine import (
    compute_confidence,
    compute_advanced_confidence,
)
from app.mcp_safety import (
    PROHIBITED_MCP_OPERATIONS,
    ALLOWED_MCP_TOOLS,
    validate_mcp_tool_safety,
    is_safe_mcp_tool,
    MCPSafetyViolationError,
)


# ── TEST 1: Razorpay CAPTURED + Merchant FAILED ───────────────────────────────

def test_reconciliation_razorpay_captured_merchant_failed():
    """
    When Razorpay says 'captured' while merchant record says 'failed':
    Deterministic reconstruction must establish:
      authoritative payment state = CAPTURED
      merchant state = FAILED
      discrepancy = merchant-side state has not reflected authoritative payment state
    """
    recon = reconcile_states(
        authoritative_state="captured",
        trusted_webhook_events=[
            type("Obj", (), {
                "event_type": "payment.captured",
                "event_timestamp": None,
                "ingestion_timestamp": None,
            })()
        ],
        merchant_state="failed",
    )

    # 1. "What is the payment state?" -> Deterministically CAPTURED
    assert recon["authoritative_payment_state"] == "CAPTURED"
    assert recon["merchant_state"] == "FAILED"
    assert recon["has_discrepancy"] is True

    # 2. "Why did the systems disagree?" -> Merchant has not reflected authoritative state
    assert recon["discrepancy"] == "merchant-side state has not reflected authoritative payment state"
    assert recon["status"] == "MERCHANT_NOT_UPDATED"


# ── TEST 2: Razorpay FAILED + Merchant CAPTURED ───────────────────────────────

def test_reconciliation_razorpay_failed_merchant_captured():
    """
    When Razorpay says 'failed' while merchant record says 'captured':
    Deterministic reconstruction must establish:
      authoritative payment state = FAILED
      merchant state = CAPTURED
      discrepancy = merchant-side state records capture but authoritative payment state is failed
    """
    recon = reconcile_states(
        authoritative_state="failed",
        trusted_webhook_events=[
            type("Obj", (), {
                "event_type": "payment.failed",
                "event_timestamp": None,
                "ingestion_timestamp": None,
            })()
        ],
        merchant_state="captured",
    )

    # 1. "What is the payment state?" -> Deterministically FAILED
    assert recon["authoritative_payment_state"] == "FAILED"
    assert recon["merchant_state"] == "CAPTURED"
    assert recon["has_discrepancy"] is True

    # 2. "Why did the systems disagree?" -> Merchant recorded capture despite failed authoritative state
    assert recon["discrepancy"] == "merchant-side state records capture but authoritative payment state is failed"
    assert recon["status"] == "CONFLICTING_OBSERVATIONS"


# ── TEST 3: Webhook Evidence Conflicting with Authoritative Razorpay State ─────

def test_webhook_conflicts_with_authoritative_razorpay_state():
    """
    Webhooks are delivery/observation evidence, NOT automatically authoritative truth.
    If a webhook indicates payment.failed, but authoritative Razorpay state is captured,
    the authoritative payment state remains CAPTURED.
    """
    # Razorpay authoritative state is captured (e.g. verified via Razorpay API or late-capture transition)
    # but the latest webhook event observed in transit was payment.failed
    conflicting_webhook = type("Obj", (), {
        "event_type": "payment.failed",
        "event_timestamp": None,
        "ingestion_timestamp": None,
    })()

    recon = reconcile_states(
        authoritative_state="captured",
        trusted_webhook_events=[conflicting_webhook],
        merchant_state="failed",
    )

    # Authoritative payment state is strictly CAPTURED (Razorpay financial truth wins)
    assert recon["authoritative_payment_state"] == "CAPTURED"
    assert recon["razorpay_state"] == "captured"
    assert recon["webhook_state"] == "failed"
    assert recon["has_discrepancy"] is True
    assert recon["discrepancy"] == "merchant-side state has not reflected authoritative payment state"


# ── TEST 4: AI Output Attempting to Claim Non-Authoritative State ──────────────

def test_ai_claim_contradicting_authoritative_payment_state_phase8():
    """
    Phase 8 5-verdict claim verifier:
    If AI attempts to claim 'payment failed' when authoritative state is 'captured',
    claim must be CONTRADICTED. Authoritative evidence wins.
    Confidence engine must abstain / return INCONCLUSIVE.
    """
    evidence_package = {
        "authoritative_state": {
            "payment_id": "pay_test_001",
            "current_state": "captured",
        },
        "events": [
            {"evidence_id": "ev_001", "event_type": "payment.authorized"},
            {"evidence_id": "ev_002", "event_type": "payment.captured"},
        ],
    }

    # AI hallucinating that the payment failed despite authoritative capture
    claims = [
        {
            "claim_id": "claim_001",
            "statement": "The payment failed due to an upstream gateway failure",
            "claim_type": "CAUSAL",
            "evidence_ids": ["ev_001"],
            "counter_evidence_ids": [],
        }
    ]

    verified = verify_advanced_claims(claims, evidence_package)
    assert len(verified) == 1
    assert verified[0].verdict == "CONTRADICTED"
    assert "Authoritative evidence wins" in verified[0].verdict_reason

    # Confidence engine check: CONTRADICTED claim forces INCONCLUSIVE abstention
    conf = compute_advanced_confidence(
        advanced_claims=[c.to_dict() for c in verified],
        hypothesis_verifications=[],
        causal_step_verifications=[],
        incidents=[],
        authoritative_result={"authoritative_state": "captured", "confidence_hint": "LOW"},
        ai_activated=True,
        ai_abstention_signal="NONE",
    )
    assert conf["outcome"] == "INCONCLUSIVE"
    assert conf["abstain"] is True
    assert "CONTRADICTED by authoritative payment state" in conf["reason"]


def test_ai_claim_contradicting_authoritative_payment_state_phase1_7():
    """
    Phase 1-7 3-verdict claim verifier:
    If AI attempts to claim 'payment failed' when authoritative state is 'captured',
    claim must be REJECTED.
    """
    evidence_package = {
        "reconstructed_state": {
            "payment_id": "pay_test_002",
            "current_state": "captured",
        },
        "events": [
            {"evidence_id": "ev_001", "event_type": "payment.authorized"},
        ],
    }

    claims = [
        {
            "claim_id": "c1",
            "statement": "The authoritative payment state is failed",
            "evidence_ids": ["ev_001"],
            "counter_evidence_ids": [],
            "confidence": "HIGH",
        }
    ]

    verified = verify_claims(claims, evidence_package)
    assert len(verified) == 1
    assert verified[0].verdict == "REJECTED"
    assert "Claim contradicts authoritative payment state" in verified[0].rejection_reason


# ── TEST 5: Unresolved Causal Explanation While Authoritative State Remains Deterministic

def test_unresolved_causal_explanation_with_deterministic_payment_state():
    """
    Separation of concerns:
    - 'What is the payment state?' -> Strictly deterministic (CAPTURED).
    - 'Why did systems disagree?' -> Unresolved causal explanation (AI abstains).
    The system abstains from causal certainty, but authoritative payment state remains solid.
    """
    # 1. Deterministic reconstruction establishes state
    recon = reconcile_states(
        authoritative_state="captured",
        trusted_webhook_events=[],
        merchant_state="failed",
    )
    assert recon["authoritative_payment_state"] == "CAPTURED"
    assert recon["has_discrepancy"] is True

    # 2. AI investigation attempts to find cause, but evidence is missing (no delivery logs)
    # AI returns abstention signal INSUFFICIENT_EVIDENCE
    evidence_package = {
        "authoritative_state": {
            "payment_id": "pay_test_003",
            "current_state": "captured",
        },
        "events": [],
    }

    claims = [
        {
            "claim_id": "claim_001",
            "statement": "Merchant service dropped callback due to network partition",
            "claim_type": "CAUSAL",
            "evidence_ids": [],  # no evidence available
            "counter_evidence_ids": [],
        }
    ]

    verified = verify_advanced_claims(claims, evidence_package)
    assert verified[0].verdict == "UNSUPPORTED"

    conf = compute_advanced_confidence(
        advanced_claims=[c.to_dict() for c in verified],
        hypothesis_verifications=[],
        causal_step_verifications=[],
        incidents=[],
        authoritative_result={"authoritative_state": "captured", "confidence_hint": "LOW"},
        ai_activated=True,
        ai_abstention_signal="INSUFFICIENT_EVIDENCE",
    )

    # Causal hypothesis is ABSTAINED / INCONCLUSIVE
    assert conf["outcome"] == "INCONCLUSIVE"
    assert conf["abstain"] is True

    # Authoritative payment state was NOT weakened or overturned
    assert recon["authoritative_payment_state"] == "CAPTURED"


# ── TEST 6: MCP Safety Boundary Policy ────────────────────────────────────────

def test_mcp_safety_blocks_prohibited_operations():
    """Verify all prohibited operations (capture, refund, payout, links, SQL, shell) are blocked."""
    prohibited_samples = [
        "capture",
        "refund",
        "modify_payment",
        "update_payment",
        "payout",
        "transfer",
        "create_payment_link",
        "update_payment_link",
        "cancel_payment_link",
        "modify_checkout",
        "execute_sql",
        "execute_query",
        "execute_shell",
        "run_command",
        "eval_code",
    ]

    for tool in prohibited_samples:
        assert not is_safe_mcp_tool(tool)
        with pytest.raises(MCPSafetyViolationError) as exc_info:
            validate_mcp_tool_safety(tool)
        assert "financial mutation or arbitrary system access" in str(exc_info.value)


def test_mcp_safety_allows_approved_tools():
    """Verify that only approved read-only and investigation tools pass validation."""
    for tool in ALLOWED_MCP_TOOLS:
        assert is_safe_mcp_tool(tool)
        assert validate_mcp_tool_safety(tool) is True


def test_mcp_safety_rejects_unknown_tools():
    """Verify that unapproved tools (e.g. unknown mutations) are rejected."""
    unknown_tools = ["restart_server", "export_secrets", "delete_records"]
    for tool in unknown_tools:
        assert not is_safe_mcp_tool(tool)
        with pytest.raises(MCPSafetyViolationError):
            validate_mcp_tool_safety(tool)
