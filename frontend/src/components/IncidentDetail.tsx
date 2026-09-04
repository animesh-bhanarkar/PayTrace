import React, { useState, useEffect } from "react";
import type { InvestigationResult, IncidentRecord, IncidentNoteItem } from "../types";
import { EventTimeline } from "./EventTimeline";
import { ClaimsPanel } from "./ClaimsPanel";
import { ConfidenceGauge } from "./ConfidenceGauge";
import { EvidenceClaimGraph } from "./EvidenceClaimGraph";
import { InvestigationReportModal } from "./InvestigationReportModal";
import { MissingEvidenceCard } from "./MissingEvidenceCard";
import {
  resolveIncident,
  reopenIncident,
  fetchIncidentNotes,
  createIncidentNote,
} from "../api/client";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Layers,
  Clock,
  Send,
  User,
  ShieldCheck,
  Check,
  Share2,
} from "lucide-react";

interface IncidentDetailProps {
  investigationResult: InvestigationResult;
  incidentMeta?: {
    id?: number | string;
    incident_type?: string;
    title?: string;
    severity?: string;
    order_id?: string | null;
    resolved?: boolean;
    created_at?: string | null;
  };
  onBack: () => void;
  onSelectEvidence?: (evidenceId: string) => void;
}

export const IncidentDetail: React.FC<IncidentDetailProps> = ({
  investigationResult,
  incidentMeta,
  onBack,
  onSelectEvidence,
}) => {
  const [resolvedState, setResolvedState] = useState<boolean>(
    Boolean(incidentMeta?.resolved)
  );
  const [isResolving, setIsResolving] = useState(false);
  const [notes, setNotes] = useState<IncidentNoteItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [authorName, setAuthorName] = useState("Investigator");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<"overview" | "graph" | "timeline">("overview");
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
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
  const hypothesis = investigationResult.investigation?.hypothesis || undefined;
  const verifiedClaims = investigationResult.verified_claims || [];
  const rejectedClaims = investigationResult.rejected_claims || [];
  const recommendedStep =
    investigationResult.investigation?.recommended_next_step ||
    "Verify why the merchant system did not record the capture. Check merchant logs, idempotency handling, or internal errors.";

  // Fetch human investigator notes on mount or paymentId change
  useEffect(() => {
    let isMounted = true;
    async function loadNotes() {
      setLoadingNotes(true);
      try {
        const fetchedNotes = await fetchIncidentNotes(paymentId);
        if (isMounted) {
          setNotes(fetchedNotes);
        }
      } catch (err) {
        console.warn("Could not load notes:", err);
      } finally {
        if (isMounted) setLoadingNotes(false);
      }
    }
    loadNotes();
    return () => {
      isMounted = false;
    };
  }, [paymentId]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleResolve = async () => {
    setIsResolving(true);
    try {
      if (resolvedState) {
        await reopenIncident(paymentId);
        setResolvedState(false);
      } else {
        await resolveIncident(paymentId, "Resolved by investigator via console");
        setResolvedState(true);
      }
    } catch (err) {
      console.error("Resolution toggle failed:", err);
      // Optimistic toggle fallback for unpersisted scenario payments
      setResolvedState(!resolvedState);
    } finally {
      setIsResolving(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || isSubmittingNote) return;

    setIsSubmittingNote(true);
    try {
      const added = await createIncidentNote(paymentId, newNoteText.trim(), authorName);
      setNotes((prev) => [added, ...prev]);
      setNewNoteText("");
    } catch (err) {
      console.warn("Saving note to backend failed, saving locally:", err);
      const fallbackNote: IncidentNoteItem = {
        id: `local_note_${Date.now()}`,
        payment_id: paymentId,
        note_text: newNoteText.trim(),
        author: authorName,
        created_at: new Date().toISOString(),
      };
      setNotes((prev) => [fallbackNote, ...prev]);
      setNewNoteText("");
    } finally {
      setIsSubmittingNote(false);
    }
  };

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

  const incidentRecordForReport: IncidentRecord = {
    id: incidentMeta?.id || 1,
    incident_type: primaryIncident.incident_type,
    payment_id: paymentId,
    order_id: orderId,
    description: getIncidentTitle(),
    severity: primaryIncident.severity,
    evidence_ids: events.map((e, idx) => e.evidence_id || `evt_${idx + 1}`),
    resolved: resolvedState,
    created_at: incidentMeta?.created_at || new Date().toISOString(),
  };

  return (
    <div className="space-y-6">
      {/* ── Top Incident Identity Header ────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer sm:hidden"
              >
                <span>←</span>
                <span>Back</span>
              </button>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                PAYMENT INCIDENT
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {resolvedState ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> RESOLVED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <AlertCircle className="w-3 h-3" /> OPEN
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
              {getIncidentTitle()}
            </h1>
          </div>

          {/* Right Action & Status Group */}
          <div className="flex flex-wrap items-center gap-3 self-start">
            {/* Export Report Button */}
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-300 dark:border-slate-700 transition shadow-xs cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>Export Report</span>
            </button>

            {/* Resolution Toggle Button */}
            <button
              type="button"
              disabled={isResolving}
              onClick={handleToggleResolve}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition shadow-xs cursor-pointer disabled:opacity-50 ${
                resolvedState
                  ? "bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                  : "bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isResolving ? "Updating..." : resolvedState ? "Reopen Incident" : "Mark Resolved"}</span>
            </button>
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
      </div>

      {/* ── Deterministic Missing Evidence Engine ── */}
      {investigationResult.missing_evidence_report && (
        <MissingEvidenceCard report={investigationResult.missing_evidence_report} />
      )}

      {/* ── View Tab Switcher (Overview / Traceability Graph / Event Timeline) ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveViewTab("overview")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeViewTab === "overview"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Investigation Overview</span>
        </button>

        <button
          onClick={() => setActiveViewTab("graph")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeViewTab === "graph"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Evidence ↔ Claim Graph</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
            {verifiedClaims.length + rejectedClaims.length}
          </span>
        </button>

        <button
          onClick={() => setActiveViewTab("timeline")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeViewTab === "timeline"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Event Timeline</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-500/20 text-slate-400 font-mono">
            {events.length}
          </span>
        </button>
      </div>

      {/* ── View: Interactive Graph Tab ─────────────────────────────────────── */}
      {activeViewTab === "graph" && (
        <EvidenceClaimGraph
          events={events}
          verifiedClaims={verifiedClaims}
          rejectedClaims={rejectedClaims}
          hypothesis={hypothesis}
        />
      )}

      {/* ── View: Event Timeline Tab ────────────────────────────────────────── */}
      {activeViewTab === "timeline" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <EventTimeline events={events} incidents={incidents} />
        </div>
      )}

      {/* ── View: Main Overview Dual-Column Layout ───────────────────────────── */}
      {activeViewTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Section 1: AI Investigation Transparency & Claims Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
              <ClaimsPanel
                aiActivated={aiActivated}
                activationReason={investigationResult.reason}
                hypothesis={hypothesis}
                verifiedClaims={verifiedClaims}
                rejectedClaims={rejectedClaims}
              />
            </div>

            {/* Section 2: Inline Traceability Graph Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Citation Traceability Graph
                </span>
                <button
                  onClick={() => setActiveViewTab("graph")}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Expand Full View →
                </button>
              </div>
              <EvidenceClaimGraph
                events={events}
                verifiedClaims={verifiedClaims}
                rejectedClaims={rejectedClaims}
              />
            </div>

            {/* Section 3: Next Steps & Remediation Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-base text-amber-500">💡</span>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Recommended Remediation Step
                </h4>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-mono">
                {recommendedStep}
              </div>
            </div>

            {/* Section 4: Human Investigator Notes Panel */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Human Investigator Annotations ({notes.length})
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">
                  Persisted separately from AI claims
                </span>
              </div>

              {/* Note Submission Form */}
              <form onSubmit={handleAddNote} className="space-y-3 pt-1">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="Your Name / Handle"
                      className="bg-transparent border-none text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none w-32"
                    />
                  </div>
                </div>

                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Add an investigator note, operational context, or merchant outreach status..."
                  rows={2}
                  className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newNoteText.trim() || isSubmittingNote}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition shadow-xs cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingNote ? "Saving..." : "Add Annotation"}</span>
                  </button>
                </div>
              </form>

              {/* Notes List */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                {loadingNotes ? (
                  <div className="text-xs text-slate-400 text-center py-4">
                    Loading investigator annotations...
                  </div>
                ) : notes.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-4 italic">
                    No annotations recorded for this incident yet.
                  </div>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {note.author}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                            HUMAN
                          </span>
                        </div>
                        <span className="font-mono text-[10px]">
                          {note.created_at ? new Date(note.created_at).toLocaleString() : "Just now"}
                        </span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {note.note_text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Context Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Section 1: Incident Summary Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Authoritative Lifecycle Summary
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                Payment state reconstructed as{" "}
                <strong className="font-semibold text-slate-900 dark:text-white uppercase font-mono">
                  {String(investigationResult.evidence_package?.reconstructed_state || "authorized")}
                </strong>
                . Authoritative source rules evaluated the event stream and verified{" "}
                {incidents.length} anomalies. Investigation concluded with{" "}
                <strong className="font-semibold text-slate-900 dark:text-white">
                  {confidence.level}
                </strong>{" "}
                confidence calibration.
              </p>
            </div>

            {/* Section 2: Confidence Breakdown Radial Gauge */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
              <ConfidenceGauge
                confidence={confidence}
                reconstructedState={String(investigationResult.evidence_package?.reconstructed_state || "")}
                incidentsCount={incidents.length}
                totalEventsCount={events.length}
                verifiedClaimsCount={verifiedClaims.length}
                totalClaimsCount={verifiedClaims.length + rejectedClaims.length}
              />
            </div>

            {/* Section 3: Key Evidence Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 transition-colors">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Key Evidence ({events.length})
                </h4>
                <button
                  onClick={() => setActiveViewTab("timeline")}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                >
                  View timeline →
                </button>
              </div>

              <div className="space-y-2.5">
                {events.slice(0, 3).map((ev, i) => {
                  const evId = String(ev.evidence_id || ev.event_id || `evt_${i + 1}`);
                  return (
                    <div
                      key={i}
                      onClick={() => onSelectEvidence?.(evId)}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start justify-between gap-3 text-xs hover:border-blue-500/50 cursor-pointer transition-all group"
                      title="Inspect cryptographic evidence detail"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-400 transition-colors">
                            {String(ev.event_type || ev.event || "Payment event")}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {evId} • via {String(ev.source || "webhook")}
                          </p>
                        </div>
                      </div>
                      <span className="text-slate-400 group-hover:text-blue-400 text-sm">📄</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Printable Report Modal ────────────────────────────────────────── */}
      <InvestigationReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        result={investigationResult}
        incidentRecord={incidentRecordForReport}
        notes={notes}
      />
    </div>
  );
};

export default IncidentDetail;
