from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..deps import CurrentUser, get_current_profile
from ..supabase_client import get_service_client

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("")
def list_reports(status: str | None = None, profile: CurrentUser = Depends(get_current_profile)):
    """citizen_reports has no client RLS policy (webhook writes via service
    role, tenant unknown until a subscriber's area resolves it) — tenant
    scoping happens here in application code instead."""
    client = get_service_client()
    query = (
        client.table("citizen_reports")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", desc=True)
    )
    if status:
        query = query.eq("status", status)
    return query.execute().data


class ReportUpdate(BaseModel):
    status: str | None = None
    linked_alert_id: str | None = None


@router.patch("/{report_id}")
def update_report(report_id: str, body: ReportUpdate, profile: CurrentUser = Depends(get_current_profile)):
    client = get_service_client()
    existing = client.table("citizen_reports").select("tenant_id").eq("id", report_id).single().execute()
    if not existing.data or existing.data["tenant_id"] != profile.tenant_id:
        raise HTTPException(status_code=404, detail="Report not found")

    updates = body.model_dump(exclude_none=True)
    result = client.table("citizen_reports").update(updates).eq("id", report_id).execute()
    return result.data[0]
