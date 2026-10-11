from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..deps import CurrentUser, get_current_profile
from ..supabase_client import get_user_client

router = APIRouter(prefix="/api/signals", tags=["signals"])


@router.get("")
def list_signals(profile: CurrentUser = Depends(get_current_profile)):
    client = get_user_client(profile.access_token)
    return (
        client.table("signals")
        .select("*")
        .eq("status", "new")
        .order("created_at", desc=True)
        .execute()
        .data
    )


class SignalUpdate(BaseModel):
    status: str


@router.patch("/{signal_id}")
def update_signal(signal_id: str, body: SignalUpdate, profile: CurrentUser = Depends(get_current_profile)):
    client = get_user_client(profile.access_token)
    result = client.table("signals").update({"status": body.status}).eq("id", signal_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Signal not found")
    return result.data[0]
