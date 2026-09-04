"""
Deterministic Confidence Engine — PayTrace.

Phase 1-7: compute_confidence() — preserved exactly.
Phase 8: compute_advanced_confidence() — richer signals:
  - verified/unsupported/contradicted/partially-verified counts
  - causal chain verification rate
  - authoritative agreement
  - abstention_signal from AI
  - 6-outcome mapping

Architecture invariant:
  AI does NOT assign final confidence.
  AI may provide an abstention_signal as a reasoning hint.
  The deterministic engine makes the final confidence decision.
"""

from typing import List, Dict, Any
from app.claim_verifier import VerifiedClaim
from app.incident_detector import IncidentReport


# ── Phase 1-7 confidence engine (preserved exactly) ──────────────────────────

def compute_confidence(
    verified_claims: List[VerifiedClaim],
    incidents: List[IncidentReport],
    authoritative_result: Dict[str, Any],
    ai_activated: bool
) -> Dict[str, Any]:

    total_claims = len(verified_claims)
    supported_claims = [c for c in verified_claims if c.verdict == "SUPPORTED"]
    rejected_claims = [c for c in verified_claims if c.verdict == "REJECTED"]
    unverifiable_claims = [c for c in verified_claims if c.verdict == "UNVERIFIABLE"]

    supported_count = len(supported_claims)
    rejected_count = len(rejected_claims)

    high_incidents = [i for i in incidents if i.severity == "HIGH"]
    medium_incidents = [i for i in incidents if i.severity == "MEDIUM"]

    # Calculate base score
    if total_claims > 0:
        score = supported_count / total_claims
    else:
        score = 0.0

    # INCONCLUSIVE if ai_activated=True AND zero SUPPORTED claims
    if ai_activated and supported_count == 0:
        return {
            "level": "INCONCLUSIVE",
            "score": score,
            "reason": "AI activated but zero supported claims exist.",
            "abstain": True
        }

    # INCONCLUSIVE if ai_activated=True AND more than half of claims are REJECTED
    if ai_activated and total_claims > 0 and rejected_count > total_claims / 2:
        return {
            "level": "INCONCLUSIVE",
            "score": score,
            "reason": "AI activated and more than half of claims are rejected.",
            "abstain": True
        }

    # INCONCLUSIVE if confidence_hint == "LOW" AND all claims REJECTED or UNVERIFIABLE
    if authoritative_result.get("confidence_hint") == "LOW" and total_claims > 0 and (rejected_count + len(unverifiable_claims)) == total_claims:
        return {
            "level": "INCONCLUSIVE",
            "score": score,
            "reason": "Low authoritative confidence and all claims rejected or unverifiable.",
            "abstain": True
        }

    # INCONCLUSIVE if no claims and no incidents
    if not verified_claims and not incidents:
        return {
            "level": "INCONCLUSIVE",
            "score": 0.0,
            "reason": "No claims and no incidents present.",
            "abstain": True
        }

    # HIGH if ai_activated=False AND confidence_hint == "HIGH" AND no HIGH incidents
    if not ai_activated and authoritative_result.get("confidence_hint") == "HIGH" and len(high_incidents) == 0:
        return {
            "level": "HIGH",
            "score": 0.95,
            "reason": "AI not activated, authoritative confidence is HIGH, and no HIGH severity incidents.",
            "abstain": False
        }

    # MEDIUM
    if supported_count >= 1 and (total_claims == 0 or rejected_count <= total_claims / 2) and (len(medium_incidents) >= 1 or len(high_incidents) == 0):
        final_score = max(0.5, min(0.85, score))
        return {
            "level": "MEDIUM",
            "score": final_score,
            "reason": "Supported claims exist with manageable rejected claims and incidents.",
            "abstain": False
        }

    # LOW
    if (supported_count > 0 and rejected_count > 0) or authoritative_result.get("confidence_hint") == "LOW":
        final_score = max(0.2, min(0.49, score))
        return {
            "level": "LOW",
            "score": final_score,
            "reason": "Mixed claim verification results or LOW authoritative confidence.",
            "abstain": False
        }

    # Default fallback
    return {
        "level": "INCONCLUSIVE",
        "score": score,
        "reason": "Fallback: conditions for HIGH, MEDIUM, or LOW not fully met.",
        "abstain": True
    }


