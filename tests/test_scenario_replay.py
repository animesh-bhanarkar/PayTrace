import sys
import os
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_scenario_01_clean_capture():
    """Scenario 01: Clean payment capture should pass all ground truth assertions."""
    response = client.post("/scenarios/replay", json={"scenario_id": "scenario_01"})
    assert response.status_code == 200
    data = response.json()
    assert data["passed"] is True
    assert data["mismatches"] == []
    assert data["actual"]["state"] == "captured"
    assert data["actual"]["ai_activated"] is False


def test_scenario_02_ai_activated():
    """Scenario 02: Missing payment.created triggers invalid transition and AI investigation."""
    response = client.post("/scenarios/replay", json={"scenario_id": "scenario_02"})
    assert response.status_code == 200
    data = response.json()
    assert data["actual"]["ai_activated"] is True


def test_scenario_03_duplicate_webhook():
    """Scenario 03: Duplicate payment.captured should detect duplicate_webhook incident."""
    response = client.post("/scenarios/replay", json={"scenario_id": "scenario_03"})
    assert response.status_code == 200
    data = response.json()
    assert "duplicate_webhook" in data["actual"]["incidents"]


def test_scenario_99_not_found():
    """Scenario 99: Unknown scenario_id should return HTTP 404."""
    response = client.post("/scenarios/replay", json={"scenario_id": "scenario_99"})
    assert response.status_code == 404
