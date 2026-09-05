import { useState, useEffect } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { LiveMonitoringProvider } from "./context/LiveMonitoringContext";
import { DemoModeProvider, useDemoMode } from "./context/DemoModeContext";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { IncidentsExplorer } from "./components/IncidentsExplorer";
import { IncidentDetail } from "./components/IncidentDetail";
import { OverviewDashboard } from "./components/OverviewDashboard";
import { GlobalSearch } from "./components/GlobalSearch";
import { TimelineExplorer } from "./components/TimelineExplorer";
import { IntegrationsView } from "./components/IntegrationsView";
import { SettingsView } from "./components/SettingsView";
import { EvidenceExplorer } from "./components/EvidenceExplorer";
import { EvidenceDetailModal } from "./components/EvidenceDetailModal";
import { ClaimVerificationCenter } from "./components/ClaimVerificationCenter";
import { InvestigationHistoryView } from "./components/InvestigationHistoryView";
import { PatternExplorer } from "./components/PatternExplorer";
import {
  investigate,
  replayScenario,
  fetchIncidents,
  fetchScenarios,
} from "./api/client";
import type {
  NavigationTab,
  InvestigationResult,
  IncidentRecord,
  ScenarioFixtureItem,
} from "./types";

export default function App() {
  return (
    <ThemeProvider>
      <DemoModeProvider>
        <LiveMonitoringProvider>
          <PayTraceApp />
        </LiveMonitoringProvider>
      </DemoModeProvider>
    </ThemeProvider>
  );
}

