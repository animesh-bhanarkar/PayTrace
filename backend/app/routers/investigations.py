import logging
import time
import uuid as uuid_module
from dataclasses import asdict
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import NormalizedEvent, Incident, PaymentState, AuditRecord
from app.state_reconstructor import reconstruct_payment_state
from app.authoritative_rules import apply_authoritative_rules
from app.ai_activation_gate import should_activate_ai, should_activate_advanced_ai
from app.evidence_package import build_evidence_package, build_advanced_evidence_package
from app.gemini_investigator import investigate, investigate_advanced
from app.incident_detector import IncidentReport
from app.claim_verifier import (
    verify_claims,
    verify_advanced_claims,
    verify_hypotheses,
    verify_causal_chain,
)
from app.confidence_engine import compute_confidence, compute_advanced_confidence
from app.audit_trail import build_audit_entry
from app.missing_evidence_engine import evaluate_missing_evidence
from app.live_monitoring import live_event_stream

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

        try:
            live_event_stream.publish_event(
                "investigation.completed",
                {
                    "payment_id": payment_id,
                    "investigation_type": "standard",
                    "ai_activated": False,
                    "reason": reason,
                    "confidence_score": confidence.get("score") if isinstance(confidence, dict) else None,
                    "confidence_level": confidence.get("level") if isinstance(confidence, dict) else None,
                    "abstained": confidence.get("abstain", False) if isinstance(confidence, dict) else False,
                    "verdict": authoritative_result.get("verdict") if isinstance(authoritative_result, dict) else None,
                },
            )
        except Exception:
            pass

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

    try:
        live_event_stream.publish_event(
            "investigation.completed",
            {
                "payment_id": payment_id,
                "investigation_type": "standard",
                "ai_activated": True,
                "reason": reason,
                "confidence_score": confidence.get("score") if isinstance(confidence, dict) else None,
                "confidence_level": confidence.get("level") if isinstance(confidence, dict) else None,
                "abstained": confidence.get("abstain", False) if isinstance(confidence, dict) else False,
                "verdict": authoritative_result.get("verdict") if isinstance(authoritative_result, dict) else None,
                "supported_claims_count": len(supported_and_unverifiable),
            },
        )
    except Exception:
        pass

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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Phase 8 — Advanced AI Investigation Endpoints
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _load_incident_by_id_or_payment(incident_id: str, db: Session) -> Incident:
    """
    Load an Incident by UUID first, then fall back to payment_id match.
    Raises HTTPException 404 if not found.
    """
    # Try UUID
    try:
        uid = uuid_module.UUID(str(incident_id))
        row = db.query(Incident).filter(Incident.id == uid).first()
        if row:
            return row
    except (ValueError, AttributeError):
        pass

    # Fall back: latest incident with this payment_id
    row = (
        db.query(Incident)
        .filter(Incident.payment_id == incident_id)
        .order_by(Incident.detected_at.desc())
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"Incident not found for id or payment_id: {incident_id}"
        )
    return row


