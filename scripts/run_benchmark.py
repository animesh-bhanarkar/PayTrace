#!/usr/bin/env python3
"""
scripts/run_benchmark.py
========================
PayTrace Controlled Benchmark Runner

Executes every scenario fixture through three evaluation modes:
  1. Full pipeline  — the deployed PayTrace pipeline (state machine → gate →
                      AI investigator → verifier → confidence)
  2. Baseline A     — deterministic/rules-only (AI never activated, gate
                      forced to False)
  3. Baseline B1    — raw LLM call, same evidence package, no verifier /
                      confidence layer (gate forced to True, verifier skipped,
                      confidence set to LLM-reported uncertainty only)

No live Gemini API calls are made.  Baseline B1 stubs the LLM response with a
fixed HIGH-confidence claim so the structural comparison is meaningful without
burning quota.

Metrics recorded per scenario per mode
---------------------------------------
  root_cause_match    — did the detected incidents match ground truth? (bool)
  ai_activated        — was AI activated? (bool)
  confidence          — reported confidence level string
  abstained           — did the pipeline abstain? (bool)
  passed              — did actual == ground_truth? (bool, from replay endpoint)
  latency_ms          — wall-clock time for the pipeline call (ms, indicative only)

Run:
  cd <repo-root>
  python scripts/run_benchmark.py [--scenarios-dir scenarios] [--output results/benchmark.json]

"""

import argparse
import json
import os
import sys
import time
import pathlib
import datetime
from typing import Any, Dict, List, Optional
from unittest.mock import patch

# ── path bootstrap ────────────────────────────────────────────────────────────
_REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT / "backend"))

from fastapi.testclient import TestClient
from app.main import app

# ── constants ─────────────────────────────────────────────────────────────────
_STUB_INVESTIGATION = {
    "hypothesis": "Stub investigation for benchmark baseline.",
    "claims": [
        {
            "claim_id": "stub_C1",
            "statement": "Stub claim for benchmark.",
            "evidence_ids": [],
            "counter_evidence_ids": [],
            "confidence": "HIGH",
        }
    ],
    "recommended_next_step": "Stub — no action.",
    "uncertainty": "LOW",
}

_MODES = ["full_pipeline", "baseline_a", "baseline_b1"]


# ── helpers ───────────────────────────────────────────────────────────────────

def _load_scenarios(scenarios_dir: pathlib.Path) -> List[Dict[str, Any]]:
    """Load and return all scenario fixtures sorted by scenario_id."""
    scenarios = []
    for jf in sorted(scenarios_dir.glob("*.json")):
        try:
            data = json.loads(jf.read_text(encoding="utf-8"))
            if "scenario_id" in data and "ground_truth" in data:
                scenarios.append(data)
        except Exception as e:
            print(f"  [WARN] Could not load {jf.name}: {e}")
    return scenarios


def _run_replay(client: TestClient, scenario_id: str) -> Dict[str, Any]:
    """POST /scenarios/replay and return parsed JSON."""
    resp = client.post("/scenarios/replay", json={"scenario_id": scenario_id})
    if resp.status_code != 200:
        return {"error": f"HTTP {resp.status_code}", "body": resp.text[:500]}
    return resp.json()


def _extract_metrics(data: Dict[str, Any], ground_truth: Dict[str, Any]) -> Dict[str, Any]:
    """Pull the fields we care about from a replay response."""
    if "error" in data:
        return {"error": data["error"]}

    actual = data.get("actual", {})
    expected_incidents = set(ground_truth.get("expected_incidents") or [])
    actual_incidents = set(actual.get("incidents") or [])

    return {
        "passed": data.get("passed", False),
        "root_cause_match": actual_incidents == expected_incidents,
        "ai_activated": actual.get("ai_activated"),
        "confidence": actual.get("confidence"),
        "abstained": actual.get("abstained"),
        "actual_state": actual.get("state"),
        "actual_incidents": list(actual_incidents),
        "mismatches": data.get("mismatches", []),
    }


# ── mode runners ──────────────────────────────────────────────────────────────

