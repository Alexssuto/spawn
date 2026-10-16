# Spawn backend

Python service that ingests Montréal open data events into PostgreSQL/PostGIS and serves them through a read-only REST API. Design: [docs/architecture/phase-2a-backend.md](../docs/architecture/phase-2a-backend.md).

## Stack

Python 3.12 · FastAPI · Pydantic v2 · SQLAlchemy 2 · PostGIS · Alembic · httpx · uv · Ruff · mypy (strict) · pytest

## Setup

Requirements: [uv](https://docs.astral.sh/uv/) (it installs Python 3.12 for you) and Docker.

```bash
# from the repository root: start PostGIS
docker compose up -d

# from backend/
cp .env.example .env
uv sync                                         # .venv with the exact locked versions
uv run alembic upgrade head                     # create the schema
uv run python -m spawn_api.ingest montreal-events   # download and ingest real events
uv run uvicorn spawn_api.main:app --reload      # API on http://localhost:8000, docs at /docs
```

### Ingestion

```bash
uv run python -m spawn_api.ingest montreal-events                    # download the city's file
uv run python -m spawn_api.ingest montreal-events --file events.geojson  # use a local copy
```

Each run prints its counts (fetched, inserted, updated, unchanged, skipped, rejected, deactivated) and the reasons for skipped and rejected rows, and records them in the `ingestion_runs` table (also served at `GET /api/v1/ingestion-runs`). Running it twice in a row writes nothing the second time.

### API

| Method | Path | |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/api/v1/spawns?lat=..&lng=..` | nearby spawns; also `radius_m`, `type`, `live_only`, `days_ahead`, `include_children`, `free`, `limit`, `cursor` |
| GET | `/api/v1/spawns/{id}` | one spawn |
| GET | `/api/v1/sources` | data sources, licenses, last successful ingestion |
| GET | `/api/v1/ingestion-runs` | recent runs with counts |

After changing a response model, regenerate the contract and the frontend types:

```bash
uv run python -m spawn_api.openapi > openapi.json
cd .. && npm run api:types
```

## Checks (the same ones CI runs)

```bash
uv run ruff check            # lint
uv run ruff format --check   # formatting (use `ruff format` to fix)
uv run mypy                  # strict type checking
uv run alembic check         # models and migrations match (needs the database)
uv run pytest                # unit tests; integration tests too when SPAWN_DATABASE_URL is set
```

Integration tests (`tests/integration/`, marker `integration`) need PostGIS. They read `SPAWN_DATABASE_URL` from the **environment** (not from `.env`), so a missing database means a clear skip rather than a failure:

```bash
# PowerShell
$env:SPAWN_DATABASE_URL = "postgresql+psycopg://spawn:spawn@localhost:5432/spawn"; uv run pytest
```

In CI they always run, against a PostGIS service container.

## Layout

```
src/spawn_api/
├── main.py         create_app(): FastAPI app factory
├── settings.py     configuration from SPAWN_* environment variables
├── openapi.py      exports the OpenAPI schema (python -m spawn_api.openapi)
├── domain/         pure rules: types, rarities, normalized spawn, time windows
├── ingest/         EventSource interface, Montréal source, cleaning, HTTP, pipeline, repository, CLI
├── db/             engine, session dependency, ORM models, read queries
└── api/            routers, response models, error format, keyset pagination
migrations/         Alembic (versions/ holds each schema change)
tests/
├── fixtures/       26 real rows from the city's file, covering each edge case
├── unit/           no database needed
└── integration/    real PostGIS
```

## Troubleshooting

**`docker compose up` says the Docker daemon isn't running, or `docker_engine_linux` can't be found.** Docker Desktop must be running, and recent enough: version 4.11 (2022) fails to start its engine on current Windows. Update Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop/), start it, and check with `docker info`. If the CLI still targets the wrong engine, `docker context use desktop-linux` points it at Docker Desktop.
