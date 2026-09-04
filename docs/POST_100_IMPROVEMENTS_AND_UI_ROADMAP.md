# PayTrace — Post-100% Improvements & UI Product Roadmap

> **Status:** FROZEN REFERENCE / PERSISTENT HANDOFF SPECIFICATION  
> **Target Audience:** Future Builders, Product Owners, UI/UX Engineers, and Auditors  
> **Core Principle:** Documentation and planning only — no code changes, no fake backend claims, no architecture dilution.

---

# 1. Purpose of This Specification

This document serves as the persistent memory and future development roadmap for **PayTrace**. It records:
1. **The current verified product baseline** (what is actually built, tested, and live today).
2. **The future visual and product UI direction** derived from the approved UI reference designs (Light and Dark theme specifications).
3. **A structured evaluation of future features** categorized by value, complexity, and architectural fit.
4. **A screen-by-screen backend and database mapping** to ensure future frontend development never introduces fabricated mock data.
5. **Architectural boundaries and "Do Not Build" guardrails** that protect PayTrace's core evidence-grounded thesis.

---

# 2. Core PayTrace Thesis & Philosophical Invariants

The foundational philosophy of PayTrace remains invariant:

```text
Deterministic Facts (Event Normalization & State Machine)
         │
         ▼
Deterministic Anomaly & Incident Detection
         │
         ▼
Deterministic AI Activation Gate (AI Never Decides If AI Runs)
         │
         ▼
Evidence-Bounded AI Investigation (Gemini Structured Hypotheses & Claims)
         │
         ▼
Deterministic Claim Verification (Every Claim Checked Against Evidence IDs)
         │
         ▼
Deterministic Confidence Engine & Explicit Abstention (INCONCLUSIVE)
         │
         ▼
Immutable Audit Trail & Concrete Remediation
```

### Non-Negotiable Invariants:
* **Facts first, AI second:** Deterministic code establishes payment state transitions and anomalies; AI interprets ambiguity only when triggered.
* **Verification always:** AI never makes unverified assertions. Claims must cite evidence IDs present in the evidence package.
* **Abstention when insufficient:** If evidence is missing, conflicting, or unverifiable, the system explicitly returns `INCONCLUSIVE` (`abstain: true`) rather than guessing.
* **No autonomous financial actions:** PayTrace is purely diagnostic; it will never initiate captures, refunds, transfers, or retries.

---

# 3. Current Product Baseline & Implementation Audit

*Source of Truth: Actual repository code, 58 passing pytest unit/integration tests, and live Render/Vercel deployments.*

