export interface VerifiedClaim {
  claim_id: string;
  statement: string;
  verdict: "SUPPORTED" | "REJECTED" | "UNVERIFIABLE";
  rejection_reason: string | null;
  evidence_ids: string[];
  confidence: string;
}

export interface ConfidenceResult {
  level: "HIGH" | "MEDIUM" | "LOW" | "INCONCLUSIVE";
  score: number;
  reason: string;
  abstain: boolean;
  factors?: {
    source_consistency: number;
    evidence_completeness: number;
    contradiction_impact: number;
    recency: number;
  };
}

export interface InvestigationResult {
  payment_id: string;
  ai_activated: boolean;
  reason: string;
  authoritative_result: Record<string, unknown>;
  confidence: ConfidenceResult;
  abstained: boolean;
  verified_claims: VerifiedClaim[];
  rejected_claims: VerifiedClaim[];
  investigation: {
    hypothesis?: string;
    claims?: Array<{
      claim_id: string;
      statement: string;
      evidence_ids: string[];
      counter_evidence_ids?: string[];
      confidence?: string;
    }>;
    recommended_next_step?: string;
    uncertainty?: string;
    [key: string]: unknown;
  } | null;
  missing_evidence_report?: MissingEvidenceReport | null;
  evidence_package: {
    payment_id?: string;
    reconstructed_state?: string;
    incidents?: Array<{ incident_type: string; severity: string; description?: string }>;
    events?: Array<NormalizedEventItem>;
    missing_events?: string[];
    [key: string]: unknown;
  } | null;
}

