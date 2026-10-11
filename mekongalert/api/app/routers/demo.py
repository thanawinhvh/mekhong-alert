from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..config import get_settings
from ..deps import CurrentUser, get_current_profile
from ..ingest.mock_mekong import MockMekongAdapter
from ..ingest.usgs_quake import UsgsQuakeAdapter
from ..supabase_client import get_service_client, get_user_client

router = APIRouter(prefix="/api/demo", tags=["demo"])

FLOOD_STAGE_M = 12.5
SIMULATED_LEVEL_M = 12.15  # clears the flood_stage - 0.5m trigger threshold


@router.post("/simulate-rise")
def simulate_rise(profile: CurrentUser = Depends(get_current_profile)):
    settings = get_settings()
    if not settings.demo_mode:
        raise HTTPException(status_code=403, detail="DEMO_MODE is off")

    service_client = get_service_client()
    service_client.table("gauge_readings").insert(
        {
            "station": "MUKDAHAN",
            "level_m": SIMULATED_LEVEL_M,
            "flood_stage_m": FLOOD_STAGE_M,
            "reading_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()

    adapter = MockMekongAdapter(profile.tenant_id, SIMULATED_LEVEL_M, FLOOD_STAGE_M)
    drafts = adapter.fetch()
    if not drafts:
        return {"created": False}

    client = get_user_client(profile.access_token)
    row = {**drafts[0], "created_by": profile.user_id}
    result = client.table("alerts").insert(row).execute()
    return {"created": True, "alert": result.data[0]}


@router.post("/simulate-quake")
def simulate_quake(profile: CurrentUser = Depends(get_current_profile)):
    """§W4 — guarantees the multi-hazard demo beat works without depending on
    real seismicity on recording day."""
    settings = get_settings()
    if not settings.demo_mode:
        raise HTTPException(status_code=403, detail="DEMO_MODE is off")

    client = get_user_client(profile.access_token)
    areas = client.table("areas").select("code, lat, lng").eq("tenant_id", profile.tenant_id).limit(2).execute().data
    area_codes = [a["code"] for a in areas]
    center_lat = areas[0]["lat"] if areas else None
    center_lng = areas[0]["lng"] if areas else None

    row = {
        "tenant_id": profile.tenant_id,
        "source": "auto",
        "event_type": "earthquake",
        "severity": 3,
        "headline": "M5.8 earthquake detected near the border region",
        "description": "Simulated seismic report: magnitude 5.8 earthquake, shallow depth, felt across the region.",
        "source_lang": "en",
        "area_codes": area_codes,
        "center_lat": center_lat,
        "center_lng": center_lng,
        "created_by": profile.user_id,
    }
    result = client.table("alerts").insert(row).execute()
    return {"created": True, "alert": result.data[0]}


@router.post("/check-quakes")
def check_quakes(profile: CurrentUser = Depends(get_current_profile)):
    """Operator-triggered pull from the real USGS feed (§W4) — gated by
    INGEST_QUAKE since it's a live external call, not part of the core P0
    flow."""
    settings = get_settings()
    if not settings.ingest_quake:
        raise HTTPException(status_code=403, detail="INGEST_QUAKE is not enabled")

    client = get_user_client(profile.access_token)
    areas = client.table("areas").select("code").eq("tenant_id", profile.tenant_id).limit(2).execute().data
    area_codes = [a["code"] for a in areas]

    adapter = UsgsQuakeAdapter(profile.tenant_id, area_codes)
    drafts = adapter.fetch()
    created = []
    for draft in drafts:
        row = {**draft, "created_by": profile.user_id}
        result = client.table("alerts").insert(row).execute()
        created.append(result.data[0])
    return {"created_count": len(created), "alerts": created}
