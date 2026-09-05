import React, { useState, useMemo, useEffect } from "react";
import type { IncidentRecord, ScenarioFixtureItem } from "../types";
import { AlertTriangle, Clock, User, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useLiveMonitoring } from "../context/LiveMonitoringContext";

interface IncidentsExplorerProps {
  incidents: IncidentRecord[];
  scenarios: ScenarioFixtureItem[];
  onSelectIncident: (paymentId: string, meta?: Record<string, unknown>) => void;
  onReplayScenario: (scenarioId: string) => void;
  loadingScenarioId: string | null;
  loading: boolean;
  onRefresh?: () => void;
  demoMode?: boolean;
}

export const IncidentsExplorer: React.FC<IncidentsExplorerProps> = ({
  incidents,
  scenarios,
  onSelectIncident,
  onReplayScenario,
  loadingScenarioId,
  loading,
  onRefresh,
  demoMode = false,
}) => {
  const { subscribeToEvents } = useLiveMonitoring();
  const [newEventsAlert, setNewEventsAlert] = useState<{ count: number; latestType: string } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToEvents((event) => {
      if (
        event.event_type === "incident.created" ||
        event.event_type === "incident.updated" ||
        event.event_type === "webhook.received"
      ) {
        setNewEventsAlert((prev) => ({
          count: (prev?.count || 0) + 1,
          latestType: event.event_type,
        }));
      }
    });
    return unsubscribe;
  }, [subscribeToEvents]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [tagFilter, setTagFilter] = useState<string>("ALL");
  const [webhookOnly, setWebhookOnly] = useState<boolean>(false);
  const [tabMode, setTabMode] = useState<"database" | "scenarios">(demoMode ? "scenarios" : "database");

  // Sync tabMode with global demoMode toggle
  useEffect(() => {
    setTabMode(demoMode ? "scenarios" : "database");
  }, [demoMode]);

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
    const matchesWebhook =
      !webhookOnly ||
      inc.incident_type.toLowerCase().includes("webhook") ||
      inc.description.toLowerCase().includes("webhook") ||
      inc.incident_type === "out_of_order" ||
      inc.incident_type === "delayed_webhook" ||
      inc.incident_type === "duplicate_webhook" ||
      inc.incident_type === "signature_verification_failure";

    return (
      matchesSearch &&
      matchesStatus &&
      matchesPriority &&
      matchesSeverity &&
      matchesTag &&
      matchesWebhook
    );
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

  const getStatusBadge = (opStatus: string) => {
    switch (opStatus) {
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>RESOLVED</span>
          </span>
        );
      case "INVESTIGATING":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
            <Clock className="w-3 h-3 text-indigo-500 animate-spin shrink-0" style={{ animationDuration: "3s" }} />
            <span>INVESTIGATING</span>
          </span>
        );
      case "ACTION_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
            <span>ACTION REQUIRED</span>
          </span>
        );
      case "OPEN":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <AlertCircle className="w-3 h-3 text-slate-400 shrink-0" />
            <span>OPEN</span>
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority.toUpperCase()) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase">
            ⚡ CRITICAL
          </span>
        );
      case "HIGH":
        return (
          <span className="inline-flex items-center text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase">
            HIGH
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center text-[11px] font-medium text-blue-600 dark:text-blue-400 uppercase">
            MEDIUM
          </span>
        );
      case "LOW":
      default:
        return (
          <span className="inline-flex items-center text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase">
            LOW
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Live Ingestion Event Alert Banner ─────────────────────────────────────────── */}
      {newEventsAlert && (
        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800/80 rounded-xl flex items-center justify-between shadow-2xs transition-all">
          <div className="flex items-center gap-2.5 text-xs text-blue-900 dark:text-blue-200">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
            <span className="font-bold">Live Event Received:</span>
            <span>
              {newEventsAlert.count} new update{newEventsAlert.count > 1 ? "s" : ""} detected ({newEventsAlert.latestType}).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNewEventsAlert(null);
                onRefresh?.();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh Table
            </button>
            <button
              type="button"
              onClick={() => setNewEventsAlert(null)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              title="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Compact Operational Status Summary ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5 px-0.5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs font-medium text-slate-700 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white font-mono">{totalLiveIncidents}</span>
          <span className="text-slate-500 dark:text-slate-400">Total Incidents</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs font-medium text-slate-700 dark:text-slate-300">
          <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-900 dark:text-white font-mono">{openCount}</span>
          <span>Open</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs font-medium text-indigo-600 dark:text-indigo-400">
          <Clock className="w-3.5 h-3.5 text-indigo-500" />
          <span className="font-semibold font-mono">{investigatingCount}</span>
          <span>Investigating</span>
        </div>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-2xs text-xs font-medium ${
          actionRequiredCount > 0
            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 font-semibold"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
        }`}>
          <AlertTriangle className={`w-3.5 h-3.5 ${actionRequiredCount > 0 ? "text-amber-500" : "text-slate-400"}`} />
          <span className="font-semibold font-mono">{actionRequiredCount}</span>
          <span>Action Required</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-semibold font-mono">{resolvedCount}</span>
          <span>Resolved</span>
        </div>
      </div>

      {/* ── Supporting Navigation & Operational Filters Bar ────────────────────────── */}
      <div className="bg-slate-50/70 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Source Tabs */}
          <div className="flex items-center gap-2 p-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 self-start">
            <button
              type="button"
              onClick={() => setTabMode("database")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                tabMode === "database"
                  ? "bg-slate-900 dark:bg-slate-950 text-white shadow-2xs"
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
                  ? "bg-slate-900 dark:bg-slate-950 text-white shadow-2xs"
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
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="absolute left-3 top-2.5 text-slate-400 text-xs">⌕</span>
            </div>

            {/* Operational Status Filter */}
            <div className="sm:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

            {/* Webhook Only Toggle */}
            <div className="sm:col-span-12 flex items-center justify-between pt-0.5">
              <button
                type="button"
                onClick={() => setWebhookOnly(!webhookOnly)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer border ${
                  webhookOnly
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                }`}
              >
                <span>⚡ Webhook Anomalies Only</span>
                {webhookOnly && <span className="text-[10px] font-mono">ACTIVE</span>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Primary Incidents Workspace ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        {/* Visually Distinct but Restrained Workspace Header */}
        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              {tabMode === "database" ? "Payment Incident Records" : "Demo Golden Scenarios"}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {tabMode === "database"
                ? `${filteredIncidents.length} ${filteredIncidents.length === 1 ? "record" : "records"}`
                : `${filteredScenarios.length} scenarios`}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {tabMode === "database"
              ? "Primary audit stream of detected payment failures & state anomalies"
              : "Benchmark failure patterns for root-cause and AI verification"}
          </span>
        </div>

        {tabMode === "database" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-2.5 px-4">Incident Identity</th>
                  <th className="py-2.5 px-4">Payment & Order ID</th>
                  <th className="py-2.5 px-4">Operational Status</th>
                  <th className="py-2.5 px-4">Urgency & Severity</th>
                  <th className="py-2.5 px-4">Tags & Assignee</th>
                  <th className="py-2.5 px-4">Detected</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
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
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer"
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
                        {/* 1. PRIMARY: Incident Identity & Description */}
                        <td className="py-2.5 px-4">
                          <div className="space-y-0.5 max-w-xs">
                            <span className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors block truncate">
                              {inc.incident_type}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-snug">
                              {inc.description}
                            </span>
                          </div>
                        </td>

                        {/* 2. PRIMARY: Payment & Order IDs */}
                        <td className="py-2.5 px-4 font-mono text-[11px]">
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold block truncate max-w-[150px]">
                            {paymentId}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500 truncate block max-w-[150px] text-[10px]">
                            {inc.order_id || "—"}
                          </span>
                        </td>

                        {/* 3. SECONDARY: Operational Status */}
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {getStatusBadge(opStatus)}
                        </td>

                        {/* 4. SECONDARY: Priority (Urgency) & Technical Severity (Impact) */}
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div>
                              {getPriorityBadge(priority)}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              impact: <span className="font-medium text-slate-600 dark:text-slate-400">{techSeverity.toLowerCase()}</span>
                            </div>
                          </div>
                        </td>

                        {/* 5. TERTIARY: Tags & Assignee */}
                        <td className="py-2.5 px-4">
                          <div className="space-y-0.5 max-w-[180px]">
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 truncate">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span
                                className={`truncate ${
                                  assignee
                                    ? "font-medium text-slate-700 dark:text-slate-300"
                                    : "italic text-slate-400 dark:text-slate-500"
                                }`}
                              >
                                {assignee || "Unassigned"}
                              </span>
                            </div>

                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                              {tags.length > 0 ? tags.map((t) => `#${t}`).join(" ") : <span className="italic">no tags</span>}
                            </div>
                          </div>
                        </td>

                        {/* 6. SECONDARY: Detected / Last Updated */}
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
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

                        {/* 7. Action */}
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition group-hover:translate-x-0.5 cursor-pointer"
                          >
                            <span>Investigate</span>
                            <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Scenarios Golden Directory */
          <div className="p-5">
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
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentsExplorer;
