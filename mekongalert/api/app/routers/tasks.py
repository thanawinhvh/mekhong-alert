from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..deps import CurrentUser, get_current_profile
from ..supabase_client import get_user_client

router = APIRouter(prefix="/api/alerts/{alert_id}/tasks", tags=["tasks"])


class TaskCreate(BaseModel):
    title: str
    assignee: str | None = None


class TaskUpdateBody(BaseModel):
    status: str | None = None
    assignee: str | None = None


@router.get("")
def list_tasks(alert_id: str, profile: CurrentUser = Depends(get_current_profile)):
    client = get_user_client(profile.access_token)
    return client.table("tasks").select("*").eq("alert_id", alert_id).order("created_at").execute().data


@router.post("")
def create_task(alert_id: str, body: TaskCreate, profile: CurrentUser = Depends(get_current_profile)):
    client = get_user_client(profile.access_token)
    row = {
        "alert_id": alert_id,
        "tenant_id": profile.tenant_id,
        "title": body.title,
        "assignee": body.assignee,
        "created_by": profile.user_id,
    }
    result = client.table("tasks").insert(row).execute()
    return result.data[0]


@router.patch("/{task_id}")
def update_task(
    alert_id: str, task_id: str, body: TaskUpdateBody, profile: CurrentUser = Depends(get_current_profile)
):
    client = get_user_client(profile.access_token)
    updates = body.model_dump(exclude_none=True)
    result = client.table("tasks").update(updates).eq("id", task_id).eq("alert_id", alert_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return result.data[0]
