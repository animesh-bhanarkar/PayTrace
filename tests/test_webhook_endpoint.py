"""Integration tests for the webhook endpoint using FastAPI TestClient (in-process)."""
import hashlib
import hmac
import json
import os
import sys
import time
import uuid

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)
SECRET = settings.RAZORPAY_WEBHOOK_SECRET


def compute_sig(body_bytes):
    return hmac.new(SECRET.encode('utf-8'), body_bytes, hashlib.sha256).hexdigest()


def make_body(event_type, event_id=None):
    payload = {
        'entity': 'event',
        'event': event_type,
        'payload': {
            'payment': {
                'entity': {
                    'id': 'pay_test_' + str(int(time.time() * 1000)) + '_' + uuid.uuid4().hex[:6],
                    'amount': 100000
                }
            }
        },
        'created_at': int(time.time())
    }
    if event_id:
        payload['id'] = event_id
    return json.dumps(payload, separators=(',', ':')).encode('utf-8')


_shared = {}


def test_valid_signature():
    """Test 1: Valid signature -> 200 and persisted as verified event."""
    global _shared
    ev1_id = 'it_valid_' + str(int(time.time() * 1000)) + '_' + uuid.uuid4().hex[:6]
    body1 = make_body('payment.authorized', event_id=ev1_id)
    _shared['body1'] = body1
    _shared['ev1_id'] = ev1_id

    r1 = client.post(
        '/webhooks/razorpay',
        content=body1,
        headers={
            'Content-Type': 'application/json',
            'X-Razorpay-Signature': compute_sig(body1),
            'x-razorpay-event-id': ev1_id,
        },
    )
    assert r1.status_code == 200, 'Expected 200, got ' + str(r1.status_code) + ': ' + r1.text

    ev_data = client.get('/webhooks/events?verified_only=true&limit=5').json()
    stored = [e for e in ev_data['events'] if e['razorpay_event_id'] == ev1_id]
    assert len(stored) == 1, 'Expected 1 stored verified event, found ' + str(len(stored))
    assert stored[0]['signature_valid'] is True


def test_tampered_signature():
    """Test 2: Tampered signature -> 403 with audit-only record."""
    ev2_id = 'it_tampered_' + str(int(time.time() * 1000)) + '_' + uuid.uuid4().hex[:6]
    body2 = make_body('payment.failed', event_id=ev2_id)
    tampered = '0' * 64
    r2 = client.post(
        '/webhooks/razorpay',
        content=body2,
        headers={
            'Content-Type': 'application/json',
            'X-Razorpay-Signature': tampered,
            'x-razorpay-event-id': ev2_id,
        },
    )
    assert r2.status_code == 403, 'Expected 403, got ' + str(r2.status_code) + ': ' + r2.text

    ev_data2 = client.get('/webhooks/events?limit=10').json()
    stored2 = [e for e in ev_data2['events'] if e['razorpay_event_id'] == ev2_id]
    assert len(stored2) == 1, 'Expected 1 audit record, found ' + str(len(stored2))
    assert stored2[0]['signature_valid'] is False, 'signature_valid must be False for tampered event'


def test_idempotency_on_replay():
    """Test 3: Idempotency on replay of same event_id."""
    body1 = _shared.get('body1')
    ev1_id = _shared.get('ev1_id')
    if not body1 or not ev1_id:
        ev1_id = 'it_valid_' + str(int(time.time() * 1000)) + '_' + uuid.uuid4().hex[:6]
        body1 = make_body('payment.authorized', event_id=ev1_id)
        r_init = client.post(
            '/webhooks/razorpay',
            content=body1,
            headers={
                'Content-Type': 'application/json',
                'X-Razorpay-Signature': compute_sig(body1),
                'x-razorpay-event-id': ev1_id,
            },
        )
        assert r_init.status_code == 200

    r3 = client.post(
        '/webhooks/razorpay',
        content=body1,
        headers={
            'Content-Type': 'application/json',
            'X-Razorpay-Signature': compute_sig(body1),
            'x-razorpay-event-id': ev1_id,
        },
    )
    assert r3.status_code == 200
    ev_data3 = client.get('/webhooks/events?verified_only=true&limit=20').json()
    dups = [e for e in ev_data3['events'] if e['razorpay_event_id'] == ev1_id]
    assert len(dups) == 1, 'Expected 1 record (no duplicate), found ' + str(len(dups))
