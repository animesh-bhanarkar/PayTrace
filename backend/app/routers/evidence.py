from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, ConfigDict
import datetime

from app.database import get_db
from app.models import NormalizedEvent, Incident, AuditRecord

router = APIRouter(prefix="/evidence", tags=["evidence"])


class EvidenceListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    evidence_id: str
    payment_id: Optional[str] = None
    order_id: Optional[str] = None
    event_type: str
    source: str
    status: str
    trust_status: str  # "TRUSTED" | "UNTRUSTED" | "DERIVED"
    signature_valid: bool
    event_timestamp: Optional[str] = None
    ingestion_timestamp: Optional[str] = None
    delay_seconds: Optional[float] = None
    payload_hash: Optional[str] = None


class EvidenceDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    evidence_id: str
    payment_id: Optional[str] = None
    order_id: Optional[str] = None
    event_type: str
    source: str
    status: str
    trust_status: str
    trust_rationale: str
    signature_valid: bool
    event_timestamp: Optional[str] = None
    ingestion_timestamp: Optional[str] = None
    delay_seconds: Optional[float] = None
    payload_hash: Optional[str] = None
    normalized_fields: Dict[str, Any] = {}
    raw_payload_sanitized: Optional[Dict[str, Any]] = None
    related_incidents: List[Dict[str, Any]] = []
    related_claims: List[Dict[str, Any]] = []


def sanitize_payload(payload: Any) -> Any:
    """Recursively mask sensitive keys like secrets, tokens, passwords, keys."""
    if isinstance(payload, dict):
        sanitized = {}
        sensitive_keys = {"secret", "api_key", "password", "token", "signature", "auth"}
        for k, v in payload.items():
            if any(s in k.lower() for s in sensitive_keys) and not isinstance(v, dict):
                sanitized[k] = "[REDACTED_SECURITY_SENSITIVE]"
            else:
                sanitized[k] = sanitize_payload(v)
        return sanitized
    elif isinstance(payload, list):
        return [sanitize_payload(item) for item in payload]
    return payload


@router.get("", response_model=List[EvidenceListItem])
def list_evidence(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    payment_id: Optional[str] = None,
    order_id: Optional[str] = None,
    event_type: Optional[str] = None,
    source: Optional[str] = None,
    trust_status: Optional[str] = Query(None, description="ALL | TRUSTED | UNTRUSTED | DERIVED"),
    db: Session = Depends(get_db),
):
    """
    Retrieve real normalized payment evidence with explicit trust classification.
    """
    query = db.query(NormalizedEvent)

    if payment_id:
        query = query.filter(NormalizedEvent.payment_id == payment_id)
    if order_id:
        query = query.filter(NormalizedEvent.order_id == order_id)
    if event_type and event_type != "ALL":
        query = query.filter(NormalizedEvent.event_type == event_type)
    if source and source != "ALL":
        query = query.filter(NormalizedEvent.source == source)

    if trust_status and trust_status != "ALL":
        if trust_status.upper() == "UNTRUSTED":
            query = query.filter(NormalizedEvent.signature_valid == False)  # noqa: E712
        elif trust_status.upper() == "TRUSTED":
            query = query.filter(NormalizedEvent.signature_valid == True)  # noqa: E712

    rows = query.order_by(NormalizedEvent.event_timestamp.desc()).offset(offset).limit(limit).all()

    results: List[EvidenceListItem] = []
    for r in rows:
        is_trusted = bool(r.signature_valid)
        trust_cat = "TRUSTED" if is_trusted else "UNTRUSTED"

        delay_sec = None
        if r.event_timestamp and r.ingestion_timestamp:
            try:
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
            EvidenceListItem(
                id=str(r.id),
                evidence_id=r.event_id,
                payment_id=r.payment_id,
                order_id=r.order_id,
                event_type=r.event_type,
                source=r.source,
                status=r.status,
                trust_status=trust_cat,
                signature_valid=bool(r.signature_valid),
                event_timestamp=r.event_timestamp.isoformat() if isinstance(r.event_timestamp, datetime.datetime) else None,
                ingestion_timestamp=r.ingestion_timestamp.isoformat() if isinstance(r.ingestion_timestamp, datetime.datetime) else None,
                delay_seconds=delay_sec,
                payload_hash=r.payload_hash,
            )
        )

    return results


