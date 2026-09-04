"""
PayTrace Phase 9: Live Monitoring Engine Tests.

Verifies:
1. Event publication & monotonic sequence IDs
2. Replay / cursor behavior (Last-Event-ID header and cursor query param)
3. Bounded in-memory buffer (maintains max capacity, drops oldest)
4. Sensitive metadata sanitization (PAN, CVV, passwords, api_keys, secrets)
5. Polling fallback (/live/recent)
6. Live status diagnostics (/live/status, LIVE != AUTONOMOUS invariant)
7. Webhook integration (trusted -> webhook.received, untrusted -> webhook.untrusted)
8. Incident creation event (incident.created)
9. Incident operational update event (incident.updated)
10. Investigation completed event (investigation.completed)
11. Concurrent subscribers isolation
"""

import asyncio
import json
import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient

from app.main import app
from app.live_monitoring import (
    LiveEventStream,
    live_event_stream,
    sanitize_live_metadata,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_live_stream():
    """Reset the global live stream before each test for clean isolation."""
    live_event_stream.clear()
    yield
    live_event_stream.clear()


def test_sanitize_live_metadata_masks_credentials_and_cards():
    """Verify sensitive fields and PANs are strictly redacted from live broadcasts."""
    sensitive_data = {
        "payment_id": "pay_test123",
        "api_key": "sec_live_999999",
        "webhook_secret": "my_secret_token",
        "customer_password": "supersecretpassword",
        "card_info": {
            "pan": "4111111111111111",
            "cvv": "123",
            "brand": "Visa",
        },
        "notes": "Customer called about card 4242 4242 4242 4242 payment issue",
        "safe_amount": 5000,
    }

    sanitized = sanitize_live_metadata(sensitive_data)

    assert sanitized["payment_id"] == "pay_test123"
    assert sanitized["api_key"] == "[REDACTED]"
    assert sanitized["webhook_secret"] == "[REDACTED]"
    assert sanitized["customer_password"] == "[REDACTED]"
    assert sanitized["card_info"]["pan"] == "[REDACTED]"
    assert sanitized["card_info"]["cvv"] == "[REDACTED]"
    assert sanitized["card_info"]["brand"] == "Visa"
    assert sanitized["safe_amount"] == 5000
    assert "[REDACTED_PAN]" in sanitized["notes"]


def test_live_stream_monotonic_cursors():
    """Verify published events receive strictly monotonic integer IDs."""
    stream = LiveEventStream(max_buffer_size=10)
    ev1 = stream.publish_event("incident.created", {"incident_id": "inc_1"})
    ev2 = stream.publish_event("incident.updated", {"incident_id": "inc_1", "status": "INVESTIGATING"})
    ev3 = stream.publish_event("webhook.received", {"payment_id": "pay_1"})

    assert ev1.id == 1
    assert ev2.id == 2
    assert ev3.id == 3
    assert stream.current_cursor == 3


def test_live_stream_bounded_buffer():
    """Verify in-memory buffer enforces maximum capacity without memory leaks."""
    stream = LiveEventStream(max_buffer_size=5)
    for i in range(10):
        stream.publish_event("incident.updated", {"seq": i})

    assert stream.current_cursor == 10
    recent = stream.get_recent(limit=10)
    assert len(recent) == 5  # capped at max_buffer_size
    assert recent[0]["data"]["seq"] == 5
    assert recent[-1]["data"]["seq"] == 9


def test_polling_fallback_endpoint():
    """Verify /live/recent returns recent events with cursor-based pagination."""
    live_event_stream.publish_event("incident.created", {"incident_id": "inc_A"})
    live_event_stream.publish_event("incident.updated", {"incident_id": "inc_A", "status": "INVESTIGATING"})
    live_event_stream.publish_event("investigation.completed", {"payment_id": "pay_A"})

    # 1. Fetch all recent
    resp = client.get("/live/recent?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 3
    assert data["current_cursor"] == 3
    assert data["events"][0]["event_type"] == "incident.created"
    assert data["events"][2]["event_type"] == "investigation.completed"

    # 2. Fetch with cursor (events strictly after cursor 1)
    resp_cursor = client.get("/live/recent?cursor=1")
    assert resp_cursor.status_code == 200
    data_cursor = resp_cursor.json()
    assert data_cursor["count"] == 2
    assert data_cursor["events"][0]["id"] == 2
    assert data_cursor["events"][1]["id"] == 3


def test_live_status_endpoint():
    """Verify /live/status declares the LIVE != AUTONOMOUS invariant and diagnostic metrics."""
    live_event_stream.publish_event("webhook.received", {"payment_id": "pay_999"})

    resp = client.get("/live/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "active"
    assert data["process_local"] is True
    assert data["durable"] is False
    assert data["total_events_published"] == 1
    assert data["buffer_capacity"] == 1000
    assert "LIVE != AUTONOMOUS" in data["safety_invariant"]
    assert "webhook.received" in data["supported_events"]
    assert "incident.created" in data["supported_events"]


def test_live_stream_reconnection_replay():
    """Verify that subscribing with last_event_id replays missed events from the buffer."""
    async def _run():
        stream = LiveEventStream(max_buffer_size=50)
        stream.publish_event("webhook.received", {"idx": 1})
        stream.publish_event("incident.created", {"idx": 2})
        stream.publish_event("investigation.completed", {"idx": 3})

        # Simulate subscriber reconnecting with last_event_id=1
        gen = stream.subscribe(last_event_id=1, ping_interval=1.0)
        replayed = []
        # Read first 2 replayed items
        for _ in range(2):
            chunk = await anext(gen)
            replayed.append(chunk)

        assert len(replayed) == 2
        assert "id: 2" in replayed[0]
        assert "incident.created" in replayed[0]
        assert "id: 3" in replayed[1]
        assert "investigation.completed" in replayed[1]

    asyncio.run(_run())


def test_live_stream_concurrent_subscribers():
    """Verify that multiple concurrent subscribers each receive broadcast events."""
    async def _run():
        stream = LiveEventStream(max_buffer_size=50)

        sub1 = stream.subscribe(last_event_id=None, ping_interval=2.0)
        sub2 = stream.subscribe(last_event_id=None, ping_interval=2.0)

        # Prime subscribers
        task1 = asyncio.create_task(anext(sub1))
        task2 = asyncio.create_task(anext(sub2))

        # Give tasks a moment to register subscriber queues
        await asyncio.sleep(0.01)

        # Publish an event
        stream.publish_event("incident.created", {"incident_id": "inc_conc"})

        res1 = await asyncio.wait_for(task1, timeout=1.0)
        res2 = await asyncio.wait_for(task2, timeout=1.0)

        assert "incident.created" in res1
        assert "inc_conc" in res1
        assert "incident.created" in res2
        assert "inc_conc" in res2

    asyncio.run(_run())


def test_webhook_integration_broadcasts_trusted_event():
    """Verify trusted webhook delivery automatically publishes webhook.received."""
    import hashlib
    import hmac
    from app.config import settings

    payload = {
        "event": "payment.captured",
        "created_at": 1700000000,
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_live_test_001",
                    "amount": 250000,
                    "currency": "INR",
                    "status": "captured",
                    "order_id": "order_live_001",
                }
            }
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")
    secret = settings.RAZORPAY_WEBHOOK_SECRET or "test_secret"
    sig = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

    resp = client.post(
        "/webhooks/razorpay",
        content=raw_body,
        headers={
            "X-Razorpay-Signature": sig,
            "x-razorpay-event-id": "evt_live_001",
            "Content-Type": "application/json",
        },
    )
    assert resp.status_code == 200

    recent = live_event_stream.get_recent(limit=10)
    event_types = [e["event_type"] for e in recent]
    assert "webhook.received" in event_types

    rec_event = next(e for e in recent if e["event_type"] == "webhook.received")
    assert rec_event["data"]["payment_id"] == "pay_live_test_001"
    assert rec_event["data"]["trust_status"] == "TRUSTED"


def test_webhook_integration_broadcasts_untrusted_event():
    """Verify signature-failed webhook publishes webhook.untrusted and does not enter trusted state."""
    payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_untrusted_999",
                    "status": "failed",
                }
            }
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")

    resp = client.post(
        "/webhooks/razorpay",
        content=raw_body,
        headers={
            "X-Razorpay-Signature": "invalid_signature_hex",
            "x-razorpay-event-id": "evt_untrusted_001",
            "Content-Type": "application/json",
        },
    )
    assert resp.status_code == 403

    recent = live_event_stream.get_recent(limit=10)
    event_types = [e["event_type"] for e in recent]
    assert "webhook.untrusted" in event_types

    untrusted_event = next(e for e in recent if e["event_type"] == "webhook.untrusted")
    assert untrusted_event["data"]["trust_status"] == "UNTRUSTED"
    assert "untrusted" in untrusted_event["data"]["processing_notes"].lower()


def test_incident_workflow_update_broadcasts_event():
    """Verify updating an incident operational status publishes incident.updated."""
    # Create an incident directly in DB
    from app.database import SessionLocal
    from app.models import Incident
    import uuid

    db = SessionLocal()
    inc_id = uuid.uuid4()
    inc = Incident(
        id=inc_id,
        incident_type="DISCREPANCY",
        payment_id="pay_wf_001",
        order_id="order_wf_001",
        severity="HIGH",
        description="State mismatch detected",
        operational_status="OPEN",
        priority="HIGH",
    )
    db.add(inc)
    db.commit()
    db.close()

    # Update status via API
    resp = client.patch(
        f"/incidents/{inc_id}/status",
        json={"status": "INVESTIGATING", "actor": "Security Team", "notes": "Investigating live"},
    )
    assert resp.status_code == 200

    recent = live_event_stream.get_recent(limit=5)
    update_event = next((e for e in recent if e["event_type"] == "incident.updated"), None)
    assert update_event is not None
    assert update_event["data"]["field"] == "operational_status"
    assert update_event["data"]["new_value"] == "INVESTIGATING"
    assert update_event["data"]["actor"] == "Security Team"
