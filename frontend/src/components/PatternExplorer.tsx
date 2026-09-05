import React, { useState, useEffect } from "react";
import type { PatternSummaryItem } from "../types";
import { fetchRecurringPatterns } from "../api/client";
import {
  Layers,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Search,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

interface PatternExplorerProps {
  onSelectPayment?: (paymentId: string) => void;
}

export const PatternExplorer: React.FC<PatternExplorerProps> = ({ onSelectPayment }) => {
  const [patterns, setPatterns] = useState<PatternSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");
  const [expandedPatternId, setExpandedPatternId] = useState<string | null>(null);

  const loadPatterns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRecurringPatterns();
      setPatterns(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recurring patterns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatterns();
  }, []);

  // Filter patterns
  const filteredPatterns = patterns.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.pattern_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.pattern_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.diagnostic_characteristics.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType =
      selectedTypeFilter === "ALL" || p.pattern_type === selectedTypeFilter;

    return matchesSearch && matchesType;
  });

  // Calculate high-level summary metrics
  const totalIncidentsInPatterns = patterns.reduce((sum, p) => sum + p.incident_count, 0);
  const totalAffectedPayments = new Set(patterns.flatMap((p) => p.supporting_payment_ids)).size;
  const uniquePatternTypes = Array.from(new Set(patterns.map((p) => p.pattern_type)));

  return (
    <div className="space-y-6">
      {/* ── Header Title & Description ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            <span>Recurring Incident Pattern Explorer</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Deterministic clustering of repeated payment lifecycle anomalies and webhook delivery failures across historical records.
          </p>
        </div>

        <button
          onClick={loadPatterns}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition shadow-2xs self-start cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Patterns</span>
        </button>
      </div>

      {/* ── Deterministic Grounding Banner ─────────────────────────────── */}
      <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-indigo-950 dark:text-indigo-200">
            Deterministic Evidence-Grounded Detection
          </h4>
          <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80 leading-relaxed">
            Patterns require at least 2 incidents sharing identical canonical diagnostic fingerprints (anomaly classification, reconstructed payment state, and webhook behavior flags). PayTrace does not hallucinate patterns or infer root-cause identity without authoritative proof.
          </p>
        </div>
      </div>

      {/* ── Summary KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Detected Patterns
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {patterns.length}
            </span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
              Deterministic
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Clustered Incidents
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {totalIncidentsInPatterns}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Across all patterns
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Impacted Payments
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {totalAffectedPayments}
            </span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              Unique IDs
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Failure Categories
          </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {uniquePatternTypes.length}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              Active Modes
            </span>
          </div>
        </div>
      </div>

      {/* ── Filters & Search ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search pattern name, anomaly type, or feature..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedTypeFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              selectedTypeFilter === "ALL"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
            }`}
          >
            All Types ({patterns.length})
          </button>
          {uniquePatternTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                selectedTypeFilter === type
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* ── Patterns List ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto"></div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Analyzing historical incidents for recurring pattern clusters...
          </p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-sm font-semibold text-red-900 dark:text-red-200">
            Failed to load incident patterns
          </p>
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        </div>
      ) : filteredPatterns.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            No Recurring Incident Patterns Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            All stored incidents appear to be isolated failure modes. A pattern is registered only when at least 2 incidents share identical diagnostic dimensions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPatterns.map((pattern) => {
            const isExpanded = expandedPatternId === pattern.pattern_id;

            return (
              <div
                key={pattern.pattern_id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors"
              >
                {/* Pattern Header */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {pattern.pattern_id}
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        {pattern.pattern_type}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          pattern.pattern_strength === "STRONG"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            : pattern.pattern_strength === "MODERATE"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                        }`}
                      >
                        {pattern.pattern_strength} STRENGTH
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white pt-1">
                      {pattern.pattern_name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right sm:text-right">
                      <p className="text-base font-black text-slate-900 dark:text-white font-mono">
                        {pattern.incident_count}{" "}
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          Incidents
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {`${pattern.affected_payments_count} Payment ID${pattern.affected_payments_count === 1 ? "" : "s"}`}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        setExpandedPatternId(isExpanded ? null : pattern.pattern_id)
                      }
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 transition cursor-pointer"
                    >
                      {isExpanded ? "Collapse" : "Inspect Supporting Incidents"}
                    </button>
                  </div>
                </div>

                {/* Diagnostic Characteristics Bar */}
                <div className="px-5 py-3 bg-slate-50/60 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">
                    Diagnostic Profile:
                  </span>
                  {pattern.diagnostic_characteristics.map((char, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 font-medium"
                    >
                      {char}
                    </span>
                  ))}
                </div>

                {/* Expandable Supporting Incidents Tray */}
                {isExpanded && (
                  <div className="p-5 space-y-3 bg-slate-50/30 dark:bg-slate-950/20">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold uppercase tracking-wider text-[10px]">
                        Supporting Historical Incidents ({pattern.sample_incidents.length} shown)
                      </span>
                      {pattern.first_detected_at && pattern.last_detected_at && (
                        <span className="font-mono text-[10px]">
                          Observed window:{" "}
                          {new Date(pattern.first_detected_at).toLocaleDateString()} —{" "}
                          {new Date(pattern.last_detected_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {pattern.sample_incidents.map((sample) => (
                        <div
                          key={sample.incident_id}
                          className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  sample.severity === "HIGH"
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {sample.severity}
                              </span>
                              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                {sample.payment_id || "Unspecified payment"}
                              </span>
                              {sample.detected_at && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(sample.detected_at).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                              {sample.description}
                            </p>
                          </div>

                          {sample.payment_id && onSelectPayment && (
                            <button
                              onClick={() => onSelectPayment(sample.payment_id!)}
                              className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline shrink-0 cursor-pointer"
                            >
                              <span>Inspect in Detail</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
