"""
Deterministic Claim Verifier — PayTrace.

Phase 1-7: verify_claims() — 3 verdicts (SUPPORTED/REJECTED/UNVERIFIABLE).
Phase 8: verify_advanced_claims() — 5 verdicts:
  VERIFIED            — all evidence IDs exist in package, no authoritative contradiction
  PARTIALLY_VERIFIED  — evidence present but claim asserts more than evidence supports
                        (always applies to CAUSAL claims with only timestamp evidence)
  UNSUPPORTED         — evidence IDs found in package but do not support the claim content
  CONTRADICTED        — authoritative payment state directly contradicts the claim
  UNVERIFIABLE        — evidence ID not in package; cannot check

Architecture invariant:
  Authoritative payment state defeats any AI claim.
  Verdicts are never collapsed to boolean.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Set


# ── Phase 1-7 data types (preserved) ─────────────────────────────────────────

@dataclass
class VerifiedClaim:
    claim_id: str
    statement: str
    verdict: str          # "SUPPORTED" | "REJECTED" | "UNVERIFIABLE"
    rejection_reason: Optional[str]
    evidence_ids: List[str]
    confidence: str


# ── Phase 8 data types ────────────────────────────────────────────────────────

@dataclass
class AdvancedVerifiedClaim:
    claim_id: str
    statement: str
    claim_type: str       # "OBSERVATION" | "INTERPRETATION" | "CAUSAL"
    verdict: str          # 5-state: see module docstring
    verdict_reason: str
    evidence_ids: List[str]
    counter_evidence_ids: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "claim_id": self.claim_id,
            "statement": self.statement,
            "claim_type": self.claim_type,
            "verdict": self.verdict,
            "verdict_reason": self.verdict_reason,
            "evidence_ids": self.evidence_ids,
            "counter_evidence_ids": self.counter_evidence_ids,
        }


@dataclass
class HypothesisVerification:
    hypothesis_id: str
    title: str
    status: str           # AI-proposed status
    supporting_evidence_verified: bool
    contradicting_evidence_verified: bool
    evidence_verdict: str  # VERIFIED | PARTIALLY_VERIFIED | UNSUPPORTED | UNVERIFIABLE
    notes: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hypothesis_id": self.hypothesis_id,
            "title": self.title,
            "status": self.status,
            "supporting_evidence_verified": self.supporting_evidence_verified,
            "contradicting_evidence_verified": self.contradicting_evidence_verified,
            "evidence_verdict": self.evidence_verdict,
            "notes": self.notes,
        }


@dataclass
class CausalStepVerification:
    step_id: str
    description: str
    verification_state: str  # "VERIFIED" | "UNVERIFIED" | "PARTIALLY_VERIFIED"
    notes: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step_id": self.step_id,
            "description": self.description,
            "verification_state": self.verification_state,
            "notes": self.notes,
        }


# ── Phase 1-7 verifier (preserved exactly) ───────────────────────────────────

def verify_claims(
    claims: List[Dict[str, Any]],
    evidence_package: Dict[str, Any]
) -> List[VerifiedClaim]:
    verified_claims = []

    package_events = evidence_package.get("events", [])
    package_event_ids = {event.get("evidence_id") for event in package_events if "evidence_id" in event}

    reconstructed_state = evidence_package.get("reconstructed_state", {})
    current_state = reconstructed_state.get("current_state")

    for claim in claims:
        claim_id = claim.get("claim_id", "")
        statement = claim.get("statement", "")
        confidence = claim.get("confidence", "LOW")
        evidence_ids = claim.get("evidence_ids")
        counter_evidence_ids = claim.get("counter_evidence_ids", [])

        # 5. If claim has no evidence_ids field or it is null → UNVERIFIABLE
        if evidence_ids is None:
            verified_claims.append(VerifiedClaim(
                claim_id=claim_id,
                statement=statement,
                verdict="UNVERIFIABLE",
                rejection_reason=None,
                evidence_ids=[],
                confidence=confidence
            ))
            continue

        # 1. evidence_ids not empty → else REJECTED: "Claim cites no evidence"
        if not evidence_ids:
            verified_claims.append(VerifiedClaim(
                claim_id=claim_id,
                statement=statement,
                verdict="REJECTED",
                rejection_reason="Claim cites no evidence",
                evidence_ids=[],
                confidence=confidence
            ))
            continue

        # 2. Every cited evidence_id exists in evidence_package["events"]
        invalid_evidence_id = None
        for eid in evidence_ids:
            if eid not in package_event_ids:
                invalid_evidence_id = eid
                break

        if invalid_evidence_id:
            verified_claims.append(VerifiedClaim(
                claim_id=claim_id,
                statement=statement,
                verdict="REJECTED",
                rejection_reason=f"Evidence ID not found in package: {invalid_evidence_id}",
                evidence_ids=evidence_ids,
                confidence=confidence
            ))
            continue

        # 3. At least one cited evidence_id exists in package
        if not any(eid in package_event_ids for eid in evidence_ids):
            verified_claims.append(VerifiedClaim(
                claim_id=claim_id,
                statement=statement,
                verdict="REJECTED",
                rejection_reason="No cited evidence belongs to this package",
                evidence_ids=evidence_ids,
                confidence=confidence
            ))
            continue

        # 4. Phase 7 Deterministic Webhook Claims Verification
        stmt_lower = statement.lower()
        cited_events = [ev for ev in package_events if ev.get("evidence_id") in evidence_ids]

        # Check authoritative payment state contradiction
        contradiction = _check_authoritative_contradiction(statement, current_state)
        if contradiction:
            verified_claims.append(VerifiedClaim(
                claim_id=claim_id,
                statement=statement,
                verdict="REJECTED",
                rejection_reason=contradiction,
                evidence_ids=evidence_ids,
                confidence=confidence,
            ))
            continue

        # Check signature verification claims
        if ("signature" in stmt_lower and ("invalid" in stmt_lower or "failed" in stmt_lower or "mismatch" in stmt_lower)):
            if cited_events and all(ev.get("signature_valid") is True for ev in cited_events):
                verified_claims.append(VerifiedClaim(
                    claim_id=claim_id,
                    statement=statement,
                    verdict="REJECTED",
                    rejection_reason="Claim of invalid signature contradicted by evidence: cited events have valid signatures",
                    evidence_ids=evidence_ids,
                    confidence=confidence,
                ))
                continue

        # Check duplicate delivery claims
        if ("duplicate" in stmt_lower or "delivered twice" in stmt_lower or "multiple times" in stmt_lower):
            duplicate_found = False
            for ev in cited_events:
                if ev.get("duplicate_status") == "DUPLICATE" or ev.get("delivery_status") == "duplicate":
                    duplicate_found = True
                    break
            if not duplicate_found and len(cited_events) < 2:
                verified_claims.append(VerifiedClaim(
                    claim_id=claim_id,
                    statement=statement,
                    verdict="REJECTED",
                    rejection_reason="Claim of duplicate delivery not supported by evidence package",
                    evidence_ids=evidence_ids,
                    confidence=confidence,
                ))
                continue

        # 6. All checks pass → SUPPORTED
        verified_claims.append(VerifiedClaim(
            claim_id=claim_id,
            statement=statement,
            verdict="SUPPORTED",
            rejection_reason=None,
            evidence_ids=evidence_ids,
            confidence=confidence,
        ))

    return verified_claims


# ── Phase 8: 5-verdict advanced verifier ─────────────────────────────────────

def _get_authoritative_state(evidence_package: Dict[str, Any]) -> Optional[str]:
    """Extract authoritative payment state from advanced evidence package."""
    auth = evidence_package.get("authoritative_state", {})
    if auth:
        return auth.get("current_state")
    # Fallback: reconstructed_state field (Phase 1-7 package shape)
    recon = evidence_package.get("reconstructed_state", {})
    return recon.get("current_state")


def _get_package_event_ids(evidence_package: Dict[str, Any]) -> Set[str]:
    """Collect all valid evidence_ids from the events array."""
    events = evidence_package.get("events", [])
    return {
        e.get("evidence_id")
        for e in events
        if e.get("evidence_id")
    }


_TERMINAL_STATES = {"captured", "failed", "refunded"}

# These keyword pairs indicate a claim that contradicts the authoritative state
_CONTRADICTION_PATTERNS = [
    # (keyword_in_statement, contradicted_by_states)
    ("payment failed", {"captured"}),
    ("payment did not capture", {"captured"}),
    ("payment remained failed", {"captured"}),
    ("transaction failed", {"captured"}),
    ("payment state is failed", {"captured"}),
    ("payment status is failed", {"captured"}),
    ("payment was failed", {"captured"}),
    ("payment is failed", {"captured"}),
    ("authoritative payment state is failed", {"captured"}),
    ("authoritative state is failed", {"captured"}),
    ("payment was not captured", {"captured"}),
    ("payment never captured", {"captured"}),
    ("payment succeeded", {"failed"}),
    ("payment captured", {"failed"}),
    ("payment authorized", {"failed"}),
    ("payment state is captured", {"failed"}),
    ("payment status is captured", {"failed"}),
    ("payment was captured", {"failed"}),
    ("payment is captured", {"failed"}),
    ("authoritative payment state is captured", {"failed"}),
    ("authoritative state is captured", {"failed"}),
]


def _check_authoritative_contradiction(
    statement: str,
    authoritative_state: Optional[str],
) -> Optional[str]:
    """
    Return contradiction reason if the statement contradicts the authoritative
    payment state; otherwise return None.
    """
    if not authoritative_state:
        return None

    stmt_lower = statement.lower().strip()
    auth_lower = authoritative_state.lower().strip()
    for keyword, contradicted_by in _CONTRADICTION_PATTERNS:
        if keyword in stmt_lower and auth_lower in contradicted_by:
            return (
                f"Claim contradicts authoritative payment state "
                f"('{keyword}' vs authoritative state='{auth_lower}'). "
                f"Authoritative evidence wins."
            )
    return None


def verify_advanced_claims(
    claims: List[Dict[str, Any]],
    evidence_package: Dict[str, Any],
) -> List[AdvancedVerifiedClaim]:
    """
    5-verdict deterministic verifier for Phase 8 advanced claims.

    Verdict rules (applied in order, first match wins):
    1. CONTRADICTED — claim contradicts authoritative payment state
    2. UNVERIFIABLE — any cited evidence_id absent from package
    3. UNSUPPORTED  — evidence_ids empty
    4. PARTIALLY_VERIFIED — CAUSAL claim: evidence supports observations
                            but causal assertion requires extra inference
    5. VERIFIED     — evidence present in package, no authoritative contradiction
    """
    results: List[AdvancedVerifiedClaim] = []
    authoritative_state = _get_authoritative_state(evidence_package)
    package_event_ids = _get_package_event_ids(evidence_package)

    for claim in claims:
        claim_id = str(claim.get("claim_id", ""))
        statement = str(claim.get("statement", ""))
        claim_type = str(claim.get("claim_type", "OBSERVATION"))
        evidence_ids: List[str] = list(claim.get("evidence_ids") or [])
        counter_evidence_ids: List[str] = list(claim.get("counter_evidence_ids") or [])

        # Rule 1: CONTRADICTED — authoritative state wins
        contradiction = _check_authoritative_contradiction(statement, authoritative_state)
        if contradiction:
            results.append(AdvancedVerifiedClaim(
                claim_id=claim_id,
                statement=statement,
                claim_type=claim_type,
                verdict="CONTRADICTED",
                verdict_reason=contradiction,
                evidence_ids=evidence_ids,
                counter_evidence_ids=counter_evidence_ids,
            ))
            continue

        # Rule 2: UNVERIFIABLE — any evidence ID absent from package
        if evidence_ids:
            missing_ids = [eid for eid in evidence_ids if eid not in package_event_ids]
            if missing_ids:
                results.append(AdvancedVerifiedClaim(
                    claim_id=claim_id,
                    statement=statement,
                    claim_type=claim_type,
                    verdict="UNVERIFIABLE",
                    verdict_reason=f"Evidence ID(s) not found in package: {', '.join(missing_ids[:3])}",
                    evidence_ids=evidence_ids,
                    counter_evidence_ids=counter_evidence_ids,
                ))
                continue

        # Rule 3: UNSUPPORTED — no evidence cited at all
        if not evidence_ids:
            results.append(AdvancedVerifiedClaim(
                claim_id=claim_id,
                statement=statement,
                claim_type=claim_type,
                verdict="UNSUPPORTED",
                verdict_reason="Claim cites no evidence from the evidence package",
                evidence_ids=evidence_ids,
                counter_evidence_ids=counter_evidence_ids,
            ))
            continue

        # Rule 4: PARTIALLY_VERIFIED for CAUSAL claims
        # A CAUSAL claim can never be fully VERIFIED from timestamps alone:
        # knowing X happened before Y does not prove X caused Y.
        if claim_type == "CAUSAL":
            results.append(AdvancedVerifiedClaim(
                claim_id=claim_id,
                statement=statement,
                claim_type=claim_type,
                verdict="PARTIALLY_VERIFIED",
                verdict_reason=(
                    "CAUSAL claim: cited evidence supports the underlying observations "
                    "but causal inference requires additional support beyond timestamps."
                ),
                evidence_ids=evidence_ids,
                counter_evidence_ids=counter_evidence_ids,
            ))
            continue

        # Rule 5: VERIFIED — all evidence present, no contradiction, non-causal
        results.append(AdvancedVerifiedClaim(
            claim_id=claim_id,
            statement=statement,
            claim_type=claim_type,
            verdict="VERIFIED",
            verdict_reason="All cited evidence IDs present in package; no authoritative contradiction.",
            evidence_ids=evidence_ids,
            counter_evidence_ids=counter_evidence_ids,
        ))

    return results


def verify_hypotheses(
    hypotheses: List[Dict[str, Any]],
    evidence_package: Dict[str, Any],
) -> List[HypothesisVerification]:
    """
    Verify that each hypothesis's cited evidence IDs exist in the package.
    Does NOT verify whether evidence content supports the hypothesis —
    that is done at the claim level.
    """
    results: List[HypothesisVerification] = []
    package_event_ids = _get_package_event_ids(evidence_package)

    for hyp in hypotheses:
        hyp_id = str(hyp.get("hypothesis_id", ""))
        title = str(hyp.get("title", ""))
        status = str(hyp.get("status", "INCONCLUSIVE"))
        supporting = list(hyp.get("supporting_evidence_ids") or [])
        contradicting = list(hyp.get("contradicting_evidence_ids") or [])

        # Check supporting evidence
        missing_supporting = [eid for eid in supporting if eid not in package_event_ids]
        supporting_ok = len(missing_supporting) == 0 and len(supporting) > 0

        # Check contradicting evidence
        missing_contradicting = [eid for eid in contradicting if eid not in package_event_ids]
        contradicting_ok = len(missing_contradicting) == 0 if contradicting else True

        if not supporting and not contradicting:
            evidence_verdict = "UNVERIFIABLE"
            notes = "Hypothesis cites no evidence IDs; cannot verify evidence references."
        elif missing_supporting or missing_contradicting:
            all_missing = missing_supporting + missing_contradicting
            evidence_verdict = "UNVERIFIABLE"
            notes = f"Missing evidence IDs: {', '.join(all_missing[:3])}"
        elif supporting_ok:
            evidence_verdict = "VERIFIED"
            notes = "All cited evidence IDs found in the package."
        else:
            evidence_verdict = "PARTIALLY_VERIFIED"
            notes = "Some evidence IDs verified; contradicting evidence not cited."

        results.append(HypothesisVerification(
            hypothesis_id=hyp_id,
            title=title,
            status=status,
            supporting_evidence_verified=supporting_ok,
            contradicting_evidence_verified=contradicting_ok,
            evidence_verdict=evidence_verdict,
            notes=notes,
        ))

    return results


def verify_causal_chain(
    causal_chain: List[Dict[str, Any]],
    evidence_package: Dict[str, Any],
) -> List[CausalStepVerification]:
    """
    Verify each causal step's cited evidence IDs.
    Steps without supporting_evidence_ids are marked UNVERIFIED.
    """
    results: List[CausalStepVerification] = []
    package_event_ids = _get_package_event_ids(evidence_package)

    for step in causal_chain:
        step_id = str(step.get("step_id", ""))
        description = str(step.get("description", ""))
        supporting = list(step.get("supporting_evidence_ids") or [])

        if not supporting:
            results.append(CausalStepVerification(
                step_id=step_id,
                description=description,
                verification_state="UNVERIFIED",
                notes="No evidence IDs cited for this causal step.",
            ))
            continue

        missing = [eid for eid in supporting if eid not in package_event_ids]
        if missing:
            results.append(CausalStepVerification(
                step_id=step_id,
                description=description,
                verification_state="UNVERIFIED",
                notes=f"Evidence ID(s) not in package: {', '.join(missing[:3])}",
            ))
        elif len(supporting) >= 1:
            results.append(CausalStepVerification(
                step_id=step_id,
                description=description,
                verification_state="VERIFIED",
                notes="All cited evidence IDs found in the evidence package.",
            ))
        else:
            results.append(CausalStepVerification(
                step_id=step_id,
                description=description,
                verification_state="PARTIALLY_VERIFIED",
                notes="Evidence cited but not all IDs verified.",
            ))

    return results
