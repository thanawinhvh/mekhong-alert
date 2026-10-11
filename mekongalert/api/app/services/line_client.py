from typing import Any

import httpx

from ..config import get_settings

LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"
LINE_CONTENT_URL = "https://api-data.line.me/v2/bot/message/{message_id}/content"

# §6.3: severity color band, 1 green -> 5 red (same scale as web/src/lib/severity.ts).
SEVERITY_COLORS = {1: "#52c41a", 2: "#bae637", 3: "#faad14", 4: "#fa8c16", 5: "#f5222d"}


def build_flex_message(alert: dict[str, Any], translation: dict[str, Any]) -> dict[str, Any]:
    color = SEVERITY_COLORS.get(alert["severity"], "#999999")
    guidance = translation["guidance"][:3]

    bubble: dict[str, Any] = {
        "type": "bubble",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": color,
            "paddingAll": "12px",
            "contents": [
                {
                    "type": "text",
                    "text": f"Severity {alert['severity']} · {alert['event_type']}",
                    "color": "#ffffff",
                    "weight": "bold",
                    "size": "sm",
                }
            ],
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "md",
            "contents": [
                {"type": "text", "text": translation["headline"], "weight": "bold", "size": "lg", "wrap": True},
                {
                    "type": "box",
                    "layout": "vertical",
                    "margin": "md",
                    "spacing": "sm",
                    "contents": [{"type": "text", "text": f"• {g}", "wrap": True, "size": "sm"} for g in guidance],
                },
            ],
        },
    }

    if alert.get("center_lat") is not None and alert.get("center_lng") is not None:
        map_url = (
            f"https://www.openstreetmap.org/?mlat={alert['center_lat']}&mlon={alert['center_lng']}"
            f"#map=13/{alert['center_lat']}/{alert['center_lng']}"
        )
        bubble["footer"] = {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "contents": [
                {
                    "type": "button",
                    "style": "link",
                    "height": "sm",
                    "action": {"type": "uri", "label": "แผนที่ / Map", "uri": map_url},
                }
            ],
        }

    return {
        "type": "flex",
        "altText": translation["headline"][:400],
        "contents": bubble,
        "quickReply": {
            "items": [{"type": "action", "action": {"type": "message", "label": "\U0001F4F7 Report", "text": "REPORT"}}]
        },
    }


def push_message(line_user_id: str, message: dict[str, Any]) -> None:
    settings = get_settings()
    resp = httpx.post(
        LINE_PUSH_URL,
        headers={
            "Authorization": f"Bearer {settings.line_channel_access_token}",
            "Content-Type": "application/json",
        },
        json={"to": line_user_id, "messages": [message]},
        timeout=10,
    )
    resp.raise_for_status()


def push_text(line_user_id: str, text: str) -> None:
    push_message(line_user_id, {"type": "text", "text": text})


def get_message_content(message_id: str) -> tuple[bytes, str]:
    """Fetch the binary content (photo) of an incoming LINE message."""
    settings = get_settings()
    resp = httpx.get(
        LINE_CONTENT_URL.format(message_id=message_id),
        headers={"Authorization": f"Bearer {settings.line_channel_access_token}"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("content-type", "image/jpeg")
