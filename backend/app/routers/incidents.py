import re
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict, Field
import datetime
import uuid

from app.database import get_db, get_engine, Base
from app.models import Incident, IncidentNote, WebhookEvent, PaymentState, NormalizedEvent
from sqlalchemy import or_
from app.webhook_diagnostics import (
    detect_out_of_order,
    detect_late_authorization,
    reconcile_states,
    sanitize_webhook_payload,
)

router = APIRouter(prefix="/incidents", tags=["incidents"])

# Ensure tables are registered
try:
    _engine = get_engine()
    Base.metadata.create_all(bind=_engine)
except Exception:
    pass

VALID_OPERATIONAL_STATUSES = {"OPEN", "INVESTIGATING", "ACTION_REQUIRED", "RESOLVED"}
VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
TAG_REGEX = re.compile(r"^[a-z0-9_\-]+$")


class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    incident_type: str
    payment_id: Optional[str] = None
    order_id: Optional[str] = None
    description: str
    severity: str  # Technical severity
    evidence_ids: List[str] = []
    resolved: bool = False
    resolution_notes: Optional[str] = None
    resolved_at: Optional[str] = None
    detected_at: Optional[str] = None
    # Phase 6 operational fields
    operational_status: str = "OPEN"
    priority: str = "MEDIUM"
    tags: List[str] = []
    assignee: Optional[str] = None
    workflow_history: List[Dict[str, Any]] = []


class ResolveRequest(BaseModel):
    resolution_notes: Optional[str] = None
    actor: Optional[str] = "Local operator"


class StatusUpdateRequest(BaseModel):
    status: str
    actor: Optional[str] = "Local operator"
    notes: Optional[str] = None


class PriorityUpdateRequest(BaseModel):
    priority: str
    actor: Optional[str] = "Local operator"


class TagAddRequest(BaseModel):
    tag: str = Field(..., min_length=1, max_length=30)
    actor: Optional[str] = "Local operator"


class AssigneeUpdateRequest(BaseModel):
    assignee: Optional[str] = Field(None, max_length=255)
    actor: Optional[str] = "Local operator"


class NoteCreateRequest(BaseModel):
    author: Optional[str] = "Developer"
    note_text: str = Field(..., min_length=1, max_length=2048)


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    payment_id: str
    author: str
    note_text: str
    created_at: Optional[str] = None


def _find_incidents(db: Session, payment_id_or_id: str) -> List[Incident]:
    query = db.query(Incident)
    try:
        uid = uuid.UUID(payment_id_or_id)
        rows = query.filter((Incident.payment_id == payment_id_or_id) | (Incident.id == uid)).all()
    except (ValueError, TypeError, AttributeError):
        rows = query.filter(Incident.payment_id == payment_id_or_id).all()
    return rows


