import React, { useState, useEffect } from "react";
import type {
  InvestigationResult,
  IncidentRecord,
  IncidentNoteItem,
  OperationalStatus,
  OperationalPriority,
  WorkflowHistoryItem,
} from "../types";
import { EventTimeline } from "./EventTimeline";
import { ClaimsPanel } from "./ClaimsPanel";
import { ConfidenceGauge } from "./ConfidenceGauge";
import { EvidenceClaimGraph } from "./EvidenceClaimGraph";
import { InvestigationReportModal } from "./InvestigationReportModal";
import { MissingEvidenceCard } from "./MissingEvidenceCard";
import { SimilarIncidentsCard } from "./SimilarIncidentsCard";
import { WebhookDiagnosticsCard } from "./WebhookDiagnosticsCard";
import { AdvancedInvestigationWorkspace } from "./AdvancedInvestigationWorkspace";
import {
  resolveIncident,
  reopenIncident,
  fetchIncidentNotes,
  createIncidentNote,
  updateIncidentStatus,
  updateIncidentPriority,
  addIncidentTag,
  removeIncidentTag,
  updateIncidentAssignee,
  fetchIncidentHistory,
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
  Tag,
  History,
  X,
  Plus,
  Play,
  AlertTriangle,
  ArrowRight,
  Radio,
  BrainCircuit,
  Sparkles,
} from "lucide-react";
import { useLiveMonitoring } from "../context/LiveMonitoringContext";

interface IncidentDetailProps {
  investigationResult: InvestigationResult;
  incidentMeta?: {
    id?: number | string;
    incident_type?: string;
    title?: string;
    severity?: string;
    priority?: string;
    operational_status?: string;
    tags?: string[];
    assignee?: string | null;
    order_id?: string | null;
    resolved?: boolean;
    created_at?: string | null;
  };
  onBack: () => void;
  onSelectEvidence?: (evidenceId: string) => void;
  onSelectPayment?: (paymentId: string) => void;
  onReload?: () => void;
}

