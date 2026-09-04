interface EventTimelineProps {
  events: Array<Record<string, unknown>>;
}

export default function EventTimeline({ events }: EventTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic py-2">
        No events recorded in evidence package.
      </div>
    );
  }

  // Sort chronologically ascending so most recent event is at the bottom
  const sortedEvents = [...events].sort((a, b) => {
    const timeA = new Date(String(a.event_timestamp || "")).getTime() || 0;
    const timeB = new Date(String(b.event_timestamp || "")).getTime() || 0;
    return timeA - timeB;
  });

  const formatTimestamp = (raw: unknown): string => {
    if (!raw) return "No timestamp";
    try {
      const date = new Date(String(raw));
      if (isNaN(date.getTime())) return String(raw);
      return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
      });
    } catch {
      return String(raw);
    }
  };

  return (
    <div className="space-y-3">
      {sortedEvents.map((evt, idx) => {
        const eventType = String(evt.event_type || evt.event || "unknown");
        const source = String(evt.source || "webhook");
        const timestamp = formatTimestamp(evt.event_timestamp);
        const sigValid = evt.signature_valid === true;

        return (
          <div
            key={idx}
            className="flex items-start space-x-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800"
          >
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                sigValid
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-red-500/15 text-red-400 border border-red-500/30"
              }`}
            >
              {sigValid ? "✓" : "✗"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">
                  {eventType}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {timestamp}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                <span>
                  Source: <span className="text-slate-300 font-medium">{source}</span>
                </span>
                <span>•</span>
                <span>
                  Signature:{" "}
                  <span
                    className={
                      sigValid ? "text-emerald-400 font-medium" : "text-red-400 font-medium"
                    }
                  >
                    {sigValid ? "Verified" : "Invalid"}
                  </span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
