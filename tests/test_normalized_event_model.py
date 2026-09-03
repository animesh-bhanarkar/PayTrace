"""
tests/test_normalized_event_model.py

Day 2, Step 1: NormalizedEvent and PaymentState model integration test.

Runs against live Supabase PostgreSQL (DATABASE_URL from environment).
Ensures both tables can be created, a record inserted, and retrieved correctly.
Cleans up after itself (deletes the inserted test rows).
"""
import os
import sys
import uuid
import datetime
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models import NormalizedEvent, PaymentState  # noqa: F401 — registers models


@pytest.fixture(scope="module")
def db_session():
    """Create a live session against Supabase and ensure tables exist."""
    db_url = settings.sqlalchemy_database_uri
    if not db_url:
        pytest.skip("DATABASE_URL not configured — skipping live DB test")

    engine = create_engine(db_url, pool_pre_ping=True)
    # Apply schema for any new tables (idempotent — existing tables are skipped)
    Base.metadata.create_all(bind=engine)

    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = Session()
    yield session
    session.close()


class TestNormalizedEventModel:
    """Insert a NormalizedEvent, retrieve it, assert all fields round-trip."""

    TEST_EVENT_ID = f"test_ne_{uuid.uuid4().hex[:12]}"

    def test_insert_and_retrieve_normalized_event(self, db_session):
        now = datetime.datetime.now(datetime.timezone.utc)

        event = NormalizedEvent(
            event_id=self.TEST_EVENT_ID,
            event_type="payment.captured",
            payment_id="pay_test_model_01",
            order_id="order_test_model_01",
            event_timestamp=now,
            source="webhook",
            status="captured",
            delivery_status="delivered",
            payload_hash="abc123def456" + "0" * 52,  # 64-char placeholder
            signature_valid=True,
            raw_payload={"entity": "event", "event": "payment.captured"},
        )
        db_session.add(event)
        db_session.commit()
        db_session.refresh(event)

        # --- retrieve ---
        retrieved = (
            db_session.query(NormalizedEvent)
            .filter(NormalizedEvent.event_id == self.TEST_EVENT_ID)
            .one()
        )

        assert retrieved.event_id == self.TEST_EVENT_ID
        assert retrieved.event_type == "payment.captured"
        assert retrieved.payment_id == "pay_test_model_01"
        assert retrieved.order_id == "order_test_model_01"
        assert retrieved.source == "webhook"
        assert retrieved.status == "captured"
        assert retrieved.delivery_status == "delivered"
        assert retrieved.signature_valid is True
        assert retrieved.raw_payload["event"] == "payment.captured"
        assert retrieved.ingestion_timestamp is not None
        assert retrieved.id is not None

        # --- cleanup ---
        db_session.delete(retrieved)
        db_session.commit()


class TestPaymentStateModel:
    """Insert a PaymentState, retrieve it, assert all fields round-trip."""

    TEST_PAYMENT_ID = f"pay_test_ps_{uuid.uuid4().hex[:10]}"

    def test_insert_and_retrieve_payment_state(self, db_session):
        state = PaymentState(
            payment_id=self.TEST_PAYMENT_ID,
            order_id="order_test_ps_01",
            current_state="captured",
            state_history=[
                {
                    "state": "authorized",
                    "timestamp": "2026-09-03T10:00:00Z",
                    "event_id": "evt_auth_001",
                },
                {
                    "state": "captured",
                    "timestamp": "2026-09-03T10:05:00Z",
                    "event_id": "evt_cap_001",
                },
            ],
        )
        db_session.add(state)
        db_session.commit()
        db_session.refresh(state)

        # --- retrieve ---
        retrieved = (
            db_session.query(PaymentState)
            .filter(PaymentState.payment_id == self.TEST_PAYMENT_ID)
            .one()
        )

        assert retrieved.payment_id == self.TEST_PAYMENT_ID
        assert retrieved.order_id == "order_test_ps_01"
        assert retrieved.current_state == "captured"
        assert isinstance(retrieved.state_history, list)
        assert len(retrieved.state_history) == 2
        assert retrieved.state_history[0]["state"] == "authorized"
        assert retrieved.state_history[1]["state"] == "captured"
        assert retrieved.last_updated is not None
        assert retrieved.id is not None

        # --- cleanup ---
        db_session.delete(retrieved)
        db_session.commit()
