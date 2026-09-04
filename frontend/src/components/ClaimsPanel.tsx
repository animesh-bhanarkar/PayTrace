import React from "react";
import type { VerifiedClaim } from "../types";

interface ClaimsPanelProps {
  aiActivated?: boolean;
  activationReason?: string;
  hypothesis?: string | null;
  verifiedClaims?: VerifiedClaim[];
  rejectedClaims?: VerifiedClaim[];
}

export const ClaimsPanel: React.FC<ClaimsPanelProps> = ({
  aiActivated = false,
  activationReason = "Deterministic evidence was sufficient to identify the issue.",
  hypothesis = null,
  verifiedClaims = [],
  rejectedClaims = [],
}) => {
  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            AI Investigation
          </h4>
          <span className="text-xs font-mono text-slate-400 cursor-pointer" title="AI gate transparency and verified findings">
            ⓘ
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              aiActivated
                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
            }`}
          >
            {aiActivated ? "Activated" : "Not Activated"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Activation Gate Result:</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
            {aiActivated ? "Triggered" : "Skipped"}
          </span>
        </div>
      </div>

      {/* Rationale Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Side: Statement / Hypothesis */}
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-3">
          <div className="w-6 h-6 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
            ✦
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {aiActivated ? "Investigator Hypothesis" : "AI Routing Status"}
            </span>
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {hypothesis || (aiActivated ? "Hypothesis generated and grounded in evidence." : "AI was not activated for this incident. Deterministic evidence was sufficient to identify the issue.")}
            </p>
          </div>
        </div>

        {/* Right Side: Gate Reason */}
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Gate Reason
          </span>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono">
            {activationReason || "Deterministic path produced clear findings"}
          </p>
        </div>
      </div>

      {/* Verified Claims (if AI was activated) */}
      {aiActivated && (verifiedClaims.length > 0 || rejectedClaims.length > 0) && (
        <div className="space-y-3 pt-2">
          <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            Verified Claims ({verifiedClaims.length} Supported, {rejectedClaims.length} Rejected)
          </h5>

          <div className="space-y-2.5">
            {verifiedClaims.map((claim) => (
              <div
                key={claim.claim_id}
                className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-emerald-500/30 dark:border-emerald-500/20 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span>✓</span>
                    <span>SUPPORTED</span>
                  </span>
                  <span className="text-xs font-mono text-slate-400 font-semibold">
                    {claim.claim_id}
                  </span>
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                  {claim.statement}
                </p>
                {claim.evidence_ids && claim.evidence_ids.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400">Cited Evidence:</span>
                    {claim.evidence_ids.map((id) => (
                      <span
                        key={id}
                        className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {rejectedClaims.map((claim) => (
              <div
                key={claim.claim_id}
                className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-red-500/30 dark:border-red-500/20 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                    <span>✕</span>
                    <span>REJECTED</span>
                  </span>
                  <span className="text-xs font-mono text-slate-400 font-semibold">
                    {claim.claim_id}
                  </span>
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                  {claim.statement}
                </p>
                {claim.rejection_reason && (
                  <p className="text-[11px] text-red-500 dark:text-red-400">
                    <span className="font-semibold">Rejection reason:</span> {claim.rejection_reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export default ClaimsPanel;