export interface NormalizedEventItem {
  id?: string;
  evidence_id?: string;
  event_id?: string;
  event_type: string;
  payment_id?: string | null;
  order_id?: string | null;
  event_timestamp: string;
  ingestion_timestamp?: string | null;
  source?: string;
  status?: string;
  delivery_status?: string | null;
  signature_valid?: boolean;
  payload_hash?: string | null;
  delay_seconds?: number | null;
  raw_payload?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface IncidentNoteItem {
  id: string;
  payment_id: string;
  note_text: string;
  author: string;
  created_at: string;
}

export interface IncidentRecord {
  id: number | string;
  incident_type: string;
  payment_id: string | null;
  order_id: string | null;
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | string;
  evidence_ids: string[];
  resolved: boolean;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  created_at: string | null;
  // Computed / UI fields
  state?: string;
  confidence?: string;
  ai_required?: boolean;
}

export interface ScenarioFixtureItem {
  scenario_id: string;
  name: string;
  description: string;
  category?: string;
  ground_truth: {
    expected_state?: string;
    expected_incidents?: string[];
    expected_ai_activated?: boolean;
    expected_confidence?: string;
    expected_abstain?: boolean;
    [key: string]: unknown;
  };
  events_count: number;
}

export interface ScenarioActual {
  state: string;
  incidents: string[];
  ai_activated: boolean;
  confidence: string;
  abstained: boolean;
}

export interface ScenarioResult {
  scenario_id: string;
  name: string;
  description: string;
  ground_truth: Record<string, unknown>;
  actual: ScenarioActual;
  passed: boolean;
  mismatches: string[];
}

export interface SearchResultItem {
  id: string;
  type: "INCIDENT" | "EVENT" | "EVIDENCE" | string;
  title: string;
  subtitle: string;
  payment_id?: string | null;
  order_id?: string | null;
  timestamp?: string | null;
  severity?: string | null;
  badge?: string | null;
  details?: Record<string, unknown>;
}

export interface TimelineFilterState {
  eventType?: string;
  source?: string;
  searchQuery?: string;
}

export type NavigationTab =
  | "overview"
  | "incidents"
  | "patterns"
  | "search"
  | "timeline"
  | "evidence"
  | "investigations"
  | "reports"
  | "integrations"
  | "settings";

// --- PHASE 4: INVESTIGATION INTELLIGENCE TYPES ---

export type EvidenceTrustStatus = "TRUSTED" | "UNTRUSTED" | "DERIVED";

export interface EvidenceItem {
  id: string;
  evidence_id: string;
  payment_id?: string | null;
  order_id?: string | null;
  event_type: string;
  source: string;
  status: string;
  trust_status: EvidenceTrustStatus;
  signature_valid: boolean;
  event_timestamp?: string | null;
  ingestion_timestamp?: string | null;
  delay_seconds?: number | null;
  payload_hash?: string | null;
}

export interface EvidenceDetailResponse {
  id: string;
  evidence_id: string;
  payment_id?: string | null;
  order_id?: string | null;
  event_type: string;
  source: string;
  status: string;
  trust_status: EvidenceTrustStatus;
  trust_rationale: string;
  signature_valid: boolean;
  event_timestamp?: string | null;
  ingestion_timestamp?: string | null;
  delay_seconds?: number | null;
  payload_hash?: string | null;
  normalized_fields: Record<string, unknown>;
  raw_payload_sanitized?: Record<string, unknown> | null;
  related_incidents: Array<{
    id: string;
    incident_type: string;
    severity: string;
    description: string;
    resolved: boolean;
  }>;
  related_claims: Array<{
    claim_id: string;
    statement: string;
    verdict?: string | null;
    confidence?: string | null;
    investigation_id?: string | null;
  }>;
}

export interface MissingEvidenceReport {
  has_missing_evidence: boolean;
  reason: string;
  missing_evidence: string[];
  recommended_next_evidence: string[];
  lifecycle_completeness: number; // 0.0 to 1.0
}

export interface InvestigationHistoryItem {
  id: string;
  payment_id: string;
  evidence_package_id: string;
  ai_activated: boolean;
  activation_reason?: string | null;
  hypothesis?: string | null;
  claim_count: number;
  supported_claims_count: number;
  rejected_claims_count: number;
  confidence_level: string;
  confidence_score: number;
  abstained: boolean;
  timestamp: string;
}

export interface InvestigationVersionItem {
  version_number: number;
  id: string;
  payment_id: string;
  ai_activated: boolean;
  activation_reason?: string | null;
  confidence_level: string;
  confidence_score: number;
  abstained: boolean;
  claims_count: number;
  timestamp: string;
  verified_claims: Array<Record<string, unknown>>;
}

export interface InvestigationComparisonResult {
  payment_id: string;
  v1: {
    id: string;
    timestamp: string;
    ai_activated: boolean;
    confidence_level: string;
    confidence_score: number;
    abstained: boolean;
    claims_count: number;
  };
  v2: {
    id: string;
    timestamp: string;
    ai_activated: boolean;
    confidence_level: string;
    confidence_score: number;
    abstained: boolean;
    claims_count: number;
  };
  confidence_changed: boolean;
  ai_activated_changed: boolean;
  abstention_changed: boolean;
  claims_count_diff: number;
  claim_diffs: Array<{
    claim_id: string;
    v1_verdict: string | null;
    v2_verdict: string | null;
    statement: string;
    changed: boolean;
  }>;
}

export interface ClaimVerificationSummaryItem {
  payment_id: string;
  claim_id: string;
  statement: string;
  verdict: "SUPPORTED" | "REJECTED" | "UNVERIFIABLE" | string;
  rejection_reason?: string | null;
  evidence_ids: string[];
  confidence?: string | null;
  investigation_id: string;
  investigation_timestamp?: string | null;
}

export interface ClaimVerificationCenterData {
  total_claims: number;
  verified_claims: number;
  rejected_claims: number;
  unverifiable_claims: number;
  verification_rate: number;
  claims: ClaimVerificationSummaryItem[];
}

// --- PHASE 5: ADVANCED INCIDENT INTELLIGENCE TYPES ---

export interface SimilarIncidentItem {
  incident_id: string;
  payment_id?: string | null;
  order_id?: string | null;
  incident_type: string;
  severity: string;
  description: string;
  resolved: boolean;
  detected_at?: string | null;
  similarity_score: number;
  matching_features: string[];
  non_matching_critical_features: string[];
  comparison_summary: string;
}

export interface PatternSummaryItem {
  pattern_id: string;
  pattern_name: string;
  pattern_type: string;
  incident_count: number;
  affected_payments_count: number;
  severity: string;
  first_detected_at?: string | null;
  last_detected_at?: string | null;
  pattern_strength: "STRONG" | "MODERATE" | "EMERGING" | string;
  diagnostic_characteristics: string[];
  supporting_incident_ids: string[];
  supporting_payment_ids: string[];
  sample_incidents: Array<{
    incident_id: string;
    payment_id?: string | null;
    order_id?: string | null;
    severity: string;
    detected_at?: string | null;
    description: string;
  }>;
}

export interface SimilarIncidentsResponse {
  incident_id: string;
  payment_id?: string | null;
  fingerprint: Record<string, unknown>;
  similar_incidents: SimilarIncidentItem[];
  recurring_patterns: PatternSummaryItem[];
  total_compared: number;
  matches_found: number;
}


