import React, { useState, useEffect } from "react";
import type { IncidentWebhooksResponse, ReconciliationStatus } from "../types";
import { fetchIncidentWebhooks } from "../api/client";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info,
  CheckCircle2,
  XCircle,
  Radio,
  FileCode2,
} from "lucide-react";

interface WebhookDiagnosticsCardProps {
  paymentId: string;
  onSelectEvent?: (eventId: string) => void;
}

export const WebhookDiagnosticsCard: React.FC<WebhookDiagnosticsCardProps> = ({
  paymentId,
  onSelectEvent: _onSelectEvent,
}) => {
  const [data, setData] = useState<IncidentWebhooksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPayloadId, setExpandedPayloadId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchIncidentWebhooks(paymentId);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load webhook diagnostics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paymentId) {
      loadData();
    }
  }, [paymentId]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const getTrustBadge = (trustStatus: string, signatureValid: boolean) => {
    if (trustStatus === "TRUSTED" && signatureValid) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          TRUSTED
        </span>
      );
    }
    if (trustStatus === "INVALID") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <XCircle className="w-3.5 h-3.5" />
          INVALID REQUEST
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <ShieldAlert className="w-3.5 h-3.5" />
        UNTRUSTED (SIG MISMATCH)
      </span>
    );
  };

  const getReconciliationBadge = (status: ReconciliationStatus) => {
    switch (status) {
      case "CONSISTENT":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
          title: "States Consistent",
        };
      case "WEBHOOK_DELAYED":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
          icon: <Clock className="w-4 h-4 text-amber-500" />,
          title: "Webhook Delayed",
        };
      case "MERCHANT_NOT_UPDATED":
        return {
          bg: "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400",
          icon: <AlertTriangle className="w-4 h-4 text-purple-500" />,
          title: "Merchant State Stale",
        };
      case "CONFLICTING_OBSERVATIONS":
        return {
          bg: "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400",
          icon: <XCircle className="w-4 h-4 text-rose-500" />,
          title: "Conflicting State Beliefs",
        };
      default:
        return {
          bg: "bg-zinc-500/10 border-zinc-500/30 text-zinc-600 dark:text-zinc-400",
          icon: <Info className="w-4 h-4 text-zinc-400" />,
          title: "Insufficient Evidence",
        };
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading Razorpay webhook diagnostics...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-500 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {error || "Webhook diagnostics unavailable"}
          </div>
          <button
            onClick={loadData}
            className="text-xs px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const reconMeta = getReconciliationBadge(data.reconciliation.status);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Razorpay Webhook Diagnostics
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-normal">
                Test Mode
              </span>
            </h3>
            <p className="text-xs text-zinc-500">
              Deterministic verification of asynchronous delivery, idempotency, and state reconciliation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {data.correlated_webhooks_count} Delivery Observations
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {data.trusted_webhooks_count} Trusted Evidence
          </span>
        </div>
      </div>

      {/* Three-Way State Reconciliation Banner */}
      <div className={`mt-5 p-4 rounded-xl border ${reconMeta.bg} transition-all`}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            {reconMeta.icon}
            <span>Reconciliation: {reconMeta.title}</span>
          </div>
          <span className="text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-white/40 dark:bg-black/30 border border-current/20">
            {data.reconciliation.status}
          </span>
        </div>

        {/* 3 Columns: Authoritative vs Webhook vs Merchant */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-3">
          <div className="p-2.5 rounded-lg bg-white/60 dark:bg-zinc-900/60 border border-current/10">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-70 block">
              1. Authoritative State
            </span>
            <span className="text-sm font-mono font-bold capitalize mt-0.5 block">
              {data.reconciliation.razorpay_state || "Unknown"}
            </span>
            <span className="text-[10px] opacity-60">Source: Razorpay state reconstruction</span>
          </div>

          <div className="p-2.5 rounded-lg bg-white/60 dark:bg-zinc-900/60 border border-current/10">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-70 block">
              2. Webhook Observation
            </span>
            <span className="text-sm font-mono font-bold capitalize mt-0.5 block">
              {data.reconciliation.webhook_state || "Not received"}
            </span>
            <span className="text-[10px] opacity-60">Source: Trusted webhook event stream</span>
          </div>

          <div className="p-2.5 rounded-lg bg-white/60 dark:bg-zinc-900/60 border border-current/10">
            <span className="text-[11px] uppercase tracking-wider font-semibold opacity-70 block">
              3. Merchant-Side Belief
            </span>
            <span className="text-sm font-mono font-bold capitalize mt-0.5 block">
              {data.reconciliation.merchant_state || "Not provided"}
            </span>
            <span className="text-[10px] opacity-60">Source: Merchant backend processing record</span>
          </div>
        </div>

        <p className="text-xs opacity-90 mt-2 leading-relaxed">
          <strong>Deterministic Assessment:</strong> {data.reconciliation.explanation}
        </p>
      </div>

      {/* Pattern & Order Anomaly Alerts */}
      {data.late_authorization_diagnostics?.detected && (
        <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Late Authorization Pattern Detected</span>
          </div>
          <p className="text-xs mt-1 leading-relaxed opacity-90">
            {data.late_authorization_diagnostics.description}
          </p>
        </div>
      )}

      {data.out_of_order_diagnostics?.detected && (
        <div className="mt-4 p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-800 dark:text-indigo-200">
          <div className="flex items-center gap-2 font-semibold text-xs">
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Webhook Delivery / Order Anomaly Detected</span>
          </div>
          <p className="text-xs mt-1 leading-relaxed opacity-90">
            {data.out_of_order_diagnostics.description}
          </p>
        </div>
      )}

      {/* Webhook Delivery Observations Timeline */}
      <div className="mt-6">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" />
          Inbound Webhook Delivery Records ({data.webhooks.length})
        </h4>

        {data.webhooks.length === 0 ? (
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 text-center text-xs text-zinc-500">
            No webhook observations recorded for this payment identifier.
          </div>
        ) : (
          <div className="space-y-3">
            {data.webhooks.map((wh) => {
              const isExpanded = expandedPayloadId === wh.id;
              const hasError = wh.has_error || Boolean(wh.error_details?.has_error);

              return (
                <div
                  key={wh.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 overflow-hidden text-xs"
                >
                  {/* Webhook Header Bar */}
                  <div className="p-3.5 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {getTrustBadge(wh.trust_status, wh.signature_valid)}

                      {wh.duplicate_status === "DUPLICATE" ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          DUPLICATE DELIVERY
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300">
                          ORIGINAL
                        </span>
                      )}

                      <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-sm">
                        {wh.event_type || "unknown"}
                      </span>

                      {wh.razorpay_event_id && (
                        <span className="text-zinc-500 font-mono text-[11px]">
                          x-razorpay-event-id: {wh.razorpay_event_id}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedPayloadId(isExpanded ? null : wh.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 font-medium"
                      >
                        <FileCode2 className="w-3.5 h-3.5" />
                        {isExpanded ? "Hide Payload" : "Inspect Payload"}
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Metadata Bar */}
                  <div className="px-3.5 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-zinc-100 dark:border-zinc-800/80 pt-2.5 text-zinc-600 dark:text-zinc-400">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-zinc-400 block">
                        Event Time (Razorpay)
                      </span>
                      <span className="font-mono text-zinc-800 dark:text-zinc-200">
                        {wh.event_timestamp ? new Date(wh.event_timestamp).toLocaleTimeString() : "Unavailable"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-semibold text-zinc-400 block">
                        Ingestion Time (PayTrace)
                      </span>
                      <span className="font-mono text-zinc-800 dark:text-zinc-200">
                        {wh.ingestion_timestamp ? new Date(wh.ingestion_timestamp).toLocaleTimeString() : "Unavailable"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-semibold text-zinc-400 block">
                        Delivery Delay
                      </span>
                      <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        {wh.delivery_delay_seconds !== null && wh.delivery_delay_seconds !== undefined
                          ? `${wh.delivery_delay_seconds.toFixed(1)}s`
                          : "Unavailable"}
                      </span>
                    </div>
                  </div>

                  {/* Error details if present */}
                  {hasError && wh.error_details && (
                    <div className="mx-3.5 mb-3 p-2.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
                      <div className="font-semibold text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Razorpay Error Diagnostics
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                        <div>
                          <strong>Code:</strong> {wh.error_details.code}
                        </div>
                        <div>
                          <strong>Reason:</strong> {wh.error_details.reason}
                        </div>
                        <div className="col-span-2">
                          <strong>Description:</strong> {wh.error_details.description}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Processing Notes */}
                  {wh.processing_notes && (
                    <div className="px-3.5 pb-2.5 text-[11px] text-zinc-500 italic">
                      {wh.processing_notes}
                    </div>
                  )}

                  {/* Expanded Payload Viewer */}
                  {isExpanded && (
                    <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-900 text-zinc-100 font-mono text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-zinc-400 font-sans font-medium">
                          Safe Payload Inspection (Secrets Redacted)
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              JSON.stringify(wh.raw_payload || {}, null, 2),
                              String(wh.id)
                            )
                          }
                          className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-100"
                        >
                          {copiedId === String(wh.id) ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy JSON</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="max-h-64 overflow-auto p-2.5 rounded bg-black/50 text-[11px] leading-relaxed">
                        {JSON.stringify(wh.raw_payload || { detail: "No payload persisted" }, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
