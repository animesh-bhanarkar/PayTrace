from typing import List
from app.models import NormalizedEvent, PaymentState
from app.state_machine import PaymentStateMachine
import datetime

def reconstruct_payment_state(events: List[NormalizedEvent]) -> PaymentState:
    if not events:
        raise ValueError("Cannot reconstruct state from empty event list")
        
    # Sort events by timestamp ascending
    sorted_events = sorted(events, key=lambda e: e.event_timestamp if e.event_timestamp else datetime.datetime.min.replace(tzinfo=datetime.timezone.utc))
    
    payment_id = next((e.payment_id for e in sorted_events if e.payment_id), "unknown")
    order_id = next((e.order_id for e in sorted_events if e.order_id), None)
    current_state = None
    state_history = []
    
    for event in sorted_events:
        new_state, is_valid, anomaly = PaymentStateMachine.apply_event(current_state, event.event_type)
        
        history_entry = {
            "event_id": event.event_id,
            "event_type": event.event_type,
            "from_state": current_state,
            "to_state": new_state if is_valid else current_state, 
            "timestamp": event.event_timestamp.isoformat() if event.event_timestamp else None,
            "anomaly": anomaly
        }
        state_history.append(history_entry)
        
        if is_valid:
            current_state = new_state
             
    return PaymentState(
        payment_id=payment_id,
        order_id=order_id,
        current_state=current_state or "unknown",
        state_history=state_history
    )
