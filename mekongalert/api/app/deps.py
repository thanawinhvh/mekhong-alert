import jwt
from fastapi import Header, HTTPException
from jwt import PyJWKClient
from pydantic import BaseModel

from .config import get_settings
from .supabase_client import get_user_client


class CurrentUser(BaseModel):
    user_id: str
    tenant_id: str
    role: str
    display_name: str | None = None
    access_token: str


_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    """New-style Supabase projects sign session JWTs with an asymmetric key
    (ES256) rather than a shared HS256 secret, so verification goes through
    the project's public JWKS endpoint instead of a static secret in .env."""
    global _jwks_client
    if _jwks_client is None:
        settings = get_settings()
        jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


def get_current_profile(authorization: str = Header(...)) -> CurrentUser:
    """Verify the Supabase JWT and resolve the caller's profile (tenant_id, role).
    The profile lookup itself goes through get_user_client (anon key + this JWT),
    so it is RLS-enforced, not a service-role bypass."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ")

    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc

    user_id = payload["sub"]
    client = get_user_client(token)
    result = (
        client.table("profiles")
        .select("tenant_id, role, display_name")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="No profile for this user")

    return CurrentUser(
        user_id=user_id,
        tenant_id=result.data["tenant_id"],
        role=result.data["role"],
        display_name=result.data.get("display_name"),
        access_token=token,
    )
