from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..config import get_settings
from ..deps import CurrentUser, get_current_profile
from ..services.sitrep import generate_sitrep
from ..supabase_client import get_service_client, get_user_client

router = APIRouter(prefix="/api/sitrep", tags=["sitrep"])


@router.post("")
def create_sitrep(profile: CurrentUser = Depends(get_current_profile)):
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")

    client = get_user_client(profile.access_token)
    alerts = (
        client.table("alerts")
        .select("event_type, severity, headline, area_codes, status, created_at")
        .eq("tenant_id", profile.tenant_id)
        .in_("status", ["localized", "approved", "broadcast"])
        .execute()
        .data
    )

    # citizen_reports has no client RLS policy; scope by tenant_id in code.
    service_client = get_service_client()
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    reports = (
        service_client.table("citizen_reports")
        .select("ai_category, ai_severity, ai_credibility, ai_summary_en, created_at")
        .eq("tenant_id", profile.tenant_id)
        .gte("created_at", since)
        .execute()
        .data
    )

    gauge_trend = (
        service_client.table("gauge_readings")
        .select("level_m, flood_stage_m, reading_at")
        .eq("station", "MUKDAHAN")
        .order("reading_at", desc=True)
        .limit(10)
        .execute()
        .data
    )

    result = generate_sitrep(alerts, reports, gauge_trend)

    row = {
        "tenant_id": profile.tenant_id,
        "content_th": result.get("content_th", ""),
        "content_zh": result.get("content_zh", ""),
        "generated_by": profile.user_id,
    }
    inserted = client.table("sitreps").insert(row).execute()
    return inserted.data[0]


@router.get("")
def list_sitreps(profile: CurrentUser = Depends(get_current_profile)):
    client = get_user_client(profile.access_token)
    return client.table("sitreps").select("*").order("created_at", desc=True).execute().data
