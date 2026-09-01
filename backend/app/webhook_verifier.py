"""
Razorpay webhook signature verification.

Algorithm (from Razorpay documentation):
  expected_signature = HMAC-SHA256(raw_body, webhook_secret)
  valid = constant_time_compare(expected_signature, received_signature)

Verification MUST be performed on the raw request body, before any parsing.
Invalid signatures must never produce trusted payment evidence.
"""

import hashlib
import hmac
import logging

logger = logging.getLogger("paytrace.webhook_verifier")


class SignatureVerificationError(Exception):
    """Raised when a Razorpay webhook signature is invalid or secret is missing."""
    pass


def verify_razorpay_signature(
    raw_body: bytes,
    received_signature: str,
    webhook_secret: str,
) -> bool:
    """
    Verify a Razorpay webhook signature using HMAC-SHA256.

    Args:
        raw_body: The exact raw request body bytes as received from Razorpay.
                  Must NOT be re-serialized or re-parsed.
        received_signature: The value of the X-Razorpay-Signature header.
        webhook_secret: The RAZORPAY_WEBHOOK_SECRET from environment config.

    Returns:
        True if the signature is valid.

    Raises:
        SignatureVerificationError: If webhook_secret is not configured.

    Security notes:
    - Uses hmac.compare_digest for constant-time comparison (timing-safe).
    - A False return means the payload is untrusted and must not enter
      downstream reasoning, normalization, or persistence as trusted evidence.
    """
    if not webhook_secret:
        raise SignatureVerificationError(
            "RAZORPAY_WEBHOOK_SECRET is not configured. "
            "Cannot verify webhook signature."
        )

    if not received_signature:
        logger.warning("Webhook received with no X-Razorpay-Signature header.")
        return False

    expected = hmac.new(
        webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    is_valid = hmac.compare_digest(expected, received_signature)
    if not is_valid:
        logger.warning(
            "Webhook signature mismatch. "
            "Expected=%s... Received=%s...",
            expected[:12],
            received_signature[:12],
        )
    return is_valid
