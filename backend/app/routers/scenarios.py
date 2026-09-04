import datetime
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models import NormalizedEvent
from app.event_parser import parse_webhook_to_normalized_event
from app.state_reconstructor import reconstruct_payment_state
from app.incident_detector import detect_incidents, IncidentReport
from app.authoritative_rules import apply_authoritative_rules
from app.ai_activation_gate import should_activate_ai
from app.evidence_package import build_evidence_package
from app.gemini_investigator import investigate
from app.claim_verifier import verify_claims
from app.confidence_engine import compute_confidence

logger = logging.getLogger("paytrace.scenarios")

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


class ScenarioReplayRequest(BaseModel):
    scenario_id: str


def _find_scenario_file(scenario_id: str) -> Optional[Path]:
    """
    Search for scenario fixture JSON by scenario_id in expected scenario directories.
    """
    candidate_dirs = [
        Path(__file__).resolve().parents[3] / "scenarios",
        Path(__file__).resolve().parents[2] / "scenarios",
        Path.cwd() / "scenarios",
        Path.cwd().parent / "scenarios",
    ]

    for d in candidate_dirs:
        if not d.is_dir():
            continue

        # 1. Exact filename match: scenario_id.json
        exact_path = d / f"{scenario_id}.json"
        if exact_path.is_file():
            return exact_path

        # 2. Files starting with scenario_id_ (e.g., scenario_01_clean_capture.json)
        prefix_matches = list(d.glob(f"{scenario_id}_*.json"))
        if prefix_matches:
            return prefix_matches[0]

        # 3. Inspect JSON contents for matching scenario_id
        for json_file in d.glob("*.json"):
            try:
                content = json.loads(json_file.read_text(encoding="utf-8"))
                if content.get("scenario_id") == scenario_id:
                    return json_file
            except Exception:
                continue

    return None


@router.get("")
def list_scenarios() -> List[Dict[str, Any]]:
    """
    List all available scenario fixtures with their metadata.
    """
    candidate_dirs = [
        Path(__file__).resolve().parents[3] / "scenarios",
        Path(__file__).resolve().parents[2] / "scenarios",
        Path.cwd() / "scenarios",
        Path.cwd().parent / "scenarios",
    ]

    scenarios = {}
    for d in candidate_dirs:
        if not d.is_dir():
            continue
        for json_file in sorted(d.glob("*.json")):
            try:
                data = json.loads(json_file.read_text(encoding="utf-8"))
                sid = data.get("scenario_id")
                if sid and sid not in scenarios:
                    scenarios[sid] = {
                        "scenario_id": sid,
                        "name": data.get("name", sid),
                        "description": data.get("description", ""),
                        "category": data.get("category", "General"),
                        "ground_truth": data.get("ground_truth", {}),
                        "events_count": len(data.get("events", [])),
                    }
            except Exception:
                continue

    return sorted(list(scenarios.values()), key=lambda x: x["scenario_id"])


