"""
FastAPI Router for PayTrace Phase 5 — Advanced Incident Intelligence.
Provides endpoints for deterministic similarity scoring and recurring pattern exploration.
"""

from typing import List, Optional, Dict, Any
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
import uuid
import datetime

from app.database import get_db
from app.models import Incident, NormalizedEvent, PaymentState, AuditRecord
from app.incident_fingerprint import compute_incident_fingerprint, IncidentFingerprint
from app.similarity_engine import compute_similarity
from app.pattern_detector import detect_recurring_patterns, RecurringPattern

router = APIRouter(tags=["intelligence"])


# --- Response Schemas ---

class SimilarIncidentItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    incident_id: str
    payment_id: Optional[str] = None
    order_id: Optional[str] = None
    incident_type: str
    severity: str
    description: str
    resolved: bool = False
    detected_at: Optional[str] = None
    similarity_score: float
    matching_features: List[str]
    non_matching_critical_features: List[str]
    comparison_summary: str


class PatternSummaryItem(BaseModel):
    pattern_id: str
    pattern_name: str
    pattern_type: str
    incident_count: int
    affected_payments_count: int
    severity: str
    first_detected_at: Optional[str] = None
    last_detected_at: Optional[str] = None
    pattern_strength: str
    diagnostic_characteristics: List[str]
    supporting_incident_ids: List[str]
    supporting_payment_ids: List[str]
    sample_incidents: List[Dict[str, Any]] = []


class SimilarIncidentsResponse(BaseModel):
    incident_id: str
    payment_id: Optional[str] = None
    fingerprint: Dict[str, Any]
    similar_incidents: List[SimilarIncidentItem]
    recurring_patterns: List[PatternSummaryItem] = []
    total_compared: int
    matches_found: int


# --- High-Performance Batch Context Loader (Prevents N+1 DB roundtrips) ---

def _load_incident_contexts_batch(incidents: List[Incident], db: Session) -> List[Dict[str, Any]]:
    """
    Bulk loads evidence, payment state, and audit records in 3 queries
    instead of running 3 queries per incident (N+1 prevention).
    """
    if not incidents:
        return []

    pids = list({inc.payment_id for inc in incidents if inc.payment_id})

    events_by_pid: Dict[str, List[NormalizedEvent]] = defaultdict(list)
    state_by_pid: Dict[str, PaymentState] = {}
    audit_by_pid: Dict[str, AuditRecord] = {}

    if pids:
        # 1. Bulk query events
        all_events = db.query(NormalizedEvent).filter(NormalizedEvent.payment_id.in_(pids)).all()
        for ev in all_events:
            if ev.payment_id:
                events_by_pid[ev.payment_id].append(ev)

        # 2. Bulk query payment states
        all_states = db.query(PaymentState).filter(PaymentState.payment_id.in_(pids)).all()
        for ps in all_states:
            if ps.payment_id:
                state_by_pid[ps.payment_id] = ps

        # 3. Bulk query audit records (ordered by timestamp asc so latest overwrites)
        all_audits = (
            db.query(AuditRecord)
            .filter(AuditRecord.payment_id.in_(pids))
            .order_by(AuditRecord.timestamp.asc())
            .all()
        )
        for ar in all_audits:
            if ar.payment_id:
                audit_by_pid[ar.payment_id] = ar

    contexts = []
    for inc in incidents:
        pid = inc.payment_id
        evs = events_by_pid.get(pid, []) if pid else []
        ps = state_by_pid.get(pid) if pid else None
        ar = audit_by_pid.get(pid) if pid else None

        fp = compute_incident_fingerprint(
            incident=inc,
            events=evs,
            payment_state=ps,
            audit_record=ar,
        )

        contexts.append({
            "incident": inc,
            "fingerprint": fp,
            "events": evs,
            "payment_state": ps,
            "audit_record": ar,
        })

    return contexts


# --- Endpoints ---

