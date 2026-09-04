import React, { useState } from "react";
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
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  incidents,
  scenarios,
  onSelectIncident,
  onNavigateTab,
}) => {
  const [searchPid, setSearchPid] = useState("");

  // Calculate truthful aggregate metrics
  const totalIncidents = incidents.length;
  const highSeverityCount = incidents.filter(
    (i) => i.severity === "HIGH" || i.severity === "high"
  ).length;
  const resolvedCount = incidents.filter((i) => i.resolved).length;
  const openCount = totalIncidents - resolvedCount;
  const aiActivatedCount = incidents.filter(
    (i) => i.ai_required || i.severity === "HIGH"
  ).length;
  const deterministicCount = totalIncidents - aiActivatedCount;

  const handleDirectInvestigate = (e: React.FormEvent) => {
    e.preventDefault();
    const pid = searchPid.trim();
    if (!pid) return;
    onSelectIncident(pid);
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
            and anti-hallucination claim verification powered by Gemini 2.5 Flash.
          </p>

          {/* Quick Search / Direct Investigation Box */}
          <form onSubmit={handleDirectInvestigate} className="pt-2 flex flex-col sm:flex-row gap-2.5 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchPid}
                onChange={(e) => setSearchPid(e.target.value)}
                placeholder="Enter payment_id (e.g. pay_live_001, pay_test_...)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={!searchPid.trim()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Investigate</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Decorative Background Mesh Glow */}
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* ── Truthful Metrics KPI Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Incidents */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Total Tracked Incidents</span>
            <AlertTriangle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {totalIncidents}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {scenarios.length} test fixtures available
          </div>
        </div>

        {/* Metric 2: High Severity */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>High Severity Anomalies</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {highSeverityCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            State mismatches & invalid transitions
          </div>
        </div>

        {/* Metric 3: AI Triggered vs Bypassed */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>AI Activation Gate</span>
            <Cpu className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
            {aiActivatedCount}{" "}
            <span className="text-xs font-normal text-slate-500">/ {deterministicCount} bypassed</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Only complex anomalies trigger LLM
          </div>
        </div>

        {/* Metric 4: Resolution Status */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Resolution Status</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {resolvedCount}{" "}
            <span className="text-xs font-normal text-amber-500">({openCount} open)</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Operator confirmed resolution states
          </div>
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
                Gemini 2.5 Flash Engine
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
                <span>Recent Payment Incidents</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real incident records from state reconstruction and webhook ingestion
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
            {incidents.length === 0 ? (
              <div className="p-8 text-center rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                No incidents recorded in the database yet. Replay a scenario to generate test incidents.
              </div>
            ) : (
              incidents.slice(0, 5).map((inc, idx) => (
                <div
                  key={inc.id || idx}
                  onClick={() =>
                    onSelectIncident(inc.payment_id || `pay_${inc.id}`, {
                      id: inc.id,
                      incident_type: inc.incident_type,
                      severity: inc.severity,
                      order_id: inc.order_id,
                      resolved: inc.resolved,
                      created_at: inc.created_at,
                    })
                  }
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
                        {inc.created_at ? new Date(inc.created_at).toLocaleDateString() : "Live"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {inc.resolved ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        RESOLVED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        OPEN
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
