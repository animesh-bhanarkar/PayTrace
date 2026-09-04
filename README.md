# PayTrace

AI-assisted payment incident investigator for Razorpay integrations, built for the Razorpay AI Buildathon 2026.

## What it does

PayTrace receives Razorpay webhooks, deterministically reconstructs the payment state machine from raw events, and detects anomalies (duplicate webhooks, out-of-order events, invalid transitions, delayed delivery) without any LLM involvement. When the deterministic layer flags high-severity incidents, a gated AI investigator calls Gemini to form an evidence-backed hypothesis, which is then checked claim-by-claim against the original evidence package. If the evidence is insufficient to support a conclusion, the system returns INCONCLUSIVE rather than guessing.

## Architecture

```
Vercel (React Frontend)
  ↓ HTTPS + CORS
Render (FastAPI Backend)
  ↓ SQLAlchemy
Supabase PostgreSQL

External: Gemini API, Razorpay Test Mode
```

## Core Pipeline

```
Webhook → Signature Verification → Event Normalization
→ State Reconstruction → Incident Detection → AI Activation Gate
→ Evidence Package → Gemini Investigator → Claim Verifier
→ Confidence Engine → Diagnosis / INCONCLUSIVE
```

## Demo

Live URL: https://pay-trace-nine.vercel.app

### Demo Scenarios (no setup required)

1. **Scenario 1: Clean Capture** — deterministic HIGH confidence, AI skipped
2. **Scenario 2: Missing payment.created** — AI activated, LOW confidence
3. **Scenario 3: Duplicate Webhook** — deterministic, AI skipped

### Live Investigation

Enter any payment_id from Razorpay Test Mode into the Investigate tab.

## Safety Design

- **AI Activation Gate**: deterministic, AI never decides if AI runs
- **Claim Verifier**: every AI claim checked against evidence package
- **Abstention**: INCONCLUSIVE returned when evidence is insufficient
- **No autonomous financial actions**

## Evaluation

Three scenarios with known ground truth.
Metrics: state accuracy, incident detection, AI activation correctness,
claim verification, confidence correctness, abstention correctness.

## Local Development

### Prerequisites

Python 3.11+, Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # fill in secrets
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Run tests

```bash
cd backend
pytest tests/ --ignore=tests/test_webhook_endpoint.py
```

## Known Limitations

- Render free tier cold start (~1-3s on first request)
- Gemini quota may affect AI investigation under load
- Demo scenarios use fixture data, not live Razorpay traffic

## Build Challenges

Local-to-Supabase query latency measured at 2,400–2,600 ms during development due to geographic distance between the dev machine and the `ap-northeast-2` Supabase cluster; the issue disappeared once the backend was deployed to Render, which connects at ~366 ms. A Render auto-deploy synchronisation failure caused the webhook endpoint to return 404 in production while passing all local tests, requiring a manual deploy trigger and a version check via the `/health` endpoint to diagnose the stale deployment. A webhook secret mismatch between the Razorpay dashboard configuration and the Render environment variable caused genuine Test Mode webhooks to be silently rejected while locally-simulated webhooks continued to pass, resolved by rotating and re-syncing the secret across both sides.
