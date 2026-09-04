import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_list_scenarios_endpoint():
    resp = client.get("/scenarios")
    assert resp.status_code == 200
    scenarios = resp.json()
    assert isinstance(scenarios, list)
    assert len(scenarios) >= 3
    s1 = scenarios[0]
    assert "scenario_id" in s1
    assert "name" in s1
    assert "ground_truth" in s1

def test_list_incidents_endpoint():
    resp = client.get("/incidents?limit=10")
    assert resp.status_code == 200
    incidents = resp.json()
    assert isinstance(incidents, list)
