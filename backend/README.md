# Spawn backend

Python service that ingests Montréal open data events into PostgreSQL/PostGIS and serves them through a read-only REST API. Design: [docs/architecture/phase-2a-backend.md](../docs/architecture/phase-2a-backend.md).

## Stack

Python 3.12 · FastAPI · Pydantic v2 · SQLAlchemy 2 · PostGIS · Alembic · uv · Ruff · mypy (strict) · pytest

## Setup

Requirements: [uv](https://docs.astral.sh/uv/) (it installs Python 3.12 for you) and Docker.

```bash
# from the repository root: start PostGIS
docker compose up -d

# from backend/
cp .env.example .env
uv sync                                    # creates .venv with exact locked versions
uv run uvicorn spawn_api.main:app --reload # http://localhost:8000/docs
```

## Checks (the same ones CI runs)

```bash
uv run ruff check            # lint
uv run ruff format --check   # formatting (use `ruff format` to fix)
uv run mypy                  # strict type checking
uv run pytest                # unit tests; integration tests run when SPAWN_DATABASE_URL is set
```

Integration tests (`tests/integration/`, marker `integration`) need PostGIS. They are skipped with a clear message when `SPAWN_DATABASE_URL` isn't set, and always run in CI against a PostGIS service container.

## Layout

```
src/spawn_api/
├── main.py        create_app(): FastAPI app factory
├── settings.py    configuration from SPAWN_* environment variables
├── api/           HTTP routers
└── db/            engine, models, queries
tests/
├── unit/          no database needed
└── integration/   real PostGIS
```
