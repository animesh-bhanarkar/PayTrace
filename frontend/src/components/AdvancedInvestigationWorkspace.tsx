import React, { useState, useEffect } from "react";
import type {
  AdvancedInvestigationResult,
  AdvancedInvestigationVersion,
  ClaimVerdict,
  HypothesisStatus,
  CausalStepStatus,
  InvestigationOutcome,
} from "../types";
import {
  runAdvancedInvestigation,
  fetchLatestAdvancedInvestigation,
  fetchAdvancedInvestigationHistory,
} from "../api/client";
import {
  BrainCircuit,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Split,
  FileCheck2,
  Lock,
  Filter,
  History,
  Terminal,
} from "lucide-react";

interface AdvancedInvestigationWorkspaceProps {
  incidentId: string | number;
  paymentId: string;
  onSelectEvidence?: (evidenceId: string) => void;
}

export const AdvancedInvestigationWorkspace: React.FC<AdvancedInvestigationWorkspaceProps> = ({
  incidentId,
  paymentId: _paymentId,
  onSelectEvidence,
}) => {
  const [data, setData] = useState<AdvancedInvestigationResult | null>(null);
  const [historyVersions, setHistoryVersions] = useState<AdvancedInvestigationVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVerdictFilter, setSelectedVerdictFilter] = useState<string>("ALL");
  const [expandedHypothesis, setExpandedHypothesis] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"hypotheses" | "causal" | "claims" | "counterfactuals">("hypotheses");

  // Load latest investigation and version history on mount
  useEffect(() => {
    let isMounted = true;
    const loadInitial = async () => {
      setInitialLoading(true);
      setError(null);
      try {
        const histRes = await fetchAdvancedInvestigationHistory(incidentId).catch(() => null);
        if (isMounted && histRes?.versions) {
          setHistoryVersions(histRes.versions);
        }
        // Try to fetch latest run
        const latest = await fetchLatestAdvancedInvestigation(incidentId).catch(() => null);
        if (isMounted && latest) {
          setData(latest);
        }
      } catch (err: any) {
        if (isMounted) setError(err?.message || "Failed to load advanced investigation");
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    };

    loadInitial();
    return () => {
      isMounted = false;
    };
  }, [incidentId]);

  const handleRunInvestigation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runAdvancedInvestigation(incidentId);
      setData(res);
      // Refresh history versions
      const histRes = await fetchAdvancedInvestigationHistory(incidentId).catch(() => null);
      if (histRes?.versions) {
        setHistoryVersions(histRes.versions);
      }
    } catch (err: any) {
      setError(err?.message || "Investigation run failed");
    } finally {
      setLoading(false);
    }
  };

  const outcomeColors: Record<InvestigationOutcome, { bg: string; text: string; border: string; icon: any }> = {
    AUTHORITATIVE_CONFIRMED: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-200 dark:border-emerald-800",
      icon: CheckCircle2,
    },
    HIGH_CONFIDENCE_RECONSTRUCTED: {
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      text: "text-indigo-700 dark:text-indigo-300",
      border: "border-indigo-200 dark:border-indigo-800",
      icon: ShieldCheck,
    },
    MULTI_HYPOTHESIS_AMBIGUOUS: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-800",
      icon: Split,
    },
    CONTRADICTED_SUSPICIOUS: {
      bg: "bg-rose-50 dark:bg-rose-950/40",
      text: "text-rose-700 dark:text-rose-300",
      border: "border-rose-200 dark:border-rose-800",
      icon: AlertTriangle,
    },
    INSUFFICIENT_EVIDENCE: {
      bg: "bg-slate-50 dark:bg-slate-900/60",
      text: "text-slate-700 dark:text-slate-300",
      border: "border-slate-200 dark:border-slate-800",
      icon: HelpCircle,
    },
    INVESTIGATION_FAILED: {
      bg: "bg-red-50 dark:bg-red-950/40",
      text: "text-red-700 dark:text-red-300",
      border: "border-red-200 dark:border-red-800",
      icon: XCircle,
    },
  };

  const getVerdictBadge = (verdict: ClaimVerdict) => {
    switch (verdict) {
      case "VERIFIED":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">VERIFIED</span>;
      case "PARTIALLY_VERIFIED":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-100 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">PARTIAL</span>;
      case "UNSUPPORTED":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">UNSUPPORTED</span>;
      case "CONTRADICTED":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">CONTRADICTED</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">UNVERIFIABLE</span>;
    }
  };

  const getHypothesisBadge = (status: HypothesisStatus) => {
    switch (status) {
      case "SUPPORTED":
        return <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">SUPPORTED</span>;
      case "REFUTED":
        return <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">REFUTED</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">PLAUSIBLE UNVERIFIED</span>;
    }
  };

  const getCausalStatusBadge = (status: CausalStepStatus) => {
    switch (status) {
      case "VERIFIED":
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">VERIFIED STEP</span>;
      case "PLAUSIBLE":
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">PLAUSIBLE</span>;
      case "CONTRADICTED":
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">CONTRADICTED</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">GAP DETECTED</span>;
    }
  };

  const verifiedClaims = data?.verified_claims || [];
  const hypotheses = data?.hypothesis_verifications || [];
  const causalChain = data?.causal_chain_verifications || [];
  const counterfactuals = data?.advanced_investigation?.why_not_alternatives || [];

  const filteredClaims = verifiedClaims.filter((c) => {
    if (selectedVerdictFilter === "ALL") return true;
    return c.verdict === selectedVerdictFilter;
  });

  const outcomeStyle = data?.investigation_outcome
    ? outcomeColors[data.investigation_outcome] || outcomeColors.INSUFFICIENT_EVIDENCE
    : outcomeColors.INSUFFICIENT_EVIDENCE;
  const OutcomeIcon = outcomeStyle.icon;

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner with Action Buttons ── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl text-white shadow-md">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Advanced AI Investigation
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  Phase 8
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Competing hypotheses, causal reasoning trace, 5-verdict claim verification, and deterministic safety
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {historyVersions.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>{historyVersions.length} Version{historyVersions.length === 1 ? "" : "s"}</span>
              </div>
            )}
            <button
              onClick={handleRunInvestigation}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Hypotheses...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run Advanced Investigation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Safety & Non-Mutation Assurance Banner */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>
              <strong>Deterministic Safety Guarantee:</strong> AI reasoning is rigorously verified against audit logs. AI never modifies payment state or operational status.
            </span>
          </div>
          {data?.evidence_package_hash && (
            <div className="hidden sm:flex items-center gap-1 font-mono text-[10px] text-slate-400">
              <span>Hash:</span>
              <span className="text-slate-600 dark:text-slate-300">{data.evidence_package_hash.substring(0, 12)}...</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {initialLoading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Checking existing investigation state...</p>
        </div>
      ) : !data ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
          <BrainCircuit className="w-12 h-12 mx-auto text-indigo-400 mb-3 opacity-60" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
            No Advanced Investigation Yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
            Click below to generate competing hypotheses, evaluate the causal chain, verify claims against deterministic logs, and synthesize counterfactuals.
          </p>
          <button
            onClick={handleRunInvestigation}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Launch Advanced AI Investigation</span>
          </button>
        </div>
      ) : (
        <>
          {/* ── Investigation Outcome Banner ── */}
          <div className={`rounded-xl border p-5 ${outcomeStyle.bg} ${outcomeStyle.border}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 shadow-sm mt-0.5 ${outcomeStyle.text}`}>
                  <OutcomeIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                      Outcome
                    </span>
                    <h3 className={`text-base font-bold ${outcomeStyle.text}`}>
                      {data.investigation_outcome.replace(/_/g, " ")}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    {data.confidence?.reasoning || data.advanced_investigation?.summary || "Investigation completed with structured deterministic verification."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm px-4 py-3 rounded-lg border border-slate-200/60 dark:border-slate-800/60 shadow-xs">
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400">Confidence</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {Math.round((data.confidence?.score ?? 0) * 100)}%
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400">Claims Verified</div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {verifiedClaims.filter((c) => c.verdict === "VERIFIED").length}/{verifiedClaims.length}
                  </div>
                </div>
                {data.abstained && (
                  <>
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                    <div>
                      <div className="text-[10px] uppercase font-mono text-rose-400">Abstention</div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        ABSTAINED
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Execution Metadata Pills */}
            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              {data.model_metadata?.model && (
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  <span>Model:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{data.model_metadata.model}</span>
                </div>
              )}
              {data.duration_ms && (
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Execution:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{data.duration_ms}ms</span>
                </div>
              )}
              {data.activation_reason && (
                <div className="flex items-center gap-1 text-[11px]">
                  <Info className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Gate Trigger:</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{data.activation_reason}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Subtabs for Deep Exploration ── */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              onClick={() => setActiveSubTab("hypotheses")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSubTab === "hypotheses"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Split className="w-4 h-4" />
              <span>Competing Hypotheses</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-500/20 font-mono">
                {hypotheses.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab("causal")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSubTab === "causal"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Causal Chain Trace</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-500/20 font-mono">
                {causalChain.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab("claims")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSubTab === "claims"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span>5-Verdict Claim Verification</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-500/20 font-mono">
                {verifiedClaims.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab("counterfactuals")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSubTab === "counterfactuals"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>WHY-NOT Counterfactuals</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-500/20 font-mono">
                {counterfactuals.length}
              </span>
            </button>
          </div>

          {/* ── Subtab 1: Competing Hypotheses ── */}
          {activeSubTab === "hypotheses" && (
            <div className="space-y-4">
              {hypotheses.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  No explicit competing hypotheses found in this run.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {hypotheses.map((hyp) => {
                    const isExpanded = expandedHypothesis === hyp.hypothesis_id;
                    const isPrimary = hyp.hypothesis_id === "H1" || hyp.hypothesis_id.toLowerCase().includes("primary");
                    return (
                      <div
                        key={hyp.hypothesis_id}
                        className={`bg-white dark:bg-slate-900 rounded-xl border transition p-4 ${
                          isPrimary
                            ? "border-indigo-300 dark:border-indigo-800/80 shadow-sm ring-1 ring-indigo-500/20"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="px-2 py-1 rounded text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {hyp.hypothesis_id}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                  {hyp.title}
                                </h4>
                                {isPrimary && (
                                  <span className="text-[10px] px-1.5 py-0.2 font-semibold uppercase bg-indigo-600 text-white rounded">
                                    Primary
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                                {hyp.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {getHypothesisBadge(hyp.status)}
                            <div className="text-right">
                              <div className="text-[10px] uppercase font-mono text-slate-400">Likelihood</div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {Math.round(hyp.likelihood_score * 100)}%
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Verification Notes & Linked Claims */}
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400">Supporting claims:</span>
                            {hyp.supporting_claim_ids?.length > 0 ? (
                              <div className="flex items-center gap-1">
                                {hyp.supporting_claim_ids.map((cid) => (
                                  <span key={cid} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                    {cid}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">None</span>
                            )}
                            {hyp.contradicting_claim_ids?.length > 0 && (
                              <>
                                <span className="text-slate-400 ml-2">Contradicting:</span>
                                <div className="flex items-center gap-1">
                                  {hyp.contradicting_claim_ids.map((cid) => (
                                    <span key={cid} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                      {cid}
                                    </span>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>

                          {hyp.verification_notes && (
                            <button
                              onClick={() => setExpandedHypothesis(isExpanded ? null : hyp.hypothesis_id)}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                            >
                              <span>{isExpanded ? "Hide notes" : "View notes"}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>

                        {isExpanded && hyp.verification_notes && (
                          <div className="mt-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">Verification Rationale:</span>
                            {hyp.verification_notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Subtab 2: Causal Chain Trace ── */}
          {activeSubTab === "causal" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span>Causal Chain Event Sequence</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Chronological event transition sequence verified against deterministic state machine transition rules.
                </p>
              </div>

              {causalChain.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No structured causal steps registered for this incident.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {causalChain.map((step) => {
                    const hasEvId = Boolean(step.evidence_id);
                    return (
                      <div key={step.step_index} className="relative group">
                        {/* Step Marker Dot */}
                        <div className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold ${
                          step.status === "VERIFIED"
                            ? "bg-emerald-500 text-white"
                            : step.status === "CONTRADICTED"
                            ? "bg-rose-500 text-white"
                            : "bg-amber-500 text-white"
                        }`}>
                          {step.step_index}
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3.5 border border-slate-200 dark:border-slate-700/80">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                {step.event_type}
                              </span>
                              {getCausalStatusBadge(step.status)}
                            </div>
                            {step.timing_delta_ms !== undefined && step.timing_delta_ms !== null && (
                              <span className="text-[11px] font-mono text-slate-400">
                                +{step.timing_delta_ms}ms
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {step.description}
                          </p>

                          <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-slate-500 dark:text-slate-400 italic text-[11px]">
                              {step.verification_notes}
                            </span>
                            {hasEvId && (
                              <button
                                onClick={() => onSelectEvidence?.(step.evidence_id!)}
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              >
                                <span>Evidence: {step.evidence_id}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Subtab 3: 5-Verdict Claim Verification ── */}
          {activeSubTab === "claims" && (
            <div className="space-y-4">
              {/* Verdict Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <Filter className="w-4 h-4 text-indigo-500" />
                  <span>Filter by Verdict:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {["ALL", "VERIFIED", "PARTIALLY_VERIFIED", "UNSUPPORTED", "CONTRADICTED", "UNVERIFIABLE"].map((verdict) => {
                    const count = verdict === "ALL"
                      ? verifiedClaims.length
                      : verifiedClaims.filter((c) => c.verdict === verdict).length;
                    return (
                      <button
                        key={verdict}
                        onClick={() => setSelectedVerdictFilter(verdict)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                          selectedVerdictFilter === verdict
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        <span>{verdict.replace(/_/g, " ")}</span>
                        <span className="text-[10px] px-1 rounded-full bg-black/15 dark:bg-white/15">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Claims Cards */}
              {filteredClaims.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  No claims found matching verdict filter &quot;{selectedVerdictFilter}&quot;.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredClaims.map((claim) => (
                    <div
                      key={claim.claim_id}
                      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-slate-300 dark:hover:border-slate-700 transition"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                            {claim.claim_id}
                          </span>
                          {getVerdictBadge(claim.verdict)}
                          {claim.authoritative_agreement && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Agrees with Authoritative Rules
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono text-slate-400">Weight: </span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {Math.round(claim.confidence_weight * 100)}%
                          </span>
                        </div>
                      </div>

                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mb-1.5 leading-relaxed">
                        {claim.statement}
                      </p>

                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                        {claim.explanation}
                      </p>

                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">Evidence IDs:</span>
                          {claim.evidence_ids?.length > 0 ? (
                            <div className="flex items-center gap-1">
                              {claim.evidence_ids.map((eid) => (
                                <button
                                  key={eid}
                                  onClick={() => onSelectEvidence?.(eid)}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 transition cursor-pointer"
                                >
                                  {eid}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No supporting evidence cited</span>
                          )}
                        </div>

                        {claim.contradicts_evidence_ids?.length > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-rose-500 text-[11px]">Contradicts:</span>
                            {claim.contradicts_evidence_ids.map((eid) => (
                              <button
                                key={eid}
                                onClick={() => onSelectEvidence?.(eid)}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:underline cursor-pointer"
                              >
                                {eid}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Subtab 4: WHY-NOT Counterfactuals ── */}
          {activeSubTab === "counterfactuals" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-purple-500" />
                  <span>WHY-NOT Counterfactual Reasoning</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Explanation of alternative explanations explicitly evaluated and ruled out based on contradictory or missing evidence.
                </p>
              </div>

              {counterfactuals.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No counterfactual alternatives recorded for this incident.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {counterfactuals.map((alt, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          RULED OUT
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {alt.alternative_scenario}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2.5">
                        {alt.ruled_out_reason}
                      </p>
                      {alt.contradicting_evidence_ids?.length > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 text-[11px]">Contradicting Evidence:</span>
                          <div className="flex items-center gap-1">
                            {alt.contradicting_evidence_ids.map((eid) => (
                              <button
                                key={eid}
                                onClick={() => onSelectEvidence?.(eid)}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:underline cursor-pointer"
                              >
                                {eid}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
