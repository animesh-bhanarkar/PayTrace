# PROJECT_STATE.md — PayTrace

**Last updated:** Day 5 Complete — Scenario Replay & Frontend Dashboard Implemented & Verified
**Updated by:** Antigravity — Scenario replay engine, frontend dashboard, demo scenarios mode, 4 pytest tests passing, npm run build zero errors
**Project:** PayTrace
**Program:** Razorpay AI Buildathon 2026
**Track:** Open Track
**Deadline:** September 5, 2026
**Time Remaining:** 6 days
**Primary Builder:** Antigravity
**Product Owner / Final Decision Maker:** User
**Architecture / Research / Evaluation:** GPT
**Implementation Strategy / Prompt Engineering / Debugging:** Claude

---

# 1. CURRENT PHASE

**Day 5 Complete — Scenario Replay & Frontend Dashboard Verified**

The PayTrace product and architecture are frozen and approved in:

`PROJECT_CONTEXT.md`

This file tracks the actual implementation state.

The architecture has been finalized as:

```text
Vercel
   ↓
React Frontend
   ↓ HTTPS + CORS
Render
   ↓
FastAPI Backend
   ↓
Supabase PostgreSQL
```

with:

```text
Gemini API
Razorpay Test Mode
```

as external services.

This file must describe what has actually been implemented.

It must NOT be used to silently redesign the architecture.

---

# 2. SOURCE-OF-TRUTH HIERARCHY

The actual implementation hierarchy is:

```text
Actual Code
    ↓
Tests
    ↓
Git History
    ↓
PROJECT_STATE.md
```

If `PROJECT_STATE.md` says something is complete but the implementation or tests show otherwise:

> **The implementation wins.**

`PROJECT_STATE.md` must then be corrected.

A task must never be marked complete merely because:

* code was written
* a file exists
* deployment was attempted
* an API was configured

Completion requires appropriate implementation and testing.

---

# 3. PROJECT STATE GOVERNANCE

## PROJECT_CONTEXT.md

**FROZEN / READ-ONLY for Antigravity.**

Antigravity may read it but must not modify it.

Any architecture change requires:

1. GPT review
2. Claude review
3. Product Owner approval

No silent architecture changes.

The current frozen architecture is:

```text
Frontend:
Vercel

Backend:
Render

Database:
Supabase PostgreSQL

ORM:
SQLAlchemy

AI:
Gemini

Payment:
Razorpay Test Mode
```

---

## PROJECT_STATE.md

Antigravity may update this file to reflect actual implementation progress.

A task must not be marked complete unless:

```text
Implementation
+
Relevant tests
+
Verification
```

have been completed.

---

## BUILD_LOG.md

Records genuine engineering problems, debugging, fixes, and lessons learned.

Recommended format:

```text
Problem:
Observed behavior:
Root cause:
Investigation:
Fix:
Test:
Result:
Engineering lesson:
```

Do not manufacture failures.

---

## DECISIONS.md

Records important implementation decisions and their rationale.

It must not be used to override the frozen architecture without the required review process.

---

# 4. COMPLETED

* [x] Initial repository structure established (`backend/`, `frontend/`, `tests/`, `scenarios/`, `docs/`)
* [x] `.gitignore` configured to ignore secrets (`.env`), Python caches, Node modules, build artifacts
* [x] `.env.example` created listing required variables without values
* [x] FastAPI backend application created with working `/health`, `/`, `/db/probe`, and `/db/probes` endpoints
* [x] Automated test suite initialized with pytest passing all unit tests
* [x] React + TypeScript + Tailwind CSS frontend application created and verified building
* [x] Supabase PostgreSQL connected via SQLAlchemy with live verified table creation, persistence, and retrieval
* [x] Render Free Web Service deployed with public HTTPS URL (`https://paytrace-backend-ys0y.onrender.com`)
* [x] Live end-to-end backend verification completed against Render + Supabase (observed cold start: 1291ms, Render-to-Supabase latency: 366-370ms)
* [x] Day 2, Step 1: NormalizedEvent and PaymentState SQLAlchemy models defined and schema applied to Supabase PostgreSQL
* [x] Day 2, Step 1: Automated live test (`tests/test_normalized_event_model.py`) verified against live Supabase PostgreSQL (round-trip insert, retrieve, cleanup)
* [x] Day 2, Step 2: Event Parser created (`parse_webhook_to_normalized_event`) handling graceful field extraction.
* [x] Day 2, Step 2: Deterministic State Machine created (`PaymentStateMachine`) handling transitions.
* [x] Day 2, Step 2: State Reconstructor created (`reconstruct_payment_state`) producing ordered history.
* [x] Day 2, Step 2: 5 unit tests passed successfully.
* [x] Day 2, Step 3: Incident Detector created handling 7 core anomaly types.
* [x] Day 2, Step 3: 7 unit tests passed successfully for incident detector.
* [x] Day 2, Step 3: Webhook pipeline updated to normalize events, run state machine, detect incidents, and return `incidents_detected` without modifying verification logic.
* [x] Day 2, Step 4: `Incident` SQLAlchemy model added and schema applied to Supabase PostgreSQL.
* [x] Day 2, Step 4: `authoritative_rules.py` created — deterministic confidence and AI-gate logic.
* [x] Day 2, Step 4: Incidents persisted to DB per webhook event; `confidence_hint` and `requires_ai_investigation` returned in response.
* [x] Day 2, Step 4: 5 unit tests (authoritative rules) + 2 live Supabase tests (incident persistence) all passed.
* [x] Day 3: Deterministic AI Activation Gate created (`should_activate_ai`)
* [x] Day 3: Evidence Package builder created (`build_evidence_package`)
* [x] Day 3: Gemini Investigator created (`investigate`) with structured JSON schema output
* [x] Day 3: `/investigations/investigate` endpoint added and registered
* [x] Day 3: 10 unit tests for activation gate and evidence package all passed
* [x] Day 4: Claim Verifier created (`verify_claims`) with deterministic verification against evidence package
* [x] Day 4: Confidence Engine created (`compute_confidence`) with deterministic scoring and abstention
* [x] Day 4: Audit Trail created (`AuditRecord` model + `build_audit_entry`)
* [x] Day 4: 10 unit tests for claim verifier and confidence engine all passed
* [x] Day 5: Scenario Replay Foundation created (`scenarios.py` + `POST /scenarios/replay`) with in-memory pipeline
* [x] Day 5: 3 scenario fixtures (`scenario_01_clean_capture.json`, `scenario_02_missing_created.json`, `scenario_03_duplicate_webhook.json`) and 4 passing pytest tests (`test_scenario_replay.py`)
* [x] Day 5: Frontend Dashboard implemented with two tabs: "Investigate" and "Demo Scenarios"
* [x] Day 5: Frontend components created (`ConfidenceBadge`, `IncidentBadge`, `EventTimeline`, `ClaimsPanel`)
* [x] Day 5: Full production build (`npm run build`) passing with zero TypeScript errors