@router.post("/replay")
def replay_scenario(request: ScenarioReplayRequest) -> Dict[str, Any]:
    """
    Replay a canned scenario fixture through the full PayTrace pipeline in-memory.
    No database reads or writes are performed during replay.
    """
    scenario_file = _find_scenario_file(request.scenario_id)
    if not scenario_file:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{request.scenario_id}' not found",
        )

    try:
        fixture_data: Dict[str, Any] = json.loads(scenario_file.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read scenario fixture: {str(e)}",
        )

    # ── 1. Parse events in-memory with field overrides ──────────────────────
    raw_events: List[Dict[str, Any]] = fixture_data.get("events", [])
    if not raw_events:
        raise HTTPException(
            status_code=400,
            detail=f"Scenario '{request.scenario_id}' has no events to replay",
        )

    parsed_events: List[NormalizedEvent] = []
    for ev_data in raw_events:
        event = parse_webhook_to_normalized_event(ev_data, signature_valid=True)
        # Override event_id and event_timestamp from fixture fields
        if "id" in ev_data and ev_data["id"]:
            event.event_id = str(ev_data["id"])
        if "created_at" in ev_data and ev_data["created_at"] is not None:
            created_at = ev_data["created_at"]
            if isinstance(created_at, (int, float)):
                event.event_timestamp = datetime.datetime.fromtimestamp(
                    created_at, datetime.timezone.utc
                )
            elif isinstance(created_at, str):
                event.event_timestamp = datetime.datetime.fromisoformat(created_at)
        parsed_events.append(event)

    # ── 2. Run full pipeline in-memory: reconstruct & detect incidents ──────
    all_incidents: List[IncidentReport] = []
    seen_events: List[NormalizedEvent] = []

    for event in parsed_events:
        partial_state = reconstruct_payment_state(seen_events + [event])
        incidents = detect_incidents(
            event,
            seen_events,
            partial_state.state_history,
            signature_valid=True,
        )
        all_incidents.extend(incidents)
        seen_events.append(event)

    reconstructed_state = reconstruct_payment_state(parsed_events)
    payment_id: str = reconstructed_state.payment_id or "unknown"

    # ── 3. Authoritative rules ──────────────────────────────────────────────
    authoritative_result: Dict[str, Any] = apply_authoritative_rules(
        reconstructed_state,
        all_incidents,
    )

    # ── 4. AI activation gate ───────────────────────────────────────────────
    ai_activated, activation_reason = should_activate_ai(
        authoritative_result,
        all_incidents,
        parsed_events,
    )

    # ── 5. Evidence package & investigation (if activated) ──────────────────
    verified_claims_list = []
    if ai_activated:
        evidence_package = build_evidence_package(
            payment_id,
            parsed_events,
            reconstructed_state,
            all_incidents,
        )
        investigation_result = investigate(evidence_package)
        if "error" not in investigation_result:
            raw_claims = investigation_result.get("claims", [])
            verified_claims_list = verify_claims(raw_claims, evidence_package)

    # ── 6. Compute confidence ───────────────────────────────────────────────
    confidence_res = compute_confidence(
        verified_claims_list,
        all_incidents,
        authoritative_result,
        ai_activated,
    )

    if (
        not ai_activated
        and authoritative_result.get("confidence_hint") == "HIGH"
    ):
        confidence_level: str = "HIGH"
        abstained: bool = False
    else:
        confidence_level = str(confidence_res.get("level", "INCONCLUSIVE"))
        abstained = bool(confidence_res.get("abstain", True))

    incident_type_list: List[str] = list(
        dict.fromkeys(i.incident_type for i in all_incidents)
    )
    actual_state: str = reconstructed_state.current_state or "unknown"

    actual: Dict[str, Any] = {
        "state": actual_state,
        "incidents": incident_type_list,
        "ai_activated": ai_activated,
        "confidence": confidence_level,
        "abstained": abstained,
    }

    # ── 7. Compare actual vs ground_truth ───────────────────────────────────
    ground_truth: Dict[str, Any] = fixture_data.get("ground_truth", {})
    mismatches: List[str] = []

    expected_state = ground_truth.get("expected_state")
    if expected_state is not None and actual["state"] != expected_state:
        mismatches.append(
            f"state mismatch: expected {expected_state}, got {actual['state']}"
        )

    expected_incidents = ground_truth.get("expected_incidents")
    if expected_incidents is not None and set(actual["incidents"]) != set(
        expected_incidents
    ):
        mismatches.append(
            f"incidents mismatch: expected {expected_incidents}, got {actual['incidents']}"
        )

    expected_ai = ground_truth.get("expected_ai_activated")
    if expected_ai is not None and actual["ai_activated"] != expected_ai:
        mismatches.append(
            f"ai_activated mismatch: expected {expected_ai}, got {actual['ai_activated']}"
        )

    expected_confidence = ground_truth.get("expected_confidence")
    if expected_confidence is not None and actual["confidence"] != expected_confidence:
        mismatches.append(
            f"confidence mismatch: expected {expected_confidence}, got {actual['confidence']}"
        )

    expected_abstain = ground_truth.get("expected_abstain")
    if expected_abstain is not None and actual["abstained"] != expected_abstain:
        mismatches.append(
            f"abstained mismatch: expected {expected_abstain}, got {actual['abstained']}"
        )

    passed: bool = len(mismatches) == 0

    return {
        "scenario_id": fixture_data.get("scenario_id", request.scenario_id),
        "name": fixture_data.get("name", ""),
        "description": fixture_data.get("description", ""),
        "ground_truth": ground_truth,
        "actual": actual,
        "passed": passed,
        "mismatches": mismatches,
    }