# ── Phase 8 advanced confidence engine ───────────────────────────────────────

def compute_advanced_confidence(
    advanced_claims: List[Dict[str, Any]],   # list of AdvancedVerifiedClaim.to_dict()
    hypothesis_verifications: List[Dict[str, Any]],
    causal_step_verifications: List[Dict[str, Any]],
    incidents: List[IncidentReport],
    authoritative_result: Dict[str, Any],
    ai_activated: bool,
    ai_abstention_signal: str = "NONE",      # from AI: NONE | INSUFFICIENT_EVIDENCE | CONFLICTING
    primary_hypothesis_status: str = "",     # AI-proposed status of primary hypothesis
) -> Dict[str, Any]:
    """
    Deterministic confidence computation for Phase 8 advanced investigations.

    Outcome mapping (6 states):
      RESOLVED_WITH_HIGH_CONFIDENCE
      RESOLVED_WITH_MEDIUM_CONFIDENCE
      LOW_CONFIDENCE
      INCONCLUSIVE
      AI_UNAVAILABLE
      DETERMINISTIC_RESULT

    AI provides abstention_signal as a hint; the deterministic engine
    makes the final decision. AI never assigns final confidence.
    """

    # ── Count verdict categories ──────────────────────────────────────────────
    total_claims = len(advanced_claims)
    verified_count = sum(1 for c in advanced_claims if c.get("verdict") == "VERIFIED")
    partially_verified_count = sum(1 for c in advanced_claims if c.get("verdict") == "PARTIALLY_VERIFIED")
    unsupported_count = sum(1 for c in advanced_claims if c.get("verdict") == "UNSUPPORTED")
    contradicted_count = sum(1 for c in advanced_claims if c.get("verdict") == "CONTRADICTED")
    unverifiable_count = sum(1 for c in advanced_claims if c.get("verdict") == "UNVERIFIABLE")

    positive_count = verified_count + partially_verified_count

    # ── Causal chain verification rate ───────────────────────────────────────
    total_causal = len(causal_step_verifications)
    verified_causal = sum(
        1 for s in causal_step_verifications
        if s.get("verification_state") == "VERIFIED"
    )
    causal_rate = (verified_causal / total_causal) if total_causal > 0 else 1.0

    # ── Authoritative state agreement ─────────────────────────────────────────
    # Primary hypothesis status SUPPORTED and no CONTRADICTED claims = agreement
    authoritative_agreement = (
        primary_hypothesis_status in ("SUPPORTED", "PLAUSIBLE")
        and contradicted_count == 0
    )

    # ── Deterministic base score ──────────────────────────────────────────────
    if total_claims > 0:
        raw_score = positive_count / total_claims
    else:
        raw_score = 0.0

    # Penalty for contradictions (each is -0.15)
    score = max(0.0, raw_score - contradicted_count * 0.15)

    # ── Abstention conditions (ANY triggers INCONCLUSIVE) ─────────────────────

    # AI signaled insufficient evidence
    if ai_abstention_signal in ("INSUFFICIENT_EVIDENCE", "CONFLICTING"):
        return {
            "outcome": "INCONCLUSIVE",
            "score": round(score, 3),
            "reason": f"AI abstention signal: {ai_abstention_signal}",
            "abstain": True,
            "signals": _build_signals(
                verified_count, partially_verified_count, unsupported_count,
                contradicted_count, unverifiable_count, causal_rate,
                authoritative_agreement, total_claims
            ),
        }

    # Any CONTRADICTED claims — authoritative wins
    if contradicted_count > 0:
        return {
            "outcome": "INCONCLUSIVE",
            "score": round(score, 3),
            "reason": (
                f"{contradicted_count} claim(s) CONTRADICTED by authoritative payment state. "
                "Investigation cannot be resolved while contradictions exist."
            ),
            "abstain": True,
            "signals": _build_signals(
                verified_count, partially_verified_count, unsupported_count,
                contradicted_count, unverifiable_count, causal_rate,
                authoritative_agreement, total_claims
            ),
        }

    # AI activated but zero positive claims
    if ai_activated and positive_count == 0 and total_claims > 0:
        return {
            "outcome": "INCONCLUSIVE",
            "score": round(score, 3),
            "reason": "AI activated but no claims are VERIFIED or PARTIALLY_VERIFIED.",
            "abstain": True,
            "signals": _build_signals(
                verified_count, partially_verified_count, unsupported_count,
                contradicted_count, unverifiable_count, causal_rate,
                authoritative_agreement, total_claims
            ),
        }

    # Majority UNSUPPORTED or UNVERIFIABLE
    non_positive = unsupported_count + unverifiable_count
    if total_claims > 0 and non_positive > total_claims / 2:
        return {
            "outcome": "INCONCLUSIVE",
            "score": round(score, 3),
            "reason": f"Majority of claims ({non_positive}/{total_claims}) are UNSUPPORTED or UNVERIFIABLE.",
            "abstain": True,
            "signals": _build_signals(
                verified_count, partially_verified_count, unsupported_count,
                contradicted_count, unverifiable_count, causal_rate,
                authoritative_agreement, total_claims
            ),
        }

    # ── DETERMINISTIC_RESULT — AI not activated ───────────────────────────────
    if not ai_activated:
        auth_hint = authoritative_result.get("confidence_hint", "")
        if auth_hint == "HIGH":
            return {
                "outcome": "DETERMINISTIC_RESULT",
                "score": 0.95,
                "reason": "AI not activated — deterministic analysis produced a confident result.",
                "abstain": False,
                "signals": _build_signals(0, 0, 0, 0, 0, 1.0, True, 0),
            }
        return {
            "outcome": "DETERMINISTIC_RESULT",
            "score": 0.75,
            "reason": "AI not activated — deterministic analysis result.",
            "abstain": False,
            "signals": _build_signals(0, 0, 0, 0, 0, 1.0, True, 0),
        }

    # ── Resolution outcomes ───────────────────────────────────────────────────
    signals = _build_signals(
        verified_count, partially_verified_count, unsupported_count,
        contradicted_count, unverifiable_count, causal_rate,
        authoritative_agreement, total_claims
    )

    # RESOLVED_WITH_HIGH_CONFIDENCE
    if (
        verified_count >= 2
        and unsupported_count == 0
        and contradicted_count == 0
        and authoritative_agreement
        and causal_rate >= 0.7
        and score >= 0.8
    ):
        return {
            "outcome": "RESOLVED_WITH_HIGH_CONFIDENCE",
            "score": round(min(0.97, score), 3),
            "reason": (
                f"{verified_count} verified claims, authoritative agreement, "
                f"causal verification rate {causal_rate:.0%}."
            ),
            "abstain": False,
            "signals": signals,
        }

    # RESOLVED_WITH_MEDIUM_CONFIDENCE
    if (
        positive_count >= 1
        and contradicted_count == 0
        and score >= 0.5
    ):
        return {
            "outcome": "RESOLVED_WITH_MEDIUM_CONFIDENCE",
            "score": round(max(0.5, min(0.79, score)), 3),
            "reason": (
                f"{verified_count} verified, {partially_verified_count} partially verified claims. "
                f"No contradictions."
            ),
            "abstain": False,
            "signals": signals,
        }

    # LOW_CONFIDENCE
    if positive_count > 0:
        return {
            "outcome": "LOW_CONFIDENCE",
            "score": round(max(0.2, min(0.49, score)), 3),
            "reason": (
                f"Limited evidence support: {verified_count} verified, "
                f"{partially_verified_count} partially verified, {unsupported_count} unsupported."
            ),
            "abstain": False,
            "signals": signals,
        }

    # Default: INCONCLUSIVE
    return {
        "outcome": "INCONCLUSIVE",
        "score": round(score, 3),
        "reason": "Insufficient verified evidence to reach a conclusion.",
        "abstain": True,
        "signals": signals,
    }


def _build_signals(
    verified: int,
    partially_verified: int,
    unsupported: int,
    contradicted: int,
    unverifiable: int,
    causal_rate: float,
    authoritative_agreement: bool,
    total_claims: int,
) -> Dict[str, Any]:
    """Build the deterministic scoring signals dict for audit transparency."""
    return {
        "verified_claims": verified,
        "partially_verified_claims": partially_verified,
        "unsupported_claims": unsupported,
        "contradicted_claims": contradicted,
        "unverifiable_claims": unverifiable,
        "total_claims": total_claims,
        "causal_chain_verification_rate": round(causal_rate, 3),
        "authoritative_agreement": authoritative_agreement,
    }
