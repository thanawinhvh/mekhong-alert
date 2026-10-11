from supabase import Client, create_client

from .config import get_settings


def get_service_client() -> Client:
    """Service-role client — bypasses RLS. Use only for webhooks/broadcast fan-out
    and the few tables (subscribers, citizen_reports, gauge_readings) that have
    no client-facing RLS policies (see migration 0001_init.sql)."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_user_client(access_token: str) -> Client:
    """Anon-key client carrying the caller's JWT, so every query is subject to RLS
    exactly as if the frontend queried Postgres directly."""
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(access_token)
    return client
