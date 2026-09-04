from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
import datetime
import uuid

from app.database import get_db, get_engine, Base
from app.models import Incident, IncidentNote

router = APIRouter(prefix="/incidents", tags=["incidents"])

# Ensure tables are registered
try:
    _engine = get_engine()
    Base.metadata.create_all(bind=_engine)
except Exception:
    pass

class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    incident_type: str
    payment_id: Optional[str] = None
    order_id: Optional[str] = None
    description: str
    severity: str
    evidence_ids: List[str] = []
    resolved: bool = False
    resolution_notes: Optional[str] = None
    detected_at: Optional[str] = None

class ResolveRequest(BaseModel):
    resolution_notes: Optional[str] = None

class NoteCreateRequest(BaseModel):
    author: Optional[str] = "Developer"
    note_text: str

class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    payment_id: str
    author: str
    note_text: str
    created_at: Optional[str] = None

@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    limit: int = Query(50, ge=1, le=200),
    severity: Optional[str] = None,
    incident_type: Optional[str] = None,
    payment_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Retrieve real persisted incidents from Supabase PostgreSQL.
    """
    query = db.query(Incident)
    if severity:
        query = query.filter(Incident.severity == severity.upper())
    if incident_type:
        query = query.filter(Incident.incident_type == incident_type)
    if payment_id:
        query = query.filter(Incident.payment_id == payment_id)

    rows = query.order_by(Incident.detected_at.desc()).limit(limit).all()

    results = []
    for r in rows:
        results.append(
            IncidentResponse(
                id=str(r.id),
                incident_type=r.incident_type,
                payment_id=r.payment_id,
                order_id=r.order_id,
                description=r.description,
                severity=r.severity,
                evidence_ids=r.evidence_ids if isinstance(r.evidence_ids, list) else [],
                resolved=bool(r.resolved),
                resolution_notes=r.resolution_notes,
                detected_at=r.detected_at.isoformat() if isinstance(r.detected_at, datetime.datetime) else None,
            )
        )
    return results


@router.post("/{payment_id}/resolve")
def resolve_incident(
    payment_id: str,
    request: Optional[ResolveRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Resolve an incident workflow. Records human resolution state and notes.
    Does NOT modify financial state or execute payment actions.
    """
    notes = request.resolution_notes if request else None
    
    query = db.query(Incident)
    try:
        uid = uuid.UUID(payment_id)
        rows = query.filter((Incident.payment_id == payment_id) | (Incident.id == uid)).all()
    except (ValueError, TypeError, AttributeError):
        rows = query.filter(Incident.payment_id == payment_id).all()

    for r in rows:
        r.resolved = True
        if notes:
            r.resolution_notes = notes
    if rows:
        db.commit()

    return {
        "status": "resolved",
        "payment_id": payment_id,
        "resolved": True,
        "updated_records": len(rows),
        "resolution_notes": notes,
    }


@router.post("/{payment_id}/reopen")
def reopen_incident(
    payment_id: str,
    db: Session = Depends(get_db),
):
    """
    Reopen an incident workflow.
    """
    query = db.query(Incident)
    try:
        uid = uuid.UUID(payment_id)
        rows = query.filter((Incident.payment_id == payment_id) | (Incident.id == uid)).all()
    except (ValueError, TypeError, AttributeError):
        rows = query.filter(Incident.payment_id == payment_id).all()

    for r in rows:
        r.resolved = False
    if rows:
        db.commit()

    return {
        "status": "reopened",
        "payment_id": payment_id,
        "resolved": False,
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
    Add a human investigator note.
    """
    note = IncidentNote(
        payment_id=payment_id,
        author=request.author or "Developer",
        note_text=request.note_text.strip(),
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
