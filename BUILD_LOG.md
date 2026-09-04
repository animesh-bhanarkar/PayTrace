# BUILD_LOG.md — PayTrace

**Project:** PayTrace  
**Purpose:** Record genuine engineering problems, investigations, fixes, tests, results, and lessons learned during implementation.

---

# 1. PURPOSE

`BUILD_LOG.md` is the chronological engineering record for PayTrace.

It exists to capture what actually happened during the build, especially:

- unexpected failures
- debugging investigations
- deployment problems
- integration problems
- database issues
- webhook issues
- AI/model issues
- testing failures
- security issues
- performance/reliability problems
- important engineering lessons

This file supports the final Buildathon section:

> **Build Challenges & Technical Obstacles**

Only genuine engineering experiences should be recorded.

**Do not manufacture failures or challenges for the sake of the submission.**

---

# 2. RELATIONSHIP TO OTHER PROJECT FILES

```text
PROJECT_CONTEXT.md
    ↓
What PayTrace must be

IMPLEMENTATION_PLAN.md
    ↓
What we intend to build and in what order

PROJECT_STATE.md
    ↓
What has actually been completed

BUILD_LOG.md
    ↓
What went wrong, how it was investigated,
how it was fixed, and what was learned

DECISIONS.md
    ↓
Important implementation decisions and rationale
```

`BUILD_LOG.md` does not replace `PROJECT_STATE.md`.

Use:

- `PROJECT_STATE.md` for progress/status.
- `BUILD_LOG.md` for engineering problems and their resolution.

---

# 3. LOGGING RULES

## Record genuine problems

Examples include:

- Razorpay webhook failures
- signature verification bugs
- duplicate webhook handling bugs
- delayed/out-of-order event bugs
- PostgreSQL/Supabase connectivity problems
- SQLAlchemy issues
- Render deployment problems
- Render cold-start behavior
- Vercel/Render CORS problems
- Gemini API failures
- Gemini structured-output problems
- claim-verification bugs
- confidence-engine bugs
- incorrect abstention behavior
- test failures
- security mistakes
- unexpected integration behavior

## Do not manufacture problems

Do not create artificial failures simply to make the build story look more impressive.

## Keep entries factual

Separate:

- observed behavior
- confirmed root cause
- hypothesis
- actual fix
- test result

Do not present an assumption as a confirmed root cause.

## Preserve useful technical detail

Include enough information that another developer can understand:

- what happened
- why it happened
- how it was diagnosed
- what changed
- how the fix was verified

Do not expose secrets or private payment information.

---

# 4. SECURITY RULES

Never record:

- API keys
- webhook secrets
- database passwords
- `DATABASE_URL` values
- access tokens
- private merchant/payment information
- personal information

Use placeholders when necessary.

Example:

```text
DATABASE_URL was incorrectly configured.
```

Do NOT record the actual connection string.

Similarly:

```text
GEMINI_API_KEY was missing from the Render environment.
```

Do NOT record the actual key.

---

# 5. STANDARD ENTRY FORMAT

Every meaningful engineering incident should use:

```text
## [DATE] — [SHORT TITLE]

**Status:** Open / Resolved / Deferred

### Problem

What went wrong?

### Observed Behavior

What actually happened?

### Expected Behavior

What should have happened?

### Root Cause

What caused the problem?

If not yet confirmed:

> Root cause under investigation.

### Investigation

What was checked or tested?

### Fix

What was changed?

### Test

How was the fix verified?

### Result

What happened after the fix?

### Engineering Lesson

What should we remember or do differently because of this?

### Related Files / Components

- `path/to/file`
- component / service name

### Commit

`commit-hash` or `not yet committed`
```

---

# 6. ENTRY STATUS

Use one of:

### Open

Problem is still being investigated.

### Resolved

Problem has been fixed and verified.

### Deferred

Problem is understood but intentionally postponed.

Do not mark a problem `Resolved` without a meaningful verification step.

---

# 7. EXAMPLE STRUCTURE

The following is an example of the format only. It is NOT a real project incident and must not be presented as one.

