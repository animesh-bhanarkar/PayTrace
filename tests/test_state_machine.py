import datetime
import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.models import NormalizedEvent
from app.state_machine import PaymentStateMachine
from app.state_reconstructor import reconstruct_payment_state

def test_valid_full_lifecycle():
    current_state = None
    
    new_state, is_valid, anomaly = PaymentStateMachine.apply_event(current_state, "payment.created")
    assert new_state == "created"
    assert is_valid is True
    assert anomaly is None
    
    new_state, is_valid, anomaly = PaymentStateMachine.apply_event(new_state, "payment.authorized")
    assert new_state == "authorized"
    assert is_valid is True
    assert anomaly is None
    
    new_state, is_valid, anomaly = PaymentStateMachine.apply_event(new_state, "payment.captured")
    assert new_state == "captured"
    assert is_valid is True
    assert anomaly is None

def test_invalid_transition():
    new_state, is_valid, anomaly = PaymentStateMachine.apply_event("captured", "payment.authorized")
    assert is_valid is False
    assert anomaly == "Invalid transition: captured -> payment.authorized"

def test_duplicate_event():
    new_state, is_valid, anomaly = PaymentStateMachine.apply_event("captured", "payment.captured")
    assert is_valid is True
    assert anomaly == "Duplicate event detected"

def test_out_of_order_events():
    t1 = datetime.datetime(2026, 9, 3, 10, 0, tzinfo=datetime.timezone.utc)
    t2 = datetime.datetime(2026, 9, 3, 10, 5, tzinfo=datetime.timezone.utc)
    t3 = datetime.datetime(2026, 9, 3, 10, 10, tzinfo=datetime.timezone.utc)
    
    e1 = NormalizedEvent(event_id="1", event_type="payment.created", event_timestamp=t1)
    e2 = NormalizedEvent(event_id="2", event_type="payment.authorized", event_timestamp=t2)
    e3 = NormalizedEvent(event_id="3", event_type="payment.captured", event_timestamp=t3)
    
    # Pass them in out of order
    events = [e3, e1, e2]
    
    ps = reconstruct_payment_state(events)
    assert ps.current_state == "captured"
    assert len(ps.state_history) == 3
    assert ps.state_history[0]["event_type"] == "payment.created"
    assert ps.state_history[1]["event_type"] == "payment.authorized"
    assert ps.state_history[2]["event_type"] == "payment.captured"

def test_reconstruct_payment_state():
    t1 = datetime.datetime(2026, 9, 3, 10, 0, tzinfo=datetime.timezone.utc)
    t2 = datetime.datetime(2026, 9, 3, 10, 5, tzinfo=datetime.timezone.utc)
    t3 = datetime.datetime(2026, 9, 3, 10, 10, tzinfo=datetime.timezone.utc)
    
    e1 = NormalizedEvent(event_id="1", event_type="payment.created", event_timestamp=t1, payment_id="pay_1", order_id="order_1")
    e2 = NormalizedEvent(event_id="2", event_type="payment.authorized", event_timestamp=t2, payment_id="pay_1", order_id="order_1")
    e3 = NormalizedEvent(event_id="3", event_type="payment.captured", event_timestamp=t3, payment_id="pay_1", order_id="order_1")
    
    events = [e1, e2, e3]
    ps = reconstruct_payment_state(events)
    
    assert ps.payment_id == "pay_1"
    assert ps.order_id == "order_1"
    assert ps.current_state == "captured"
    assert len(ps.state_history) == 3
    assert ps.state_history[0]["anomaly"] is None
    assert ps.state_history[1]["anomaly"] is None
    assert ps.state_history[2]["anomaly"] is None
