import os
import sys
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.config import Settings
from app.main import app

client = TestClient(app)


def test_settings_url_normalization():
    s = Settings()
    s.DATABASE_URL = "postgres://user:pass@host:5432/dbname"
    assert s.sqlalchemy_database_uri == "postgresql://user:pass@host:5432/dbname"

    s.DATABASE_URL = "postgresql://user:pass@host:5432/dbname"
    assert s.sqlalchemy_database_uri == "postgresql://user:pass@host:5432/dbname"


def test_health_with_unconfigured_db_structure():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data
    assert "connected" in data["database"]
