from typing import Tuple, Optional

class PaymentStateMachine:
    # Valid transitions: event_type -> allowed from_states -> new_state
    TRANSITIONS = {
        "payment.created": {"allowed_from": [None], "to_state": "created"},
        "payment.authorized": {"allowed_from": ["created"], "to_state": "authorized"},
        "payment.captured": {"allowed_from": ["authorized"], "to_state": "captured"},
        "payment.failed": {"allowed_from": ["created", "authorized"], "to_state": "failed"},
        "payment.refunded": {"allowed_from": ["captured"], "to_state": "refunded"},
        "payment.partially_refunded": {"allowed_from": ["captured"], "to_state": "partially_refunded"},
        "order.paid": {"allowed_from": ["authorized", "captured"], "to_state": "captured"}
    }

    @classmethod
    def apply_event(cls, current_state: Optional[str], event_type: str) -> Tuple[str, bool, Optional[str]]:
        if event_type not in cls.TRANSITIONS:
            return current_state or "unknown", False, f"Unknown event_type: {event_type}"
        
        transition = cls.TRANSITIONS[event_type]
        allowed_from = transition["allowed_from"]
        expected_to_state = transition["to_state"]
        
        if current_state == expected_to_state:
            return current_state, True, "Duplicate event detected"
            
        if current_state not in allowed_from:
            return current_state or "unknown", False, f"Invalid transition: {current_state} -> {event_type}"
            
        return expected_to_state, True, None
