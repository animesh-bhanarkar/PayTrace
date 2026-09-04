from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
import datetime
from app.claim_verifier import VerifiedClaim

@dataclass
class AuditEntry:
    payment_id: str
    evidence_package_id: str
    ai_activated: bool
    activation_reason: str
    gemini_raw_output: Optional[Dict[str, Any]]
    verified_claims: List[Dict[str, Any]]
    confidence: Dict[str, Any]
    abstained: bool
    timestamp: str

def build_audit_entry(
    payment_id: str,
    evidence_package: Dict[str, Any],
    ai_activated: bool,
    activation_reason: str,
    gemini_output: Optional[Dict[str, Any]],
    verified_claims: List[VerifiedClaim],
    confidence_result: Dict[str, Any]
) -> AuditEntry:
    return AuditEntry(
        payment_id=payment_id,
        evidence_package_id=evidence_package.get("evidence_id", "unknown"),
        ai_activated=ai_activated,
        activation_reason=activation_reason,
        gemini_raw_output=gemini_output,
        verified_claims=[asdict(vc) for vc in verified_claims],
        confidence=confidence_result,
        abstained=confidence_result.get("abstain", False),
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
