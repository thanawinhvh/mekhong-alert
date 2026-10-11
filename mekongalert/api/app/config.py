from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    line_channel_access_token: str = ""
    line_channel_secret: str = ""
    liff_id: str = ""

    demo_mode: bool = True
    seed_user_password: str = ""
    ingest_quake: bool = False

    public_web_url: str = "http://localhost:5173"
    api_url: str = "http://localhost:8000"

    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