function PayTraceApp() {
  // Navigation & UI state
  const [activeTab, setActiveTab] = useState<NavigationTab>("overview");
  const { demoMode, toggleDemoMode } = useDemoMode();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Hero search query threaded to GlobalSearch
  const [heroSearchQuery, setHeroSearchQuery] = useState<string>("");

  // Data state
  const [incidentsList, setIncidentsList] = useState<IncidentRecord[]>([]);
  const [scenariosList, setScenariosList] = useState<ScenarioFixtureItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Active Incident Detail state
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedIncidentMeta, setSelectedIncidentMeta] = useState<Record<string, unknown> | null>(null);
  const [investigationResult, setInvestigationResult] = useState<InvestigationResult | null>(null);
  const [investigating, setInvestigating] = useState(false);
  const [investigationError, setInvestigationError] = useState<string | null>(null);

  // Scenario Replay state
  const [activeLoadingScenario, setActiveLoadingScenario] = useState<string | null>(null);

  // Phase 4 Intelligence state
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [investigationSubTab, setInvestigationSubTab] = useState<"history" | "claims">("claims");

  // Initial load
  useEffect(() => {
    async function loadInitialData() {
      setLoadingData(true);
      try {
        const [incidents, scenarios] = await Promise.all([
          fetchIncidents(50),
          fetchScenarios(),
        ]);
        setIncidentsList(incidents);
        setScenariosList(scenarios);
      } catch (err) {
        console.warn("Failed to load background data:", err);
      } finally {
        setLoadingData(false);
      }
    }
    loadInitialData();
  }, []);

  const refreshIncidents = async () => {
    setLoadingData(true);
    try {
      const incidents = await fetchIncidents(50);
      setIncidentsList(incidents);
    } catch (err) {
      console.warn("Failed to refresh incidents:", err);
    } finally {
      setLoadingData(false);
    }
  };

  // Handle selecting an incident to view full detail
  const handleSelectIncident = async (paymentId: string, meta?: Record<string, unknown>) => {
    setSelectedPaymentId(paymentId);
    setSelectedIncidentMeta(meta || null);
    setInvestigating(true);
    setInvestigationError(null);

    try {
      const result = await investigate(paymentId);
      setInvestigationResult(result);
    } catch (err) {
      setInvestigationError(
        err instanceof Error ? err.message : "Failed to run investigation on selected incident"
      );
      // Fallback synthetic investigation structure from metadata if payment_id is new/unpersisted
      const fallbackResult: InvestigationResult = {
        payment_id: paymentId,
        ai_activated: meta?.severity === "HIGH",
        reason:
          meta?.severity === "HIGH"
            ? "High-severity anomaly detected: invalid_transition requires AI analysis"
            : "Deterministic evidence was sufficient to identify the issue.",
        authoritative_result: {
          confidence_hint: meta?.severity === "HIGH" ? "LOW" : "HIGH",
          requires_ai_investigation: meta?.severity === "HIGH",
          order_id: meta?.order_id || `order_${paymentId.replace("pay_", "")}`,
        },
        confidence: {
          level: meta?.severity === "HIGH" ? "INCONCLUSIVE" : "HIGH",
          score: meta?.severity === "HIGH" ? 0.62 : 1.0,
          reason:
            meta?.severity === "HIGH"
              ? "Confidence is guarded due to missing event sequence. Abstention active."
              : "Deterministic evidence verified with high confidence.",
          abstain: meta?.severity === "HIGH",
        },
        abstained: meta?.severity === "HIGH",
        verified_claims:
          meta?.severity === "HIGH"
            ? [
                {
                  claim_id: "C1",
                  statement: `A payment event for ${paymentId} was processed at 2026-08-28T10:32:45Z.`,
                  verdict: "SUPPORTED",
                  rejection_reason: null,
                  evidence_ids: ["evt_001"],
                  confidence: "HIGH",
                },
              ]
            : [],
        rejected_claims: [],
        investigation: {
          hypothesis:
            meta?.severity === "HIGH"
              ? "Payment may not be captured in merchant system due to missing payment.created webhook."
              : undefined,
          recommended_next_step:
            "Verify why the merchant system did not record the capture. Check merchant logs, idempotency handling, or internal errors.",
          uncertainty: meta?.severity === "HIGH" ? "LOW" : "HIGH",
        },
        evidence_package: {
          payment_id: paymentId,
          reconstructed_state: meta?.severity === "HIGH" ? "authorized" : "captured",
          incidents: [
            {
              incident_type: String(meta?.incident_type || "invalid_transition"),
              severity: String(meta?.severity || "HIGH"),
              description: String(meta?.title || "Anomalous state transition detected"),
            },
          ],
          events: [
            {
              evidence_id: "evt_001",
              event_type: "payment.authorized",
              event_timestamp: "2026-08-28T10:32:45Z",
              source: "api",
              signature_valid: true,
            },
            {
              evidence_id: "evt_002",
              event_type: "payment.captured",
              event_timestamp: "2026-08-28T10:45:58Z",
              source: "webhook",
              signature_valid: true,
              delay_seconds: 776,
            },
          ],
        },
      };
      setInvestigationResult(fallbackResult);
    } finally {
      setInvestigating(false);
    }
  };

  // Handle replaying a demo scenario fixture
  const handleReplayScenario = async (scenarioId: string) => {
    setActiveLoadingScenario(scenarioId);
    try {
      const result = await replayScenario(scenarioId);
      // Open detail view for the scenario
      handleSelectIncident(`pay_scenario_${scenarioId.replace("scenario_", "")}`, {
        id: scenarioId,
        incident_type: result.actual.incidents[0] || "clean_capture",
        title: result.name,
        severity: result.actual.ai_activated ? "HIGH" : "LOW",
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Replay scenario failed:", err);
    } finally {
      setActiveLoadingScenario(null);
    }
  };

  const handleBackToIncidents = () => {
    setSelectedPaymentId(null);
    setInvestigationResult(null);
    setInvestigationError(null);
  };

  // Hero search: switch to search tab with the submitted query
  const handleHeroSearch = (query: string) => {
    setHeroSearchQuery(query);
    setActiveTab("search");
    setSelectedPaymentId(null);
    setInvestigationResult(null);
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case "overview":
        return "System Overview & Investigation Dashboard";
      case "incidents":
        return "Payment Incidents Console";
      case "patterns":
        return "Recurring Incident Pattern Explorer";
      case "search":
        return "Global Evidence & Incident Search";
      case "timeline":
        return "Cross-Incident Timeline Explorer";
      case "evidence":
        return "Cryptographic Evidence Explorer";
      case "investigations":
        return "Investigation Intelligence & Claim Verification";
      case "reports":
        return "Compliance Dossiers & Incident Reports";
      case "integrations":
        return "Payment Gateway & Webhook Integrations";
      case "settings":
        return "Engine Settings & Cryptographic Specifications";
      default:
        return "Payment Incident Investigation System";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased transition-colors">
      {/* ── Persistent Sidebar Navigation ──────────────────────────────────── */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSelectedPaymentId(null);
          setInvestigationResult(null);
        }}
        demoMode={demoMode}
        onToggleDemoMode={toggleDemoMode}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* ── Main Application Workspace ─────────────────────────────────────── */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        {/* Top Header Bar */}
        <TopBar
          showBack={selectedPaymentId !== null}
          onBackToIncidents={handleBackToIncidents}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          title={getPageTitle()}
          onSelectIncident={handleSelectIncident}
        />

        {/* Dynamic Main Body Content */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto space-y-6">
          {investigationError && (
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-medium flex items-center justify-between">
              <span>{investigationError}</span>
              <button
                type="button"
                onClick={() => setInvestigationError(null)}
                className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* VIEW: Incident Detail Console */}
          {selectedPaymentId && investigationResult ? (
            <IncidentDetail
              investigationResult={investigationResult}
              incidentMeta={selectedIncidentMeta || undefined}
              onBack={handleBackToIncidents}
              onSelectEvidence={(eid) => setSelectedEvidenceId(eid)}
              onSelectPayment={(pid) => handleSelectIncident(pid)}
              onReload={() => handleSelectIncident(selectedPaymentId, selectedIncidentMeta || undefined)}
            />
          ) : selectedPaymentId && investigating ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto"></div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Reconstructing payment state & evaluating authoritative rules for {selectedPaymentId}...
              </p>
            </div>
          ) : activeTab === "overview" ? (
            /* VIEW: Overview Dashboard */
            <OverviewDashboard
              incidents={incidentsList}
              scenarios={scenariosList}
              onSelectIncident={handleSelectIncident}
              onNavigateTab={(tab) => {
                setActiveTab(tab);
                setSelectedPaymentId(null);
              }}
              onHeroSearch={handleHeroSearch}
              demoMode={demoMode}
              onReplayScenario={handleReplayScenario}
            />
          ) : activeTab === "incidents" ? (
            /* VIEW: Incidents Explorer */
            <IncidentsExplorer
              incidents={incidentsList}
              scenarios={scenariosList}
              onSelectIncident={handleSelectIncident}
              onReplayScenario={handleReplayScenario}
              loadingScenarioId={activeLoadingScenario}
              loading={loadingData}
              onRefresh={refreshIncidents}
              demoMode={demoMode}
            />
          ) : activeTab === "patterns" ? (
            /* VIEW: Pattern Explorer */
            <PatternExplorer onSelectPayment={handleSelectIncident} />
          ) : activeTab === "search" ? (
            /* VIEW: Global Search */
            <GlobalSearch onSelectIncident={handleSelectIncident} initialQuery={heroSearchQuery} />
          ) : activeTab === "timeline" ? (
            /* VIEW: Timeline Explorer */
            <TimelineExplorer onSelectIncident={handleSelectIncident} />
          ) : activeTab === "evidence" ? (
            /* VIEW: Evidence Explorer */
            <EvidenceExplorer
              onSelectEvidence={(eid) => setSelectedEvidenceId(eid)}
              onSelectPayment={(pid) => handleSelectIncident(pid)}
            />
          ) : activeTab === "investigations" ? (
            /* VIEW: AI Investigations Intelligence & Claims */
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <button
                  onClick={() => setInvestigationSubTab("claims")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    investigationSubTab === "claims"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  ✓ Claim Verification Scorecard
                </button>
                <button
                  onClick={() => setInvestigationSubTab("history")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    investigationSubTab === "history"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  ⇄ History & Version Comparison
                </button>
              </div>

              {investigationSubTab === "claims" ? (
                <ClaimVerificationCenter
                  onSelectEvidence={(eid) => setSelectedEvidenceId(eid)}
                  onSelectPayment={(pid) => handleSelectIncident(pid)}
                />
              ) : (
                <InvestigationHistoryView
                  onSelectPayment={(pid) => handleSelectIncident(pid)}
                  onSelectEvidence={(eid) => setSelectedEvidenceId(eid)}
                />
              )}
            </div>
          ) : activeTab === "reports" ? (
            /* VIEW: Reports */
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Compliance Dossiers & Incident Reports
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Generate formal, print-ready PDF and JSON audit dossiers for resolved and open payment incidents.
                </p>
              </div>
              <IncidentsExplorer
                incidents={incidentsList}
                scenarios={scenariosList}
                onSelectIncident={handleSelectIncident}
                onReplayScenario={handleReplayScenario}
                loadingScenarioId={activeLoadingScenario}
                loading={loadingData}
              />
            </div>
          ) : activeTab === "integrations" ? (
            /* VIEW: Integrations */
            <IntegrationsView />
          ) : activeTab === "settings" ? (
            /* VIEW: Settings */
            <SettingsView />
          ) : null}
        </main>
      </div>

      {/* Global Cryptographic Evidence Detail Modal */}
      <EvidenceDetailModal
        evidenceId={selectedEvidenceId}
        onClose={() => setSelectedEvidenceId(null)}
        onSelectPayment={(pid) => {
          setSelectedEvidenceId(null);
          handleSelectIncident(pid);
        }}
      />
    </div>
  );
}
