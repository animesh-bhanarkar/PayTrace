import { useState } from "react";
import { investigate, replayScenario } from "./api/client";
import type { InvestigationResult, ScenarioResult } from "./types";
import ConfidenceBadge from "./components/ConfidenceBadge";
import IncidentBadge from "./components/IncidentBadge";
import EventTimeline from "./components/EventTimeline";
import ClaimsPanel from "./components/ClaimsPanel";

export default function App() {
  const [activeTab, setActiveTab] = useState<"investigate" | "scenarios">("investigate");

  // Investigate tab state
  const [paymentId, setPaymentId] = useState("");
  const [investigating, setInvestigating] = useState(false);
  const [investigateError, setInvestigateError] = useState<string | null>(null);
  const [investigationResult, setInvestigationResult] = useState<InvestigationResult | null>(null);

  // Demo Scenarios tab state
  const [activeLoadingScenario, setActiveLoadingScenario] = useState<string | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);

  const handleInvestigate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = paymentId.trim();
    if (!cleanId) return;

    setInvestigating(true);
    setInvestigateError(null);
    try {
      const result = await investigate(cleanId);
      setInvestigationResult(result);
    } catch (err) {
      setInvestigateError(err instanceof Error ? err.message : "Failed to run investigation");
      setInvestigationResult(null);
    } finally {
      setInvestigating(false);
    }
  };

  const handleReplayScenario = async (scenarioId: string) => {
    setActiveLoadingScenario(scenarioId);
    setScenarioError(null);
    try {
      const result = await replayScenario(scenarioId);
      setScenarioResult(result);
    } catch (err) {
      setScenarioError(err instanceof Error ? err.message : "Failed to replay scenario");
      setScenarioResult(null);
    } finally {
      setActiveLoadingScenario(null);
    }
  };

  const incidents = Array.isArray(investigationResult?.evidence_package?.incidents)
    ? (investigationResult.evidence_package.incidents as Array<{ incident_type: string; severity: string }>)
    : [];

  const events = Array.isArray(investigationResult?.evidence_package?.events)
    ? (investigationResult.evidence_package.events as Array<Record<string, unknown>>)
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* App Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur px-6 py-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              PT
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                PayTrace
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                  Engine v0.1
                </span>
              </h1>
              <p className="text-xs text-slate-400">Autonomous Payment Incident Investigation</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="max-w-6xl mx-auto px-6 flex space-x-8">
          <button
            type="button"
            onClick={() => setActiveTab("investigate")}
            className={`py-3.5 text-sm font-semibold transition-colors relative ${
              activeTab === "investigate"
                ? "text-white border-b-2 border-indigo-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Investigate
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scenarios")}
            className={`py-3.5 text-sm font-semibold transition-colors relative ${
              activeTab === "scenarios"
                ? "text-white border-b-2 border-indigo-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Demo Scenarios
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto px-6 py-8 flex-1">
        {/* TAB 1: Investigate */}
        {activeTab === "investigate" && (
          <div className="space-y-8">
            <section className="bg-slate-900/40 p-6 rounded-xl border border-slate-800/80 shadow-sm">
              <h2 className="text-base font-semibold text-slate-200 mb-2">
                Run Incident Investigation
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Enter a payment ID to trigger state reconstruction, authoritative-source rules, and verified AI investigation.
              </p>

              <form onSubmit={handleInvestigate} className="flex flex-col sm:flex-row gap-3 max-w-xl">
                <input
                  type="text"
                  placeholder="Enter payment_id"
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={investigating || !paymentId.trim()}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm text-white transition shadow-sm shrink-0"
                >
                  {investigating ? "Investigating..." : "Investigate"}
                </button>
              </form>

              {investigateError && (
                <p className="mt-3 text-xs text-red-400 font-medium">
                  {investigateError}
                </p>
              )}
            </section>

            {/* Investigation Result Display */}
            {investigationResult && (
              <div className="space-y-6">
                {/* Result Header & Status Card */}
                <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-800/80 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                        Payment Identifier
                      </span>
                      <h2 className="text-xl font-bold text-white font-mono">
                        {investigationResult.payment_id}
                      </h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">Confidence:</span>
                      <ConfidenceBadge
                        level={investigationResult.confidence.level}
                        abstained={investigationResult.abstained}
                      />
                    </div>
                  </div>

                  {/* Banners */}
                  {investigationResult.abstained && (
                    <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
                      INCONCLUSIVE — Insufficient evidence to determine root cause
                    </div>
                  )}

                  {!investigationResult.ai_activated && (
                    <div className="p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium">
                      Deterministic diagnosis — AI investigation not required
                    </div>
                  )}

                  {investigationResult.ai_activated &&
                    typeof investigationResult.investigation?.hypothesis === "string" && (
                      <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                          Investigator Hypothesis
                        </span>
                        <p className="text-sm text-slate-300 italic">
                          "{investigationResult.investigation.hypothesis}"
                        </p>
                      </div>
                    )}

                  {/* Incidents Row */}
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                      Detected Incidents
                    </span>
                    <IncidentBadge incidents={incidents} />
                  </div>
                </div>

                {/* Grid: Event Timeline & Claims */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Event Timeline */}
                  <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-800/80">
                    <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4">
                      Event Evidence Timeline
                    </h3>
                    <EventTimeline events={events} />
                  </div>

                  {/* Claims Panel */}
                  <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-800/80">
                    <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4">
                      Claims & Verification
                    </h3>
                    <ClaimsPanel
                      verifiedClaims={investigationResult.verified_claims || []}
                      rejectedClaims={investigationResult.rejected_claims || []}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Demo Scenarios */}
        {activeTab === "scenarios" && (
          <div className="space-y-8">
            <section className="bg-slate-900/40 p-6 rounded-xl border border-slate-800/80">
              <h2 className="text-base font-semibold text-slate-200 mb-2">
                Pre-built Incident Scenarios
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Trigger in-memory scenario replays against ground-truth golden datasets. No database writes are performed.
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  disabled={activeLoadingScenario !== null}
                  onClick={() => handleReplayScenario("scenario_01")}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-sm font-medium text-slate-200 transition"
                >
                  {activeLoadingScenario === "scenario_01"
                    ? "Replaying Scenario 1..."
                    : "Scenario 1: Clean Capture"}
                </button>

                <button
                  type="button"
                  disabled={activeLoadingScenario !== null}
                  onClick={() => handleReplayScenario("scenario_02")}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-sm font-medium text-slate-200 transition"
                >
                  {activeLoadingScenario === "scenario_02"
                    ? "Replaying Scenario 2..."
                    : "Scenario 2: Missing Created"}
                </button>

                <button
                  type="button"
                  disabled={activeLoadingScenario !== null}
                  onClick={() => handleReplayScenario("scenario_03")}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-sm font-medium text-slate-200 transition"
                >
                  {activeLoadingScenario === "scenario_03"
                    ? "Replaying Scenario 3..."
                    : "Scenario 3: Duplicate Webhook"}
                </button>
              </div>

              {scenarioError && (
                <p className="mt-4 text-xs text-red-400 font-medium">
                  {scenarioError}
                </p>
              )}
            </section>

            {/* Scenario Result Card */}
            {scenarioResult && (
              <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-800/80 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      {scenarioResult.scenario_id}
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      {scenarioResult.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                      {scenarioResult.description}
                    </p>
                  </div>
                  <div>
                    {scenarioResult.passed ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        PASSED
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                        FAILED
                      </span>
                    )}
                  </div>
                </div>

                {/* Two-Column Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-4 font-semibold w-1/4">Property</th>
                        <th className="py-2.5 px-4 font-semibold w-3/8">Ground Truth</th>
                        <th className="py-2.5 px-4 font-semibold w-3/8">Actual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      <tr>
                        <td className="py-3 px-4 text-slate-400 font-sans font-medium">state</td>
                        <td className="py-3 px-4 text-slate-300">
                          {String(scenarioResult.ground_truth.expected_state ?? "-")}
                        </td>
                        <td className="py-3 px-4 text-slate-200 font-semibold">
                          {scenarioResult.actual.state}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-slate-400 font-sans font-medium">incidents</td>
                        <td className="py-3 px-4 text-slate-300">
                          {Array.isArray(scenarioResult.ground_truth.expected_incidents)
                            ? (scenarioResult.ground_truth.expected_incidents as string[]).join(", ") || "[]"
                            : "-"}
                        </td>
                        <td className="py-3 px-4 text-slate-200 font-semibold">
                          {scenarioResult.actual.incidents.join(", ") || "[]"}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-slate-400 font-sans font-medium">ai_activated</td>
                        <td className="py-3 px-4 text-slate-300">
                          {String(scenarioResult.ground_truth.expected_ai_activated)}
                        </td>
                        <td className="py-3 px-4 text-slate-200 font-semibold">
                          {String(scenarioResult.actual.ai_activated)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-slate-400 font-sans font-medium">confidence</td>
                        <td className="py-3 px-4 text-slate-300">
                          {String(scenarioResult.ground_truth.expected_confidence ?? "-")}
                        </td>
                        <td className="py-3 px-4 text-slate-200 font-semibold">
                          {scenarioResult.actual.confidence}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-slate-400 font-sans font-medium">abstained</td>
                        <td className="py-3 px-4 text-slate-300">
                          {String(scenarioResult.ground_truth.expected_abstain ?? "-")}
                        </td>
                        <td className="py-3 px-4 text-slate-200 font-semibold">
                          {String(scenarioResult.actual.abstained)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Mismatches List */}
                {scenarioResult.mismatches && scenarioResult.mismatches.length > 0 && (
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 space-y-1">
                    <span className="text-xs font-semibold text-red-400 uppercase tracking-wider block">
                      Ground Truth Mismatches:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5">
                      {scenarioResult.mismatches.map((mismatch, i) => (
                        <li key={i} className="text-xs text-red-400 font-mono">
                          {mismatch}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
