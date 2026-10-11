from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .deps import CurrentUser, get_current_profile
from .routers import alerts, areas, demo, gauge, line_webhook, messages, public, reports, signals, sitrep, tasks, tenants

settings = get_settings()

app = FastAPI(title="MekhongAlert API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(alerts.router)
app.include_router(areas.router)
app.include_router(gauge.router)
app.include_router(public.router)
app.include_router(reports.router)
app.include_router(line_webhook.router)
app.include_router(demo.router)
app.include_router(tenants.router)
app.include_router(messages.router)
app.include_router(sitrep.router)
app.include_router(signals.router)
app.include_router(tasks.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/me")
def me(profile: CurrentUser = Depends(get_current_profile)):
    """Proves the auth wiring end-to-end: JWT verify -> RLS-scoped profile lookup."""
    return profile.model_dump(exclude={"access_token"})
