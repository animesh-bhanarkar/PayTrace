import React, { useState, useEffect, useMemo } from "react";
import type { EvidenceItem } from "../types";
import { fetchEvidenceList } from "../api/client";
import {
  ShieldCheck,
  ShieldAlert,
  Layers,
  RefreshCw,
  Search,
  X,
  Clock,
  ArrowUpRight,
  Database,
  Hash,
  Filter,
  FileCheck,
} from "lucide-react";

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
      limit: 150,
    })
      .then((data) => {
        setItems(data || []);
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
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) => {
      return (
        item.evidence_id.toLowerCase().includes(q) ||
        (item.payment_id && item.payment_id.toLowerCase().includes(q)) ||
        (item.order_id && item.order_id.toLowerCase().includes(q)) ||
        (item.event_type && item.event_type.toLowerCase().includes(q)) ||
        (item.source && item.source.toLowerCase().includes(q))
      );
    });
  }, [items, searchQuery]);

  // Distinct event types in loaded items for filter dropdown
  const availableEventTypes = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.event_type) set.add(i.event_type);
    });
    return Array.from(set).sort();
  }, [items]);

  const trustedCount = items.filter((i) => i.trust_status === "TRUSTED").length;
  const untrustedCount = items.filter((i) => i.trust_status === "UNTRUSTED").length;
  const derivedCount = items.filter((i) => i.trust_status === "DERIVED").length;

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Evidence Explorer
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              Forensic Audit Trail
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Immutable payment telemetry, cryptographic signature verifications, and state transition evidence.
          </p>
        </div>

        <button
          onClick={loadEvidence}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-800 shadow-2xs transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? "animate-spin text-indigo-500" : ""}`} />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* ── Compact Status Summary Treatment (Matching Explorer Style) ───── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs transition-colors">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* Total Evidence */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Total Records</div>
              <div className="text-base font-bold text-slate-900 dark:text-white font-mono leading-tight">
                {items.length}
              </div>
            </div>
          </div>

          {/* Trusted Records */}
          <div className="flex items-center gap-2.5 px-2 border-l border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Trusted (HMAC Valid)</div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono leading-tight">
                {trustedCount}
              </div>
            </div>
          </div>

          {/* Untrusted Records */}
          <div className="flex items-center gap-2.5 px-2 border-l border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Untrusted / Mismatch</div>
              <div className="text-base font-bold text-rose-600 dark:text-rose-400 font-mono leading-tight">
                {untrustedCount}
              </div>
            </div>
          </div>

          {/* Derived Records */}
          <div className="flex items-center gap-2.5 px-2 border-l border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Derived State</div>
              <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 font-mono leading-tight">
                {derivedCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls (Supporting Controls Bar) ──────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Trust Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg overflow-x-auto">
          {[
            { id: "ALL", label: "All Evidence", count: items.length },
            { id: "TRUSTED", label: "Trusted", count: trustedCount },
            { id: "UNTRUSTED", label: "Untrusted", count: untrustedCount },
            { id: "DERIVED", label: "Derived", count: derivedCount },
          ].map((tab) => {
            const active = trustFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTrustFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  active
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs border border-slate-200/80 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Supporting Filter Controls: Event Type & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Event Type Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Event Types</option>
              {availableEventTypes.length > 0
                ? availableEventTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))
                : (
                  <>
                    <option value="payment.created">payment.created</option>
                    <option value="payment.authorized">payment.authorized</option>
                    <option value="payment.captured">payment.captured</option>
                    <option value="payment.failed">payment.failed</option>
                    <option value="refund.processed">refund.processed</option>
                  </>
                )}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by ID, payment, type..."
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded-lg pl-8 pr-7 py-1.5 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── PRIMARY WORKSPACE: Forensic Evidence List / Table ─────────────── */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-2xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2.5" />
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Querying cryptographic evidence audit records...
          </p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={loadEvidence}
            className="px-2.5 py-1 bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 rounded text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-400 shadow-2xs">
          <Filter className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
          <div className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">No Matching Evidence Found</div>
          <div className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `No records match search "${searchQuery}". Clear your search query or change filter criteria.`
              : "No evidence records exist for the selected trust or event type filters."}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Trust Status</th>
                  <th className="py-3 px-4">Evidence ID</th>
                  <th className="py-3 px-4">Payment Association</th>
                  <th className="py-3 px-4">Event Time</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Payload Digest</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-slate-700 dark:text-slate-300">
                {filtered.map((item) => {
                  const isTrusted = item.trust_status === "TRUSTED";
                  const isUntrusted = item.trust_status === "UNTRUSTED";
                  const isDerived = item.trust_status === "DERIVED";

                  return (
                    <tr
                      key={item.id || item.evidence_id}
                      onClick={() => onSelectEvidence(item.evidence_id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      {/* PRIMARY: Event Type */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FileCheck className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0" />
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                            {item.event_type}
                          </span>
                          {item.source && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({item.source})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* PRIMARY: Trust Status */}
                      <td className="py-3 px-4">
                        {isTrusted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>TRUSTED</span>
                          </span>
                        ) : isUntrusted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            <span>UNTRUSTED</span>
                          </span>
                        ) : isDerived ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            <span>DERIVED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {item.trust_status}
                          </span>
                        )}
                      </td>

                      {/* SECONDARY: Evidence ID */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {item.evidence_id}
                        </span>
                      </td>

                      {/* SECONDARY: Payment ID / Order ID */}
                      <td className="py-3 px-4 font-mono text-xs">
                        {item.payment_id ? (
                          <div className="flex flex-col">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.payment_id) onSelectPayment?.(item.payment_id);
                              }}
                              className="text-left font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 group/btn"
                            >
                              <span>{item.payment_id}</span>
                              <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                            </button>
                            {item.order_id && (
                              <span className="text-[10px] text-slate-400">
                                {item.order_id}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* SECONDARY: Event Timestamp */}
                      <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{formatTimestamp(item.event_timestamp)}</span>
                        </div>
                      </td>

                      {/* TERTIARY: Latency */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {item.delay_seconds !== null && item.delay_seconds !== undefined
                          ? `+${item.delay_seconds.toFixed(2)}s`
                          : "0.0s"}
                      </td>

                      {/* TERTIARY: Payload Digest / Hash */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {item.payload_hash ? (
                          <div className="flex items-center gap-1" title={item.payload_hash}>
                            <Hash className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-slate-600 dark:text-slate-400">
                              {item.payload_hash.substring(0, 10)}...
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvidence(item.evidence_id);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-300 text-[11px] font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                        >
                          Inspect Detail →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Summary Counter */}
          <div className="px-4 py-2.5 bg-slate-50/60 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div>
              Showing <strong className="text-slate-700 dark:text-slate-300 font-semibold">{filtered.length}</strong> of{" "}
              <strong className="text-slate-700 dark:text-slate-300 font-semibold">{items.length}</strong> evidence records
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>HMAC Verified: {trustedCount}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Untrusted: {untrustedCount}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
