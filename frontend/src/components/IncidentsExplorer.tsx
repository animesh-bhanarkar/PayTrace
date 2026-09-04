import React, { useState, useMemo } from "react";
import type { IncidentRecord, ScenarioFixtureItem } from "../types";
import { AlertTriangle, Clock, User, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

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
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [tagFilter, setTagFilter] = useState<string>("ALL");
  const [tabMode, setTabMode] = useState<"database" | "scenarios">("database");

  // Collect all unique tags across all incidents for filter dropdown
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    incidents.forEach((inc) => {
      if (Array.isArray(inc.tags)) {
        inc.tags.forEach((t) => tagSet.add(t.toLowerCase()));
      }
    });
    return Array.from(tagSet).sort();
  }, [incidents]);

  // Filter database incidents
  const filteredIncidents = incidents.filter((inc) => {
    const q = searchQuery.toLowerCase();
    const opStatus = (inc.operational_status || (inc.resolved ? "RESOLVED" : "OPEN")).toUpperCase();
    const priority = (inc.priority || "MEDIUM").toUpperCase();
    const techSeverity = (inc.severity || "MEDIUM").toUpperCase();
    const assignee = (inc.assignee || "").toLowerCase();
    const tags = Array.isArray(inc.tags) ? inc.tags.map((t) => t.toLowerCase()) : [];

    const matchesSearch =
      !q ||
      inc.incident_type.toLowerCase().includes(q) ||
      (inc.payment_id && inc.payment_id.toLowerCase().includes(q)) ||
      (inc.order_id && inc.order_id.toLowerCase().includes(q)) ||
      inc.description.toLowerCase().includes(q) ||
      assignee.includes(q) ||
      tags.some((t) => t.includes(q));

    const matchesStatus = statusFilter === "ALL" || opStatus === statusFilter;
    const matchesPriority = priorityFilter === "ALL" || priority === priorityFilter;
    const matchesSeverity = severityFilter === "ALL" || techSeverity === severityFilter;
    const matchesTag = tagFilter === "ALL" || tags.includes(tagFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesPriority && matchesSeverity && matchesTag;
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

  // Truthful KPI counts computed strictly from real stored data (no hardcoded increments)
  const totalLiveIncidents = incidents.length;
  const openCount = incidents.filter(
    (i) => (i.operational_status || (i.resolved ? "RESOLVED" : "OPEN")).toUpperCase() === "OPEN"
  ).length;
  const investigatingCount = incidents.filter(
    (i) => (i.operational_status || "").toUpperCase() === "INVESTIGATING"
  ).length;
  const actionRequiredCount = incidents.filter(
    (i) => (i.operational_status || "").toUpperCase() === "ACTION_REQUIRED"
  ).length;
  const resolvedCount = incidents.filter(
    (i) => (i.operational_status || (i.resolved ? "RESOLVED" : "OPEN")).toUpperCase() === "RESOLVED"
  ).length;
  const highPriorityCount = incidents.filter((i) => {
    const p = (i.priority || "MEDIUM").toUpperCase();
    const isUnresolved = (i.operational_status || (i.resolved ? "RESOLVED" : "OPEN")).toUpperCase() !== "RESOLVED";
    return isUnresolved && (p === "CRITICAL" || p === "HIGH");
  }).length;

  const getStatusBadge = (opStatus: string) => {
    switch (opStatus) {
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> RESOLVED
          </span>
        );
      case "INVESTIGATING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
            <Clock className="w-3 h-3 animate-spin" style={{ animationDuration: "3s" }} /> INVESTIGATING
          </span>
        );
      case "ACTION_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> ACTION REQUIRED
          </span>
        );
      case "OPEN":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30">
            <AlertCircle className="w-3 h-3" /> OPEN
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority.toUpperCase()) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 uppercase">
            ⚡ CRITICAL
          </span>
        );
      case "HIGH":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase">
            HIGH
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase">
            MEDIUM
          </span>
        );
      case "LOW":
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 uppercase">
            LOW
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Real Database Operational KPI Bar ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1 transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Total Live Incidents
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {totalLiveIncidents}
            </span>
            <span className="text-xs text-blue-500 font-medium">Database</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1 transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Active / In Triage
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {openCount + investigatingCount}
            </span>
            <span className="text-xs text-indigo-500">
              {investigatingCount} Investigating
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1 transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Action Required
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-500 dark:text-amber-400 font-mono">
              {actionRequiredCount}
            </span>
            <span className="text-xs text-amber-500/80">Needs Operator</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1 transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            High/Critical Unresolved
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-500 dark:text-rose-400 font-mono">
              {highPriorityCount}
            </span>
            <span className="text-xs text-rose-500/80">Triage Priority</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1 transition-colors col-span-2 lg:col-span-1">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Operationally Resolved
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-500 dark:text-emerald-400 font-mono">
              {resolvedCount}
            </span>
            <span className="text-xs text-emerald-500/80">
              {totalLiveIncidents > 0 ? `${Math.round((resolvedCount / totalLiveIncidents) * 100)}%` : "0%"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Navigation & Operational Filters Bar ───────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Source Tabs */}
          <div className="flex items-center gap-2 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 self-start">
            <button
              type="button"
              onClick={() => setTabMode("database")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                tabMode === "database"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Live Ingested Incidents ({totalLiveIncidents})
            </button>
            <button
              type="button"
              onClick={() => setTabMode("scenarios")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                tabMode === "scenarios"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Demo Golden Scenarios ({scenarios.length})
            </button>
          </div>

          {/* Real counts display */}
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Showing {tabMode === "database" ? filteredIncidents.length : filteredScenarios.length} items
          </span>
        </div>

        {/* Operational Filter Controls Row */}
        {tabMode === "database" && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
            {/* Search Input */}
            <div className="sm:col-span-4 relative">
              <input
                type="text"
                placeholder="Search Payment ID, Order ID, type, tag, assignee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="absolute left-3 top-2.5 text-slate-400 text-xs">⌕</span>
            </div>

            {/* Operational Status Filter */}
            <div className="sm:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                title="Filter by Operational Status"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Status: OPEN</option>
                <option value="INVESTIGATING">Status: INVESTIGATING</option>
                <option value="ACTION_REQUIRED">Status: ACTION REQUIRED</option>
                <option value="RESOLVED">Status: RESOLVED</option>
              </select>
            </div>

            {/* Operational Priority Filter */}
            <div className="sm:col-span-2">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                title="Filter by Operational Priority (Triage Urgency)"
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Priority: CRITICAL</option>
                <option value="HIGH">Priority: HIGH</option>
                <option value="MEDIUM">Priority: MEDIUM</option>
                <option value="LOW">Priority: LOW</option>
              </select>
            </div>

            {/* Technical Severity Filter */}
            <div className="sm:col-span-2">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                title="Filter by Technical Severity (System Impact)"
              >
                <option value="ALL">All Severities</option>
                <option value="HIGH">Tech Severity: HIGH</option>
                <option value="MEDIUM">Tech Severity: MEDIUM</option>
                <option value="LOW">Tech Severity: LOW</option>
              </select>
            </div>

            {/* Tag Filter */}
            <div className="sm:col-span-2">
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                title="Filter by Operational Tag"
              >
                <option value="ALL">All Tags</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Incidents Table / Scenario Cards ────────────────────────────────────────── */}
      {tabMode === "database" ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Incident Identity</th>
                  <th className="py-3 px-4">Payment & Order ID</th>
                  <th className="py-3 px-4">Operational Status</th>
                  <th className="py-3 px-4">Priority / Severity</th>
                  <th className="py-3 px-4">Tags & Assignee</th>
                  <th className="py-3 px-4">Detected</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                      {loading ? "Loading incidents from database..." : "No incidents match the active filters."}
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((inc) => {
                    const paymentId = inc.payment_id || `pay_probe_${inc.id}`;
                    const opStatus = (inc.operational_status || (inc.resolved ? "RESOLVED" : "OPEN")).toUpperCase();
                    const priority = (inc.priority || "MEDIUM").toUpperCase();
                    const techSeverity = (inc.severity || "MEDIUM").toUpperCase();
                    const tags = Array.isArray(inc.tags) ? inc.tags : [];
                    const assignee = inc.assignee || null;

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
                            priority: inc.priority,
                            operational_status: opStatus,
                            tags: tags,
                            assignee: assignee,
                            order_id: inc.order_id,
                            created_at: inc.created_at,
                          })
                        }
                      >
                        {/* Incident Type & Title */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5 max-w-xs">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">
                              {inc.incident_type}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                              {inc.description}
                            </span>
                          </div>
                        </td>

                        {/* Payment & Order IDs */}
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <span className="text-blue-600 dark:text-blue-400 font-medium block truncate max-w-[150px]">
                            {paymentId}
                          </span>
                          <span className="text-slate-400 truncate block max-w-[150px]">
                            {inc.order_id || "—"}
                          </span>
                        </td>

                        {/* Operational Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getStatusBadge(opStatus)}
                        </td>

                        {/* Priority (Urgency) vs Technical Severity (Impact) */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">
                                Urgency:
                              </span>
                              {getPriorityBadge(priority)}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">
                                System:
                              </span>
                              <span
                                className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                  techSeverity === "HIGH"
                                    ? "text-red-600 dark:text-red-400"
                                    : techSeverity === "MEDIUM"
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                {techSeverity}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Tags & Assignee */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1.5 max-w-[200px]">
                            {/* Assignee indicator */}
                            <div className="flex items-center gap-1 text-[11px]">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span
                                className={`truncate ${
                                  assignee
                                    ? "text-slate-800 dark:text-slate-200 font-medium"
                                    : "text-slate-400 italic"
                                }`}
                              >
                                {assignee || "Unassigned"}
                              </span>
                            </div>

                            {/* Tags list */}
                            {tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {tags.slice(0, 3).map((t) => (
                                  <span
                                    key={t}
                                    className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono"
                                  >
                                    #{t}
                                  </span>
                                ))}
                                {tags.length > 3 && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    +{tags.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No tags</span>
                            )}
                          </div>
                        </td>

                        {/* Detected / Last Updated */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {inc.detected_at
                            ? new Date(inc.detected_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : inc.created_at
                            ? new Date(inc.created_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                              })
                            : "Live"}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium transition shadow-2xs cursor-pointer"
                          >
                            <span>Investigate</span>
                            <ArrowRight className="w-3 h-3" />
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
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-indigo-500/50 transition cursor-pointer"
                onClick={() => onReplayScenario(sc.scenario_id)}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
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
                    className="px-3 py-1 rounded bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-[11px] font-semibold transition cursor-pointer"
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