@router.get("/incidents/{incident_id}/similar", response_model=SimilarIncidentsResponse)
def get_similar_incidents(
    incident_id: str,
    min_similarity: float = Query(0.35, ge=0.0, le=1.0),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Find historical incidents deterministically similar to the specified incident.
    Accepts either an incident UUID or a payment_id.
    """
    # 1. Resolve selected incident
    selected_incident = None
    try:
        uid = uuid.UUID(incident_id)
        selected_incident = db.query(Incident).filter(Incident.id == uid).first()
    except (ValueError, TypeError, AttributeError):
        pass

    if not selected_incident:
        selected_incident = (
            db.query(Incident)
            .filter(Incident.payment_id == incident_id)
            .order_by(Incident.detected_at.desc())
            .first()
        )

    if not selected_incident:
        raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' not found")

    # 2. Fetch historical incidents
    all_incidents = db.query(Incident).order_by(Incident.detected_at.desc()).limit(100).all()
    if selected_incident not in all_incidents:
        all_incidents.insert(0, selected_incident)

    # 3. Batch load contexts
    all_contexts = _load_incident_contexts_batch(all_incidents, db)

    selected_ctx = next(
        (c for c in all_contexts if str(c["incident"].id) == str(selected_incident.id)),
        None,
    )
    if not selected_ctx:
        selected_ctx = _load_incident_contexts_batch([selected_incident], db)[0]

    selected_fp = selected_ctx["fingerprint"]
    historical_contexts = [
        c for c in all_contexts if str(c["incident"].id) != str(selected_incident.id)
    ]

    # 4. Calculate deterministic similarity against each historical incident
    similar_items: List[SimilarIncidentItem] = []
    for ctx in historical_contexts:
        inc = ctx["incident"]
        fp = ctx["fingerprint"]
        sim = compute_similarity(selected_fp, fp)

        if sim.similarity_score >= min_similarity:
            similar_items.append(
                SimilarIncidentItem(
                    incident_id=str(inc.id),
                    payment_id=inc.payment_id,
                    order_id=inc.order_id,
                    incident_type=inc.incident_type,
                    severity=inc.severity,
                    description=inc.description,
                    resolved=bool(inc.resolved),
                    detected_at=inc.detected_at.isoformat() if isinstance(inc.detected_at, datetime.datetime) else None,
                    similarity_score=sim.similarity_score,
                    matching_features=sim.matching_features,
                    non_matching_critical_features=sim.non_matching_critical_features,
                    comparison_summary=sim.comparison_summary,
                )
            )

    # 5. Stable deterministic sort: score DESC, detected_at DESC, incident_id ASC
    similar_items.sort(
        key=lambda x: (
            -x.similarity_score,
            x.detected_at or "",
            x.incident_id,
        )
    )
    ranked_similar = similar_items[:limit]

    # 6. Detect patterns across the dataset
    all_patterns = detect_recurring_patterns(all_contexts)
    this_inc_id = str(selected_incident.id)
    applicable_patterns = [
        PatternSummaryItem(**p.to_dict())
        for p in all_patterns
        if this_inc_id in p.supporting_incident_ids
    ]

    return SimilarIncidentsResponse(
        incident_id=str(selected_incident.id),
        payment_id=selected_incident.payment_id,
        fingerprint=selected_fp.canonical_dict(),
        similar_incidents=ranked_similar,
        recurring_patterns=applicable_patterns,
        total_compared=len(historical_contexts),
        matches_found=len(ranked_similar),
    )


@router.get("/patterns", response_model=List[PatternSummaryItem])
def list_recurring_patterns(
    db: Session = Depends(get_db),
):
    """
    Retrieve all recurring incident patterns detected deterministically
    across stored incidents in the database.
    """
    incidents = db.query(Incident).order_by(Incident.detected_at.desc()).limit(150).all()
    if not incidents:
        return []

    contexts = _load_incident_contexts_batch(incidents, db)
    patterns = detect_recurring_patterns(contexts)
    return [PatternSummaryItem(**p.to_dict()) for p in patterns]


@router.get("/patterns/{pattern_id}", response_model=PatternSummaryItem)
def get_pattern_detail(
    pattern_id: str,
    db: Session = Depends(get_db),
):
    """
    Retrieve full details and supporting incidents for a specific recurring pattern.
    """
    incidents = db.query(Incident).order_by(Incident.detected_at.desc()).limit(150).all()
    contexts = _load_incident_contexts_batch(incidents, db)
    patterns = detect_recurring_patterns(contexts)

    for p in patterns:
        if p.pattern_id.lower() == pattern_id.lower():
            return PatternSummaryItem(**p.to_dict())

    raise HTTPException(status_code=404, detail=f"Pattern '{pattern_id}' not found")
