"""
Deterministic Incident Fingerprint Engine for PayTrace Phase 5.

Constructs an explainable, canonical fingerprint representing diagnostic
characteristics of a payment incident while strictly excluding unique
identifiers (e.g. payment_id, order_id, UUID, timestamps, random hashes).
"""

from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict, Any
import hashlib
import json


@dataclass(frozen=True)
class IncidentFingerprint:
    """
    Diagnostic representation of an incident used for deterministic
    similarity and recurring pattern clustering.
    """
    # Core anomaly classification
    incident_type: str
    severity: str

    # Reconstructed financial / payment state
    reconstructed_state: str

    # Distinct event types observed for this payment (sorted)
    event_types: Tuple[str, ...] = field(default_factory=tuple)

    # Anomaly flags observed in evidence
    has_duplicate_webhook: bool = False
    has_delayed_webhook: bool = False
    has_out_of_order_event: bool = False
    has_signature_failure: bool = False
    has_invalid_transition: bool = False
    missing_evidence_detected: bool = False

    # AI and confidence diagnostics (from audit record if available)
    ai_activated: Optional[bool] = None
    confidence_level: Optional[str] = None
    abstained: Optional[bool] = None

    def canonical_dict(self) -> Dict[str, Any]:
        """Return deterministic dictionary of diagnostic dimensions."""
        return {
            "incident_type": self.incident_type,
            "severity": self.severity,
            "reconstructed_state": self.reconstructed_state,
            "event_types": list(self.event_types),
            "has_duplicate_webhook": self.has_duplicate_webhook,
            "has_delayed_webhook": self.has_delayed_webhook,
            "has_out_of_order_event": self.has_out_of_order_event,
            "has_signature_failure": self.has_signature_failure,
            "has_invalid_transition": self.has_invalid_transition,
            "missing_evidence_detected": self.missing_evidence_detected,
            "ai_activated": self.ai_activated,
            "confidence_level": self.confidence_level,
            "abstained": self.abstained,
        }

    def fingerprint_hash(self) -> str:
        """
        Deterministic SHA-256 hash of the canonical diagnostic representation.
        Guaranteed to be identical for incidents with matching diagnostic characteristics.
        """
        dumped = json.dumps(self.canonical_dict(), sort_keys=True)
        return hashlib.sha256(dumped.encode("utf-8")).hexdigest()[:16]


def compute_incident_fingerprint(
    incident: Any,
    events: Optional[List[Any]] = None,
    payment_state: Optional[Any] = None,
    audit_record: Optional[Any] = None,
) -> IncidentFingerprint:
    """
    Extract a deterministic fingerprint from an Incident model and its associated
    evidence/payment records.
    """
    events = events or []

    # 1. Core incident attributes
    incident_type = getattr(incident, "incident_type", "unknown")
    severity = (getattr(incident, "severity", "MEDIUM") or "MEDIUM").upper()

    # 2. Payment state
    reconstructed_state = "unknown"
    if payment_state:
        reconstructed_state = getattr(payment_state, "current_state", "unknown") or "unknown"

    # 3. Event types observed
    event_types_set = set()
    for ev in events:
        etype = getattr(ev, "event_type", None)
        if etype:
            event_types_set.add(etype)
    sorted_event_types = tuple(sorted(event_types_set))

    # 4. Anomaly flags
    has_dup = incident_type == "duplicate_webhook"
    has_delay = incident_type == "delayed_webhook"
    has_ooo = incident_type == "out_of_order"
    has_sig_fail = incident_type == "signature_verification_failure"
    has_inv_trans = incident_type in ("invalid_transition", "ambiguous_state")
    has_missing = incident_type == "missing_evidence"

    # Inspect events for additional evidence clues
    for ev in events:
        if getattr(ev, "signature_valid", True) is False:
            has_sig_fail = True
        deliv = getattr(ev, "delivery_status", None)
        if deliv == "delayed":
            has_delay = True
        elif deliv == "missing":
            has_missing = True

    # 5. Audit record diagnostics
    ai_act = None
    conf_level = None
    abstained = None
    if audit_record:
        ai_act = getattr(audit_record, "ai_activated", None)
        conf_level = getattr(audit_record, "confidence_level", None)
        abstained = getattr(audit_record, "abstained", None)

    return IncidentFingerprint(
        incident_type=incident_type,
        severity=severity,
        reconstructed_state=reconstructed_state,
        event_types=sorted_event_types,
        has_duplicate_webhook=has_dup,
        has_delayed_webhook=has_delay,
        has_out_of_order_event=has_ooo,
        has_signature_failure=has_sig_fail,
        has_invalid_transition=has_inv_trans,
        missing_evidence_detected=has_missing,
        ai_activated=ai_act,
        confidence_level=conf_level,
        abstained=abstained,
    )
