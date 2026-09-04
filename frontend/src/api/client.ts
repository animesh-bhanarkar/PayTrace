import type {
  InvestigationResult,
  ScenarioResult,
  IncidentRecord,
  ScenarioFixtureItem,
  IncidentNoteItem,
  SearchResultItem,
  NormalizedEventItem,
} from "../types";

const BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string) ||
  (import.meta.env.PROD ? "https://paytrace-backend-ys0y.onrender.com" : "http://localhost:8000")
).replace(/\/$/, "");

export async function investigate(paymentId: string): Promise<InvestigationResult> {
  const res = await fetch(`${BASE_URL}/investigations/investigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payment_id: paymentId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function replayScenario(scenarioId: string): Promise<ScenarioResult> {
  const res = await fetch(`${BASE_URL}/scenarios/replay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario_id: scenarioId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchIncidents(limit = 50): Promise<IncidentRecord[]> {
  try {
    const res = await fetch(`${BASE_URL}/incidents?limit=${limit}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchScenarios(): Promise<ScenarioFixtureItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/scenarios`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchHealth(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function resolveIncident(
  paymentId: string,
  resolutionNotes = "Resolved via investigator console"
): Promise<IncidentRecord> {
  const res = await fetch(`${BASE_URL}/incidents/${paymentId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolution_notes: resolutionNotes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function reopenIncident(paymentId: string): Promise<IncidentRecord> {
  const res = await fetch(`${BASE_URL}/incidents/${paymentId}/reopen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchIncidentNotes(paymentId: string): Promise<IncidentNoteItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/incidents/${paymentId}/notes`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createIncidentNote(
  paymentId: string,
  noteText: string,
  author = "Human Investigator"
): Promise<IncidentNoteItem> {
  const res = await fetch(`${BASE_URL}/incidents/${paymentId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note_text: noteText, author }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function searchGlobal(
  query: string,
  limit = 30,
  typeFilter?: string
): Promise<SearchResultItem[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (typeFilter && typeFilter !== "ALL") {
    params.set("type_filter", typeFilter);
  }
  const res = await fetch(`${BASE_URL}/search?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchGlobalTimeline(
  limit = 50,
  eventType?: string,
  source?: string,
  paymentId?: string
): Promise<NormalizedEventItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (eventType && eventType !== "ALL") params.set("event_type", eventType);
  if (source && source !== "ALL") params.set("source", source);
  if (paymentId) params.set("payment_id", paymentId);

  const res = await fetch(`${BASE_URL}/events/timeline?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- PHASE 4 API METHODS ---

export async function fetchEvidenceList(params?: {
  payment_id?: string;
  trust_status?: string;
  event_type?: string;
  limit?: number;
}): Promise<import("../types").EvidenceItem[]> {
  const q = new URLSearchParams();
  if (params?.payment_id) q.set("payment_id", params.payment_id);
  if (params?.trust_status && params.trust_status !== "ALL") q.set("trust_status", params.trust_status);
  if (params?.event_type && params.event_type !== "ALL") q.set("event_type", params.event_type);
  if (params?.limit) q.set("limit", String(params.limit));

  const res = await fetch(`${BASE_URL}/evidence?${q.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchEvidenceDetail(
  eventId: string
): Promise<import("../types").EvidenceDetailResponse> {
  const res = await fetch(`${BASE_URL}/evidence/${encodeURIComponent(eventId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchInvestigationHistory(params?: {
  payment_id?: string;
  ai_activated?: boolean;
  confidence_level?: string;
  limit?: number;
}): Promise<import("../types").InvestigationHistoryItem[]> {
  const q = new URLSearchParams();
  if (params?.payment_id) q.set("payment_id", params.payment_id);
  if (params?.ai_activated !== undefined) q.set("ai_activated", String(params.ai_activated));
  if (params?.confidence_level && params.confidence_level !== "ALL") q.set("confidence_level", params.confidence_level);
  if (params?.limit) q.set("limit", String(params.limit));

  const res = await fetch(`${BASE_URL}/investigations/history?${q.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchInvestigationVersions(
  paymentId: string
): Promise<import("../types").InvestigationVersionItem[]> {
  const res = await fetch(`${BASE_URL}/investigations/history/${encodeURIComponent(paymentId)}/versions`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function compareInvestigationVersions(
  v1Id: string,
  v2Id: string
): Promise<import("../types").InvestigationComparisonResult> {
  const q = new URLSearchParams({ v1_id: v1Id, v2_id: v2Id });
  const res = await fetch(`${BASE_URL}/investigations/compare?${q.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchClaimsSummary(params?: {
  limit?: number;
  payment_id?: string;
}): Promise<import("../types").ClaimVerificationCenterData> {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.payment_id) q.set("payment_id", params.payment_id);

  const res = await fetch(`${BASE_URL}/investigations/claims/summary?${q.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- PHASE 5: ADVANCED INCIDENT INTELLIGENCE METHODS ---

export async function fetchSimilarIncidents(
  incidentIdOrPaymentId: string,
  minSimilarity = 0.35,
  limit = 10
): Promise<import("../types").SimilarIncidentsResponse> {
  const q = new URLSearchParams({
    min_similarity: String(minSimilarity),
    limit: String(limit),
  });
  const res = await fetch(
    `${BASE_URL}/incidents/${encodeURIComponent(incidentIdOrPaymentId)}/similar?${q.toString()}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchRecurringPatterns(): Promise<import("../types").PatternSummaryItem[]> {
  const res = await fetch(`${BASE_URL}/patterns`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchPatternDetail(
  patternId: string
): Promise<import("../types").PatternSummaryItem> {
  const res = await fetch(`${BASE_URL}/patterns/${encodeURIComponent(patternId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}



