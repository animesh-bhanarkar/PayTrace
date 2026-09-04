from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
import datetime

from app.database import get_db
from app.models import Incident

router = APIRouter(prefix="/incidents", tags=["incidents"])

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
    detected_at: Optional[str] = None

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
                detected_at=r.detected_at.isoformat() if isinstance(r.detected_at, datetime.datetime) else None,
            )
        )
    return results