---

# 5. IN PROGRESS

Day 5 complete — Ready for final deployment verification & demo recording.

---

# 6. BLOCKED

None.

---

# 7. CURRENT KNOWN BUGS

None.

---

# 8. LAST COMPLETED TASK

Day 5: Backend scenario replay engine and frontend dashboard with live investigation and demo scenarios mode. 4 pytest tests passing, `npm run build` compiled cleanly with zero errors.

---

# 9. FINAL HOSTING ARCHITECTURE — LOCKED

## Frontend

**Vercel**

Responsibilities:

* React application
* TypeScript
* Tailwind CSS
* dashboard
* incident visualization
* evidence timeline
* investigation results

---

## Backend

**Render Free Web Service**

Responsibilities:

* FastAPI
* webhook endpoint
* signature verification
* event normalization
* payment-state reconstruction
* incident detection
* evidence packaging
* AI Activation Gate
* Gemini integration
* claim verification
* confidence engine
* audit trail
* API endpoints

---

## Database

**Supabase PostgreSQL**

Responsibilities:

* normalized payment events
* webhook records
* incidents
* investigation records
* audit information
* scenario/demo persistence where required

ORM:

```text
SQLAlchemy
```

---

## External Services

```text
Razorpay Test Mode
Gemini API
```

---

## FINAL DEPLOYMENT ARCHITECTURE

```text
                         USER / JUDGE
                              |
                              v
                       Vercel Frontend
                    React + TypeScript
                         + Tailwind
                              |
                         HTTPS + CORS
                              |
                              v
                       Render Backend
                            FastAPI
                              |
                         SQLAlchemy
                              |
                              v
                    Supabase PostgreSQL
                              |
                    +---------+---------+
                    |                   |
                    v                   v
                Gemini API       Razorpay Test Mode
```

---

# 10. HOSTING DECISION — LOCKED

## Render

The selected backend host is:

> **Render Free Web Service**

Render provides:

* public HTTPS
* FastAPI support
* environment variables
* straightforward deployment
* publicly reachable webhook endpoint

### Known Render limitation

Render's free tier may experience:

> **cold starts after inactivity**

This is an accepted limitation.

The project must account for it through:

* reliable health endpoint
* allowing startup latency
* deployment verification
* fixture/demo mode
* avoiding dependence on a live request arriving at a precise moment

A Render cold start must not be treated as an architectural failure.

---

# 11. FLY.IO — REJECTED

Fly.io was previously considered.

It is no longer part of the PayTrace architecture.

Reason:

> The required account/deployment setup creates a payment-card verification requirement that is not suitable for the current project setup.

Therefore:

```text
Fly.io
   ↓
REJECTED
```

Do not deploy PayTrace to Fly.io.

Do not redesign the backend around Fly.io.

The approved backend platform is:

> **Render**

---

# 12. DATABASE DECISION — LOCKED

## Production

```text
Supabase PostgreSQL
```

ORM:

```text
SQLAlchemy
```

Production database environment variable:

```text
DATABASE_URL
```

---

# 13. SQLITE STATUS

SQLite is:

> **NOT the production database.**

It may be used locally or in isolated testing if technically useful.

It must not be used as the deployed production persistence layer.

The production path is:

```text
FastAPI
   ↓
SQLAlchemy
   ↓
Supabase PostgreSQL
```

Do not implement a production SQLite file merely because local development is easier.

# 13A. POSTGRESQL-FIRST DEVELOPMENT REQUIREMENT

