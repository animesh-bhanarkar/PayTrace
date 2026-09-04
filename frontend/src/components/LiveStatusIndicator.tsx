import React, { useState } from "react";
import { useLiveMonitoring } from "../context/LiveMonitoringContext";

export const LiveStatusIndicator: React.FC = () => {
  const { connectionStatus, lastEvent, recentEvents, reconnect } = useLiveMonitoring();
  const [showPopover, setShowPopover] = useState(false);

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case "LIVE":
        return {
          bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          dot: "bg-emerald-500 animate-pulse",
          text: "LIVE STREAM",
        };
      case "RECONNECTING":
        return {
          bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          dot: "bg-amber-500 animate-ping",
          text: "RECONNECTING",
        };
      case "OFFLINE":
      default:
        return {
          bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          dot: "bg-rose-500",
          text: "OFFLINE",
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowPopover((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border font-mono transition cursor-pointer hover:opacity-80 ${badge.bg}`}
        title="Click to view live stream diagnostics"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
        <span>{badge.text}</span>
      </button>

      {showPopover && (
        <div className="absolute right-0 mt-2 w-72 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 text-xs font-sans">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-bold text-slate-800 dark:text-slate-200">Live SSE Diagnostics</span>
            <button
              type="button"
              onClick={reconnect}
              className="px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer"
            >
              Reconnect
            </button>
          </div>

          <div className="space-y-1.5 text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-mono font-bold">{connectionStatus}</span>
            </div>
            <div className="flex justify-between">
              <span>Transport:</span>
              <span className="font-mono">Server-Sent Events</span>
            </div>
            <div className="flex justify-between">
              <span>Recent events:</span>
              <span className="font-mono font-semibold">{recentEvents.length}</span>
            </div>
            {lastEvent && (
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                  Latest Event ({lastEvent.id}):
                </div>
                <div className="mt-1 font-mono text-[11px] text-blue-600 dark:text-blue-400 truncate">
                  {lastEvent.event_type}
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 italic">
            LIVE != AUTONOMOUS: Live monitoring is strictly for observation and real-time alerts.
          </div>
        </div>
      )}
    </div>
  );
};
export default LiveStatusIndicator;
