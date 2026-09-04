"""
Deterministic Incident Similarity Engine for PayTrace Phase 5.

Computes an explainable, weighted similarity score [0.0, 1.0] between two
incident fingerprints using strictly verifiable diagnostic dimensions.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from app.incident_fingerprint import IncidentFingerprint


@dataclass
class SimilarityResult:
    similarity_score: float
    matching_features: List[str]
    non_matching_critical_features: List[str]
    comparison_summary: str
    feature_breakdown: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "similarity_score": round(self.similarity_score, 2),
            "matching_features": self.matching_features,
            "non_matching_critical_features": self.non_matching_critical_features,
            "comparison_summary": self.comparison_summary,
            "feature_breakdown": self.feature_breakdown,
        }


# Weights for interpretable diagnostic dimensions (sum = 1.0)
WEIGHT_INCIDENT_TYPE = 0.35
WEIGHT_PAYMENT_STATE = 0.20
WEIGHT_ANOMALY_FLAGS = 0.25
WEIGHT_EVENT_TYPES = 0.10
WEIGHT_AUDIT_CONFIDENCE = 0.10


def compute_similarity(
    fp_a: IncidentFingerprint,
    fp_b: IncidentFingerprint,
) -> SimilarityResult:
    """
    Calculate deterministic similarity between two incident fingerprints.
    """
    matching_features: List[str] = []
    differences: List[str] = []
    breakdown: Dict[str, float] = {}

    # 1. Incident Type Match (0.35)
    type_score = 0.0
    if fp_a.incident_type == fp_b.incident_type:
        type_score = 1.0
        matching_features.append(f"Identical incident classification: {fp_a.incident_type}")
    elif {fp_a.incident_type, fp_b.incident_type} == {"invalid_transition", "ambiguous_state"}:
        type_score = 0.6
        matching_features.append("Related lifecycle transition anomalies")
    elif {fp_a.incident_type, fp_b.incident_type} <= {"duplicate_webhook", "delayed_webhook", "out_of_order"}:
        type_score = 0.4
        matching_features.append("Shared webhook delivery irregularity family")
    else:
        differences.append(f"Different incident types: {fp_a.incident_type} vs {fp_b.incident_type}")

    breakdown["incident_type_score"] = round(type_score * WEIGHT_INCIDENT_TYPE, 3)

    # 2. Reconstructed Payment State Match (0.20)
    state_score = 0.0
    if fp_a.reconstructed_state == fp_b.reconstructed_state:
        state_score = 1.0
        matching_features.append(f"Shared reconstructed payment state: {fp_a.reconstructed_state}")
    elif fp_a.reconstructed_state != "unknown" and fp_b.reconstructed_state != "unknown":
        differences.append(f"Different payment states: {fp_a.reconstructed_state} vs {fp_b.reconstructed_state}")
    else:
        state_score = 0.2

    breakdown["payment_state_score"] = round(state_score * WEIGHT_PAYMENT_STATE, 3)

    # 3. Anomaly Flags Agreement (0.25)
    flag_keys = [
        ("has_duplicate_webhook", "duplicate webhook payload"),
        ("has_delayed_webhook", "delayed webhook ingestion"),
        ("has_out_of_order_event", "out-of-order event delivery"),
        ("has_signature_failure", "cryptographic signature failure"),
        ("has_invalid_transition", "invalid state transition"),
        ("missing_evidence_detected", "missing evidence condition"),
    ]

    agreed_flags = 0
    for attr, label in flag_keys:
        val_a = getattr(fp_a, attr)
        val_b = getattr(fp_b, attr)
        if val_a == val_b:
            agreed_flags += 1
            if val_a is True:
                matching_features.append(f"Shared anomaly characteristic: {label}")
        else:
            present_in = "incident A" if val_a else "incident B"
            differences.append(f"Discrepancy in {label} (active in {present_in})")

    anomaly_score = agreed_flags / len(flag_keys)
    breakdown["anomaly_flags_score"] = round(anomaly_score * WEIGHT_ANOMALY_FLAGS, 3)

    # 4. Event Types Set Overlap (0.10)
    set_a = set(fp_a.event_types)
    set_b = set(fp_b.event_types)
    if not set_a and not set_b:
        events_score = 1.0
    elif not set_a or not set_b:
        events_score = 0.0
    else:
        intersection = set_a.intersection(set_b)
        union = set_a.union(set_b)
        events_score = len(intersection) / len(union)
        if events_score > 0.5:
            matching_features.append(f"Shared {len(intersection)} event type(s) ({', '.join(sorted(intersection))})")
        else:
            differences.append("Divergent payment event sequence composition")

    breakdown["event_types_score"] = round(events_score * WEIGHT_EVENT_TYPES, 3)

    # 5. Audit & Confidence Diagnostics (0.10)
    audit_score = 0.0
    # Severity match (0.04)
    if fp_a.severity == fp_b.severity:
        audit_score += 0.4
        matching_features.append(f"Matching severity level: {fp_a.severity}")
    else:
        differences.append(f"Different severity levels: {fp_a.severity} vs {fp_b.severity}")

    # Confidence level match (0.03)
    if fp_a.confidence_level and fp_b.confidence_level:
        if fp_a.confidence_level == fp_b.confidence_level:
            audit_score += 0.3
            matching_features.append(f"Identical confidence calibration: {fp_a.confidence_level}")
    elif fp_a.confidence_level is None and fp_b.confidence_level is None:
        audit_score += 0.3

    # AI activation match (0.03)
    if fp_a.ai_activated is not None and fp_b.ai_activated is not None:
        if fp_a.ai_activated == fp_b.ai_activated:
            audit_score += 0.3
            matching_features.append(f"Consistent AI activation status: {fp_a.ai_activated}")
    elif fp_a.ai_activated is None and fp_b.ai_activated is None:
        audit_score += 0.3

    breakdown["audit_confidence_score"] = round(audit_score * WEIGHT_AUDIT_CONFIDENCE, 3)

    # Total Score
    total_score = (
        type_score * WEIGHT_INCIDENT_TYPE
        + state_score * WEIGHT_PAYMENT_STATE
        + anomaly_score * WEIGHT_ANOMALY_FLAGS
        + events_score * WEIGHT_EVENT_TYPES
        + audit_score * WEIGHT_AUDIT_CONFIDENCE
    )
    final_score = min(1.0, max(0.0, total_score))

    # Deterministic summary
    if final_score >= 0.85:
        summary = f"High diagnostic similarity in {fp_a.incident_type} under {fp_a.reconstructed_state} state."
    elif final_score >= 0.60:
        summary = f"Moderate similarity with shared failure characteristics in {fp_a.reconstructed_state} state."
    elif final_score >= 0.35:
        summary = f"Low-to-moderate overlap across payment event characteristics."
    else:
        summary = "Isolated or distinct incident with minimal shared diagnostic features."

    return SimilarityResult(
        similarity_score=final_score,
        matching_features=matching_features,
        non_matching_critical_features=differences,
        comparison_summary=summary,
        feature_breakdown=breakdown,
    )
