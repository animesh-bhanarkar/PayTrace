import React from "react";
import type { AiConfig } from "../api/client";
import {
  Settings,
  Cpu,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

interface SettingsViewProps {
  aiConfig: AiConfig;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ aiConfig }) => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-500" />
          <span>Engine Settings & Architecture Specifications</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Core AI model configuration, structured schema constraints, and calibration parameters
        </p>
      </div>

      {/* ── Section 1: AI Model & Structured Schema ─────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Cpu className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Gemini Reasoning Model & Enforcement
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="text-[10px] uppercase font-semibold text-slate-400">Target Model</div>
            <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {aiConfig.primaryModel} (Google GenAI SDK)
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="text-[10px] uppercase font-semibold text-slate-400">
              Schema Enforcement
            </div>
            <div className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>response_schema via GenerateContentConfig</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="text-[10px] uppercase font-semibold text-slate-400">
              Structured Output Keys
            </div>
            <div className="font-mono text-slate-800 dark:text-slate-200">
              hypothesis, claims, recommended_next_step, uncertainty
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="text-[10px] uppercase font-semibold text-slate-400">
              Anti-Hallucination Claim Schema
            </div>
            <div className="font-mono text-slate-800 dark:text-slate-200">
              claim_id, statement, evidence_ids, counter_evidence_ids, confidence
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Deterministic Governance Rules ────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Deterministic Pipeline Invariants
          </h3>
        </div>

        <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-2">
            <span className="text-indigo-400 font-bold">1.</span>
            <span>
              <strong>State Machine Primacy:</strong> Payment states (created, authorized, captured, failed) are computed exclusively by deterministic transition tables, never by LLM output.
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-2">
            <span className="text-indigo-400 font-bold">2.</span>
            <span>
              <strong>AI Activation Gate:</strong> AI is only engaged when authoritative rules verify ambiguity (e.g. invalid transition sequences). Clean payments resolve in 0ms with zero LLM cost.
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-2">
            <span className="text-indigo-400 font-bold">3.</span>
            <span>
              <strong>Automated Abstention:</strong> If Gemini emits ungrounded claims or hallucinated evidence citations, the confidence engine abstains and falls back safely to deterministic rules.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
