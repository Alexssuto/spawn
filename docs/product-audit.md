# Product audit (2026-10-27)

A review of `main` at `c38ab52`, written when the goal changed from "a portfolio of technologies" to "a complete product people use every day." The roadmap that follows from it is [product-roadmap.md](product-roadmap.md).

Numbers are measured on the local development database on 2026-10-27 (city file ingested 2026-10-26: 4,757 rows → 2,386 events, plus 11 curated places). "This week" means what the app actually requests: active, not ended, starting within 7 days, children's events excluded.

## Summary

The engineering base is solid: tested game rules, a clean ingestion pipeline with idempotent upserts, PostGIS queries, CI on every change. The product is not yet usable daily, mainly because of **the shape of the data** rather than the code:

| Finding | Measured | Effect on a user |
|---|---|---|
| Events stacked on the same point | 290 events this week on **99 pins**; up to 26 on one point | About 190 events can't be reached from the map: only the top pin is tappable |
| No venue name | 2,316 of 2,386 city events have none (`titre_adresse` empty) | The place shown is the borough ("Ville-Marie"), not "Bibliothèque Frontenac" |
| No times | The city file has dates only; every event is "all day" | A 10:00 story hour is "live" and catchable at 21:00; cards say "ends in 23h 28m" |
| Registration required | 122 of 290 this week (42%) need registration, 42 need a ticket | The app says "go catch it" for events you can't just walk into |
| Rarity is flat | Every spawn is Common (`rarity.py`, reserved task SPAWN-12) | The collection mechanic has no variation; the badge is noise |
| Demo catches count | Tapping the map moves you; catches made there are saved like real ones | The Dex proves nothing; "catch by being there" isn't true yet |
| Data goes stale | Ingestion runs only when started by hand (README says "every day") | New events never appear unless someone runs the job |

## 1. Frontend

