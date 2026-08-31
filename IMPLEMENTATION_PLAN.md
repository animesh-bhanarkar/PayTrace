# IMPLEMENTATION_PLAN.md — PayTrace

**Project:** PayTrace  
**Program:** Razorpay AI Buildathon 2026  
**Track:** Open Track  
**Deadline:** September 5, 2026  
**Build Window:** 6 days  
**Primary Builder:** Antigravity

---

# 1. PURPOSE

This file defines the planned implementation sequence for PayTrace.

It answers:

> **What are we going to build, in what order, and what proves each stage is complete?**

It is intentionally separate from `PROJECT_STATE.md`.

```text
IMPLEMENTATION_PLAN.md
    ↓
What we intend to build

PROJECT_STATE.md
    ↓
What has actually been built
```

`PROJECT_CONTEXT.md` remains the frozen product and architecture authority.

Do not use this file to silently change architecture.

---

# 2. FROZEN ARCHITECTURE

```text
                    Vercel
                       |
                 React Frontend
                       |
                  HTTPS + CORS
                       |
                       v
                    Render
                 FastAPI Backend
                       |
                  SQLAlchemy
                       |
                       v
               Supabase PostgreSQL
                       |
              +--------+--------+
              |                 |
              v                 v
          Gemini API      Razorpay Test Mode
```

Production decisions:

- Frontend: Vercel
- Backend: Render Free Web Service
- Database: Supabase PostgreSQL
- ORM: SQLAlchemy
- LLM: Gemini
- Payment integration: Razorpay Test Mode
- Local SQLite: optional for isolated testing only
- Production SQLite: no
- Fly.io: rejected

---

# 3. CORE IMPLEMENTATION PRINCIPLE

Build:

> **Facts first → AI second → verification always → abstention when evidence is insufficient.**

The implementation must preserve this boundary:

```text
Deterministic facts
        ↓
Evidence package
        ↓
Controlled AI investigation
        ↓
Claim verification
        ↓
Deterministic confidence
        ↓
Diagnosis / INCONCLUSIVE
```

AI must never become the source of truth for payment state.

---

# 4. DEFINITION OF DONE

A milestone is complete only when:

```text
Implementation
    +
Relevant tests
    +
Verification
    +
PROJECT_STATE.md updated
```

For deployment milestones:

```text
Deployment
    +
Real deployed verification
    +
Relevant tests
```

For external integrations:

```text
Integration
    +
Actual successful interaction
    +
Expected persistence/response verified
```

Do not mark a task complete because code merely exists.

---

# 5. EXECUTION ORDER

The implementation follows this dependency order:

```text
Day 1
Foundation + Deployment + Real Webhook
        ↓
Day 2
Payment Intelligence
        ↓
Day 3
AI Investigation
        ↓
Day 4
Trust + Safety
        ↓
Day 5
Evaluation
        ↓
Day 6
Ship + Harden + Demo
```

Do not skip foundational dependencies to build later-stage features.

---

# 6. DAY 0 — MANUAL SETUP

## Objective

Ensure the external accounts/services required by Antigravity are available.

### User manually handles

- [x] GitHub
- [x] Razorpay Test Mode
- [x] Gemini API
- [ ] Render account
- [ ] Vercel account
- [ ] Supabase account/project

### User does NOT manually build

- database tables
- webhook code
- CORS
- frontend
- backend
- AI pipeline
- tests
- Demo Mode

Antigravity handles those implementation tasks.

### Day 0 completion

```text
GitHub
+
Razorpay Test Mode
+
Gemini
+
Render
+
Vercel
+
Supabase
```

available for implementation.

---

# 7. DAY 1 — FOUNDATION + DEPLOYMENT + REAL WEBHOOK

## Objective

Establish the complete public infrastructure path.

### 7.1 Repository foundation

- [ ] Inspect existing repository
- [ ] Establish project structure
- [ ] Confirm `.gitignore`
- [ ] Create/update `.env.example`
- [ ] Confirm no secrets are committed
- [ ] Establish backend structure
- [ ] Establish frontend structure
- [ ] Establish tests structure

### 7.2 Backend foundation

- [ ] FastAPI application
- [ ] Health endpoint
- [ ] Environment configuration
- [ ] SQLAlchemy configuration
- [ ] PostgreSQL connection configuration
- [ ] Basic API endpoint
- [ ] Error handling foundation

