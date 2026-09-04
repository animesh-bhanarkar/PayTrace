import logging
from dataclasses import asdict
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
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
from app.missing_evidence_engine import evaluate_missing_evidence

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

        missing_report = evaluate_missing_evidence(
            payment_id=payment_id,
            events=events,
            reconstructed_state=reconstructed_state,
            incidents=incidents,
            verified_claims=[]
        )

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
            "evidence_package": None,
            "missing_evidence_report": asdict(missing_report)
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

    missing_report = evaluate_missing_evidence(
        payment_id=payment_id,
        events=events,
        reconstructed_state=reconstructed_state,
        incidents=incidents,
        verified_claims=verified_claims_list
    )

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
        "evidence_package": evidence_package,
        "missing_evidence_report": asdict(missing_report)
    }


@router.get("/history")
def get_investigation_history(
    limit: int = 50,
    offset: int = 0,
    payment_id: Optional[str] = None,
    ai_activated: Optional[bool] = None,
    confidence_level: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Retrieve historical investigation executions recorded in AuditRecord.
    """
    query = db.query(AuditRecord)
    if payment_id:
        query = query.filter(AuditRecord.payment_id == payment_id)
    if ai_activated is not None:
        query = query.filter(AuditRecord.ai_activated == ai_activated)
    if confidence_level and confidence_level != "ALL":
        query = query.filter(AuditRecord.confidence_level == confidence_level.upper())

    rows = query.order_by(AuditRecord.timestamp.desc()).offset(offset).limit(limit).all()

    items = []
    for r in rows:
        claims = r.verified_claims if isinstance(r.verified_claims, list) else []
        supported_count = sum(1 for c in claims if isinstance(c, dict) and c.get("verdict") == "SUPPORTED")
        rejected_count = sum(1 for c in claims if isinstance(c, dict) and c.get("verdict") == "REJECTED")

        hypothesis = None
        if isinstance(r.gemini_raw_output, dict):
            hypothesis = r.gemini_raw_output.get("hypothesis")

        items.append({
            "id": str(r.id),
            "payment_id": r.payment_id,
            "evidence_package_id": r.evidence_package_id,
            "ai_activated": r.ai_activated,
            "activation_reason": r.activation_reason,
            "hypothesis": hypothesis,
            "claim_count": len(claims),
            "supported_claims_count": supported_count,
            "rejected_claims_count": rejected_count,
            "confidence_level": r.confidence_level or "INCONCLUSIVE",
            "confidence_score": r.confidence_score or 0.0,
            "abstained": r.abstained,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        })
    return items


@router.get("/history/{payment_id}/versions")
def get_payment_investigation_versions(payment_id: str, db: Session = Depends(get_db)):
    """
    Retrieve chronological versions of all investigations conducted for a single payment.
    """
    rows = (
        db.query(AuditRecord)
        .filter(AuditRecord.payment_id == payment_id)
        .order_by(AuditRecord.timestamp.asc())
        .all()
    )

    versions = []
    for idx, r in enumerate(rows):
        claims = r.verified_claims if isinstance(r.verified_claims, list) else []
        versions.append({
            "version_number": idx + 1,
            "id": str(r.id),
            "payment_id": r.payment_id,
            "ai_activated": r.ai_activated,
            "activation_reason": r.activation_reason,
            "confidence_level": r.confidence_level,
            "confidence_score": r.confidence_score,
            "abstained": r.abstained,
            "claims_count": len(claims),
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "verified_claims": claims,
        })
    return versions


@router.get("/compare")
def compare_investigations(
    v1_id: Optional[str] = Query(None),
    v2_id: Optional[str] = Query(None),
    v1_audit_id: Optional[str] = Query(None),
    v2_audit_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Compare two investigation executions to show changes in evidence, claims, confidence, and outcome.
    """
    actual_v1 = v1_id or v1_audit_id
    actual_v2 = v2_id or v2_audit_id
    if not actual_v1 or not actual_v2:
        raise HTTPException(status_code=400, detail="v1_id and v2_id parameters are required")

    r1 = db.query(AuditRecord).filter(AuditRecord.id == actual_v1).first()
    r2 = db.query(AuditRecord).filter(AuditRecord.id == actual_v2).first()

    if not r1 or not r2:
        raise HTTPException(status_code=404, detail="One or both investigation versions not found")

    claims_v1 = r1.verified_claims if isinstance(r1.verified_claims, list) else []
    claims_v2 = r2.verified_claims if isinstance(r2.verified_claims, list) else []

    c1_map = {c.get("claim_id"): c for c in claims_v1 if isinstance(c, dict)}
    c2_map = {c.get("claim_id"): c for c in claims_v2 if isinstance(c, dict)}

    all_claim_ids = list(set(list(c1_map.keys()) + list(c2_map.keys())))

    claim_diffs = []
    for cid in all_claim_ids:
        in_v1 = c1_map.get(cid)
        in_v2 = c2_map.get(cid)

        claim_diffs.append({
            "claim_id": cid,
            "v1_verdict": in_v1.get("verdict") if in_v1 else None,
            "v2_verdict": in_v2.get("verdict") if in_v2 else None,
            "statement": (in_v2 or in_v1 or {}).get("statement", ""),
            "changed": (in_v1.get("verdict") if in_v1 else None) != (in_v2.get("verdict") if in_v2 else None),
        })

    return {
        "payment_id": r1.payment_id,
        "v1": {
            "id": str(r1.id),
            "timestamp": r1.timestamp.isoformat() if r1.timestamp else None,
            "ai_activated": r1.ai_activated,
            "confidence_level": r1.confidence_level,
            "confidence_score": r1.confidence_score,
            "abstained": r1.abstained,
            "claims_count": len(claims_v1),
        },
        "v2": {
            "id": str(r2.id),
            "timestamp": r2.timestamp.isoformat() if r2.timestamp else None,
            "ai_activated": r2.ai_activated,
            "confidence_level": r2.confidence_level,
            "confidence_score": r2.confidence_score,
            "abstained": r2.abstained,
            "claims_count": len(claims_v2),
        },
        "confidence_changed": r1.confidence_level != r2.confidence_level or r1.confidence_score != r2.confidence_score,
        "ai_activated_changed": r1.ai_activated != r2.ai_activated,
        "abstention_changed": r1.abstained != r2.abstained,
        "claims_count_diff": len(claims_v2) - len(claims_v1),
        "claim_diffs": claim_diffs,
    }


@router.get("/claims/summary")
def get_claims_summary(limit: int = 50, payment_id: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Retrieve claims summary across investigations for the Claim Verification Center.
    """
    query = db.query(AuditRecord)
    if payment_id:
        query = query.filter(AuditRecord.payment_id == payment_id)

    rows = query.order_by(AuditRecord.timestamp.desc()).limit(limit).all()

    claims_list = []
    seen = set()

    for r in rows:
        if isinstance(r.verified_claims, list):
            for c in r.verified_claims:
                if isinstance(c, dict):
                    cid = c.get("claim_id")
                    key = f"{r.payment_id}_{cid}"
                    if key not in seen:
                        seen.add(key)
                        claims_list.append({
                            "payment_id": r.payment_id,
                            "claim_id": cid,
                            "statement": c.get("statement"),
                            "verdict": c.get("verdict"),
                            "rejection_reason": c.get("rejection_reason"),
                            "evidence_ids": c.get("evidence_ids", []),
                            "confidence": c.get("confidence"),
                            "investigation_id": str(r.id),
                            "investigation_timestamp": r.timestamp.isoformat() if r.timestamp else None,
                        })

    total = len(claims_list)
    supported = sum(1 for c in claims_list if c.get("verdict") == "SUPPORTED")
    rejected = sum(1 for c in claims_list if c.get("verdict") == "REJECTED")
    unverifiable = sum(1 for c in claims_list if c.get("verdict") == "UNVERIFIABLE")
    rate = round(supported / total, 2) if total > 0 else 0.0

    return {
        "total_claims": total,
        "verified_claims": supported,
        "rejected_claims": rejected,
        "unverifiable_claims": unverifiable,
        "verification_rate": rate,
        "claims": claims_list,
    }

