import json
import os
from google import genai
from google.genai import types
from typing import Dict, Any

# Configure client using new SDK
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

MODEL_NAME = "gemini-3.6-flash"

# ── API-level structured output schema (PROJECT_CONTEXT.md §22) ───────────────
# The Gemini API enforces this schema at the model level; the model cannot
# return JSON that does not conform to it.  This replaces the previous
# pattern of "tell the model to return JSON in the prompt and then json.loads()
# the free-form output" which is fragile and non-compliant with §22.

_CLAIM_SCHEMA = types.Schema(
    type="OBJECT",
    required=["claim_id", "statement", "evidence_ids", "counter_evidence_ids", "confidence"],
    properties={
        "claim_id": types.Schema(
            type="STRING",
            description="Short unique claim identifier, e.g. C1, C2.",
        ),
        "statement": types.Schema(
            type="STRING",
            description="One sentence atomic claim that can be deterministically verified.",
        ),
        "evidence_ids": types.Schema(
            type="ARRAY",
            items=types.Schema(type="STRING"),
            description=(
                "List of evidence_id strings from the evidence package that support this claim. "
                "Every claim must cite at least one evidence_id."
            ),
        ),
        "counter_evidence_ids": types.Schema(
            type="ARRAY",
            items=types.Schema(type="STRING"),
            description=(
                "List of evidence_id strings from the evidence package that contradict this claim. "
                "Empty list if none."
            ),
        ),
        "confidence": types.Schema(
            type="STRING",
            enum=["HIGH", "MEDIUM", "LOW"],
            description="Confidence level for this individual claim.",
        ),
    },
)

_INVESTIGATION_SCHEMA = types.Schema(
    type="OBJECT",
    required=["hypothesis", "claims", "recommended_next_step", "uncertainty"],
    properties={
        "hypothesis": types.Schema(
            type="STRING",
            description=(
                "One sentence root cause hypothesis. "
                "If evidence is insufficient, use: 'Insufficient evidence to determine root cause.'"
            ),
        ),
        "claims": types.Schema(
            type="ARRAY",
            items=_CLAIM_SCHEMA,
            description="List of atomic, verifiable claims that support the hypothesis.",
        ),
        "recommended_next_step": types.Schema(
            type="STRING",
            description="One sentence recommended action.",
        ),
        "uncertainty": types.Schema(
            type="STRING",
            enum=["HIGH", "MEDIUM", "LOW"],
            description=(
                "Overall uncertainty of the investigation. "
                "Set to HIGH if evidence is insufficient."
            ),
        ),
    },
)

# Generation config: temperature + API-level JSON schema enforcement
_GENERATION_CONFIG = types.GenerateContentConfig(
    temperature=0.1,
    response_mime_type="application/json",
    response_schema=_INVESTIGATION_SCHEMA,
)

# System prompt — now focused on investigative reasoning instructions only.
# JSON format is enforced at the API level; no need to instruct the model on
# the output format here, but we keep the evidence-citation rules which are
# semantic, not structural.
SYSTEM_PROMPT = """\
You are a payment incident investigator for Razorpay integrations.
You receive a structured evidence package containing normalized payment events,
reconstructed payment state, and detected incidents.

Investigate the payment incident and return your findings.

Rules you must follow:
- Only cite evidence_ids that exist in the provided events list.
- Every claim must cite at least one evidence_id.
- Do not invent payment IDs, amounts, or timestamps not present in the evidence.
- If evidence is insufficient to form a hypothesis, set uncertainty to HIGH and
  hypothesis to "Insufficient evidence to determine root cause."
- Claims must be atomic and machine-verifiable, not vague assertions.
"""


def investigate(evidence_package: Dict[str, Any]) -> Dict[str, Any]:
    if client is None:
        return {"error": "gemini_unavailable", "detail": "GEMINI_API_KEY not set"}

    try:
        user_message = (
            f"Investigate this payment incident:\n{json.dumps(evidence_package, indent=2)}"
        )

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.1,
                response_mime_type="application/json",
                response_schema=_INVESTIGATION_SCHEMA,
            ),
        )

        response_text = response.text

        # The API guarantees JSON-conforming output when response_schema is set.
        # We still parse defensively in case of edge-case SDK behaviour.
        try:
            parsed = json.loads(response_text)
            return parsed
        except json.JSONDecodeError:
            # Unexpected: schema enforcement should prevent this, but handle gracefully.
            return {"error": "structured_output_failure", "raw": response_text}

    except Exception as e:
        return {"error": "gemini_unavailable", "detail": str(e)}
