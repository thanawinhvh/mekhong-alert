from typing import Any

from .llm_json import call_claude_json

SYSTEM_PROMPT = """You are an AI planning assistant for disaster response
agencies. Given an alert, its affected districts (with population estimates,
labeled as rough estimates), and a list of candidate shelters (name, capacity,
distance in km from the alert location), produce an impact assessment.

This is AI-generated planning input, not an official figure — never state
exact casualty numbers or claim authority. Cover: estimated affected
population and villages, secondary-disaster risks with response suggestions,
and shelter reasoning.

Return ONLY valid JSON:
{
  "estimated_affected_population": 0,
  "content_th": "Thai-language assessment covering the points above",
  "content_zh": "same assessment in Chinese (zh-CN)",
  "shelter_recommendations": [
    {"name": "", "capacity": 0, "distance_km": 0.0, "note": "one-line reasoning: capacity vs estimated evacuees, distance"}
  ]
}
Rank shelter_recommendations by suitability (capacity vs estimated evacuees,
then distance), most suitable first."""


def generate_impact_assessment(
    alert: dict[str, Any], districts: list[dict[str, Any]], shelters: list[dict[str, Any]]
) -> dict[str, Any]:
    payload = {"alert": alert, "affected_districts": districts, "candidate_shelters": shelters}
    # Bilingual content + up to 5 ranked shelters routinely needs more than
    # 2048 tokens — same truncation failure mode as the Day 3 TTS bug.
    return call_claude_json(SYSTEM_PROMPT, payload, max_tokens=4096)