export const IncidentDetail: React.FC<IncidentDetailProps> = ({
  investigationResult,
  incidentMeta,
  onBack,
  onSelectEvidence,
  onSelectPayment,
  onReload,
}) => {
  const { subscribeToEvents } = useLiveMonitoring();
  const [liveUpdateAlert, setLiveUpdateAlert] = useState<string | null>(null);

  const paymentId = investigationResult.payment_id;

  useEffect(() => {
    const unsubscribe = subscribeToEvents((event) => {
      const eventPid = event.data?.payment_id;
      const eventIncId = String(event.data?.incident_id || "");
      const currentIncId = String(incidentMeta?.id || "");

      if (
        (eventPid && eventPid === paymentId) ||
        (eventIncId && currentIncId && eventIncId === currentIncId)
      ) {
        setLiveUpdateAlert(
          `Live update received (${event.event_type}) for this payment/incident.`
        );
      }
    });
    return unsubscribe;
  }, [subscribeToEvents, paymentId, incidentMeta?.id]);
  const orderId =
    incidentMeta?.order_id ||
    (typeof investigationResult.authoritative_result?.order_id === "string"
      ? investigationResult.authoritative_result.order_id
      : "order_" + paymentId.replace("pay_", ""));

  // Operational State
  const initialStatus = (
    incidentMeta?.operational_status ||
    (incidentMeta?.resolved ? "RESOLVED" : "OPEN")
  ).toUpperCase() as OperationalStatus;

  const [operationalStatus, setOperationalStatus] = useState<OperationalStatus>(initialStatus);
  const [priority, setPriority] = useState<OperationalPriority>(
    ((incidentMeta?.priority || "MEDIUM").toUpperCase() as OperationalPriority)
  );
  const [tags, setTags] = useState<string[]>(
    Array.isArray(incidentMeta?.tags) ? incidentMeta.tags : []
  );
  const [assignee, setAssignee] = useState<string | null>(incidentMeta?.assignee || null);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Resolution modal & notes state
  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);
  const [resolutionNotesInput, setResolutionNotesInput] = useState(
    "Verified and remediated via investigator console."
  );
  const [isResolving, setIsResolving] = useState(false);

  // Inline edit state
  const [isEditingAssignee, setIsEditingAssignee] = useState(false);
  const [assigneeDraft, setAssigneeDraft] = useState(assignee || "");
  const [newTagInput, setNewTagInput] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);

  // Action status message
  const [actionNotice, setActionNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Notes state
  const [notes, setNotes] = useState<IncidentNoteItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [authorName, setAuthorName] = useState(assignee || "Investigator");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // View tabs
  const [activeViewTab, setActiveViewTab] = useState<"overview" | "advanced" | "webhooks" | "history" | "graph" | "timeline">("overview");
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const showNotice = (message: string, type: "success" | "error" = "success") => {
    setActionNotice({ message, type });
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Load Notes & Workflow History
  useEffect(() => {
    let isMounted = true;
    async function loadOperationalData() {
      setLoadingNotes(true);
      setLoadingHistory(true);
      try {
        const [fetchedNotes, fetchedHistory] = await Promise.all([
          fetchIncidentNotes(paymentId),
          fetchIncidentHistory(paymentId).catch(() => []),
        ]);
        if (isMounted) {
          setNotes(fetchedNotes);
          setWorkflowHistory(fetchedHistory);
        }
      } catch (err) {
        console.warn("Could not load operational data:", err);
      } finally {
        if (isMounted) {
          setLoadingNotes(false);
          setLoadingHistory(false);
        }
      }
    }
    loadOperationalData();
    return () => {
      isMounted = false;
    };
  }, [paymentId]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Status transitions
  const handleTransitionStatus = async (newStatus: OperationalStatus, resolutionNotes?: string) => {
    setIsResolving(true);
    try {
      if (newStatus === "RESOLVED") {
        await resolveIncident(paymentId, resolutionNotes || resolutionNotesInput);
      } else if (operationalStatus === "RESOLVED") {
        await reopenIncident(paymentId);
        if (newStatus !== "OPEN") {
          await updateIncidentStatus(paymentId, newStatus, authorName);
        }
      } else {
        await updateIncidentStatus(paymentId, newStatus, authorName);
      }

      setOperationalStatus(newStatus);
      showNotice(`Operational status changed to ${newStatus}`);

      // Refresh history
      const updatedHistory = await fetchIncidentHistory(paymentId).catch(() => []);
      setWorkflowHistory(updatedHistory);
    } catch (err: any) {
      console.error("Status transition failed:", err);
      showNotice(err?.message || "Failed to update status", "error");
    } finally {
      setIsResolving(false);
      setIsResolutionModalOpen(false);
    }
  };

  // Priority change
  const handleChangePriority = async (newPriority: OperationalPriority) => {
    try {
      await updateIncidentPriority(paymentId, newPriority, authorName);
      setPriority(newPriority);
      showNotice(`Triage priority updated to ${newPriority}`);
      const updatedHistory = await fetchIncidentHistory(paymentId).catch(() => []);
      setWorkflowHistory(updatedHistory);
    } catch (err: any) {
      console.error("Priority update failed:", err);
      showNotice(err?.message || "Failed to update priority", "error");
    }
  };

  // Add Tag
  const handleAddTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = newTagInput.trim().toLowerCase();
    if (!cleanTag) return;

    if (tags.includes(cleanTag)) {
      showNotice(`Tag #${cleanTag} is already attached`, "error");
      setNewTagInput("");
      setIsAddingTag(false);
      return;
    }

    try {
      await addIncidentTag(paymentId, cleanTag, authorName);
      setTags((prev) => [...prev, cleanTag]);
      setNewTagInput("");
      setIsAddingTag(false);
      showNotice(`Tag #${cleanTag} added`);
      const updatedHistory = await fetchIncidentHistory(paymentId).catch(() => []);
      setWorkflowHistory(updatedHistory);
    } catch (err: any) {
      console.error("Tag addition failed:", err);
      showNotice(err?.message || "Failed to add tag", "error");
    }
  };

  // Remove Tag
  const handleRemoveTag = async (tagToRemove: string) => {
    try {
      await removeIncidentTag(paymentId, tagToRemove, authorName);
      setTags((prev) => prev.filter((t) => t !== tagToRemove));
      showNotice(`Tag #${tagToRemove} removed`);
      const updatedHistory = await fetchIncidentHistory(paymentId).catch(() => []);
      setWorkflowHistory(updatedHistory);
    } catch (err: any) {
      console.error("Tag removal failed:", err);
      showNotice(err?.message || "Failed to remove tag", "error");
    }
  };

  // Assignee Save
  const handleSaveAssignee = async (targetAssignee: string | null) => {
    try {
      await updateIncidentAssignee(paymentId, targetAssignee, authorName);
      setAssignee(targetAssignee);
      setIsEditingAssignee(false);
      showNotice(targetAssignee ? `Assigned to ${targetAssignee}` : "Incident unassigned");
      const updatedHistory = await fetchIncidentHistory(paymentId).catch(() => []);
      setWorkflowHistory(updatedHistory);
    } catch (err: any) {
      console.error("Assignee update failed:", err);
      showNotice(err?.message || "Failed to update assignee", "error");
    }
  };

  // Notes submission
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || isSubmittingNote) return;

    setIsSubmittingNote(true);
    try {
      const added = await createIncidentNote(paymentId, newNoteText.trim(), authorName);
      setNotes((prev) => [added, ...prev]);
      setNewNoteText("");
      showNotice("Annotation added successfully");
    } catch (err: any) {
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
      showNotice("Annotation saved locally", "success");
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
    priority: priority,
    operational_status: operationalStatus,
    tags: tags,
    assignee: assignee,
    evidence_ids: events.map((e, idx) => e.evidence_id || `evt_${idx + 1}`),
    resolved: operationalStatus === "RESOLVED",
    created_at: incidentMeta?.created_at || new Date().toISOString(),
  };

  const isResolved = operationalStatus === "RESOLVED";

  const renderStatusIndicator = () => {
    if (isResolved) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>RESOLVED</span>
        </span>
      );
    }
    if (operationalStatus === "INVESTIGATING") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          <Clock className="w-3.5 h-3.5 text-indigo-500 animate-spin shrink-0" style={{ animationDuration: "3s" }} />
          <span>INVESTIGATING</span>
        </span>
      );
    }
    if (operationalStatus === "ACTION_REQUIRED") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>ACTION REQUIRED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>OPEN</span>
      </span>
    );
  };

  const renderPriorityIndicator = () => {
    switch (priority) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 uppercase">
            ⚡ CRITICAL
          </span>
        );
      case "HIGH":
        return (
          <span className="inline-flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">
            HIGH
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">
            MEDIUM
          </span>
        );
      case "LOW":
      default:
        return (
          <span className="inline-flex items-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
            LOW
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Action Notice Banner ────────────────────────────────────────── */}
      {actionNotice && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium transition shadow-xs ${
            actionNotice.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Live Activity Notification Banner ────────────────────────────── */}
      {liveUpdateAlert && (
        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 shadow-2xs animate-in fade-in transition-all">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
            <span className="font-semibold">Live Incident Activity:</span>
            <span>{liveUpdateAlert}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLiveUpdateAlert(null);
                onReload?.();
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition cursor-pointer"
            >
              Reload Incident
            </button>
            <button
              type="button"
              onClick={() => setLiveUpdateAlert(null)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Top Incident Identity & Operational Control Header ───────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors space-y-4">
        {/* Breadcrumb / Context & Identifiers Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>←</span>
              <span>Back to incidents</span>
            </button>

            <span className="text-slate-300 dark:text-slate-700">•</span>

            {/* Formal Incident Type */}
            <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
              {primaryIncident.incident_type}
            </span>

            <span className="text-slate-300 dark:text-slate-700">•</span>

            {/* Payment ID (Click to copy) */}
            <button
              type="button"
              onClick={() => handleCopy(paymentId, "payment_id")}
              className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              title="Click to copy payment ID"
            >
              <span>{paymentId}</span>
              <span className="text-slate-400 text-[10px]">
                {copiedId === "payment_id" ? "✓" : "⎘"}
              </span>
            </button>

            {/* Order ID (Click to copy) */}
            {orderId && (
              <>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={() => handleCopy(orderId, "order_id")}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  title="Click to copy order ID"
                >
                  <span>{orderId}</span>
                  <span className="text-slate-400 text-[10px]">
                    {copiedId === "order_id" ? "✓" : "⎘"}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Primary Headline Title & Actions Row */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="space-y-2.5 max-w-3xl">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
              {getIncidentTitle()}
            </h1>

            {/* Secondary Operational Triage Strip (Status, Urgency, Severity, Detected) */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Operational Status */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 dark:text-slate-500 font-medium">Status:</span>
                {renderStatusIndicator()}
              </div>

              <span className="text-slate-200 dark:text-slate-800">|</span>

              {/* Priority / Urgency */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 dark:text-slate-500 font-medium">Urgency:</span>
                {renderPriorityIndicator()}
              </div>

              <span className="text-slate-200 dark:text-slate-800">|</span>

              {/* Technical Severity */}
              <div className="flex items-center gap-1 text-[11px] font-mono">
                <span className="text-slate-400 dark:text-slate-500">System Impact:</span>
                <span
                  className={`font-semibold ${
                    primaryIncident.severity === "HIGH"
                      ? "text-rose-600 dark:text-rose-400"
                      : primaryIncident.severity === "MEDIUM"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {primaryIncident.severity}
                </span>
              </div>

              {incidentMeta?.created_at && (
                <>
                  <span className="text-slate-200 dark:text-slate-800">|</span>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    <span>
                      Detected:{" "}
                      {new Date(incidentMeta.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Action & Status Group */}
          <div className="flex flex-wrap items-center gap-2 self-start">
            {isResolved ? (
              <button
                type="button"
                disabled={isResolving}
                onClick={() => handleTransitionStatus("OPEN")}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Reopen Incident</span>
              </button>
            ) : (
              <>
                {operationalStatus !== "INVESTIGATING" && (
                  <button
                    type="button"
                    disabled={isResolving}
                    onClick={() => handleTransitionStatus("INVESTIGATING")}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Investigation</span>
                  </button>
                )}

                {operationalStatus !== "ACTION_REQUIRED" && (
                  <button
                    type="button"
                    disabled={isResolving}
                    onClick={() => handleTransitionStatus("ACTION_REQUIRED")}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Mark Action Required</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isResolving}
                  onClick={() => setIsResolutionModalOpen(true)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50 ${
                    operationalStatus === "INVESTIGATING"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark Resolved</span>
                </button>
              </>
            )}

            {/* Export Report Button */}
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-300 dark:border-slate-700 transition shadow-xs cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>Export Report</span>
            </button>
          </div>
        </div>

        {/* ── Operational Metadata Bar (Priority Selector, Assignee, Tags) ── */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          {/* Left: Priority Selector & Assignee */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Priority Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Set Priority:</span>
              <select
                value={priority}
                onChange={(e) => handleChangePriority(e.target.value as OperationalPriority)}
                className="bg-transparent border-none text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            {/* Assignee Pill / Editor */}
            {isEditingAssignee ? (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-indigo-500">
                <User className="w-3 h-3 text-slate-400" />
                <input
                  type="text"
                  value={assigneeDraft}
                  onChange={(e) => setAssigneeDraft(e.target.value)}
                  placeholder="Assignee name"
                  className="bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none w-28"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveAssignee(assigneeDraft.trim() || null)}
                  className="text-emerald-500 font-bold px-1 hover:text-emerald-400 cursor-pointer"
                  title="Save"
                >
                  ✓
                </button>
                <button
                  onClick={() => setIsEditingAssignee(false)}
                  className="text-slate-400 px-1 hover:text-slate-200 cursor-pointer"
                  title="Cancel"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                onClick={() => {
                  setAssigneeDraft(assignee || "");
                  setIsEditingAssignee(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400 transition cursor-pointer"
                title="Click to edit operational assignee (display metadata)"
              >
                <User className="w-3 h-3 text-slate-400" />
                <span className={assignee ? "font-medium" : "text-slate-400 italic"}>
                  {assignee ? `Assigned: ${assignee}` : "Unassigned"}
                </span>
                <span className="text-[10px] text-indigo-500 ml-1">✎</span>
              </div>
            )}
          </div>

          {/* Right: Tags Chips & Add Tag */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Tag className="w-3 h-3" />
              <span>Tags:</span>
            </span>

            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono"
              >
                <span>#{t}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  className="hover:text-rose-500 cursor-pointer"
                  title={`Remove tag #${t}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}

            {isAddingTag ? (
              <form onSubmit={handleAddTagSubmit} className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="tag-name"
                  className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-50 dark:bg-slate-950 border border-indigo-500 text-slate-800 dark:text-slate-200 focus:outline-none w-20"
                  autoFocus
                />
                <button
                  type="submit"
                  className="text-emerald-500 font-bold text-xs px-1 cursor-pointer"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingTag(false);
                    setNewTagInput("");
                  }}
                  className="text-slate-400 text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingTag(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer transition"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Add Tag</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Deterministic Missing Evidence Engine ── */}
      {investigationResult.missing_evidence_report && (
        <MissingEvidenceCard report={investigationResult.missing_evidence_report} />
      )}

      {/* ── View Tab Switcher (Overview / Workflow History / Traceability Graph / Event Timeline) ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveViewTab("overview")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeViewTab === "overview"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Investigation Overview</span>
        </button>

        <button
          onClick={() => setActiveViewTab("advanced")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeViewTab === "advanced"
              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <BrainCircuit className="w-4 h-4 text-purple-400" />
          <span>Advanced AI</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold">
            Phase 8
          </span>
        </button>

        <button
          onClick={() => setActiveViewTab("webhooks")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeViewTab === "webhooks"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Webhook Diagnostics</span>
        </button>

        <button
          onClick={() => setActiveViewTab("history")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeViewTab === "history"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Workflow History</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-500/20 text-slate-300 font-mono">
            {workflowHistory.length}
          </span>
        </button>

        <button
          onClick={() => setActiveViewTab("graph")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
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
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
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

      {/* ── View: Workflow History Tab ─────────────────────────────────────── */}
      {activeViewTab === "history" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Auditable Operational History
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cryptographically tracked lifecycle and status changes performed by human operators.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {workflowHistory.length} audit entries
            </span>
          </div>

          {loadingHistory ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              Loading workflow history...
            </div>
          ) : workflowHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              No workflow changes recorded yet. Changes to status, priority, tags, or assignment will appear here.
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 space-y-4 pl-4 pt-2">
              {workflowHistory.map((item) => (
                <div key={item.id} className="relative space-y-1">
                  <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                      {item.action.replace("_", " ")}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : "Just now"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                    {item.field ? `${item.field}: ` : ""}
                    {item.old_value !== undefined && item.old_value !== null ? (
                      <span className="line-through text-slate-400 mr-1.5">{String(item.old_value)}</span>
                    ) : null}
                    {item.new_value !== undefined && item.new_value !== null ? (
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{String(item.new_value)}</span>
                    ) : null}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>By: <strong className="text-slate-600 dark:text-slate-300 font-medium">{item.actor}</strong></span>
                    {item.notes && <span className="italic">— "{item.notes}"</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* ── View: Advanced AI Investigation Tab ──────────────────────────────── */}
      {activeViewTab === "advanced" && (
        <AdvancedInvestigationWorkspace
          incidentId={String(incidentMeta?.id || paymentId)}
          paymentId={paymentId}
          onSelectEvidence={onSelectEvidence}
        />
      )}

      {/* ── View: Webhook Diagnostics Tab ──────────────────────────────────── */}
      {activeViewTab === "webhooks" && (
        <WebhookDiagnosticsCard paymentId={paymentId} onSelectEvent={onSelectEvidence} />
      )}

      {/* ── View: Main Overview Dual-Column Layout ───────────────────────────── */}
      {activeViewTab === "overview" && (
        <div className="space-y-6">
          {/* Phase 8: Advanced AI Investigation Entrypoint Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Advanced AI Investigation Available
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 font-mono">
                    Phase 8
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Synthesize competing hypotheses, evaluate causal event traces, verify claims with 5-verdict precision, and explore counterfactuals.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveViewTab("advanced")}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Open Advanced Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Phase 7: Razorpay Webhook Diagnostics Card */}
          <WebhookDiagnosticsCard paymentId={paymentId} onSelectEvent={onSelectEvidence} />

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
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
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
                  maxLength={2048}
                  className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    {newNoteText.length}/2048 characters
                  </span>
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
                {incidents.length} anomalies. Operational status is{" "}
                <strong className="font-semibold text-slate-900 dark:text-white uppercase">
                  {operationalStatus}
                </strong>
                . Investigation concluded with{" "}
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
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer"
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

            {/* Section 4: Historical Intelligence & Similar Incidents (Phase 5) */}
            <SimilarIncidentsCard
              paymentId={paymentId}
              onSelectPayment={onSelectPayment}
            />
          </div>
        </div>
        </div>
      )}

      {/* ── Operational Resolution Modal ────────────────────────────────────── */}
      {isResolutionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Mark Incident Resolved
                </h3>
              </div>
              <button
                onClick={() => setIsResolutionModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              <strong>Important Truth Separation:</strong> Marking this incident operationally resolved records that investigation and triage are complete. It <em>does not</em> alter the underlying Razorpay payment state or execute financial actions.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                Resolution Notes:
              </label>
              <textarea
                value={resolutionNotesInput}
                onChange={(e) => setResolutionNotesInput(e.target.value)}
                placeholder="Describe resolution steps taken (e.g. merchant notified, webhook resent, log verified)..."
                rows={3}
                className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsResolutionModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResolving}
                onClick={() => handleTransitionStatus("RESOLVED", resolutionNotesInput)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isResolving ? "Resolving..." : "Confirm Resolution"}</span>
              </button>
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