| Capability / Component | Status | Code & Test Evidence | Description |
|---|---|---|---|
| **Deterministic State Reconstruction** | `IMPLEMENTED` | `state_reconstructor.py`, `state_machine.py`, `test_state_machine.py` (5 tests) | Reconstructs ordered state history (`created` → `authorized` → `captured` / `failed` / `refunded`) from verified event sequences. |
| **HMAC-SHA256 Signature Verification** | `IMPLEMENTED` | `webhook_verifier.py`, `test_verifier.py` (4 tests), `test_webhook_endpoint.py` | Cryptographically verifies Razorpay signatures on raw byte payloads before parsing. |
| **Untrusted / Tampered Webhook Handling** | `IMPLEMENTED` | `webhooks.py`, `test_webhook_endpoint.py` | Rejects tampered webhooks with HTTP 403; stores them with `signature_valid=False` for audit purposes only. |
| **Duplicate Webhook Deduplication** | `IMPLEMENTED` | `incident_detector.py`, `authoritative_rules.py`, `test_incident_detector.py` | Detects duplicate payloads; idempotently ignores replay while preserving high confidence. |
| **Delayed & Out-of-Order Detection** | `IMPLEMENTED` | `incident_detector.py`, `test_incident_detector.py` | Flags events delayed >5 minutes or arriving out of chronological lifecycle order. |
| **Invalid State Transition Detection** | `IMPLEMENTED` | `incident_detector.py`, `state_machine.py` | Detects invalid transitions (e.g. `authorized` arriving without prior `created`). |
| **Authoritative Source Rules** | `IMPLEMENTED` | `authoritative_rules.py`, `test_authoritative_rules.py` (6 tests) | Determines if an incident requires AI investigation; computes `confidence_hint` deterministically. |
| **Deterministic AI Activation Gate** | `IMPLEMENTED` | `ai_activation_gate.py`, `test_ai_activation_gate.py` (5 tests) | Pure Python decision gate. AI is skipped for deterministic incidents (clean capture, duplicate webhooks). |
| **Evidence Package Builder** | `IMPLEMENTED` | `evidence_package.py`, `test_evidence_package.py` (5 tests) | Strips raw payloads, generates unique evidence IDs (`evt_...`), and packages ordered events with ISO timestamps. |
| **Gemini Investigation Layer** | `IMPLEMENTED` | `gemini_investigator.py`, `test_gemini_failure_fallback.py` (2 tests) | Structured JSON output via `google-genai` SDK (`gemini-3.6-flash`). Returns hypothesis, claims, and recommended steps. |
| **Deterministic Claim Verifier** | `IMPLEMENTED` | `claim_verifier.py`, `test_claim_verifier.py` (5 tests) | Validates cited `evidence_ids` against the evidence package; issues `SUPPORTED`, `REJECTED`, or `UNVERIFIABLE` verdicts. |
| **Deterministic Confidence Engine** | `IMPLEMENTED` | `confidence_engine.py`, `test_confidence_engine.py` (5 tests) | Computes overall confidence (`HIGH`, `MEDIUM`, `LOW`, `INCONCLUSIVE`) based on claim verification and incident severity. |
| **Explicit Abstention Mechanism** | `IMPLEMENTED` | `confidence_engine.py`, `test_confidence_engine.py` | Returns `level: INCONCLUSIVE`, `abstain: true` when claims are rejected, confidence is low, or evidence is missing. |
| **AI Failure Fallback Handling** | `IMPLEMENTED` | `investigations.py`, `test_gemini_failure_fallback.py` | Gracefully falls back to `INCONCLUSIVE` (`abstain: true`) on API timeout or malformed JSON. |
| **Prompt Injection Defense** | `IMPLEMENTED` | `test_prompt_injection.py` (3 tests) | Untrusted payload text is framed as inert JSON data in the prompt; adversarial instructions are not executed. |
| **Fixture Scenario Replay** | `IMPLEMENTED` | `scenarios.py`, `scenarios/scenario_*.json`, `test_scenario_replay.py` (4 tests) | Evaluates 3 deterministic fixture scenarios against explicit ground-truth expectations in-memory. |
| **Audit Trail Persistence** | `IMPLEMENTED` | `models/audit_record.py`, `audit_trail.py` | Persists investigation inputs, AI raw outputs, verified claims, and confidence outcomes to Supabase PostgreSQL. |
| **Interactive Frontend Dashboard** | `IMPLEMENTED` | `frontend/src/` (React + TypeScript + Tailwind) | Two-tab interface: "Investigate" (live payment lookup) and "Demo Scenarios" (fixture replay). |
| **Ground-Truth Controlled Benchmark** | `PARTIALLY IMPLEMENTED` | `scenarios/`, `test_scenario_replay.py` | Fixture ground truths exist for 3 scenarios; comprehensive multi-scenario baseline benchmark runner is planned next. |
| **Incident Status / Resolution Notes** | `PLANNED` | `models/incident.py` (resolved field exists) | Schema has `resolved` boolean; UI note-taking and state transitions are planned for future phases. |
| **Timeline Explorer & Evidence Graph** | `PLANNED` | UI Mockup Phase | Advanced visual timeline and claim-evidence relationship graph planned for post-100% UI. |

---

# 4. UI Reference Analysis & Visual Product Direction

