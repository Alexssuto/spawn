# 0003: PostgreSQL with PostGIS for storage and geo queries

**Status:** Proposed

## Context

The core query is "spawns within X metres of me that haven't ended." Data is structured (every event has the same fields), relationships are simple (source → spawns → ingestion runs), and ingestion must be able to upsert safely.

## Decision

Use **PostgreSQL 16 with the PostGIS extension**. Store each spawn's position as `geography(Point, 4326)` with a GiST index, and query with `ST_DWithin` / `ST_Distance`. Run it locally with Docker Compose (`postgis/postgis` image) and as a service container in CI.

## Alternatives considered

- **Plain PostgreSQL with `lat` / `lng` columns.** Works at a few thousand rows (bounding box in SQL, exact distance in Python), but re-implements what PostGIS does correctly, including the curvature of the Earth.
- **SQLite.** Zero setup, but weaker concurrency, a different SQL dialect from production databases, and SpatiaLite is awkward to install on Windows.
- **MongoDB.** Has geo queries, but the data is relational and benefits from constraints (`UNIQUE (source_id, external_id)`), which drive idempotent ingestion.

## Consequences

- Nearby queries use an index instead of scanning every row, and distance is computed in the database.
- `INSERT ... ON CONFLICT (source_id, external_id) DO UPDATE` makes ingestion idempotent.
- `jsonb` keeps the raw source row next to the normalized one.
- Contributors need Docker to run the database locally.
