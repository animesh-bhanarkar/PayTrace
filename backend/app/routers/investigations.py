import logging
from dataclasses import asdict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import NormalizedEvent, Incident, PaymentState, AuditRecord
from app.state_reconstructor import reconstruct_payment_state
from app.authoritative_rules import apply_authoritative_rules
from app.ai_activation_gate import should_activate_ai
from app.evidence_package import build_evidence_package
from app.gemini_investigator import investigate
from app.incident_detector import IncidentReport
from app.claim_verifier import verify_claims
from app.confidence_engine import compute_confidence
from app.audit_trail import build_audit_entry

logger = logging.getLogger("paytrace.investigations")

router = APIRouter(prefix="/investigations", tags=["investigations"])

class InvestigateRequest(BaseModel):
    payment_id: str

@router.post("/investigate")
def run_investigation(request: InvestigateRequest, db: Session = Depends(get_db)):
    payment_id = request.payment_id

    # 1. Query DB for all NormalizedEvents with this payment_id, ordered by event_timestamp asc
    events = (
        db.query(NormalizedEvent)
        .filter(NormalizedEvent.payment_id == payment_id)
        .order_by(NormalizedEvent.event_timestamp.asc())
        .all()
    )

    # 2. If no events -> return 404
    if not events:
        raise HTTPException(status_code=404, detail="No events found for payment_id")

    # 3. Query DB for all Incidents with this payment_id
    incident_rows = (
        db.query(Incident)
        .filter(Incident.payment_id == payment_id)
        .all()
    )

    # 4. Convert Incident rows to IncidentReport objects
    incidents = []
    for row in incident_rows:
        incidents.append(IncidentReport(
            incident_type=row.incident_type,
            payment_id=row.payment_id,
            order_id=row.order_id,
            description=row.description,
            severity=row.severity,
            evidence_ids=row.evidence_ids if row.evidence_ids else []
        ))

    # 5. Call reconstruct_payment_state(events)
    reconstructed_state = reconstruct_payment_state(events)

    # 6. Call apply_authoritative_rules(reconstructed_state, incidents)
    authoritative_result = apply_authoritative_rules(reconstructed_state, incidents)

    # 7. Call should_activate_ai
    activate, reason = should_activate_ai(authoritative_result, incidents, events)

    logger.info(f"Investigation for payment_id={payment_id}: ai_activated={activate} reason={reason}")

    # ── Branch: activate=False ────────────────────────────────────────────────
    if not activate:
        evidence_package = None
        investigation = None
        verified_claims_list = []
        confidence = compute_confidence([], incidents, authoritative_result, False)

        audit_entry = build_audit_entry(
            payment_id=payment_id,
            evidence_package={},
            ai_activated=False,
            activation_reason=reason,
            gemini_output=None,
            verified_claims=verified_claims_list,
            confidence_result=confidence
        )

        audit_record = AuditRecord(
            payment_id=payment_id,
            evidence_package_id="none",
            ai_activated=False,
            activation_reason=reason,
            gemini_raw_output=None,
            verified_claims=[],
            confidence_level=confidence["level"],
            confidence_score=confidence["score"],
            abstained=confidence["abstain"]
        )
        db.add(audit_record)
        db.commit()

        return {
            "payment_id": payment_id,
            "ai_activated": False,
            "reason": reason,
            "authoritative_result": authoritative_result,
            "confidence": confidence,
            "abstained": confidence["abstain"],
            "verified_claims": [],
            "rejected_claims": [],
            "investigation": None,
            "evidence_package": None
        }

    # ── Branch: activate=True ─────────────────────────────────────────────────
    evidence_package = build_evidence_package(
        payment_id,
        events,
        reconstructed_state,
        incidents
    )

    investigation = investigate(evidence_package)

    if "error" in investigation:
        logger.error(f"Gemini API call failed: {investigation.get('detail') or investigation.get('raw')}")

    # ── Claim verification + confidence engine ────────────────────────────────
    if "error" not in investigation:
        raw_claims = investigation.get("claims", [])
        verified_claims_list = verify_claims(raw_claims, evidence_package)
        confidence = compute_confidence(verified_claims_list, incidents, authoritative_result, True)
    else:
        verified_claims_list = []
        confidence = {
            "level": "INCONCLUSIVE",
            "score": 0.0,
            "reason": "Gemini unavailable",
            "abstain": True
        }

    # ── Build and persist audit entry ─────────────────────────────────────────
    audit_entry = build_audit_entry(
        payment_id=payment_id,
        evidence_package=evidence_package,
        ai_activated=True,
        activation_reason=reason,
        gemini_output=investigation,
        verified_claims=verified_claims_list,
        confidence_result=confidence
    )

    audit_record = AuditRecord(
        payment_id=payment_id,
        evidence_package_id=evidence_package.get("evidence_id", "unknown"),
        ai_activated=True,
        activation_reason=reason,
        gemini_raw_output=investigation,
        verified_claims=audit_entry.verified_claims,
        confidence_level=confidence["level"],
        confidence_score=confidence["score"],
        abstained=confidence["abstain"]
    )
    db.add(audit_record)
    db.commit()

    # ── Build response ────────────────────────────────────────────────────────
    all_verified_dicts = [asdict(vc) for vc in verified_claims_list]
    supported_and_unverifiable = [d for d in all_verified_dicts if d["verdict"] != "REJECTED"]
    rejected_dicts = [d for d in all_verified_dicts if d["verdict"] == "REJECTED"]

    return {
        "payment_id": payment_id,
        "ai_activated": True,
        "reason": reason,
        "authoritative_result": authoritative_result,
        "confidence": confidence,
        "abstained": confidence["abstain"],
        "verified_claims": supported_and_unverifiable,
        "rejected_claims": rejected_dicts,
        "investigation": investigation,
        "evidence_package": evidence_package
    }