The provided reference designs establish a cohesive visual language for PayTrace across **Light** and **Dark** themes.

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  PAYTRACE                      ← Back to incidents                          [Theme Toggle] [Bell] [User] │
├───────────────────┬────────────────────────────────────────────────────────────┬───────────────────────┤
│ ❖ Overview        │  PAYMENT INCIDENT •                                        │  INCIDENT SUMMARY     │
│ ⚡ Incidents       │  Payment may not be captured in merchant system            │  Razorpay captured    │
│ ⌕ Search          │  [pay_1Pay7...] [order_1Pay7...] [Test Mode] [INCONCLUSIVE]│  merchant lookup miss │
│ ⏱ Timeline        ├────────────────────────────────────────────────────────────┼───────────────────────┤
│ ▤ Evidence        │  EVENT TIMELINE                             Group: [On/Off]│  CONFIDENCE BREAKDOWN │
│ ✦ AI Investigate  │  ✓ Order created                      10:32:45 AM [API]    │     ┌───────┐         │
│ ☷ Reports         │  ✓ Payment authorized                 10:33:02 AM [API]    │     │  62%  │ 65% Src │
│ ⚙ Settings        │  ▲ Webhook payment.captured delayed   10:45:58 AM [+12m56s]│     └───────┘ 50% Evd │
│                   │  ✓ Payment captured (Razorpay)        10:45:58 AM [Webhook]├───────────────────────┤
│ ───────────────── │  ✕ Merchant capture record not found  10:46:10 AM [Int-API]│  KEY EVIDENCE         │
│ 🎮 Demo Mode [On] │  [View full timeline →]                                    │  ✓ Razorpay capture   │
│ 👤 animesh@...    ├────────────────────────────────────────────────────────────┤  ✕ Merchant lookup    │
│                   │  AI INVESTIGATION [NOT ACTIVATED]   [Gate: SKIPPED]        │  ▲ 12m 56s delay      │
│                   │  Deterministic evidence was sufficient to identify issue.  ├───────────────────────┤
│                   ├────────────────────────────────────────────────────────────┤  AUDIT TRAIL          │
│                   │  NEXT STEPS                                                │  Incident created     │
│                   │  1. Verify why merchant system did not record capture.     │  28 Aug, 10:47 AM     │
│                   │  [ Add Note ]  [ ✓ Mark as Resolved ]                      │                       │
└───────────────────┴────────────────────────────────────────────────────────────┴───────────────────────┘
```

### 4.1 Key Visual & Layout Patterns Identified
1. **Three-Column Information Architecture:**
   * **Left Sidebar (Navigation & Controls):** Persistent access to product areas (Overview, Incidents, Search, Timeline, Evidence, AI Investigations, Reports, Integrations, Settings), with global Demo Mode toggle and user profile at the base.
   * **Main Center Workspace (Incident Deep-Dive):** Incident title, metadata pills, chronological Event Timeline, AI Activation Gate status card, and Actionable Next Steps.
   * **Right Context Panel (Evidence & Assurance):** Incident Summary, Confidence Breakdown donut gauge with component breakdown, Key Evidence documents, and Audit Trail history.
2. **Event Timeline Design:**
   * Nodes color-coded by event status: Green (Verified/Success), Amber (Warning/Delay), Red (Error/Missing).
   * Source tags (`[API]`, `[Webhook]`, `[Internal API]`).
   * Relative latency badges (e.g. `+12m 56s` for delayed deliveries).
   * Group-by-source toggle switch and expandable view.
3. **Confidence Breakdown Gauge:**
   * Donut chart displaying overall score (e.g., `62% Overall`).
   * Four constituent confidence factors:
     - Source consistency (e.g., 65%)
     - Evidence completeness (e.g., 50%)
     - Contradiction impact (e.g., 70%)
     - Recency (e.g., 80%)
   * Explanatory callout explaining the exact rationale for reduced confidence or abstention.
4. **AI Activation Transparency Card:**
   * Prominent gate indicator (`NOT ACTIVATED` / `ACTIVATED`).
   * Explicit gate result (`SKIPPED` / `TRIGGERED`).
   * Clear reason string explaining why deterministic rules bypassed or engaged AI.
5. **Theme Support:**
   * **Light Theme:** High-contrast, clean slate border cards, neutral grays with semantic accents.
   * **Dark Theme:** Dark slate/navy background (`#0B0F19`), subtle card borders (`#1E293B`), glowing semantic badges for high readability during operations.

---

# 5. Screen-by-Screen Data & Backend Mapping

