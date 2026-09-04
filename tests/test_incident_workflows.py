import os
import sys
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_resolve_and_reopen_workflow():
    test_pid = f"pay_wf_test_{uuid.uuid4().hex[:8]}"

    # Resolve
    resp = client.post(
        f"/incidents/{test_pid}/resolve",
        json={"resolution_notes": "Resolved following merchant log inspection."}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "resolved"
    assert data["resolved"] is True
    assert data["payment_id"] == test_pid

    # Reopen
    resp_reopen = client.post(f"/incidents/{test_pid}/reopen")
    assert resp_reopen.status_code == 200
    reopen_data = resp_reopen.json()
    assert reopen_data["status"] == "reopened"
    assert reopen_data["resolved"] is False

def test_incident_notes_workflow():
    test_pid = f"pay_notes_test_{uuid.uuid4().hex[:8]}"

    # Add Note 1
    resp1 = client.post(
        f"/incidents/{test_pid}/notes",
        json={"author": "animesh@example.com", "note_text": "Verified capture delivery delayed by 12m56s."}
    )
    assert resp1.status_code == 200
    note1 = resp1.json()
    assert note1["payment_id"] == test_pid
    assert note1["author"] == "animesh@example.com"
    assert "Verified capture" in note1["note_text"]

    # Add Note 2
    resp2 = client.post(
        f"/incidents/{test_pid}/notes",
        json={"author": "Lead Investigator", "note_text": "Merchant reconciliation confirmed."}
    )
    assert resp2.status_code == 200

    # Retrieve Notes
    resp_list = client.get(f"/incidents/{test_pid}/notes")
    assert resp_list.status_code == 200
    notes_list = resp_list.json()
    assert len(notes_list) == 2
    assert notes_list[0]["payment_id"] == test_pid
