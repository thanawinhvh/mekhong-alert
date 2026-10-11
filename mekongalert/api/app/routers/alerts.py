import httpx
from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from ..config import get_settings
from ..deps import CurrentUser, get_current_profile
from ..services.ai_localizer import LANGS, localize_alert
from ..services.crowd_signal import haversine_km
from ..services.impact_assessment import generate_impact_assessment
from ..services.line_client import build_flex_message, push_message
from ..services.tts_service import synthesize
from ..supabase_client import get_service_client, get_user_client

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

EVENT_TYPES = {"flood", "storm", "landslide", "fire", "earthquake", "other"}


def _attach_shared_from(client, profile: CurrentUser, alerts: list[dict]) -> None:
    """§6.5 — for alerts owned by another tenant but visible to the caller
    (via alert_shares RLS), attach the sharing tenant's info for the
    dashboard badge. Mutates `alerts` in place."""
    shared_ids = [a["id"] for a in alerts if a["tenant_id"] != profile.tenant_id]
    if not shared_ids:
        for a in alerts:
            a["shared_from"] = None
        return

    shares = (
        client.table("alert_shares").select("alert_id, from_tenant, note").in_("alert_id", shared_ids).execute().data
    )
    from_tenant_ids = list({s["from_tenant"] for s in shares})
    service_client = get_service_client()
    tenants = (
        service_client.table("tenants")
        .select("id, slug, name_en, name_th, name_zh, country")
        .in_("id", from_tenant_ids)
        .execute()
        .data
    )
    tenants_by_id = {t["id"]: t for t in tenants}
    tenant_by_alert = {s["alert_id"]: tenants_by_id.get(s["from_tenant"]) for s in shares}

    for a in alerts:
        a["shared_from"] = tenant_by_alert.get(a["id"])


class AlertCreate(BaseModel):
    event_type: str
    severity: int = Field(ge=1, le=5)
    headline: str
    description: str
    source_lang: str = "th"
    area_codes: list[str] = []
    center_lat: float | None = None
    center_lng: float | None = None
    radius_km: float | None = None
    onset_at: str | None = None
    expires_at: str | None = None


@router.post("")
def create_alert(body: AlertCreate, profile: CurrentUser = Depends(get_current_profile)):
    if body.event_type not in EVENT_TYPES:
        raise HTTPException(status_code=422, detail=f"event_type must be one of {sorted(EVENT_TYPES)}")

    client = get_user_client(profile.access_token)
    row = {
        **body.model_dump(exclude_none=True),
        "tenant_id": profile.tenant_id,
        "source": "manual",
        "created_by": profile.user_id,
    }
    result = client.table("alerts").insert(row).execute()
    return result.data[0]


@router.get("")
def list_alerts(status: str | None = None, profile: CurrentUser = Depends(get_current_profile)):
    client = get_user_client(profile.access_token)
    query = client.table("alerts").select("*").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    alerts = query.execute().data
    _attach_shared_from(client, profile, alerts)
    return alerts


