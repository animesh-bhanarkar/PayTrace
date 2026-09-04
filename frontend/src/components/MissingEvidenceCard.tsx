import React from "react";
import type { MissingEvidenceReport } from "../types";

interface MissingEvidenceCardProps {
  report: MissingEvidenceReport;
  onRefresh?: () => void;
}

export const MissingEvidenceCard: React.FC<MissingEvidenceCardProps> = ({ report, onRefresh }) => {
  const completenessPercent = Math.round((report.lifecycle_completeness ?? 1.0) * 100);
  const isComplete = !report.has_missing_evidence && completenessPercent === 100;

  return (
    <div className="bg-slate-900/60 dark:bg-slate-900/80 border border-slate-800 rounded-xl p-5 mb-6 backdrop-blur-sm shadow-sm transition-all">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
              isComplete
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            }`}
          >
            {isComplete ? "✓" : "!"}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              Evidence Completeness Engine
            </h3>
            <p className="text-xs text-slate-400">
              Deterministic payment lifecycle sequence verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs font-mono font-bold text-slate-300">
              {completenessPercent}% Complete
            </span>
            <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all duration-500 ${
                  completenessPercent >= 100
                    ? "bg-emerald-500"
                    : completenessPercent >= 66
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${completenessPercent}%` }}
              />
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded transition-colors"
              title="Re-evaluate completeness"
            >
              Check
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-300 mb-4 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
        <span className="text-slate-400 font-medium">Status: </span>
        {report.reason}
      </div>

      {report.has_missing_evidence && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          {/* Missing Gaps */}
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-3">
            <div className="text-xs font-semibold text-rose-400 mb-2 flex items-center gap-1.5">
              <span>⚠</span> Identified Missing Evidence ({report.missing_evidence.length})
            </div>
            <ul className="space-y-1.5">
              {report.missing_evidence.map((gap, idx) => (
                <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-rose-400 font-mono select-none">•</span>
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommended Next Actions */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
            <div className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1.5">
              <span>→</span> Recommended Next Evidence Actions
            </div>
            <ul className="space-y-1.5">
              {report.recommended_next_evidence.map((rec, idx) => (
                <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-blue-400 font-mono select-none">→</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
