import os
import sys
import uuid
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.main import app
from app.database import get_db, Base, get_engine
from app.models import Incident, PaymentState

client = TestClient(app)


@pytest.fixture(scope="module")
def setup_test_incident():
    """Create a real persisted incident in the test database for testing workflows."""
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    db = next(get_db())

    test_payment_id = f"pay_wf6_{uuid.uuid4().hex[:8]}"
    test_order_id = f"order_wf6_{uuid.uuid4().hex[:8]}"

    incident = Incident(
        payment_id=test_payment_id,
        order_id=test_order_id,
        incident_type="invalid_transition",
        severity="HIGH",
        description="Payment captured without prior authorization event",
        evidence_ids=["evt_001", "evt_002"],
        operational_status="OPEN",
        priority="MEDIUM",
        tags=["webhook", "delayed"],
        assignee=None,
        resolved=False,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    incident_id = str(incident.id)
    db.close()

    yield {
        "incident_id": incident_id,
        "payment_id": test_payment_id,
        "order_id": test_order_id,
    }

    # Teardown
    db = next(get_db())
    db.query(Incident).filter(Incident.payment_id == test_payment_id).delete()
    db.commit()
    db.close()


def test_default_status_and_read(setup_test_incident):
    info = setup_test_incident
    resp = client.get(f"/incidents?payment_id={info['payment_id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    inc = data[0]
    assert inc["operational_status"] == "OPEN"
    assert inc["priority"] == "MEDIUM"
    assert inc["resolved"] is False
    assert inc["resolved_at"] is None
    assert inc["tags"] == ["webhook", "delayed"]
    assert inc["assignee"] is None


def test_status_transitions_workflow(setup_test_incident):
    info = setup_test_incident
    pid = info["payment_id"]

    # 1. Transition OPEN -> INVESTIGATING
    resp = client.patch(
        f"/incidents/{pid}/status",
        json={"status": "INVESTIGATING", "actor": "Alice Investigator", "notes": "Beginning log triage"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["operational_status"] == "INVESTIGATING"
    assert data["resolved"] is False

    # 2. Transition INVESTIGATING -> ACTION_REQUIRED
    resp = client.patch(
        f"/incidents/{pid}/status",
        json={"status": "ACTION_REQUIRED", "actor": "Alice Investigator", "notes": "Merchant webhook failed"},
    )
    assert resp.status_code == 200
    assert resp.json()["operational_status"] == "ACTION_REQUIRED"

    # 3. Transition ACTION_REQUIRED -> RESOLVED
    resp = client.patch(
        f"/incidents/{pid}/status",
        json={"status": "RESOLVED", "actor": "Lead Engineer", "notes": "Webhook endpoint recovered"},
    )
    assert resp.status_code == 200
    resolved_data = resp.json()
    assert resolved_data["operational_status"] == "RESOLVED"
    assert resolved_data["resolved"] is True
    assert resolved_data["resolved_at"] is not None

    # 4. Reopen via /reopen endpoint
    resp_reopen = client.post(f"/incidents/{pid}/reopen?actor=Lead Engineer")
    assert resp_reopen.status_code == 200
    assert resp_reopen.json()["resolved"] is False
    assert resp_reopen.json()["operational_status"] == "OPEN"

    # Verify via GET
    get_resp = client.get(f"/incidents?payment_id={pid}")
    assert get_resp.json()[0]["operational_status"] == "OPEN"
    assert get_resp.json()[0]["resolved"] is False


def test_invalid_status_rejected(setup_test_incident):
    info = setup_test_incident
    pid = info["payment_id"]

    resp = client.patch(
        f"/incidents/{pid}/status",
        json={"status": "INVALID_STATUS_FOO"},
    )
    assert resp.status_code == 422
    assert "Invalid operational status" in resp.json()["detail"]


def test_priority_updates_workflow(setup_test_incident):
    info = setup_test_incident
    pid = info["payment_id"]

    # Update to CRITICAL
    resp = client.patch(
        f"/incidents/{pid}/priority",
        json={"priority": "CRITICAL", "actor": "Incident Manager"},
    )
    assert resp.status_code == 200
    assert resp.json()["priority"] == "CRITICAL"

    # Update to LOW
    resp2 = client.patch(
        f"/incidents/{pid}/priority",
        json={"priority": "low", "actor": "Incident Manager"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["priority"] == "LOW"

    # Invalid priority
    resp_inv = client.patch(
        f"/incidents/{pid}/priority",
        json={"priority": "EXTREME"},
    )
    assert resp_inv.status_code == 422
    assert "Invalid operational priority" in resp_inv.json()["detail"]


def test_tags_workflow(setup_test_incident):
    info = setup_test_incident
    pid = info["payment_id"]

    # Add tag "merchant-action"
    resp = client.post(
        f"/incidents/{pid}/tags",
        json={"tag": "merchant-action", "actor": "Operator"},
    )
    assert resp.status_code == 200
    assert "merchant-action" in resp.json()["tags"]

    # Duplicate tag should be ignored idempotently (not duplicated in list)
    resp_dup = client.post(
        f"/incidents/{pid}/tags",
        json={"tag": "MERCHANT-ACTION", "actor": "Operator"},
    )
    assert resp_dup.status_code == 200
    tags_list = resp_dup.json()["tags"]
    assert tags_list.count("merchant-action") == 1

    # Remove tag
    resp_del = client.delete(f"/incidents/{pid}/tags/merchant-action?actor=Operator")
    assert resp_del.status_code == 200
    assert "merchant-action" not in resp_del.json()["tags"]

    # Invalid tag (spaces or special characters)
    resp_inv = client.post(
        f"/incidents/{pid}/tags",
        json={"tag": "bad tag!@#"},
    )
    assert resp_inv.status_code == 422


def test_assignee_workflow(setup_test_incident):
    info = setup_test_incident
    pid = info["payment_id"]

    # Assign
    resp = client.patch(
        f"/incidents/{pid}/assignee",
        json={"assignee": "Alex Support", "actor": "Team Lead"},
    )
    assert resp.status_code == 200
    assert resp.json()["assignee"] == "Alex Support"

    # Clear Assignee
    resp_clear = client.patch(
        f"/incidents/{pid}/assignee",
        json={"assignee": None, "actor": "Team Lead"},
    )
    assert resp_clear.status_code == 200
    assert resp_clear.json()["assignee"] is None


def test_workflow_history_audit(setup_test_incident):
    info = setup_test_incident
    pid = info["payment_id"]

    resp = client.get(f"/incidents/{pid}/history")
    assert resp.status_code == 200
    history = resp.json()
    assert isinstance(history, list)
    assert len(history) > 0

    # Ensure each audit entry has mandatory structure
    first_entry = history[0]
    assert "id" in first_entry
    assert "action" in first_entry
    assert "timestamp" in first_entry
    assert "actor" in first_entry


def test_notes_validation(setup_test_incident):
    info = setup_test_incident
    pid = info["payment_id"]

    # Valid note
    resp = client.post(
        f"/incidents/{pid}/notes",
        json={"author": "Dev", "note_text": "Customer confirmed webhook delay in production."},
    )
    assert resp.status_code == 200
    assert resp.json()["note_text"] == "Customer confirmed webhook delay in production."

    # Empty note rejected
    resp_empty = client.post(
        f"/incidents/{pid}/notes",
        json={"author": "Dev", "note_text": "   "},
    )
    assert resp_empty.status_code == 422

    # Oversized note rejected (>2048 chars)
    resp_oversized = client.post(
        f"/incidents/{pid}/notes",
        json={"author": "Dev", "note_text": "x" * 2050},
    )
    assert resp_oversized.status_code == 422


def test_truth_separation_operational_vs_financial_state(setup_test_incident):
    """
    Verify safety invariant: Operational resolution must never mutate payment state truth.
    An incident may be operationally RESOLVED while the payment remains failed.
    """
    info = setup_test_incident
    pid = info["payment_id"]

    db = next(get_db())
    # Create an authoritative payment state as 'failed'
    p_state = PaymentState(
        payment_id=pid,
        order_id=info["order_id"],
        current_state="failed",
        state_history=[{"state": "failed", "event_id": "evt_001"}],
    )
    db.add(p_state)
    db.commit()

    # Operationally resolve incident
    resp_resolve = client.post(
        f"/incidents/{pid}/resolve",
        json={"resolution_notes": "Operator resolved: merchant advised to initiate retry."},
    )
    assert resp_resolve.status_code == 200
    assert resp_resolve.json()["resolved"] is True
    assert resp_resolve.json()["operational_status"] == "RESOLVED"

    # Payment state in DB MUST remain 'failed'
    re_state = db.query(PaymentState).filter(PaymentState.payment_id == pid).first()
    assert re_state is not None
    assert re_state.current_state == "failed"

    db.query(PaymentState).filter(PaymentState.payment_id == pid).delete()
    db.commit()
    db.close()


def test_missing_incident_returns_404():
    non_existent = f"pay_non_existent_{uuid.uuid4().hex[:8]}"

    # Patch status on non-existent
    resp = client.patch(
        f"/incidents/{non_existent}/status",
        json={"status": "INVESTIGATING"},
    )
    assert resp.status_code == 404

    # Patch priority on non-existent
    resp_p = client.patch(
        f"/incidents/{non_existent}/priority",
        json={"priority": "HIGH"},
    )
    assert resp_p.status_code == 404

    # Add tag on non-existent
    resp_t = client.post(
        f"/incidents/{non_existent}/tags",
        json={"tag": "webhook"},
    )
    assert resp_t.status_code == 404

    # Get history on non-existent
    resp_h = client.get(f"/incidents/{non_existent}/history")
    assert resp_h.status_code == 404
