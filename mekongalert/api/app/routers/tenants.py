from fastapi import APIRouter, Depends

from ..deps import CurrentUser, get_current_profile
from ..supabase_client import get_service_client

router = APIRouter(prefix="/api/tenants", tags=["tenants"])


@router.get("")
def list_tenants(profile: CurrentUser = Depends(get_current_profile)):
    """Tenant existence/name isn't sensitive (already public via /public/areas);
    the RLS-scoped user client can only see the caller's own tenant row, so
    the Share-to-partner-agency picker (§6.5) needs the service role here."""
    client = get_service_client()
    tenants = (
        client.table("tenants")
        .select("id, slug, name_en, name_th, name_zh, country, default_lang")
        .execute()
        .data
    )
    return [t for t in tenants if t["id"] != profile.tenant_id]
