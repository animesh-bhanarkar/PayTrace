import React, { useState } from "react";
import type { NormalizedEventItem, VerifiedClaim } from "../types";
import { CheckCircle2, XCircle, HelpCircle, Link2, Filter, Layers } from "lucide-react";

interface EvidenceClaimGraphProps {
  events: NormalizedEventItem[];
  verifiedClaims: VerifiedClaim[];
  rejectedClaims: VerifiedClaim[];
  hypothesis?: string;
}

export const EvidenceClaimGraph: React.FC<EvidenceClaimGraphProps> = ({
  events,
  verifiedClaims,
  rejectedClaims,
  hypothesis,
}) => {
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<"ALL" | "SUPPORTED" | "REJECTED" | "UNVERIFIABLE">("ALL");

  const allClaims = [...verifiedClaims, ...rejectedClaims];

  // Helper mappings
  const claimByEvt: Record<string, string[]> = {};
  const evtByClaim: Record<string, string[]> = {};

  allClaims.forEach((c) => {
    evtByClaim[c.claim_id] = c.evidence_ids || [];
    c.evidence_ids.forEach((eId) => {
      if (!claimByEvt[eId]) claimByEvt[eId] = [];
      claimByEvt[eId].push(c.claim_id);
    });
  });

  const filteredClaims = allClaims.filter((c) => {
    if (verdictFilter === "ALL") return true;
    return c.verdict === verdictFilter;
  });

  const handleEvidenceClick = (evidenceId: string) => {
    if (selectedEvidenceId === evidenceId) {
      setSelectedEvidenceId(null);
    } else {
      setSelectedEvidenceId(evidenceId);
      setSelectedClaimId(null);
    }
  };

  const handleClaimClick = (claimId: string) => {
    if (selectedClaimId === claimId) {
      setSelectedClaimId(null);
    } else {
      setSelectedClaimId(claimId);
      setSelectedEvidenceId(null);
    }
  };

  const clearSelection = () => {
    setSelectedEvidenceId(null);
    setSelectedClaimId(null);
  };

  const isClaimHighlighted = (claimId: string, claimEvts: string[]) => {
    if (selectedClaimId === claimId) return true;
    if (selectedEvidenceId && claimEvts.includes(selectedEvidenceId)) return true;
    return false;
  };

  const isEvidenceHighlighted = (evidenceId: string) => {
    if (selectedEvidenceId === evidenceId) return true;
    if (selectedClaimId) {
      const citedEvts = evtByClaim[selectedClaimId] || [];
      return citedEvts.includes(evidenceId);
    }
    return false;
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-slate-100">
              Evidence ↔ Claim Traceability Graph
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive deterministic citation verification between ingestion events and AI claims
          </p>
        </div>

        {/* Filter controls & reset */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-800 rounded-lg p-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500 ml-1" />
            {(["ALL", "SUPPORTED", "REJECTED", "UNVERIFIABLE"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setVerdictFilter(filter)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  verdictFilter === filter
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {(selectedEvidenceId || selectedClaimId) && (
            <button
              onClick={clearSelection}
              className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            >
              Reset Focus
            </button>
          )}
        </div>
      </div>

      {hypothesis && (
        <div className="mt-3 p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-lg text-xs text-indigo-200/90 leading-relaxed">
          <span className="font-semibold text-indigo-300 mr-1.5">Root Hypothesis:</span>
          {hypothesis}
        </div>
      )}

      {/* 2-Column Graph Representation */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
        {/* Left Column: Normalized Evidence Events */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            <span>Deterministic Evidence Events ({events.length})</span>
            <span className="text-[11px] text-slate-500 font-normal">Click to trace cited claims</span>
          </div>

          <div className="space-y-2.5">
            {events.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs text-slate-500 text-center">
                No evidence events in package
              </div>
            ) : (
              events.map((evt, idx) => {
                const eId = evt.evidence_id || `evt_${idx + 1}`;
                const isSelected = selectedEvidenceId === eId;
                const isHighlighted = isEvidenceHighlighted(eId);
                const citedCount = (claimByEvt[eId] || []).length;

                return (
                  <div
                    key={eId}
                    onClick={() => handleEvidenceClick(eId)}
                    className={`p-3.5 rounded-lg border text-xs cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "bg-indigo-950/70 border-indigo-500 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-400"
                        : isHighlighted
                        ? "bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/40"
                        : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                          {eId}
                        </span>
                        <span className="font-semibold text-slate-100">{evt.event_type}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            evt.signature_valid === false
                              ? "bg-rose-950/60 text-rose-300 border border-rose-800/50"
                              : "bg-emerald-950/60 text-emerald-300 border border-emerald-800/50"
                          }`}
                        >
                          {evt.signature_valid === false ? "Invalid Sig" : "HMAC Valid"}
                        </span>
                        <span className="text-slate-500">{evt.source || "webhook"}</span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-mono text-slate-500">
                        {evt.event_timestamp ? new Date(evt.event_timestamp).toISOString() : "N/A"}
                      </span>
                      <span
                        className={`flex items-center gap-1 font-mono ${
                          citedCount > 0 ? "text-indigo-300" : "text-slate-600"
                        }`}
                      >
                        <Link2 className="w-3 h-3" />
                        {citedCount} {citedCount === 1 ? "claim citation" : "claim citations"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: AI Claims & Deterministic Verdicts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            <span>Extracted Claims & Verdicts ({filteredClaims.length})</span>
            <span className="text-[11px] text-slate-500 font-normal">Click to trace evidence</span>
          </div>

          <div className="space-y-2.5">
            {filteredClaims.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs text-slate-500 text-center">
                No claims match the selected filter
              </div>
            ) : (
              filteredClaims.map((claim) => {
                const isSelected = selectedClaimId === claim.claim_id;
                const isHighlighted = isClaimHighlighted(claim.claim_id, claim.evidence_ids || []);

                const verdictBadge =
                  claim.verdict === "SUPPORTED" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                      <CheckCircle2 className="w-3 h-3" /> SUPPORTED
                    </span>
                  ) : claim.verdict === "REJECTED" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-500/40">
                      <XCircle className="w-3 h-3" /> REJECTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                      <HelpCircle className="w-3 h-3" /> UNVERIFIABLE
                    </span>
                  );

                return (
                  <div
                    key={claim.claim_id}
                    onClick={() => handleClaimClick(claim.claim_id)}
                    className={`p-3.5 rounded-lg border text-xs cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "bg-indigo-950/70 border-indigo-500 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-400"
                        : isHighlighted
                        ? "bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/40"
                        : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                          {claim.claim_id}
                        </span>
                        {verdictBadge}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">
                        Conf: {claim.confidence || "MEDIUM"}
                      </span>
                    </div>

                    <p className="mt-2 text-slate-200 leading-relaxed font-medium">
                      "{claim.statement}"
                    </p>

                    {/* Cited Evidence IDs */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-medium">Cites:</span>
                      {claim.evidence_ids && claim.evidence_ids.length > 0 ? (
                        claim.evidence_ids.map((eId) => {
                          const isEvtMatched = selectedEvidenceId === eId;
                          return (
                            <span
                              key={eId}
                              className={`px-1.5 py-0.5 rounded font-mono text-[10px] border transition ${
                                isEvtMatched
                                  ? "bg-indigo-500 text-white border-indigo-400 font-bold"
                                  : "bg-slate-900 text-slate-300 border-slate-700"
                              }`}
                            >
                              {eId}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[10px] text-rose-400 font-mono italic">
                          [No evidence cited — Hallucination / Unsupported]
                        </span>
                      )}
                    </div>

                    {/* Rejection Reason if present */}
                    {claim.rejection_reason && (
                      <div className="mt-2.5 p-2 rounded bg-rose-950/40 border border-rose-800/40 text-[11px] text-rose-300">
                        <span className="font-semibold text-rose-200">Rejection Cause:</span>{" "}
                        {claim.rejection_reason}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
