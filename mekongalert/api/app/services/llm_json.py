import json
from typing import Any

from anthropic import Anthropic

from ..config import get_settings


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text
        text = text.removesuffix("```").strip()
    start, end = text.find("{"), text.rfind("}")
    return json.loads(text[start : end + 1])


def call_claude_json(system_prompt: str, user_content: Any, max_tokens: int = 2048, retries: int = 1) -> dict[str, Any]:
    """Shared Claude-call-returning-JSON helper with one retry on parse
    failure. LLM output occasionally doesn't follow the "JSON only"
    instruction perfectly (rare, non-deterministic) — a cheap retry beats
    the whole feature failing live during the demo."""
    settings = get_settings()
    client = Anthropic(api_key=settings.anthropic_api_key)
    content = (
        user_content
        if isinstance(user_content, str)
        else json.dumps(user_content, ensure_ascii=False, default=str)
    )

    last_error: Exception | None = None
    for _ in range(retries + 1):
        message = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": content}],
        )
        try:
            return _extract_json(message.content[0].text)
        except (json.JSONDecodeError, ValueError) as exc:
            last_error = exc
    assert last_error is not None
    raise last_error
