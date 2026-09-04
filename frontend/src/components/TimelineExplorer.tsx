import React, { useState, useEffect } from "react";
import type { NormalizedEventItem } from "../types";
import { fetchGlobalTimeline } from "../api/client";
import {
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Search,
} from "lucide-react";

interface TimelineExplorerProps {
  onSelectIncident: (paymentId: string, meta?: Record<string, unknown>) => void;
}

export const TimelineExplorer: React.FC<TimelineExplorerProps> = ({
  onSelectIncident,
}) => {
  const [events, setEvents] = useState<NormalizedEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [searchFilter, setSearchFilter] = useState("");

  const loadTimeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchGlobalTimeline(50, eventTypeFilter, sourceFilter);
      setEvents(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timeline events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimeline();
  }, [eventTypeFilter, sourceFilter]);

  const filteredEvents = events.filter((ev) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      (ev.payment_id && ev.payment_id.toLowerCase().includes(q)) ||
      (ev.event_id && ev.event_id.toLowerCase().includes(q)) ||
      (ev.event_type && ev.event_type.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Top Header & Filter Bar ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <span>Cross-Incident Timeline Explorer</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inspect chronological event ordering, delivery delays, and HMAC verification across all sessions
            </p>
          </div>

          <button
            onClick={loadTimeline}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Search filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by payment/event ID..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Event type filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Type:</span>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none flex-1 font-medium"
            >
              <option value="ALL">All Event Types</option>
              <option value="payment.created">payment.created</option>
              <option value="payment.authorized">payment.authorized</option>
              <option value="payment.captured">payment.captured</option>
              <option value="payment.failed">payment.failed</option>
              <option value="order.paid">order.paid</option>
            </select>
          </div>

          {/* Source filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Source:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none flex-1 font-medium"
            >
              <option value="ALL">All Sources</option>
              <option value="webhook">webhook</option>
              <option value="api">api</option>
              <option value="merchant">merchant</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Error Banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={loadTimeline}
            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold transition text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading Skeleton ─────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse space-y-2"
            >
              <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────────────────────── */}
      {!loading && filteredEvents.length === 0 && !error && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center space-y-3">
          <Clock className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No Timeline Events Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            No normalized events match the current filter selection. Replay a test scenario or trigger webhook events to populate the timeline.
          </p>
        </div>
      )}

      {/* ── Chronological Event Stream ────────────────────────────────────── */}
      {!loading && filteredEvents.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400 px-1">
            Displaying <strong>{filteredEvents.length}</strong> normalized lifecycle events
          </div>

          <div className="relative pl-6 sm:pl-8 space-y-4 before:content-[''] before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {filteredEvents.map((evt, idx) => {
              const hasDelay = typeof evt.delay_seconds === "number" && evt.delay_seconds > 5;
              const isInvalidSig = evt.signature_valid === false;

              return (
                <div key={evt.id || idx} className="relative group">
                  {/* Timeline Dot Node */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-4 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 bg-white dark:bg-slate-950 ${
                      isInvalidSig
                        ? "border-rose-500 text-rose-500"
                        : "border-indigo-500 text-indigo-400"
                    }`}
                  >
                    {isInvalidSig ? "✕" : "✓"}
                  </div>

                  {/* Event Card */}
                  <div
                    onClick={() => {
                      if (evt.payment_id) {
                        onSelectIncident(evt.payment_id, {
                          id: evt.id,
                          incident_type: evt.event_type,
                          created_at: evt.event_timestamp,
                        });
                      }
                    }}
                    className={`p-4 rounded-xl bg-white dark:bg-slate-900 border transition-all ${
                      isInvalidSig
                        ? "border-rose-500/40 bg-rose-50/20 dark:bg-rose-950/10"
                        : "border-slate-200 dark:border-slate-800 hover:border-indigo-500/50"
                    } ${evt.payment_id ? "cursor-pointer hover:shadow-md" : ""}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {evt.event_type}
                          </span>

                          {/* Signature Badge */}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              isInvalidSig
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {isInvalidSig ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                            <span>{isInvalidSig ? "TAMPERED_SIG" : "HMAC_VALID"}</span>
                          </span>

                          {/* Source badge */}
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {evt.source}
                          </span>

                          {hasDelay && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Delayed +{Math.round(evt.delay_seconds || 0)}s
                            </span>
                          )}
                        </div>

                        {/* Monospace Identifiers */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1">
                          {evt.payment_id && (
                            <span>
                              Payment: <strong className="text-slate-700 dark:text-slate-200">{evt.payment_id}</strong>
                            </span>
                          )}
                          {evt.order_id && <span>Order: {evt.order_id}</span>}
                          <span>Event ID: {evt.event_id || evt.evidence_id || "N/A"}</span>
                        </div>
                      </div>

                      {/* Timestamps */}
                      <div className="text-right text-[11px] font-mono text-slate-500 dark:text-slate-400 space-y-0.5 shrink-0">
                        <div>
                          Event: {evt.event_timestamp ? new Date(evt.event_timestamp).toISOString() : "N/A"}
                        </div>
                        {evt.ingestion_timestamp && (
                          <div className="text-[10px] text-slate-400">
                            Ingested: {new Date(evt.ingestion_timestamp).toISOString()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer link to incident detail */}
                    {evt.payment_id && (
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        <span>Investigate payment incident →</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineExplorer;
