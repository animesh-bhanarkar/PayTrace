"""Integration tests for the webhook endpoint - ASCII safe output."""
import sys, os, hmac, hashlib, json, time
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
import httpx
from app.config import settings

BASE_URL = 'http://localhost:8000'
SECRET = settings.RAZORPAY_WEBHOOK_SECRET

def compute_sig(body_bytes):
    return hmac.new(SECRET.encode('utf-8'), body_bytes, hashlib.sha256).hexdigest()

def make_body(event_type):
    return json.dumps({
        'entity': 'event',
        'event': event_type,
        'payload': {
            'payment': {
                'entity': {
                    'id': 'pay_test_' + str(int(time.time())),
                    'amount': 100000
                }
            }
        },
        'created_at': int(time.time())
    }, separators=(',', ':')).encode('utf-8')


# ---- TEST 1: valid signature ----
print('[1] Valid signature test...')
body1 = make_body('payment.authorized')
ev1_id = 'it_valid_' + str(int(time.time()))
r1 = httpx.post(BASE_URL + '/webhooks/razorpay', content=body1, headers={
    'Content-Type': 'application/json',
    'X-Razorpay-Signature': compute_sig(body1),
    'x-razorpay-event-id': ev1_id,
}, timeout=20)
print('  Status:', r1.status_code)
assert r1.status_code == 200, 'Expected 200, got ' + str(r1.status_code) + ': ' + r1.text

ev_data = httpx.get(BASE_URL + '/webhooks/events?verified_only=true&limit=5', timeout=15).json()
stored = [e for e in ev_data['events'] if e['razorpay_event_id'] == ev1_id]
assert len(stored) == 1, 'Expected 1 stored verified event, found ' + str(len(stored))
assert stored[0]['signature_valid'] is True
rec = stored[0]
print('  Stored record id=' + str(rec['id']) + ' signature_valid=' + str(rec['signature_valid']))
print('  event_type=' + str(rec['event_type']))
print('  notes: ' + str(rec['processing_notes']))
print('  RESULT: TEST 1 PASS')


# ---- TEST 2: tampered signature ----
print()
print('[2] Tampered signature test...')
time.sleep(1)  # ensure unique timestamp in entity id
body2 = make_body('payment.failed')
ev2_id = 'it_tampered_' + str(int(time.time()))
tampered = '0' * 64
r2 = httpx.post(BASE_URL + '/webhooks/razorpay', content=body2, headers={
    'Content-Type': 'application/json',
    'X-Razorpay-Signature': tampered,
    'x-razorpay-event-id': ev2_id,
}, timeout=20)
print('  Status:', r2.status_code)
assert r2.status_code == 403, 'Expected 403, got ' + str(r2.status_code) + ': ' + r2.text

ev_data2 = httpx.get(BASE_URL + '/webhooks/events?limit=10', timeout=15).json()
stored2 = [e for e in ev_data2['events'] if e['razorpay_event_id'] == ev2_id]
assert len(stored2) == 1, 'Expected 1 audit record, found ' + str(len(stored2))
assert stored2[0]['signature_valid'] is False, 'signature_valid must be False for tampered event'
rec2 = stored2[0]
print('  Audit record id=' + str(rec2['id']) + ' signature_valid=' + str(rec2['signature_valid']))
print('  notes: ' + str(rec2['processing_notes'])[:80])
print('  RESULT: TEST 2 PASS')


# ---- TEST 3: idempotency ----
print()
print('[3] Idempotency test (replay same event_id)...')
r3 = httpx.post(BASE_URL + '/webhooks/razorpay', content=body1, headers={
    'Content-Type': 'application/json',
    'X-Razorpay-Signature': compute_sig(body1),
    'x-razorpay-event-id': ev1_id,
}, timeout=20)
print('  Replay status:', r3.status_code)
assert r3.status_code == 200
ev_data3 = httpx.get(BASE_URL + '/webhooks/events?verified_only=true&limit=20', timeout=15).json()
dups = [e for e in ev_data3['events'] if e['razorpay_event_id'] == ev1_id]
assert len(dups) == 1, 'Expected 1 record (no duplicate), found ' + str(len(dups))
print('  Duplicate record count: ' + str(len(dups)) + ' (correct - no duplicate)')
print('  RESULT: TEST 3 PASS')

print()
print('ALL TESTS PASSED')
