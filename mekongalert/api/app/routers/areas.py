from fastapi import APIRouter, Depends

from ..deps import CurrentUser, get_current_profile
from ..supabase_client import get_user_client

router = APIRouter(prefix="/api/areas", tags=["areas"])


@router.get("")
def list_areas(profile: CurrentUser = Depends(get_current_profile)):
    client = get_user_client(profile.access_token)
    return client.table("areas").select("*").order("name_en").execute().data
