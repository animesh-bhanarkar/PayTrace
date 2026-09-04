import React, { useState, useEffect } from "react";
import type { EvidenceItem } from "../types";
import { fetchEvidenceList } from "../api/client";

interface EvidenceExplorerProps {
  onSelectEvidence: (evidenceId: string) => void;
  onSelectPayment?: (paymentId: string) => void;
}

export const EvidenceExplorer: React.FC<EvidenceExplorerProps> = ({
  onSelectEvidence,
  onSelectPayment,
}) => {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [trustFilter, setTrustFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadEvidence = () => {
    setLoading(true);
    setError(null);
    fetchEvidenceList({
      trust_status: trustFilter !== "ALL" ? trustFilter : undefined,
      event_type: typeFilter !== "ALL" ? typeFilter : undefined,
      limit: 100,
    })
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load evidence records");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadEvidence();
  }, [trustFilter, typeFilter]);

  // Derived filtered items based on client-side search query
  const filtered = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.evidence_id.toLowerCase().includes(q) ||
      (item.payment_id && item.payment_id.toLowerCase().includes(q)) ||
      (item.order_id && item.order_id.toLowerCase().includes(q)) ||
      item.event_type.toLowerCase().includes(q)
    );
  });

  const trustedCount = items.filter((i) => i.trust_status === "TRUSTED").length;
  const untrustedCount = items.filter((i) => i.trust_status === "UNTRUSTED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>Evidence Explorer</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              Phase 4 Intelligence
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic cryptographic audit trail — HMAC verified webhook signatures and payload digests
          </p>
        </div>

        {/* Aggregate Stats */}
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-400">Trusted: </span>
            <span className="font-mono font-bold text-emerald-400">{trustedCount}</span>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-400">Untrusted: </span>
            <span className="font-mono font-bold text-rose-400">{untrustedCount}</span>
          </div>
          <button
            onClick={loadEvidence}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Control Bar: Trust Badges Filter & Search */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Trust Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-lg border border-slate-800/80 w-full md:w-auto">
          {(["ALL", "TRUSTED", "UNTRUSTED", "DERIVED"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setTrustFilter(status)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                trustFilter === status
                  ? status === "TRUSTED"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : status === "UNTRUSTED"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "bg-slate-700 text-slate-100 border border-slate-600"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {status === "ALL" && "All Evidence"}
              {status === "TRUSTED" && "✓ Trusted"}
              {status === "UNTRUSTED" && "⚠ Untrusted"}
              {status === "DERIVED" && "◇ Derived"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Event Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-2 font-mono focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Event Types</option>
            <option value="payment.created">payment.created</option>
            <option value="payment.authorized">payment.authorized</option>
            <option value="payment.captured">payment.captured</option>
            <option value="payment.failed">payment.failed</option>
            <option value="refund.processed">refund.processed</option>
          </select>

          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evidence, payment ID..."
              className="w-full bg-slate-950/80 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content Table */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 animate-pulse text-sm">
          Loading cryptographically verified evidence packages...
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm rounded-xl">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-12 text-center text-slate-400">
          <div className="text-2xl mb-2">🔍</div>
          <div className="font-semibold text-slate-300 mb-1">No Evidence Records Found</div>
          <div className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query or trust status filter.
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Cryptographic Trust</th>
                  <th className="py-3 px-4">Evidence ID</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Payment ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filtered.map((item) => (
                  <tr
                    key={item.id || item.evidence_id}
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectEvidence(item.evidence_id)}
                  >
                    {/* Cryptographic Trust Badge */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${
                          item.trust_status === "TRUSTED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : item.trust_status === "UNTRUSTED"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}
                      >
                        {item.trust_status === "TRUSTED" && "✓ TRUSTED"}
                        {item.trust_status === "UNTRUSTED" && "⚠ UNTRUSTED"}
                        {item.trust_status === "DERIVED" && "◇ DERIVED"}
                      </span>
                    </td>

                    {/* Evidence ID */}
                    <td className="py-3 px-4 font-mono text-slate-200 font-medium">
                      {item.evidence_id}
                    </td>

                    {/* Event Type */}
                    <td className="py-3 px-4">
                      <span className="font-mono bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700/60 text-[11px]">
                        {item.event_type}
                      </span>
                    </td>

                    {/* Payment ID */}
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {item.payment_id ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.payment_id) onSelectPayment?.(item.payment_id);
                          }}
                          className="hover:text-blue-400 hover:underline"
                        >
                          {item.payment_id}
                        </button>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Event Timestamp */}
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {item.event_timestamp
                        ? new Date(item.event_timestamp).toLocaleTimeString()
                        : "—"}
                    </td>

                    {/* Delay */}
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {item.delay_seconds !== null && item.delay_seconds !== undefined
                        ? `+${item.delay_seconds.toFixed(1)}s`
                        : "0.0s"}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvidence(item.evidence_id);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px]"
                      >
                        View Detail →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
