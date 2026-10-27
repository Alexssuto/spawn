# Product roadmap

From the [product audit of 2026-10-27](product-audit.md). The goal is a complete product people use every day in Montréal, not more technologies. Rules for every item: no new technology unless the item can't be done without it, no rewrite of working parts, tests with every rule change, and the repository stays private.

The original engineering backlog (Jira import) is still in [roadmap.md](roadmap.md). Items marked **(yours)** are `copilot-practice` stories reserved for the owner; Claude Code reviews them unless asked to build them.

| | Goal |
|---|---|
| **P0** | Bugs and gaps that make the MVP unusable |
| **P1** | Needed for a polished first release |
| **P2** | What makes Spawn distinctive and fun |
| **P3** | Later: AI agents, photo verification, cloud |

---

## P0: usable MVP

### P0-1. Group events that share a place into one venue pin *(in progress: this PR)*

- **Problem**: 290 events this week sit on 99 points; only the top marker at each point is tappable, so about 190 events are unreachable from the map.
- **Files**: `src/lib/venues.ts` (new), `src/components/MapView.tsx`, `src/components/VenueSheet.tsx` (new), `src/App.tsx`, `src/index.css`.
- **Approach**: a pure function groups visible spawns by coordinates (rounded to about 1 m) and orders each group (live before upcoming, not-yet-caught first, rarer first). The map draws one pin per group, with a count when there's more than one. Tapping a single pin opens the event as today; tapping a group opens a list of its events, and each opens the usual details sheet. Closing the details returns to the list.
- **Acceptance**: every event in the Nearby list can be reached from the map; a group pin shows its count and looks like its best event (live, rarity); type filters apply before grouping; `?spawn=` links still open the right event.
- **Dependencies**: none.
- **Tests**: unit tests for grouping and ordering (`venues.test.ts`); component tests for the venue list (opens an event, Escape closes, counts); manual check on the map with real data.

### P0-2. Honest "when": dates instead of countdowns for all-day events **(yours: SPAWN-25)**

- **Problem**: all-day events say "ends in 23h 28m"; upcoming ones say "starts in 3d" with no date.
- **Files**: `src/lib/time.ts`, `src/lib/time.test.ts`, `SpawnCard.tsx`, `SpawnSheet.tsx`.
- **Approach**: when `allDay` is true: "Today", "Tomorrow", "Sat Nov 1", "Until Nov 3". Keep countdowns for timed events (curated, future sources).
- **Acceptance**: no minute countdown is shown for an all-day event; upcoming events show a weekday and date; multi-day events show their last day.
- **Dependencies**: none.
- **Tests**: `time.test.ts` cases for today, tomorrow, later this week, multi-day, the midnight boundary, and a DST day.

### P0-3. Admission: show registration and tickets

- **Problem**: 42% of this week's events require registration and 14% a ticket; the app presents them all as walk-in.
- **Files**: `backend/src/spawn_api/domain/catalog.py` (an `Admission` enum), `ingest/montreal_events.py` (map `inscription`), `db/models.py` + a new Alembic migration, `api/schemas.py`, `openapi.json`, `src/api/schema.d.ts` (regenerated), `src/api/client.ts`, `src/data/spawns.ts`, `SpawnSheet.tsx`, `SpawnCard.tsx`.
- **Approach**: `admission: drop_in | registration | ticket | null`. The sheet says "Registration required" or "Ticket required" with the source link as the call to action; the card shows a small label. Optional `walk_in_only` query filter.
- **Acceptance**: the three city values map correctly, unknown values reject with a reason (same pattern as categories); the UI never shows "Catch It" without saying when registration is required.
- **Dependencies**: none.
- **Tests**: parser unit tests for each value and an unknown one; migration + `alembic check` in CI; API integration test for the field and the filter; component test for the label.

### P0-4. Catches only count with real GPS

- **Problem**: in demo mode you can teleport next to anything and catch it.
- **Files**: `src/lib/spawnView.ts` (+ test), `src/hooks/useLocation.ts`, `src/App.tsx`, `SpawnSheet.tsx`.
- **Approach**: `viewSpawn` takes the location source; `canCatch` requires `gps`. Demo mode stays for exploring ("Turn on location to catch"). Also expose GPS accuracy and refuse catches when accuracy is worse than the catch radius ("Waiting for a better GPS fix"). Handle a denied permission with a visible message.
- **Acceptance**: no catch is possible after a teleport; a denied permission shows how to enable location; poor accuracy disables catching with a reason.
- **Dependencies**: none.
- **Tests**: `spawnView.test.ts` for demo vs GPS and accuracy limits; component test for the hint text.

### P0-5. Daily ingestion that runs by itself

