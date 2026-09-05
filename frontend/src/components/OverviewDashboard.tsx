import React, { useState, useMemo } from "react";
import type { AiConfig } from "../api/client";
import type { IncidentRecord, ScenarioFixtureItem, NavigationTab } from "../types";
import {
  ShieldCheck,
  AlertTriangle,
  Cpu,
  CheckCircle2,
  Search,
  Clock,
  ArrowRight,
  Database,
  Lock,
  Layers,
  Sparkles,
} from "lucide-react";

interface OverviewDashboardProps {
  incidents: IncidentRecord[];
  scenarios: ScenarioFixtureItem[];
  onSelectIncident: (paymentId: string, meta?: Record<string, unknown>) => void;
  onNavigateTab: (tab: NavigationTab) => void;
  onHeroSearch: (query: string) => void;
  demoMode?: boolean;
  onReplayScenario?: (scenarioId: string) => void;
  aiConfig: AiConfig;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  incidents,
  scenarios,
  onSelectIncident,
  onNavigateTab,
  onHeroSearch,
  demoMode = false,
  onReplayScenario,
  aiConfig,
}) => {
  const [searchPid, setSearchPid] = useState("");

  // When demoMode is active, synthesize incident records from the golden scenarios fixture dataset
  const demoIncidents: IncidentRecord[] = useMemo(() => {
    return scenarios.map((sc) => {
      const hasIncidents = Boolean(
        sc.ground_truth?.expected_incidents && sc.ground_truth.expected_incidents.length > 0
      );
      const isAi = Boolean(sc.ground_truth?.expected_ai_activated);
      const isResolved = !hasIncidents && !isAi && sc.ground_truth?.expected_state !== "failed";

      const opStatus = isResolved
        ? "RESOLVED"
        : isAi
        ? "ACTION_REQUIRED"
        : hasIncidents
        ? "OPEN"
        : "INVESTIGATING";

      const priority = isAi ? "HIGH" : hasIncidents ? "MEDIUM" : "LOW";
      const severity = isAi ? "HIGH" : hasIncidents ? "MEDIUM" : "LOW";
      const incidentType = hasIncidents
        ? sc.ground_truth.expected_incidents!.join(", ")
        : sc.ground_truth?.expected_state === "failed"
        ? "payment_failed"
        : "clean_flow";

      return {
        id: sc.scenario_id,
        incident_type: incidentType,
        payment_id: `pay_${sc.scenario_id}`,
        order_id: `order_${sc.scenario_id}`,
        description: `${sc.name}: ${sc.description}`,
        severity,
        evidence_ids: [],
        resolved: isResolved,
        operational_status: opStatus,
        priority,
        created_at: null,
        detected_at: null,
        ai_required: isAi,
        tags: ["demo", "golden-scenario"],
      };
    });
  }, [scenarios]);

  const activeIncidents = demoMode ? demoIncidents : incidents;

  // Calculate truthful aggregate metrics
  const totalIncidents = activeIncidents.length;

  // Operational status breakdown (Phase 6)
  const openCount = activeIncidents.filter(
    (i) => (i.operational_status || (i.resolved ? "RESOLVED" : "OPEN")).toUpperCase() === "OPEN"
  ).length;
  const investigatingCount = activeIncidents.filter(
    (i) => (i.operational_status || "").toUpperCase() === "INVESTIGATING"
  ).length;
  const actionRequiredCount = activeIncidents.filter(
    (i) => (i.operational_status || "").toUpperCase() === "ACTION_REQUIRED"
  ).length;
  const resolvedCount = activeIncidents.filter(
    (i) => (i.operational_status || (i.resolved ? "RESOLVED" : "OPEN")).toUpperCase() === "RESOLVED"
  ).length;
  const highPriorityUnresolved = activeIncidents.filter((i) => {
    const isUnres = (i.operational_status || (i.resolved ? "RESOLVED" : "OPEN")).toUpperCase() !== "RESOLVED";
    const p = (i.priority || "MEDIUM").toUpperCase();
    return isUnres && (p === "CRITICAL" || p === "HIGH");
  }).length;

  const aiActivatedCount = activeIncidents.filter(
    (i) => i.ai_required || (i.severity || "").toUpperCase() === "HIGH"
  ).length;
  const deterministicCount = totalIncidents - aiActivatedCount;

  const handleDirectInvestigate = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchPid.trim();
    if (!q) return;
    onHeroSearch(q);
    setSearchPid("");
  };

  return (
    <div className="space-y-6">
      {/* ── Executive Hero Card ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl text-slate-100">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Payment Intelligence Console</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Evidence-Grounded Payment Incident Investigation
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
            Deterministic state reconstruction, HMAC cryptographic signature verification,
            and human-controlled operational workflows.
          </p>

          {/* Quick Search / Direct Investigation Box */}
          <form onSubmit={handleDirectInvestigate} className="pt-2 flex flex-col sm:flex-row gap-2.5 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
                type="text"
                value={searchPid}
                onChange={(e) => setSearchPid(e.target.value)}
                placeholder="Search payment ID, order ID, type… (e.g. pay_001, failed)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={!searchPid.trim()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Search</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Decorative Background Mesh Glow */}
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* ── Status Summary Bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs font-medium text-slate-700 dark:text-slate-300">
          <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
          <span>{openCount} Open</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs font-medium text-indigo-600 dark:text-indigo-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{investigatingCount} Investigating</span>
        </div>
        {actionRequiredCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 shadow-2xs text-xs font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{actionRequiredCount} Action Required</span>
          </div>
        )}
        {highPriorityUnresolved > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 shadow-2xs text-xs font-semibold text-rose-700 dark:text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{highPriorityUnresolved} High/Critical</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{resolvedCount} Resolved</span>
        </div>
        <div className="ml-auto text-[11px] text-slate-400 dark:text-slate-500 font-mono">
          {totalIncidents} total · {aiActivatedCount} AI-activated · {deterministicCount} deterministic
        </div>
      </div>

      {/* ── Architecture & Security Infrastructure Status ───────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Supabase PostgreSQL
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Schema verified • Ingest pipeline active
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {aiConfig.primaryModel}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Strict JSON Schema Enforced
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                HMAC-SHA256 Signatures
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Webhook authenticity checked
            </p>
          </div>
        </div>
      </div>

      {/* ── Main 2-Column: Recent Incidents & Quick Launchers ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Recent Incidents Stream (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>{demoMode ? "Demo Golden Scenarios" : "Recent Payment Incidents"}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {demoMode
                  ? "Golden test scenarios from deterministic test suite"
                  : "Real incident records from state reconstruction and webhook ingestion"}
              </p>
            </div>

            <button
              onClick={() => onNavigateTab("incidents")}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View all ({totalIncidents})</span>
              <span>→</span>
            </button>
          </div>

          <div className="space-y-2.5 pt-1">
            {activeIncidents.length === 0 ? (
              <div className="p-8 text-center rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                {demoMode
                  ? "No golden scenarios loaded from the backend."
                  : "No incidents recorded in the database yet. Replay a scenario to generate test incidents."}
              </div>
            ) : (
              activeIncidents.slice(0, 5).map((inc, idx) => (
                <div
                  key={inc.id || idx}
                  onClick={() => {
                    if (demoMode && onReplayScenario) {
                      onReplayScenario(String(inc.id));
                    } else {
                      onSelectIncident(inc.payment_id || `pay_${inc.id}`, {
                        id: inc.id,
                        incident_type: inc.incident_type,
                        severity: inc.severity,
                        order_id: inc.order_id,
                        resolved: inc.resolved,
                        created_at: inc.created_at,
                      });
                    }
                  }}
                  className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition flex items-center justify-between gap-3 text-xs cursor-pointer group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 font-mono mt-0.5 ${
                        inc.severity === "HIGH" || inc.severity === "high"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {inc.severity}
                    </span>

                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-400 transition">
                        {inc.description || inc.incident_type}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {inc.payment_id || "pay_unassigned"} •{" "}
                        {demoMode
                          ? "Demo Golden Scenario"
                          : inc.created_at
                          ? new Date(inc.created_at).toLocaleDateString()
                          : "Live"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {inc.resolved ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {demoMode ? "CLEAN" : "RESOLVED"}
                      </span>
                    ) : inc.operational_status === "ACTION_REQUIRED" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        ACTION REQUIRED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {inc.operational_status || "OPEN"}
                      </span>
                    )}
                    <span className="text-slate-400 group-hover:translate-x-0.5 transition">→</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Workflow Launchers (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Investigation Workflows
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => onNavigateTab("search")}
                className="w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Search className="w-4 h-4 text-indigo-400" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Global Evidence Search
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Search payment, order, & event IDs
                    </div>
                  </div>
                </div>
                <span className="text-slate-400 group-hover:translate-x-0.5 transition">→</span>
              </button>

              <button
                onClick={() => onNavigateTab("timeline")}
                className="w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Timeline Explorer
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Inspect event order & delays
                    </div>
                  </div>
                </div>
                <span className="text-slate-400 group-hover:translate-x-0.5 transition">→</span>
              </button>

              <button
                onClick={() => onNavigateTab("incidents")}
                className="w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Incidents Explorer
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Replay & triage all anomalies
                    </div>
                  </div>
                </div>
                <span className="text-slate-400 group-hover:translate-x-0.5 transition">→</span>
              </button>
            </div>
          </div>

          {/* Quick Safety Notice */}
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-slate-400 leading-relaxed space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
              <ShieldCheck className="w-4 h-4" />
              <span>Safety Invariant</span>
            </div>
            <p className="text-[11px]">
              PayTrace never performs autonomous payment capture, transfers, or refunds. All
              actions remain strictly diagnostic and evidence-verified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewDashboard;
