# Architecture decision records

Each file records one technical decision: the context, what was decided, the alternatives that were considered, and the consequences. They are short on purpose. When a decision changes, a new record supersedes the old one instead of editing history.

These pages are also mirrored to Confluence (space **SPAWN**, page "Architecture decisions").

| # | Decision | Status |
|---|---|---|
| [0001](0001-pure-game-rules.md) | Game rules are pure functions in `src/lib/` | Accepted (Phase 1) |
| [0002](0002-python-fastapi-backend.md) | Backend in Python with FastAPI, in the same repository | Proposed |
| [0003](0003-postgresql-postgis.md) | PostgreSQL with PostGIS for storage and geo queries | Proposed |
| [0004](0004-batch-ingestion-open-data.md) | Daily batch ingestion from Montréal open data with idempotent upserts | Proposed |
| [0005](0005-kafka-as-separate-lab.md) | Kafka as a separate learning lab, not in the production path | Proposed |
| [0006](0006-private-read-only.md) | Private repository, no public deployment, read-only API | Proposed |

Template: Context → Decision → Alternatives considered → Consequences.
