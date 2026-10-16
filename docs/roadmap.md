# Roadmap

Managed in **Jira** (project key `SPAWN`). This file is the source for the initial import: [`docs/jira/spawn-roadmap.csv`](jira/spawn-roadmap.csv). Once imported, Jira is the source of truth and this file only gives the overview.

Story points are planning estimates (1 = an hour or two, 5 = a few days of evenings), not measurements.

**Labels**
- `backend`, `frontend`, `data`, `devops`, `docs`, `atlassian`, `kafka`
- `copilot-practice`: stories meant for you to implement yourself, with GitHub Copilot's help. Claude Code reviews them instead of writing them.

## Current focus (Phase 2a)

A personal project can drown in tickets. For now, only three deliverables matter; everything else stays in the backlog:

1. **Working ingestion**: real Montréal events validated, normalized and upserted into PostGIS (E1 + E2)
2. **FastAPI API connected to PostGIS**: nearby spawns with real distance queries (E3)
3. **Real events in the app**: the frontend reads the API, with demo mode still working (E4)

Backend CI (E5) is built along the way, because every PR needs it. Atlassian setup (E6) is done by hand in parallel. The Kafka lab (E7) waits until the three deliverables work.

## Working agreement

1. Pick a story in Jira and move it to *In Progress*.
2. Create a branch named after the key: `feat/SPAWN-14-nearby-endpoint`.
3. Put the key in commit messages: `SPAWN-14 Add nearby spawns endpoint`.
4. Open a PR with the key in the title. The GitHub for Jira app links branch, commits, PR and CI status to the story.
5. Merge only when CI is green. Run `/code-review` in Claude Code on the PR before merging.
6. Move the story to *Done* and note anything interview-worthy in [`docs/interview-notes.md`](interview-notes.md).

## Epics and order of work

### Sprint 1: foundations
**E1 Backend foundation**
| # | Story | Pts | Labels |
|---|---|---|---|
| 1 | Scaffold `backend/` with uv, FastAPI, Ruff, mypy and pytest; `GET /health` | 3 | backend |
| 2 | Docker Compose with PostGIS; settings from environment; `.env.example` | 2 | backend, devops |
| 3 | SQLAlchemy models and first Alembic migration (sources, spawns, ingestion_runs, indexes) | 5 | backend |
| 4 | `GET /health/ready` checks the database | 1 | backend, copilot-practice |

**E5 Backend CI** (started in parallel so every later PR is checked)
| # | Story | Pts | Labels |
|---|---|---|---|
| 5 | CI job: Ruff, mypy, pytest with a PostGIS service container, `alembic upgrade head` | 3 | devops |
| 6 | Path filters so frontend and backend jobs run only when their code changes | 1 | devops |

**E6 Atlassian** (your setup work)
| # | Story | Pts | Labels |
|---|---|---|---|
| 7 | Create the Jira project, import this roadmap, install GitHub for Jira | 2 | atlassian |
| 8 | Create the Confluence space: architecture page + ADRs from `docs/decisions/` | 2 | atlassian, docs |

### Sprint 2: real data
**E2 Event ingestion**
| # | Story | Pts | Labels |
|---|---|---|---|
| 9 | Download the events GeoJSON (User-Agent, timeout, retries); commit a small fixture | 2 | data |
| 10 | Pydantic model for source rows; clean `"nan"` / `"None"` / empty values | 3 | data |
| 11 | Map the 28 city categories to Spawn types; exclude online events and council meetings | 2 | data, copilot-practice |
| 12 | Rarity rules from type and duration | 2 | data, copilot-practice |
| 13 | Dates to all-day timestamps in `America/Montreal` | 2 | data |
| 14 | Idempotent upsert with content hash; deactivate rows missing from the source | 5 | data, backend |
| 15 | Record every run in `ingestion_runs` with counts and rejected samples | 2 | data |
| 16 | CLI: `python -m spawn_api.ingest --source montreal-events` | 1 | data |
| 17 | Curated source: load the 20 hand-written experiences from a seed file | 2 | data |

### Sprint 3: API and frontend
**E3 REST API**
| # | Story | Pts | Labels |
|---|---|---|---|
| 18 | `GET /api/v1/spawns`: PostGIS distance, filters, cursor pagination | 5 | backend |
| 19 | `GET /api/v1/spawns/{id}` with a consistent 404 error body | 1 | backend |
| 20 | `GET /api/v1/catalog` (types, rarities, XP) | 1 | backend, copilot-practice |
| 21 | `GET /api/v1/sources` and `GET /api/v1/ingestion-runs` | 2 | backend |
| 22 | Error format and CORS for the local frontend | 1 | backend |

**E4 Frontend integration**
| # | Story | Pts | Labels |
|---|---|---|---|
| 23 | Generate TypeScript types from the OpenAPI schema | 2 | frontend |
| 24 | API client with loading/error states; fall back to sample data when the API is unreachable | 3 | frontend |
| 25 | All-day display ("Today", "Until Nov 3") instead of minute countdowns | 2 | frontend, copilot-practice |
| 26 | Show data source attribution (required by CC BY 4.0) | 1 | frontend, copilot-practice |
| 27 | Docker image build for the API in CI (built, not pushed) | 2 | devops |

### Sprint 4: Kafka lab (separate from production)
**E7 Kafka ingestion lab**
| # | Story | Pts | Labels |
|---|---|---|---|
| 28 | Docker Compose with a single Kafka broker (KRaft) and topic creation | 2 | kafka |
| 29 | Producer: publish source rows to `spawn.events.raw`, keyed by external ID | 2 | kafka |
| 30 | Consumer group: transform, upsert, publish to `spawn.events.normalized`, send failures to `spawn.events.dlq` | 5 | kafka |
| 31 | Lab write-up: experiments (stop a consumer, add one, replay from an offset) and what was observed | 2 | kafka, docs |

### Later
- **E8 Users and server-side catches.** Needed before photo verification. Accounts or anonymous device IDs, a `catches` table, and an authenticated `POST` endpoint.
- **E9 CLIP photo verification (Phase 2b).** Zero-shot verification of catch photos, threshold calibrated with a measured evaluation.
- Optional: **Jira Service Management** portal to report a wrong event (`atlassian`).
- Second data source: sports and leisure programming (`data`).