- **Problem**: data is only as fresh as the last manual run.
- **Files**: `backend/src/spawn_api/ingest/__main__.py` (exit codes already exist), hosting config (P0-6), `README.md` (currently says "every day": corrected in this PR).
- **Approach**: a scheduled job on the chosen host runs `python -m spawn_api.ingest montreal-events` then `curated` once a day, from the same image as the API (PR #14). A failed run or an unusual rejection rate alerts the owner.
- **Acceptance**: a new event appearing in the city's file is in the app the next day without anyone running anything; a failed run is noticed within a day.
- **Dependencies**: P0-6.
- **Tests**: existing pipeline tests; a manual dry run of the scheduled job on the host.

### P0-6. Decide where Spawn runs (needs your approval)

- **Problem**: nobody else can open the app (ADR 0006).
- **Files**: a new ADR superseding parts of 0006; deployment config; `vite.config.ts` / env for the API URL.
- **Approach**: the smallest setup that works: static hosting for the frontend, one small container for the API (PR #14's image), managed PostgreSQL with PostGIS, the daily job, a tile provider (the OpenStreetMap tile servers' policy doesn't allow an app's production traffic). Set a budget alert before anything is created. The repository stays private either way.
- **Acceptance**: an ADR you approved, with the host, the monthly cost from the providers' current price pages, and how secrets are stored.
- **Dependencies**: your decision.
- **Tests**: a smoke test against the deployed `/health` and one `/api/v1/spawns` query.

---

## P1: polished first release

### P1-1. Rarity from facts **(yours: SPAWN-12)**

- **Problem**: everything is Common.
- **Files**: `backend/src/spawn_api/domain/rarity.py`, `tests/unit/test_rarity.py`.
- **Approach** (proposed spec): by how often something happens: a weekly series = Common, monthly = Uncommon, one-off = Rare, annual or seasonal = Legendary. Needs P1-2 to know the series.
- **Acceptance**: a documented rule per rarity; this week's data isn't 100% one rarity; rarity never depends on who pays.
- **Dependencies**: P1-2.
- **Tests**: one test per rule including boundaries; re-ingestion shows each row updated once, then unchanged.

### P1-2. Recognise series (same activity, many dates)

- **Problem**: 325 series make up 1,121 rows; "Heure du conte" appears 24 times and can be caught every week.
- **Files**: `ingest/montreal_events.py` or `pipeline.py`, `db/models.py` + migration (`series_key`), `api/schemas.py`, `src/lib/spawnView.ts`, `src/hooks/useCollection.ts`.
- **Approach**: `series_key` = normalised title + venue point. The Nearby list shows a series once ("Next: Tue Nov 4 · 3 more dates"). Catching a series counts once in the Dex (the catch stores `seriesKey`); later visits could count toward a streak (P2).
- **Acceptance**: no series appears twice in the list for the same week; catching one date of a series marks the series caught.
- **Dependencies**: none (P1-1 builds on it).
- **Tests**: key normalisation unit tests (accents, case, spacing); integration test that two dates share a key; collection test for one catch per series.

### P1-3. Venue names

- **Problem**: 2,316 city events have no venue name; the app shows the borough.
- **Files**: `backend/src/spawn_api/ingest/seeds/venues.json` (new), `ingest/montreal_events.py`, `api/schemas.py`.
- **Approach**: the address-less events use about 100 distinct points (mostly libraries and maisons de la culture). Name them once in a reviewed seed file (reverse-geocoded from OpenStreetMap, checked by hand, ODbL attribution), matched by coordinate during ingestion. Unknown points keep the borough.
- **Acceptance**: the top 50 venues by event count have a name; the venue list sheet (P0-1) shows it.
- **Dependencies**: P0-1 benefits from it.
- **Tests**: matching tolerance unit test; ingestion test that a known point gets its name.

### P1-4. "When" and "free" filters, and a day-grouped list

- **Files**: `src/lib/` (a pure `matchesWhen` rule + test), `src/lib/urlState.ts`, `src/App.tsx`, `src/index.css`.
- **Approach**: chips: Now · Today · This weekend · Free. The Nearby list gets day headings ("Today", "Saturday"). A switch for kids' events uses the API's existing `include_children`.
- **Acceptance**: each filter is in the URL; "This weekend" covers Fri evening to Sun in Montréal time.
- **Dependencies**: P0-2 (date labels).
- **Tests**: `matchesWhen` unit tests across week boundaries and DST; URL round-trip tests.

### P1-5. Complete details sheet

- **Files**: `SpawnSheet.tsx`, `src/api/client.ts`, `src/data/spawns.ts`.
- **Approach**: dates, address, admission (P0-3), audience, price, the source link, and a "Directions" link (a maps URL built from the coordinates; no new library).
- **Acceptance**: a user can decide whether and how to go without leaving the app, except to register.
- **Dependencies**: P0-3.
- **Tests**: component tests for each optional field present and missing.

### P1-6. Keep data fresh in an open app

- **Files**: `src/hooks/useSpawns.ts` (+ test).
- **Approach**: refetch when the app comes back to the foreground after 30 minutes, and when the user has moved more than 5 km from the last fetch centre.
- **Acceptance**: an app left open overnight shows today's events in the morning without a reload.
- **Dependencies**: none.
- **Tests**: hook tests with fake timers and a fake `visibilitychange`.

### P1-7. A meaningful Dex

- **Files**: `DexView.tsx`, `src/lib/progression.ts` (+ test).
- **Approach**: remove "x/290" and "% explored" (the denominator changes daily). Show counts by type and rarity, boroughs visited, venues visited, and first catch per type. Keep the share card consistent.
- **Acceptance**: no number in the Dex can go down by itself.
- **Dependencies**: P1-2 for series counts.
- **Tests**: unit tests for the new stats; component test for the empty state.

### P1-8. French interface

- **Files**: `src/i18n/` (two typed dictionaries, no library), components with visible text.
- **Approach**: French by default when the browser is French, English otherwise, with a switch in the Dex.
- **Acceptance**: no English string is left in French mode; tests fail if a key is missing in either language.
- **Dependencies**: best done after P0/P1 text settles.
- **Tests**: a dictionary completeness test; component tests in both languages for one screen.

### P1-9. Installable on a phone

- **Files**: `public/manifest.webmanifest`, icons in `public/`, `index.html`.
- **Approach**: a web app manifest and icons only (no service worker yet, so nothing new to maintain).
- **Acceptance**: "Add to Home Screen" opens Spawn full-screen with its icon on iOS and Android.
- **Dependencies**: P0-6 (HTTPS hosting) to test on a real phone.
- **Tests**: Lighthouse installability check, run manually.

### P1-10. Minimal operations

- **Files**: `backend/src/spawn_api/api/health.py` (readiness, **yours: SPAWN-4**), `main.py` (request logging), host config.
- **Approach**: readiness checks the database; one log line per request; an uptime check on `/health/ready`; an alert on a failed ingestion.
- **Acceptance**: you hear about an outage or a failed ingestion without opening the app.
- **Dependencies**: P0-6.
- **Tests**: unit test for readiness with the database down (503) and up (200).

---

## P2: distinctive and fun

Lighter detail on purpose: each gets its own plan before it's built.

| Item | What | Main files / approach | Depends on |
|---|---|---|---|
| **P2-1. Local nights content** | Recurring bar and venue nights (jazz Tuesdays, open mics), entered by hand at first, Plateau / Mile End first | `ingest/seeds/curated.json` pattern, with real schedules confirmed with the venue (never invented) | P1-2 |
| **P2-2. Venue submissions** | Venues submit events through a form; you approve them | A small authenticated admin endpoint + review screen | Accounts (P2-4) |
| **P2-3. Collections and quests** | "Five libraries", "Every borough", "A Legendary in each season" | Pure rules in `src/lib/quests.ts` with tests; shown in the Dex | P1-1, P1-2, P1-3 |
| **P2-4. Accounts and server-side catches** | Collection synced across devices; catches checked on the server (time, place, accuracy) | Auth provider decision (ADR), `catches` table, write endpoints | P0-6 |
| **P2-5. QR check-in at partner venues** | A venue's QR code proves presence where GPS is weak (indoors) | Signed, rotating codes; server verification | P2-4 |
| **P2-6. Exclusive quests** | Reach a goal to unlock an event you host | Quest rules + server checks + personal QR at the door | P2-3, P2-4, P2-5 |
| **P2-7. Streaks and weekly goals** | "3 weeks in a row" without punishing a missed week too hard | Pure rules in `src/lib/` | P1-2 |
| **P2-8. Ticketmaster source** | Big shows from the Discovery API | New `EventSource`; needs your API key, stored as a secret | P0-6 |
| **P2-9. Nearby rare alerts** | "Something rare is 300 m away" | Web push needs a service worker; only once installed (P1-9) | P1-1, P1-9 |

## P3: later

| Item | What | Note |
|---|---|---|
| **P3-1. Poster-reading agent** | A venue photographs its poster; an AI model proposes a structured event; a human approves | Evaluate on a labelled set of real posters before trusting it; Claude or Bedrock |
| **P3-2. Event times from detail pages** | Recover times the city's file lacks | Only if the city allows it or offers it; ask before collecting from their pages |
| **P3-3. CLIP photo verification** | A photo of the place as extra proof of a catch | After server-side catches (P2-4); privacy rules first |
| **P3-4. AWS deployment** | If the P0-6 host is outgrown | New ADR and budget |
| **P3-5. Kafka lab** | Learning exercise only | Not needed by the product (ADR 0005) |