- [x] Supabase PostgreSQL is connected early on Day 1.
- [x] SQLAlchemy models are validated against PostgreSQL before the database layer is considered complete.
- [x] Local SQLite may be used only as a convenience for isolated development/testing.
- [x] Production schema assumptions remain PostgreSQL-compatible.
- [x] Database development is not performed entirely against SQLite before PostgreSQL validation.
- [x] Database migration mechanism selected as an implementation detail compatible with SQLAlchemy + Supabase PostgreSQL.

---

# 14. SUPABASE FREE-TIER CONSIDERATIONS

Supabase is being used within its free-tier constraints.

The implementation should avoid:

* unnecessary database writes
* unnecessary background jobs
* unnecessary large datasets
* unnecessary infrastructure
* unnecessary database services

The Buildathon workload is expected to remain small enough for the selected tier.

The project should verify connectivity and persistence early.

---

# 15. VERCEL FRONTEND

The frontend deployment target is:

> **Vercel**

Required:

* React application builds successfully
* frontend is publicly reachable
* frontend can call Render API
* CORS is correctly configured
* API response is successfully displayed

---

# 16. CORS

The frontend/backend deployment model is:

```text
Vercel
   ↓
HTTPS
   ↓
Render FastAPI
```

FastAPI must configure CORS to allow the deployed Vercel frontend origin.

Production configuration should avoid unnecessary wildcard origins.

The actual deployed frontend origin must be configured through environment/deployment configuration where practical.

---

# 17. DAY 1 — FOUNDATION + DEPLOYMENT + REAL WEBHOOK

Day 1 goal:

> **Establish the complete public infrastructure path and successfully receive a real Razorpay Test Mode webhook into Supabase PostgreSQL.**

---

## Repository

* [x] GitHub repository created
* [ ] Repository is public
* [x] Initial project structure
* [x] `.gitignore`
* [x] `.env.example`
* [x] No secrets committed

---

## Backend

* [x] FastAPI skeleton
* [x] Health endpoint
* [x] Environment configuration
* [x] SQLAlchemy setup
* [x] PostgreSQL configuration
* [x] Supabase connection (live verified against Supabase PostgreSQL)
* [x] Database initialization/migration strategy
* [x] Basic API endpoint

---

## Frontend