@router.post("/{incident_id}/investigate/advanced")
def run_advanced_investigation(incident_id: str, db: Session = Depends(get_db)):
    """
    Phase 8 Advanced AI Investigation.

    Runs a structured investigation with:
    - Competing hypotheses
    - Causal chain reasoning
    - 5-verdict claim verification (VERIFIED/PARTIALLY_VERIFIED/UNSUPPORTED/CONTRADICTED/UNVERIFIABLE)
    - WHY-NOT alternative reasoning
    - 6-outcome deterministic confidence
    - Webhook diagnostics integration
    - Audit record with evidence package hash

    The AI reasons over evidence. Deterministic systems verify every claim.
    AI never mutates payment state or operational fields.
    """
    start_time = time.perf_counter()

    # 1. Load incident
    incident_row = _load_incident_by_id_or_payment(incident_id, db)
    payment_id = incident_row.payment_id

    # 2. Load all NormalizedEvents for this payment
    events = (
        db.query(NormalizedEvent)
        .filter(NormalizedEvent.payment_id == payment_id)
        .order_by(NormalizedEvent.event_timestamp.asc())
        .all()
    )
    if not events:
        raise HTTPException(status_code=404, detail="No events found for this incident's payment_id")

    # 3. Load all Incidents for this payment
    incident_rows = (
        db.query(Incident)
        .filter(Incident.payment_id == payment_id)
        .all()
    )
    incidents = [
        IncidentReport(
            incident_type=row.incident_type,
            payment_id=row.payment_id,
            order_id=row.order_id,
            description=row.description,
            severity=row.severity,
            evidence_ids=row.evidence_ids if row.evidence_ids else []
        )
        for row in incident_rows
    ]

    # 4. Deterministic state reconstruction
    reconstructed_state = reconstruct_payment_state(events)
    authoritative_result = apply_authoritative_rules(reconstructed_state, incidents)

    # 5. Load webhook diagnostics if available (bounded, trust-filtered)
    webhook_diagnostics: Dict[str, Any] = {}
    try:
        from app.webhook_diagnostics import (
            detect_out_of_order,
            detect_late_authorization,
            reconcile_states,
        )
        from app.models import WebhookEvent
        webhook_rows = (
            db.query(WebhookEvent)
            .filter(
                WebhookEvent.payment_id == payment_id,
                WebhookEvent.trust_status == "TRUSTED",
                WebhookEvent.duplicate_status == "ORIGINAL",
            )
            .order_by(WebhookEvent.event_timestamp.asc())
            .limit(10)
            .all()
        )
        if webhook_rows:
            wh_list = []
            for wh in webhook_rows:
                wh_list.append({
                    "id": str(wh.id),
                    "event_type": wh.event_type,
                    "trust_status": wh.trust_status,
                    "duplicate_status": wh.duplicate_status,
                    "event_timestamp": wh.event_timestamp.isoformat() if wh.event_timestamp else None,
                    "ingestion_timestamp": wh.ingestion_timestamp.isoformat() if wh.ingestion_timestamp else None,
                    "delivery_delay_seconds": wh.delivery_delay_seconds,
                    "razorpay_event_id": wh.razorpay_event_id,
                })

            oot = detect_out_of_order(webhook_rows)
            late_auth = detect_late_authorization(webhook_rows)
            recon = reconcile_states(
                gateway_state=reconstructed_state.current_state,
                webhook_events=webhook_rows,
                merchant_state=None,
            )

            webhook_diagnostics = {
                "webhooks": wh_list,
                "out_of_order_diagnostics": {
                    "detected": oot.get("detected", False),
                    "description": oot.get("description", ""),
                },
                "late_authorization_diagnostics": {
                    "detected": late_auth.get("detected", False),
                },
                "reconciliation": {
                    "status": recon.get("status", "INSUFFICIENT_EVIDENCE"),
                },
            }
    except Exception:
        webhook_diagnostics = {}

    # 6. Load similar incidents and patterns for context (bounded)
    similar_incidents_ctx: List[Dict[str, Any]] = []
    patterns_ctx: List[Dict[str, Any]] = []
    try:
        from app.incident_fingerprint import build_fingerprint
        from app.similarity_engine import compute_similarity
        fp_current = build_fingerprint(
            incident_row,
            events,
            authoritative_result,
            reconstructed_state
        )
        other_rows = (
            db.query(Incident)
            .filter(Incident.id != incident_row.id)
            .order_by(Incident.detected_at.desc())
            .limit(30)
            .all()
        )
        scored = []
        for other in other_rows:
            try:
                other_events = (
                    db.query(NormalizedEvent)
                    .filter(NormalizedEvent.payment_id == other.payment_id)
                    .limit(10)
                    .all()
                )
                other_state = reconstruct_payment_state(other_events)
                other_auth = apply_authoritative_rules(other_state, [])
                fp_other = build_fingerprint(other, other_events, other_auth, other_state)
                sim = compute_similarity(fp_current, fp_other)
                if sim.similarity_score >= 0.4:
                    scored.append({
                        "incident_type": other.incident_type,
                        "severity": other.severity,
                        "similarity_score": sim.similarity_score,
                        "comparison_summary": sim.comparison_summary,
                        "matching_features": sim.matching_features,
                        "resolved": other.resolved,
                    })
            except Exception:
                continue
        similar_incidents_ctx = sorted(scored, key=lambda x: x["similarity_score"], reverse=True)[:3]
    except Exception:
        similar_incidents_ctx = []

    try:
        from app.pattern_detector import detect_patterns
        all_incidents = db.query(Incident).limit(100).all()
        all_inc_reports = [
            IncidentReport(
                incident_type=r.incident_type,
                payment_id=r.payment_id,
                order_id=r.order_id,
                description=r.description,
                severity=r.severity,
                evidence_ids=r.evidence_ids or []
            ) for r in all_incidents
        ]
        patterns = detect_patterns(all_inc_reports)
        patterns_ctx = [
            {
                "pattern_name": p.pattern_name,
                "pattern_type": p.pattern_type,
                "incident_count": p.incident_count,
                "severity": p.severity,
                "pattern_strength": p.pattern_strength,
                "diagnostic_characteristics": p.diagnostic_characteristics,
            }
            for p in patterns[:2]
        ]
    except Exception:
        patterns_ctx = []

    # 7. Evaluate AI activation gate
    activate, activation_reason = should_activate_advanced_ai(
        authoritative_result=authoritative_result,
        incidents=incidents,
        existing_events=events,
        webhook_diagnostics=webhook_diagnostics,
    )

    logger.info(
        f"Advanced investigation for payment_id={payment_id}: "
        f"ai_activated={activate} reason={activation_reason}"
    )

    # ── Branch: AI not required — deterministic result ────────────────────────
    if not activate:
        missing_report = evaluate_missing_evidence(
            payment_id=payment_id,
            events=events,
            reconstructed_state=reconstructed_state,
            incidents=incidents,
            verified_claims=[]
        )
        confidence_result = compute_advanced_confidence(
            advanced_claims=[],
            hypothesis_verifications=[],
            causal_step_verifications=[],
            incidents=incidents,
            authoritative_result=authoritative_result,
            ai_activated=False,
        )
        duration_ms = (time.perf_counter() - start_time) * 1000

        # Persist minimal audit record
        audit_record = AuditRecord(
            payment_id=payment_id,
            evidence_package_id="none",
            ai_activated=False,
            activation_reason=activation_reason,
            gemini_raw_output=None,
            verified_claims=[],
            confidence_level=confidence_result.get("outcome"),
            confidence_score=confidence_result.get("score"),
            abstained=confidence_result.get("abstain", False),
            investigation_type="advanced",
            investigation_outcome=confidence_result.get("outcome"),
            model_metadata={"provider": "none", "model": "none", "activation_reason": activation_reason},
            duration_ms=round(duration_ms, 1),
        )
        db.add(audit_record)
        db.commit()

        try:
            live_event_stream.publish_event(
                "investigation.completed",
                {
                    "incident_id": str(incident_row.id),
                    "payment_id": payment_id,
                    "investigation_type": "advanced",
                    "ai_activated": False,
                    "activation_reason": activation_reason,
                    "outcome": confidence_result.get("outcome"),
                    "confidence_score": confidence_result.get("overall_confidence"),
                    "confidence_level": confidence_result.get("confidence_level"),
                    "abstained": confidence_result.get("abstain", False),
                    "verdict": authoritative_result.get("verdict"),
                },
            )
        except Exception:
            pass

        return {
            "incident_id": str(incident_row.id),
            "payment_id": payment_id,
            "investigation_type": "advanced",
            "ai_activated": False,
            "activation_reason": activation_reason,
            "investigation_outcome": confidence_result.get("outcome"),
            "confidence": confidence_result,
            "abstained": confidence_result.get("abstain", False),
            "authoritative_result": authoritative_result,
            "advanced_investigation": None,
            "verified_claims": [],
            "hypothesis_verifications": [],
            "causal_chain_verifications": [],
            "missing_evidence_report": asdict(missing_report),
            "audit_record_id": str(audit_record.id),
            "duration_ms": round(duration_ms, 1),
        }

    # ── Branch: AI required — run advanced investigation ──────────────────────

    # 8. Build advanced evidence package (bounded, sanitized)
    adv_evidence_package = build_advanced_evidence_package(
        payment_id=payment_id,
        existing_events=events,
        reconstructed_state=reconstructed_state,
        incidents=incidents,
        webhook_diagnostics=webhook_diagnostics or None,
        similar_incidents=similar_incidents_ctx or None,
        recurring_patterns=patterns_ctx or None,
    )

    # 9. Invoke Gemini with advanced schema
    ai_result = investigate_advanced(adv_evidence_package)
    ai_error = ai_result.get("error")
    ai_duration_ms = ai_result.get("_duration_ms", 0)

    # 10. Handle AI unavailable
    if ai_error:
        logger.error(f"Advanced Gemini call failed: {ai_result.get('detail', ai_error)}")
        confidence_result = {
            "outcome": "AI_UNAVAILABLE",
            "score": 0.0,
            "reason": f"AI unavailable: {ai_error}",
            "abstain": True,
            "signals": {},
        }
        audit_record = AuditRecord(
            payment_id=payment_id,
            evidence_package_id=adv_evidence_package.get("evidence_package_id", "unknown"),
            ai_activated=True,
            activation_reason=activation_reason,
            gemini_raw_output={"error": ai_error},
            verified_claims=[],
            confidence_level="AI_UNAVAILABLE",
            confidence_score=0.0,
            abstained=True,
            investigation_type="advanced",
            evidence_package_hash=adv_evidence_package.get("evidence_package_hash"),
            investigation_outcome="AI_UNAVAILABLE",
            model_metadata={
                "provider": "google",
                "model": ai_result.get("_model", "gemini"),
                "duration_ms": ai_duration_ms,
                "activation_reason": activation_reason,
            },
            duration_ms=round((time.perf_counter() - start_time) * 1000, 1),
        )
        db.add(audit_record)
        db.commit()

        return {
            "incident_id": str(incident_row.id),
            "payment_id": payment_id,
            "investigation_type": "advanced",
            "ai_activated": True,
            "activation_reason": activation_reason,
            "investigation_outcome": "AI_UNAVAILABLE",
            "confidence": confidence_result,
            "abstained": True,
            "authoritative_result": authoritative_result,
            "advanced_investigation": None,
            "ai_error": ai_error,
            "verified_claims": [],
            "hypothesis_verifications": [],
            "causal_chain_verifications": [],
            "missing_evidence_report": None,
            "audit_record_id": str(audit_record.id),
            "duration_ms": round((time.perf_counter() - start_time) * 1000, 1),
        }

    # 11. Verify claims (5-verdict)
    raw_supporting_claims = ai_result.get("supporting_claims", [])[:6]
    raw_contradicting_claims = ai_result.get("contradicting_claims", [])[:4]
    all_raw_claims = raw_supporting_claims + raw_contradicting_claims

    verified_adv_claims = verify_advanced_claims(all_raw_claims, adv_evidence_package)

    # 12. Verify hypotheses evidence references
    all_hypotheses = [ai_result.get("primary_hypothesis", {})] + ai_result.get("alternative_hypotheses", [])[:3]
    hyp_verifications = verify_hypotheses([h for h in all_hypotheses if h], adv_evidence_package)

    # 13. Verify causal chain
    causal_chain = ai_result.get("causal_chain", [])[:8]
    causal_verifications = verify_causal_chain(causal_chain, adv_evidence_package)

    # 14. Compute deterministic confidence
    primary_hyp = ai_result.get("primary_hypothesis", {})
    confidence_result = compute_advanced_confidence(
        advanced_claims=[c.to_dict() for c in verified_adv_claims],
        hypothesis_verifications=[h.to_dict() for h in hyp_verifications],
        causal_step_verifications=[s.to_dict() for s in causal_verifications],
        incidents=incidents,
        authoritative_result=authoritative_result,
        ai_activated=True,
        ai_abstention_signal=ai_result.get("abstention_signal", "NONE"),
        primary_hypothesis_status=primary_hyp.get("status", ""),
    )

    missing_report = evaluate_missing_evidence(
        payment_id=payment_id,
        events=events,
        reconstructed_state=reconstructed_state,
        incidents=incidents,
        verified_claims=[]
    )

    # 15. Persist comprehensive audit record
    total_duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
    audit_record = AuditRecord(
        payment_id=payment_id,
        evidence_package_id=adv_evidence_package.get("evidence_package_id", "unknown"),
        ai_activated=True,
        activation_reason=activation_reason,
        gemini_raw_output={
            "summary": ai_result.get("summary"),
            "abstention_signal": ai_result.get("abstention_signal"),
            "primary_hypothesis": primary_hyp,
            "supporting_claims_count": len(raw_supporting_claims),
            "contradicting_claims_count": len(raw_contradicting_claims),
        },
        verified_claims=[c.to_dict() for c in verified_adv_claims],
        confidence_level=confidence_result.get("outcome"),
        confidence_score=confidence_result.get("score"),
        abstained=confidence_result.get("abstain", False),
        investigation_type="advanced",
        evidence_package_hash=adv_evidence_package.get("evidence_package_hash"),
        hypotheses=[h.to_dict() for h in hyp_verifications],
        causal_chain=[s.to_dict() for s in causal_verifications],
        investigation_outcome=confidence_result.get("outcome"),
        model_metadata={
            "provider": "google",
            "model": ai_result.get("_model", MODEL_NAME_META),
            "duration_ms": ai_duration_ms,
            "activation_reason": activation_reason,
        },
        duration_ms=total_duration_ms,
    )
    db.add(audit_record)
    db.commit()

    try:
        live_event_stream.publish_event(
            "investigation.completed",
            {
                "incident_id": str(incident_row.id),
                "payment_id": payment_id,
                "investigation_type": "advanced",
                "ai_activated": True,
                "activation_reason": activation_reason,
                "outcome": confidence_result.get("outcome"),
                "confidence_score": confidence_result.get("overall_confidence"),
                "confidence_level": confidence_result.get("confidence_level"),
                "abstained": confidence_result.get("abstain", False),
                "verdict": authoritative_result.get("verdict"),
                "hypotheses_count": len(hyp_verifications),
            },
        )
    except Exception:
        pass

    # 16. Build response
    return {
        "incident_id": str(incident_row.id),
        "payment_id": payment_id,
        "investigation_type": "advanced",
        "ai_activated": True,
        "activation_reason": activation_reason,
        "investigation_outcome": confidence_result.get("outcome"),
        "confidence": confidence_result,
        "abstained": confidence_result.get("abstain", False),
        "authoritative_result": authoritative_result,
        "advanced_investigation": {
            "summary": ai_result.get("summary"),
            "primary_hypothesis": ai_result.get("primary_hypothesis"),
            "alternative_hypotheses": ai_result.get("alternative_hypotheses", []),
            "causal_chain": causal_chain,
            "supporting_claims": raw_supporting_claims,
            "contradicting_claims": raw_contradicting_claims,
            "missing_evidence": ai_result.get("missing_evidence", [])[:5],
            "recommended_checks": ai_result.get("recommended_checks", [])[:5],
            "reasoning_summary": ai_result.get("reasoning_summary"),
            "why_not_alternatives": ai_result.get("why_not_alternatives", []),
            "abstention_signal": ai_result.get("abstention_signal", "NONE"),
        },
        "verified_claims": [c.to_dict() for c in verified_adv_claims],
        "hypothesis_verifications": [h.to_dict() for h in hyp_verifications],
        "causal_chain_verifications": [s.to_dict() for s in causal_verifications],
        "missing_evidence_report": asdict(missing_report),
        "model_metadata": {
            "provider": "google",
            "model": ai_result.get("_model", MODEL_NAME_META),
            "duration_ms": ai_duration_ms,
        },
        "audit_record_id": str(audit_record.id),
        "evidence_package_hash": adv_evidence_package.get("evidence_package_hash"),
        "duration_ms": total_duration_ms,
    }


