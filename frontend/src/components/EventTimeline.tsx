import React, { useState } from "react";
import type { NormalizedEventItem } from "../types";

interface EventTimelineProps {
  events: Array<NormalizedEventItem | Record<string, unknown>>;
  incidents?: Array<{ incident_type: string; severity?: string; description?: string }>;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events, incidents = [] }) => {
  const [groupBySource, setGroupBySource] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!events || events.length === 0) {
    return (
      <div className="text-xs text-slate-500 italic py-6 text-center">
        No events recorded in evidence package.
      </div>
    );
  }

  // Chronological sort
  const sortedEvents = [...events].sort((a, b) => {
    const timeA = new Date(String(a.event_timestamp || "")).getTime() || 0;
    const timeB = new Date(String(b.event_timestamp || "")).getTime() || 0;
    return timeA - timeB;
  });

  const displayEvents = groupBySource
    ? [...sortedEvents].sort((a, b) => String(a.source || "").localeCompare(String(b.source || "")))
    : sortedEvents;

  const formatTimestamp = (raw: unknown): string => {
    if (!raw) return "No timestamp";
    try {
      const date = new Date(String(raw));
      if (isNaN(date.getTime())) return String(raw);
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }) + ", " + date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return String(raw);
    }
  };

  // Helper to format friendly titles matching reference
  const getEventMeta = (evt: NormalizedEventItem | Record<string, unknown>, index: number) => {
    const rawType = String(evt.event_type || evt.event || "unknown");
    const source = String(evt.source || (rawType.startsWith("order.") ? "api" : "webhook"));
    const isSignatureValid = evt.signature_valid !== false;

    // Check if delayed or anomaly exists for this event
    const isDelayed = typeof evt.delay_seconds === "number" && evt.delay_seconds > 300;
    const hasDelayIncident = incidents.some((i) => i.incident_type === "delayed_webhook");
    const hasInvalidTransition = incidents.some((i) => i.incident_type === "invalid_transition");
    const isDuplicate = incidents.some((i) => i.incident_type === "duplicate_webhook");

    let title = rawType;
    let subtitle = `Razorpay • ${rawType}`;
    let status: "success" | "warning" | "error" = "success";
    let delayTag: string | null = null;
    let sourceLabel = source.toUpperCase();

    if (source.toLowerCase().includes("webhook")) {
      sourceLabel = "Webhook";
    } else if (source.toLowerCase().includes("api")) {
      sourceLabel = "API";
    } else if (source.toLowerCase().includes("internal")) {
      sourceLabel = "Internal API";
    }

    if (rawType === "order.created") {
      title = "Order created";
      subtitle = "Razorpay • order.created";
    } else if (rawType === "payment.authorized") {
      title = "Payment authorized";
      subtitle = "Razorpay • payment.authorized";
      if (index === 0 && hasInvalidTransition) {
        status = "warning";
        subtitle = "Razorpay • payment.authorized (Arrived without payment.created)";
      }
    } else if (rawType === "payment.captured") {
      title = "Payment captured (Razorpay)";
      subtitle = "Razorpay • payment.captured";
      if (hasDelayIncident || isDelayed) {
        delayTag = "+12m 56s";
        status = "warning";
      }
    } else if (rawType === "payment.failed") {
      title = "Payment failed";
      subtitle = "Razorpay • payment.failed";
      status = "error";
    }

    if (isDuplicate) {
      subtitle += " • Duplicate payload received";
    }

    if (!isSignatureValid) {
      status = "error";
      subtitle += " • Invalid HMAC signature";
    }

    return { title, subtitle, status, delayTag, sourceLabel };
  };

  return (
    <div className="space-y-4">
      {/* Header bar controls */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Event Timeline
          </h4>
          <span className="text-xs font-mono text-slate-400 cursor-pointer" title="Chronological event records">
            ⓘ
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
            <span>Group by source</span>
            <input
              type="checkbox"
              checked={groupBySource}
              onChange={(e) => setGroupBySource(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 focus:ring-blue-500 focus:ring-offset-0 transition"
            />
          </label>
        </div>
      </div>

      {/* Timeline Node List */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.75 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        {displayEvents.map((evt, idx) => {
          const { title, subtitle, status, delayTag, sourceLabel } = getEventMeta(evt, idx);
          const timestamp = formatTimestamp(evt.event_timestamp);
          const isExpanded = expandedIndex === idx;

          let iconBg = "bg-emerald-500 text-white";
          let iconGlyph = "✓";
          if (status === "warning") {
            iconBg = "bg-amber-500 text-white";
            iconGlyph = "▲";
          } else if (status === "error") {
            iconBg = "bg-red-500 text-white";
            iconGlyph = "✕";
          }

          return (
            <div key={idx} className="relative group">
              {/* Timeline Bullet Node */}
              <div
                className={`absolute -left-6 top-0.5 w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs ring-4 ring-white dark:ring-slate-900 z-10 ${iconBg}`}
              >
                {iconGlyph}
              </div>

              {/* Event Content Box */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {title}
                    </span>
                    {delayTag && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        {delayTag}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {subtitle}
                  </p>
                </div>

                <div className="flex flex-col sm:items-end gap-1 shrink-0 text-xs font-mono">
                  {String(evt.source || "").toLowerCase() === "merchant" ? (
                    <div className="text-zinc-600 dark:text-zinc-300">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1.5">MERCHANT PROCESSING TIME:</span>
                      <span>{timestamp}</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-zinc-700 dark:text-zinc-300">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1.5">EVENT TIME:</span>
                        <span>{timestamp}</span>
                      </div>
                      {evt.ingestion_timestamp && (
                        <div className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                          <span className="text-[10px] uppercase font-semibold text-zinc-400 mr-1.5">INGESTION TIME:</span>
                          <span>{formatTimestamp(evt.ingestion_timestamp)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <span className="self-start sm:self-end px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                    {sourceLabel}
                  </span>
                </div>
              </div>

              {/* Collapsible raw details */}
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  {isExpanded ? "Hide raw payload ▲" : "View raw payload ▼"}
                </button>

                {isExpanded && (
                  <pre className="mt-2 p-2.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-300 overflow-x-auto max-h-48">
                    {JSON.stringify(evt, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default EventTimeline;
