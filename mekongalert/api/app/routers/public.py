from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..supabase_client import get_service_client

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/areas")
def list_public_areas():
    """Unauthenticated — the LIFF onboarding page (§6.4) needs the full
    province/district list across both tenants before a citizen has any
    session at all."""
    client = get_service_client()
    tenants = client.table("tenants").select("id, slug, name_en, name_th, name_zh").execute().data
    areas = client.table("areas").select("*").order("name_en").execute().data
    tenants_by_id = {t["id"]: t for t in tenants}
    return [{**a, "tenant_slug": tenants_by_id[a["tenant_id"]]["slug"]} for a in areas if a["tenant_id"] in tenants_by_id]


class SubscriberUpsert(BaseModel):
    line_user_id: str
    display_name: str | None = None
    lang: str = "th"
    area_codes: list[str] = Field(default_factory=list)
    lat: float | None = None
    lng: float | None = None


@router.post("/subscribers")
def upsert_subscriber(body: SubscriberUpsert):
    client = get_service_client()
    result = (
        client.table("subscribers").upsert(body.model_dump(exclude_none=True), on_conflict="line_user_id").execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save subscriber")
    return result.data[0]


@router.get("/status/{tenant_slug}")
def public_status(tenant_slug: str):
    """§6.6 — no-auth public status page. Goes straight in the competition
    proposal PDF, so it stays deliberately minimal: active alerts + their
    translations for whichever of the 5 languages the citizen picks."""
    client = get_service_client()
    tenant_res = client.table("tenants").select("id, slug, name_en, name_th, name_zh, country").eq("slug", tenant_slug).execute()
    if not tenant_res.data:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant = tenant_res.data[0]

    alerts = (
        client.table("alerts")
        .select("id, event_type, severity, area_codes, status, onset_at, expires_at, created_at")
        .eq("tenant_id", tenant["id"])
        .in_("status", ["localized", "approved", "broadcast"])
        .order("created_at", desc=True)
        .execute()
        .data
    )

    alert_ids = [a["id"] for a in alerts]
    translations_by_alert: dict[str, list] = {}
    if alert_ids:
        translations = client.table("alert_translations").select("*").in_("alert_id", alert_ids).execute().data
        for t in translations:
            translations_by_alert.setdefault(t["alert_id"], []).append(t)

    for a in alerts:
        a["translations"] = translations_by_alert.get(a["id"], [])

    return {"tenant": tenant, "alerts": alerts}
