import uuid
import datetime
from typing import List, Dict, Any, Optional
from app.models import NormalizedEvent, PaymentState
from app.incident_detector import IncidentReport

def build_evidence_package(
    payment_id: str,
    existing_events: List[NormalizedEvent],
    reconstructed_state: PaymentState,
    incidents: List[IncidentReport]
) -> Dict[str, Any]:
    
    missing_evidence_hint: Optional[str] = None
    if not reconstructed_state.state_history:
        missing_evidence_hint = "No state history available. Possible missing initial events."
    else:
        first_entry = reconstructed_state.state_history[0]
        anomaly = first_entry.get("anomaly")
        if anomaly and "Invalid transition" in anomaly:
            missing_evidence_hint = "State history begins with an invalid transition. Likely missing prior events like payment.created."

    # Serialize events
    events_serialized = []
    for event in existing_events:
        events_serialized.append({
            "evidence_id": event.event_id,
            "event_type": event.event_type,
            "payment_id": event.payment_id,
            "order_id": event.order_id,
            "event_timestamp": event.event_timestamp.isoformat() if event.event_timestamp else "",
            "source": event.source,
            "status": event.status,
            "signature_valid": event.signature_valid
        })

    # Serialize incidents
    incidents_serialized = []
    for inc in incidents:
        incidents_serialized.append({
            "incident_type": inc.incident_type,
            "severity": inc.severity,
            "description": inc.description,
            "evidence_ids": inc.evidence_ids
        })

    return {
        "payment_id": payment_id,
        "evidence_id": str(uuid.uuid4()),
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "events": events_serialized,
        "reconstructed_state": {
            "payment_id": reconstructed_state.payment_id,
            "current_state": reconstructed_state.current_state,
            "state_history": reconstructed_state.state_history if reconstructed_state.state_history else []
        },
        "incidents": incidents_serialized,
        "missing_evidence_hint": missing_evidence_hint
    }
