import hmac
import hashlib
import json
import os
import urllib.request
import urllib.error
from dotenv import load_dotenv

load_dotenv()

webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
if not webhook_secret:
    print("RAZORPAY_WEBHOOK_SECRET not found in environment!")
    exit(1)

endpoint_url = "https://paytrace-backend-ys0y.onrender.com/webhooks/razorpay"

payload_dict = {
    "entity": "event",
    "account_id": "acc_BFQ7uQEwa7jFkU",
    "event": "payment.authorized",
    "contains": ["payment"],
    "payload": {
        "payment": {
            "entity": {
                "id": "pay_test_1234567890",
                "entity": "payment",
                "amount": 1000,
                "currency": "INR",
                "status": "authorized"
            }
        }
    },
    "created_at": 1693630000
}
# Serialize with separators to ensure exact byte match on the other side
raw_payload = json.dumps(payload_dict, separators=(',', ':')).encode('utf-8')

# 1. Valid Signature Test
valid_signature = hmac.new(
    webhook_secret.encode('utf-8'),
    raw_payload,
    hashlib.sha256
).hexdigest()

print(f"--- TEST 1: VALID SIGNATURE ---")
print(f"URL: {endpoint_url}")
print(f"Signature: {valid_signature}")
headers = {
    "Content-Type": "application/json",
    "X-Razorpay-Signature": valid_signature,
    "x-razorpay-event-id": "evnt_test_valid_001"
}

req1 = urllib.request.Request(endpoint_url, data=raw_payload, headers=headers, method="POST")
try:
    with urllib.request.urlopen(req1) as response:
        print(f"Status Code: {response.getcode()}")
        print(f"Response Body: {response.read().decode('utf-8')}")
except urllib.error.HTTPError as e:
    print(f"Status Code: {e.code}")
    print(f"Response Body: {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")

# 2. Invalid Signature Test
invalid_signature = "this_is_an_invalid_signature_1234567890abcdef"

print(f"\n--- TEST 2: INVALID SIGNATURE ---")
headers["X-Razorpay-Signature"] = invalid_signature
headers["x-razorpay-event-id"] = "evnt_test_invalid_002"

req2 = urllib.request.Request(endpoint_url, data=raw_payload, headers=headers, method="POST")
try:
    with urllib.request.urlopen(req2) as response:
        print(f"Status Code: {response.getcode()}")
        print(f"Response Body: {response.read().decode('utf-8')}")
except urllib.error.HTTPError as e:
    print(f"Status Code: {e.code}")
    print(f"Response Body: {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")
