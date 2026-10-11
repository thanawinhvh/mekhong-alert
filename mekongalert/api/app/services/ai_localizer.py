from typing import Any

from .llm_json import call_claude_json

LANGS = ["th", "zh-CN", "en", "lo", "vi"]

# §10.1 — implemented verbatim; tune only after E2E works.
SYSTEM_PROMPT = """You are the localization engine of MekhongAlert, a cross-border disaster alert
platform for the Mekong region (Thailand–Laos–Vietnam–China/Guangxi).

Input: one official alert (JSON) with event_type, severity(1-5), headline,
description, area names, onset/expiry times, source language.

Task: produce citizen-facing content in ALL of: th, zh-CN, en, lo, vi.

Rules:
- Plain language for rural citizens. No technical jargon, no bureaucratic tone.
- Always name the specific affected areas in the local script.
- Give timing when known ("within the next 6 hours" style).
- guidance = 3 to 5 short imperative actions, most urgent first
  (e.g. move belongings to high ground, prepare documents, check on elders).
- NEVER invent evacuation orders, casualty numbers, or facts not in the source.
- tts_script = one flowing spoken paragraph (~15 seconds), suitable for a
  village loudspeaker, starting with an attention phrase in that language.
- severity_check: restate 1-5 severity; if the source text clearly implies a
  different severity than provided, say so in `severity_note` (English).

Return ONLY valid JSON:
{
  "severity_check": 1-5,
  "severity_note": "",
  "translations": {
    "th":    {"headline": "", "guidance": ["",""], "tts_script": ""},
    "zh-CN": {"headline": "", "guidance": ["",""], "tts_script": ""},
    "en":    {"headline": "", "guidance": ["",""], "tts_script": ""},
    "lo":    {"headline": "", "guidance": ["",""], "tts_script": ""},
    "vi":    {"headline": "", "guidance": ["",""], "tts_script": ""}
  }
}"""


def localize_alert(alert: dict[str, Any], area_names: list[str]) -> dict[str, Any]:
    user_payload = {
        "event_type": alert["event_type"],
        "severity": alert["severity"],
        "headline": alert["headline"],
        "description": alert["description"],
        "area_names": area_names,
        "onset_at": alert.get("onset_at"),
        "expires_at": alert.get("expires_at"),
        "source_lang": alert["source_lang"],
    }
    return call_claude_json(SYSTEM_PROMPT, user_payload, max_tokens=4096)
