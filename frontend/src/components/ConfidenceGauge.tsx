import React from "react";
import type { ConfidenceResult } from "../types";

interface ConfidenceGaugeProps {
  confidence: ConfidenceResult;
  reconstructedState?: string;
  incidentsCount?: number;
  totalEventsCount?: number;
  verifiedClaimsCount?: number;
  totalClaimsCount?: number;
}

export const ConfidenceGauge: React.FC<ConfidenceGaugeProps> = ({
  confidence,
  reconstructedState,
  incidentsCount = 0,
  totalEventsCount = 0,
  verifiedClaimsCount = 0,
  totalClaimsCount = 0,
}) => {
  const level = confidence.level;
  const isAbstained = confidence.abstain;

  // Use the authoritative calibrated score (0.0 to 1.0)
  const scorePct = Math.round((confidence.score || 0) * 100);

  // SVG Gauge calculations (radius = 38, circumference ≈ 238.76)
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scorePct / 100) * circumference;

  let strokeColor = "#3B82F6"; // Blue default
  let badgeBg = "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (level === "HIGH") {
    strokeColor = "#10B981"; // Emerald
    badgeBg = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  } else if (level === "MEDIUM") {
    strokeColor = "#F59E0B"; // Amber
    badgeBg = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  } else if (level === "LOW" || isAbstained || level === "INCONCLUSIVE") {
    strokeColor = "#F43F5E"; // Rose / Guarded
    badgeBg = "bg-rose-500/10 text-rose-400 border-rose-500/20";
  }

  // Calculate grounded claim verification rate
  const claimSupportRate =
    totalClaimsCount > 0
      ? Math.round((verifiedClaimsCount / totalClaimsCount) * 100)
      : 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Confidence & Verification Calibration
        </h4>
        <span
          className="text-xs font-mono text-slate-500 cursor-help"
          title="Deterministic scoring based on anomaly count, citation validity, and sequence integrity"
        >
          {level}
        </span>
      </div>

      <div className="flex items-center gap-5 pt-1">
        {/* Radial SVG Gauge */}
        <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r={radius}
              className="stroke-slate-800"
              strokeWidth="7"
              fill="transparent"
            />
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke={strokeColor}
              strokeWidth="7"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-lg font-bold text-slate-100 leading-none font-mono">
              {scorePct}%
            </span>
            <span className="text-[10px] font-medium text-slate-400 mt-0.5">
              Score
            </span>
          </div>
        </div>

        {/* Deterministic Verification Properties */}
        <div className="flex-1 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  incidentsCount === 0 ? "bg-emerald-500" : "bg-amber-500"
                }`}
              ></span>
              Anomaly Penalty
            </span>
            <span className="font-semibold text-slate-200 font-mono">
              {incidentsCount === 0 ? "None (Clean)" : `-${incidentsCount * 15}% (${incidentsCount} flagged)`}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  totalEventsCount > 0 ? "bg-emerald-500" : "bg-amber-500"
                }`}
              ></span>
              Evidence Volume
            </span>
            <span className="font-semibold text-slate-200 font-mono">
              {totalEventsCount} {totalEventsCount === 1 ? "event" : "events"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  claimSupportRate === 100
                    ? "bg-emerald-500"
                    : claimSupportRate > 0
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
              ></span>
              Claim Support Rate
            </span>
            <span className="font-semibold text-slate-200 font-mono">
              {totalClaimsCount > 0 ? `${claimSupportRate}% (${verifiedClaimsCount}/${totalClaimsCount})` : "N/A (Deterministic)"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  reconstructedState ? "bg-indigo-400" : "bg-slate-600"
                }`}
              ></span>
              Reconstructed State
            </span>
            <span className="font-semibold text-indigo-300 font-mono uppercase">
              {reconstructedState || "UNKNOWN"}
            </span>
          </div>
        </div>
      </div>

      {/* Rationale Alert Box */}
      <div className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2 ${badgeBg}`}>
        <span className="text-sm leading-none shrink-0 mt-0.5">ⓘ</span>
        <div>
          {confidence.reason ? (
            <span>{confidence.reason}</span>
          ) : isAbstained ? (
            <span>
              Confidence is guarded due to anomaly presence. Abstention active to prevent speculative diagnosis.
            </span>
          ) : (
            <span>
              Deterministic evidence verified with high confidence. Payment facts successfully grounded.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfidenceGauge;

