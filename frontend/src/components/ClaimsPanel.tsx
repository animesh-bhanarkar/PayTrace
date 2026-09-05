import React from "react";
import type { NormalizedEventItem, VerifiedClaim } from "../types";
import { Sparkles, ExternalLink } from "lucide-react";
import { getVerdictConfig, getEvidenceTrustConfig } from "./EvidenceClaimGraph";

interface ClaimsPanelProps {
  aiActivated?: boolean;
  activationReason?: string;
  hypothesis?: string | null;
  verifiedClaims?: VerifiedClaim[];
  rejectedClaims?: VerifiedClaim[];
  events?: NormalizedEventItem[];
  onSelectEvidence?: (evidenceId: string) => void;
}

export const ClaimsPanel: React.FC<ClaimsPanelProps> = ({
  aiActivated = false,
  activationReason = "Deterministic evidence was sufficient to identify the issue.",
  hypothesis = null,
  verifiedClaims = [],
  rejectedClaims = [],
  events = [],
  onSelectEvidence,
}) => {
  // Build fast event lookup map
  const eventsMap = new Map<string, NormalizedEventItem>();
  events.forEach((evt, idx) => {
    const id = evt.evidence_id || evt.id || evt.event_id || `evt_${idx + 1}`;
    eventsMap.set(id, evt);
    if (evt.evidence_id) eventsMap.set(evt.evidence_id, evt);
    if (evt.id) eventsMap.set(evt.id, evt);
    if (evt.event_id) eventsMap.set(evt.event_id, evt);
  });

  // Filter out any empty claims
  const cleanVerified = verifiedClaims.filter(
    (c) => c && c.claim_id && typeof c.statement === "string" && c.statement.trim().length > 0
  );
  const cleanRejected = rejectedClaims.filter(
    (c) => c && c.claim_id && typeof c.statement === "string" && c.statement.trim().length > 0
  );

  const renderClaimCard = (claim: VerifiedClaim, isSupported: boolean) => {
    const verdictConfig = getVerdictConfig(claim.verdict || (isSupported ? "SUPPORTED" : "REJECTED"));
    const citedIds = claim.evidence_ids || [];

    return (
      <div
        key={claim.claim_id}
        className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3 transition"
      >
        {/* Header: ID, confidence, verdict pill */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Claim {claim.claim_id}
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Conf: <strong className="text-slate-700 dark:text-slate-300 uppercase">{claim.confidence || "HIGH"}</strong>
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold border tracking-wide font-mono ${verdictConfig.badgeClasses}`}
          >
            {verdictConfig.icon}
            <span>{verdictConfig.label}</span>
          </span>
        </div>

        {/* PRIMARY: Claim Statement */}
        <p className="text-xs md:text-sm text-slate-900 dark:text-slate-100 font-semibold leading-relaxed">
          "{claim.statement}"
        </p>

        {/* SECONDARY: Supporting Evidence */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Cited Evidence ({citedIds.length}):
          </span>

          {citedIds.length === 0 ? (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">
              No evidence records cited — unbacked assertion.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {citedIds.map((eId) => {
                const evt = eventsMap.get(eId);
                if (!evt) {
                  return (
                    <span
                      key={eId}
                      className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    >
                      {eId}
                    </span>
                  );
                }

                const trust = getEvidenceTrustConfig(evt);
                return (
                  <button
                    key={eId}
                    type="button"
                    onClick={() => onSelectEvidence?.(eId)}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-[11px] text-slate-800 dark:text-slate-200 transition cursor-pointer shadow-2xs group"
                    title="Inspect cryptographic evidence record"
                  >
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${trust.badgeClasses.split(" ")[1]}`}>
                      {trust.icon}
                    </span>
                    <span className="font-mono font-bold">{eId}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate max-w-[130px]">
                      {evt.event_type}
                    </span>
                    <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover:text-indigo-500" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Rejection / Refutation cause if present */}
        {claim.rejection_reason && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300 space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
              Verifier Refutation Rationale
            </span>
            <p className="leading-relaxed">{claim.rejection_reason}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            AI Investigation & Claims Gate
          </h4>
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
          <span className="text-[11px] text-slate-400">Activation Gate:</span>
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
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {aiActivated ? "Investigator Hypothesis" : "AI Routing Status"}
            </span>
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {hypothesis ||
                (aiActivated
                  ? "Hypothesis generated and grounded in evidence."
                  : "AI was not activated for this incident. Deterministic evidence was sufficient to identify the issue.")}
            </p>
          </div>
        </div>

        {/* Right Side: Gate Reason */}
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Gate Activation Rationale
          </span>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono">
            {activationReason || "Deterministic path produced clear findings"}
          </p>
        </div>
      </div>

      {/* Verified Claims (if AI was activated) */}
      {aiActivated && (cleanVerified.length > 0 || cleanRejected.length > 0) && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Deterministic Claim Verification ({cleanVerified.length} Supported, {cleanRejected.length} Rejected)
            </h5>
            <span className="text-[10px] text-slate-400 font-mono">
              Evaluated against authoritative event log
            </span>
          </div>

          <div className="space-y-3">
            {cleanVerified.map((c) => renderClaimCard(c, true))}
            {cleanRejected.map((c) => renderClaimCard(c, false))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimsPanel;