* [x] React
* [x] TypeScript
* [x] Tailwind CSS
* [x] Basic dashboard shell
* [x] API configuration (VITE_API_BASE_URL configured with production Render fallback)
* [x] Render API connectivity (confirmed live on https://pay-trace-nine.vercel.app)

---

## Render

* [x] Render account/project configured
* [x] FastAPI deployed (`https://paytrace-backend-ys0y.onrender.com`)
* [x] Public HTTPS endpoint confirmed
* [x] Health endpoint confirmed (returns HTTP 200, `database.connected = true`)
* [x] Environment variables configured (`DATABASE_URL`, `ALLOWED_ORIGINS`)
* [x] Supabase connection confirmed (366-370ms live query latency)
* [x] Cold-start latency observed and recorded (1291ms)

---

## Vercel

* [x] Vercel project configured (`pay-trace-nine.vercel.app`)
* [x] Frontend deployed
* [x] Public frontend URL confirmed (`https://pay-trace-nine.vercel.app`)
* [x] Render API URL configured (`https://paytrace-backend-ys0y.onrender.com`)
* [x] Frontend → backend request confirmed (live browser observed: `Status: paytrace-backend (ok)`)
* [x] CORS confirmed (explicit origin `https://pay-trace-nine.vercel.app` allowed, preflight passing)

---

## Supabase

* [x] Supabase project configured (`ap-northeast-2` region)
* [x] PostgreSQL database available
* [x] Database URL configured securely via environment variables
* [x] SQLAlchemy successfully connects
* [x] Test record can be persisted (`SystemProbe` created and committed live)
* [x] Test record can be retrieved (`SystemProbe` retrieved live both directly and via Render API)

---

## Razorpay

* [x] Razorpay Test Mode credentials configured
* [x] Razorpay webhook configured
* [x] Public Render webhook endpoint configured
* [x] Webhook signature verification implemented
* [x] First real Razorpay Test Mode webhook received
* [x] Signature verified
* [x] Event normalized
* [x] Event persisted to Supabase PostgreSQL

---

# 18. DAY 1 ACCEPTANCE CRITERION

Day 1 is NOT complete until this path works:

```text
Razorpay Test Mode
       ↓
Webhook
       ↓
Public Render HTTPS Endpoint
       ↓
Signature Verification
       ↓
Event Normalization
       ↓
Supabase PostgreSQL
       ↓
Stored Event
```

**STATUS: MET END-TO-END**
Day 1's full backend acceptance condition is now genuinely met. The end-to-end path (Razorpay Test Mode → public Render endpoint → signature verification → Supabase PostgreSQL persistence) has been successfully executed using real Razorpay-originated events (see record IDs 8-13), distinct from all local simulations.

A deployed backend alone does NOT satisfy Day 1.

A webhook endpoint that receives requests but does not verify signatures and persist the event does NOT satisfy Day 1.

---

# 19. DAY 1 FRONTEND ACCEPTANCE CRITERION

The following path must also work:

```text
Browser
   ↓
Vercel
   ↓
Render FastAPI
   ↓
CORS
   ↓
Successful API response
   ↓
Frontend displays response
```

Both Day 1 paths must work:

```text
Razorpay → Render → Supabase
```

and:

```text
Vercel → Render
```

**STATUS: MET END-TO-END**
Both Day 1 core paths are now genuinely met and verified live:
1. `Razorpay → Render → Supabase`: Confirmed with real Razorpay Test Mode webhooks (records 8-13), cryptographic signature verification, and PostgreSQL persistence.
2. `Vercel → Render`: Confirmed live on `https://pay-trace-nine.vercel.app/` connecting to `https://paytrace-backend-ys0y.onrender.com/health`, displaying `Status: paytrace-backend (ok)` with clean console and explicit CORS origin scoping.

**DAY 1 FULL ACCEPTANCE CONDITION IS COMPLETELY MET.**

---

# 20. DAY 1 DEPLOYMENT FAILURE FALLBACK

If live Razorpay setup takes longer than expected:

* continue backend development locally
* use controlled webhook fixtures
* continue Supabase integration
* continue frontend/backend testing

However:

> The real Razorpay webhook acceptance criterion must eventually be completed before Day 1 is considered complete.

Do not mark the real webhook requirement complete using a fixture.

### Development Continuity Rule

A delayed or temporarily unavailable Razorpay webhook must not unnecessarily stop unrelated implementation.

Antigravity may continue with fixture-based development and testing while the real webhook path is being resolved.

The real webhook requirement remains mandatory for Day 1 completion and must never be replaced by a fixture for acceptance purposes.

---

# 21. DAY 2 — PAYMENT INTELLIGENCE

Tasks:

* [x] Normalized event schema
* [x] Event parser
* [x] Event timestamp
* [x] Ingestion timestamp
* [x] Deterministic state machine
* [x] Authoritative-source rules
* [x] Duplicate detection
* [x] Delayed event detection
* [x] Out-of-order event handling
* [x] Contradiction detection
* [x] Incident creation
* [ ] Scenario replay foundation
* [ ] Demo Mode foundation
* [ ] Custom timeline component
* [x] Unit tests

---

## DAY 2 ACCEPTANCE CRITERION

PayTrace can:

> reconstruct expected payment state and detect core incident conditions without using an LLM.

The deterministic layer must work independently of Gemini.

---

# 22. AUTHORITATIVE SOURCE STATE

The implementation must preserve:

```text
Razorpay API
→ payment / financial truth

Razorpay webhook
→ delivery / event observation

Merchant application record
→ merchant-system belief / processing state
```

The system must not allow merchant-side observations to silently override Razorpay payment state.

---

# 23. EVENT TIMESTAMP REQUIREMENT

The normalized event representation must distinguish:

```text
event_timestamp
```

from:

```text
ingestion_timestamp
```

This distinction is required for:

* delayed webhook detection
* out-of-order handling
* event-order analysis
* timeline reconstruction

---

# 24. DAY 3 — AI INVESTIGATION

Tasks:

* [ ] Deterministic AI Activation Gate
* [ ] Known Razorpay error lookup table
* [ ] Evidence package builder
* [ ] Gemini API integration
* [ ] Single Gemini model-call function
* [ ] Structured/schema-enforced output
* [ ] AI Investigator
* [ ] Atomic claims
* [ ] Evidence IDs
* [ ] Counter-evidence IDs
* [ ] Recommended next investigation step
* [ ] Explicit uncertainty
* [ ] Gemini API quota/availability verified

---

# 25. AI ACTIVATION ACCEPTANCE CRITERION

Simple deterministic case:

```text
Known documented error
        ↓
Sufficient evidence
        ↓
No contradiction
        ↓
AI SKIPPED
```

Complex case:

```text
Ambiguous / multi-signal incident
        ↓
Evidence package
        ↓
AI ACTIVATED
        ↓
Structured investigation
```

The LLM must never decide whether it should itself be activated.

---

# 26. DAY 4 — TRUST / SAFETY

Tasks:

* [ ] Deterministic Claim Verifier
* [ ] Evidence ID validation
* [ ] Evidence ownership validation
* [ ] Field/value support validation
* [ ] Timestamp validation
* [ ] Authoritative-fact contradiction checks
* [ ] Deterministic Confidence Engine
* [ ] HIGH
* [ ] MEDIUM
* [ ] LOW
* [ ] INCONCLUSIVE
* [ ] Abstention path
* [ ] Missing-evidence reporting
* [ ] Prompt-injection handling
* [ ] Untrusted-data handling
* [ ] Gemini-unavailable fallback
* [ ] Audit trail
* [ ] Safety tests

---

# 27. DAY 4 ACCEPTANCE CRITERION

PayTrace must:

1. Reject unsupported AI claims.
2. Produce deterministic confidence.
3. Abstain when critical evidence is insufficient.
4. Continue operating safely when Gemini is unavailable.
5. Never interpret evidence content as system instructions.

---

# 28. CLAIM VERIFIER STATE

The verifier must check:

```text
Evidence ID exists
        ↓
Evidence belongs to package
        ↓
Relevant field/value supports claim
        ↓
Timestamp/context valid
        ↓
No authoritative contradiction
        ↓
Claim accepted
```

If any critical verification requirement fails:

```text
Claim rejected
```

---

# 29. CONFIDENCE ENGINE

Confidence is deterministic.

The LLM does NOT choose the final confidence.

Possible results:

```text
HIGH
MEDIUM
LOW
INCONCLUSIVE
```

---

# 30. HIGH

Required:

* required evidence exists
* critical claims verified
* authoritative facts support conclusion
* no unresolved critical contradiction

---

# 31. MEDIUM

Required:

* main hypothesis supported
* critical claims verified
* limited non-critical uncertainty remains
* contradictions are resolvable

---

# 32. LOW

Required:

* plausible hypothesis exists
* minimum required evidence exists
* evidence is insufficient for MEDIUM/HIGH
* remaining uncertainty is non-critical

LOW must not simply mean:

> "Everything that isn't HIGH."

It must have explicit deterministic conditions.

---

# 33. INCONCLUSIVE

Use when:

* critical evidence is missing
* critical contradiction cannot be resolved
* competing explanations cannot safely be distinguished
* no sufficiently supported hypothesis exists

INCONCLUSIVE is a valid successful outcome.

---

# 34. ABSTENTION

Expected behavior:

```text
Critical evidence missing
        ↓
No safe conclusion
        ↓
INCONCLUSIVE
        ↓
Missing evidence identified
        ↓
Next evidence to investigate identified
```

The system must not force a diagnosis.

---

# 35. PROMPT INJECTION / UNTRUSTED DATA

Minimum tests:

* [ ] Malicious log text
* [ ] Instruction-like webhook metadata
* [ ] Fabricated evidence
* [ ] Contradictory evidence
* [ ] Unsupported AI claims
* [ ] Missing evidence

Expected behavior:

> Evidence is treated as data, not instructions.

---

# 36. GEMINI FAILURE HANDLING

Required behavior:

```text
Incident
   ↓
AI Activation Gate
   ↓
Complex case
   ↓
Gemini unavailable
   ↓
Deterministic facts remain available
   ↓
No unsupported diagnosis
   ↓
Graceful fallback
   ↓
Audit record
```

Test:

* [ ] Gemini timeout
* [ ] Gemini API failure
* [ ] Invalid structured response
* [ ] Quota/unavailability path

### Required State Distinction

Gemini failure must not automatically produce an evidence-based `INCONCLUSIVE` result.

The implementation must distinguish:

```text
Evidence insufficient
→ INCONCLUSIVE

Gemini unavailable
→ AI UNAVAILABLE / deterministic fallback
```

---

# 37. AUDIT TRAIL

The investigation path should record:

```text
Input
 ↓
Evidence
 ↓
Detected Facts
 ↓
AI Activation Decision
 ↓
AI Hypothesis
 ↓
Claims
 ↓
Verification Results
 ↓
Confidence
 ↓
Final Output
 ↓
Outcome
```

The audit trail must also record:

* AI unavailable
* verifier rejection
* abstention
* missing evidence
* relevant failure states

---

# 38. DAY 5 — EVALUATION

## Priority scenarios

* [ ] PT-DEMO-001 — Duplicate webhook
* [ ] PT-DEMO-002 — Delayed webhook
* [ ] PT-DEMO-003 — Out-of-order event
* [ ] PT-DEMO-004 — Payment state mismatch
* [ ] PT-DEMO-005 — Webhook processing failure
* [ ] PT-DEMO-006 — Signature verification failure
* [ ] PT-DEMO-007 — Missing/incomplete evidence
* [ ] PT-DEMO-008 — Simple documented error
* [ ] PT-DEMO-009 — Untrusted evidence / prompt injection

Target:

> **15–30 meaningful cases**

Do not inflate scenario count with superficial variants.

---

# 39. SCENARIO REPLAY ENGINE

The replay system must provide:

```text
Scenario Definition
       ↓
Replay
       ↓
PayTrace
       ↓
Predicted Diagnosis
       ↓
Known Ground Truth
       ↓
Evaluation Metrics
```

It provides:

* reproducibility
* regression testing
* benchmark automation
* demo reliability
* known ground truth

---

# 40. DEMO MODE

Demo Mode is mandatory.

The demo must operate without:

* live Razorpay traffic
* live transaction timing
* Gemini availability
* manual database preparation

The fixture/replay system is the ultimate demo fallback.

---

# 41. BASELINE A

## Rules-only

Use:

```text
Deterministic state reconstruction
+
Deterministic incident detection
+
No LLM
```

Purpose:

> Measure what can be solved without AI.

---

# 42. BASELINE B1

## Raw LLM + same evidence package

Give the raw LLM the same structured evidence package used by PayTrace.

Purpose:

> Measure the value of PayTrace's verification, confidence and abstention mechanisms.

This is the primary AI comparison.

---

# 43. BASELINE B2

## Raw LLM + MCP/tool access

Optional.

Priority:

> **P2**

Only implement if the core system is already stable.

B2 must never delay P0.

---

# 44. EVALUATION METRICS

Required:

* [ ] Root-cause accuracy
* [ ] Evidence-citation accuracy
* [ ] Unsupported-claim rate
* [ ] Correct-abstention rate
* [ ] Confidence classification correctness
* [ ] Diagnosis latency

---

# 45. DIAGNOSIS LATENCY

Definition:

> Time from investigation start to final verified diagnosis.

Comparison:

> Predefined manual-investigation procedure for the same controlled incident.

If manual timing is estimated:

> Label it as an estimate.

Do not describe estimated productivity improvements as experimentally measured.

---

# 46. DAY 6 — SHIP

## Deployment

* [ ] Final Vercel deployment verification
* [ ] Final Render deployment verification
* [ ] Supabase connectivity verification
* [ ] Fresh environment test
* [ ] Public HTTPS confirmed
* [ ] CORS confirmed
* [ ] Razorpay webhook round trip confirmed
* [ ] PostgreSQL persistence confirmed
* [ ] Render cold-start behavior checked

---

## Demo

* [ ] Fixture/replay mode reliable
* [ ] Simple deterministic case
* [ ] Complex AI case
* [ ] Claim verification case
* [ ] Abstention case
* [ ] Gemini failure case
* [ ] Live Razorpay Test Mode demo only if stable

---

## Product

* [ ] UI polish
* [ ] Timeline polish
* [ ] Evidence visualization
* [ ] Confidence visualization
* [ ] Abstention visualization
* [ ] AI activation visualization
* [ ] Audit trail visualization

---

## Documentation

* [ ] README.md
* [ ] ARCHITECTURE.md
* [ ] Benchmark results
* [ ] Known limitations
* [ ] BUILD_LOG.md
* [ ] Project objectives
* [ ] Hosting architecture
* [ ] Evaluation methodology

---

## Submission

* [ ] Public GitHub verified
* [ ] Secret scan
* [ ] Git history reviewed
* [ ] Deployment URLs verified
* [ ] 5-minute pitch recorded
* [ ] Pitch rehearsed
* [ ] Fresh judge walkthrough tested

---

# 47. P0 — NEVER CUT

```text
Public deployment
+
Vercel frontend
+
Render backend
+
Supabase PostgreSQL
+
CORS
+
Razorpay Test Mode webhook
+
Signature verification
+
Event normalization
+
State reconstruction
+
Incident detection
+
AI Activation Gate
+
AI investigation
+
Structured AI output
+
Claim verification
+
Deterministic confidence
+
Abstention
+
Audit trail
+
Fixture/replay demo
+
Tests
```

---

# 48. P1 — IMPORTANT

```text
Controlled benchmark
+
Rules baseline
+
B1 baseline
+
Adversarial tests
+
Multiple incident scenarios
+
Failure-recovery documentation
+
Strong evidence timeline UI
+
Live Test Mode demonstration
+
Benchmark visualization
```

---

# 49. P2 — CUT FIRST IF BEHIND

```text
B2
MCP integration
Streaming
Live Test Mode presentation
Extra incident categories
Additional AI providers
Advanced animations
Advanced visualization
Non-essential integrations
```

If behind schedule:

> **CUT P2 FIRST.**

Never sacrifice:

```text
Verifier
+
Confidence
+
Abstention
+
Deterministic state reconstruction
```

---

# 50. SECURITY

Secrets must NEVER be committed.

Required secret values include:

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
GEMINI_API_KEY
DATABASE_URL
```

Frontend configuration may include:

```text
VITE_API_BASE_URL
```

Actual credentials must never be committed.

Repository may contain:

```text
.env.example
```

but never actual secret values.

---

# 51. SECRET REVIEW CHECKLIST

Before every major GitHub push:

* [ ] `git status`
* [ ] `git diff`
* [ ] inspect changed files
* [ ] verify `.env` is ignored
* [ ] verify no API keys
* [ ] verify no database credentials
* [ ] verify no webhook secret
* [ ] verify no private payment information

Never place credentials into:

* source code
* README
* screenshots
* demo recordings
* documentation
* Git history
* public logs

---

# 52. NO REAL MONEY

Only:

> **Razorpay Test Mode**

may be used.

No real payment should be processed.

No production Razorpay credentials should be used.

---

# 53. HUMAN-ONLY FINANCIAL EXECUTION

PayTrace has no autonomous financial actions.

It cannot:

* capture
* refund
* retry
* transfer
* modify payment state
* modify merchant configuration

The system is investigative only.

---

# 54. DEMO RELIABILITY

The primary demo must be:

> **Fixture / Scenario Replay Mode**

Secondary:

> **Razorpay Test Mode**

The demo must remain functional if:

* Razorpay is unavailable
* webhook delivery fails
* Gemini is unavailable
* network becomes unreliable
* Render cold-start occurs
* live transaction setup fails

The product story must never depend entirely on a live external service.

---

# 55. GITHUB COMMIT STRATEGY

Git history should demonstrate genuine engineering progression.

Preferred progression:

```text
Foundation
 ↓
Deployment
 ↓
Database
 ↓
Webhook
 ↓
State reconstruction
 ↓
Incident detection
 ↓
AI
 ↓
Verification
 ↓
Safety
 ↓
Evaluation
 ↓
Deployment hardening
 ↓
Polish
```

Meaningful commits are encouraged.

Fake commit inflation is prohibited.

---

# 56. RECOMMENDED COMMIT STYLE

Examples:

```text
chore: initialize PayTrace

feat: add FastAPI foundation

feat: configure PostgreSQL

feat: add SQLAlchemy database layer

feat: deploy backend to Render

feat: deploy frontend to Vercel

feat: configure frontend backend CORS

feat: add Razorpay webhook endpoint

feat: verify webhook signatures

feat: normalize payment events

feat: implement payment state reconstruction

feat: detect duplicate events

feat: detect delayed events

feat: detect out-of-order events

feat: detect contradictions

feat: add incident engine

feat: add custom evidence timeline

feat: add scenario replay

feat: add Demo Mode

feat: add AI activation gate

feat: add evidence package

feat: add structured Gemini investigator

feat: add claim verifier

feat: add confidence engine

feat: add abstention

test: add payment scenarios

test: add adversarial cases

fix: handle duplicate webhook

fix: handle event ordering issue

fix: prevent unsupported claims

fix: handle Gemini failure

docs: update architecture

docs: add benchmark results
```

---

# 57. FAILURE RECOVERY

Meaningful engineering failures should be recorded.

Possible genuine failures include:

* webhook signature bug
* duplicate-event bug
* event-ordering bug
* timestamp bug
* PostgreSQL connection issue
* SQLAlchemy schema issue
* Render deployment problem
* Render cold-start behavior
* Vercel/Render CORS problem
* Gemini structured-output issue
* Gemini quota issue
* verifier failure

Do not manufacture failures.

---

# 58. BUILD LOG REQUIREMENT

When a genuine obstacle occurs:

Update:

```text
BUILD_LOG.md
```

using:

```text
Problem:
Observed behavior:
Root cause:
Investigation:
Fix:
Test:
Result:
Engineering lesson:
```

---

# 59. ACCOUNT / ANTIGRAVITY CONTINUITY

Persistent project memory:

```text
PROJECT_CONTEXT.md
PROJECT_STATE.md
BUILD_LOG.md
DECISIONS.md
Git history
Source code
Tests
```

Antigravity conversation memory is not authoritative.

---

# 60. ACCOUNT SWITCHING PROCEDURE

When switching Antigravity accounts:

1. Open the same repository.
2. Read `PROJECT_CONTEXT.md`.
3. Read `PROJECT_STATE.md`.
4. Read `BUILD_LOG.md`.
5. Read `DECISIONS.md`.
6. Inspect source code.
7. Inspect tests.
8. Inspect recent Git history.
9. Inspect `git status`.
10. Determine actual implementation state.
11. Continue from the recorded state.

Do not rebuild completed functionality.

---

# 61. ANTIGRAVITY TASK RULE

Every implementation task should be scoped.

Before implementation:

1. Read `PROJECT_CONTEXT.md`.
2. Read `PROJECT_STATE.md`.
3. Inspect relevant code.
4. Inspect relevant tests.
5. Determine what already exists.

Then:

6. Implement only the requested task.
7. Run relevant tests.
8. Update `PROJECT_STATE.md`.
9. Update `BUILD_LOG.md` if a genuine obstacle occurred.
10. Report files changed.
11. Report tests.
12. Report failures/known issues.

---

# 62. ANTIGRAVITY MUST NOT

Antigravity must NOT:

* modify `PROJECT_CONTEXT.md`
* silently change architecture
* reintroduce Fly.io
* implement production SQLite
* introduce React Flow
* add unnecessary ML
* add Kafka
* add Kubernetes
* add unnecessary RAG
* add a vector database without approval
* add multi-agent architecture
* add unnecessary LLM providers
* add autonomous financial actions
* add unrelated features
* rebuild completed components
* optimize feature count at the expense of reliability

---

# 63. ARCHITECTURE CHANGE PROCESS

If Antigravity identifies a genuine architectural issue:

```text
STOP
 ↓
Document problem
 ↓
Explain current approach
 ↓
Propose alternative
 ↓
Estimate impact
 ↓
GPT review
+
Claude review
 ↓
Product Owner approval
 ↓
Implementation
```

Required proposal format:

```text
PROPOSED ARCHITECTURAL CHANGE

Current approach:
...

Problem:
...

Proposed change:
...

Reason:
...

Benefits:
...

Risks:
...

Time impact:
...

Alternative:
...
```

---

# 64. PROJECT STATE UPDATE RULE

After each meaningful implementation milestone:

```text
Implementation
      ↓
Tests
      ↓
Verification
      ↓
PROJECT_STATE.md update
      ↓
Git commit
```

Never:

```text
Code written
      ↓
Mark complete
```

---

# 65. CURRENT NEXT TASK

## PRE-DAY-1 MANUAL SETUP

Before the first implementation prompt:

### GitHub

* [ ] Repository ready
* [ ] Repository public
* [ ] Initial branch ready
* [ ] `.gitignore`
* [ ] `.env.example`

### Render

* [ ] Account ready
* [ ] Backend service can be created
* [ ] Public HTTPS deployment path understood

### Vercel

* [ ] Account ready
* [ ] Frontend project can be created

### Supabase

* [ ] Account ready
* [ ] PostgreSQL project created
* [ ] Database credentials available securely

### Razorpay

* [ ] Test Mode account ready
* [ ] Test credentials available
* [ ] Webhook configuration accessible

### Gemini

* [ ] API access ready
* [ ] API key available securely
* [ ] Quota/availability understood

### Local development

* [ ] Python
* [ ] Node.js
* [ ] npm
* [ ] Git
* [ ] Antigravity

Once these are ready:

> Begin Day 1 implementation.

---

# 66. DAY 1 FIRST END-TO-END TEST

The first real end-to-end test must be:

```text
Razorpay Test Mode
        ↓
Test Event
        ↓
Razorpay Webhook
        ↓
Public Render HTTPS Endpoint
        ↓
Signature Verification
        ↓
Normalization
        ↓
SQLAlchemy
        ↓
Supabase PostgreSQL
        ↓
Persisted Event
```

Additionally:

```text
Browser
   ↓
Vercel
   ↓
Render FastAPI
   ↓
CORS
   ↓
Successful API response
```

Both paths are required.

---

# 67. CURRENT OPEN QUESTIONS

No currently known product or architecture questions remain.

This statement is valid for the current frozen architecture and must be
re-evaluated if implementation reveals a genuine architectural constraint.
It must not be treated as permission to silently change architecture.

The architecture is frozen.

Only operational setup remains:

```text
GitHub
Render
Vercel
Supabase
Razorpay Test Mode
Gemini
Local development environment
```

These are setup/implementation tasks, not architecture decisions.

---

# 68. FINAL ARCHITECTURE SUMMARY

```text
FRONTEND
React + TypeScript + Tailwind
        ↓
     Vercel
        ↓
   HTTPS + CORS
        ↓
BACKEND
Python + FastAPI
        ↓
     Render
        ↓
    SQLAlchemy
        ↓
DATABASE
Supabase PostgreSQL
```

External services:

```text
Gemini API
Razorpay Test Mode
```

---

# 69. FINAL CORE PIPELINE

```text
Razorpay Event
       ↓
Signature Verification
       ↓
Event Normalization
       ↓
PostgreSQL Persistence
       ↓
Deterministic State Reconstruction
       ↓
Authoritative Source Rules
       ↓
Incident Detection
       ↓
AI Activation Gate
       ↓
+-------------------+
|                   |
Simple           Complex
|                   |
↓                   ↓
Rules            Evidence Package
                    ↓
                 Gemini
                    ↓
             Structured Claims
                    ↓
             Claim Verifier
                    ↓
             Confidence Engine
                    ↓
           Diagnosis / INCONCLUSIVE
                    ↓
                Audit Trail
```

---

# 70. FINAL PROJECT STATUS

**Project:** PayTrace

**Track:** Open Track

**Product Status:** APPROVED / FROZEN

**Architecture Status:** APPROVED / FROZEN

**Implementation Status:** READY TO START

**Build Window:** 6 days

**Deadline:** September 5, 2026

**Frontend:** React + TypeScript + Tailwind CSS

**Frontend Hosting:** Vercel

**Backend:** Python + FastAPI

**Backend Hosting:** Render Free Web Service

**Database:** Supabase PostgreSQL

**ORM:** SQLAlchemy

**Timeline:** Custom component

**LLM:** Gemini

**Payment Platform:** Razorpay Test Mode

**Testing:** pytest

**Demo:** Fixture / Scenario Replay Mode

**ML Model:** NO

**Vector Database:** NO

**Production SQLite:** NO

**Fly.io:** REJECTED

**Kafka:** NO

**Kubernetes:** NO

**Multi-agent:** NO

**Multi-provider AI architecture:** NO

**Real money:** NO

**Autonomous financial actions:** NEVER

**RAG:** NO by default

**MCP:** P2

**Streaming:** P2

**Live Test Mode demo:** Optional after reliable fixture demo

**Core deterministic capability:** Payment-state reconstruction

**Core AI capability:** Evidence-grounded investigation

**Core AI judgment feature:** AI Activation Gate

**Core safety mechanism:** Deterministic Claim Verifier

**Core confidence mechanism:** Deterministic Confidence Engine

**Core safety outcome:** INCONCLUSIVE / Abstention

**Core reliability mechanism:** Fixture / Scenario Replay

**Core evaluation:** Ground-truth controlled benchmark

---

# 71. FINAL SUCCESS DEFINITION

PayTrace succeeds if we can demonstrate:

> A simple payment problem does not unnecessarily invoke AI. A complex payment incident is reconstructed from deterministic evidence, AI investigates the ambiguity, every important AI claim is verified against evidence, and the system refuses to guess when evidence is insufficient.

This must be demonstrated through:

* working public deployment
* Vercel frontend
* Render backend
* Supabase PostgreSQL
* Razorpay Test Mode integration
* signature verification
* deterministic state reconstruction
* controlled incident scenarios
* reproducible benchmark results
* adversarial tests
* visible audit trail
* genuine failure-and-recovery story
* meaningful GitHub history
* reliable fixture/demo mode
* no leaked secrets

---

# 72. OPERATING PRINCIPLE

**Do not optimize for feature count.**

Optimize for:

```text
Correctness
+
Safety
+
Evidence
+
Reliability
+
Measurable results
+
Demonstrability
```

The six-day build should prioritize:

```text
P0
 ↓
P1
 ↓
P2 only if time remains
```

If behind schedule:

> Cut P2.

Do not weaken the core safety architecture.

---

# 73. FINAL PAYTRACE MANTRA

```text
DETERMINISTIC FACTS
        +
EVIDENCE
        +
CONTROLLED AI
        +
CLAIM VERIFICATION
        +
DETERMINISTIC CONFIDENCE
        +
ABSTENTION
        =
PAYTRACE
```

---

# END OF PROJECT_STATE.md