To prevent creating "fake" UI data, every screen in the proposed visual direction is mapped to current backend capabilities:

| Screen / Component | Description | Data Readiness Category | Backend / Database Requirements |
|---|---|---|---|
| **Overview Dashboard** | High-level metrics: total webhooks, active incidents, AI invocation rate, verification pass rate. | `B` (Existing data, new frontend aggregation) | Aggregate counts from existing `normalized_events`, `incidents`, and `audit_records` tables via a new `GET /analytics/overview` endpoint. |
| **Incidents List** | Filterable table of all detected anomalies with payment IDs, severity badges, timestamps, and status. | `A` (Existing backend/API data) | Query existing `incidents` table joined with `payment_states`. Endpoint: `GET /incidents`. |
| **Incident Detail — Timeline** | Visual event graph showing ordered events, delays, signature status, and source tags. | `A` (Existing backend/API data) | Provided directly by `reconstruct_payment_state()` and `NormalizedEvent` records for a given `payment_id`. |
| **Incident Detail — AI Gate & Investigation** | Displays gate decision, reason, Gemini hypothesis, verified claims, and counter-evidence. | `A` (Existing backend/API data) | Provided directly by `POST /investigations/investigate` and stored in `AuditRecord`. |
| **Incident Detail — Confidence Breakdown** | Radial gauge with 4 sub-scores (source consistency, completeness, contradiction, recency). | `C` (New backend calculation logic) | Extend `confidence_engine.py` to return individual numeric factor scores alongside overall score. |
| **Incident Detail — Next Steps & Resolution** | Actionable developer recommendations, note-taking, and status resolution toggle. | `D` (New database schema work) | Add `resolution_notes` and `resolved_at` columns to `incidents` table. Add `POST /incidents/{id}/resolve`. |
| **Search View** | Global search across payment IDs, order IDs, event IDs, and incident descriptions. | `C` (New backend/API work) | Implement `GET /search?q={query}` querying `normalized_events` and `incidents` indexes. |
| **Timeline Explorer** | Cross-payment multi-timeline view comparing asynchronous delivery times and webhook latencies. | `B` (Existing data, new frontend aggregation) | Aggregate `NormalizedEvent` timestamps across payment sessions. |
| **Evidence Explorer** | Deep inspection of raw payloads, HMAC signatures, header metadata, and hashing proofs. | `A` (Existing backend/API data) | Query `WebhookEvent` raw payloads and signature hashes. |
| **Reports** | Exportable audit summaries and incident post-mortems for compliance and merchant support. | `C` (New backend/API work) | Endpoint `GET /reports/incident/{payment_id}/export` generating JSON/Markdown summaries. |
| **Integrations & Settings** | Webhook URL configuration, active signing secrets status, Gemini quota monitor, CORS origins. | `A` (Existing backend/API data) | Exposed via `GET /health` and settings diagnostic routes. |

*Categories:*  
* **A:** Supported by existing API/backend data.  
* **B:** Supported by existing data, requires new frontend aggregation/routing.  
* **C:** Requires new backend API endpoint/calculation.  
* **D:** Requires database schema migration/storage.  
* **E:** Future P2+ functionality.

---

# 6. Future Feature Evaluation

Every potential future capability is evaluated against the PayTrace core thesis.

### 6.1 Priority 1 (P1) — High Value After Buildathon Completion

#### Feature: Sub-Factor Confidence Breakdown
* **Priority:** `P1`
* **User Problem:** Users see an overall confidence score (e.g. 62% or LOW) but want to know which specific dimension (missing evidence, contradiction, delivery delay) caused the reduction.
* **PayTrace Thesis Benefit:** Strengthens deterministic confidence by making the mathematical deductions completely transparent.
* **Recommendation:** `KEEP`
* **User Value:** `HIGH` | **Implementation Complexity:** `LOW`
* **Existing Data/API Support:** Supported by `confidence_engine.py`.
* **Backend Requirements:** Update `compute_confidence()` to output sub-scores: `source_consistency`, `evidence_completeness`, `contradiction_impact`, `recency`.
* **Database Requirements:** Persist sub-scores in `AuditRecord`.
* **Security/Trust:** 100% deterministic math. Zero LLM involvement.
* **Architecture Risk:** Very low.

