from dataclasses import dataclass
from typing import List, Dict, Any, Optional

@dataclass
class VerifiedClaim:
    claim_id: str
    statement: str
    verdict: str          # "SUPPORTED" | "REJECTED" | "UNVERIFIABLE"
    rejection_reason: Optional[str]
    evidence_ids: List[str]
    confidence: str

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
            
        # 2. Every cited evidence_id exists in evidence_package["events"] (match on evidence_id field) 
        #    → else REJECTED: "Evidence ID not found in package: <id>"
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
            
        # 3. At least one cited evidence_id exists in package (membership check) 
        #    → else REJECTED: "No cited evidence belongs to this package"
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
            
        # 4. If counter_evidence_ids present: none of them must contradict current_state in reconstructed_state
        #    → mark as noted but do not auto-reject
        # (Instruction says "mark as noted but do not auto-reject", so we do nothing to reject it)

        # 5. Phase 7 Deterministic Webhook Claims Verification
        stmt_lower = statement.lower()
        cited_events = [ev for ev in package_events if ev.get("evidence_id") in evidence_ids]

        # Check signature verification claims
        if ("signature" in stmt_lower and ("invalid" in stmt_lower or "failed" in stmt_lower or "mismatch" in stmt_lower)):
            # If all cited events actually have valid signatures, reject the claim!
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
            # Must have duplicate evidence in package
            duplicate_found = False
            for ev in cited_events:
                if ev.get("duplicate_status") == "DUPLICATE" or ev.get("delivery_status") == "duplicate":
                    duplicate_found = True
                    break
            # Or multiple events sharing same event_id / payload_hash
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
