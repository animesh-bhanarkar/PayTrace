from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, ConfigDict
import datetime

from app.database import get_db
from app.models import Incident, NormalizedEvent

router = APIRouter(prefix="/search", tags=["search"])


class SearchResultItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str  # "INCIDENT" | "EVENT" | "EVIDENCE"
    title: str
    subtitle: str
    payment_id: Optional[str] = None
    order_id: Optional[str] = None
    timestamp: Optional[str] = None
    severity: Optional[str] = None
    badge: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


@router.get("", response_model=List[SearchResultItem])
def search_global(
    q: str = Query(..., min_length=1, description="Search query string"),
    limit: int = Query(30, ge=1, le=100),
    type_filter: Optional[str] = Query(None, description="Optional type filter (INCIDENT, EVENT)"),
    db: Session = Depends(get_db),
):
    """
    Deterministic multi-attribute search across incidents and normalized events.
    Searches payment_id, order_id, event_type, incident_type, and description.
    """
    clean_query = q.strip()
    if not clean_query:
        return []

    pattern = f"%{clean_query}%"
    results: List[SearchResultItem] = []

    # 1. Search Incidents
    if not type_filter or type_filter.upper() in ["INCIDENT", "INCIDENTS"]:
        incidents = (
            db.query(Incident)
            .filter(
                or_(
                    Incident.payment_id.ilike(pattern),
                    Incident.order_id.ilike(pattern),
                    Incident.incident_type.ilike(pattern),
                    Incident.description.ilike(pattern),
                )
            )
            .order_by(Incident.detected_at.desc())
            .limit(limit)
            .all()
        )

        for inc in incidents:
            results.append(
                SearchResultItem(
                    id=str(inc.id),
                    type="INCIDENT",
                    title=f"Incident: {inc.incident_type}",
                    subtitle=inc.description,
                    payment_id=inc.payment_id,
                    order_id=inc.order_id,
                    timestamp=inc.detected_at.isoformat() if isinstance(inc.detected_at, datetime.datetime) else None,
                    severity=inc.severity,
                    badge=inc.severity,
                    details={
                        "resolved": inc.resolved,
                        "evidence_ids": inc.evidence_ids or [],
                    },
                )
            )

    # 2. Search Normalized Events
    if not type_filter or type_filter.upper() in ["EVENT", "EVENTS", "EVIDENCE"]:
        events = (
            db.query(NormalizedEvent)
            .filter(
                or_(
                    NormalizedEvent.event_id.ilike(pattern),
                    NormalizedEvent.payment_id.ilike(pattern),
                    NormalizedEvent.order_id.ilike(pattern),
                    NormalizedEvent.event_type.ilike(pattern),
                )
            )
            .order_by(NormalizedEvent.event_timestamp.desc())
            .limit(limit)
            .all()
        )

        for ev in events:
            results.append(
                SearchResultItem(
                    id=str(ev.id),
                    type="EVENT",
                    title=f"Event: {ev.event_type}",
                    subtitle=f"Source: {ev.source} • Status: {ev.status}",
                    payment_id=ev.payment_id,
                    order_id=ev.order_id,
                    timestamp=ev.event_timestamp.isoformat() if isinstance(ev.event_timestamp, datetime.datetime) else None,
                    severity="LOW" if ev.signature_valid else "HIGH",
                    badge="VALID" if ev.signature_valid else "INVALID_SIG",
                    details={
                        "event_id": ev.event_id,
                        "source": ev.source,
                        "signature_valid": ev.signature_valid,
                        "payload_hash": ev.payload_hash,
                    },
                )
            )

    # 3. Search Recurring Patterns
    if not type_filter or type_filter.upper() in ["PATTERN", "PATTERNS"]:
        try:
            from app.routers.patterns import list_recurring_patterns
            patterns = list_recurring_patterns(db=db)
            q_lower = clean_query.lower()
            for p in patterns:
                if (
                    q_lower in p.pattern_id.lower()
                    or q_lower in p.pattern_name.lower()
                    or q_lower in p.pattern_type.lower()
                ):
                    results.append(
                        SearchResultItem(
                            id=p.pattern_id,
                            type="PATTERN",
                            title=f"Pattern: {p.pattern_name}",
                            subtitle=f"{p.incident_count} incidents • Strength: {p.pattern_strength}",
                            payment_id=p.supporting_payment_ids[0] if p.supporting_payment_ids else None,
                            order_id=None,
                            timestamp=p.last_detected_at,
                            severity=p.severity,
                            badge=p.pattern_strength,
                            details={
                                "pattern_id": p.pattern_id,
                                "incident_count": p.incident_count,
                                "pattern_type": p.pattern_type,
                            },
                        )
                    )
        except Exception:
            pass

    return results[:limit]
