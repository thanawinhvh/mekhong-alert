from fastapi import APIRouter, Depends, Query

from ..deps import CurrentUser, get_current_profile
from ..supabase_client import get_service_client

router = APIRouter(prefix="/api/gauge", tags=["gauge"])


@router.get("")
def get_gauge(
    station: str = Query("MUKDAHAN"),
    _profile: CurrentUser = Depends(get_current_profile),
):
    """gauge_readings has no client RLS policy (§ migration 0001) — station
    readings aren't tenant-scoped, so this reads via the service role."""
    client = get_service_client()
    return (
        client.table("gauge_readings")
        .select("*")
        .eq("station", station)
        .order("reading_at")
        .execute()
        .data
    )
