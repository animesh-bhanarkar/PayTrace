import React, { useState } from "react";
import type { InvestigationResult, IncidentRecord, IncidentNoteItem } from "../types";
import {
  Printer,
  Copy,
  Check,
  X,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Cpu,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface InvestigationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: InvestigationResult;
  incidentRecord?: IncidentRecord | null;
  notes?: IncidentNoteItem[];
}

export const InvestigationReportModal: React.FC<InvestigationReportModalProps> = ({
  isOpen,
  onClose,
  result,
  incidentRecord,
  notes = [],
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyJson = () => {
    const exportPayload = {
      report_generated_at: new Date().toISOString(),
      system: "PayTrace Evidence-Grounded Payment Incident Investigation System",
      incident: incidentRecord || null,
      investigation_result: result,
      investigator_notes: notes,
    };
    navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allClaims = [
    ...(result.verified_claims || []),
    ...(result.rejected_claims || []),
  ];

  const events = result.evidence_package?.events || [];
  const incidents = result.evidence_package?.incidents || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Modal Toolbar - Hidden during print */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-100">
              PayTrace Formal Incident Investigation Report
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
              title="Copy Raw Investigation JSON"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? "JSON Copied" : "Copy JSON"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="p-8 overflow-y-auto space-y-6 text-xs text-slate-300 leading-relaxed font-sans print:p-0 print:text-black print:bg-white">
          {/* Section 1: Executive Header */}
          <div className="border-b border-slate-800 pb-5">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-lg text-indigo-400 tracking-wider">
                    PAYTRACE
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 uppercase font-mono">
                    Official Incident Dossier
                  </span>
                </div>
                <h1 className="text-xl font-bold text-slate-100 mt-1">
                  Payment Incident Investigation Report
                </h1>
                <p className="text-slate-400 font-mono text-[11px] mt-0.5">
                  Payment ID: <strong className="text-slate-200">{result.payment_id}</strong>
                </p>
              </div>

              <div className="text-right text-[11px] space-y-1 font-mono text-slate-400">
                <div>Generated: {new Date().toUTCString()}</div>
                <div>
                  Status:{" "}
                  <strong
                    className={
                      incidentRecord?.resolved ? "text-emerald-400" : "text-amber-400"
                    }
                  >
                    {incidentRecord?.resolved ? "RESOLVED" : "OPEN"}
                  </strong>
                </div>
                <div>
                  AI Gate:{" "}
                  <strong className="text-indigo-300">
                    {result.ai_activated ? "ACTIVATED" : "BYPASSED (Deterministic)"}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Deterministic State Reconstruction */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              1. Deterministic State Reconstruction
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Reconstructed State</div>
                <div className="font-mono font-bold text-sm text-indigo-300 mt-0.5">
                  {result.evidence_package?.reconstructed_state || "UNKNOWN"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Total Events</div>
                <div className="font-mono font-bold text-sm text-slate-200 mt-0.5">
                  {events.length}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Detected Incidents</div>
                <div className="font-mono font-bold text-sm text-rose-400 mt-0.5">
                  {incidents.length}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Confidence Level</div>
                <div className="font-mono font-bold text-sm text-emerald-400 mt-0.5">
                  {result.confidence?.level || "HIGH"} (
                  {Math.round((result.confidence?.score || 0) * 100)}%)
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Incident Classification */}
          {incidents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                2. Incident Classification & Anomalies
              </h3>
              <div className="space-y-1.5">
                {incidents.map((inc, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40 flex items-start justify-between"
                  >
                    <div>
                      <span className="font-mono font-bold text-rose-300 mr-2">
                        {inc.incident_type}
                      </span>
                      <span className="text-slate-300">{inc.description || "Anomaly detected"}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-900/40 text-rose-200 border border-rose-700/50">
                      {inc.severity || "HIGH"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Evidence Package Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-indigo-400" />
              3. Normalized Evidence Package (Audit Trail)
            </h3>
            <div className="border border-slate-800 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Evidence ID</th>
                    <th className="py-2 px-3 font-semibold">Event Type</th>
                    <th className="py-2 px-3 font-semibold">Source</th>
                    <th className="py-2 px-3 font-semibold">HMAC Valid</th>
                    <th className="py-2 px-3 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {events.map((evt, idx) => (
                    <tr key={idx} className="hover:bg-slate-950/30">
                      <td className="py-2 px-3 font-bold text-indigo-300">
                        {evt.evidence_id || `evt_${idx + 1}`}
                      </td>
                      <td className="py-2 px-3 text-slate-200">{evt.event_type}</td>
                      <td className="py-2 px-3 text-slate-400">{evt.source || "webhook"}</td>
                      <td className="py-2 px-3">
                        {evt.signature_valid === false ? (
                          <span className="text-rose-400 font-bold">INVALID</span>
                        ) : (
                          <span className="text-emerald-400 font-bold">VALID</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-400">
                        {evt.event_timestamp ? new Date(evt.event_timestamp).toISOString() : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: AI Investigation & Root Cause */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              4. AI Root Cause Investigation (Gemini 2.5 Flash)
            </h3>
            <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Root Cause Hypothesis
                </span>
                <p className="mt-0.5 text-slate-100 font-medium leading-relaxed">
                  {result.investigation?.hypothesis || result.reason || "Deterministic resolution applied."}
                </p>
              </div>

              {result.investigation?.recommended_next_step && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                    Recommended Remediation Step
                  </span>
                  <p className="mt-0.5 text-emerald-300 leading-relaxed font-mono">
                    {result.investigation.recommended_next_step}
                  </p>
                </div>
              )}

              {result.investigation?.uncertainty && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                    Stated Uncertainty & Bounds
                  </span>
                  <p className="mt-0.5 text-amber-300/90 leading-relaxed italic">
                    {result.investigation.uncertainty}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 6: Claim Verification & Anti-Hallucination Audit */}
          {allClaims.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                5. Claim Verification & Anti-Hallucination Audit
              </h3>
              <div className="space-y-2">
                {allClaims.map((c) => (
                  <div
                    key={c.claim_id}
                    className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-300">{c.claim_id}</span>
                        {c.verdict === "SUPPORTED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                            <CheckCircle2 className="w-3 h-3" /> SUPPORTED
                          </span>
                        ) : c.verdict === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700/50">
                            <XCircle className="w-3 h-3" /> REJECTED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700/50">
                            UNVERIFIABLE
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        Citations: {c.evidence_ids.join(", ") || "NONE"}
                      </div>
                    </div>

                    <p className="mt-1.5 text-slate-200 italic">"{c.statement}"</p>

                    {c.rejection_reason && (
                      <div className="mt-1.5 text-[11px] text-rose-300 font-mono">
                        Rejection reason: {c.rejection_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 7: Human Investigator Notes */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-400" />
              6. Human Investigator Annotations ({notes.length})
            </h3>
            {notes.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-slate-500 italic">
                No human annotations attached to this investigation.
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"
                  >
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                      <span className="font-semibold text-slate-200">{n.author}</span>
                      <span className="font-mono">{new Date(n.created_at).toUTCString()}</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{n.note_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 8: Resolution & Governance Disclaimer */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <div className="p-3.5 rounded-lg bg-indigo-950/20 border border-indigo-500/20 text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-slate-200 block mb-1">
                Governance & Verification Integrity Notice:
              </strong>
              This investigation document was generated under deterministic state machine rules
              and HMAC cryptographic signature validation. AI reasoning provided by Gemini is
              subject to automated anti-hallucination claim verification against normalized evidence
              events. State transitions and authoritative verdicts remain strictly deterministic.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