#### Feature: Incident Resolution & Note-Taking Workflow
* **Priority:** `P1`
* **User Problem:** Support engineers diagnosing an incident cannot record their findings or mark an incident as resolved within the dashboard.
* **PayTrace Thesis Benefit:** Captures human verification and resolution state without altering immutable deterministic audit records.
* **Recommendation:** `KEEP`
* **User Value:** `HIGH` | **Implementation Complexity:** `MEDIUM`
* **Existing Data/API Support:** `Incident` model already has `resolved: bool`.
* **Backend Requirements:** Add `POST /incidents/{id}/notes` and `PATCH /incidents/{id}/status`.
* **Database Requirements:** Add `IncidentNote` model (timestamp, author, note_text, incident_id).
* **Security/Trust:** Notes are isolated as human commentary and cannot alter evidence packages or state history.
* **Architecture Risk:** Low.

#### Feature: Evidence-to-Claim Graph Visualization
* **Priority:** `P1`
* **User Problem:** Reading raw claim JSON makes it difficult to quickly visualize which events directly support or refute an AI hypothesis.
* **PayTrace Thesis Benefit:** Directly demonstrates claim-level verification and highlights rejected/unverifiable claims visually.
* **Recommendation:** `KEEP`
* **User Value:** `VERY HIGH` | **Implementation Complexity:** `MEDIUM`
* **Existing Data/API Support:** `ClaimVerificationResult` already links `claim_id` to `evidence_ids` with `SUPPORTED` / `REJECTED` verdicts.
* **Backend Requirements:** None (existing API returns full claim verification structure).
* **Database Requirements:** None.
* **Security/Trust:** Visualizes existing deterministic verifier output.
* **Architecture Risk:** Low (pure frontend visualization).

#### Feature: Shareable Incident Investigation Export
* **Priority:** `P1`
* **User Problem:** Merchants and developers need to share an incident report with Razorpay Support or internal teams as a portable post-mortem.
* **PayTrace Thesis Benefit:** Spreads evidence-grounded diagnosis outside the web dashboard without leaking API credentials.
* **Recommendation:** `KEEP`
* **User Value:** `HIGH` | **Implementation Complexity:** `LOW`
* **Existing Data/API Support:** `AuditRecord` and `IncidentReport` contain full context.
* **Backend Requirements:** Add `GET /investigations/{payment_id}/export?format=markdown|json`.
* **Database Requirements:** None.
* **Security/Trust:** Sanitizes sensitive customer PII while preserving payment event hashes and timestamps.
* **Architecture Risk:** None.

#### Feature: Similar Incident Pattern Detection
* **Priority:** `P1`
* **User Problem:** When a merchant experiences a webhook outage, dozens of payments experience identical delayed or missing events.
* **PayTrace Thesis Benefit:** Deterministically clusters incidents by anomaly signature (e.g. `delayed_webhook` + `missing_created`) to show systemic failures.
* **Recommendation:** `KEEP`
* **User Value:** `HIGH` | **Implementation Complexity:** `MEDIUM`
* **Existing Data/API Support:** `Incident.incident_type` and `PaymentState.current_state` exist in Supabase.
* **Backend Requirements:** Endpoint `GET /incidents/similar?incident_type=...`.
* **Database Requirements:** SQL index on `(incident_type, created_at)`.
* **Security/Trust:** Pure deterministic SQL aggregation.
* **Architecture Risk:** Low.

---

### 6.2 Priority 2 (P2) — Future Advanced Capabilities

#### Feature: Live Webhook Streaming Timeline (WebSocket / SSE)
* **Priority:** `P2`
* **User Problem:** Developers testing in Razorpay Test Mode must manually refresh the dashboard to see events arrive.
* **PayTrace Thesis Benefit:** Demonstrates real-time deterministic normalization and instant incident detection.
* **Recommendation:** `MODIFY` (Implement via lightweight polling or Server-Sent Events rather than heavy WebSocket infrastructure).
* **User Value:** `MEDIUM` | **Implementation Complexity:** `MEDIUM`
* **Existing Data/API Support:** Existing REST polling routes.
* **Backend Requirements:** FastAPI SSE route `GET /events/stream`.
* **Database Requirements:** None.
* **Security/Trust:** Requires scoped authentication tokens.
* **Architecture Risk:** Medium (connection management on free hosting tiers).

