from typing import List, Dict, Any
from app.claim_verifier import VerifiedClaim
from app.incident_detector import IncidentReport

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

    # INCONCLUSIVE (abstain=True) if ANY of:
    # - ai_activated=True AND zero SUPPORTED claims exist
    if ai_activated and supported_count == 0:
        return {
            "level": "INCONCLUSIVE",
            "score": score,
            "reason": "AI activated but zero supported claims exist.",
            "abstain": True
        }
        
    # - ai_activated=True AND more than half of claims are REJECTED
    if ai_activated and total_claims > 0 and rejected_count > total_claims / 2:
        return {
            "level": "INCONCLUSIVE",
            "score": score,
            "reason": "AI activated and more than half of claims are rejected.",
            "abstain": True
        }
        
    # - authoritative_result["confidence_hint"] == "LOW" AND all claims REJECTED or UNVERIFIABLE
    if authoritative_result.get("confidence_hint") == "LOW" and total_claims > 0 and (rejected_count + len(unverifiable_claims)) == total_claims:
        return {
            "level": "INCONCLUSIVE",
            "score": score,
            "reason": "Low authoritative confidence and all claims rejected or unverifiable.",
            "abstain": True
        }
        
    # - No verified_claims and no incidents (empty evidence)
    if not verified_claims and not incidents:
        return {
            "level": "INCONCLUSIVE",
            "score": 0.0,
            "reason": "No claims and no incidents present.",
            "abstain": True
        }

    # HIGH (abstain=False) if ALL of:
    # - ai_activated=False AND authoritative_result["confidence_hint"] == "HIGH"
    # - Zero HIGH severity incidents
    # - score = 0.95
    if not ai_activated and authoritative_result.get("confidence_hint") == "HIGH" and len(high_incidents) == 0:
        return {
            "level": "HIGH",
            "score": 0.95,
            "reason": "AI not activated, authoritative confidence is HIGH, and no HIGH severity incidents.",
            "abstain": False
        }

    # MEDIUM (abstain=False) if:
    # - At least one SUPPORTED claim exists
    # - Less than half claims REJECTED
    # - At least one MEDIUM or no HIGH incidents
    # - score = supported_count / total_claims (min 0.5, max 0.85)
    if supported_count >= 1 and (total_claims == 0 or rejected_count <= total_claims / 2) and (len(medium_incidents) >= 1 or len(high_incidents) == 0):
        # Enforce score bounds
        final_score = max(0.5, min(0.85, score))
        return {
            "level": "MEDIUM",
            "score": final_score,
            "reason": "Supported claims exist with manageable rejected claims and incidents.",
            "abstain": False
        }

    # LOW (abstain=False) if:
    # - Some SUPPORTED claims but also REJECTED claims present
    # - Or authoritative_result["confidence_hint"] == "LOW"
    # - score = supported_count / total_claims (min 0.2, max 0.49)
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
