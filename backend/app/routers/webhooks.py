"""
Razorpay webhook router.

Contract:
  POST /webhooks/razorpay

Security:
  1. Raw request body is captured BEFORE any parsing.
  2. HMAC-SHA256 signature verification runs IMMEDIATELY.
  3. Only verified events are stored as trusted data (signature_valid=True).
  4. Events with invalid/missing signatures are rejected with HTTP 403.
     They are stored with signature_valid=False for audit purposes only.
"""

import datetime
import hashlib
import json
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import WebhookEvent, NormalizedEvent, PaymentState, Incident
from app.webhook_verifier import SignatureVerificationError, verify_razorpay_signature
from app.event_parser import parse_webhook_to_normalized_event
from app.state_reconstructor import reconstruct_payment_state
from app.incident_detector import detect_incidents
from app.authoritative_rules import apply_authoritative_rules
from app.webhook_diagnostics import (
    calculate_delivery_delay,
    extract_razorpay_error,
    detect_out_of_order,
    detect_late_authorization,
    reconcile_states,
    sanitize_webhook_payload,
)

logger = logging.getLogger("paytrace.webhooks")

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

MAX_PAYLOAD_BYTES = 1024 * 1024  # 1 MB


def _extract_event_meta(payload: dict) -> tuple[str | None, str | None, str | None, datetime.datetime | None]:
    """
    Extract top-level event classification, entity_id, order_id, and event_timestamp.

    Returns:
        (event_type, payment_id, order_id, event_timestamp)
    """
    event_type = payload.get("event")
    payment_id: str | None = None
    order_id: str | None = None
    event_timestamp: datetime.datetime | None = None

    # Razorpay timestamp is a Unix epoch integer in created_at
    created_at_raw = payload.get("created_at")
    if isinstance(created_at_raw, (int, float)):
        try:
            event_timestamp = datetime.datetime.fromtimestamp(created_at_raw, datetime.timezone.utc)
        except (ValueError, OSError, OverflowError):
            pass

    payload_data = payload.get("payload", {})
    if isinstance(payload_data, dict):
        payment_entity = payload_data.get("payment", {}).get("entity", {})
        if isinstance(payment_entity, dict):
            payment_id = payment_entity.get("id")
            order_id = payment_entity.get("order_id")

        if not order_id:
            order_entity = payload_data.get("order", {}).get("entity", {})
            if isinstance(order_entity, dict):
                order_id = order_entity.get("id")

        if not payment_id:
            for entity_key, entity_value in payload_data.items():
                if isinstance(entity_value, dict):
                    inner = entity_value.get("entity", {})
                    if isinstance(inner, dict) and inner.get("id"):
                        payment_id = inner.get("id")
                        break

    return event_type, payment_id, order_id, event_timestamp


