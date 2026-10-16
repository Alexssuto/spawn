"""Application configuration, read from environment variables (and a local .env file in development)."""

from functools import lru_cache

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="SPAWN_", extra="ignore")

    # Local development default matches docker-compose.yml. Real deployments must set SPAWN_DATABASE_URL.
    database_url: PostgresDsn = Field(
        default=PostgresDsn("postgresql+psycopg://spawn:spawn@localhost:5432/spawn"),
    )
    # Browser origins allowed to call the API (the Vite dev server by default).
    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    """One Settings instance per process. Tests can call get_settings.cache_clear() to reload."""
    return Settings()
