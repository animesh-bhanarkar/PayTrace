import React, { useState } from "react";
import type { NormalizedEventItem, VerifiedClaim } from "../types";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Link2,
  Filter,
  Layers,
  Sparkles,
  ArrowDown,
  Columns,
  ListTree,
  ExternalLink,
} from "lucide-react";

interface EvidenceClaimGraphProps {
  events: NormalizedEventItem[];
  verifiedClaims: VerifiedClaim[];
  rejectedClaims: VerifiedClaim[];
  hypothesis?: string;
  onSelectEvidence?: (evidenceId: string) => void;
}

export type NormalizedVerdict =
  | "VERIFIED"
  | "PARTIALLY_VERIFIED"
  | "UNSUPPORTED"
  | "CONTRADICTED"
  | "UNVERIFIABLE";

export function getVerdictConfig(verdictStr: string) {
  const v = (verdictStr || "").toUpperCase();
  if (v === "VERIFIED" || v === "SUPPORTED") {
    return {
      key: "VERIFIED" as NormalizedVerdict,
      label: v === "SUPPORTED" ? "SUPPORTED" : "VERIFIED",
      badgeClasses:
        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      containerClasses:
        "bg-emerald-500/5 border-emerald-500/20 text-emerald-950 dark:text-emerald-200",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
      defaultExplanation:
        "All cited cryptographic evidence exists in the package with verified invariants and no authoritative contradiction.",
    };
  }
  if (v === "PARTIALLY_VERIFIED") {
    return {
      key: "PARTIALLY_VERIFIED" as NormalizedVerdict,
      label: "PARTIALLY VERIFIED",
      badgeClasses:
        "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
      containerClasses:
        "bg-cyan-500/5 border-cyan-500/20 text-cyan-950 dark:text-cyan-200",
      icon: <AlertCircle className="w-3.5 h-3.5 text-cyan-500 shrink-0" />,
      defaultExplanation:
        "Evidence records are verified, but the claim assertion partially exceeds what the evidence strictly proves.",
    };
  }
  if (v === "UNSUPPORTED") {
    return {
      key: "UNSUPPORTED" as NormalizedVerdict,
      label: "UNSUPPORTED",
      badgeClasses:
        "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
      containerClasses:
        "bg-amber-500/5 border-amber-500/20 text-amber-950 dark:text-amber-200",
      icon: <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
      defaultExplanation:
        "Cited evidence records were located, but do not provide sufficient factual proof for this claim statement.",
    };
  }
  if (v === "CONTRADICTED" || v === "REJECTED" || v === "REFUTED") {
    return {
      key: "CONTRADICTED" as NormalizedVerdict,
      label: v === "REJECTED" ? "REJECTED" : "CONTRADICTED",
      badgeClasses:
        "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
      containerClasses:
        "bg-rose-500/5 border-rose-500/20 text-rose-950 dark:text-rose-200",
      icon: <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />,
      defaultExplanation:
        "Authoritative payment state or verified cryptographic event sequence directly refutes this assertion.",
    };
  }
  return {
    key: "UNVERIFIABLE" as NormalizedVerdict,
    label: "UNVERIFIABLE",
    badgeClasses:
      "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30",
    containerClasses:
      "bg-slate-500/5 border-slate-500/20 text-slate-800 dark:text-slate-300",
    icon: <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />,
    defaultExplanation:
      "Cited evidence identifier is missing from the ingestion event package; assertion cannot be checked.",
  };
}

export function getEvidenceTrustConfig(evt: NormalizedEventItem) {
  if (evt.signature_valid === false) {
    return {
      isTrusted: false,
      label: "Untrusted (Invalid Sig)",
      badgeClasses:
        "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
      icon: <ShieldAlert className="w-3 h-3 text-rose-500 shrink-0" />,
    };
  }
  if (evt.signature_valid === true) {
    return {
      isTrusted: true,
      label: "Trusted (HMAC Valid)",
      badgeClasses:
        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      icon: <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />,
    };
  }
  const isInternal = evt.source === "api" || evt.source === "internal" || evt.source === "direct";
  return {
    isTrusted: true,
    label: isInternal ? "Trusted (API Direct)" : "Recorded Event",
    badgeClasses:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    icon: <ShieldCheck className="w-3 h-3 text-blue-500 shrink-0" />,
  };
}

