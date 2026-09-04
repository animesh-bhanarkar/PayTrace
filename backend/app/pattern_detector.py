"""
Deterministic Recurring Incident Pattern Detector for PayTrace Phase 5.

Groups historical incidents by canonical diagnostic fingerprints to discover
recurring payment/webhook failure patterns across the integration.
Guarantees:
- Patterns require incident_count >= 2 (no manufactured single-incident patterns).
- Zero ML / clustering heuristics; groups are strictly formed from shared deterministic dimensions.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import datetime
from app.incident_fingerprint import IncidentFingerprint


@dataclass
class SupportingIncidentRef:
    incident_id: str
    payment_id: Optional[str]
    order_id: Optional[str]
    severity: str
    detected_at: Optional[str]
    description: str


@dataclass
class RecurringPattern:
    pattern_id: str
    pattern_name: str
    pattern_type: str
    incident_count: int
    affected_payments_count: int
    severity: str
    first_detected_at: Optional[str]
    last_detected_at: Optional[str]
    pattern_strength: str  # "STRONG" | "MODERATE" | "EMERGING"
    diagnostic_characteristics: List[str]
    supporting_incident_ids: List[str]
    supporting_payment_ids: List[str]
    sample_incidents: List[SupportingIncidentRef] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pattern_id": self.pattern_id,
            "pattern_name": self.pattern_name,
            "pattern_type": self.pattern_type,
            "incident_count": self.incident_count,
            "affected_payments_count": self.affected_payments_count,
            "severity": self.severity,
            "first_detected_at": self.first_detected_at,
            "last_detected_at": self.last_detected_at,
            "pattern_strength": self.pattern_strength,
            "diagnostic_characteristics": self.diagnostic_characteristics,
            "supporting_incident_ids": self.supporting_incident_ids,
            "supporting_payment_ids": self.supporting_payment_ids,
            "sample_incidents": [
                {
                    "incident_id": ref.incident_id,
                    "payment_id": ref.payment_id,
                    "order_id": ref.order_id,
                    "severity": ref.severity,
                    "detected_at": ref.detected_at,
                    "description": ref.description,
                }
                for ref in self.sample_incidents
            ],
        }


def _derive_pattern_type(incident_type: str) -> str:
    mapping = {
        "duplicate_webhook": "DUPLICATE_WEBHOOK",
        "delayed_webhook": "DELAYED_INGESTION",
        "out_of_order": "OUT_OF_ORDER_DELIVERY",
        "invalid_transition": "INVALID_LIFECYCLE_TRANSITION",
        "signature_verification_failure": "SIGNATURE_VERIFICATION_FAILURE",
        "missing_evidence": "MISSING_EVIDENCE_GAP",
        "ambiguous_state": "AMBIGUOUS_PAYMENT_STATE",
    }
    return mapping.get(incident_type, incident_type.upper())


def _derive_pattern_name(incident_type: str, state: str) -> str:
    type_names = {
        "duplicate_webhook": "Recurring Duplicate Webhooks",
        "delayed_webhook": "Recurring Delayed Webhook Delivery",
        "out_of_order": "Recurring Out-of-Order Webhook Arrivals",
        "invalid_transition": "Recurring Invalid State Transitions",
        "signature_verification_failure": "Repeated Webhook Signature Verification Failures",
        "missing_evidence": "Recurring Missing Lifecycle Evidence",
        "ambiguous_state": "Repeated Ambiguous Payment State Divergence",
    }
    base = type_names.get(incident_type, f"Recurring {incident_type.replace('_', ' ').title()}")
    if state and state != "unknown":
        return f"{base} in '{state.upper()}' State"
    return base


def detect_recurring_patterns(
    incidents_with_meta: List[Dict[str, Any]],
) -> List[RecurringPattern]:
    """
    Detect recurring incident patterns across a list of incidents.

    incidents_with_meta is a list of dicts with:
      - incident: Incident model or dict with id, incident_type, severity, payment_id, order_id, detected_at, description
      - fingerprint: IncidentFingerprint
    """
    groups: Dict[str, List[Dict[str, Any]]] = {}

    for item in incidents_with_meta:
        fp: IncidentFingerprint = item["fingerprint"]
        # Group key based on core failure mode and payment state
        group_key = f"{fp.incident_type}::{fp.reconstructed_state}"
        if group_key not in groups:
            groups[group_key] = []
        groups[group_key].append(item)

    patterns: List[RecurringPattern] = []

    for group_key, items in groups.items():
        # A pattern strictly requires at least 2 incidents
        if len(items) < 2:
            continue

        sample_fp: IncidentFingerprint = items[0]["fingerprint"]
        itype = sample_fp.incident_type
        pstate = sample_fp.reconstructed_state

        pattern_id = f"pat_{itype}_{pstate}".lower().replace("-", "_")
        pattern_type = _derive_pattern_type(itype)
        pattern_name = _derive_pattern_name(itype, pstate)

        # Collect timestamps and identifiers
        detected_times = []
        incident_ids = []
        payment_ids = set()
        highest_severity = "LOW"
        samples: List[SupportingIncidentRef] = []

        sev_rank = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}

        for it in items:
            inc = it["incident"]
            inc_id = str(getattr(inc, "id", None) or it.get("id") or "")
            pid = getattr(inc, "payment_id", None) or it.get("payment_id")
            oid = getattr(inc, "order_id", None) or it.get("order_id")
            sev = (getattr(inc, "severity", None) or it.get("severity") or "MEDIUM").upper()
            desc = getattr(inc, "description", None) or it.get("description") or ""
            dt = getattr(inc, "detected_at", None) or it.get("detected_at")

            dt_iso = None
            if isinstance(dt, datetime.datetime):
                dt_iso = dt.isoformat()
                detected_times.append(dt)
            elif isinstance(dt, str) and dt:
                dt_iso = dt
                try:
                    detected_times.append(datetime.datetime.fromisoformat(dt.replace("Z", "+00:00")))
                except Exception:
                    pass

            if inc_id:
                incident_ids.append(inc_id)
            if pid:
                payment_ids.add(pid)

            if sev_rank.get(sev, 1) > sev_rank.get(highest_severity, 1):
                highest_severity = sev

            samples.append(
                SupportingIncidentRef(
                    incident_id=inc_id,
                    payment_id=pid,
                    order_id=oid,
                    severity=sev,
                    detected_at=dt_iso,
                    description=desc,
                )
            )

        # Strength rating based on incident volume
        count = len(items)
        if count >= 5:
            strength = "STRONG"
        elif count >= 3:
            strength = "MODERATE"
        else:
            strength = "EMERGING"

        # Time range
        first_dt_str = None
        last_dt_str = None
        if detected_times:
            detected_times.sort()
            first_dt_str = detected_times[0].isoformat()
            last_dt_str = detected_times[-1].isoformat()

        # Shared diagnostic characteristics
        characteristics = [
            f"Primary anomaly classification: {itype}",
            f"Observed during payment state: {pstate}",
        ]
        if sample_fp.has_duplicate_webhook:
            characteristics.append("Repeated duplicate payload delivery hash")
        if sample_fp.has_delayed_webhook:
            characteristics.append("Repeated webhook ingestion latency (>300s)")
        if sample_fp.has_signature_failure:
            characteristics.append("Repeated cryptographic HMAC signature invalidation")
        if sample_fp.has_invalid_transition:
            characteristics.append("State machine rejected non-permitted transition")
        if sample_fp.missing_evidence_detected:
            characteristics.append("Gaps in event timeline evidence")
        if sample_fp.event_types:
            characteristics.append(f"Involved event types: {', '.join(sample_fp.event_types)}")

        patterns.append(
            RecurringPattern(
                pattern_id=pattern_id,
                pattern_name=pattern_name,
                pattern_type=pattern_type,
                incident_count=count,
                affected_payments_count=len(payment_ids),
                severity=highest_severity,
                first_detected_at=first_dt_str,
                last_detected_at=last_dt_str,
                pattern_strength=strength,
                diagnostic_characteristics=characteristics,
                supporting_incident_ids=incident_ids,
                supporting_payment_ids=sorted(list(payment_ids)),
                sample_incidents=samples[:10],
            )
        )

    # Deterministic stable ordering: count DESC, then last_detected_at DESC, then pattern_id
    patterns.sort(
        key=lambda p: (
            -p.incident_count,
            p.last_detected_at or "",
            p.pattern_id,
        ),
        reverse=False,
    )

    return patterns