def _record_workflow_event(
    incident: Incident,
    action: str,
    field: Optional[str] = None,
    old_val: Optional[Any] = None,
    new_val: Optional[Any] = None,
    actor: Optional[str] = "Local operator",
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    history = list(incident.workflow_history or [])
    entry = {
        "id": f"wf_{uuid.uuid4().hex[:8]}",
        "action": action,
        "field": field,
        "old_value": old_val,
        "new_value": new_val,
        "actor": actor.strip() if actor and actor.strip() else "Local operator",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "notes": notes,
    }
    history.insert(0, entry)
    incident.workflow_history = history
    return entry


def _serialize_incident(r: Incident) -> IncidentResponse:
    # Ensure operational fields have safe defaults
    op_status = r.operational_status or ("RESOLVED" if r.resolved else "OPEN")
    priority = r.priority or "MEDIUM"
    tags = r.tags if isinstance(r.tags, list) else []
    wf_history = r.workflow_history if isinstance(r.workflow_history, list) else []

    return IncidentResponse(
        id=str(r.id),
        incident_type=r.incident_type,
        payment_id=r.payment_id,
        order_id=r.order_id,
        description=r.description,
        severity=r.severity,
        evidence_ids=r.evidence_ids if isinstance(r.evidence_ids, list) else [],
        resolved=bool(r.resolved),
        resolution_notes=r.resolution_notes,
        resolved_at=r.resolved_at.isoformat() if isinstance(r.resolved_at, datetime.datetime) else None,
        detected_at=r.detected_at.isoformat() if isinstance(r.detected_at, datetime.datetime) else None,
        operational_status=op_status,
        priority=priority,
        tags=tags,
        assignee=r.assignee,
        workflow_history=wf_history,
    )


@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    limit: int = Query(50, ge=1, le=200),
    severity: Optional[str] = None,
    incident_type: Optional[str] = None,
    payment_id: Optional[str] = None,
    operational_status: Optional[str] = None,
    priority: Optional[str] = None,
    tag: Optional[str] = None,
    assignee: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Retrieve real persisted incidents from Supabase PostgreSQL with operational filtering.
    """
    query = db.query(Incident)
    if severity:
        query = query.filter(Incident.severity == severity.upper())
    if incident_type:
        query = query.filter(Incident.incident_type == incident_type)
    if payment_id:
        query = query.filter(Incident.payment_id == payment_id)
    if operational_status:
        query = query.filter(Incident.operational_status == operational_status.upper())
    if priority:
        query = query.filter(Incident.priority == priority.upper())
    if assignee:
        if assignee.strip().upper() == "UNASSIGNED":
            query = query.filter((Incident.assignee.is_(None)) | (Incident.assignee == ""))
        else:
            query = query.filter(Incident.assignee.ilike(f"%{assignee.strip()}%"))

    rows = query.order_by(Incident.detected_at.desc()).limit(limit).all()

    if tag:
        clean_tag = tag.strip().lower()
        rows = [r for r in rows if r.tags and clean_tag in [t.lower() for t in r.tags]]

    return [_serialize_incident(r) for r in rows]


@router.get("/{payment_id_or_id}/history", response_model=List[Dict[str, Any]])
def get_incident_history(
    payment_id_or_id: str,
    db: Session = Depends(get_db),
):
    """
    Retrieve auditable workflow history log for an incident.
    """
    rows = _find_incidents(db, payment_id_or_id)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with identifier '{payment_id_or_id}' not found.",
        )
    # Return workflow_history of the primary matching incident
    history = rows[0].workflow_history
    return history if isinstance(history, list) else []


@router.patch("/{payment_id_or_id}/status", response_model=IncidentResponse)
def update_incident_status(
    payment_id_or_id: str,
    request: StatusUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Update the operational status of an incident (OPEN, INVESTIGATING, ACTION_REQUIRED, RESOLVED).
    Appends an auditable change entry to workflow_history.
    """
    norm_status = request.status.strip().upper()
    if norm_status not in VALID_OPERATIONAL_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid operational status '{request.status}'. Allowed values: {sorted(list(VALID_OPERATIONAL_STATUSES))}",
        )

    rows = _find_incidents(db, payment_id_or_id)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with identifier '{payment_id_or_id}' not found.",
        )

    for r in rows:
        old_val = r.operational_status or ("RESOLVED" if r.resolved else "OPEN")
        r.operational_status = norm_status
        if norm_status == "RESOLVED":
            r.resolved = True
            r.resolved_at = datetime.datetime.now(datetime.timezone.utc)
            if request.notes:
                r.resolution_notes = request.notes.strip()
        else:
            r.resolved = False
            r.resolved_at = None

        _record_workflow_event(
            incident=r,
            action="status_change",
            field="operational_status",
            old_val=old_val,
            new_val=norm_status,
            actor=request.actor,
            notes=request.notes,
        )

    db.commit()
    db.refresh(rows[0])
    return _serialize_incident(rows[0])


