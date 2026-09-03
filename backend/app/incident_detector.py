from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import datetime
from app.models import NormalizedEvent

DUPLICATE_WEBHOOK = "duplicate_webhook"
DELAYED_WEBHOOK = "delayed_webhook"
OUT_OF_ORDER = "out_of_order"
INVALID_TRANSITION = "invalid_transition"
SIGNATURE_VERIFICATION_FAILURE = "signature_verification_failure"
MISSING_EVIDENCE = "missing_evidence"
AMBIGUOUS_STATE = "ambiguous_state"

@dataclass
class IncidentReport:
    incident_type: str
    payment_id: Optional[str]
    order_id: Optional[str]
    description: str
    severity: str
    evidence_ids: List[str]

def detect_incidents(
    new_event: NormalizedEvent,
    existing_events: List[NormalizedEvent],
    state_history: List[Dict[str, Any]],
    signature_valid: bool
) -> List[IncidentReport]:
    incidents = []
    
    # SIGNATURE_VERIFICATION_FAILURE
    if not signature_valid:
        incidents.append(IncidentReport(
            incident_type=SIGNATURE_VERIFICATION_FAILURE,
            payment_id=new_event.payment_id,
            order_id=new_event.order_id,
            description="Webhook signature verification failed",
            severity="HIGH",
            evidence_ids=[new_event.event_id] if new_event.event_id else []
        ))
        
    # DUPLICATE_WEBHOOK
    if any(e.payload_hash == new_event.payload_hash for e in existing_events):
        incidents.append(IncidentReport(
            incident_type=DUPLICATE_WEBHOOK,
            payment_id=new_event.payment_id,
            order_id=new_event.order_id,
            description="Duplicate webhook payload hash detected",
            severity="HIGH",
            evidence_ids=[new_event.event_id] if new_event.event_id else []
        ))
        
    # DELAYED_WEBHOOK
    if new_event.event_timestamp and new_event.ingestion_timestamp:
        delay = new_event.ingestion_timestamp - new_event.event_timestamp
        if delay > datetime.timedelta(minutes=5):
            incidents.append(IncidentReport(
                incident_type=DELAYED_WEBHOOK,
                payment_id=new_event.payment_id,
                order_id=new_event.order_id,
                description=f"Webhook ingestion delayed by {delay.total_seconds()} seconds",
                severity="MEDIUM",
                evidence_ids=[new_event.event_id] if new_event.event_id else []
            ))
            
    # OUT_OF_ORDER
    if existing_events and new_event.event_timestamp:
        max_existing_time = max((e.event_timestamp for e in existing_events if e.event_timestamp), default=None)
        if max_existing_time and new_event.event_timestamp < max_existing_time:
            incidents.append(IncidentReport(
                incident_type=OUT_OF_ORDER,
                payment_id=new_event.payment_id,
                order_id=new_event.order_id,
                description="Webhook arrived out of chronological order",
                severity="MEDIUM",
                evidence_ids=[new_event.event_id] if new_event.event_id else []
            ))
            
    # INVALID_TRANSITION and AMBIGUOUS_STATE
    invalid_transitions_count = 0
    invalid_transition_evidence = []
    
    for entry in state_history:
        anomaly = entry.get("anomaly")
        if anomaly and "Invalid transition" in anomaly:
            invalid_transitions_count += 1
            if entry.get("event_id"):
                invalid_transition_evidence.append(entry["event_id"])
                
    if invalid_transitions_count > 0:
        incidents.append(IncidentReport(
            incident_type=INVALID_TRANSITION,
            payment_id=new_event.payment_id,
            order_id=new_event.order_id,
            description="Invalid state transition detected",
            severity="HIGH",
            evidence_ids=invalid_transition_evidence
        ))
        
        if invalid_transitions_count > 1:
            incidents.append(IncidentReport(
                incident_type=AMBIGUOUS_STATE,
                payment_id=new_event.payment_id,
                order_id=new_event.order_id,
                description="Multiple invalid transitions resulted in an ambiguous payment state",
                severity="HIGH",
                evidence_ids=invalid_transition_evidence
            ))
            
    # MISSING_EVIDENCE
    if not existing_events and not state_history:
        incidents.append(IncidentReport(
            incident_type=MISSING_EVIDENCE,
            payment_id=new_event.payment_id,
            order_id=new_event.order_id,
            description="Initial event with no prior history or existing events",
            severity="LOW",
            evidence_ids=[new_event.event_id] if new_event.event_id else []
        ))
        
    return incidents
