# 0004: Daily batch ingestion from Montréal open data with idempotent upserts

**Status:** Accepted (2026-10-16)

## Context

The City of Montréal publishes its public events calendar as a GeoJSON file, updated daily under CC BY 4.0. Profiling the real file (Oct 2026) showed about 5,250 rows, dates without times, missing values stored as the string `"nan"`, no ID column (but a unique `url_fiche`), and some rows without coordinates.

## Decision

Ingest with a **batch job** that runs extract → validate → clean → transform → filter → load → report:

- `url_fiche` is the `external_id`. Upsert on `(source_id, external_id)`, and only write when the row's content hash changed.
- Rows that disappear from the source are marked `is_active = false`, not deleted.
- Every run writes an `ingestion_runs` row with counts and a sample of rejected rows.
- Mapping (28 city categories → 7 Spawn types) and rarity rules are pure functions with unit tests.
- The raw row is kept in `spawns.raw` (jsonb) so spawns can be re-derived when rules change.

## Alternatives considered

- **Call the source on every API request.** No database needed, but slow, dependent on the city's uptime, and impossible to query by distance.
- **Streaming ingestion (Kafka).** Built for continuous, high-volume events from many producers. One file per day doesn't need it (see ADR 0005).
- **Delete and reload everything on each run.** Simple, but spawn IDs would change on every run, breaking links and future catches.

## Consequences

- Running the job twice is safe, which makes retries and scheduling simple.
- Data problems are visible in `ingestion_runs` instead of failing silently.
- Real spawns have no start time, so the UI needs an "all day" display.
- If the city changes its format, validation fails, the run is recorded as failed, and existing data stays in place.
