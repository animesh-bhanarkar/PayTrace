"""Unit-test the signature verifier with the real webhook secret from .env"""
import sys, os, hmac, hashlib

sys.path.insert(0, 'backend')
from app.config import settings
from app.webhook_verifier import verify_razorpay_signature

secret = settings.RAZORPAY_WEBHOOK_SECRET
print("WEBHOOK_SECRET present:", bool(secret), "len:", len(secret))

# Simulate the exact HMAC Razorpay would compute
test_body = b'{"event":"payment.authorized","payload":{}}'
expected_sig = hmac.new(
    secret.encode("utf-8"),
    test_body,
    hashlib.sha256,
).hexdigest()

print("HMAC computed sig (first 20):", expected_sig[:20])

# Test 1: correct signature
ok = verify_razorpay_signature(test_body, expected_sig, secret)
assert ok is True, f"FAIL: Expected True, got {ok}"
print("TEST 1 (valid sig): PASS")

# Test 2: tampered signature
bad_sig = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
bad = verify_razorpay_signature(test_body, bad_sig, secret)
assert bad is False, f"FAIL: Expected False, got {bad}"
print("TEST 2 (invalid sig): PASS")

# Test 3: empty signature
empty = verify_razorpay_signature(test_body, "", secret)
assert empty is False, f"FAIL: Expected False, got {empty}"
print("TEST 3 (empty sig): PASS")

# Test 4: tampered body (bit flip)
tampered_body = b'{"event":"payment.authorized","payload":{"tampered":true}}'
wrong = verify_razorpay_signature(tampered_body, expected_sig, secret)
assert wrong is False, f"FAIL: Expected False for tampered body, got {wrong}"
print("TEST 4 (tampered body): PASS")

print()
print("All signature verifier unit tests PASSED.")
