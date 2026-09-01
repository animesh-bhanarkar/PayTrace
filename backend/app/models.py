import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON, Text, Boolean
from app.database import Base


class SystemProbe(Base):
    __tablename__ = "system_probes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    probe_name = Column(String(100), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="active")
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)


class WebhookEvent(Base):
    """
    Raw inbound Razorpay webhook event record.

    Signature verification occurs BEFORE persisting any event here.
    Only events that pass signature verification are stored with
    signature_valid=True and are eligible to become trusted payment evidence.

    Events that fail signature verification are stored with
    signature_valid=False and must never enter downstream reasoning.
    """
    __tablename__ = "webhook_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Razorpay idempotency key: x-razorpay-event-id header
    razorpay_event_id = Column(String(255), nullable=True, index=True)

    # Signature verification result — set BEFORE storing the payload as trusted
    signature_valid = Column(Boolean, nullable=False, default=False)

    # The received signature from the X-Razorpay-Signature header
    received_signature = Column(String(512), nullable=True)

    # Top-level event classification (e.g. payment.authorized, payment.failed)
    event_type = Column(String(100), nullable=True, index=True)

    # The Razorpay entity ID within the event, e.g. pay_XXXX
    entity_id = Column(String(255), nullable=True, index=True)

    # Raw JSON payload — stored exactly as received from Razorpay
    raw_payload = Column(JSON, nullable=True)

    # Timestamps
    # event_timestamp: when Razorpay says the event occurred (from payload)
    event_timestamp = Column(DateTime, nullable=True)
    # ingestion_timestamp: when our server received and stored the event
    ingestion_timestamp = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        nullable=False,
    )

    # Processing notes: rejection reason or verification outcome detail
    processing_notes = Column(Text, nullable=True)
