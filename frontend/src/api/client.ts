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