### 7.3 Supabase PostgreSQL

- [ ] Connect to Supabase PostgreSQL early
- [ ] Configure `DATABASE_URL`
- [ ] Verify SQLAlchemy connection
- [ ] Create initial database models
- [ ] Validate models against PostgreSQL
- [ ] Persist test record
- [ ] Retrieve test record
- [ ] Confirm production-compatible PostgreSQL behavior

Do not develop the complete database layer against SQLite and postpone PostgreSQL validation.

### 7.4 Render

- [ ] Create/configure Render Web Service
- [ ] Connect repository
- [ ] Configure build/start commands
- [ ] Configure environment variables
- [ ] Deploy FastAPI
- [ ] Verify public HTTPS URL
- [ ] Verify health endpoint
- [ ] Check cold-start behavior

### 7.5 Vercel

- [ ] Create/configure Vercel project
- [ ] Connect frontend
- [ ] Configure API base URL
- [ ] Deploy frontend
- [ ] Verify public frontend URL

### 7.6 CORS

- [ ] Configure FastAPI CORS
- [ ] Allow deployed Vercel origin
- [ ] Verify browser → Render API request
- [ ] Confirm successful API response

### 7.7 Razorpay webhook

- [ ] Configure public Render webhook endpoint
- [ ] Receive Razorpay Test Mode webhook
- [ ] Verify webhook signature
- [ ] Reject invalid/untrusted signature
- [ ] Normalize accepted event
- [ ] Persist event in Supabase PostgreSQL
- [ ] Verify stored event

### Day 1 acceptance

Both paths must work:

```text
Razorpay Test Mode
      ↓
Render public webhook
      ↓
Signature verification
      ↓
Normalization
      ↓
Supabase PostgreSQL
```

and:

```text
Vercel
      ↓
Render API
      ↓
CORS
      ↓
Successful response
```

### Day 1 stop condition

Do not consider Day 1 complete until both paths are verified.

---

# 8. DAY 2 — PAYMENT INTELLIGENCE

## Objective

Build the deterministic payment evidence and incident layer.

### 8.1 Event normalization

- [ ] Define normalized event model
- [ ] Event ID
- [ ] Event type
- [ ] Payment ID
- [ ] Order ID
- [ ] Event timestamp
- [ ] Ingestion timestamp
- [ ] Source
- [ ] Status
- [ ] Delivery status
- [ ] Payload hash
- [ ] Signature status

### 8.2 Deterministic state reconstruction

- [ ] Implement payment-state model
- [ ] Implement valid transitions
- [ ] Process events using event semantics
- [ ] Distinguish event time from arrival time
- [ ] Handle duplicates
- [ ] Handle delayed events
- [ ] Handle out-of-order events
- [ ] Detect invalid transitions
- [ ] Detect contradictions

### 8.3 Authoritative-source rules

- [ ] Implement/read Razorpay API payment-state evidence where required
- [ ] Use Razorpay API as payment/financial-state authority
- [ ] Use webhook data as delivery/event-observation evidence
- [ ] Use merchant records as merchant-side belief evidence
- [ ] Preserve source authority when sources disagree

### 8.4 Incident detection

- [ ] Duplicate webhook incident
- [ ] Delayed webhook incident
- [ ] Out-of-order incident
- [ ] Payment state mismatch
- [ ] Webhook processing failure
- [ ] Signature verification failure
- [ ] Missing/incomplete evidence
- [ ] Ambiguous state

### 8.5 Timeline

- [ ] Build custom timeline component
- [ ] Display event ordering
- [ ] Display anomalies
- [ ] Display contradictions
- [ ] Display authoritative facts
- [ ] Display missing evidence

### 8.6 Scenario replay foundation

- [ ] Scenario definition format
- [ ] Replay mechanism
- [ ] Ground-truth representation
- [ ] Initial Demo Mode fixture support

### Day 2 acceptance

The deterministic system can reconstruct payment state and detect core incident types without Gemini.

---

# 9. DAY 3 — AI INVESTIGATION

## Objective

Add controlled AI reasoning only where deterministic logic is insufficient.

### 9.1 AI Activation Gate