#### Feature: Model Context Protocol (MCP) Server Integration
* **Priority:** `P2`
* **User Problem:** External AI coding assistants (like Antigravity or Claude Desktop) cannot directly query PayTrace's evidence graph to diagnose integration code.
* **PayTrace Thesis Benefit:** Exposes PayTrace's deterministic state reconstruction as structured tools to external agents without allowing external agents to mutate payment facts.
* **Recommendation:** `KEEP`
* **User Value:** `HIGH` | **Implementation Complexity:** `MEDIUM`
* **Existing Data/API Support:** All inspection endpoints (`/investigations/investigate`, `/scenarios/replay`, `/webhooks/events`).
* **Backend Requirements:** Implement a lightweight MCP server wrapper exposing tools: `reconstruct_payment`, `verify_claims`, `get_audit_trail`.
* **Database Requirements:** None.
* **Security/Trust:** Read-only tool execution. Zero write capabilities.
* **Architecture Risk:** Low if kept as a separate sidecar.

#### Feature: Natural Language Investigative Querying
* **Priority:** `P2`
* **User Problem:** Developers want to ask questions like *"Why did payment pay_123 get marked failed at 10:45?"*.
* **PayTrace Thesis Benefit:** Enhances UX if and only if answers are constrained to quote deterministic claim IDs and evidence records.
* **Recommendation:** `MODIFY` (Constrain LLM strictly to summarizing existing verified `AuditRecord` claims rather than generating open-ended opinions).
* **User Value:** `MEDIUM` | **Implementation Complexity:** `HIGH`
* **Existing Data/API Support:** `AuditRecord` history.
* **Backend Requirements:** Grounded Q&A endpoint querying existing audit packages.
* **Database Requirements:** None.
* **Security/Trust:** Must apply strict prompt boundaries to prevent hallucination.
* **Architecture Risk:** Medium.

---

### 6.3 Priority 3 / 4 (P3/P4) — Longer Term / Enterprise Workflows

#### Feature: Multi-Provider LLM Abstraction Layer
* **Priority:** `P3`
* **Recommendation:** `DEFER`
* **Rationale:** Google Gemini (`google-genai` SDK with `gemini-3.6-flash`) currently satisfies all requirements with sub-second latency and structured JSON output. Adding multiple LLM providers adds complexity without advancing the core evidence thesis.

#### Feature: Role-Based Access Control (RBAC) & Team Workspaces
* **Priority:** `P3`
* **Recommendation:** `DEFER`
* **Rationale:** Enterprise feature suitable for multi-merchant SaaS, but unnecessary for core diagnostic evaluation.

---

# 7. UI Implementation Matrix

| Screen / Feature Area | Existing API Support | Frontend Only | New Backend API | New DB Work | Priority | Implementation Notes |
|---|---|---|---|---|---|---|
| **Theme System (Light/Dark)** | Full | `Yes` | No | No | `P1` | CSS custom properties / Tailwind dark mode class mapping to reference designs. |
| **Navigation Sidebar** | Full | `Yes` | No | No | `P1` | Replace top tabs with persistent left sidebar; retain Demo Mode toggle at bottom. |
| **Incidents Table & Filters** | Partial | `No` | `Yes` | No | `P1` | Add filterable `GET /incidents` with severity, status, and date sorting. |
| **Polished Incident Detail** | Full | `Yes` | No | No | `P1` | Render 3-column layout matching reference mockup using existing `/investigations` data. |
| **Confidence Breakdown Gauge** | Partial | `No` | `Yes` | No | `P1` | Compute 4 constituent sub-scores in `confidence_engine.py` and display in donut chart. |
| **Evidence & Claim Graph** | Full | `Yes` | No | No | `P1` | Visualize verified vs rejected claims and linked evidence pills. |
| **Next Steps & Resolution Notes** | Partial | `No` | `Yes` | `Yes` | `P1` | Add `IncidentNote` schema and resolution endpoints. |
| **Search View** | Partial | `No` | `Yes` | No | `P2` | Fast index-backed lookup by payment ID, order ID, or event ID. |
| **Timeline Explorer** | Partial | `Yes` | No | No | `P2` | Multi-event comparative timeline with latency delta badges. |
| **Evidence Explorer** | Full | `Yes` | No | No | `P2` | Raw payload modal with HMAC verification inspector. |
| **Reports & Export** | Full | `No` | `Yes` | No | `P2` | Markdown / PDF post-mortem download generator. |
| **MCP Server Interface** | Full | `No` | `Yes` | No | `P2` | FastMCP read-only tool adapter for IDE agents. |
| **Live Webhook SSE Stream** | Partial | `No` | `Yes` | No | `P2` | Server-Sent Events stream for real-time Test Mode events. |
| **Integrations Diagnostic View** | Full | `Yes` | No | No | `P3` | Health, secret status, and CORS latency monitor. |