```text
## [DATE] — Example: Webhook Signature Verification Failure

**Status:** Resolved

### Problem

A Razorpay Test Mode webhook was received by the Render endpoint,
but signature verification failed.

### Observed Behavior

The webhook request reached the backend successfully, but the event
was not accepted as trusted evidence.

### Expected Behavior

A valid Razorpay webhook should pass signature verification and then
continue to normalization and persistence.

### Root Cause

The verification code was using an incorrectly reconstructed request
payload.

### Investigation

Compared the raw request body used during verification with the
payload used after request parsing.

### Fix

Changed verification to use the required raw request body before
parsing.

### Test

Replayed a valid signed webhook and verified successful signature
validation.

### Result

The webhook passed verification and was persisted successfully.

### Engineering Lesson

Webhook signatures must be verified against the correct raw request
representation before downstream processing.

### Related Files / Components

- `backend/webhooks/...`
- Razorpay webhook handler

### Commit

`<commit-hash>`
```

**Do not copy this example into the project as a real incident.**

---

# 8. HIGH-VALUE FAILURES TO DOCUMENT

Prioritize genuine failures that demonstrate meaningful engineering work.

## Infrastructure

- Render deployment failure
- Vercel deployment failure
- Supabase connectivity issue
- CORS configuration issue
- environment-variable configuration issue
- Render cold-start behavior

## Razorpay

- webhook delivery issue
- signature verification issue
- event normalization issue
- duplicate event issue
- event ordering issue
- timestamp interpretation issue

## Database

- SQLAlchemy/PostgreSQL compatibility issue
- schema/migration problem
- persistence failure
- connection/pooling issue

## AI

- Gemini API failure
- quota/availability issue
- structured-output failure
- unsupported AI claim
- incorrect evidence citation

## Safety

- prompt-injection test failure
- verifier failure
- incorrect confidence classification
- incorrect abstention behavior

## Evaluation

- benchmark bug
- incorrect ground truth
- scenario replay problem
- baseline implementation issue

---

# 9. WHAT MAKES A GOOD BUILD LOG ENTRY

A strong entry demonstrates:

```text
Problem
  ↓
Observation
  ↓
Investigation
  ↓
Root Cause
  ↓
Fix
  ↓
Test
  ↓
Result
  ↓
Lesson
```

The goal is not to show that PayTrace failed.

The goal is to show:

> **How the engineering team identified, understood, and corrected real problems.**

---

# 10. BUILD LOG AND FINAL SUBMISSION

Potentially useful entries may later support:

- Build Challenges & Technical Obstacles
- Technical Architecture explanation
- Reliability discussion
- Failure-recovery discussion
- Security discussion
- Engineering lessons

Only include claims in the final submission that are supported by actual build-log evidence.

---

# 11. LOGGED INCIDENTS & ENGINEERING ENTRIES

## 2026-09-01 — Supabase Direct Latency from Local Machine vs Deployed Render

**Status:** Resolved

### Problem

Supabase connection latency was ~2.4-2.6s when connecting directly from the local development machine.

### Observed Behavior

Local database health probes and direct connection attempts showed consistent ping/query latency of 2400-2600ms, raising potential concern regarding API roundtrip latency.

### Expected Behavior

Database roundtrip latency should be sufficiently low (<500ms) for high-performance webhook handling and investigation workflows.

### Root Cause

Geographic distance between the local development machine location and the Supabase PostgreSQL cluster located in the `ap-northeast-2` (Seoul) region.

### Investigation

Repeated local connection tests confirmed the ~2.4-2.6s latency was consistent across multiple queries and connection pool cycles, ruling out a one-time cold-start or temporary network anomaly.

### Fix

Deployed the FastAPI backend to Render (`https://paytrace-backend-ys0y.onrender.com`) and tested database connectivity and probe persistence from the live deployed environment to Supabase.

### Test

1. Executed `GET /health` against the deployed Render URL to test database connection status and measure cold-start latency.
2. Executed `POST /db/probe` and `GET /db/probes` on the live Render service to perform complete record persistence and retrieval against Supabase PostgreSQL.

### Result