- [ ] Deterministic gate
- [ ] Known-error mapping
- [ ] Simple case path
- [ ] Complex case path
- [ ] Verify AI is skipped for eligible simple cases
- [ ] Verify AI activates for ambiguous cases

### 9.2 Evidence package

- [ ] Build structured evidence package
- [ ] Include relevant normalized events
- [ ] Include reconstructed state
- [ ] Include anomalies
- [ ] Include contradictions
- [ ] Include authoritative-source decisions
- [ ] Include missing evidence
- [ ] Include evidence IDs
- [ ] Prevent unrestricted database access

### 9.3 Gemini integration

- [ ] Configure Gemini API
- [ ] Implement simple model-call function
- [ ] Implement timeout/error handling
- [ ] Confirm API availability/quota
- [ ] Avoid unnecessary model calls

### 9.4 Structured investigator

- [ ] Structured output/schema
- [ ] Root-cause hypothesis
- [ ] Atomic claims
- [ ] Evidence IDs
- [ ] Counter-evidence IDs
- [ ] Recommended next step
- [ ] Explicit uncertainty

### Day 3 acceptance

```text
Simple case
    ↓
AI skipped

Complex case
    ↓
Evidence package
    ↓
Gemini
    ↓
Structured investigation
```

---

# 10. DAY 4 — TRUST + SAFETY

## Objective

Make AI output constrained, verifiable, and safe.

### 10.1 Claim Verifier

- [ ] Evidence ID existence check
- [ ] Evidence package membership check
- [ ] Field/value support check
- [ ] Timestamp/context check
- [ ] Authoritative-source consistency check
- [ ] Unsupported claim rejection
- [ ] Critical claim handling

### 10.2 Confidence Engine

- [ ] HIGH rules
- [ ] MEDIUM rules
- [ ] LOW rules
- [ ] INCONCLUSIVE rules
- [ ] Deterministic implementation
- [ ] Unit tests

### 10.3 Abstention

- [ ] Missing critical evidence
- [ ] Unresolvable critical contradiction
- [ ] No sufficiently supported hypothesis
- [ ] INCONCLUSIVE output
- [ ] Missing evidence explanation
- [ ] Next investigation step

### 10.4 Prompt injection

- [ ] Malicious log text test
- [ ] Instruction-like webhook metadata test
- [ ] Fabricated evidence test
- [ ] Conflicting evidence test
- [ ] Verify evidence remains data, not instructions

### 10.5 Gemini failure

- [ ] Gemini timeout
- [ ] Gemini API failure
- [ ] Invalid structured response
- [ ] Graceful deterministic fallback
- [ ] Audit AI failure

### 10.6 Audit trail

- [ ] Input
- [ ] Evidence
- [ ] Detected facts
- [ ] AI activation decision
- [ ] AI hypothesis
- [ ] Claims
- [ ] Verification results
- [ ] Confidence
- [ ] Final output
- [ ] Outcome
- [ ] Failure/abstention states

### Day 4 acceptance

PayTrace:

- rejects unsupported claims
- produces deterministic confidence
- abstains when evidence is insufficient
- survives Gemini failure safely
- ignores instruction-like evidence content

---

# 11. DAY 5 — EVALUATION

## Objective

Prove the system works rather than only demonstrating that it exists.

### 11.1 Core scenarios

- [ ] PT-DEMO-001 Duplicate webhook
- [ ] PT-DEMO-002 Delayed webhook
- [ ] PT-DEMO-003 Out-of-order event
- [ ] PT-DEMO-004 Payment state mismatch
- [ ] PT-DEMO-005 Webhook processing failure
- [ ] PT-DEMO-006 Signature verification failure
- [ ] PT-DEMO-007 Missing/incomplete evidence
- [ ] PT-DEMO-008 Simple documented error
- [ ] PT-DEMO-009 Untrusted evidence/prompt injection

### 11.2 Scenario variants

Target:

> 15–30 meaningful controlled cases.

Do not create superficial variants merely to increase count.

### 11.3 Rules-only baseline

- [ ] Run deterministic baseline
- [ ] Record results

### 11.4 B1 baseline

- [ ] Raw LLM receives same evidence package
- [ ] Record root-cause results
- [ ] Record evidence grounding
- [ ] Record unsupported claims
- [ ] Record abstention behavior

