import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import app.gemini_investigator as gi
from app.gemini_investigator import investigate

MINIMAL_EVIDENCE_PACKAGE = {
    "payment_id": "pay_test",
    "evidence_id": "pkg-001",
    "generated_at": "2026-01-01T00:00:00Z",
    "events": [],
    "reconstructed_state": {
        "payment_id": "pay_test",
        "current_state": "unknown",
        "state_history": [],
    },
    "incidents": [],
    "missing_evidence_hint": None,
}


def test_gemini_unavailable_returns_error_dict():
    """Test 1: Patch generate_content to raise Exception and assert error dictionary."""
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("API down")
    with patch.object(gi, "client", mock_client):
        result = investigate(MINIMAL_EVIDENCE_PACKAGE)
        assert result["error"] == "gemini_unavailable"
        assert "detail" in result


def test_structured_output_failure_returns_error_dict():
    """Test 2: Patch generate_content to return invalid json text and assert structured_output_failure."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "```json\nnot valid json\n```"
    mock_client.models.generate_content.return_value = mock_response
    with patch.object(gi, "client", mock_client):
        result = investigate(MINIMAL_EVIDENCE_PACKAGE)
        assert result["error"] == "structured_output_failure"
        assert "raw" in result
