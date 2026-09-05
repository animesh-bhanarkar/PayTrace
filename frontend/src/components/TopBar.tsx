import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useLiveMonitoring } from "../context/LiveMonitoringContext";
import { LiveStatusIndicator } from "./LiveStatusIndicator";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Check,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";

interface TopBarProps {
  onBackToIncidents?: () => void;
  showBack?: boolean;
  onOpenMobileMenu?: () => void;
  title?: string;
  onSelectIncident?: (paymentId: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onBackToIncidents,
  showBack = false,
  onOpenMobileMenu,
  title,
  onSelectIncident,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { recentEvents, unreadCount, resetUnreadCount } = useLiveMonitoring();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  // Close notifications on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(e.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsNotificationsOpen(false);
      }
    };

    if (isNotificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNotificationsOpen]);

  const handleToggleNotifications = () => {
    setIsNotificationsOpen((prev) => !prev);
  };

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    resetUnreadCount();
  };

  const formatEventTime = (timestamp?: string) => {
    if (!timestamp) return "Just now";
    try {
      const date = new Date(timestamp);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return "Recently";
    }
  };

  const getEventDetails = (eventType: string, data?: Record<string, any>) => {
    switch (eventType) {
      case "incident.created":
        return {
          title: "New Incident Detected",
          description: data?.description || `Incident recorded for payment ${data?.payment_id || ""}`,
          icon: AlertTriangle,
          color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
          paymentId: data?.payment_id,
        };
      case "incident.updated":
        return {
          title: "Incident Status Updated",
          description: data?.description || `Incident updated for payment ${data?.payment_id || ""}`,
          icon: Radio,
          color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
          paymentId: data?.payment_id,
        };
      case "investigation.completed":
        return {
          title: "Investigation Completed",
          description: data?.outcome
            ? `Outcome: ${String(data.outcome).replace(/_/g, " ")}`
            : `Investigation finalized for payment ${data?.payment_id || ""}`,
          icon: CheckCircle2,
          color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
          paymentId: data?.payment_id,
        };
      case "webhook.untrusted":
        return {
          title: "Untrusted Webhook Flagged",
          description: data?.event_type
            ? `Invalid HMAC signature on ${data.event_type}`
            : "Webhook signature verification failed",
          icon: ShieldAlert,
          color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
          paymentId: data?.payment_id,
        };
      case "webhook.received":
      default:
        return {
          title: "Live Webhook Ingested",
          description: data?.event_type
            ? `Verified ${data.event_type} (${data?.payment_id || ""})`
            : `Live telemetry event received`,
          icon: Radio,
          color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
          paymentId: data?.payment_id,
        };
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Open sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {showBack ? (
          <button
            type="button"
            onClick={onBackToIncidents}
            className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
          >
            <span>←</span>
            <span>Back to incidents</span>
          </button>
        ) : (
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {title || "Payment Incidents Console"}
          </h2>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Live SSE Connection Indicator */}
        <LiveStatusIndicator />

        {/* Environment Badge */}
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Engine Active • Test Mode
        </span>

        {/* Light / Dark Theme Switcher (Telegram-like smooth transition) */}
        <button
          type="button"
          onClick={(e) => toggleTheme(e)}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} theme`}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Notification Bell with Functional Popover */}
        <div className="relative">
          <button
            ref={bellButtonRef}
            type="button"
            onClick={handleToggleNotifications}
            className={`p-2 rounded-lg border transition relative cursor-pointer ${
              isNotificationsOpen
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            aria-label="Notifications"
            title="Live Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold flex items-center justify-center absolute -top-1 -right-1 ring-2 ring-white dark:ring-slate-900 shadow-2xs">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Functional Notification Popover */}
          {isNotificationsOpen && (
            <div
              ref={popoverRef}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden text-xs"
            >
              {/* Popover Header */}
              <div className="p-3.5 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-mono font-bold">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>Mark all as read</span>
                  </button>
                )}
              </div>

              {/* Notification Items List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                {recentEvents.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <Bell className="w-6 h-6 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-medium text-slate-700 dark:text-slate-300">No notifications yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Real-time payment and incident events will appear here</p>
                  </div>
                ) : (
                  recentEvents.slice(0, 10).map((ev, idx) => {
                    const details = getEventDetails(ev.event_type, ev.data);
                    const Icon = details.icon;
                    const isUnread = idx < unreadCount;

                    return (
                      <div
                        key={ev.id || `${ev.event_type}-${idx}`}
                        onClick={() => {
                          if (details.paymentId && onSelectIncident) {
                            onSelectIncident(details.paymentId);
                            setIsNotificationsOpen(false);
                          }
                        }}
                        className={`p-3 transition-colors flex items-start gap-3 ${
                          details.paymentId ? "hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer" : ""
                        } ${isUnread ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""}`}
                      >
                        <div className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${details.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                              {details.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                              {formatEventTime(ev.timestamp)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {details.description}
                          </p>
                          {details.paymentId && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
                              <span>View Incident ({details.paymentId})</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </div>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0 mt-1.5" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Popover Footer */}
              <div className="p-2 bg-slate-50/60 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] text-slate-400">
                  Live Stream Monitoring • SSE Connected
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
export default TopBar;
