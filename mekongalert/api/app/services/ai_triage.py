import base64
import json
from typing import Any

from anthropic import Anthropic

from ..config import get_settings

# §10.2 — implemented verbatim.
SYSTEM_PROMPT = """You triage citizen disaster reports for an emergency operations dashboard.
Input: optional text (any language), optional photo, optional GPS, plus the
list of currently active alerts (id, type, areas).

Return ONLY valid JSON:
{
  "category": "flood|storm|landslide|fire|earthquake|infrastructure|other|not_disaster",
  "severity": 1-5,
  "credibility": "low|medium|high",
  "summary_en": "one sentence",
  "summary_local": "one sentence in the reporter's language",
  "matched_alert_id": "uuid or null",
  "reply_to_citizen": "short thank-you + one safety tip, in the reporter's language"
}

Rules: judge credibility from consistency of photo/text/location; mark selfies,
memes, ads as not_disaster with low credibility. Never promise rescue dispatch."""


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text
        text = text.removesuffix("```").strip()
    start, end = text.find("{"), text.rfind("}")
    return json.loads(text[start : end + 1])


def triage_report(
    text: str | None,
    image_bytes: bytes | None,
    image_media_type: str | None,
    lat: float | None,
    lng: float | None,
    active_alerts: list[dict[str, Any]],
) -> dict[str, Any]:
    settings = get_settings()
    client = Anthropic(api_key=settings.anthropic_api_key)

    content: list[dict[str, Any]] = []
    if image_bytes:
        content.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": image_media_type or "image/jpeg",
                    "data": base64.b64encode(image_bytes).decode(),
                },
            }
        )
    payload = {
        "text": text,
        "gps": {"lat": lat, "lng": lng} if lat is not None and lng is not None else None,
        "active_alerts": active_alerts,
    }
    content.append({"type": "text", "text": json.dumps(payload, ensure_ascii=False)})

    message = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )
    return _parse_json(message.content[0].text)
