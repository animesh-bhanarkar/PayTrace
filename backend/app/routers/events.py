from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
import datetime

from app.database import get_db
from app.models import NormalizedEvent

router = APIRouter(prefix="/events", tags=["events"])


class NormalizedEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    event_type: str
    payment_id: Optional[str] = None
    order_id: Optional[str] = None
    event_timestamp: str
    ingestion_timestamp: Optional[str] = None
    source: str
    status: str
    delivery_status: Optional[str] = None
    signature_valid: bool
    payload_hash: Optional[str] = None
    delay_seconds: Optional[float] = None
    raw_payload: Optional[Dict[str, Any]] = None


@router.get("/timeline", response_model=List[NormalizedEventResponse])
def get_event_timeline(
    limit: int = Query(50, ge=1, le=200),
    event_type: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    payment_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Retrieve chronological normalized event stream for cross-incident Timeline Explorer.
    """
    query = db.query(NormalizedEvent)

    if event_type:
        query = query.filter(NormalizedEvent.event_type == event_type)
    if source:
        query = query.filter(NormalizedEvent.source == source)
    if payment_id:
        query = query.filter(NormalizedEvent.payment_id == payment_id)

    rows = query.order_by(NormalizedEvent.event_timestamp.desc()).limit(limit).all()

    results: List[NormalizedEventResponse] = []
    for r in rows:
        # Calculate delay if both timestamps exist
        delay_sec = None
        if r.event_timestamp and r.ingestion_timestamp:
            try:
                # Ensure tz-awareness compatibility
                et = r.event_timestamp
                it = r.ingestion_timestamp
                if et.tzinfo is None and it.tzinfo is not None:
                    et = et.replace(tzinfo=datetime.timezone.utc)
                elif it.tzinfo is None and et.tzinfo is not None:
                    it = it.replace(tzinfo=datetime.timezone.utc)
                delay_sec = max(0.0, (it - et).total_seconds())
            except Exception:
                delay_sec = None

        results.append(
            NormalizedEventResponse(
                id=str(r.id),
                event_id=r.event_id,
                event_type=r.event_type,
                payment_id=r.payment_id,
                order_id=r.order_id,
                event_timestamp=r.event_timestamp.isoformat() if isinstance(r.event_timestamp, datetime.datetime) else str(r.event_timestamp),
                ingestion_timestamp=r.ingestion_timestamp.isoformat() if isinstance(r.ingestion_timestamp, datetime.datetime) else None,
                source=r.source,
                status=r.status,
                delivery_status=r.delivery_status,
                signature_valid=bool(r.signature_valid),
                payload_hash=r.payload_hash,
                delay_seconds=delay_sec,
                raw_payload=r.raw_payload if isinstance(r.raw_payload, dict) else None,
            )
        )

    return results
