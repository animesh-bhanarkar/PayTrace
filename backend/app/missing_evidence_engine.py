from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict
from app.models import NormalizedEvent, PaymentState
from app.incident_detector import IncidentReport
from app.claim_verifier import VerifiedClaim


@dataclass
class MissingEvidenceReport:
    has_missing_evidence: bool
    reason: str
    missing_evidence: List[str] = field(default_factory=list)
    recommended_next_evidence: List[str] = field(default_factory=list)
    lifecycle_completeness: float = 1.0


def evaluate_missing_evidence(
    payment_id: str,
    events: List[NormalizedEvent],
    reconstructed_state: Optional[PaymentState],
    incidents: List[IncidentReport],
    verified_claims: Optional[List[VerifiedClaim]] = None
) -> MissingEvidenceReport:
    """
    Deterministically evaluates payment evidence completeness, state transition gaps,
    and unverified claims to identify missing events without AI speculation.
    """
    missing_items: List[str] = []
    recommendations: List[str] = []

    event_types = [e.event_type for e in events] if events else []
    
    # 1. Missing initial created event
    has_created = "payment.created" in event_types or "order.paid" in event_types
    has_authorized = "payment.authorized" in event_types
    has_captured = "payment.captured" in event_types
    has_failed = "payment.failed" in event_types

    if has_authorized and not has_created:
        missing_items.append("payment.created webhook delivery record")
        recommendations.append("Inspect merchant ingress logs for dropped or timed-out payment.created webhooks")

    # 2. Terminal state without terminal event
    current_state = reconstructed_state.current_state if reconstructed_state else "unknown"
    if current_state == "authorized" and not (has_captured or has_failed):
        missing_items.append("payment.captured or payment.failed terminal confirmation")
        recommendations.append("Query Razorpay Payments API (GET /v1/payments/{id}) to check if payment auto-captured or timed out")

    # 3. Missing ingestion timestamp check
    events_missing_ingestion = [
        e.event_id for e in events if getattr(e, "ingestion_timestamp", None) is None
    ]
    if events_missing_ingestion:
        missing_items.append(f"Ingestion timestamps for {len(events_missing_ingestion)} event(s)")
        recommendations.append("Verify system clock synchronization and webhook receiver audit persistence")

    # 4. Incomplete state history or anomalies
    if reconstructed_state and reconstructed_state.state_history:
        for entry in reconstructed_state.state_history:
            anomaly = entry.get("anomaly")
            if anomaly and "Invalid transition" in anomaly:
                if "payment.created webhook delivery record" not in missing_items:
                    missing_items.append("Missing prerequisite state transition event")
                    recommendations.append("Check payment gateway dashboard event delivery logs for missing sequence events")

    # 5. Unsupported or unverifiable claim citations
    if verified_claims:
        unverifiable = [c for c in verified_claims if c.verdict in ["REJECTED", "UNVERIFIABLE"]]
        if unverifiable:
            for c in unverifiable:
                missing_items.append(f"Verification proof for claim [{c.claim_id}]: {c.rejection_reason or 'Unsupported citations'}")
            recommendations.append("Gather merchant backend logs to substantiate unverified AI claims")

    # Calculate deterministic completeness score
    expected_stages = 3  # created, authorized, captured/failed
    actual_stages = sum([1 for flag in [has_created, has_authorized, (has_captured or has_failed)] if flag])
    lifecycle_completeness = round(max(0.0, min(1.0, actual_stages / expected_stages)), 2)

    has_missing = len(missing_items) > 0

    if has_missing:
        reason = f"Identified {len(missing_items)} missing evidence item(s) across lifecycle sequence."
    else:
        reason = "All expected payment lifecycle events and state evidence are present and verified."

    return MissingEvidenceReport(
        has_missing_evidence=has_missing,
        reason=reason,
        missing_evidence=missing_items,
        recommended_next_evidence=recommendations,
        lifecycle_completeness=lifecycle_completeness
    )