@router.patch("/{payment_id_or_id}/priority", response_model=IncidentResponse)
def update_incident_priority(
    payment_id_or_id: str,
    request: PriorityUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Update operational triage priority of an incident (LOW, MEDIUM, HIGH, CRITICAL).
    Distinct from technical severity. Appends audit entry.
    """
    norm_priority = request.priority.strip().upper()
    if norm_priority not in VALID_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid operational priority '{request.priority}'. Allowed values: {sorted(list(VALID_PRIORITIES))}",
        )

    rows = _find_incidents(db, payment_id_or_id)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with identifier '{payment_id_or_id}' not found.",
        )

    for r in rows:
        old_val = r.priority or "MEDIUM"
        r.priority = norm_priority
        _record_workflow_event(
            incident=r,
            action="priority_change",
            field="priority",
            old_val=old_val,
            new_val=norm_priority,
            actor=request.actor,
        )

    db.commit()
    db.refresh(rows[0])
    return _serialize_incident(rows[0])


@router.post("/{payment_id_or_id}/tags", response_model=IncidentResponse)
def add_incident_tag(
    payment_id_or_id: str,
    request: TagAddRequest,
    db: Session = Depends(get_db),
):
    """
    Attach an operational tag to an incident. Validates tag format and prevents duplicates.
    """
    raw_tag = request.tag.strip().lower()
    if not raw_tag or not TAG_REGEX.match(raw_tag):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tag must be 1-30 characters long and contain only lowercase letters, numbers, underscores, or hyphens.",
        )

    rows = _find_incidents(db, payment_id_or_id)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with identifier '{payment_id_or_id}' not found.",
        )

    for r in rows:
        current_tags = list(r.tags or [])
        if raw_tag not in current_tags:
            current_tags.append(raw_tag)
            r.tags = current_tags
            _record_workflow_event(
                incident=r,
                action="tag_added",
                field="tags",
                old_val=None,
                new_val=raw_tag,
                actor=request.actor,
            )

    db.commit()
    db.refresh(rows[0])
    return _serialize_incident(rows[0])


@router.delete("/{payment_id_or_id}/tags/{tag}", response_model=IncidentResponse)
def remove_incident_tag(
    payment_id_or_id: str,
    tag: str,
    actor: Optional[str] = Query("Local operator"),
    db: Session = Depends(get_db),
):
    """
    Remove an operational tag from an incident.
    """
    clean_tag = tag.strip().lower()
    rows = _find_incidents(db, payment_id_or_id)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with identifier '{payment_id_or_id}' not found.",
        )

    for r in rows:
        current_tags = list(r.tags or [])
        if clean_tag in current_tags:
            current_tags.remove(clean_tag)
            r.tags = current_tags
            _record_workflow_event(
                incident=r,
                action="tag_removed",
                field="tags",
                old_val=clean_tag,
                new_val=None,
                actor=actor,
            )

    db.commit()
    db.refresh(rows[0])
    return _serialize_incident(rows[0])


@router.patch("/{payment_id_or_id}/assignee", response_model=IncidentResponse)
def update_incident_assignee(
    payment_id_or_id: str,
    request: AssigneeUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Set or clear operational assignment/investigator name.
    Lightweight operational metadata (not an RBAC or identity system).
    """
    new_assignee = request.assignee.strip() if request.assignee and request.assignee.strip() else None

    rows = _find_incidents(db, payment_id_or_id)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident with identifier '{payment_id_or_id}' not found.",
        )

    for r in rows:
        old_val = r.assignee
        r.assignee = new_assignee
        _record_workflow_event(
            incident=r,
            action="assignee_change",
            field="assignee",
            old_val=old_val,
            new_val=new_assignee,
            actor=request.actor,
        )

    db.commit()
    db.refresh(rows[0])
    return _serialize_incident(rows[0])


