from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request

from ..config import get_settings
from ..services.ai_triage import triage_report
from ..services.crowd_signal import detect_cluster
from ..services.line_client import get_message_content, push_text
from ..services.line_signature import verify_line_signature
from ..supabase_client import get_service_client

# ai_category values that should never escalate into a Crowd Signal.
NON_ESCALATING_CATEGORIES = {"not_disaster"}

router = APIRouter(prefix="/webhooks", tags=["line_webhook"])


def _resolve_subscriber(client: Any, line_user_id: str) -> dict[str, Any] | None:
    subs = (
        client.table("subscribers")
        .select("area_codes, lang, lat, lng")
        .eq("line_user_id", line_user_id)
        .execute()
        .data
    )
    return subs[0] if subs else None


def _resolve_tenant_id(client: Any, area_codes: list[str]) -> str | None:
    if not area_codes:
        return None
    areas = client.table("areas").select("tenant_id").eq("code", area_codes[0]).execute().data
    return areas[0]["tenant_id"] if areas else None


def process_event(event: dict[str, Any]) -> None:
    """Runs in a background task so the webhook can ack LINE immediately (§6.4)."""
    if event.get("type") != "message":
        return
    line_user_id = event.get("source", {}).get("userId")
    if not line_user_id:
        return

    client = get_service_client()
    message = event["message"]
    msg_type = message["type"]

    text: str | None = None
    photo_url: str | None = None
    image_bytes: bytes | None = None
    image_media_type: str | None = None
    lat: float | None = None
    lng: float | None = None

    if msg_type == "text":
        text = message["text"]
    elif msg_type == "image":
        image_bytes, image_media_type = get_message_content(message["id"])
        path = f"{line_user_id}/{message['id']}.jpg"
        client.storage.from_("report-photos").upload(
            path, image_bytes, {"content-type": image_media_type}
        )
        photo_url = client.storage.from_("report-photos").get_public_url(path)
    elif msg_type == "location":
        lat = message.get("latitude")
        lng = message.get("longitude")
        text = message.get("address")
        # A live share is more current than whatever was set at LIFF signup —
        # save it so a later photo/text report can still be placed on the map.
        client.table("subscribers").update({"lat": lat, "lng": lng}).eq("line_user_id", line_user_id).execute()
    else:
        return

    subscriber = _resolve_subscriber(client, line_user_id)
    tenant_id = _resolve_tenant_id(client, (subscriber or {}).get("area_codes") or [])

    # A photo/text message carries no GPS of its own — fall back to the
    # location the citizen shared during LIFF onboarding, if any, so reports
    # still land on the operator's map.
    if lat is None and lng is None and subscriber:
        lat = subscriber.get("lat")
        lng = subscriber.get("lng")

    active_alerts: list[dict[str, Any]] = []
    if tenant_id:
        active_alerts = (
            client.table("alerts")
            .select("id, event_type, area_codes")
            .eq("tenant_id", tenant_id)
            .in_("status", ["localized", "approved", "broadcast"])
            .execute()
            .data
        )

    result = triage_report(text, image_bytes, image_media_type, lat, lng, active_alerts)

    inserted = client.table("citizen_reports").insert(
        {
            "tenant_id": tenant_id,
            "line_user_id": line_user_id,
            "message_text": text,
            "photo_url": photo_url,
            "lat": lat,
            "lng": lng,
            "ai_category": result.get("category"),
            "ai_severity": result.get("severity"),
            "ai_summary_en": result.get("summary_en"),
            "ai_summary_local": result.get("summary_local"),
            "ai_credibility": result.get("credibility"),
            "linked_alert_id": result.get("matched_alert_id"),
        }
    ).execute()

    reply = result.get("reply_to_citizen")
    if reply:
        push_text(line_user_id, reply)

    if tenant_id and inserted.data:
        _maybe_raise_signal(client, tenant_id, inserted.data[0], active_alerts)


def _maybe_raise_signal(
    client: Any, tenant_id: str, new_report: dict[str, Any], active_alerts: list[dict[str, Any]]
) -> None:
    """§W3 Crowd Signal — corroborate independent reports before suggesting a
    draft alert. Simplification (timeboxed): "no active alert covers it" is
    approximated as "no active alert of the same event_type for this tenant"
    rather than resolving each report's district, since citizen_reports only
    stores lat/lng, not a resolved area_code."""
    category = new_report.get("ai_category")
    if not category or category in NON_ESCALATING_CATEGORIES:
        return
    if new_report.get("ai_credibility") not in ("medium", "high"):
        return
    if any(a["event_type"] == category for a in active_alerts):
        return

    since = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    recent = (
        client.table("citizen_reports")
        .select("id, lat, lng")
        .eq("tenant_id", tenant_id)
        .eq("ai_category", category)
        .in_("ai_credibility", ["medium", "high"])
        .gte("created_at", since)
        .execute()
        .data
    )
    cluster_ids = detect_cluster(new_report, recent)
    if not cluster_ids:
        return

    existing_signal = (
        client.table("signals")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("category", category)
        .eq("status", "new")
        .execute()
        .data
    )
    if existing_signal:
        return

    client.table("signals").insert(
        {"tenant_id": tenant_id, "category": category, "report_ids": cluster_ids}
    ).execute()


@router.post("/line")
async def line_webhook(request: Request, background_tasks: BackgroundTasks, x_line_signature: str = Header(...)):
    settings = get_settings()
    body = await request.body()
    if not verify_line_signature(body, x_line_signature, settings.line_channel_secret):
        raise HTTPException(status_code=400, detail="Invalid signature")

    payload = await request.json()
    for event in payload.get("events", []):
        background_tasks.add_task(process_event, event)

    return {"status": "ok"}