**Works well**
- Map, Nearby list, details sheet, Dex, catch flow, share card, deep links (`?tab`, `?type`, `?spawn`).
- Accessibility pass done (PR #10): dialogs with focus management, Escape, `aria-pressed` filters, reduced motion, labelled markers.
- Visual identity is consistent (ADR 0008), tested at 375 px wide.

**Problems**
- **Stacked pins** (above). `MapView.tsx` draws one marker per event; markers at the same coordinates cover each other.
- **Time labels** (`lib/time.ts`): all-day events get minute countdowns ("ends in 23h 28m"), and multi-day events "ends in 20d". Upcoming events say "starts in 3d" with no date. (This is story SPAWN-25, reserved for the owner.)
- **Details sheet** (`SpawnSheet.tsx`) has no date, no address, no admission info (registration / ticket), no audience, no directions link.
- **Filters** are type-only. There is no "today / this weekend", no "free", no "include kids' events" toggle (the API already supports `free` and `include_children`).
- **Location**: if permission is denied, nothing is said; the app silently falls back to demo mode (`useLocation.ts` ignores the error callback). GPS accuracy is ignored, so a 500 m-accurate fix can still "catch" within 150 m.
- **Data is loaded once** (`useSpawns.ts`): an app left open overnight keeps yesterday's list (ended events disappear, new ones never come).
- **Dex** (`DexView.tsx`): "12/290" and "% explored" divide by this week's event count, which changes daily; the number means nothing and can go down. Per-type "x/y" has the same problem.
- **Language**: the content is French, the interface is English only.
- **Not installable**: no web app manifest, so it can't be added to a phone's home screen properly.

## 2. Backend

**Works well**
- Validation with Pydantic, explicit skip/reject reasons, a rejection report per run (`ingestion_runs`).
- Idempotent upsert with content hash; rows missing from the source are deactivated, not deleted; a guard refuses a suspiciously small snapshot.
- `GET /api/v1/spawns`: `ST_DWithin` on `geography` with a GiST index, distance ordering, keyset pagination; consistent error bodies.
- Integration tests on a real PostGIS (separate `_test` database since PR #12).

**Problems**
- **Admission is dropped**: the city's `inscription` field ("Sur inscription", "Avec billet", "Entrée libre") is stored only in `raw`, not exposed.
- **Series aren't recognised**: 1,121 active rows belong to 325 groups with the same title at the same place on different dates ("Heure du conte" × 24). Each date is a separate spawn, so a weekly activity can be caught every week for XP.
- **No scheduler**: the ingestion CLI exists, nothing runs it.
- **No readiness check** (`/health/ready`, SPAWN-4, reserved), no request logging, no rate limiting. Fine locally; needed before strangers use it.

## 3. Product functionality

| | Status |
|---|---|
| See real events near you on a map and in a list | Works (with the stacking and time problems above) |
| Catch an event by being within 150 m while it's live | Works with GPS; **also works by teleporting in demo mode** |
| Collection, XP, levels, share card | Works, on one device only (`localStorage`) |
| Rarity | Simulated: always Common |
| Hidden spawns | Work, but only one exists (a curated bar) |
| Accounts, sync between devices | Not built |
| Daily fresh data | Not built (manual job) |
| Public access | Not deployed (by decision, ADR 0006) |

What stops daily use, in order: you can't reach most events on the map; you can't tell when something actually happens or whether you can walk in; the data stops updating; nobody else can open the app.

## 4. Data quality

- **Dates**: correct as dates; stored as `[midnight, next midnight)` in Montréal time with DST handled. **Times don't exist in the source.** 82 descriptions mention an hour in free text (e.g. "10 h 30"), not enough to rely on.
- **Expired events**: hidden by the API (`ends_at > now`); 17 active rows had already ended because ingestion hadn't re-run, which is harmless to the API but shows staleness.
- **Long-running rows**: 18 rows run more than 120 days; the latest ends in **2031**. These are permanent programmes listed as events.
- **Duplicates**: no exact duplicates (the upsert key is the event's URL). Repeats are per-date occurrences of a series (above).
- **Coordinates**: inside a Montréal bounding box (out-of-box rows are rejected). The 102 distinct points of address-less events are real venues; three checked by reverse geocoding were Bibliothèque de Pierrefonds, Bibliothèque Frontenac, and 1180 Rue du Sussex (no name in OpenStreetMap). They look right, just unnamed.
- **Classification**: this week's mix is dominated by library programming. All active events: culture 1,404, social 390, music 340, sport 178, food 64, night 12, nature 9. Audience: 745 events for young children (hidden by default), 667 for everyone, 660 adults.
- **Missing fields**: price unknown for 6 events; venue name missing for 2,316; description always present.

## 5. Quality

- **Tests**: 89 frontend (Vitest), 91 backend (pytest, 98% coverage in CI), integration tests on PostGIS. Game rules are pure functions with tests next to them.
- **CI**: frontend (lint, typecheck, tests, build, generated-type freshness) and backend (Ruff, mypy strict, OpenAPI freshness, migrations up + `alembic check`, pytest). PR #14 adds a Docker image build (open).
- **Error handling**: API down → sample data with a visible "Sample data" chip and the reason. Share and storage failures are handled.
- **Performance**: fine at this size (≈300 markers, icon cache, `content-visibility` on cards). Pagination fetches all pages up front.
- **Security**: read-only API, GET-only CORS, no secrets in the repo, non-root container (PR #14). Nothing yet to protect user data because there is none on the server; catches can be forged trivially, which matters once catches mean something (quests, rewards).
- **Operations**: no scheduler, no logs, no monitoring, no backups (nothing to back up beyond re-ingestable data).

## 6. Production readiness

| Need | Today | For a first public release |
|---|---|---|
| Hosting | None (ADR 0006: private, not deployed) | Static frontend + API container + managed PostgreSQL with PostGIS + a daily scheduled job. Needs a new ADR, your approval and a budget alert first |
| Map tiles | `tile.openstreetmap.org` | The OSM tile usage policy doesn't allow an app's production traffic; a tile provider (usually with a key and a free tier) is needed |
| User persistence | Browser storage on one device | Acceptable for a first release if users are told; accounts later |
| Authentication | None | Not needed for a read-only first release; needed for sync, verified catches, quests |
| Monitoring | None | Uptime check on `/health`, error logging, an alert when ingestion fails or rejects unusually many rows |
| Costs | $0 | Small at this scale (a small API instance, a small managed database, tiles within a free tier), but **check current prices before deciding**: none are quoted here because they weren't measured |
