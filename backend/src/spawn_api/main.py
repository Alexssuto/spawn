"""FastAPI application factory.

Run locally with:  uv run uvicorn spawn_api.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from spawn_api.api import health
from spawn_api.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Builds the app. Taking settings as an argument lets tests create apps with their own config."""
    settings = settings or get_settings()
    app = FastAPI(
        title="Spawn API",
        version="0.1.0",
        description="Real-world experiences happening around you in Montréal.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    return app


app = create_app()
