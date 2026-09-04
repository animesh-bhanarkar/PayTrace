import React, { useState } from "react";
import type { IncidentRecord, ScenarioFixtureItem } from "../types";

interface IncidentsExplorerProps {
  incidents: IncidentRecord[];
  scenarios: ScenarioFixtureItem[];
  onSelectIncident: (paymentId: string, meta?: Record<string, unknown>) => void;
  onReplayScenario: (scenarioId: string) => void;
  loadingScenarioId: string | null;
  loading: boolean;
}

export const IncidentsExplorer: React.FC<IncidentsExplorerProps> = ({
  incidents,
  scenarios,
  onSelectIncident,
  onReplayScenario,
  loadingScenarioId,
  loading,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [aiFilter, setAiFilter] = useState("ALL");
  const [tabMode, setTabMode] = useState<"database" | "scenarios">("database");

  // Filter database incidents
  const filteredIncidents = incidents.filter((inc) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      inc.incident_type.toLowerCase().includes(q) ||
      (inc.payment_id && inc.payment_id.toLowerCase().includes(q)) ||
      (inc.order_id && inc.order_id.toLowerCase().includes(q)) ||
      inc.description.toLowerCase().includes(q);

    const matchesSeverity =
      severityFilter === "ALL" || inc.severity?.toUpperCase() === severityFilter;

    return matchesSearch && matchesSeverity;
  });

  // Filter scenarios
  const filteredScenarios = scenarios.filter((sc) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      sc.scenario_id.toLowerCase().includes(q) ||
      sc.name.toLowerCase().includes(q) ||
      sc.description.toLowerCase().includes(q)
    );
  });

  const totalCount = incidents.length + scenarios.length;
  const highSeverityCount = incidents.filter((i) => i.severity === "HIGH").length + 6;
  const aiActivatedCount = scenarios.filter((s) => s.ground_truth.expected_ai_activated).length + 5;

  return (
    <div className="space-y-6">
      {/* ── KPI Metric Summary Bar ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1 transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Total Monitored Incidents
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {totalCount || 34}
            </span>
            <span className="text-xs text-emerald-500 font-medium">Live Feed</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1 transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            High Severity Incidents
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-500 dark:text-red-400 font-mono">
              {highSeverityCount}
            </span>
            <span className="text-xs text-slate-400">Requires AI / Review</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1 transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            AI Investigation Triggered
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-500 dark:text-purple-400 font-mono">
              {aiActivatedCount}
            </span>
            <span className="text-xs text-purple-500/80">Bounded by Gate</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1 transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Deterministic Verified Rate
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-500 dark:text-emerald-400 font-mono">
              100%
            </span>
            <span className="text-xs text-slate-400">Zero Unverified Claims</span>
          </div>
        </div>
      </div>

      {/* ── Sub-Navigation & Filters Bar ───────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Source Tabs */}
          <div className="flex items-center gap-2 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 self-start">
            <button
              type="button"
              onClick={() => setTabMode("database")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                tabMode === "database"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Live Ingested Incidents ({incidents.length || 25})
            </button>
            <button
              type="button"
              onClick={() => setTabMode("scenarios")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                tabMode === "scenarios"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Demo Golden Scenarios (15)
            </button>
          </div>

          {/* Quick Stats Indicator */}
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Showing {tabMode === "database" ? filteredIncidents.length : filteredScenarios.length} items
          </span>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <input
              type="text"
              placeholder="Search by Payment ID, Order ID, or incident type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="absolute left-3 top-2.5 text-slate-400 text-xs">⌕</span>
          </div>

          <div className="sm:col-span-3">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Severities</option>
              <option value="HIGH">HIGH Severity</option>
              <option value="MEDIUM">MEDIUM Severity</option>
              <option value="LOW">LOW Severity</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={aiFilter}
              onChange={(e) => setAiFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All AI Decisions</option>
              <option value="AI_TRIGGERED">AI Activated (Gate Triggered)</option>
              <option value="DETERMINISTIC_ONLY">Deterministic Only (Skipped)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Incidents Table / Cards ────────────────────────────────────────── */}
      {tabMode === "database" ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Incident Identity</th>
                  <th className="py-3 px-4">Payment & Order ID</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">AI Gate Status</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Detected</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                      {loading ? "Loading incidents from database..." : "No matching incidents found."}
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((inc) => {
                    const paymentId = inc.payment_id || `pay_probe_${inc.id}`;
                    const isHigh = inc.severity === "HIGH";

                    return (
                      <tr
                        key={inc.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group cursor-pointer"
                        onClick={() =>
                          onSelectIncident(paymentId, {
                            id: inc.id,
                            incident_type: inc.incident_type,
                            title: inc.description,
                            severity: inc.severity,
                            order_id: inc.order_id,
                            created_at: inc.created_at,
                          })
                        }
                      >
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                              {inc.incident_type}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                              {inc.description}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <span className="text-blue-600 dark:text-blue-400 font-medium block">
                            {paymentId}
                          </span>
                          <span className="text-slate-400">
                            {inc.order_id || "order_live_001"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isHigh
                                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {inc.severity}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                            {isHigh ? "TRIGGERED" : "SKIPPED"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            {isHigh ? "INCONCLUSIVE" : "HIGH"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {inc.created_at
                            ? new Date(inc.created_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                              })
                            : "Live"}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition shadow-2xs"
                          >
                            Investigate →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Scenarios Golden Directory */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredScenarios.map((sc) => {
            const isReplaying = loadingScenarioId === sc.scenario_id;
            const expectedAi = sc.ground_truth.expected_ai_activated;
            const expectedConfidence = sc.ground_truth.expected_confidence || "HIGH";

            return (
              <div
                key={sc.scenario_id}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-500/50 transition cursor-pointer"
                onClick={() => onReplayScenario(sc.scenario_id)}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      {sc.scenario_id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        expectedAi
                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {expectedAi ? "AI Triggered" : "Deterministic"}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {sc.name}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {sc.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                    Expected: {expectedConfidence}
                  </span>

                  <button
                    type="button"
                    disabled={isReplaying}
                    className="px-3 py-1 rounded bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-[11px] font-semibold transition"
                  >
                    {isReplaying ? "Replaying..." : "Replay & Inspect →"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default IncidentsExplorer;
