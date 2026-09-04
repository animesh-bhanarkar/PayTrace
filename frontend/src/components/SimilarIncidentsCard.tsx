import React, { useState, useEffect } from "react";
import type { SimilarIncidentsResponse, SimilarIncidentItem } from "../types";
import { fetchSimilarIncidents } from "../api/client";
import { GitCompare, History, ArrowRight, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

interface SimilarIncidentsCardProps {
  paymentId: string;
  onSelectPayment?: (paymentId: string) => void;
}

export const SimilarIncidentsCard: React.FC<SimilarIncidentsCardProps> = ({
  paymentId,
  onSelectPayment,
}) => {
  const [data, setData] = useState<SimilarIncidentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchSimilarIncidents(paymentId, 0.30, 5);
        if (isMounted) {
          setData(res);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load similar incidents");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [paymentId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-500 animate-spin" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Historical Intelligence
          </h4>
        </div>
        <p className="text-xs text-slate-400">Calculating deterministic incident similarity...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 transition-colors">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Historical Intelligence
          </h4>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Historical similarity comparison unavailable for unpersisted or standalone scenario.
        </p>
      </div>
    );
  }

  const { similar_incidents, recurring_patterns, matches_found } = data;

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Historical Intelligence
          </h4>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
          {matches_found} Similar Match{matches_found === 1 ? "" : "es"}
        </span>
      </div>

      {/* Recurring Pattern Indicator Badge */}
      {recurring_patterns && recurring_patterns.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Recurring Pattern Detected</span>
          </div>
          <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
            Part of <strong>{recurring_patterns[0].pattern_name}</strong> (observed across{" "}
            {recurring_patterns[0].incident_count} historical incidents).
          </p>
        </div>
      )}

      {/* Similar Incidents List */}
      {similar_incidents.length === 0 ? (
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 text-center space-y-1">
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            Isolated failure pattern
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-500">
            No similar historical incidents observed yet across the stored dataset.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {similar_incidents.map((sim: SimilarIncidentItem) => {
            const isExpanded = expandedIncidentId === sim.incident_id;
            const matchPercent = Math.round(sim.similarity_score * 100);

            return (
              <div
                key={sim.incident_id}
                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-2 text-xs transition-colors"
              >
                {/* Top Row: Match % + Type + Navigate */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        matchPercent >= 80
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : matchPercent >= 50
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          : "bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                      }`}
                    >
                      {matchPercent}% Match
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white truncate">
                      {sim.incident_type}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {sim.payment_id && onSelectPayment && (
                      <button
                        onClick={() => onSelectPayment(sim.payment_id!)}
                        className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium cursor-pointer"
                        title="Inspect this historical incident"
                      >
                        <span>{sim.payment_id}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Summary */}
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {sim.comparison_summary}
                </p>

                {/* Toggle details */}
                <div className="pt-1 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800/60 text-[10px]">
                  <span className="text-slate-400 font-mono">
                    {sim.detected_at ? new Date(sim.detected_at).toLocaleDateString() : "Historical"}
                  </span>
                  <button
                    onClick={() => setExpandedIncidentId(isExpanded ? null : sim.incident_id)}
                    className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <span>{isExpanded ? "Hide details" : "Why similar?"}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Expanded Diagnostic Comparison */}
                {isExpanded && (
                  <div className="space-y-2 pt-1 border-t border-slate-200/40 dark:border-slate-800/40 text-[11px]">
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Shared Diagnostic Features:
                      </span>
                      <ul className="space-y-0.5 list-disc list-inside text-emerald-700 dark:text-emerald-400">
                        {sim.matching_features.map((feat, idx) => (
                          <li key={idx}>{feat}</li>
                        ))}
                      </ul>
                    </div>

                    {sim.non_matching_critical_features.length > 0 && (
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Critical Differences:
                        </span>
                        <ul className="space-y-0.5 list-disc list-inside text-amber-700 dark:text-amber-400">
                          {sim.non_matching_critical_features.map((diff, idx) => (
                            <li key={idx}>{diff}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Truthfulness Footer Disclaimer */}
      <p className="text-[10px] text-slate-400 dark:text-slate-500 italic pt-1 border-t border-slate-100 dark:border-slate-800">
        * Similarity scores reflect shared deterministic diagnostic evidence (event sequence, payment state, anomaly flags). Similarity does not imply identical root cause.
      </p>
    </div>
  );
};
