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

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import WebhookEvent
from app.webhook_verifier import SignatureVerificationError, verify_razorpay_signature

logger = logging.getLogger("paytrace.webhooks")

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _extract_event_meta(payload: dict) -> tuple[str | None, str | None, datetime.datetime | None]:
    """
    Extract top-level event classification and entity ID from Razorpay payload.

    Returns:
        (event_type, entity_id, event_timestamp)
    """
    event_type = payload.get("event")  # e.g. "payment.authorized"
    entity_id: str | None = None
    event_timestamp: datetime.datetime | None = None

    # Razorpay timestamp is a Unix epoch integer in the payload["created_at"] field
    created_at_raw = payload.get("created_at")
    if isinstance(created_at_raw, int):
        try:
            event_timestamp = datetime.datetime.utcfromtimestamp(created_at_raw)
        except (ValueError, OSError, OverflowError):
            pass

    # Extract entity ID from the first entity in the payload
    payload_data = payload.get("payload", {})
    for entity_key, entity_value in payload_data.items():
        if isinstance(entity_value, dict):
            inner = entity_value.get("entity", {})
            if isinstance(inner, dict):
                entity_id = inner.get("id")
                if entity_id:
                    break

    return event_type, entity_id, event_timestamp


@router.post("/razorpay")
async def receive_razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_razorpay_signature: str | None = Header(default=None, alias="X-Razorpay-Signature"),
    x_razorpay_event_id: str | None = Header(default=None, alias="x-razorpay-event-id"),
):
    """
    Ingest a Razorpay Test Mode webhook.

    Security contract (D-010):
      Signature verification happens FIRST on the raw body.
      Only events passing verification are treated as trusted evidence.
      Failing events are recorded for audit but never enter trusted evidence paths.
    """
    # ── Step 1: Capture raw body BEFORE any parsing ────────────────────────
    raw_body: bytes = await request.body()

    # ── Step 2: Check webhook secret is configured ─────────────────────────
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not webhook_secret:
        logger.error(
            "RAZORPAY_WEBHOOK_SECRET is not configured on this server. "
            "Cannot verify webhook signature. Rejecting request."
        )
        raise HTTPException(
            status_code=503,
            detail=(
                "Webhook secret not configured on server. "
                "Set RAZORPAY_WEBHOOK_SECRET in environment variables."
            ),
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

    # ── Step 4: Parse payload (only after verification attempt) ────────────
    try:
        payload: dict = json.loads(raw_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        logger.error("Malformed webhook body: %s", exc)
        # Even malformed bodies get an audit record if secret is present
        event = WebhookEvent(
            razorpay_event_id=x_razorpay_event_id,
            signature_valid=False,
            received_signature=x_razorpay_signature,
            event_type=None,
            entity_id=None,
            raw_payload=None,
            processing_notes=f"Body parse error: {exc}",
        )
        db.add(event)
        db.commit()
        raise HTTPException(status_code=400, detail="Malformed request body")

    # ── Step 5: Extract event metadata ─────────────────────────────────────
    event_type, entity_id, event_timestamp = _extract_event_meta(payload)

    # ── Step 6: Idempotency check ──────────────────────────────────────────
    # If we have already processed this exact Razorpay event ID successfully,
    # return 200 without re-processing (D-009 idempotency requirement).
    if x_razorpay_event_id and signature_valid:
        existing = (
            db.query(WebhookEvent)
            .filter(
                WebhookEvent.razorpay_event_id == x_razorpay_event_id,
                WebhookEvent.signature_valid.is_(True),
            )
            .first()
        )
        if existing:
            logger.info(
                "Duplicate webhook event received: event_id=%s (already processed as record ID %s). "
                "Returning 200 without re-processing.",
                x_razorpay_event_id,
                existing.id,
            )
            return Response(status_code=200)

    # ── Step 7: Persist the event (trusted or audit-only) ──────────────────
    if signature_valid:
        notes = "Signature verified. Event accepted as trusted."
        logger.info(
            "Valid webhook received: event_id=%s event_type=%s entity_id=%s",
            x_razorpay_event_id,
            event_type,
            entity_id,
        )
    else:
        notes = (
            f"Signature verification FAILED. "
            f"Received signature: {x_razorpay_signature!r:.50s}. "
            f"Event stored for audit only. NOT trusted evidence."
        )
        logger.warning(
            "INVALID signature on webhook: event_id=%s event_type=%s. "
            "Rejecting as untrusted. Audit record will be stored.",
            x_razorpay_event_id,
            event_type,
        )

    event = WebhookEvent(
        razorpay_event_id=x_razorpay_event_id,
        signature_valid=signature_valid,
        received_signature=x_razorpay_signature,
        event_type=event_type,
        entity_id=entity_id,
        raw_payload=payload,
        event_timestamp=event_timestamp,
        processing_notes=notes,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # ── Step 8: Return response ────────────────────────────────────────────
    if not signature_valid:
        # D-010: Return 403 so Razorpay knows we rejected it.
        # The audit record is stored, but the event is NOT trusted evidence.
        raise HTTPException(
            status_code=403,
            detail="Webhook signature verification failed. Event rejected.",
        )

    logger.info(
        "Webhook event persisted: record_id=%s event_type=%s entity_id=%s",
        event.id,
        event_type,
        entity_id,
    )
    return Response(status_code=200)


@router.get("/events")
def list_webhook_events(
    limit: int = 20,
    verified_only: bool = False,
    db: Session = Depends(get_db),
):
    """Retrieve recent webhook events from Supabase PostgreSQL."""
    query = db.query(WebhookEvent).order_by(WebhookEvent.id.desc())
    if verified_only:
        query = query.filter(WebhookEvent.signature_valid.is_(True))
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
