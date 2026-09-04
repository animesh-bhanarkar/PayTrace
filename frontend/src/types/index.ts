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
  evidence_id?: string;
  event_id?: string;
  event_type: string;
  event_timestamp: string;
  ingestion_timestamp?: string | null;
  source?: string;
  signature_valid?: boolean;
  payload_hash?: string;
  delay_seconds?: number;
  [key: string]: unknown;
}

export interface IncidentRecord {
  id: number;
  incident_type: string;
  payment_id: string | null;
  order_id: string | null;
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | string;
  evidence_ids: string[];
  resolved: boolean;
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

export type NavigationTab =
  | "overview"
  | "incidents"
  | "search"
  | "timeline"
  | "evidence"
  | "investigations"
  | "reports"
  | "integrations"
  | "settings";