# ── Constant used in audit records ────────────────────────────────────────────
MODEL_NAME_META = "gemini-2.0-flash"


@router.get("/{incident_id}/advanced/latest")
def get_latest_advanced_investigation(incident_id: str, db: Session = Depends(get_db)):
    """
    Retrieve the latest advanced investigation for an incident.
    """
    incident_row = _load_incident_by_id_or_payment(incident_id, db)
    payment_id = incident_row.payment_id

    record = (
        db.query(AuditRecord)
        .filter(
            AuditRecord.payment_id == payment_id,
            AuditRecord.investigation_type == "advanced",
        )
        .order_by(AuditRecord.timestamp.desc())
        .first()
    )

    if not record:
        raise HTTPException(status_code=404, detail="No advanced investigation found for this incident")

    claims = record.verified_claims if isinstance(record.verified_claims, list) else []
    return {
        "id": str(record.id),
        "incident_id": incident_id,
        "payment_id": payment_id,
        "investigation_type": record.investigation_type,
        "ai_activated": record.ai_activated,
        "activation_reason": record.activation_reason,
        "investigation_outcome": record.investigation_outcome,
        "confidence_level": record.confidence_level,
        "confidence_score": record.confidence_score,
        "abstained": record.abstained,
        "evidence_package_hash": record.evidence_package_hash,
        "hypotheses": record.hypotheses,
        "causal_chain": record.causal_chain,
        "verified_claims": claims,
        "model_metadata": record.model_metadata,
        "duration_ms": record.duration_ms,
        "timestamp": record.timestamp.isoformat() if record.timestamp else None,
    }


