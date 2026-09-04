"""
backend/app/authoritative_rules.py

Authoritative source hierarchy for PayTrace:
  1. Razorpay API         — definitive financial / payment state authority
  2. Webhook events       — delivery / event observation evidence
  3. Merchant records     — merchant-side belief only (lowest authority)

This module applies a purely deterministic ruleset to determine confidence
level and whether AI investigation is warranted.  No DB calls.  No external
calls.
"""
from typing import List

from app.models import PaymentState
from app.incident_detector import (
    IncidentReport,
    INVALID_TRANSITION,
    AMBIGUOUS_STATE,
    DUPLICATE_WEBHOOK,
)

# Incident types that always demand AI investigation regardless of severity
_AI_TRIGGER_TYPES = {INVALID_TRANSITION, AMBIGUOUS_STATE}


def apply_authoritative_rules(
    reconstructed_state: PaymentState,
    incidents: List[IncidentReport],
) -> dict:
    """
    Evaluate reconstructed payment state and detected incidents against the
    authoritative-source hierarchy and return a confidence / routing decision.

    Args:
        reconstructed_state: PaymentState produced by the state reconstructor.
        incidents:           List of IncidentReport from detect_incidents().

    Returns:
        {
            "authoritative_state":      str,   # current_state from reconstructed_state
            "confidence_hint":          str,   # "HIGH" | "MEDIUM" | "LOW"
            "requires_ai_investigation": bool,
            "reason":                   str,
        }
    """
    authoritative_state: str = reconstructed_state.current_state

    # ── Categorise incidents by severity and type ───────────────────────────
    high_incidents   = [i for i in incidents if i.severity == "HIGH"]
    medium_incidents = [i for i in incidents if i.severity == "MEDIUM"]
    ai_trigger_types = [i for i in incidents if i.incident_type in _AI_TRIGGER_TYPES]

    incident_type_names = [i.incident_type for i in incidents]
    
    high_incidents_for_ai = [i for i in high_incidents if i.incident_type != DUPLICATE_WEBHOOK]
    all_duplicate = bool(incidents) and all(i.incident_type == DUPLICATE_WEBHOOK for i in incidents)

    # ── Determine requires_ai_investigation ────────────────────────────────
    requires_ai = bool(high_incidents_for_ai) or bool(ai_trigger_types)

    # ── Determine confidence_hint ──────────────────────────────────────────
    if not incidents or all_duplicate:
        confidence_hint = "HIGH"
    elif high_incidents_for_ai:
        confidence_hint = "LOW"
    else:
        # Only LOW / MEDIUM incidents present, or high severity incidents that don't trigger AI
        confidence_hint = "MEDIUM"

    # ── Build human-readable reason ────────────────────────────────────────
    if not incidents:
        reason = (
            f"Payment state '{authoritative_state}' reconstructed from verified "
            f"webhook events with no anomalies detected. "
            f"Razorpay webhook chain is clean."
        )
    else:
        unique_types = sorted(set(incident_type_names))
        type_list = ", ".join(unique_types)
        if requires_ai:
            reason = (
                f"Payment state '{authoritative_state}' has reduced confidence due to: "
                f"{type_list}. "
                f"AI investigation required to resolve ambiguity."
            )
        else:
            reason = (
                f"Payment state '{authoritative_state}' has moderate confidence. "
                f"Non-critical incidents detected: {type_list}. "
                f"No AI investigation required at this time."
            )

    return {
        "authoritative_state": authoritative_state,
        "confidence_hint": confidence_hint,
        "requires_ai_investigation": requires_ai,
        "reason": reason,
    }
