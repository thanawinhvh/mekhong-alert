from typing import Any

from .llm_json import call_claude_json

SYSTEM_PROMPT = """Detect the language of the message and translate it into
Thai (th), Chinese (zh-CN), and English (en). This is a coordination message
between disaster-response agencies — keep tone professional, don't add or
remove information. Return ONLY valid JSON:
{"lang_original": "th|zh-CN|en|...", "translations": {"th": "", "zh-CN": "", "en": ""}}"""


def translate_message(body: str) -> dict[str, Any]:
    return call_claude_json(SYSTEM_PROMPT, body, max_tokens=1024)