@router.get("/{event_id}", response_model=EvidenceDetailResponse)
def get_evidence_detail(event_id: str, db: Session = Depends(get_db)):
    """
    Retrieve full evidence detail for a specific event/evidence ID.
    Includes sanitized raw payload and cross-referenced claims.
    """
    import uuid as _uuid
    query_filters = [NormalizedEvent.event_id == event_id]
    try:
        parsed_uuid = _uuid.UUID(event_id)
        query_filters.append(NormalizedEvent.id == parsed_uuid)
    except (ValueError, AttributeError):
        pass

    ev = db.query(NormalizedEvent).filter(or_(*query_filters)).first()

    if not ev:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    is_trusted = bool(ev.signature_valid)
    trust_cat = "TRUSTED" if is_trusted else "UNTRUSTED"
    trust_rationale = (
        "HMAC-SHA256 signature verified against merchant webhook secret. Payload hash matches byte sequence."
        if is_trusted
        else "Signature validation failed or signature was absent. Isolated from downstream AI instruction."
    )

    delay_sec = None
    if ev.event_timestamp and ev.ingestion_timestamp:
        try:
            et = ev.event_timestamp
            it = ev.ingestion_timestamp
            if et.tzinfo is None and it.tzinfo is not None:
                et = et.replace(tzinfo=datetime.timezone.utc)
            elif it.tzinfo is None and et.tzinfo is not None:
                it = it.replace(tzinfo=datetime.timezone.utc)
            delay_sec = max(0.0, (it - et).total_seconds())
        except Exception:
            delay_sec = None

    # Find related incidents
    related_incidents = []
    if ev.payment_id:
        inc_rows = db.query(Incident).filter(Incident.payment_id == ev.payment_id).all()
        for inc in inc_rows:
            related_incidents.append({
                "id": str(inc.id),
                "incident_type": inc.incident_type,
                "severity": inc.severity,
                "description": inc.description,
                "resolved": inc.resolved,
            })

    # Find related claims from audit records
    related_claims = []
    if ev.payment_id:
        audit_rows = db.query(AuditRecord).filter(AuditRecord.payment_id == ev.payment_id).all()
        for ar in audit_rows:
            if isinstance(ar.verified_claims, list):
                for vc in ar.verified_claims:
                    if isinstance(vc, dict):
                        ev_ids = vc.get("evidence_ids", [])
                        if ev.event_id in ev_ids or str(ev.id) in ev_ids:
                            related_claims.append({
                                "claim_id": vc.get("claim_id"),
                                "statement": vc.get("statement"),
                                "verdict": vc.get("verdict"),
                                "confidence": vc.get("confidence"),
                                "investigation_timestamp": ar.timestamp.isoformat() if isinstance(ar.timestamp, datetime.datetime) else None,
                            })

    sanitized_raw = sanitize_payload(ev.raw_payload) if ev.raw_payload else None

    return EvidenceDetailResponse(
        id=str(ev.id),
        evidence_id=ev.event_id,
        payment_id=ev.payment_id,
        order_id=ev.order_id,
        event_type=ev.event_type,
        source=ev.source,
        status=ev.status,
        trust_status=trust_cat,
        trust_rationale=trust_rationale,
        signature_valid=is_trusted,
        event_timestamp=ev.event_timestamp.isoformat() if isinstance(ev.event_timestamp, datetime.datetime) else None,
        ingestion_timestamp=ev.ingestion_timestamp.isoformat() if isinstance(ev.ingestion_timestamp, datetime.datetime) else None,
        delay_seconds=delay_sec,
        payload_hash=ev.payload_hash,
        normalized_fields={
            "payment_id": ev.payment_id,
            "order_id": ev.order_id,
            "event_type": ev.event_type,
            "source": ev.source,
            "status": ev.status,
            "delivery_status": ev.delivery_status,
        },
        raw_payload_sanitized=sanitized_raw,
        related_incidents=related_incidents,
        related_claims=related_claims,
    )
