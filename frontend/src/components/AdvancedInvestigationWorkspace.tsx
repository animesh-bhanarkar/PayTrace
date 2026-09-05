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
  Scale,
  Binary,
  AlertOctagon,
  FileText,
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

  const getOutcomeConfig = (outcome?: string | InvestigationOutcome, abstained?: boolean, aiActivated?: boolean) => {
    if (aiActivated === false) {
      return {
        title: "DETERMINISTIC RESULT",
        subtitle: "Resolved directly via deterministic authoritative rules. AI invocation was skipped by the policy gate.",
        bg: "bg-slate-50 dark:bg-slate-900/80",
        border: "border-slate-200 dark:border-slate-800",
        text: "text-slate-700 dark:text-slate-300",
        badgeBg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
        icon: Binary,
      };
    }

    if (outcome === "INVESTIGATION_FAILED" || outcome === "AI_UNAVAILABLE") {
      return {
        title: "AI SERVICE UNAVAILABLE",
        subtitle: "AI reasoning service could not be reached or failed during execution. Authoritative deterministic rules remain valid.",
        bg: "bg-rose-50/70 dark:bg-rose-950/30",
        border: "border-rose-200 dark:border-rose-900/50",
        text: "text-rose-700 dark:text-rose-300",
        badgeBg: "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800",
        icon: AlertOctagon,
      };
    }

    if (abstained || outcome === "INSUFFICIENT_EVIDENCE" || outcome === "INCONCLUSIVE") {
      return {
        title: "INCONCLUSIVE (ABSTAINED)",
        subtitle: "PayTrace intentionally abstained from an AI conclusion because evidence is incomplete or contains irreconcilable contradictions.",
        bg: "bg-amber-50/70 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-900/50",
        text: "text-amber-700 dark:text-amber-300",
        badgeBg: "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800",
        icon: Scale,
      };
    }

    switch (outcome) {
      case "AUTHORITATIVE_CONFIRMED":
      case "RESOLVED_WITH_HIGH_CONFIDENCE":
        return {
          title: "AUTHORITATIVE CONFIRMED",
          subtitle: "AI reasoning completely aligns with deterministic state reconstruction and all claims passed verification.",
          bg: "bg-emerald-50/70 dark:bg-emerald-950/30",
          border: "border-emerald-200 dark:border-emerald-900/50",
          text: "text-emerald-700 dark:text-emerald-300",
          badgeBg: "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
          icon: CheckCircle2,
        };
      case "HIGH_CONFIDENCE_RECONSTRUCTED":
      case "RESOLVED_WITH_MEDIUM_CONFIDENCE":
        return {
          title: "HIGH CONFIDENCE RECONSTRUCTED",
          subtitle: "AI synthesized a consistent causal chain supported by verified evidence records.",
          bg: "bg-indigo-50/70 dark:bg-indigo-950/30",
          border: "border-indigo-200 dark:border-indigo-900/50",
          text: "text-indigo-700 dark:text-indigo-300",
          badgeBg: "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800",
          icon: ShieldCheck,
        };
      case "MULTI_HYPOTHESIS_AMBIGUOUS":
      case "LOW_CONFIDENCE":
        return {
          title: "MULTI-HYPOTHESIS AMBIGUOUS",
          subtitle: "Multiple competing explanations exist; deterministic logs support partial aspects of more than one hypothesis.",
          bg: "bg-purple-50/70 dark:bg-purple-950/30",
          border: "border-purple-200 dark:border-purple-900/50",
          text: "text-purple-700 dark:text-purple-300",
          badgeBg: "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800",
          icon: Split,
        };
      case "CONTRADICTED_SUSPICIOUS":
        return {
          title: "CONTRADICTED / SUSPICIOUS",
          subtitle: "AI hypothesis was contradicted by verified event timestamps or tamper-evident signatures.",
          bg: "bg-rose-50/70 dark:bg-rose-950/30",
          border: "border-rose-200 dark:border-rose-900/50",
          text: "text-rose-700 dark:text-rose-300",
          badgeBg: "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800",
          icon: AlertTriangle,
        };
      default:
        return {
          title: String(outcome || "INVESTIGATION COMPLETED").replace(/_/g, " "),
          subtitle: "Structured investigation completed with deterministic claim verification.",
          bg: "bg-slate-50 dark:bg-slate-900/70",
          border: "border-slate-200 dark:border-slate-800",
          text: "text-slate-700 dark:text-slate-300",
          badgeBg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
          icon: HelpCircle,
        };
    }
  };

  const getVerdictBadge = (verdict: ClaimVerdict) => {
    switch (verdict) {
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>VERIFIED</span>
          </span>
        );
      case "PARTIALLY_VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
            <Info className="w-3 h-3 text-cyan-500" />
            <span>PARTIALLY VERIFIED</span>
          </span>
        );
      case "UNSUPPORTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <HelpCircle className="w-3 h-3 text-amber-500" />
            <span>UNSUPPORTED</span>
          </span>
        );
      case "CONTRADICTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <XCircle className="w-3 h-3 text-rose-500" />
            <span>CONTRADICTED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <HelpCircle className="w-3 h-3 text-slate-400" />
            <span>UNVERIFIABLE</span>
          </span>
        );
    }
  };

  const getHypothesisBadge = (status: HypothesisStatus) => {
    switch (status) {
      case "SUPPORTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>SUPPORTED</span>
          </span>
        );
      case "REFUTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
            <XCircle className="w-3 h-3 text-rose-500" />
            <span>REFUTED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <HelpCircle className="w-3 h-3 text-amber-500" />
            <span>PLAUSIBLE UNVERIFIED</span>
          </span>
        );
    }
  };

  const getCausalStatusBadge = (status: CausalStepStatus) => {
    switch (status) {
      case "VERIFIED":
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">VERIFIED STEP</span>;
      case "PLAUSIBLE":
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">PLAUSIBLE</span>;
      case "CONTRADICTED":
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">CONTRADICTED</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">GAP DETECTED</span>;
    }
  };

  // Filter out any blank claims
  const verifiedClaims = (data?.verified_claims || []).filter(
    (c) => c && c.claim_id && c.statement?.trim().length > 0
  );
  const hypotheses = data?.hypothesis_verifications || [];
  const causalChain = data?.causal_chain_verifications || [];
  const counterfactuals = data?.advanced_investigation?.why_not_alternatives || [];

  const filteredClaims = verifiedClaims.filter((c) => {
    if (selectedVerdictFilter === "ALL") return true;
    return c.verdict === selectedVerdictFilter;
  });

  const outcomeConfig = getOutcomeConfig(
    data?.investigation_outcome,
    data?.abstained,
    data?.ai_activated
  );
  const OutcomeIcon = outcomeConfig.icon;

  const isAiSkipped = data?.ai_activated === false;

  return (
    <div className="space-y-6">
      {/* ── Top Instrument Header ───────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 dark:bg-slate-800 text-indigo-400 rounded-xl border border-slate-700/60 shadow-xs">
              <BrainCircuit className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Advanced AI Investigation Engine
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  Phase 8
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Evidence-grounded hypothesis synthesis, causal reasoning verification, and deterministic claim proof.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {historyVersions.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>{historyVersions.length} Run{historyVersions.length === 1 ? "" : "s"}</span>
              </div>
            )}
            <button
              onClick={handleRunInvestigation}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>Synthesizing &amp; Verifying...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{data ? "Re-Run Investigation" : "Launch AI Investigation"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Safety & Non-Mutation Assurance Banner */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong className="text-slate-700 dark:text-slate-300 font-semibold">Deterministic Safety Guarantee:</strong> AI reasoning is strictly read-only and verified against audit logs. Model outputs never mutate payment states.
            </span>
          </div>
          {data?.evidence_package_hash && (
            <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
              <span>SHA256:</span>
              <span className="text-slate-600 dark:text-slate-300 font-semibold">{data.evidence_package_hash.substring(0, 12)}...</span>
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
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-500 mb-3" />
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Retrieving investigation audit record...</p>
        </div>
      ) : !data ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center shadow-xs">
          <BrainCircuit className="w-10 h-10 mx-auto text-slate-400 mb-3 opacity-60" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
            No Advanced AI Run Recorded
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4 leading-relaxed">
            Trigger an automated deep investigation to formulate competing hypotheses, verify causal chains against event logs, and produce 5-verdict claim proofs.
          </p>
          <button
            onClick={handleRunInvestigation}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Launch Advanced Investigation</span>
          </button>
        </div>
      ) : (
        <>
          {/* ── Visual Investigation Pipeline Stepper ──────────────────────── */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Investigation Audit Pipeline
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
              {/* Step 1: AI Gate */}
              <div className={`p-2.5 rounded-lg border flex flex-col justify-between ${
                isAiSkipped
                  ? "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                  : "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">01. GATE</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    isAiSkipped
                      ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      : "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                  }`}>
                    {isAiSkipped ? "SKIPPED" : "ACTIVATED"}
                  </span>
                </div>
                <div className="mt-1 font-semibold text-[11px] text-slate-800 dark:text-slate-200 truncate" title={data.activation_reason || "Gate evaluated"}>
                  {isAiSkipped ? "Deterministic" : "Ambiguity Trigger"}
                </div>
              </div>

              {/* Step 2: Evidence Package */}
              <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">02. EVIDENCE</span>
                  <FileText className="w-3 h-3 text-slate-400" />
                </div>
                <div className="mt-1 font-semibold text-[11px] text-slate-800 dark:text-slate-200 truncate">
                  {data.evidence_package_hash ? "Hashed & Bounded" : "Direct Context"}
                </div>
              </div>

              {/* Step 3: Hypotheses */}
              <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">03. HYPOTHESES</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500">{hypotheses.length}</span>
                </div>
                <div className="mt-1 font-semibold text-[11px] text-slate-800 dark:text-slate-200">
                  {hypotheses.length > 1 ? "Competing Scenarios" : hypotheses.length === 1 ? "Single Model" : "None Formulated"}
                </div>
              </div>

              {/* Step 4: Claims */}
              <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">04. CLAIMS</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500">{verifiedClaims.length}</span>
                </div>
                <div className="mt-1 font-semibold text-[11px] text-slate-800 dark:text-slate-200">
                  Atomic Assertions
                </div>
              </div>

              {/* Step 5: Deterministic Verifier */}
              <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">05. VERIFIER</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                </div>
                <div className="mt-1 font-semibold text-[11px] text-emerald-600 dark:text-emerald-400">
                  {verifiedClaims.filter((c) => c.verdict === "VERIFIED").length} Verified
                </div>
              </div>

              {/* Step 6: Disposition */}
              <div className={`p-2.5 rounded-lg border flex flex-col justify-between ${
                data.abstained
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
                  : "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">06. DISPOSITION</span>
                  <span className="text-[10px] font-bold font-mono">
                    {Math.round((data.confidence?.score ?? 0) * 100)}%
                  </span>
                </div>
                <div className="mt-1 font-semibold text-[11px] truncate text-slate-900 dark:text-slate-100" title={outcomeConfig.title}>
                  {data.abstained ? "Abstained" : outcomeConfig.title}
                </div>
              </div>
            </div>
          </div>

          {/* ── PRIMARY SECTION: Outcome & AI Disposition ───────────────────── */}
          <div className={`rounded-xl border p-5 ${outcomeConfig.bg} ${outcomeConfig.border} transition-colors`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 max-w-2xl">
                <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/90 shadow-xs mt-0.5 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                  <OutcomeIcon className={`w-5 h-5 ${outcomeConfig.text}`} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400">
                      Outcome Disposition
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${outcomeConfig.badgeBg}`}>
                      {outcomeConfig.title}
                    </span>
                    {isAiSkipped && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                        POLICY GATE SKIPPED
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 leading-snug">
                    {data.confidence?.reasoning || data.advanced_investigation?.summary || outcomeConfig.subtitle}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {outcomeConfig.subtitle}
                  </p>
                </div>
              </div>

              {/* Confidence & Claims Scorecard */}
              <div className="flex items-center gap-3.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs px-4 py-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-xs shrink-0">
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400">Confidence</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {Math.round((data.confidence?.score ?? 0) * 100)}%
                  </div>
                </div>
                <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400">Verified Claims</div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {verifiedClaims.filter((c) => c.verdict === "VERIFIED").length}
                    <span className="text-xs font-normal text-slate-400">/{verifiedClaims.length}</span>
                  </div>
                </div>
                {data.abstained && (
                  <>
                    <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
                    <div>
                      <div className="text-[10px] uppercase font-mono text-rose-400">Status</div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                        ABSTAINED
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Execution Metadata Bar (Tertiary) */}
            <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                {data.activation_reason && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="text-slate-400">Gate Reason:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{data.activation_reason}</span>
                  </div>
                )}
                {data.model_metadata?.model && (
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Terminal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-400">Model:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{data.model_metadata.model}</span>
                  </div>
                )}
              </div>

              {data.duration_ms !== undefined && data.duration_ms !== null && (
                <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Execution: <strong className="text-slate-600 dark:text-slate-300">{data.duration_ms}ms</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* ── Subtabs for Deep Exploration ───────────────────────────────── */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              onClick={() => setActiveSubTab("hypotheses")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSubTab === "hypotheses"
                  ? "bg-slate-900 text-white dark:bg-slate-800 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Split className="w-3.5 h-3.5 text-indigo-400" />
              <span>Competing Hypotheses</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-500/20 font-mono">
                {hypotheses.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab("causal")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSubTab === "causal"
                  ? "bg-slate-900 text-white dark:bg-slate-800 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Causal Chain Trace</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-500/20 font-mono">
                {causalChain.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab("claims")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSubTab === "claims"
                  ? "bg-slate-900 text-white dark:bg-slate-800 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>5-Verdict Claim Verification</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-500/20 font-mono">
                {verifiedClaims.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab("counterfactuals")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSubTab === "counterfactuals"
                  ? "bg-slate-900 text-white dark:bg-slate-800 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
              <span>WHY-NOT Counterfactuals</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-500/20 font-mono">
                {counterfactuals.length}
              </span>
            </button>
          </div>

          {/* ── Subtab 1: Competing Hypotheses ─────────────────────────────── */}
          {activeSubTab === "hypotheses" && (
            <div className="space-y-4">
              {hypotheses.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  No competing AI hypotheses recorded for this incident.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {hypotheses.map((hyp) => {
                    const isExpanded = expandedHypothesis === hyp.hypothesis_id;
                    const isPrimary = hyp.hypothesis_id === "H1" || hyp.hypothesis_id.toLowerCase().includes("primary");
                    return (
                      <div
                        key={hyp.hypothesis_id}
                        className={`bg-white dark:bg-slate-900 rounded-xl border transition p-4 ${
                          isPrimary
                            ? "border-indigo-300 dark:border-indigo-800/80 shadow-xs"
                            : "border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="px-2 py-1 rounded text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {hyp.hypothesis_id}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                  {hyp.title}
                                </h4>
                                {isPrimary && (
                                  <span className="text-[10px] px-1.5 py-0.2 font-semibold uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded">
                                    Primary Hypothesis
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
                            <span className="text-slate-400 text-[11px]">Supporting Claims:</span>
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
                                <span className="text-slate-400 text-[11px] ml-2">Contradicting:</span>
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
                              <span>{isExpanded ? "Hide notes" : "View rationale"}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>

                        {isExpanded && hyp.verification_notes && (
                          <div className="mt-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
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

          {/* ── Subtab 2: Causal Chain Trace ───────────────────────────────── */}
          {activeSubTab === "causal" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
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

          {/* ── Subtab 3: 5-Verdict Claim Verification ──────────────────────── */}
          {activeSubTab === "claims" && (
            <div className="space-y-4">
              {/* Verdict Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
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
                            ? "bg-slate-900 text-white dark:bg-slate-800 shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        <span>{verdict.replace(/_/g, " ")}</span>
                        <span className="text-[10px] px-1 rounded-full bg-black/10 dark:bg-white/10 font-mono">
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
                      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 transition shadow-xs"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                            {claim.claim_id}
                          </span>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            AI HYPOTHESIS
                          </span>
                          {getVerdictBadge(claim.verdict)}
                          {claim.authoritative_agreement && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Agrees with Authoritative Rules
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono text-slate-400">Confidence Weight: </span>
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

                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">Supporting Evidence:</span>
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

          {/* ── Subtab 4: WHY-NOT Counterfactuals ──────────────────────────── */}
          {activeSubTab === "counterfactuals" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-purple-500" />
                  <span>WHY-NOT Counterfactual Reasoning</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Explicit analysis of alternate scenarios ruled out based on contradictory facts or missing telemetry.
                </p>
              </div>

              {counterfactuals.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No counterfactual alternatives recorded for this incident.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
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