@router.get("/{alert_id}")
def get_alert(alert_id: str, profile: CurrentUser = Depends(get_current_profile)):
    client = get_user_client(profile.access_token)
    result = client.table("alerts").select("*").eq("id", alert_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Alert not found")
    translations = (
        client.table("alert_translations").select("*").eq("alert_id", alert_id).execute().data
    )
    alert = {**result.data, "translations": translations}
    _attach_shared_from(client, profile, [alert])
    return alert


@router.post("/{alert_id}/localize")
def localize(alert_id: str, profile: CurrentUser = Depends(get_current_profile)):
    """§6.2 / §10.1 — one Claude call, upsert all 5 language rows, mark localized."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")

    client = get_user_client(profile.access_token)
    alert_res = client.table("alerts").select("*").eq("id", alert_id).single().execute()
    if not alert_res.data:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert = alert_res.data

    areas_res = client.table("areas").select("code, name_local").in_("code", alert["area_codes"]).execute()
    area_names = [a["name_local"] for a in areas_res.data]

    result = localize_alert(alert, area_names)

    rows = [
        {
            "alert_id": alert_id,
            "lang": lang,
            "headline": result["translations"][lang]["headline"],
            "guidance": result["translations"][lang]["guidance"],
            "tts_script": result["translations"][lang].get("tts_script"),
            "model": settings.anthropic_model,
        }
        for lang in LANGS
    ]
    client.table("alert_translations").upsert(rows, on_conflict="alert_id,lang").execute()
    client.table("alerts").update({"status": "localized"}).eq("id", alert_id).execute()

    translations = client.table("alert_translations").select("*").eq("alert_id", alert_id).execute().data
    return {
        "severity_check": result.get("severity_check"),
        "severity_note": result.get("severity_note"),
        "translations": translations,
    }


@router.post("/{alert_id}/approve")
def approve_alert(alert_id: str, profile: CurrentUser = Depends(get_current_profile)):
    client = get_user_client(profile.access_token)
    result = client.table("alerts").update({"status": "approved"}).eq("id", alert_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Alert not found")
    return result.data[0]


@router.post("/{alert_id}/broadcast")
def broadcast_alert(alert_id: str, profile: CurrentUser = Depends(get_current_profile)):
    """§6.3 — LINE push to subscribers whose area_codes intersect the alert's,
    each in their own language. subscribers has no client RLS policy, so it's
    read via the service role; alert/translation reads stay RLS-scoped to the
    caller's tenant."""
    settings = get_settings()
    if not settings.line_channel_access_token:
        raise HTTPException(status_code=500, detail="LINE_CHANNEL_ACCESS_TOKEN is not configured")

    client = get_user_client(profile.access_token)
    alert_res = client.table("alerts").select("*").eq("id", alert_id).single().execute()
    if not alert_res.data:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert = alert_res.data

    translations = client.table("alert_translations").select("*").eq("alert_id", alert_id).execute().data
    translations_by_lang = {t["lang"]: t for t in translations}
    if not translations_by_lang:
        raise HTTPException(status_code=400, detail="Localize the alert before broadcasting")

    service_client = get_service_client()
    subscribers = service_client.table("subscribers").select("*").eq("consented", True).execute().data

    area_codes = set(alert["area_codes"])
    sent = 0
    failed = 0
    for sub in subscribers:
        if not (area_codes & set(sub["area_codes"])):
            continue
        translation = translations_by_lang.get(sub["lang"]) or translations_by_lang.get(alert["source_lang"])
        if not translation:
            continue
        message = build_flex_message(alert, translation)
        try:
            push_message(sub["line_user_id"], message)
            sent += 1
        except httpx.HTTPStatusError:
            failed += 1

    client.table("broadcasts").insert({"alert_id": alert_id, "channel": "line", "audience_count": sent}).execute()
    client.table("alerts").update({"status": "broadcast"}).eq("id", alert_id).execute()

    return {"audience_count": sent, "failed": failed}


@router.post("/{alert_id}/tts")
async def generate_tts(alert_id: str, lang: str, profile: CurrentUser = Depends(get_current_profile)):
    """§6.3 — synthesize the localized tts_script for one language, store the
    MP3, save its URL back onto alert_translations."""
    client = get_user_client(profile.access_token)
    translation_res = (
        client.table("alert_translations")
        .select("*")
        .eq("alert_id", alert_id)
        .eq("lang", lang)
        .single()
        .execute()
    )
    if not translation_res.data:
        raise HTTPException(status_code=404, detail="Translation not found; localize first")
    script = translation_res.data.get("tts_script") or translation_res.data["headline"]

    audio_bytes = await synthesize(script, lang)

    service_client = get_service_client()
    path = f"{alert_id}/{lang}.mp3"
    service_client.storage.from_("tts-audio").upload(
        path, audio_bytes, {"content-type": "audio/mpeg", "upsert": "true"}
    )
    tts_url = service_client.storage.from_("tts-audio").get_public_url(path)

    client.table("alert_translations").update({"tts_url": tts_url}).eq("alert_id", alert_id).eq("lang", lang).execute()
    return {"tts_url": tts_url}


class ShareCreate(BaseModel):
    to_tenant_slug: str
    note: str | None = None


@router.post("/{alert_id}/share")
def share_alert(alert_id: str, body: ShareCreate, profile: CurrentUser = Depends(get_current_profile)):
    """§6.5 — Shared Incident Room. Tenant lookup needs the service role since
    RLS only lets the caller read their own tenant row; the actual share
    insert goes through the user client so alert_shares_write RLS applies."""
    service_client = get_service_client()
    tenant_res = service_client.table("tenants").select("id").eq("slug", body.to_tenant_slug).execute()
    if not tenant_res.data:
        raise HTTPException(status_code=404, detail="Target tenant not found")
    to_tenant_id = tenant_res.data[0]["id"]

    client = get_user_client(profile.access_token)
    row = {
        "alert_id": alert_id,
        "from_tenant": profile.tenant_id,
        "to_tenant": to_tenant_id,
        "note": body.note,
    }
    result = client.table("alert_shares").upsert(row, on_conflict="alert_id,to_tenant").execute()
    return result.data[0]


@router.post("/{alert_id}/impact-assessment")
def create_impact_assessment(alert_id: str, profile: CurrentUser = Depends(get_current_profile)):
    """§W7 — AI-generated planning input (population/shelters are estimates,
    not official figures; the UI labels it as such). RLS only lets the
    OWNING tenant generate an assessment; both owner and shared-to tenants
    can read the result once it exists."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")

    client = get_user_client(profile.access_token)
    alert_res = client.table("alerts").select("*").eq("id", alert_id).single().execute()
    if not alert_res.data:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert = alert_res.data

    service_client = get_service_client()
    districts = (
        service_client.table("areas")
        .select("code, name_local, name_en, lat, lng, population_estimate")
        .eq("tenant_id", alert["tenant_id"])
        .in_("code", alert["area_codes"])
        .execute()
        .data
    )
    shelters = (
        service_client.table("shelters")
        .select("name, capacity, lat, lng")
        .eq("tenant_id", alert["tenant_id"])
        .execute()
        .data
    )

    ref_lat = alert.get("center_lat") or (districts[0]["lat"] if districts else None)
    ref_lng = alert.get("center_lng") or (districts[0]["lng"] if districts else None)
    shelters_with_distance = [
        {
            **s,
            "distance_km": round(haversine_km(ref_lat, ref_lng, s["lat"], s["lng"]), 1) if ref_lat is not None else None,
        }
        for s in shelters
    ]
    shelters_with_distance.sort(key=lambda s: s["distance_km"] if s["distance_km"] is not None else 9999)

    result = generate_impact_assessment(alert, districts, shelters_with_distance)

    row = {
        "alert_id": alert_id,
        "content_th": result.get("content_th", ""),
        "content_zh": result.get("content_zh", ""),
        "shelter_recommendations": result.get("shelter_recommendations", []),
        "estimated_affected_population": result.get("estimated_affected_population"),
        "generated_by": profile.user_id,
    }
    try:
        inserted = client.table("impact_assessments").insert(row).execute()
    except APIError as exc:
        if exc.code == "42501":
            raise HTTPException(status_code=403, detail="Only the owning tenant can generate an impact assessment")
        raise
    return inserted.data[0]


@router.get("/{alert_id}/impact-assessment")
def get_impact_assessment(alert_id: str, profile: CurrentUser = Depends(get_current_profile)):
    client = get_user_client(profile.access_token)
    result = (
        client.table("impact_assessments")
        .select("*")
        .eq("alert_id", alert_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None