---

# 8. Recommended UI Build Order

To preserve functionality and prevent hollow/empty interfaces, future UI development must follow this phased sequence:

```text
PHASE 1: Core Shell & Incident Experience (P1 Foundation)
├── 1.1 Responsive Application Shell (Left Sidebar, Top Header, Dark/Light Theme Engine)
├── 1.2 Enhanced Incidents Explorer (Filterable Table with Severity Badges & Status)
└── 1.3 Polished Incident Detail View (Timeline, AI Gate Card, Confidence Donut, Audit Trail)

PHASE 2: Deep Evidence Inspection & Workflows (P1 Workflows)
├── 2.1 Interactive Event & Evidence Graph (Claim-to-Evidence Visual Links)
├── 2.2 Incident Resolution & Note-taking (Status Updates & Actionable Checklist)
└── 2.3 Shareable Report Export (Markdown/JSON Diagnostic Post-Mortem)

PHASE 3: Analytics & Cross-Payment Explorers (P2 Exploration)
├── 3.1 Overview Dashboard (Aggregate Incident Frequencies & Anomaly Rates)
├── 3.2 Global Search View (Fast Payment/Order/Event ID Lookup)
└── 3.3 Timeline & Webhook Latency Explorer (Asynchronous Delivery Analyzer)

PHASE 4: Extensibility & External Integrations (P2/P3 Extensibility)
├── 4.1 MCP Read-Only Diagnostic Server for External Agents
├── 4.2 Server-Sent Events (SSE) Live Webhook Delivery Stream
└── 4.3 Integrations & Webhook Secret Health Monitor
```

*Golden Rule: Never create navigation tabs that point to blank or placeholder mock screens. Unimplemented views must be omitted or clearly flagged as diagnostic tools.*

---

# 9. "Do Not Build" / Anti-Roadmap (Architectural Boundaries)

The following proposals are **EXPLICITLY REJECTED** to maintain PayTrace's architectural integrity:

| Prohibited Feature / Direction | Reason for Rejection |
|---|---|
| **Autonomous Financial Actions (Capture / Refund / Transfer / Retry)** | Violates primary thesis. PayTrace is strictly diagnostic. AI must never execute transactions. |
| **AI Modification of System Config / Webhook Secrets** | High security risk. Configuration must remain human-controlled. |
| **Fabricated Confidence Percentages or Fake AI Metrics** | Any confidence number must be mathematically calculated from verified claims and incident weights, never invented by an LLM. |
| **Generic Chatbot / "ChatGPT for Payments" Interface** | PayTrace is an evidence reconstruction pipeline, not a generic conversational wrapper. |
| **Heavy Vector Database / RAG Pipeline** | Payment state reconstruction requires exact transaction-graph traversal, not probabilistic semantic similarity search. |
| **Multi-Agent Orchestration Swarms** | Introduces nondeterminism, latency, and fragility to a task that requires deterministic verification. |
| **Kafka / Kubernetes / Distributed Queuing** | Massive operational overhead unjustified by payment incident diagnostic workloads. |
| **Custom Machine Learning Model Training** | Deterministic state machine rules provide 100% precision with zero training data requirements. |
| **Real Money Transaction Execution** | Strict boundary: Razorpay Test Mode only. Zero real-money movement. |

