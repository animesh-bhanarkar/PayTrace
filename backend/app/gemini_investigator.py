import json
import os
import google.generativeai as genai
from typing import Dict, Any

# Assuming GEMINI_API_KEY is in the environment
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

SYSTEM_PROMPT = """
You are a payment incident investigator for Razorpay integrations.
You receive a structured evidence package containing normalized payment events,
reconstructed payment state, and detected incidents.

You must respond ONLY with valid JSON matching this exact schema:
{
  "hypothesis": "string — one sentence root cause",
  "claims": [
    {
      "claim_id": "string — short unique id e.g. C1",
      "statement": "string — one sentence atomic claim",
      "evidence_ids": ["list of evidence_id strings from the package that support this claim"],
      "counter_evidence_ids": ["list of evidence_id strings that contradict this claim, or empty"],
      "confidence": "HIGH | MEDIUM | LOW"
    }
  ],
  "recommended_next_step": "string — one sentence",
  "uncertainty": "HIGH | MEDIUM | LOW"
}

Rules you must follow:
- Only cite evidence_ids that exist in the provided events list.
- Every claim must cite at least one evidence_id.
- Do not invent payment IDs, amounts, or timestamps not present in the evidence.
- If evidence is insufficient to form a hypothesis, set uncertainty to HIGH and hypothesis to "Insufficient evidence to determine root cause."
- Respond with JSON only. No markdown. No explanation outside the JSON.
"""

def investigate(evidence_package: Dict[str, Any]) -> Dict[str, Any]:
    try:
        model = genai.GenerativeModel(
            model_name="gemini-3.6-flash",
            system_instruction=SYSTEM_PROMPT
        )
        
        user_message = f"Investigate this payment incident:\n{json.dumps(evidence_package, indent=2)}"
        
        response = model.generate_content(
            user_message,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                response_mime_type="application/json"
            )
        )
        
        response_text = response.text
        try:
            parsed = json.loads(response_text)
            return parsed
        except json.JSONDecodeError:
            return {"error": "structured_output_failure", "raw": response_text}
            
    except Exception as e:
        return {"error": "gemini_unavailable", "detail": str(e)}
