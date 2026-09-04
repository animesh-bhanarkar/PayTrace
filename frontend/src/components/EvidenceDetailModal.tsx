import React, { useState, useEffect } from "react";
import type { EvidenceDetailResponse } from "../types";
import { fetchEvidenceDetail } from "../api/client";

interface EvidenceDetailModalProps {
  evidenceId: string | null;
  onClose: () => void;
  onSelectPayment?: (paymentId: string) => void;
}

export const EvidenceDetailModal: React.FC<EvidenceDetailModalProps> = ({
  evidenceId,
  onClose,
  onSelectPayment,
}) => {
  const [data, setData] = useState<EvidenceDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!evidenceId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchEvidenceDetail(evidenceId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load evidence detail");
        setLoading(false);
      });
  }, [evidenceId]);

  if (!evidenceId) return null;

  const handleCopyJson = () => {
    if (!data?.raw_payload_sanitized) return;
    navigator.clipboard.writeText(JSON.stringify(data.raw_payload_sanitized, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div
              className={`px-2.5 py-1 text-xs font-mono font-bold rounded-full border ${
                data?.trust_status === "TRUSTED"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : data?.trust_status === "UNTRUSTED"
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/30"
              }`}
            >
              {data?.trust_status === "TRUSTED"
                ? "✓ TRUSTED EVIDENCE"
                : data?.trust_status === "UNTRUSTED"
                ? "⚠ UNTRUSTED EVIDENCE"
                : "◇ DERIVED FACT"}
            </div>
            <span className="font-mono text-sm text-slate-300 font-semibold">
              {evidenceId}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-12 text-center text-slate-400 animate-pulse">
              Retrieving cryptographic provenance & payload...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm rounded-lg">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* Trust Rationale Banner */}
              <div
                className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                  data.trust_status === "TRUSTED"
                    ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-300"
                    : data.trust_status === "UNTRUSTED"
                    ? "bg-rose-950/20 border-rose-500/20 text-rose-300"
                    : "bg-blue-950/20 border-blue-500/20 text-blue-300"
                }`}
              >
                <span className="font-bold">Cryptographic Assurance: </span>
                {data.trust_rationale}
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    Event Type
                  </div>
                  <div className="font-mono text-xs font-semibold text-slate-200">
                    {data.event_type}
                  </div>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    Payment ID
                  </div>
                  <div className="font-mono text-xs font-semibold text-slate-200 truncate">
                    {data.payment_id ? (
                      <button
                        onClick={() => data.payment_id && onSelectPayment?.(data.payment_id)}
                        className="text-blue-400 hover:underline"
                      >
                        {data.payment_id}
                      </button>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    Order ID
                  </div>
                  <div className="font-mono text-xs text-slate-300 truncate">
                    {data.order_id || <span className="text-slate-500">None</span>}
                  </div>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    Event Timestamp
                  </div>
                  <div className="font-mono text-xs text-slate-300">
                    {data.event_timestamp ? new Date(data.event_timestamp).toLocaleString() : "Unknown"}
                  </div>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    Ingestion Timestamp
                  </div>
                  <div className="font-mono text-xs text-slate-300">
                    {data.ingestion_timestamp ? new Date(data.ingestion_timestamp).toLocaleString() : "None"}
                  </div>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    Delivery Latency
                  </div>
                  <div className="font-mono text-xs text-slate-300">
                    {data.delay_seconds !== null && data.delay_seconds !== undefined
                      ? `+${data.delay_seconds.toFixed(2)}s`
                      : "0.00s"}
                  </div>
                </div>
              </div>

              {/* Payload Hash */}
              {data.payload_hash && (
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">SHA-256 Digest:</span>
                  <span className="font-mono text-slate-300 select-all">{data.payload_hash}</span>
                </div>
              )}

              {/* Related Claims */}
              {data.related_claims && data.related_claims.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                    Cited In AI Claims ({data.related_claims.length})
                  </h4>
                  <div className="space-y-2">
                    {data.related_claims.map((claim, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <span className="font-mono text-slate-400 font-semibold">{claim.claim_id}:</span>{" "}
                          <span className="text-slate-200">{claim.statement}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            claim.verdict === "SUPPORTED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {claim.verdict || "VERIFIED"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Incidents */}
              {data.related_incidents && data.related_incidents.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                    Related Incidents ({data.related_incidents.length})
                  </h4>
                  <div className="space-y-2">
                    {data.related_incidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{inc.incident_type}</div>
                          <div className="text-slate-400 text-[11px]">{inc.description}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            inc.severity === "HIGH"
                              ? "bg-rose-500/10 text-rose-400"
                              : inc.severity === "MEDIUM"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-slate-700/30 text-slate-400"
                          }`}
                        >
                          {inc.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Payload Sanitized */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Raw Payload
                    </h4>
                    <span className="text-[10px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                      Tokens & Secrets Masked
                    </span>
                  </div>
                  <button
                    onClick={handleCopyJson}
                    className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    {copied ? "✓ Copied" : "Copy JSON"}
                  </button>
                </div>

                <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-60 leading-relaxed">
                  {data.raw_payload_sanitized
                    ? JSON.stringify(data.raw_payload_sanitized, null, 2)
                    : "No payload payload content stored"}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
