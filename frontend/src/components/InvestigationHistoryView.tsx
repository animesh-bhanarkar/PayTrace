import React, { useState, useEffect } from "react";
import type {
  InvestigationHistoryItem,
  InvestigationVersionItem,
  InvestigationComparisonResult,
} from "../types";
import {
  fetchInvestigationHistory,
  fetchInvestigationVersions,
  compareInvestigationVersions,
} from "../api/client";

interface InvestigationHistoryViewProps {
  onSelectPayment: (paymentId: string) => void;
  onSelectEvidence?: (evidenceId: string) => void;
}

export const InvestigationHistoryView: React.FC<InvestigationHistoryViewProps> = ({
  onSelectPayment,
}) => {
  const [history, setHistory] = useState<InvestigationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [paymentFilter, setPaymentFilter] = useState<string>("");
  const [aiFilter, setAiFilter] = useState<string>("ALL");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("ALL");

  // Version Comparison State
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [selectedPaymentForCompare, setSelectedPaymentForCompare] = useState<string | null>(null);
  const [versions, setVersions] = useState<InvestigationVersionItem[]>([]);
  const [v1Id, setV1Id] = useState<string>("");
  const [v2Id, setV2Id] = useState<string>("");
  const [comparisonResult, setComparisonResult] = useState<InvestigationComparisonResult | null>(
    null
  );
  const [comparing, setComparing] = useState(false);

  const loadHistory = () => {
    setLoading(true);
    setError(null);
    fetchInvestigationHistory({
      payment_id: paymentFilter.trim() || undefined,
      ai_activated: aiFilter === "YES" ? true : aiFilter === "NO" ? false : undefined,
      confidence_level: confidenceFilter !== "ALL" ? confidenceFilter : undefined,
      limit: 50,
    })
      .then((data) => {
        setHistory(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load investigation history");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadHistory();
  }, [aiFilter, confidenceFilter]);

  const handleOpenCompare = async (paymentId: string) => {
    setSelectedPaymentForCompare(paymentId);
    setCompareModalOpen(true);
    setComparisonResult(null);
    try {
      const vers = await fetchInvestigationVersions(paymentId);
      setVersions(vers);
      if (vers.length >= 2) {
        setV1Id(vers[0].id);
        setV2Id(vers[vers.length - 1].id);
        runComparison(vers[0].id, vers[vers.length - 1].id);
      } else if (vers.length === 1) {
        setV1Id(vers[0].id);
        setV2Id(vers[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch versions for comparison");
    }
  };

  const runComparison = async (id1: string, id2: string) => {
    if (!id1 || !id2) return;
    setComparing(true);
    try {
      const res = await compareInvestigationVersions(id1, id2);
      setComparisonResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to compute investigation diff");
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>Investigation History & Versioning</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              Audit Trails
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic record of every investigation execution, confidence grounding, and hypothesis diff
          </p>
        </div>

        <button
          onClick={loadHistory}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors self-start sm:self-auto"
        >
          ↻ Refresh History
        </button>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search by payment */}
        <div className="flex items-center gap-2 w-full md:w-80">
          <input
            type="text"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadHistory()}
            placeholder="Filter by payment_id..."
            className="w-full bg-slate-950/80 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            onClick={loadHistory}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg whitespace-nowrap"
          >
            Apply
          </button>
        </div>

        {/* AI Activation Filter */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs">
          <span className="text-slate-500 px-2">AI:</span>
          {[
            { label: "All", val: "ALL" },
            { label: "Activated", val: "YES" },
            { label: "Gated", val: "NO" },
          ].map((item) => (
            <button
              key={item.val}
              onClick={() => setAiFilter(item.val)}
              className={`px-2.5 py-1 rounded text-xs transition-all ${
                aiFilter === item.val
                  ? "bg-slate-700 text-slate-100 font-medium"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Confidence Filter */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs">
          <span className="text-slate-500 px-2">Conf:</span>
          {["ALL", "HIGH", "MEDIUM", "LOW"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setConfidenceFilter(lvl)}
              className={`px-2 py-1 rounded text-xs transition-all ${
                confidenceFilter === lvl
                  ? "bg-slate-700 text-slate-100 font-medium"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* History Table */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 animate-pulse text-sm">
          Loading investigation audit history...
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm rounded-xl">
          {error}
        </div>
      ) : history.length === 0 ? (
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-12 text-center text-slate-400">
          <div className="text-2xl mb-2">📜</div>
          <div className="font-semibold text-slate-300 mb-1">No Investigation Records Found</div>
          <div className="text-xs text-slate-500 max-w-sm mx-auto">
            Execute an investigation from the Incidents console to generate audit trail history.
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Payment ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">AI State</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Claims (Supp/Rej)</th>
                  <th className="py-3 px-4">Hypothesis Preview</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {history.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectPayment(row.payment_id)}
                  >
                    {/* Payment ID */}
                    <td className="py-3 px-4 font-mono font-medium text-blue-400 group-hover:underline">
                      {row.payment_id}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {row.timestamp ? new Date(row.timestamp).toLocaleString() : "—"}
                    </td>

                    {/* AI Activation */}
                    <td className="py-3 px-4">
                      {row.ai_activated ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                          ✓ Activated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                          Gated
                        </span>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="py-3 px-4 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          row.confidence_level === "HIGH"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : row.confidence_level === "MEDIUM"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        {row.confidence_level} ({Math.round((row.confidence_score || 0) * 100)}%)
                      </span>
                    </td>

                    {/* Claims count */}
                    <td className="py-3 px-4 font-mono text-slate-300">
                      <span className="text-emerald-400 font-bold">{row.supported_claims_count}</span>
                      {" / "}
                      <span className="text-rose-400 font-bold">{row.rejected_claims_count}</span>
                      <span className="text-slate-500 text-[10px] ml-1">({row.claim_count} total)</span>
                    </td>

                    {/* Hypothesis Preview */}
                    <td className="py-3 px-4 max-w-xs truncate text-slate-300">
                      {row.hypothesis || <span className="text-slate-600 italic">None generated</span>}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCompare(row.payment_id);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/90 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-[11px] transition-colors"
                        title="Compare multiple runs for this payment"
                      >
                        Compare Diff ⇄
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Side-by-Side Version Comparison Modal */}
      {compareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                  Side-by-Side Version Diff
                </span>
                <span className="font-mono text-sm text-slate-200 font-semibold">
                  {selectedPaymentForCompare}
                </span>
              </div>
              <button
                onClick={() => setCompareModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Version Selectors Bar */}
            <div className="px-6 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-400 font-medium">Base (V1):</span>
                <select
                  value={v1Id}
                  onChange={(e) => {
                    setV1Id(e.target.value);
                    runComparison(e.target.value, v2Id);
                  }}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1 font-mono focus:outline-none"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      Version {v.version_number} — {new Date(v.timestamp).toLocaleTimeString()}
                    </option>
                  ))}
                </select>

                <span className="text-slate-400 font-medium ml-2">Compare (V2):</span>
                <select
                  value={v2Id}
                  onChange={(e) => {
                    setV2Id(e.target.value);
                    runComparison(v1Id, e.target.value);
                  }}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1 font-mono focus:outline-none"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      Version {v.version_number} — {new Date(v.timestamp).toLocaleTimeString()}
                    </option>
                  ))}
                </select>
              </div>

              {versions.length <= 1 && (
                <span className="text-amber-400 text-xs">
                  ℹ Run investigation again to produce a new version for comparison.
                </span>
              )}
            </div>

            {/* Comparison Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {comparing ? (
                <div className="py-16 text-center text-slate-500 animate-pulse text-sm">
                  Calculating deterministic delta across investigation versions...
                </div>
              ) : comparisonResult ? (
                <>
                  {/* Delta Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        Confidence Shift
                      </div>
                      <div className="font-mono text-sm font-bold text-slate-200 flex items-center gap-2">
                        <span>{comparisonResult.v1.confidence_level}</span>
                        <span>→</span>
                        <span
                          className={
                            comparisonResult.confidence_changed ? "text-amber-400" : "text-slate-200"
                          }
                        >
                          {comparisonResult.v2.confidence_level}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        AI Activation Delta
                      </div>
                      <div className="font-mono text-sm font-bold text-slate-200 flex items-center gap-2">
                        <span>{comparisonResult.v1.ai_activated ? "Active" : "Gated"}</span>
                        <span>→</span>
                        <span
                          className={
                            comparisonResult.ai_activated_changed ? "text-blue-400" : "text-slate-200"
                          }
                        >
                          {comparisonResult.v2.ai_activated ? "Active" : "Gated"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        Claims Generated
                      </div>
                      <div className="font-mono text-sm font-bold text-slate-200 flex items-center gap-2">
                        <span>{comparisonResult.v1.claims_count}</span>
                        <span>→</span>
                        <span>{comparisonResult.v2.claims_count}</span>
                        {comparisonResult.claims_count_diff !== 0 && (
                          <span
                            className={`text-xs ${
                              comparisonResult.claims_count_diff > 0
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                          >
                            ({comparisonResult.claims_count_diff > 0 ? "+" : ""}
                            {comparisonResult.claims_count_diff})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        Abstention Status
                      </div>
                      <div className="font-mono text-sm font-bold text-slate-200">
                        {comparisonResult.v2.abstained ? (
                          <span className="text-amber-400">Abstained</span>
                        ) : (
                          <span className="text-emerald-400">Unabstained</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Claim Diff Matrix */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                      Claim-Level Verdict Comparison ({comparisonResult.claim_diffs.length})
                    </h4>
                    <div className="space-y-2">
                      {comparisonResult.claim_diffs.map((diff) => (
                        <div
                          key={diff.claim_id}
                          className={`p-3.5 rounded-xl border text-xs transition-all ${
                            diff.changed
                              ? "bg-amber-500/5 border-amber-500/30"
                              : "bg-slate-950/40 border-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1.5">
                            <span className="font-mono font-bold text-slate-400">
                              {diff.claim_id}
                            </span>
                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              <span
                                className={`px-2 py-0.5 rounded font-semibold ${
                                  diff.v1_verdict === "SUPPORTED"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : diff.v1_verdict === "REJECTED"
                                    ? "bg-rose-500/10 text-rose-400"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                V1: {diff.v1_verdict || "ABSENT"}
                              </span>
                              <span>→</span>
                              <span
                                className={`px-2 py-0.5 rounded font-semibold ${
                                  diff.v2_verdict === "SUPPORTED"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : diff.v2_verdict === "REJECTED"
                                    ? "bg-rose-500/10 text-rose-400"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                V2: {diff.v2_verdict || "ABSENT"}
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-300 font-medium">"{diff.statement}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Select two different versions above to compare their deterministic delta.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