---

# 10. Future Development & Safety Invariants

Future developers and automated agents must adhere to these 15 rules:

1. **Deterministic Primacy:** State machine transitions, duplicate detection, and anomaly logging must always run in deterministic code before AI is invoked.
2. **AI Gate Invariance:** AI Activation Gate decisions must remain deterministic (`if/else` on authoritative findings), never delegated to an LLM.
3. **No Unverified AI Claims:** Every assertion produced by Gemini must be checked by `claim_verifier.py` against cited evidence package IDs.
4. **Enforced Abstention:** If cited evidence is missing or claims are rejected, the system must return `INCONCLUSIVE` (`abstain: true`). It must never guess.
5. **No AI Mutation of Facts:** Gemini's output is an unverified hypothesis until checked; it must never directly overwrite `PaymentState.current_state`.
6. **Untrusted Data Isolation:** Webhook payloads and merchant error messages must be treated as inert data strings in prompts, never as instructions.
7. **Zero Secrets in Source Control:** `.env` files, API keys, database connection strings, and webhook secrets must never be committed.
8. **In-Process Test Integrity:** All core unit and integration tests must run in-process via FastAPI's `TestClient` without external server dependencies.
9. **Zero Fake UI Data:** All visual dashboard metrics and status pills must map to real database entities or calculated backend outcomes.
10. **Single Source of Truth:** `PROJECT_CONTEXT.md` and `DECISIONS.md` remain frozen. New decisions must be documented through the formal review process.
11. **Cryptographic Webhook Verification:** HMAC-SHA256 signature verification must always run before webhook normalization and storage.
12. **Idempotency Preservation:** Duplicate webhooks must be deduplicated without triggering redundant AI investigations or corrupting state.
13. **Sub-Factor Transparency:** Any numerical confidence breakdown presented in the UI must directly reflect the underlying mathematical sub-metrics.
14. **Test Mode Constraint:** Keep all live demonstrations and integrations strictly within Razorpay Test Mode.
15. **Continuous Roadmap Alignment:** If product requirements change, update this roadmap file before writing code.

---

# 11. Top 5 Highest-Value Next Features (Post-Buildathon)

1. **Sub-Factor Confidence Breakdown Card:**
   * *Why:* Directly mirrors the approved visual reference design; makes PayTrace's mathematical confidence calculation completely transparent to judges and developers.
2. **Incident Detail 3-Column Visual Redesign (Light & Dark Theme):**
   * *Why:* Elevates PayTrace from a developer prototype to a polished enterprise-grade investigation console matching the provided UI mockups.
3. **Evidence-to-Claim Relationship Graph:**
   * *Why:* Visually proves claim-level verification by drawing clear visual lines between Gemini hypotheses and concrete event timestamps/IDs.
4. **Incident Resolution & Note-Taking Workflow:**
   * *Why:* Transforms PayTrace from a passive viewer into an active operational workspace where support engineers record fixes.
5. **Model Context Protocol (MCP) Diagnostic Server:**
   * *Why:* Enables external AI agents in IDEs (Antigravity, Cursor, VSCode) to query PayTrace's deterministic reconstruction engine via standard tool protocols.

---

# 12. Final Future UI Vision

The finished PayTrace experience should feel like a **flight-data flight recorder and incident courtroom for payment systems**:
* When a developer opens an incident, they are not greeted by a generic chat interface.
* They see an immediate, authoritative timeline of verified cryptographic facts.
* They see exactly why an anomaly occurred (delayed delivery, out-of-order sequence, missing event).
* If AI was needed, they see the exact hypothesis formed, accompanied by an explicit verification scorecard showing every claim verified against event IDs.
* If evidence was insufficient, they see a prominent amber `INCONCLUSIVE` badge with a clear explanation of what evidence is missing.
* It inspires complete trust because **every claim is backed by proof, every fact is deterministic, and the system knows when to stop.**