- Confirmed that Render's deployed instance connects to the same Supabase project at ~366-370ms latency.
- Cold-start latency on the first request after idle was measured at 1291ms.
- Confirmed the high latency is specific to local development access due to geographic routing and does not affect the production/demo path, since judges and users interact directly with the deployed Render backend.

### Engineering Lesson

Local development latency to a managed database is not necessarily representative of production latency once both services are colocated in compatible regions; verify against the deployed path before treating a local number as a real problem.

### Related Files / Components

- `backend/app/database.py`
- `backend/app/main.py`
- `render.yaml`
- `scripts/verify_db_and_deploy.py`
- Supabase PostgreSQL (`ap-northeast-2`)
- Render Web Service (`https://paytrace-backend-ys0y.onrender.com`)

### Commit

`b64a7a5 test: verify Supabase and Render deployment end-to-end`

---

## 2026-09-02 — Render Deployment Synchronization Failure

**Status:** Resolved

### Problem

The deployed Render endpoint returned `404 Not Found` for the Razorpay webhook endpoint (`/webhooks/razorpay`) during live verification testing.

### Observed Behavior

Live requests sent to the deployed URL (`https://paytrace-backend-ys0y.onrender.com/webhooks/razorpay`) failed with a 404 status. Additionally, the `/health` endpoint did not return the newly added `webhook_secret_configured` key, indicating that the live server was running older code from commit `ee51966` instead of newest commits (`ba01521` and `704ff06`). The same endpoint worked locally on `http://127.0.0.1:8000/webhooks/razorpay`.

### Expected Behavior

The deployed Render instance should automatically pull from the latest `main` branch commit and update its routes, successfully processing incoming webhook payloads with `200 OK` (for valid signatures) and `403 Forbidden` (for invalid signatures).

### Root Cause

Render auto-deploy was delayed / desynchronized with GitHub webhooks, leaving the container running a stale commit.

### Investigation

1. Sent simulated valid and invalid webhook requests using a Python script against local uvicorn instance, confirming signature verification, rejection, and persistence logic.
2. Validated `/health` on Render, confirming the deployed version was an older commit missing the webhook router.
3. Created an empty commit (`376caec`) to force a deployment trigger.

### Fix

Triggered manual deployment synchronization from the Render dashboard and verified the live container build logs.

### Test

Executed `GET /health` and re-sent simulated webhooks against `https://paytrace-backend-ys0y.onrender.com/webhooks/razorpay`.

### Result

Render synchronized to the latest commit. Webhook endpoint returned 200 for valid signatures and 403 for invalid signatures on production infrastructure.

### Engineering Lesson

Always verify the exact deployed application version via a health endpoint or commit hash exposure before assuming a `404` or similar error indicates a code bug. Infrastructure synchronization can lag behind repository state.

### Related Files / Components

- `backend/app/main.py`
- `backend/app/routers/webhooks.py`
- `render.yaml`
- Render Web Service Deployment

### Commit

`ba78369 test: verify webhook round trip`

---

## 2026-09-03 — Webhook Secret Mismatch on Genuine Events

**Status:** Resolved

### Problem

Initial real payment attempts produced no visible new events in the system, despite Razorpay indicating webhook delivery was successful.

### Observed Behavior

Genuine Razorpay-originated webhooks were being rejected or not logged correctly as verified events, while local simulated webhooks were working perfectly.

### Expected Behavior

Genuine events sent from Razorpay's Test Mode should be received by the public Render endpoint, pass signature verification, and be persisted to Supabase as trusted events.

### Root Cause

The registered Razorpay webhook secret did not match the deployed environment's `RAZORPAY_WEBHOOK_SECRET`. A secret mismatch caused the deployed environment to reject genuine signatures computed with the Razorpay dashboard key.

### Investigation

Confirmed that local simulated tests passed because they used the local `.env` secret to generate signatures, whereas genuine Razorpay events used the secret configured in the Razorpay dashboard.

### Fix

Rotated the webhook secret and re-synced both Razorpay's dashboard and Render's environment variables to ensure they matched.

### Test

Made two real Test Mode payments via Razorpay Payment Links and queried the `/webhooks/events` endpoint to verify the results.

### Result

