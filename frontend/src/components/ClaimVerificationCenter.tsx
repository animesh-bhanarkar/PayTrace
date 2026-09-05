import React, { useState, useEffect } from "react";
import type { ClaimVerificationCenterData } from "../types";
import { fetchClaimsSummary } from "../api/client";

interface ClaimVerificationCenterProps {
  onSelectEvidence: (evidenceId: string) => void;
  onSelectPayment: (paymentId: string) => void;
}

export const ClaimVerificationCenter: React.FC<ClaimVerificationCenterProps> = ({
  onSelectEvidence,
  onSelectPayment,
}) => {
  const [data, setData] = useState<ClaimVerificationCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [verdictFilter, setVerdictFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetchClaimsSummary({ limit: 100 })
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load claims verification scorecard");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const claims = (data?.claims || []).filter((c) => c.statement.trim() !== "");

  const filteredClaims = claims.filter((c) => {
    if (verdictFilter !== "ALL" && c.verdict !== verdictFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.claim_id.toLowerCase().includes(q) ||
        c.statement.toLowerCase().includes(q) ||
        c.payment_id.toLowerCase().includes(q) ||
        c.evidence_ids.some((eid) => eid.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const ratePercent = data ? Math.round(data.verification_rate * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>Claim Verification Center</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Deterministic Verification Scorecard
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Zero-hallucination verification matrix: Every AI claim is verified against cryptographic webhook evidence
          </p>
        </div>

        <button
          onClick={loadData}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors self-start sm:self-auto"
        >
          ↻ Refresh Scorecard
        </button>
      </div>

      {/* Verification Scorecard KPIs */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Total AI Claims
            </div>
            <div className="text-2xl font-bold text-slate-100 font-mono">
              {data.total_claims}
            </div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold mb-1">
              Supported & Verified
            </div>
            <div className="text-2xl font-bold text-emerald-300 font-mono">
              {data.verified_claims}
            </div>
          </div>

          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-rose-400 font-semibold mb-1">
              Rejected (Unsubstantiated)
            </div>
            <div className="text-2xl font-bold text-rose-300 font-mono">
              {data.rejected_claims}
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold mb-1">
              Unverifiable
            </div>
            <div className="text-2xl font-bold text-amber-300 font-mono">
              {data.unverifiable_claims}
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl col-span-2 md:col-span-1">
            <div className="text-[11px] uppercase tracking-wider text-blue-400 font-semibold mb-1">
              Verification Rate
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-blue-300 font-mono">
                {ratePercent}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-blue-950 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${ratePercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Verdict Filter */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-lg border border-slate-800/80 w-full md:w-auto">
          {(["ALL", "SUPPORTED", "REJECTED", "UNVERIFIABLE"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVerdictFilter(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                verdictFilter === v
                  ? v === "SUPPORTED"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : v === "REJECTED"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : v === "UNVERIFIABLE"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-slate-700 text-slate-100 border border-slate-600"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {v === "ALL" && "All Claims"}
              {v === "SUPPORTED" && "✓ Supported"}
              {v === "REJECTED" && "✕ Rejected"}
              {v === "UNVERIFIABLE" && "⚠ Unverifiable"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search statement, payment, evidence ID..."
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

      {/* Claims List */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 animate-pulse text-sm">
          Loading claims verification scorecard...
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm rounded-xl">
          {error}
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-12 text-center text-slate-400">
          <div className="text-2xl mb-2">📋</div>
          <div className="font-semibold text-slate-300 mb-1">No Claims Match Filter</div>
          <div className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query or verdict category.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClaims.map((claim, idx) => (
            <div
              key={`${claim.payment_id}_${claim.claim_id}_${idx}`}
              className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-4 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                    {claim.claim_id}
                  </span>
                  <button
                    onClick={() => onSelectPayment(claim.payment_id)}
                    className="font-mono text-xs text-blue-400 hover:underline"
                  >
                    {claim.payment_id}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {claim.confidence && (
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      Conf: {claim.confidence}
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 text-xs font-bold font-mono rounded-full border ${
                      claim.verdict === "SUPPORTED"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : claim.verdict === "REJECTED"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {claim.verdict === "SUPPORTED" && "✓ SUPPORTED"}
                    {claim.verdict === "REJECTED" && "✕ REJECTED"}
                    {claim.verdict === "UNVERIFIABLE" && "⚠ UNVERIFIABLE"}
                  </span>
                </div>
              </div>

              {/* Statement */}
              <p className="text-sm text-slate-200 font-medium leading-relaxed mb-3">
                "{claim.statement}"
              </p>

              {/* Rejection reason alert */}
              {claim.rejection_reason && (
                <div className="text-xs bg-rose-950/30 border border-rose-500/20 text-rose-300 p-2.5 rounded-lg mb-3">
                  <span className="font-semibold">Rejection Proof: </span>
                  {claim.rejection_reason}
                </div>
              )}

              {/* Evidence Grounding */}
              <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-slate-800/60">
                <span className="text-slate-400">Cited Evidence:</span>
                {claim.evidence_ids && claim.evidence_ids.length > 0 ? (
                  claim.evidence_ids.map((eid) => (
                    <button
                      key={eid}
                      onClick={() => onSelectEvidence(eid)}
                      className="font-mono bg-slate-950 hover:bg-slate-800 text-blue-300 px-2 py-0.5 rounded border border-slate-800 hover:border-blue-500/50 transition-colors"
                      title="Inspect cryptographic evidence"
                    >
                      🔗 {eid}
                    </button>
                  ))
                ) : (
                  <span className="text-slate-500 italic">No citations attached</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
