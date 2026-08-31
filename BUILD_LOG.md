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

# 11. CURRENT LOG STATUS

**Implementation has not started yet.**

Therefore:

> **No engineering incidents have been recorded yet.**

The first real entry should be added only when a genuine engineering problem occurs.

---

# 12. MAINTENANCE RULE

After resolving a meaningful engineering problem:

1. Add the entry to `BUILD_LOG.md`.
2. Run the relevant test.
3. Update `PROJECT_STATE.md` if implementation status changed.
4. Update `DECISIONS.md` only if the incident resulted in an important implementation decision.
5. Commit the relevant changes.

Do not use the build log as a generic TODO list.

---

# 13. FINAL PRINCIPLE

`BUILD_LOG.md` should tell the truthful engineering story of PayTrace:

> **Build → Test → Encounter a real problem → Investigate → Fix → Verify → Learn.**

No fabricated failures.

No secrets.

No unsupported claims.

No rewriting history.

---

# END OF BUILD_LOG.md
