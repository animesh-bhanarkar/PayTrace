import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON, Text, Boolean, func, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from app.database import Base
import uuid


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


# ---------------------------------------------------------------------------
# Day 2 — Payment Intelligence Models
# ---------------------------------------------------------------------------

class NormalizedEvent(Base):
    """
    Normalised representation of a payment event drawn from any source
    (webhook, API poll, or merchant-reported state).

    Only verified events should be promoted here.  This table is the
    evidence layer that feeds deterministic state reconstruction.
    """
    __tablename__ = "normalized_events"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )

    # Razorpay event ID from the webhook payload / API response
    event_id = Column(String(255), unique=True, nullable=False, index=True)

    # e.g. payment.authorized | payment.captured | order.paid | payment.failed
    event_type = Column(String(100), nullable=False, index=True)

    # Razorpay entity identifiers
    payment_id = Column(String(255), nullable=True, index=True)
    order_id = Column(String(255), nullable=True, index=True)

    # Timestamps
    # event_timestamp: when the event actually occurred (from payload / API)
    event_timestamp = Column(TIMESTAMP(timezone=True), nullable=False)
    # ingestion_timestamp: when PayTrace received and stored the event
    ingestion_timestamp = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Data provenance
    source = Column(String(50), nullable=False)           # webhook | api | merchant
    status = Column(String(50), nullable=False)            # e.g. captured | failed | authorized
    delivery_status = Column(String(50), nullable=True)   # e.g. delivered | delayed | missing

    # Integrity
    payload_hash = Column(String(64), nullable=True)       # SHA-256 of raw_payload
    signature_valid = Column(Boolean, nullable=False)

    # Full original payload for audit / replay
    raw_payload = Column(JSONB, nullable=True)


class PaymentState(Base):
    """
    Deterministic current state of a Razorpay payment, reconstructed
    from all normalised events for that payment_id.

    Updated whenever a new NormalizedEvent arrives for this payment.
    Never mutated by AI — only by the deterministic state machine.
    """
    __tablename__ = "payment_states"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )

    # Razorpay payment identifier — one row per payment
    payment_id = Column(String(255), unique=True, nullable=False, index=True)
    order_id = Column(String(255), nullable=True, index=True)

    # The deterministic current state (e.g. captured, failed, authorized)
    current_state = Column(String(50), nullable=False)

    # When this record was last updated by the state machine
    last_updated = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Ordered log of state transitions: list of {state, timestamp, event_id}
    state_history = Column(JSONB, nullable=True)


class Incident(Base):
    """
    A detected payment incident record.

    Created by the incident detector for every anomaly found during
    event normalization.  Never mutated by AI — only by the deterministic
    pipeline.  AI may READ these records as evidence context.
    """
    __tablename__ = "incidents"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )

    # Payment / order association (nullable — may be unknown for bad signatures)
    payment_id = Column(String(255), nullable=True, index=True)
    order_id = Column(String(255), nullable=True)

    # Incident classification
    incident_type = Column(String(100), nullable=False, index=True)
    severity = Column(String(10), nullable=False)          # LOW | MEDIUM | HIGH
    description = Column(String(1024), nullable=False)

    # Evidence — list of event_id strings that triggered this incident
    evidence_ids = Column(JSONB, nullable=True)

    # Timestamps
    detected_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Resolution & Operational Workflow (Phase 6)
    resolved = Column(Boolean, nullable=False, default=False)
    resolution_notes = Column(String(1024), nullable=True)
    resolved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    operational_status = Column(String(50), nullable=False, default="OPEN", index=True)
    priority = Column(String(20), nullable=False, default="MEDIUM", index=True)
    tags = Column(JSONB, nullable=True, default=list)
    assignee = Column(String(255), nullable=True)
    workflow_history = Column(JSONB, nullable=True, default=list)


class AuditRecord(Base):
    __tablename__ = "audit_records"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    payment_id = Column(String(255), nullable=False, index=True)
    evidence_package_id = Column(String(255), nullable=False)
    ai_activated = Column(Boolean, nullable=False)
    activation_reason = Column(String(1024), nullable=True)
    gemini_raw_output = Column(JSONB, nullable=True)
    verified_claims = Column(JSONB, nullable=True)
    confidence_level = Column(String(50), nullable=True)
    confidence_score = Column(Float, nullable=True)
    abstained = Column(Boolean, nullable=False, default=False)
    timestamp = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class IncidentNote(Base):
    """
    Human investigator annotations for a payment incident.
    Clearly distinguished from deterministic evidence and AI claims.
    """
    __tablename__ = "incident_notes"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    payment_id = Column(String(255), nullable=False, index=True)
    author = Column(String(255), nullable=False, default="Developer")
    note_text = Column(String(2048), nullable=False)
    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
