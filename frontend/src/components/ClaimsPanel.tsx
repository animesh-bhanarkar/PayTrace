import type { VerifiedClaim } from "../types";

interface ClaimsPanelProps {
  verifiedClaims: VerifiedClaim[];
  rejectedClaims: VerifiedClaim[];
}

export default function ClaimsPanel({
  verifiedClaims,
  rejectedClaims,
}: ClaimsPanelProps) {
  const hasClaims =
    (verifiedClaims && verifiedClaims.length > 0) ||
    (rejectedClaims && rejectedClaims.length > 0);

  if (!hasClaims) {
    return (
      <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 text-sm text-slate-400 italic">
        AI was not activated
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Supported Claims */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Supported Claims ({verifiedClaims.length})
        </h4>
        {verifiedClaims.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No supported claims</p>
        ) : (
          <div className="space-y-3">
            {verifiedClaims.map((claim) => (
              <div
                key={claim.claim_id}
                className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    SUPPORTED
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {claim.claim_id}
                  </span>
                </div>
                <p className="text-sm text-slate-200">{claim.statement}</p>
                {claim.evidence_ids && claim.evidence_ids.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs text-slate-400">Evidence:</span>
                    {claim.evidence_ids.map((id) => (
                      <span
                        key={id}
                        className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Rejected Claims */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Rejected Claims ({rejectedClaims.length})
        </h4>
        {rejectedClaims.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No rejected claims</p>
        ) : (
          <div className="space-y-3">
            {rejectedClaims.map((claim) => (
              <div
                key={claim.claim_id}
                className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                    REJECTED
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {claim.claim_id}
                  </span>
                </div>
                <p className="text-sm text-slate-200">{claim.statement}</p>
                {claim.rejection_reason && (
                  <p className="text-xs text-red-400">
                    <span className="font-semibold">Reason:</span>{" "}
                    {claim.rejection_reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
