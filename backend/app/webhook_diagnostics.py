"""
PayTrace Phase 7 — Razorpay & Webhook Diagnostics Engine.

Provides deterministic diagnostics for Razorpay webhooks:
- Signature trust classification (TRUSTED, UNTRUSTED, INVALID)
- Duplicate delivery detection via x-razorpay-event-id
- Delivery delay measurement (event_timestamp vs ingestion_timestamp)
- Out-of-order event delivery detection
- Late authorization pattern detection (payment.failed followed by payment.captured)
- Razorpay error object extraction
- Three-way state reconciliation:
  Razorpay Authoritative State ≠ Webhook Delivery Observation ≠ Merchant State Belief
"""

import copy
import datetime
import hashlib
from typing import Any, Dict, List, Optional, Tuple


SENSITIVE_KEYS = {
    "secret",
    "key_secret",
    "webhook_secret",
    "token",
    "password",
    "auth",
    "authorization",
    "api_key",
    "credentials",
    "card_cvv",
    "cvv",
}


def sanitize_webhook_payload(payload: Any) -> Any:
    """
    Recursively redact any sensitive credentials or secrets from payload before returning to UI.
    Never exposes webhook secrets or raw credentials.
    """
    if isinstance(payload, dict):
        sanitized = {}
        for k, v in payload.items():
            k_lower = str(k).lower()
            if any(sens in k_lower for sens in SENSITIVE_KEYS):
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = sanitize_webhook_payload(v)
        return sanitized
    elif isinstance(payload, list):
        return [sanitize_webhook_payload(item) for item in payload]
    return payload


def calculate_delivery_delay(
    event_timestamp: Optional[datetime.datetime],
    ingestion_timestamp: Optional[datetime.datetime],
) -> Dict[str, Any]:
    """
    Calculate deterministic delivery delay between Razorpay event time and PayTrace ingestion time.
    """
    if not event_timestamp or not ingestion_timestamp:
        return {
            "delay_seconds": None,
            "classification": "UNAVAILABLE",
            "label": "Delivery delay unavailable",
            "event_timestamp": event_timestamp.isoformat() if event_timestamp else None,
            "ingestion_timestamp": ingestion_timestamp.isoformat() if ingestion_timestamp else None,
        }

    # Ensure tz-awareness compatibility
    if event_timestamp.tzinfo is not None and ingestion_timestamp.tzinfo is None:
        ingestion_timestamp = ingestion_timestamp.replace(tzinfo=datetime.timezone.utc)
    elif event_timestamp.tzinfo is None and ingestion_timestamp.tzinfo is not None:
        event_timestamp = event_timestamp.replace(tzinfo=datetime.timezone.utc)

    delta = ingestion_timestamp - event_timestamp
    delay_seconds = round(delta.total_seconds(), 2)

    # Thresholds:
    # < 30s: LOW
    # <= 300s (5m): NORMAL
    # <= 1800s (30m): DELAYED
    # > 1800s: SIGNIFICANTLY_DELAYED
    if delay_seconds < 0:
        # Clock skew between Razorpay server and PayTrace server
        classification = "NORMAL"
        label = f"Immediate delivery ({abs(delay_seconds)}s clock skew offset)"
    elif delay_seconds < 30:
        classification = "LOW"
        label = f"Normal low delay ({delay_seconds:.1f}s)"
    elif delay_seconds <= 300:
        classification = "NORMAL"
        label = f"Normal delay ({delay_seconds:.1f}s)"
    elif delay_seconds <= 1800:
        classification = "DELAYED"
        label = f"Delayed delivery ({delay_seconds / 60:.1f}m)"
    else:
        classification = "SIGNIFICANTLY_DELAYED"
        label = f"Significantly delayed delivery ({delay_seconds / 60:.1f}m)"

    return {
        "delay_seconds": delay_seconds,
        "classification": classification,
        "label": label,
        "event_timestamp": event_timestamp.isoformat(),
        "ingestion_timestamp": ingestion_timestamp.isoformat(),
    }


