from typing import List, Tuple
from app.models import NormalizedEvent
from app.incident_detector import IncidentReport, DUPLICATE_WEBHOOK

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
