"""
tests/test_incident_persistence.py

Live integration tests for the Incident model against Supabase PostgreSQL.
Requires DATABASE_URL in environment.
"""
import os
import sys
import uuid
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models import Incident  # noqa: F401 — registers table


@pytest.fixture(scope="module")
def db_session():
    db_url = settings.sqlalchemy_database_uri
    if not db_url:
        pytest.skip("DATABASE_URL not configured — skipping live DB test")

    engine = create_engine(db_url, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)

    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = Session()
    yield session
    session.close()


class TestIncidentPersistence:
    TEST_PAYMENT_ID = f"pay_inc_test_{uuid.uuid4().hex[:10]}"

    def test_insert_and_retrieve_incident(self, db_session):
        row = Incident(
            payment_id=self.TEST_PAYMENT_ID,
            order_id="order_inc_test_001",
            incident_type="duplicate_webhook",
            severity="HIGH",
            description="Test duplicate webhook incident",
            evidence_ids=["evt_test_001", "evt_test_002"],
        )
        db_session.add(row)
        db_session.commit()
        db_session.refresh(row)

        retrieved = (
            db_session.query(Incident)
            .filter(Incident.payment_id == self.TEST_PAYMENT_ID)
            .one()
        )

        assert retrieved.payment_id == self.TEST_PAYMENT_ID
        assert retrieved.order_id == "order_inc_test_001"
        assert retrieved.incident_type == "duplicate_webhook"
        assert retrieved.severity == "HIGH"
        assert retrieved.description == "Test duplicate webhook incident"
        assert isinstance(retrieved.evidence_ids, list)
        assert "evt_test_001" in retrieved.evidence_ids
        assert retrieved.detected_at is not None
        assert retrieved.id is not None

        # cleanup
        db_session.delete(retrieved)
        db_session.commit()

    def test_resolved_defaults_false(self, db_session):
        row = Incident(
            payment_id=f"pay_default_{uuid.uuid4().hex[:8]}",
            incident_type="missing_evidence",
            severity="LOW",
            description="Default resolved test",
            evidence_ids=[],
        )
        db_session.add(row)
        db_session.commit()
        db_session.refresh(row)

        assert row.resolved is False

        # cleanup
        db_session.delete(row)
        db_session.commit()
