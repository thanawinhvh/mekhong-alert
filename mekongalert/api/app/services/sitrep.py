from typing import Any

from .llm_json import call_claude_json

SYSTEM_PROMPT = """You are drafting an emergency operations situation report
(SITREP) for a disaster management agency. Input: active alerts, recent
citizen reports (last 24h), and the water level gauge trend. Produce a
structured bilingual report in Thai and Chinese (zh-CN), each covering:
situation summary, affected areas, actions taken so far, AI recommendations,
and a suggested next-update time. Keep each under 300 words, plain
operational language, no invented facts — if data is sparse, say so.

Return ONLY valid JSON:
{"content_th": "", "content_zh": ""}"""


def generate_sitrep(alerts: list[dict], reports: list[dict], gauge_trend: list[dict]) -> dict[str, Any]:
    payload = {"active_alerts": alerts, "recent_citizen_reports": reports, "gauge_trend": gauge_trend}
    # Bilingual content routinely needs more than 2048 tokens — same
    # truncation failure mode as the Day 3 TTS bug.
    return call_claude_json(SYSTEM_PROMPT, payload, max_tokens=4096)