### 11.5 B2

Optional P2:

- [ ] Raw LLM + MCP/tool access

Only if P0/P1 is stable.

### 11.6 Metrics

- [ ] Root-cause accuracy
- [ ] Evidence-citation accuracy
- [ ] Unsupported-claim rate
- [ ] Correct-abstention rate
- [ ] Confidence correctness
- [ ] Diagnosis latency

### 11.7 Diagnosis latency

Use:

> Time from investigation start to final verified diagnosis.

Compare against:

> A predefined manual-investigation procedure for the same controlled incident.

Clearly label estimates as estimates.

### Day 5 acceptance

Benchmark results are reproducible and documented.

---

# 12. DAY 6 — SHIP

## Objective

Make the system reliable, presentable, and submission-ready.

### 12.1 Deployment verification

- [ ] Vercel production deployment
- [ ] Render production deployment
- [ ] Supabase persistence
- [ ] CORS
- [ ] Public HTTPS
- [ ] Razorpay webhook round trip
- [ ] Signature verification
- [ ] Cold-start behavior
- [ ] Environment variables
- [ ] No secrets exposed

### 12.2 Demo reliability

- [ ] Demo Mode works
- [ ] Scenario replay works
- [ ] Simple deterministic case works
- [ ] Complex AI case works
- [ ] Claim verification case works
- [ ] Abstention case works
- [ ] Gemini failure case works
- [ ] Live Razorpay Test Mode demo works if stable

### 12.3 UI

- [ ] Dashboard
- [ ] Timeline
- [ ] Evidence display
- [ ] Confidence display
- [ ] Abstention display
- [ ] AI activation explanation
- [ ] Audit trail display
- [ ] Remove unnecessary UI complexity

### 12.4 Documentation

- [ ] README
- [ ] Architecture documentation
- [ ] Benchmark results
- [ ] Known limitations
- [ ] Build challenges
- [ ] Deployment instructions
- [ ] Demo instructions

### 12.5 GitHub

- [ ] Repository public
- [ ] Secret scan
- [ ] Git history reviewed
- [ ] No accidental files
- [ ] Meaningful commits
- [ ] Final state verified

### 12.6 Pitch

- [ ] Five-minute demo flow
- [ ] Problem
- [ ] Simple case
- [ ] Complex case
- [ ] Verification
- [ ] Abstention
- [ ] Benchmark
- [ ] Genuine engineering challenge
- [ ] Final thesis

### Day 6 acceptance

A fresh user/judge can follow the demo without relying on undocumented manual intervention.

---

# 13. P0 CHECKPOINT

P0 must be complete before significant P2 work begins.

```text
[ ] Public Vercel frontend
[ ] Public Render backend
[ ] Supabase PostgreSQL
[ ] CORS
[ ] Razorpay Test webhook
[ ] Signature verification
[ ] Event normalization
[ ] State reconstruction
[ ] Incident detection
[ ] AI Activation Gate
[ ] AI investigation
[ ] Structured output
[ ] Claim verification
[ ] Confidence
[ ] Abstention
[ ] Audit trail
[ ] Demo Mode
[ ] Tests
```

---

# 14. P1 CHECKPOINT

```text
[ ] Controlled benchmark
[ ] Rules-only baseline
[ ] B1 baseline
[ ] Adversarial tests
[ ] Multiple incident scenarios
[ ] Failure-recovery documentation
[ ] Strong evidence/timeline UI
```

---

# 15. P2 CHECKPOINT

Only after P0 and P1 are stable:

```text
[ ] B2
[ ] MCP
[ ] Streaming
[ ] Additional incident categories
[ ] Advanced visualization
[ ] Additional non-essential integrations
```

If behind schedule:

> Cut P2 first.

---

# 16. DEPENDENCY RULES

Do not start:

```text
AI Investigator
```

before:

```text
Evidence package
+
Deterministic incident detection
```

Do not start:

```text
Claim Verifier
```

before:

```text
Structured AI claims
+
Evidence IDs
```

Do not finalize:

```text
Confidence Engine
```

before:

```text
Claim verification
+
Evidence sufficiency rules
```

Do not finalize:

```text
Benchmark
```

before:

```text
Deterministic scenarios
+
Known ground truth
```

Do not consider:

