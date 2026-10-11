from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..deps import CurrentUser, get_current_profile
from ..services.chat_translate import translate_message
from ..supabase_client import get_user_client

router = APIRouter(prefix="/api/alerts/{alert_id}/messages", tags=["incident_messages"])


class MessageCreate(BaseModel):
    body: str


@router.get("")
def list_messages(alert_id: str, profile: CurrentUser = Depends(get_current_profile)):
    client = get_user_client(profile.access_token)
    return (
        client.table("incident_messages")
        .select("*")
        .eq("alert_id", alert_id)
        .order("created_at")
        .execute()
        .data
    )


@router.post("")
def create_message(alert_id: str, body: MessageCreate, profile: CurrentUser = Depends(get_current_profile)):
    """§W1 — one Claude call detects language + translates into th/zh-CN/en,
    stored alongside the original so the UI can toggle between them."""
    result = translate_message(body.body)
    client = get_user_client(profile.access_token)
    row = {
        "alert_id": alert_id,
        "tenant_id": profile.tenant_id,
        "profile_id": profile.user_id,
        "body_original": body.body,
        "lang_original": result.get("lang_original", "en"),
        "translations": result.get("translations", {}),
    }
    inserted = client.table("incident_messages").insert(row).execute()
    return inserted.data[0]