@router.post("/razorpay")
async def receive_razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_razorpay_signature: str | None = Header(default=None, alias="X-Razorpay-Signature"),
    x_razorpay_event_id: str | None = Header(default=None, alias="x-razorpay-event-id"),
):
    """
    Ingest a Razorpay Test Mode webhook.

    Phase 7 Security & Trust Contract:
      1. Body size bounded to prevent resource exhaustion attacks.
      2. Raw request body captured BEFORE any JSON parsing.
      3. HMAC-SHA256 timing-safe signature verification.
      4. Explicit trust classification: TRUSTED, UNTRUSTED, INVALID.
      5. Deterministic duplicate detection on x-razorpay-event-id.
      6. Duplicate webhooks preserve delivery observation without duplicating canonical evidence.
      7. Untrusted/invalid payloads NEVER enter canonical NormalizedEvent or AI evidence packages.
    """
    # ── Step 1: Capture raw body BEFORE any parsing ────────────────────────
    raw_body: bytes = await request.body()
    payload_size = len(raw_body)
    now_utc = datetime.datetime.now(datetime.timezone.utc)

    # Size validation
    if payload_size > MAX_PAYLOAD_BYTES:
        logger.warning("Rejected oversized webhook payload: %d bytes", payload_size)
        audit_event = WebhookEvent(
            razorpay_event_id=x_razorpay_event_id,
            signature_valid=False,
            received_signature=x_razorpay_signature,
            trust_status="INVALID",
            duplicate_status="ORIGINAL",
            payload_size_bytes=payload_size,
            processing_notes=f"Oversized payload rejected ({payload_size} bytes, limit {MAX_PAYLOAD_BYTES})",
        )
        db.add(audit_event)
        db.commit()
        raise HTTPException(status_code=413, detail="Payload too large")

    # ── Step 2: Check webhook secret is configured ─────────────────────────
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not webhook_secret:
        logger.error("RAZORPAY_WEBHOOK_SECRET is not configured on this server.")
        raise HTTPException(
            status_code=503,
            detail="Webhook secret not configured on server. Set RAZORPAY_WEBHOOK_SECRET in environment variables.",
        )

    # ── Step 3: Signature verification on raw body ─────────────────────────
    try:
        signature_valid = verify_razorpay_signature(
            raw_body=raw_body,
            received_signature=x_razorpay_signature or "",
            webhook_secret=webhook_secret,
        )
    except SignatureVerificationError as exc:
        logger.error("Signature verification error: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))

    trust_status = "TRUSTED" if signature_valid else "UNTRUSTED"

    # ── Step 4: Parse payload (only after verification attempt) ────────────
    try:
        payload: dict = json.loads(raw_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        logger.error("Malformed webhook body: %s", exc)
        audit_event = WebhookEvent(
            razorpay_event_id=x_razorpay_event_id,
            signature_valid=False,
            received_signature=x_razorpay_signature,
            event_type=None,
            entity_id=None,
            raw_payload=None,
            trust_status="INVALID",
            duplicate_status="ORIGINAL",
            payload_size_bytes=payload_size,
            processing_notes=f"Malformed request body parse error: {exc}",
        )
        db.add(audit_event)
        db.commit()
        raise HTTPException(status_code=400, detail="Malformed request body")

    # ── Step 5: Extract event metadata & calculate diagnostics ─────────────
    event_type, payment_id, order_id, event_timestamp = _extract_event_meta(payload)
    payload_hash = hashlib.sha256(raw_body).hexdigest()
    error_details = extract_razorpay_error(payload)

    # Delivery delay
    delay_info = calculate_delivery_delay(event_timestamp, now_utc)
    delivery_delay_seconds = delay_info.get("delay_seconds")

    # ── Step 6: Duplicate detection via x-razorpay-event-id ─────────────────
    duplicate_status = "ORIGINAL"
    if x_razorpay_event_id:
        existing_wh = (
            db.query(WebhookEvent)
            .filter(WebhookEvent.razorpay_event_id == x_razorpay_event_id)
            .first()
        )
        if existing_wh:
            duplicate_status = "DUPLICATE"

    # ── Step 7: Persist Webhook Delivery Observation ───────────────────────
    if trust_status == "TRUSTED":
        notes = (
            f"Signature verified successfully. "
            f"Trust: TRUSTED. Duplicate: {duplicate_status}. "
            f"Delay: {delay_info.get('label')}."
        )
    else:
        notes = (
            f"Signature verification FAILED. Trust: UNTRUSTED. "
            f"Stored for security audit only. NEVER promoted to trusted payment evidence."
        )

    webhook_record = WebhookEvent(
        razorpay_event_id=x_razorpay_event_id,
        signature_valid=signature_valid,
        received_signature=x_razorpay_signature,
        event_type=event_type,
        entity_id=payment_id,
        payment_id=payment_id,
        order_id=order_id,
        raw_payload=payload,
        event_timestamp=event_timestamp,
        ingestion_timestamp=now_utc,
        trust_status=trust_status,
        duplicate_status=duplicate_status,
        delivery_delay_seconds=delivery_delay_seconds,
        payload_hash=payload_hash,
        payload_size_bytes=payload_size,
        error_details=error_details,
        processing_notes=notes,
    )
    db.add(webhook_record)
    db.commit()
    db.refresh(webhook_record)

    # ── Step 8: Handle Untrusted or Duplicate Webhook Deliveries ────────────
    if trust_status != "TRUSTED":
        logger.warning(
            "Untrusted webhook rejected: event_id=%s event_type=%s",
            x_razorpay_event_id,
            event_type,
        )
        raise HTTPException(
            status_code=403,
            detail="Webhook signature verification failed. Event rejected.",
        )

    if duplicate_status == "DUPLICATE":
        logger.info(
            "Duplicate trusted webhook received: event_id=%s. Acknowledged without duplicating evidence.",
            x_razorpay_event_id,
        )
        return {
            "status": "duplicate_acknowledged",
            "trust_status": "TRUSTED",
            "duplicate_status": "DUPLICATE",
            "event_type": event_type,
            "payment_id": payment_id,
            "delivery_delay_seconds": delivery_delay_seconds,
        }

    # ── Step 9: Trusted Original Webhook Pipeline ──────────────────────────
    incident_count = 0
    confidence_hint = "HIGH"
    requires_ai_investigation = False
    new_event = None
    try:
        new_event = parse_webhook_to_normalized_event(payload, signature_valid=True)
        # Ensure event_id matches header if available
        if x_razorpay_event_id and new_event:
            new_event.event_id = x_razorpay_event_id

        existing_events = []
        if new_event.payment_id:
            existing_events = (
                db.query(NormalizedEvent)
                .filter(
                    NormalizedEvent.payment_id == new_event.payment_id,
                    NormalizedEvent.signature_valid.is_(True),
                )
                .all()
            )

        payment_state = reconstruct_payment_state(existing_events + [new_event])
        incidents = detect_incidents(
            new_event,
            existing_events,
            payment_state.state_history,
            signature_valid=True,
        )
        incident_count = len(incidents)

        auth_result = apply_authoritative_rules(payment_state, incidents)
        confidence_hint = auth_result["confidence_hint"]
        requires_ai_investigation = auth_result["requires_ai_investigation"]

        # Persist canonical NormalizedEvent (TRUSTED only)
        db.add(new_event)

        # Upsert authoritative PaymentState
        if new_event.payment_id:
            existing_state = (
                db.query(PaymentState)
                .filter(PaymentState.payment_id == new_event.payment_id)
                .first()
            )
            if existing_state:
                existing_state.current_state = payment_state.current_state
                existing_state.state_history = payment_state.state_history
                existing_state.last_updated = datetime.datetime.now(datetime.timezone.utc)
            else:
                db.add(payment_state)

        # Persist detected incidents
        for inc in incidents:
            incident_row = Incident(
                payment_id=inc.payment_id,
                order_id=inc.order_id,
                incident_type=inc.incident_type,
                severity=inc.severity,
                description=inc.description,
                evidence_ids=inc.evidence_ids,
            )
            db.add(incident_row)

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Event Normalization Pipeline failed: %s", e)

    return {
        "status": "accepted",
        "trust_status": "TRUSTED",
        "duplicate_status": "ORIGINAL",
        "event_type": event_type,
        "payment_id": payment_id,
        "incidents_detected": incident_count,
        "confidence_hint": confidence_hint,
        "requires_ai_investigation": requires_ai_investigation,
        "delivery_delay_seconds": delivery_delay_seconds,
    }



@router.get("")
@router.get("/")
def list_webhooks(
    limit: int = Query(50, ge=1, le=200),
    trust_status: Optional[str] = Query(None),
    duplicate_status: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    payment_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    List Razorpay webhook delivery observations with deterministic filtering.
    """
    query = db.query(WebhookEvent).order_by(WebhookEvent.id.desc())

    if trust_status:
        query = query.filter(WebhookEvent.trust_status == trust_status.upper())
    if duplicate_status:
        query = query.filter(WebhookEvent.duplicate_status == duplicate_status.upper())
    if event_type:
        query = query.filter(WebhookEvent.event_type == event_type)
    if payment_id:
        query = query.filter(
            (WebhookEvent.payment_id == payment_id)
            | (WebhookEvent.entity_id == payment_id)
        )

    events = query.limit(limit).all()

    return {
        "count": len(events),
        "webhooks": [
            {
                "id": e.id,
                "razorpay_event_id": e.razorpay_event_id,
                "trust_status": e.trust_status or ("TRUSTED" if e.signature_valid else "UNTRUSTED"),
                "duplicate_status": e.duplicate_status or "ORIGINAL",
                "signature_valid": e.signature_valid,
                "event_type": e.event_type,
                "payment_id": e.payment_id or e.entity_id,
                "order_id": e.order_id,
                "event_timestamp": e.event_timestamp.isoformat() if e.event_timestamp else None,
                "ingestion_timestamp": e.ingestion_timestamp.isoformat() if e.ingestion_timestamp else None,
                "delivery_delay_seconds": e.delivery_delay_seconds,
                "payload_size_bytes": e.payload_size_bytes,
                "payload_hash": e.payload_hash,
                "has_error": bool(e.error_details and e.error_details.get("has_error")),
                "error_details": e.error_details,
                "processing_notes": e.processing_notes,
            }
            for e in events
        ],
    }


@router.get("/events")
def list_webhook_events(
    limit: int = 20,
    verified_only: bool = False,
    db: Session = Depends(get_db),
):
    """Backward compatibility endpoint for earlier phases."""
    query = db.query(WebhookEvent).order_by(WebhookEvent.id.desc())
    if verified_only:
        query = query.filter(
            WebhookEvent.signature_valid.is_(True),
            (WebhookEvent.duplicate_status != "DUPLICATE") | (WebhookEvent.duplicate_status.is_(None)),
        )
    events = query.limit(limit).all()

    return {
        "count": len(events),
        "events": [
            {
                "id": e.id,
                "razorpay_event_id": e.razorpay_event_id,
                "signature_valid": e.signature_valid,
                "event_type": e.event_type,
                "entity_id": e.entity_id,
                "event_timestamp": e.event_timestamp.isoformat() if e.event_timestamp else None,
                "ingestion_timestamp": e.ingestion_timestamp.isoformat() if e.ingestion_timestamp else None,
                "processing_notes": e.processing_notes,
            }
            for e in events
        ],
    }


@router.get("/reconciliation/{payment_id}")
def get_payment_reconciliation(
    payment_id: str,
    db: Session = Depends(get_db),
):
    """
    Evaluate deterministic 3-way reconciliation:
    Razorpay authoritative payment state vs Webhook delivery observations vs Merchant state belief.
    """
    # 1. Authoritative payment state
    payment_state_row = (
        db.query(PaymentState)
        .filter(PaymentState.payment_id == payment_id)
        .first()
    )
    auth_state = payment_state_row.current_state if payment_state_row else None

    # 2. Trusted webhook observations
    wh_events = (
        db.query(WebhookEvent)
        .filter(
            (WebhookEvent.payment_id == payment_id) | (WebhookEvent.entity_id == payment_id),
            WebhookEvent.signature_valid.is_(True),
        )
        .order_by(WebhookEvent.id.asc())
        .all()
    )

    # 3. Merchant-reported event
    merchant_event = (
        db.query(NormalizedEvent)
        .filter(
            NormalizedEvent.payment_id == payment_id,
            NormalizedEvent.source == "merchant",
        )
        .first()
    )
    merchant_state = merchant_event.status if merchant_event else None

    reconciliation = reconcile_states(
        authoritative_state=auth_state,
        trusted_webhook_events=wh_events,
        merchant_state=merchant_state,
    )
    return {
        "payment_id": payment_id,
        "reconciliation": reconciliation,
        "trusted_webhook_count": len(wh_events),
        "merchant_belief_recorded": merchant_state is not None,
    }


@router.get("/{id}/diagnostics")
def get_webhook_diagnostics(
    id: int,
    db: Session = Depends(get_db),
):
    """
    Return comprehensive diagnostic report for a single webhook event.
    """
    event = db.query(WebhookEvent).filter(WebhookEvent.id == id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Webhook event not found")

    delay_info = calculate_delivery_delay(event.event_timestamp, event.ingestion_timestamp)
    err = event.error_details or extract_razorpay_error(event.raw_payload)

    # Ordering & pattern diagnostics if associated with a payment
    pid = event.payment_id or event.entity_id
    out_of_order_diag = {"detected": False, "description": "No related payment events."}
    late_auth_diag = {"detected": False, "description": "No related payment events."}

    if pid:
        related_events = (
            db.query(WebhookEvent)
            .filter(
                (WebhookEvent.payment_id == pid) | (WebhookEvent.entity_id == pid),
                WebhookEvent.signature_valid.is_(True),
            )
            .order_by(WebhookEvent.id.asc())
            .all()
        )
        out_of_order_diag = detect_out_of_order(related_events)
        late_auth_diag = detect_late_authorization(related_events)

    return {
        "id": event.id,
        "razorpay_event_id": event.razorpay_event_id or "Not provided",
        "trust_status": event.trust_status or ("TRUSTED" if event.signature_valid else "UNTRUSTED"),
        "duplicate_status": event.duplicate_status or "ORIGINAL",
        "signature_valid": event.signature_valid,
        "event_type": event.event_type or "unknown",
        "payment_id": pid or "Correlation unavailable",
        "order_id": event.order_id or "Correlation unavailable",
        "event_timestamp": event.event_timestamp.isoformat() if event.event_timestamp else None,
        "ingestion_timestamp": event.ingestion_timestamp.isoformat() if event.ingestion_timestamp else None,
        "delivery_delay": delay_info,
        "error_details": err,
        "out_of_order_diagnostics": out_of_order_diag,
        "late_authorization_diagnostics": late_auth_diag,
        "processing_notes": event.processing_notes,
    }


@router.get("/{id}")
def get_webhook_detail(
    id: int,
    db: Session = Depends(get_db),
):
    """
    Inspect a single webhook event with safe, redacted payload.
    Never exposes secrets or credentials.
    """
    event = db.query(WebhookEvent).filter(WebhookEvent.id == id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Webhook event not found")

    sanitized_payload = sanitize_webhook_payload(event.raw_payload)

    return {
        "id": event.id,
        "razorpay_event_id": event.razorpay_event_id,
        "trust_status": event.trust_status or ("TRUSTED" if event.signature_valid else "UNTRUSTED"),
        "duplicate_status": event.duplicate_status or "ORIGINAL",
        "signature_valid": event.signature_valid,
        "received_signature": (event.received_signature[:12] + "...") if event.received_signature else None,
        "event_type": event.event_type,
        "payment_id": event.payment_id or event.entity_id,
        "order_id": event.order_id,
        "event_timestamp": event.event_timestamp.isoformat() if event.event_timestamp else None,
        "ingestion_timestamp": event.ingestion_timestamp.isoformat() if event.ingestion_timestamp else None,
        "delivery_delay_seconds": event.delivery_delay_seconds,
        "payload_size_bytes": event.payload_size_bytes,
        "payload_hash": event.payload_hash,
        "error_details": event.error_details,
        "raw_payload": sanitized_payload,
        "processing_notes": event.processing_notes,
    }
