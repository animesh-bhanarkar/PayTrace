import type {
  InvestigationResult,
  ScenarioResult,
  IncidentRecord,
  ScenarioFixtureItem,
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