@router.post("/{payment_id}/resolve")
def resolve_incident(
    payment_id: str,
    request: Optional[ResolveRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Resolve an incident workflow. Records human resolution state, timestamp, and notes.
    Does NOT modify financial state or execute payment actions.
    Preserves backwards-compatibility with Phase 2 return schema.
    """
    notes = request.resolution_notes if request else None
    actor = request.actor if request and request.actor else "Local operator"

    rows = _find_incidents(db, payment_id)

    now = datetime.datetime.now(datetime.timezone.utc)
    for r in rows:
        r.resolved = True
        r.resolved_at = now
        r.operational_status = "RESOLVED"
        if notes:
            r.resolution_notes = notes
        _record_workflow_event(
            incident=r,
            action="resolved",
            field="operational_status",
            old_val="OPEN",
            new_val="RESOLVED",
            actor=actor,
            notes=notes,
        )

    if rows:
        db.commit()

    return {
        "status": "resolved",
        "payment_id": payment_id,
        "resolved": True,
        "operational_status": "RESOLVED",
        "resolved_at": now.isoformat(),
        "updated_records": len(rows),
        "resolution_notes": notes,
    }


@router.post("/{payment_id}/reopen")
def reopen_incident(
    payment_id: str,
    actor: Optional[str] = Query("Local operator"),
    db: Session = Depends(get_db),
):
    """
    Reopen an incident workflow.
    Preserves backwards-compatibility with Phase 2 return schema.
    """
    rows = _find_incidents(db, payment_id)

    for r in rows:
        r.resolved = False
        r.resolved_at = None
        r.operational_status = "OPEN"
        _record_workflow_event(
            incident=r,
            action="reopened",
            field="operational_status",
            old_val="RESOLVED",
            new_val="OPEN",
            actor=actor,
        )

    if rows:
        db.commit()

    return {
        "status": "reopened",
        "payment_id": payment_id,
        "resolved": False,
        "operational_status": "OPEN",
        "updated_records": len(rows),
    }


@router.get("/{payment_id}/notes", response_model=List[NoteResponse])
def get_incident_notes(
    payment_id: str,
    db: Session = Depends(get_db),
):
    """
    Retrieve human investigator notes for a payment incident.
    """
    notes = (
        db.query(IncidentNote)
        .filter(IncidentNote.payment_id == payment_id)
        .order_by(IncidentNote.created_at.asc())
        .all()
    )

    return [
        NoteResponse(
            id=str(n.id),
            payment_id=n.payment_id,
            author=n.author,
            note_text=n.note_text,
            created_at=n.created_at.isoformat() if isinstance(n.created_at, datetime.datetime) else None,
        )
        for n in notes
    ]


@router.post("/{payment_id}/notes", response_model=NoteResponse)
def add_incident_note(
    payment_id: str,
    request: NoteCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Add a human investigator note with input validation.
    Human notes are NOT trusted payment evidence.
    """
    cleaned_text = request.note_text.strip()
    if not cleaned_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="note_text must not be empty.",
        )
    if len(cleaned_text) > 2048:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="note_text exceeds maximum length of 2048 characters.",
        )

    author = (request.author.strip() if request.author and request.author.strip() else "Developer")

    note = IncidentNote(
        payment_id=payment_id,
        author=author,
        note_text=cleaned_text,
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return NoteResponse(
        id=str(note.id),
        payment_id=note.payment_id,
        author=note.author,
        note_text=note.note_text,
        created_at=note.created_at.isoformat() if isinstance(note.created_at, datetime.datetime) else None,
    )


@router.get("/{id_or_payment_id}/webhooks")
def get_incident_webhooks(
    id_or_payment_id: str,
    db: Session = Depends(get_db),
):
    """
    Get all correlated webhook delivery observations, diagnostics, and reconciliation for an incident.
    """
    # 1. Resolve incident by id or payment_id
    incident = None
    is_valid_uuid = False
    try:
        uuid.UUID(str(id_or_payment_id))
        is_valid_uuid = True
    except (ValueError, AttributeError):
        is_valid_uuid = False

    if is_valid_uuid:
        incident = db.query(Incident).filter(Incident.id == id_or_payment_id).first()
    if not incident:
        incident = db.query(Incident).filter(Incident.payment_id == id_or_payment_id).first()

    payment_id = incident.payment_id if incident else id_or_payment_id
    order_id = incident.order_id if incident else None

    # 2. Correlate webhooks
    wh_query = db.query(WebhookEvent)
    filter_clauses = []
    if payment_id:
        filter_clauses.extend([WebhookEvent.payment_id == payment_id, WebhookEvent.entity_id == payment_id])
    if order_id:
        filter_clauses.append(WebhookEvent.order_id == order_id)

    if filter_clauses:
        wh_events = wh_query.filter(or_(*filter_clauses)).order_by(WebhookEvent.id.asc()).all()
    else:
        wh_events = []

    # Diagnostics
    trusted_events = [w for w in wh_events if w.signature_valid]
    out_of_order_diag = detect_out_of_order(trusted_events)
    late_auth_diag = detect_late_authorization(trusted_events)

    # Reconciliation
    auth_row = db.query(PaymentState).filter(PaymentState.payment_id == payment_id).first() if payment_id else None
    auth_state = auth_row.current_state if auth_row else None

    merchant_row = (
        db.query(NormalizedEvent)
        .filter(NormalizedEvent.payment_id == payment_id, NormalizedEvent.source == "merchant")
        .first()
        if payment_id else None
    )
    merchant_state = merchant_row.status if merchant_row else None

    reconciliation = reconcile_states(auth_state, trusted_events, merchant_state)

    return {
        "payment_id": payment_id,
        "order_id": order_id,
        "correlated_webhooks_count": len(wh_events),
        "trusted_webhooks_count": len(trusted_events),
        "out_of_order_diagnostics": out_of_order_diag,
        "late_authorization_diagnostics": late_auth_diag,
        "reconciliation": reconciliation,
        "webhooks": [
            {
                "id": w.id,
                "razorpay_event_id": w.razorpay_event_id,
                "trust_status": w.trust_status or ("TRUSTED" if w.signature_valid else "UNTRUSTED"),
                "duplicate_status": w.duplicate_status or "ORIGINAL",
                "signature_valid": w.signature_valid,
                "event_type": w.event_type,
                "payment_id": w.payment_id or w.entity_id,
                "order_id": w.order_id,
                "event_timestamp": w.event_timestamp.isoformat() if w.event_timestamp else None,
                "ingestion_timestamp": w.ingestion_timestamp.isoformat() if w.ingestion_timestamp else None,
                "delivery_delay_seconds": w.delivery_delay_seconds,
                "error_details": w.error_details,
                "raw_payload": sanitize_webhook_payload(w.raw_payload),
                "processing_notes": w.processing_notes,
            }
            for w in wh_events
        ],
    }