@router.get("/{incident_id}/advanced/history")
def get_advanced_investigation_history(incident_id: str, db: Session = Depends(get_db)):
    """
    Retrieve all advanced investigation versions for an incident.
    Each run creates a new version; previous versions are never overwritten.
    """
    incident_row = _load_incident_by_id_or_payment(incident_id, db)
    payment_id = incident_row.payment_id

    rows = (
        db.query(AuditRecord)
        .filter(
            AuditRecord.payment_id == payment_id,
            AuditRecord.investigation_type == "advanced",
        )
        .order_by(AuditRecord.timestamp.asc())
        .all()
    )

    versions = []
    for idx, r in enumerate(rows):
        claims = r.verified_claims if isinstance(r.verified_claims, list) else []
        verified_count = sum(1 for c in claims if isinstance(c, dict) and c.get("verdict") == "VERIFIED")
        contradicted_count = sum(1 for c in claims if isinstance(c, dict) and c.get("verdict") == "CONTRADICTED")
        versions.append({
            "version_number": idx + 1,
            "id": str(r.id),
            "payment_id": payment_id,
            "ai_activated": r.ai_activated,
            "activation_reason": r.activation_reason,
            "investigation_outcome": r.investigation_outcome,
            "confidence_level": r.confidence_level,
            "confidence_score": r.confidence_score,
            "abstained": r.abstained,
            "claims_count": len(claims),
            "verified_claims_count": verified_count,
            "contradicted_claims_count": contradicted_count,
            "evidence_package_hash": r.evidence_package_hash,
            "model_metadata": r.model_metadata,
            "duration_ms": r.duration_ms,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        })

    return {
        "incident_id": incident_id,
        "payment_id": payment_id,
        "total_versions": len(versions),
        "versions": versions,
    }

