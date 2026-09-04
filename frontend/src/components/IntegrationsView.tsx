import React from "react";
import {
  Lock,
  ShieldCheck,
  Server,
  Key,
} from "lucide-react";

export const IntegrationsView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-indigo-500" />
          <span>Payment Gateway & Webhook Integrations</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Live webhook listeners, cryptographic signature configuration, and event idempotency controls
        </p>
      </div>

      {/* ── Integration 1: Razorpay Webhook Ingestion ───────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base">
              R
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Razorpay Webhook Listener
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inbound payment lifecycle webhook stream (created, authorized, captured, failed)
              </p>
            </div>
          </div>

          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md">
            Test Mode Active
          </span>
        </div>

        {/* Integration Specs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              Webhook Endpoint URL
            </div>
            <div className="font-mono text-slate-800 dark:text-slate-200 break-all select-all">
              POST /webhooks/razorpay
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              Signature Verification
            </div>
            <div className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              HMAC-SHA256 (X-Razorpay-Signature)
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="text-[10px] uppercase font-semibold text-slate-400">
              Idempotency Deduplication Key
            </div>
            <div className="font-mono text-slate-800 dark:text-slate-200">
              X-Razorpay-Event-Id header
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <div className="text-[10px] uppercase font-semibold text-slate-400">
              Tamper Resistance Policy
            </div>
            <div className="font-mono text-slate-800 dark:text-slate-200">
              Invalid signatures flagged & isolated
            </div>
          </div>
        </div>

        {/* Security Alert Box */}
        <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-slate-300 leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Cryptographic Grounding Guarantee</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Raw webhook payloads are hashed (SHA-256) and verified prior to entering the normalized
            evidence package. Events with tampered signatures are rejected by the state machine and
            cannot create spurious transitions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsView;