```text
Day 1 complete
```

before:

```text
Render
+
Supabase
+
Razorpay webhook
+
Vercel → Render
```

are actually verified.

---

# 17. FAILURE / RECOVERY CHECKPOINTS

At each milestone verify that the system fails safely.

## Infrastructure

- [ ] Render unavailable
- [ ] Supabase unavailable
- [ ] CORS failure
- [ ] cold start

## Razorpay

- [ ] invalid signature
- [ ] duplicate event
- [ ] delayed event
- [ ] out-of-order event

## AI

- [ ] Gemini unavailable
- [ ] malformed structured output
- [ ] unsupported claim

## Evidence

- [ ] missing critical evidence
- [ ] contradictory evidence
- [ ] malicious evidence content

Expected principle:

> Failure must not cause PayTrace to invent payment truth.

---

# 18. DAILY CHECKPOINT FORMAT

At the end of each build day, update `PROJECT_STATE.md` with:

```text
Day:
Completed:
In Progress:
Blocked:
Tests:
Deployment status:
Known bugs:
Genuine failures:
Next task:
```

If a genuine engineering problem occurred:

> Add it to `BUILD_LOG.md`.

If an important implementation decision occurred:

> Add it to `DECISIONS.md`.

---

# 19. ANTIGRAVITY EXECUTION RULE

For each plan item:

1. Read relevant project files.
2. Inspect existing implementation.
3. Implement the smallest correct change.
4. Test it.
5. Fix relevant failures.
6. Update state.
7. Commit meaningful progress.
8. Move to the next dependency.

Do not implement unrelated future phases early unless there is a clear dependency reason.

---

# 20. MANUAL VS ANTIGRAVITY BOUNDARY

## User manually handles

```text
GitHub account/repository
Razorpay Test Mode account
Gemini API access
Render account
Vercel account
Supabase account/project
```

## Antigravity handles

```text
Application code
Database models
SQLAlchemy
FastAPI
React
Tailwind
CORS configuration
Razorpay webhook code
Signature verification
Event normalization
State machine
Incident engine
AI Activation Gate
Evidence package
Gemini integration
Claim Verifier
Confidence Engine
Abstention
Audit trail
Tests
Scenario replay
Demo Mode
Benchmark tooling
Deployment configuration
Documentation updates
```

If a hosting platform requires a human-only account confirmation, credential entry, payment verification, or permission approval:

> Stop and tell the User exactly what manual action is required.

Do not invent credentials or attempt to bypass platform controls.

---

# 21. FINAL IMPLEMENTATION CHECK

Before declaring PayTrace complete:

```text
Architecture
    [ ]

Frontend
    [ ]

Backend
    [ ]

PostgreSQL
    [ ]

Razorpay
    [ ]

Webhook verification
    [ ]

State reconstruction
    [ ]

Incident detection
    [ ]

AI gate
    [ ]

Gemini
    [ ]

Claim verification
    [ ]

Confidence
    [ ]

Abstention
    [ ]

Audit trail
    [ ]

Demo Mode
    [ ]

Evaluation
    [ ]

Security
    [ ]

Deployment
    [ ]

Documentation
    [ ]

Demo
    [ ]
```

---

# 22. FINAL SUCCESS CONDITION

PayTrace is ready for submission when it can reliably demonstrate:

```text
Simple case
    ↓
Deterministic diagnosis
    ↓
AI skipped

Complex case
    ↓
Deterministic reconstruction
    ↓
AI activated
    ↓
Structured claims
    ↓
Evidence verification
    ↓
Deterministic confidence

Insufficient evidence
    ↓
INCONCLUSIVE
    ↓
Missing evidence identified
```

and the complete deployed infrastructure works:

```text
Vercel
   ↓
Render
   ↓
Supabase PostgreSQL
```

with:

```text
Razorpay Test Mode
+
Gemini API
```

integrated safely.

---

# 23. FINAL BUILD PRIORITY

Always prefer:

```text
Correctness
    >
Safety
    >
Evidence grounding
    >
Reliability
    >
Evaluation
    >
Demo polish
    >
Optional features
```

The goal is not to build the largest system.

The goal is to build a small, credible, measurable system that proves the PayTrace thesis.

---

# END OF IMPLEMENTATION_PLAN.md