def run_full_pipeline(
    client: TestClient,
    scenario: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Full pipeline: AI is mocked with a stub so no Gemini quota is used,
    but all pipeline stages run (gate, verifier, confidence engine).
    This reflects the same structural path as production.
    """
    t0 = time.perf_counter()
    with patch("app.routers.scenarios.investigate", return_value=_STUB_INVESTIGATION):
        data = _run_replay(client, scenario["scenario_id"])
    latency_ms = round((time.perf_counter() - t0) * 1000, 1)

    metrics = _extract_metrics(data, scenario["ground_truth"])
    metrics["latency_ms"] = latency_ms
    return metrics


def run_baseline_a(
    client: TestClient,
    scenario: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Baseline A — rules only.
    Force the AI gate to always return False so investigate() is never called.
    Confidence is whatever the deterministic engine produces with no AI.
    """
    t0 = time.perf_counter()
    with patch("app.routers.scenarios.should_activate_ai", return_value=(False, "baseline_a: AI disabled")):
        data = _run_replay(client, scenario["scenario_id"])
    latency_ms = round((time.perf_counter() - t0) * 1000, 1)

    metrics = _extract_metrics(data, scenario["ground_truth"])
    metrics["latency_ms"] = latency_ms
    return metrics


def run_baseline_b1(
    client: TestClient,
    scenario: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Baseline B1 — raw LLM, no verifier / confidence layer.
    Force the AI gate to always return True (AI always activated),
    stub the investigation so no real Gemini call happens,
    patch verify_claims to return raw unverified claims,
    and patch compute_confidence to return a fixed HIGH/no-abstain result
    (simulating raw LLM confidence with no evidence cross-check).
    """
    from app.claim_verifier import VerifiedClaim  # local import

    def _stub_verify(claims, _evidence_package):
        """Return all claims as SUPPORTED with HIGH confidence (no cross-check)."""
        result = []
        for c in claims:
            result.append(
                VerifiedClaim(
                    claim_id=c.get("claim_id", "stub"),
                    statement=c.get("statement", ""),
                    verdict="SUPPORTED",
                    rejection_reason=None,
                    evidence_ids=c.get("evidence_ids", []),
                    confidence="HIGH",
                )
            )
        return result

    def _stub_confidence(_verified_claims, _incidents, _authoritative, _ai_activated):
        return {"level": "HIGH", "score": 1.0, "abstain": False, "reason": "baseline_b1 stub"}

    t0 = time.perf_counter()
    with (
        patch("app.routers.scenarios.should_activate_ai", return_value=(True, "baseline_b1: AI always on")),
        patch("app.routers.scenarios.investigate", return_value=_STUB_INVESTIGATION),
        patch("app.routers.scenarios.verify_claims", side_effect=_stub_verify),
        patch("app.routers.scenarios.compute_confidence", side_effect=_stub_confidence),
    ):
        data = _run_replay(client, scenario["scenario_id"])
    latency_ms = round((time.perf_counter() - t0) * 1000, 1)

    metrics = _extract_metrics(data, scenario["ground_truth"])
    metrics["latency_ms"] = latency_ms
    return metrics


# ── reporting ─────────────────────────────────────────────────────────────────

def _aggregate(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute aggregate stats across all scenarios for one mode."""
    total = len(results)
    if total == 0:
        return {}
    passed = sum(1 for r in results if r.get("passed"))
    root_cause_match = sum(1 for r in results if r.get("root_cause_match"))
    ai_on = sum(1 for r in results if r.get("ai_activated"))
    abstained = sum(1 for r in results if r.get("abstained"))
    latencies = [r["latency_ms"] for r in results if "latency_ms" in r]
    return {
        "total_scenarios": total,
        "passed": passed,
        "pass_rate": round(passed / total, 3),
        "root_cause_match": root_cause_match,
        "root_cause_match_rate": round(root_cause_match / total, 3),
        "ai_activated_count": ai_on,
        "abstention_count": abstained,
        "abstention_rate": round(abstained / total, 3),
        "avg_latency_ms": round(sum(latencies) / len(latencies), 1) if latencies else None,
        "note": (
            "Latency figures are indicative only (in-process TestClient, not network-round-trip). "
            "Not a measured production study."
        ),
    }


def _print_table(all_results: Dict[str, Dict[str, List]], scenarios: List[Dict]) -> None:
    """Print a human-readable summary table."""
    col_w = 14
    sid_w = 14
    header = f"{'Scenario':<{sid_w}}" + "".join(f"{'Mode':>{col_w}}" for _ in _MODES)
    # Actually build a proper table
    print()
    print("=" * 80)
    print("PAYTRACE BENCHMARK RESULTS")
    print(f"Generated: {datetime.datetime.now(datetime.timezone.utc).isoformat()} UTC")
    print("=" * 80)

    print(f"\n{'Scenario':<16} {'Full Pipeline':^22} {'Baseline A':^22} {'Baseline B1':^22}")
    print(f"{'':16} {'pass/rc_match/conf':^22} {'pass/rc_match/conf':^22} {'pass/rc_match/conf':^22}")
    print("-" * 82)

    for s in scenarios:
        sid = s["scenario_id"]
        row = f"{sid:<16}"
        for mode in _MODES:
            r = all_results[mode].get(sid, {})
            if "error" in r:
                cell = f"ERR"
            else:
                p = "P" if r.get("passed") else "F"
                rc = "Y" if r.get("root_cause_match") else "N"
                conf = (r.get("confidence") or "?")[:4]
                cell = f"{p}/{rc}/{conf}"
            row += f"  {cell:^20}"
        print(row)

    print("-" * 82)
    print()

    for mode in _MODES:
        agg = _aggregate(list(all_results[mode].values()))
        print(f"[{mode}]")
        print(f"  Pass rate:              {agg.get('pass_rate', 0):.1%}  ({agg.get('passed')}/{agg.get('total_scenarios')})")
        print(f"  Root-cause match rate:  {agg.get('root_cause_match_rate', 0):.1%}  ({agg.get('root_cause_match')}/{agg.get('total_scenarios')})")
        print(f"  AI activated:           {agg.get('ai_activated_count')}/{agg.get('total_scenarios')}")
        print(f"  Abstention rate:        {agg.get('abstention_rate', 0):.1%}  ({agg.get('abstention_count')}/{agg.get('total_scenarios')})")
        print(f"  Avg latency (indicative): {agg.get('avg_latency_ms')} ms")
        print()


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="PayTrace Benchmark Runner")
    parser.add_argument(
        "--scenarios-dir",
        default=str(_REPO_ROOT / "scenarios"),
        help="Path to scenario fixtures directory (default: <repo-root>/scenarios)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional path to write JSON results file (e.g. results/benchmark.json)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print per-scenario detail including mismatches",
    )
    args = parser.parse_args()

    scenarios_dir = pathlib.Path(args.scenarios_dir)
    if not scenarios_dir.is_dir():
        print(f"ERROR: scenarios directory not found: {scenarios_dir}")
        sys.exit(1)

    scenarios = _load_scenarios(scenarios_dir)
    if not scenarios:
        print(f"ERROR: no scenario fixtures found in {scenarios_dir}")
        sys.exit(1)

    print(f"Loaded {len(scenarios)} scenario(s) from {scenarios_dir}")
    print("Running benchmark — no live Gemini API calls are made.\n")

    client = TestClient(app)

    all_results: Dict[str, Dict[str, Any]] = {mode: {} for mode in _MODES}

    for s in scenarios:
        sid = s["scenario_id"]
        name = s.get("name", sid)
        print(f"  [{sid}] {name}")

        all_results["full_pipeline"][sid] = run_full_pipeline(client, s)
        all_results["baseline_a"][sid] = run_baseline_a(client, s)
        all_results["baseline_b1"][sid] = run_baseline_b1(client, s)

        if args.verbose:
            for mode in _MODES:
                r = all_results[mode][sid]
                status = "PASS" if r.get("passed") else "FAIL"
                print(f"    [{mode}] {status}  rc_match={r.get('root_cause_match')}  "
                      f"conf={r.get('confidence')}  abstain={r.get('abstained')}  "
                      f"latency={r.get('latency_ms')}ms")
                if r.get("mismatches"):
                    for m in r["mismatches"]:
                        print(f"      MISMATCH: {m}")

    _print_table(all_results, scenarios)

    # Aggregate for each mode
    aggregates = {mode: _aggregate(list(all_results[mode].values())) for mode in _MODES}

    # Write JSON output
    output_data = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
        "total_scenarios": len(scenarios),
        "scenario_ids": [s["scenario_id"] for s in scenarios],
        "aggregates": aggregates,
        "per_scenario": {
            sid: {mode: all_results[mode].get(sid, {}) for mode in _MODES}
            for sid in [s["scenario_id"] for s in scenarios]
        },
        "methodology_note": (
            "All three modes run in-process via FastAPI TestClient. "
            "No live Gemini API calls are made; the LLM response is stubbed "
            "with a fixed HIGH-confidence claim. Baseline A forces the AI gate "
            "to False. Baseline B1 forces it to True with verifier/confidence "
            "bypassed. Latency figures are indicative in-process timings only, "
            "not measured production latencies."
        ),
    }

    if args.output:
        out_path = pathlib.Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(output_data, indent=2), encoding="utf-8")
        print(f"\nJSON results written to: {out_path}")

    # Always write to results/ in repo root
    default_out = _REPO_ROOT / "results" / "benchmark.json"
    default_out.parent.mkdir(parents=True, exist_ok=True)
    default_out.write_text(json.dumps(output_data, indent=2), encoding="utf-8")
    print(f"JSON results written to: {default_out}")


if __name__ == "__main__":
    main()
