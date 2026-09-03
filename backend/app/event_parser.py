import hashlib
import json
import datetime
from app.models import NormalizedEvent

def parse_webhook_to_normalized_event(raw_payload: dict, signature_valid: bool) -> NormalizedEvent:
    event_type = raw_payload.get("event")
    
    payment_id = None
    order_id = None
    status = "unknown"
    event_timestamp = None
    
    try:
        payload_data = raw_payload.get("payload", {})
        
        # Payment entity
        payment_entity = payload_data.get("payment", {}).get("entity", {})
        if payment_entity:
            payment_id = payment_entity.get("id")
            order_id = payment_entity.get("order_id")
            status = payment_entity.get("status", status)
        
        # Order entity (if order_id not found in payment, check order entity)
        order_entity = payload_data.get("order", {}).get("entity", {})
        if not order_id and order_entity:
            order_id = order_entity.get("id")
            if not payment_id:
                status = order_entity.get("status", status)

        # Event Timestamp
        created_at = raw_payload.get("created_at")
        if created_at:
            event_timestamp = datetime.datetime.fromtimestamp(created_at, datetime.timezone.utc)
        else:
            event_timestamp = datetime.datetime.now(datetime.timezone.utc)
            
    except Exception:
        pass # Handle missing fields gracefully
        
    payload_hash = hashlib.sha256(json.dumps(raw_payload, sort_keys=True).encode("utf-8")).hexdigest()
    
    return NormalizedEvent(
        event_id=raw_payload.get("id") or "unknown",
        event_type=event_type or "unknown",
        payment_id=payment_id,
        order_id=order_id,
        event_timestamp=event_timestamp,
        source="webhook",
        status=status,
        delivery_status=None,
        payload_hash=payload_hash,
        signature_valid=signature_valid,
        raw_payload=raw_payload
    )
