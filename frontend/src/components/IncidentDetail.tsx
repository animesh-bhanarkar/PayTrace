import React, { useState } from "react";
import type { InvestigationResult } from "../types";
import { EventTimeline } from "./EventTimeline";
import { ClaimsPanel } from "./ClaimsPanel";
import { ConfidenceGauge } from "./ConfidenceGauge";

interface IncidentDetailProps {
  investigationResult: InvestigationResult;
  incidentMeta?: {
    id?: number | string;
    incident_type?: string;
    title?: string;
    severity?: string;
    order_id?: string | null;
    created_at?: string | null;
  };
  onBack: () => void;
}

export const IncidentDetail: React.FC<IncidentDetailProps> = ({
  investigationResult,
  incidentMeta,
  onBack,
}) => {
  const [resolvedState, setResolvedState] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const paymentId = investigationResult.payment_id;
  const orderId =
    incidentMeta?.order_id ||
    (typeof investigationResult.authoritative_result?.order_id === "string"
      ? investigationResult.authoritative_result.order_id
      : "order_" + paymentId.replace("pay_", ""));

  const incidents = Array.isArray(investigationResult.evidence_package?.incidents)
    ? (investigationResult.evidence_package.incidents as Array<{ incident_type: string; severity: string; description?: string }>)
    : [];

  const primaryIncident = incidents[0] || {
    incident_type: incidentMeta?.incident_type || "invalid_transition",
    severity: incidentMeta?.severity || "HIGH",
    description: "Anomalous payment lifecycle pattern detected.",
  };

  const events = Array.isArray(investigationResult.evidence_package?.events)
    ? investigationResult.evidence_package.events
    : [];

  const confidence = investigationResult.confidence;
  const aiActivated = investigationResult.ai_activated;
  const hypothesis = investigationResult.investigation?.hypothesis || null;
  const recommendedStep =
    investigationResult.investigation?.recommended_next_step ||
    "Verify why the merchant system did not record the capture. Check merchant logs, idempotency handling, or internal errors.";

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNotes((prev) => [...prev, newNote.trim()]);
    setNewNote("");
    setShowNoteInput(false);
  };

  // Human-readable title mapping
  const getIncidentTitle = () => {
    if (incidentMeta?.title) return incidentMeta.title;
    if (primaryIncident.incident_type === "invalid_transition") {
      return "Payment may not be captured in merchant system";
    }
    if (primaryIncident.incident_type === "duplicate_webhook") {
      return "Duplicate webhook delivery detected — Idempotently deduplicated";
    }
    if (primaryIncident.incident_type === "delayed_webhook") {
      return "Webhook delivery delayed beyond threshold — Timing anomaly";
    }
    if (primaryIncident.incident_type === "out_of_order") {
      return "Out-of-order lifecycle delivery — Authorized arrived prior to created";
    }
    if (primaryIncident.incident_type === "signature_verification_failure") {
      return "Cryptographic HMAC signature verification failed — Webhook rejected";
    }
    return primaryIncident.description || "Payment incident detected in processing stream";
  };

  const formattedDate = incidentMeta?.created_at
    ? new Date(incidentMeta.created_at).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "28 Aug 2026, 10:32:45 AM";

  const incidentIdStr = incidentMeta?.id ? `inc_${incidentMeta.id}` : "inc_01J9Z3E2QX8W1Z7";

  return (
    <div className="space-y-6">
      {/* ── Top Incident Identity Header ────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer sm:hidden"
              >
                <span>←</span>
                <span>Back</span>
              </button>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                PAYMENT INCIDENT
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {resolvedState && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  RESOLVED
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
              {getIncidentTitle()}
            </h1>
          </div>

          {/* Right Status Badge */}
          <div className="flex items-center gap-3 self-start">
            <div className="flex flex-col items-end">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider ${
                  confidence.level === "HIGH"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : confidence.level === "MEDIUM"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                {confidence.abstain ? "INCONCLUSIVE" : confidence.level}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
                Confidence {confidence.level === "HIGH" ? "100%" : "62%"}
              </span>
            </div>
          </div>
        </div>

        {/* Monospace Metadata Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Payment ID Pill */}
          <button
            type="button"
            onClick={() => handleCopy(paymentId, "payment_id")}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 text-xs font-mono font-medium hover:border-slate-400 dark:hover:border-slate-500 transition cursor-pointer"
            title="Click to copy payment ID"
          >
            <span>{paymentId}</span>
            <span className="text-slate-400 text-[10px]">
              {copiedId === "payment_id" ? "✓" : "⎘"}
            </span>
          </button>

          {/* Order ID Pill */}
          <button
            type="button"
            onClick={() => handleCopy(orderId, "order_id")}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 text-xs font-mono font-medium hover:border-slate-400 dark:hover:border-slate-500 transition cursor-pointer"
            title="Click to copy order ID"
          >
            <span>{orderId}</span>
            <span className="text-slate-400 text-[10px]">
              {copiedId === "order_id" ? "✓" : "⎘"}
            </span>
          </button>

          {/* Test Mode Badge */}
          <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs font-medium">
            Test Mode
          </span>
        </div>

        {/* Timestamp & Reference Subtitle */}
        <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          Created on {formattedDate} • Incident ID:{" "}
          <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
            {incidentIdStr}
          </span>
        </div>
      </div>

      {/* ── Main 3-Column / Dual-Column Layout ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center Column (7 Cols on LG) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Event Timeline Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
            <EventTimeline events={events} incidents={incidents} />
          </div>

          {/* Section 2: AI Investigation Transparency Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
            <ClaimsPanel
              aiActivated={aiActivated}
              activationReason={investigationResult.reason}
              hypothesis={hypothesis}
              verifiedClaims={investigationResult.verified_claims || []}
              rejectedClaims={investigationResult.rejected_claims || []}
            />
          </div>

          {/* Section 3: Next Steps & Remediation Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-base text-amber-500">💡</span>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Next Steps
              </h4>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  1
                </span>
                <p>{recommendedStep}</p>
              </div>

              {notes.map((note, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300 pl-8"
                >
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Note:</span>
                  <p>{note}</p>
                </div>
              ))}

              {showNoteInput && (
                <form onSubmit={handleAddNote} className="pt-2 pl-8 space-y-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add diagnostic or remediation note..."
                    rows={2}
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition"
                    >
                      Save Note
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNoteInput(false)}
                      className="px-3 py-1 rounded text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowNoteInput(true)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1.5"
              >
                <span>📄</span>
                <span>Add Note</span>
              </button>

              <button
                type="button"
                onClick={() => setResolvedState((prev) => !prev)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
                  resolvedState
                    ? "bg-slate-700 hover:bg-slate-600"
                    : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                <span>✓</span>
                <span>{resolvedState ? "Mark as Open" : "Mark as Resolved"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Context Column (5 Cols on LG) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Section 1: Incident Summary Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Incident Summary
            </h4>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
              Razorpay shows the payment state reached{" "}
              <strong className="font-semibold text-slate-900 dark:text-white">
                {String(investigationResult.evidence_package?.reconstructed_state || "authorized")}
              </strong>
              . Authoritative source rules evaluated the event stream and verified{" "}
              {incidents.length} anomalies. Investigation concluded with{" "}
              <strong className="font-semibold text-slate-900 dark:text-white">
                {confidence.level}
              </strong>{" "}
              confidence.
            </p>
          </div>

          {/* Section 2: Confidence Breakdown Radial Gauge */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
            <ConfidenceGauge
              confidence={confidence}
              reconstructedState={String(investigationResult.evidence_package?.reconstructed_state || "")}
              incidentsCount={incidents.length}
            />
          </div>

          {/* Section 3: Key Evidence Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Key Evidence
              </h4>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium cursor-pointer hover:underline">
                View all →
              </span>
            </div>

            <div className="space-y-2.5">
              {events.slice(0, 3).map((ev, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {String(ev.event_type || ev.event || "Payment event")}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {String(ev.evidence_id || `evt_${i + 1}`)} • via {String(ev.source || "webhook")}
                      </p>
                    </div>
                  </div>
                  <span className="text-slate-400 text-sm">📄</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Audit Trail Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Audit Trail
              </h4>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium cursor-pointer hover:underline">
                View all →
              </span>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 text-xs">
              <div className="w-7 h-7 rounded-full bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                A
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Incident created
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  animesh@example.com
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400 shrink-0">
                28 Aug, 10:47 AM
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default IncidentDetail;