Genuine Razorpay webhook events (`payment.authorized`, `payment.captured`, `order.paid`) were successfully received, verified (`signature_valid: true`), and persisted to Supabase PostgreSQL.

### Engineering Lesson

When webhook integration tests pass locally but fail in production with real external traffic, verify that external secrets match the deployed environment's variables exactly. Simulated tests are inherently blind to external configuration mismatches.

### Related Files / Components

- Render Environment Variables
- Razorpay Dashboard Webhook Configuration
- `backend/app/webhook_verifier.py`

### Commit

`0e5661d docs: confirm genuine Razorpay webhook verification — Day 1 backend complete`

---

## 2026-09-04 — Duplicate Webhook Incorrectly Triggering AI Investigation

**Status:** Resolved

### Problem

Scenario 03 (Duplicate Webhook) failed ground truth assertion during live scenario replay verification on Render infrastructure.

### Observed Behavior

`POST /scenarios/replay` with `{"scenario_id": "scenario_03"}` returned:
```json
{
  "passed": false,
  "mismatches": [
    "ai_activated mismatch: expected False, got True",
    "confidence mismatch: expected HIGH, got LOW"
  ]
}
```

### Expected Behavior

Scenario 03 represents a duplicate webhook (`payment.captured` delivered twice). Ground truth requires `ai_activated=false` and `confidence=HIGH`, since duplicate detection is fully deterministic and does not require LLM investigation.

### Root Cause

`backend/app/authoritative_rules.py` set `requires_ai_investigation=True` whenever ANY incident had `severity=HIGH`. `DUPLICATE_WEBHOOK` is classified `severity=HIGH` for incident logging/display purposes, so a duplicate webhook alone incorrectly forced AI activation.

### Investigation

Traced the decision pipeline: `incident_detector` assigned `DUPLICATE_WEBHOOK` severity HIGH -> `authoritative_rules` set `requires_ai_investigation=True` -> `ai_activation_gate` received upstream True and bypassed its short-circuit logic. Additionally, `scenarios.py` had a stale guard `len(high_incidents) == 0` on its confidence override.

### Fix

1. In `backend/app/authoritative_rules.py`: Excluded `DUPLICATE_WEBHOOK` from `high_incidents_for_ai` when evaluating `requires_ai_investigation`, and forced `confidence_hint="HIGH"` when all incidents are duplicates.
2. In `backend/app/routers/scenarios.py`: Removed the stale `len(high_incidents) == 0` guard so the override fires on `confidence_hint == "HIGH"`.

### Test

Added regression test `test_duplicate_webhook_alone_does_not_require_ai` to `tests/test_authoritative_rules.py`. Verified locally and on live Render infrastructure.

### Result

- Local test suite: 100% passing.
- Live Render replay of Scenario 03: returns `passed=true`, `ai_activated=false`, `confidence=HIGH`, `mismatches=[]`.

### Engineering Lesson

Incident severity labels serve dual purposes: incident display and AI routing. When an AI routing rule evaluates severity (e.g. "HIGH severity -> AI needed"), it must explicitly carve out incident types that are deterministic by design. Centralizing routing logic in `authoritative_rules.py` prevents brittle multi-layer short-circuit dependencies.

### Related Files / Components

- `backend/app/authoritative_rules.py`
- `backend/app/routers/scenarios.py`
- `tests/test_authoritative_rules.py`

### Commit

`4d27be9 fix: duplicate webhook alone must not trigger AI investigation`

---

# 12. MAINTENANCE RULE

After resolving a meaningful engineering problem:

1. Add the entry to `BUILD_LOG.md`.
2. Run the relevant test.
3. Update `PROJECT_STATE.md` if implementation status changed.
4. Update `DECISIONS.md` only if the incident resulted in an important implementation decision.
5. Commit the relevant changes.

---

# 13. FINAL PRINCIPLE

`BUILD_LOG.md` should tell the truthful engineering story of PayTrace:

> **Build → Test → Encounter a real problem → Investigate → Fix → Verify → Learn.**

No fabricated failures.
No secrets.
No unsupported claims.

---

# END OF BUILD_LOG.md