def extract_razorpay_error(payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Extract structured Razorpay error information deterministically.
    Never invents error fields.
    """
    if not payload or not isinstance(payload, dict):
        return {
            "has_error": False,
            "code": "Not provided",
            "description": "Not provided",
            "source": "Not provided",
            "step": "Not provided",
            "reason": "Not provided",
            "metadata": None,
        }

    # Search in payload.payment.entity or payload.error
    payment_entity = (
        payload.get("payload", {})
        .get("payment", {})
        .get("entity", {})
    )
    direct_error = payload.get("error", {})
    if not isinstance(direct_error, dict):
        direct_error = {}

    code = (
        payment_entity.get("error_code")
        or direct_error.get("code")
        or payment_entity.get("internal_error_code")
    )
    description = (
        payment_entity.get("error_description")
        or direct_error.get("description")
    )
    source = (
        payment_entity.get("error_source")
        or direct_error.get("source")
    )
    step = (
        payment_entity.get("error_step")
        or direct_error.get("step")
    )
    reason = (
        payment_entity.get("error_reason")
        or direct_error.get("reason")
    )
    metadata = (
        payment_entity.get("error_metadata")
        or direct_error.get("metadata")
    )

    has_error = bool(code or description or reason or (payload.get("event") == "payment.failed"))

    return {
        "has_error": has_error,
        "code": str(code) if code is not None else "Not provided",
        "description": str(description) if description is not None else "Not provided",
        "source": str(source) if source is not None else "Not provided",
        "step": str(step) if step is not None else "Not provided",
        "reason": str(reason) if reason is not None else "Not provided",
        "metadata": metadata if metadata is not None else None,
    }


def detect_out_of_order(events: List[Any]) -> Dict[str, Any]:
    """
    Detect if webhook observations arrived out of chronological order.
    Compares event_timestamp order vs ingestion_timestamp order among trusted events.
    """
    if len(events) < 2:
        return {
            "detected": False,
            "description": "Insufficient events to establish ordering anomalies.",
            "details": [],
        }

    # Filter to events that have both event_timestamp and ingestion_timestamp
    dated_events = []
    for ev in events:
        ets = getattr(ev, "event_timestamp", None)
        its = getattr(ev, "ingestion_timestamp", None)
        eid = getattr(ev, "razorpay_event_id", None) or getattr(ev, "event_id", None) or str(getattr(ev, "id", ""))
        etype = getattr(ev, "event_type", None) or "unknown"
        if ets and its:
            # normalize tz
            if ets.tzinfo is not None and its.tzinfo is None:
                its = its.replace(tzinfo=datetime.timezone.utc)
            elif ets.tzinfo is None and its.tzinfo is not None:
                ets = ets.replace(tzinfo=datetime.timezone.utc)
            dated_events.append({
                "id": eid,
                "event_type": etype,
                "event_timestamp": ets,
                "ingestion_timestamp": its,
            })

    if len(dated_events) < 2:
        return {
            "detected": False,
            "description": "Event timestamps not available on all observations.",
            "details": [],
        }

    # Sort by ingestion_timestamp (arrival sequence)
    sorted_by_arrival = sorted(dated_events, key=lambda x: x["ingestion_timestamp"])

    # Check if event_timestamps are monotonically non-decreasing in arrival sequence
    out_of_order_pairs = []
    for i in range(len(sorted_by_arrival) - 1):
        earlier_arrival = sorted_by_arrival[i]
        later_arrival = sorted_by_arrival[i + 1]

        if earlier_arrival["event_timestamp"] > later_arrival["event_timestamp"]:
            out_of_order_pairs.append({
                "earlier_received": {
                    "id": earlier_arrival["id"],
                    "event_type": earlier_arrival["event_type"],
                    "event_timestamp": earlier_arrival["event_timestamp"].isoformat(),
                    "ingestion_timestamp": earlier_arrival["ingestion_timestamp"].isoformat(),
                },
                "later_received": {
                    "id": later_arrival["id"],
                    "event_type": later_arrival["event_type"],
                    "event_timestamp": later_arrival["event_timestamp"].isoformat(),
                    "ingestion_timestamp": later_arrival["ingestion_timestamp"].isoformat(),
                },
            })

    if out_of_order_pairs:
        return {
            "detected": True,
            "description": "Webhook delivery/order anomaly detected: events received out of chronological order.",
            "pairs": out_of_order_pairs,
        }

    return {
        "detected": False,
        "description": "All events arrived in chronological sequence.",
        "pairs": [],
    }


def detect_late_authorization(events: List[Any]) -> Dict[str, Any]:
    """
    Detect the known asynchronous Razorpay pattern:
    payment.failed followed chronologically by payment.captured.
    """
    if len(events) < 2:
        return {
            "detected": False,
            "pattern": None,
            "description": "Insufficient events to evaluate late authorization pattern.",
        }

    failed_event = None
    captured_event = None

    for ev in events:
        etype = getattr(ev, "event_type", "") or ""
        ets = getattr(ev, "event_timestamp", None)
        its = getattr(ev, "ingestion_timestamp", None)
        ts = ets or its

        if etype in ("payment.failed", "failed"):
            if not failed_event or (ts and failed_event["timestamp"] and ts > failed_event["timestamp"]):
                failed_event = {
                    "event_type": etype,
                    "timestamp": ts,
                    "id": getattr(ev, "razorpay_event_id", None) or getattr(ev, "event_id", None) or str(getattr(ev, "id", "")),
                }
        elif etype in ("payment.captured", "captured"):
            if not captured_event or (ts and captured_event["timestamp"] and ts > captured_event["timestamp"]):
                captured_event = {
                    "event_type": etype,
                    "timestamp": ts,
                    "id": getattr(ev, "razorpay_event_id", None) or getattr(ev, "event_id", None) or str(getattr(ev, "id", "")),
                }

    if failed_event and captured_event:
        # Check timestamps if both present
        f_ts = failed_event["timestamp"]
        c_ts = captured_event["timestamp"]
        if f_ts and c_ts:
            if f_ts.tzinfo is not None and c_ts.tzinfo is None:
                c_ts = c_ts.replace(tzinfo=datetime.timezone.utc)
            elif f_ts.tzinfo is None and c_ts.tzinfo is not None:
                f_ts = f_ts.replace(tzinfo=datetime.timezone.utc)

            if c_ts >= f_ts:
                return {
                    "detected": True,
                    "pattern": "Late authorization pattern",
                    "description": "Late authorization pattern: payment.failed was followed later by payment.captured. Pattern detected; root cause not established.",
                    "failed_event_id": failed_event["id"],
                    "captured_event_id": captured_event["id"],
                }
        else:
            # Timestamps missing, but both events exist in sequence
            return {
                "detected": True,
                "pattern": "Late authorization pattern",
                "description": "Late authorization pattern: both payment.failed and payment.captured events observed. Pattern detected; root cause not established.",
                "failed_event_id": failed_event["id"],
                "captured_event_id": captured_event["id"],
            }

    return {
        "detected": False,
        "pattern": None,
        "description": "Late authorization pattern not detected.",
    }


def reconcile_states(
    authoritative_state: Optional[str] = None,
    trusted_webhook_events: Optional[List[Any]] = None,
    merchant_state: Optional[str] = None,
    gateway_state: Optional[str] = None,
    webhook_events: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """
    Perform deterministic 3-way reconciliation:
    1. Razorpay Authoritative State (from state reconstruction / Razorpay API)
    2. Trusted Webhook Delivery Observations
    3. Merchant-side Processing Belief

    Authority Model:
    - Razorpay payment/API state is strictly authoritative for Razorpay-side financial/payment state.
    - Merchant-side records represent merchant belief/state and may disagree with Razorpay.
    - Webhooks are event-observation/delivery evidence, not automatically authoritative financial truth.
    - AI must NEVER decide which payment state is financially authoritative.

    Classifications:
    - CONSISTENT: Razorpay state and merchant processing state agree.
    - WEBHOOK_DELAYED: Authoritative payment state exists but corresponding webhook arrived late.
    - MERCHANT_NOT_UPDATED: Trusted webhook exists but merchant-side state remains stale.
    - CONFLICTING_OBSERVATIONS: Evidence disagrees and cannot be reconciled deterministically.
    - INSUFFICIENT_EVIDENCE: Not enough evidence to conclude.
    """
    auth_state = authoritative_state or gateway_state
    events = trusted_webhook_events if trusted_webhook_events is not None else (webhook_events or [])

    # Normalize states
    r_state = auth_state.lower().strip() if auth_state else None
    m_state = merchant_state.lower().strip() if merchant_state else None

    # Deterministic authority fields
    authoritative_payment_state = (r_state or "UNKNOWN").upper()
    merchant_state_norm = (m_state or "NOT_PROVIDED").upper()
    has_discrepancy = bool(r_state and m_state and r_state != m_state)

    if has_discrepancy:
        if r_state == "captured" and m_state == "failed":
            discrepancy = "merchant-side state has not reflected authoritative payment state"
        elif r_state == "failed" and m_state == "captured":
            discrepancy = "merchant-side state records capture but authoritative payment state is failed"
        else:
            discrepancy = f"merchant-side state ({merchant_state_norm}) has not reflected authoritative payment state ({authoritative_payment_state})"
    else:
        discrepancy = None

    # Latest trusted webhook observation state
    w_state = None
    w_delayed = False
    if events:
        latest = events[-1]
        w_type = getattr(latest, "event_type", "") or ""
        if "captured" in w_type:
            w_state = "captured"
        elif "failed" in w_type:
            w_state = "failed"
        elif "authorized" in w_type:
            w_state = "authorized"
        elif "created" in w_type:
            w_state = "created"

        # Check if latest webhook was delayed
        delay_info = calculate_delivery_delay(
            getattr(latest, "event_timestamp", None),
            getattr(latest, "ingestion_timestamp", None),
        )
        if delay_info.get("classification") in ("DELAYED", "SIGNIFICANTLY_DELAYED"):
            w_delayed = True

    # Rule 1: Insufficient evidence
    if not r_state and not m_state:
        return {
            "status": "INSUFFICIENT_EVIDENCE",
            "authoritative_payment_state": authoritative_payment_state,
            "merchant_state": merchant_state_norm,
            "has_discrepancy": False,
            "discrepancy": None,
            "razorpay_state": r_state or "Not available",
            "webhook_state": w_state or "Not available",
            "merchant_state_raw": m_state,
            "explanation": "Insufficient evidence: neither authoritative Razorpay state nor merchant state is available.",
        }

    if m_state is None:
        return {
            "status": "INSUFFICIENT_EVIDENCE",
            "authoritative_payment_state": authoritative_payment_state,
            "merchant_state": "Not provided",
            "has_discrepancy": False,
            "discrepancy": None,
            "razorpay_state": r_state or "Not available",
            "webhook_state": w_state or "Not available",
            "merchant_state_raw": None,
            "explanation": "Merchant processing belief not provided in evidence. Unable to establish merchant agreement.",
        }

    # Rule 2: Consistent agreement
    if r_state == m_state:
        if w_delayed:
            return {
                "status": "WEBHOOK_DELAYED",
                "authoritative_payment_state": authoritative_payment_state,
                "merchant_state": merchant_state_norm,
                "has_discrepancy": False,
                "discrepancy": None,
                "razorpay_state": r_state,
                "webhook_state": w_state or r_state,
                "merchant_state_raw": m_state,
                "explanation": f"Razorpay and merchant state agree on '{r_state}', but webhook delivery was delayed.",
            }
        return {
            "status": "CONSISTENT",
            "authoritative_payment_state": authoritative_payment_state,
            "merchant_state": merchant_state_norm,
            "has_discrepancy": False,
            "discrepancy": None,
            "razorpay_state": r_state,
            "webhook_state": w_state or r_state,
            "merchant_state_raw": m_state,
            "explanation": f"Razorpay authoritative state and merchant processing state agree on '{r_state}'.",
        }

    # Rule 3: Authoritative captured, but merchant stale/pending/failed
    if r_state == "captured":
        if w_state == "captured":
            return {
                "status": "MERCHANT_NOT_UPDATED",
                "authoritative_payment_state": authoritative_payment_state,
                "merchant_state": merchant_state_norm,
                "has_discrepancy": True,
                "discrepancy": discrepancy,
                "razorpay_state": r_state,
                "webhook_state": w_state,
                "merchant_state_raw": m_state,
                "explanation": "Trusted webhook confirmed capture, but merchant-side state remains stale or un-updated.",
            }
        elif w_delayed:
            return {
                "status": "WEBHOOK_DELAYED",
                "authoritative_payment_state": authoritative_payment_state,
                "merchant_state": merchant_state_norm,
                "has_discrepancy": True,
                "discrepancy": discrepancy,
                "razorpay_state": r_state,
                "webhook_state": w_state or "Not received",
                "merchant_state_raw": m_state,
                "explanation": "Payment is captured in Razorpay, but webhook delivery observation was delayed or missing, leaving merchant un-updated.",
            }
        else:
            return {
                "status": "CONFLICTING_OBSERVATIONS",
                "authoritative_payment_state": authoritative_payment_state,
                "merchant_state": merchant_state_norm,
                "has_discrepancy": True,
                "discrepancy": discrepancy,
                "razorpay_state": r_state,
                "webhook_state": w_state or "Not available",
                "merchant_state_raw": m_state,
                "explanation": "Razorpay authoritative state is captured, but merchant state indicates failure or conflicting belief.",
            }

    # Rule 4: Conflicting observations
    return {
        "status": "CONFLICTING_OBSERVATIONS",
        "authoritative_payment_state": authoritative_payment_state,
        "merchant_state": merchant_state_norm,
        "has_discrepancy": True,
        "discrepancy": discrepancy,
        "razorpay_state": r_state or "Unknown",
        "webhook_state": w_state or "Unknown",
        "merchant_state_raw": m_state,
        "explanation": f"Disagreement between Razorpay authoritative state ('{r_state}') and merchant belief ('{m_state}').",
    }
