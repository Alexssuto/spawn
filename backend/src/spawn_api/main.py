"""FastAPI application factory.

Run locally with:  uv run uvicorn spawn_api.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker

from spawn_api.api import health, spawns
from spawn_api.api.errors import install_error_handlers
from spawn_api.db.engine import make_engine
from spawn_api.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Builds the app. Taking settings as an argument lets tests create apps with their own config."""
    settings = settings or get_settings()
    app = FastAPI(
        title="Spawn API",
        version="0.1.0",
        description="Real-world experiences happening around you in Montréal.",
    )
    # The engine connects lazily: creating it does not need the database to be up.
    app.state.session_factory = sessionmaker(make_engine(settings), expire_on_commit=False)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    app.include_router(health.router)
    app.include_router(spawns.router)
    return app


app = create_app()
