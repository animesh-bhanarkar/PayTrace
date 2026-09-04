"""
Deterministic AI Activation Gate — PayTrace.

Rules determine whether the LLM should be invoked.
The LLM never decides whether it should be called.

Phase 8 adds should_activate_advanced_ai() for the richer advanced
investigation path while preserving the original should_activate_ai()
for all Phase 1-7 code paths.
"""

from typing import List, Tuple
from app.models import NormalizedEvent
from app.incident_detector import IncidentReport, DUPLICATE_WEBHOOK


# ── Phase 1-7 gate (preserved exactly) ───────────────────────────────────────

def should_activate_ai(
    authoritative_result: dict,
    incidents: List[IncidentReport],
    existing_events: List[NormalizedEvent]
) -> Tuple[bool, str]:
    """
    Deterministic gate to decide if the LLM investigator should be called.
    First match wins.
    """

    if authoritative_result.get("requires_ai_investigation") is True:
        incident_types = sorted(list(set([i.incident_type for i in incidents])))
        types_str = ", ".join(incident_types)
        return True, f"High-severity incident requires AI investigation: {types_str}"

    if len(existing_events) == 0:
        return False, "No events to investigate"

    if incidents and all(i.severity == "LOW" for i in incidents):
        return False, "All incidents low severity, deterministic diagnosis sufficient"

    if incidents and all(i.incident_type == DUPLICATE_WEBHOOK for i in incidents):
        return False, "Duplicate webhook is deterministic, no AI needed"

    return False, "Deterministic diagnosis sufficient"


# ── Phase 8 advanced gate ─────────────────────────────────────────────────────

def should_activate_advanced_ai(
    authoritative_result: dict,
    incidents: List[IncidentReport],
    existing_events: List[NormalizedEvent],
    webhook_diagnostics: dict | None = None,
) -> Tuple[bool, str]:
    """
    Deterministic gate for the advanced investigation path.

    Rules (first match wins). The LLM never decides whether it is called.

    Returns (activate: bool, reason: str).
    """
    # Rule 1: No events — nothing for AI to investigate
    if not existing_events:
        return False, "No events present — deterministic result only"

    # Rule 2: Pure signature-failure-only — deterministic diagnosis covers this
    incident_types = [i.incident_type for i in incidents]
    all_sig_failure = incidents and all(
        t in ("invalid_signature", "signature_failure", "untrusted_webhook")
        for t in incident_types
    )
    if all_sig_failure:
        return False, "Pure signature failure — deterministic result, no AI needed"

    # Rule 3: Pure duplicate-webhook-only — deterministic covers this
    all_duplicate = incidents and all(t == DUPLICATE_WEBHOOK for t in incident_types)
    if all_duplicate:
        return False, "Pure duplicate webhook — deterministic result, no AI needed"

    # Rule 4: Simple delivery-delay only with LOW severity — deterministic covers this
    all_low = incidents and all(i.severity == "LOW" for i in incidents)
    if all_low:
        return False, "All incidents LOW severity — deterministic result sufficient"

    # Rule 5: Webhook diagnostics anomalies — competing hypotheses or explanations warranted
    if webhook_diagnostics:
        recon_status = webhook_diagnostics.get("reconciliation", {}).get("status")
        if recon_status == "CONFLICTING_OBSERVATIONS":
            return True, "Conflicting webhook/gateway observations — competing hypotheses warranted"

        # Merchant not updated despite captured — AI can explain the gap
        if recon_status == "MERCHANT_NOT_UPDATED":
            return True, "Merchant state not updated despite successful capture — AI investigation warranted"

        # Late authorization detected — AI can provide contextual explanation
        if webhook_diagnostics.get("late_authorization_diagnostics", {}).get("detected"):
            return True, "Late authorization pattern detected — AI investigation warranted"

        # Out-of-order events detected
        if webhook_diagnostics.get("out_of_order_diagnostics", {}).get("detected"):
            return True, "Out-of-order webhook delivery detected — AI investigation warranted"

    # Rule 6: Zero incidents at all — purely normal flow, deterministic
    if not incidents:
        return False, "No incidents detected — deterministic result sufficient"

    # Rule 10: Multiple distinct incident types — competing hypotheses likely useful
    unique_types = set(incident_types)
    if len(unique_types) >= 2:
        types_str = ", ".join(sorted(unique_types))
        return True, f"Multiple distinct incident types require competing hypotheses: {types_str}"

    # Rule 11: Any HIGH severity incident — warrants AI reasoning
    high_incidents = [i for i in incidents if i.severity == "HIGH"]
    if high_incidents:
        types_str = ", ".join(sorted(set(i.incident_type for i in high_incidents)))
        return True, f"HIGH severity incident warrants advanced AI investigation: {types_str}"

    # Rule 12: requires_ai_investigation flag set by authoritative rules
    if authoritative_result.get("requires_ai_investigation") is True:
        return True, "Authoritative rules flagged AI investigation required"

    # Default: deterministic result sufficient
    return False, "Deterministic diagnosis sufficient — no competing hypotheses"
