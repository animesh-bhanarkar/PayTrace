import os
import sys
import uuid
import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, get_engine, Base
from app.models import Incident, NormalizedEvent

client = TestClient(app)

# Ensure tables exist
_engine = get_engine()
Base.metadata.create_all(bind=_engine)


def test_search_endpoint_returns_results_and_handles_filters():
    db_gen = get_db()
    db = next(db_gen)

    uniq = uuid.uuid4().hex[:8]
    test_payment_id = f"pay_search_{uniq}"
    test_event_id = f"evt_search_{uniq}"

    test_incident = Incident(
        payment_id=test_payment_id,
        order_id=f"order_search_{uniq}",
        incident_type="invalid_transition",
        severity="HIGH",
        description=f"Search test incident description {uniq}",
        evidence_ids=[test_event_id],
    )
    db.add(test_incident)

    test_event = NormalizedEvent(
        event_id=test_event_id,
        event_type="payment.failed",
        payment_id=test_payment_id,
        order_id=f"order_search_{uniq}",
        event_timestamp=datetime.datetime.now(datetime.timezone.utc),
        source="webhook",
        status="failed",
        signature_valid=True,
    )
    db.add(test_event)
    db.commit()

    # 1. Search with matching query
    res = client.get(f"/search?q={test_payment_id}")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    types = [item["type"] for item in data]
    assert "INCIDENT" in types or "EVENT" in types

    # 2. Filter by type=INCIDENT
    res_inc = client.get(f"/search?q={test_payment_id}&type_filter=INCIDENT")
    assert res_inc.status_code == 200
    data_inc = res_inc.json()
    assert all(item["type"] == "INCIDENT" for item in data_inc)

    # 3. Filter by type=EVENT
    res_ev = client.get(f"/search?q={test_payment_id}&type_filter=EVENT")
    assert res_ev.status_code == 200
    data_ev = res_ev.json()
    assert all(item["type"] == "EVENT" for item in data_ev)

    # 4. Search with non-existent query
    res_empty = client.get(f"/search?q=pay_non_existent_{uuid.uuid4().hex}")
    assert res_empty.status_code == 200
    assert res_empty.json() == []


def test_events_timeline_endpoint():
    db_gen = get_db()
    db = next(db_gen)

    now = datetime.datetime.now(datetime.timezone.utc)
    uniq = uuid.uuid4().hex[:8]
    ev1 = NormalizedEvent(
        event_id=f"evt_tl_{uniq}",
        event_type="payment.authorized",
        payment_id=f"pay_tl_{uniq}",
        order_id=f"order_tl_{uniq}",
        event_timestamp=now,
        source="webhook",
        status="authorized",
        signature_valid=True,
    )
    db.add(ev1)
    db.commit()

    res = client.get("/events/timeline?limit=10")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    assert len(items) >= 1
    first = items[0]
    assert "event_id" in first
    assert "event_type" in first
    assert "source" in first
    assert "signature_valid" in first

