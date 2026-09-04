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
  investigation: Record<string, unknown> | null;
  evidence_package: Record<string, unknown> | null;
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