export const EvidenceClaimGraph: React.FC<EvidenceClaimGraphProps> = ({
  events,
  verifiedClaims,
  rejectedClaims,
  hypothesis,
  onSelectEvidence,
}) => {
  const [viewMode, setViewMode] = useState<"audit" | "matrix">("audit");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<string>("ALL");

  // Filter out empty or meaningless claims
  const allClaims = [...verifiedClaims, ...rejectedClaims].filter(
    (c) => c && c.claim_id && typeof c.statement === "string" && c.statement.trim().length > 0
  );

  // Build events lookup map
  const eventsMap = new Map<string, NormalizedEventItem>();
  events.forEach((evt, idx) => {
    const id = evt.evidence_id || evt.id || evt.event_id || `evt_${idx + 1}`;
    eventsMap.set(id, evt);
    if (evt.evidence_id) eventsMap.set(evt.evidence_id, evt);
    if (evt.id) eventsMap.set(evt.id, evt);
    if (evt.event_id) eventsMap.set(evt.event_id, evt);
  });

  // Cross-reference mappings for split-matrix view
  const claimByEvt: Record<string, string[]> = {};
  const evtByClaim: Record<string, string[]> = {};

  allClaims.forEach((c) => {
    evtByClaim[c.claim_id] = c.evidence_ids || [];
    c.evidence_ids.forEach((eId) => {
      if (!claimByEvt[eId]) claimByEvt[eId] = [];
      claimByEvt[eId].push(c.claim_id);
    });
  });

  // Verdict filtering
  const filteredClaims = allClaims.filter((c) => {
    if (verdictFilter === "ALL") return true;
    const norm = getVerdictConfig(c.verdict).key;
    if (verdictFilter === "VERIFIED") return norm === "VERIFIED";
    if (verdictFilter === "PARTIALLY_VERIFIED") return norm === "PARTIALLY_VERIFIED";
    if (verdictFilter === "UNSUPPORTED") return norm === "UNSUPPORTED";
    if (verdictFilter === "CONTRADICTED") return norm === "CONTRADICTED";
    if (verdictFilter === "UNVERIFIABLE") return norm === "UNVERIFIABLE";
    return true;
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden transition-colors">
      {/* ── Header: Title, View Switcher & Filters ───────────────────────── */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Evidence ↔ Claim Verification Audit
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Deterministic verification audit linking extracted claims directly to cryptographic evidence records
          </p>
        </div>

        {/* View mode toggle & filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setViewMode("audit")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                viewMode === "audit"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
              title="Audit Chain: Claim → Supporting Evidence → Verdict"
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>Audit Chain</span>
            </button>
            <button
              onClick={() => setViewMode("matrix")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                viewMode === "matrix"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
              title="Split Matrix: Cross-reference between Evidence and Claims"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split Matrix</span>
            </button>
          </div>

          {/* Verdict Filter */}
          {allClaims.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg p-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
              {(["ALL", "VERIFIED", "PARTIALLY_VERIFIED", "UNSUPPORTED", "CONTRADICTED"] as const).map(
                (filter) => {
                  const isSelected = verdictFilter === filter;
                  return (
                    <button
                      key={filter}
                      onClick={() => setVerdictFilter(filter)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-xs font-semibold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      {filter.replace("_", " ")}
                    </button>
                  );
                }
              )}
            </div>
          )}

          {viewMode === "matrix" && (selectedEvidenceId || selectedClaimId) && (
            <button
              onClick={clearSelection}
              className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              Reset Focus
            </button>
          )}
        </div>
      </div>

      {/* ── Context Bar: AI Hypothesis vs. Deterministic Grounding ───────── */}
      {hypothesis ? (
        <div className="px-5 py-3 bg-purple-500/5 dark:bg-purple-950/20 border-b border-purple-500/20 flex items-start gap-3 text-xs">
          <div className="p-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="space-y-0.5 leading-relaxed">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 text-[10px]">
                AI Working Hypothesis (Inferred — Subject to Verification)
              </span>
            </div>
            <p className="text-slate-800 dark:text-slate-200 font-medium">
              "{hypothesis}"
            </p>
          </div>
        </div>
      ) : null}

      <div className="p-5">
        {/* ── ZERO-CLAIMS STATE: Deterministic Incident ─────────────────────── */}
        {allClaims.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Deterministic Audit Trail — No AI Claims Incurred
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                PayTrace resolved this incident using authoritative state transition invariants and cryptographic event signatures. Deterministic evidence was sufficient; no speculative AI assertions were introduced.
              </p>
            </div>

            {/* List of deterministic evidence events */}
            <div className="pt-2 max-w-xl mx-auto text-left space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block text-center">
                Validated Deterministic Events ({events.length})
              </span>
              {events.map((evt, idx) => {
                const eId = evt.evidence_id || evt.id || `evt_${idx + 1}`;
                const trust = getEvidenceTrustConfig(evt);
                return (
                  <div
                    key={eId}
                    onClick={() => onSelectEvidence?.(eId)}
                    className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs hover:border-indigo-500/40 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${trust.badgeClasses}`}>
                        {trust.icon}
                        {trust.label}
                      </span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{eId}</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{evt.event_type}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 shrink-0">
                      {evt.event_timestamp ? new Date(evt.event_timestamp).toLocaleTimeString() : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : viewMode === "audit" ? (
          /* ── VIEW MODE 1: AUDIT CHAIN (CLAIM ↓ EVIDENCE ↓ VERDICT) ─────── */
          <div className="space-y-6">
            {filteredClaims.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No claims match the selected verdict filter.
              </div>
            ) : (
              filteredClaims.map((claim, cIdx) => {
                const verdictConfig = getVerdictConfig(claim.verdict);
                const citedIds = claim.evidence_ids || [];

                // Resolve cited events
                const citedEvents = citedIds.map((id) => {
                  return {
                    id,
                    event: eventsMap.get(id),
                  };
                });

                return (
                  <div
                    key={claim.claim_id || cIdx}
                    className="p-5 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4 transition"
                  >
                    {/* 1. PRIMARY: The Claim Statement */}
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            AI Claim {claim.claim_id}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Confidence:{" "}
                            <strong className="text-slate-700 dark:text-slate-300 uppercase font-mono">
                              {claim.confidence || "MEDIUM"}
                            </strong>
                          </span>
                        </div>

                        {/* Scannable Verdict Badge */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border tracking-wide font-mono ${verdictConfig.badgeClasses}`}
                        >
                          {verdictConfig.icon}
                          <span>{verdictConfig.label}</span>
                        </span>
                      </div>

                      <h4 className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100 leading-relaxed pt-0.5">
                        "{claim.statement}"
                      </h4>
                    </div>

                    {/* Flow connector: CLAIM ↓ EVIDENCE */}
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 pl-1">
                      <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Cited Supporting Evidence ({citedEvents.length})</span>
                    </div>

                    {/* 2. SECONDARY: Supporting Evidence Records */}
                    <div className="space-y-2 pl-3 border-l-2 border-indigo-200 dark:border-indigo-900/60 ml-2">
                      {citedEvents.length === 0 ? (
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>No evidence records cited in claim statement — Unsubstantiated AI assertion.</span>
                        </div>
                      ) : (
                        citedEvents.map(({ id, event: evt }) => {
                          if (!evt) {
                            return (
                              <div
                                key={id}
                                className="p-3 rounded-lg bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 text-xs flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    UNRESOLVED CITATION
                                  </span>
                                  <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{id}</span>
                                </div>
                                <span className="text-[11px] text-slate-400 italic">
                                  Evidence ID not found in event package
                                </span>
                              </div>
                            );
                          }

                          const trust = getEvidenceTrustConfig(evt);
                          return (
                            <div
                              key={id}
                              onClick={() => onSelectEvidence?.(id)}
                              className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 cursor-pointer transition flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs group"
                              title="Click to inspect cryptographic event details"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Trust Status Badge */}
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${trust.badgeClasses}`}
                                >
                                  {trust.icon}
                                  <span>{trust.label}</span>
                                </span>

                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {id}
                                </span>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  {evt.event_type}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono shrink-0">
                                <span>via {evt.source || "webhook"}</span>
                                {evt.delay_seconds !== null && evt.delay_seconds !== undefined && (
                                  <span className="text-amber-600 dark:text-amber-400">
                                    +{evt.delay_seconds}s delay
                                  </span>
                                )}
                                {evt.event_timestamp && (
                                  <span>{new Date(evt.event_timestamp).toLocaleTimeString()}</span>
                                )}
                                <span className="text-indigo-600 dark:text-indigo-400 font-medium group-hover:underline flex items-center gap-0.5">
                                  Inspect <ExternalLink className="w-3 h-3 ml-0.5" />
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Flow connector: EVIDENCE ↓ VERDICT */}
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 pl-1">
                      <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
                      <span>Deterministic Verification Result</span>
                    </div>

                    {/* 3. SECONDARY: Verification Result & Explanation */}
                    <div className={`p-4 rounded-lg border text-xs space-y-1.5 ${verdictConfig.containerClasses}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold border ${verdictConfig.badgeClasses}`}
                          >
                            {verdictConfig.icon}
                            <span>{verdictConfig.label}</span>
                          </span>
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            Authoritative Verifier Determination
                          </span>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                        {claim.rejection_reason ||
                          (claim as any).explanation ||
                          (claim as any).verdict_reason ||
                          verdictConfig.defaultExplanation}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* ── VIEW MODE 2: SPLIT MATRIX (Interactive Cross-Reference) ────── */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
            {/* Left Column: Deterministic Evidence Events */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                <span>Deterministic Evidence ({events.length})</span>
                <span className="text-[11px] text-slate-400 font-normal">Click to isolate cited claims</span>
              </div>

              <div className="space-y-2.5">
                {events.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 text-center">
                    No evidence events in package
                  </div>
                ) : (
                  events.map((evt, idx) => {
                    const eId = evt.evidence_id || evt.id || `evt_${idx + 1}`;
                    const isSelected = selectedEvidenceId === eId;
                    const isHighlighted = isEvidenceHighlighted(eId);
                    const citedCount = (claimByEvt[eId] || []).length;
                    const trust = getEvidenceTrustConfig(evt);

                    return (
                      <div
                        key={eId}
                        onClick={() => handleEvidenceClick(eId)}
                        className={`p-3.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? "bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-400"
                            : isHighlighted
                            ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-400 ring-1 ring-indigo-500/40"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                              {eId}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {evt.event_type}
                            </span>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${trust.badgeClasses}`}>
                            {trust.icon}
                            {trust.label}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          <span>
                            {evt.event_timestamp ? new Date(evt.event_timestamp).toLocaleTimeString() : "N/A"} • via {evt.source || "webhook"}
                          </span>
                          <span
                            className={`flex items-center gap-1 ${
                              citedCount > 0 ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400"
                            }`}
                          >
                            <Link2 className="w-3 h-3" />
                            {citedCount} {citedCount === 1 ? "claim" : "claims"}
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
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                <span>Extracted Claims ({filteredClaims.length})</span>
                <span className="text-[11px] text-slate-400 font-normal">Click to highlight cited evidence</span>
              </div>

              <div className="space-y-2.5">
                {filteredClaims.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 text-center">
                    No claims match the selected filter
                  </div>
                ) : (
                  filteredClaims.map((claim) => {
                    const isSelected = selectedClaimId === claim.claim_id;
                    const isHighlighted = isClaimHighlighted(claim.claim_id, claim.evidence_ids || []);
                    const verdictConfig = getVerdictConfig(claim.verdict);

                    return (
                      <div
                        key={claim.claim_id}
                        onClick={() => handleClaimClick(claim.claim_id)}
                        className={`p-3.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? "bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-400"
                            : isHighlighted
                            ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-400 ring-1 ring-indigo-500/40"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                              {claim.claim_id}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${verdictConfig.badgeClasses}`}
                            >
                              {verdictConfig.icon}
                              <span>{verdictConfig.label}</span>
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            Conf: {claim.confidence || "MEDIUM"}
                          </span>
                        </div>

                        <p className="mt-2 text-slate-900 dark:text-slate-100 leading-relaxed font-medium">
                          "{claim.statement}"
                        </p>

                        {/* Cited evidence badges */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-medium">Cites:</span>
                          {claim.evidence_ids && claim.evidence_ids.length > 0 ? (
                            claim.evidence_ids.map((eId) => {
                              const isEvtMatched = selectedEvidenceId === eId;
                              return (
                                <span
                                  key={eId}
                                  className={`px-1.5 py-0.5 rounded font-mono text-[10px] border transition ${
                                    isEvtMatched
                                      ? "bg-indigo-600 text-white border-indigo-500 font-bold"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                  }`}
                                >
                                  {eId}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-rose-500 font-mono italic">
                              [No evidence cited — Hallucination / Unsupported]
                            </span>
                          )}
                        </div>

                        {claim.rejection_reason && (
                          <div className="mt-2.5 p-2 rounded bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-700 dark:text-rose-300">
                            <span className="font-semibold">Rejection Cause:</span> {claim.rejection_reason}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvidenceClaimGraph;
