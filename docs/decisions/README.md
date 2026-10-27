# Architecture decision records

Each file records one technical decision: the context, what was decided, the alternatives that were considered, and the consequences. They are short on purpose. When a decision changes, a new record supersedes the old one instead of editing history.

These pages are also mirrored to Confluence (space **SPAWN**, page "Architecture decisions").

| # | Decision | Status |
|---|---|---|
| [0001](0001-pure-game-rules.md) | Game rules are pure functions in `src/lib/` | Accepted (Phase 1) |
| [0002](0002-python-fastapi-backend.md) | Backend in Python with FastAPI, in the same repository | Accepted |
| [0003](0003-postgresql-postgis.md) | PostgreSQL with PostGIS for storage and geo queries | Accepted |
| [0004](0004-batch-ingestion-open-data.md) | Daily batch ingestion from Montréal open data with idempotent upserts | Accepted |
| [0005](0005-kafka-as-separate-lab.md) | Kafka as a separate learning lab, not in the production path | Accepted |
| [0006](0006-private-read-only.md) | Private repository, no public deployment, read-only API | Accepted |
| [0007](0007-openapi-contract-generated-types.md) | The OpenAPI schema is the API contract; frontend types are generated from it | Accepted |
| [0008](0008-visual-identity.md) | Visual identity: true black, one accent hue on data, outline icons | Accepted |
| [0009](0009-api-container-image.md) | The API ships as a container image, built in CI and never pushed | Accepted |

Template: Context → Decision → Alternatives considered → Consequences.
