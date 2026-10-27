# Interview notes

A running record of what was built, why, and how to explain it. Updated at the end of every phase. Answers are written to be said out loud, in my own words.

**Honesty rule:** if something is in "planned" or "explored," I don't say I built it. If Claude Code or Copilot wrote something, I say so, and explain what I checked and understood.

---

## The 30-second pitch

> Spawn is a live map of real-world experiences happening around you in Montréal: a free concert, a market, a pickup game. Each one has a type and a rarity, and you "catch" it by actually being there, within 150 metres while it's live. It started as a React and TypeScript prototype; now I'm adding a Python FastAPI backend that ingests the City of Montréal's open event data into PostgreSQL with PostGIS. The repo has unit tests, a GitHub Actions pipeline, and decision records for every architectural choice.

---

## Phase 1: frontend foundations (done, merged in PR #1)

### What exists
- React 19 + TypeScript (strict) + Vite, Leaflet map with OpenStreetMap tiles
- 52 Vitest unit tests; GitHub Actions CI (lint → typecheck → test → build)
- Branch + PR workflow, small commits, CI green before merging

### Questions I should be able to answer

**"Walk me through the architecture."**
The rules (distance, time windows, whether you can catch something, hidden spawns, XP) are pure functions in `src/lib/`. They take everything as arguments, including the current time and my position, and return a result. React components only display that result. Hooks handle the side effects: the clock ticking, GPS, saving to `localStorage`. ([ADR 0001](decisions/0001-pure-game-rules.md))

**"Why pure functions?"**
Because then I can test the rules with a fixed time and a fixed position: no browser, no GPS mocking, no flaky tests. The whole suite runs in about 2 seconds. It also means the logic doesn't get duplicated between the map and the list.

**"How do you compute distance?"**
The haversine formula: great-circle distance on a sphere with Earth's radius of 6,371 km. It accounts for longitude lines getting closer together away from the equator; one of my tests checks exactly that ratio (cos of the latitude). For a few hundred metres, the error compared to the true ellipsoid is negligible.

**"Tell me about a bug you found."**
Two, both found by writing tests, not by users:
1. `formatDistance(996)` showed "1000 m". I was choosing between metres and kilometres *before* rounding, so 996 passed the `< 1000` check and then rounded up to 1000. The fix was to round first, then choose the unit. I wrote the test first, watched it fail, then fixed it.
2. If `localStorage` contained valid JSON that wasn't a list, like `{}`, the app crashed on load because the code called `.some()` on an object. Now it checks `Array.isArray` and falls back to an empty collection.

**"What does your CI do?"**
On every pull request and every push to `main`: clean install with `npm ci` (exactly the lockfile versions), lint with oxlint (warnings fail too), typecheck with `tsc`, run the tests, build, and upload the build output as an artifact. The token is read-only, and a new push cancels the outdated run. There's no deployment step because the project is intentionally private.

**"Why `npm ci` and not `npm install`?"**
`npm ci` installs exactly what's in `package-lock.json` and fails if it doesn't match `package.json`. That makes CI reproducible. `npm install` can update the lockfile.

**"How do you test a React hook?"**
With Testing Library's `renderHook` in a jsdom environment (a simulated browser in Node). For `useCollection`, I test adding, de-duplication, that the collection survives a remount (simulating a page reload), reset, and corrupted storage.

**"Why merge commits instead of squash?"**
The PR had seven commits that each do one thing (add Vitest, move logic, fix bug 1, fix bug 2, tests, CI, docs). Keeping them makes the history explain itself, and `git bisect` can point at a single small change.

**"Branch protection?"**
GitHub's free plan doesn't enforce branch protection on private repositories, so CI can't technically block a merge. I treat "only merge when green" as a rule and documented that limitation instead of hiding it.

**"How did you use AI tools?"**
Claude Code scaffolded the prototype, set up Vitest and CI, and wrote most of the tests. I directed the features, reviewed each change, and the tests caught real bugs. Details per change are in [ai-assisted-development.md](ai-assisted-development.md). Copilot: see that file's usage log (only what I actually did).

### Things to understand well before an interview
- [ ] What the haversine formula does, and why longitude distances shrink with latitude
- [ ] The difference between unit tests (pure functions) and the jsdom hook test
- [ ] What each CI step catches that the others don't (lint vs typecheck vs tests vs build)
- [ ] Why `localStorage` access is wrapped in `try/catch` (private browsing modes can throw)
- [ ] How `useNow` causes countdowns to re-render every 15 seconds

---

## Phase 2a: backend and real data (built, PRs #3 to #7)

Design: [architecture/phase-2a-backend.md](architecture/phase-2a-backend.md). Decisions: [ADRs 0002–0007](decisions/README.md). Roadmap: [roadmap.md](roadmap.md).

### What exists

- **Python 3.12 backend** (`backend/`, managed with uv): FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, PostGIS.
- **Ingestion** of the City of Montréal's public events, run with `python -m spawn_api.ingest montreal-events`.
- **Read-only REST API**: nearby spawns (PostGIS distance, filters, keyset pagination), spawn detail, sources, ingestion runs.
- **Frontend** reads the API, with types generated from the OpenAPI schema, and falls back to sample data when the API is down.
- **CI**: backend job with a real PostGIS service container; migrations applied, `alembic check`, OpenAPI freshness, tests with coverage.

### Real numbers (measured, with their date)

| What | Number | Measured |
|---|---|---|
| Rows in the city's file | 5,254 | Oct 16, 2026 snapshot |
| Accepted / skipped / rejected | 2,868 / 2,372 / 14 | same snapshot, parser run locally |
| Main skip reasons | 1,729 already ended, 345 online, 298 not in-person (support groups, tech help, council...) | same |
| Rejections | 12 no coordinates, 2 outside Montréal | same |
| Events for young children (hidden by default) | 938 of the accepted | same |
| Parse time for the whole file | 0.14 s | on my laptop, one run |
| Backend tests | 79, 99% line coverage | CI, PR #6; also 79/79 locally on PostGIS, Oct 16 |
| Real ingestion, run twice | Run 1: 2,868 inserted. Run 2: 0 inserted, 0 updated, 2,868 unchanged | locally, Oct 16 (idempotence on real data) |
| Events shown in the app | 307 within 25 km over the next 7 days, 85 live at the time | locally, Oct 16, ~00:50 |
| Frontend tests | 61 | local and CI, PR #7 |

Only quote these with their context ("on the Oct 16 snapshot"). The city's file changes daily.

### Walk me through it (2 minutes)

> Every day the city publishes its events calendar as a GeoJSON file. My ingestion job downloads it, validates each row with a Pydantic model, cleans it, maps the city's 28 categories to my 7 types, and filters out what isn't an in-person experience. Each row comes out as Accepted, Skipped or Rejected, with a reason. Accepted rows are upserted into PostgreSQL on their natural key, the event's URL, and only written when a hash of their content changed, so the job is idempotent. Events that disappear are deactivated, never deleted. Every run is recorded with its counts. A FastAPI service then answers "what's within 5 km of me this week" with a PostGIS query that uses a spatial index, and the React app reads it through types generated from the OpenAPI schema.

### Questions I should be able to answer

**Python and design**

- **"Where did you use object-oriented design, and why?"**
  `EventSource` is an abstract base class with `fetch()` and `parse()`. The pipeline only talks to that interface, so a new source (sports programming, a curated file) is one new subclass. The loader is injected into the source (a Strategy): it downloads by default, and tests or the `--file` option pass a local reader. All SQL lives in repository classes, and the pipeline orchestrates them. I kept plain functions where a class adds nothing, such as cleaning helpers and the category mapping table.
- **"Why do parse results use Accepted / Skipped / Rejected instead of exceptions?"**
  Bad rows are expected, not exceptional: 14 rows out of 5,254 are invalid. Returning a value keeps one bad row from stopping the job, and the pipeline uses `match` (structural pattern matching) to count each case. Skipped and Rejected are deliberately separate, so on-purpose filtering never hides real data problems.
- **"Frozen dataclasses, slots, StrEnum: why?"**
  `NormalizedSpawn` is frozen, so nothing modifies it after validation, and `slots` makes it lighter. `StrEnum` values are plain strings ("music"), so they're identical in Python, in the database, in JSON and in the TypeScript types.

**Data pipeline**

- **"How did you deal with dirty data?"** With real examples:
  - Missing values were the *strings* `"nan"` and `"None"` (from a pandas export) → `blank_to_none` converts them.
  - NaN floats made the JSON invalid for PostgreSQL's `jsonb` → `json_safe` replaces them.
  - 8 rows had a positive longitude (a missing minus sign puts them in Kazakhstan), and 2 had latitude equal to longitude → rejected by a Montréal bounding box. I chose not to "fix" the sign automatically, because that would be guessing.
  - No ID column → the event URL is unique across all rows, so it is the external ID.
- **"What makes it idempotent?"**
  `INSERT ... ON CONFLICT (source_id, external_id) DO UPDATE ... WHERE content_hash IS DISTINCT` (in practice `!=`). A second run on the same file writes nothing; an integration test proves it. `RETURNING (xmax = 0)` tells inserted rows from updated ones.
- **"What if the download is broken?"**
  If the new snapshot has fewer than half as many usable rows as are currently active, the run fails with `SuspiciousSnapshotError` and nothing is deactivated, rather than wiping the map. The failed run is still recorded, because bookkeeping is committed in its own transaction.
- **"Why deactivate instead of delete?"**
  Spawn IDs stay stable, so anything that will reference them later (catches, photos) stays valid, and an event that comes back is simply reactivated (also tested).

**Databases, SQLAlchemy, PostGIS**

- **"geography or geometry?"**
  `geography(Point, 4326)`: computations happen on the Earth's surface, so `ST_Distance` returns metres directly. Geometry would compute in degrees on a flat plane.
- **"How is the nearby query fast?"**
  `ST_DWithin(location, point, radius)` can use the GiST index on `location`; `ST_Distance` is only computed for the rows that pass. A partial index on `ends_at WHERE is_active` helps the time filter.
- **"How do you paginate?"**
  Keyset pagination: the cursor is the last `(distance, id)` returned, and the next page asks for rows after it. Unlike `OFFSET`, it doesn't skip or repeat rows when data changes between pages, and later pages aren't slower. A test checks that paging through returns every spawn exactly once.
- **"How do you manage schema changes?"**
  Alembic migrations, versioned in Git. CI applies them to an empty database and runs `alembic check`, which fails if the ORM models and the migrations ever disagree.
- **"Enums: native PostgreSQL ENUM or not?"**
  Text plus a CHECK constraint. Adding a value later is a constraint change instead of `ALTER TYPE`, and the database still rejects bad values (tested by inserting "poetry" with raw SQL).
- **"How is each request's database access managed?"**
  A FastAPI dependency opens one session per request and always closes it. The session factory lives on `app.state`, so tests can point the app at another database without globals.

**REST API**

- **"Why /api/v1?"** So the contract can change later without breaking existing clients.
- **"How do you test time-dependent endpoints?"** The current time is a dependency (`get_now`), and tests replace it with `app.dependency_overrides`.
- **"How do the frontend and backend stay in sync?"** FastAPI generates the OpenAPI schema; it's committed as `backend/openapi.json`, and the TypeScript types are generated from it. CI fails if either is stale, so a renamed field breaks the frontend build instead of production.
- **"Errors?"** One JSON shape for 400, 404 and 422: `{"error": {"status", "message", "details"}}`, with the invalid field names in `details`.

**Testing and CI**

- **"Unit vs integration tests?"** Unit tests cover pure logic with no database (parsing rules on 26 real rows, cleaning, time zones, HTTP with a mock transport, API validation). Integration tests run against real PostGIS: the schema's constraints, the full ingestion job, the API.
- **"How do you keep integration tests independent?"** Each schema test runs in a transaction that is rolled back. The ingestion and API tests commit for real (the job manages its own transactions), so a fixture truncates the tables after each one.
- **"How does CI get a database?"** A GitHub Actions *service container* runs `postgis/postgis` next to the job, with a health check, and the tests receive its URL through an environment variable. The credentials only exist inside that throwaway container.

### Things that went wrong, and what I learned (good interview stories)

1. **Constraint names were prefixed twice** (`ck_spawns_ck_spawns_...`). Alembic re-applies the naming convention to names that already have it; `op.f()` marks a name as final. Found by rendering the migration SQL offline before any database existed.
2. **`alembic check` wanted to drop dozens of tables.** The `postgis/postgis` image also installs the TIGER geocoder and topology extensions. Fixed by managing only the tables our models declare.
3. **Lint passed locally but failed in CI.** A stale local Ruff cache still remembered a folder I had renamed. CI starts clean every time, which is exactly why it exists.
4. **Python time zone trap.** Subtracting two datetimes that share a `tzinfo` gives wall-clock time: Nov 1, 2026 looked like 24 hours instead of 25. Compare in UTC; PostgreSQL stores real instants anyway.
5. **A test fixture didn't test what I thought.** The rows I picked for "bad coordinates" were filtered out earlier (one had ended, one was online), so they never reached the coordinate check. Printing every row's outcome caught it.

### Who wrote what (be precise)

Claude Code wrote most of the backend and integration code from the design we agreed on; I made the decisions recorded in the ADRs (architecture, children filter, focus on three deliverables) and reviewed each PR. My own implementation work is tracked in [ai-assisted-development.md](ai-assisted-development.md); the `copilot-practice` stories are mine to write.

**Study plan to own this code** (read in this order, and run the tests after each):
1. `domain/catalog.py`, `domain/normalized.py`: the vocabulary and the normalized shape
2. `ingest/base.py`, `ingest/montreal_events.py` + `tests/unit/ingest/test_montreal_events.py`
3. `ingest/repository.py` (the upsert), `ingest/pipeline.py` + `tests/integration/test_ingestion.py`
4. `db/models.py`, `migrations/versions/20261016_0001_initial_schema.py`
5. `db/queries.py`, `api/spawns.py` + `tests/integration/test_api.py`
6. `src/api/client.ts`, `src/hooks/useSpawns.ts` on the frontend

### Things to understand well before an interview
- [ ] `INSERT ... ON CONFLICT DO UPDATE ... WHERE` and why it makes the job idempotent
- [ ] geography vs geometry, `ST_DWithin` vs `ST_Distance`, what a GiST index is
- [ ] Keyset vs offset pagination
- [ ] What `alembic upgrade`, `downgrade` and `check` each do
- [ ] SQLAlchemy 2.0 `Mapped[...]` models, sessions, and why one session per request
- [ ] FastAPI dependencies and `dependency_overrides`
- [ ] Pydantic validation (`BeforeValidator`) and how a validation error becomes a `Rejected`
- [ ] GitHub Actions service containers
- [ ] Time zones: aware datetimes, UTC, DST, `timestamptz`

### UI quality pass (Oct 26)

Two automated reviews, then fixes, each with a test:
- **Accessibility:** dialogs that close with Escape and take focus, a real `h1`, `aria-pressed` on filters, `aria-current` on tabs, `aria-describedby` linking the disabled Catch button to its reason, and a progress bar exposed as `role="progressbar"`.
- **Destructive action:** "Reset collection" used to erase everything on one tap; it now asks first.
- **Motion:** everything respects `prefers-reduced-motion`; pulses animate `opacity` (compositor) instead of `box-shadow` (repaint every frame).
- **Performance:** the map re-renders every 15 s for the countdowns, and was rebuilding all ~300 marker icons each time. Icons are now cached, so unchanged markers aren't touched.
- **Shareable links:** tab, filter and selected spawn live in the URL (`?spawn=…`), so a spawn can be sent to a friend. That's a growth feature as much as a UX one.

**"How do you test accessibility?"** Component tests query by *role and accessible name* (`getByRole('dialog', { name })`), the way a screen reader sees the page, so a missing label fails a test. Plus an automated review against a published checklist, and checking keyboard behaviour in a real browser.

### Visual identity (Oct 26)

**"How did you decide what it should look like?"** Not by taste alone. I ran an automated design review (Taste Skill), which deals styles measured on real product screens. I picked the dark style made for events and media because Spawn is a quick look at night, and adapted it: one accent colour used only on data (what's live right now), types told apart by icons instead of seven colours, primary buttons as white pills. The accent is Montréal's own: the orange of the metro's orange line. Decision recorded in [ADR 0008](decisions/0008-visual-identity.md).

**"What did you learn?"** That automated checks aren't enough. The inspector and the linter both passed, but *looking* at each screen found three bugs: the map flashing light grey while loading, the map credit drawing over the detail sheet, and an orange "0 Legendary" drawing the eye to nothing.

### Curated source and a test that deleted real data (Oct 26)

**"How easy is it to add a data source?"** One subclass. The curated source (13 hand-picked places like the Kondiaronk lookout or Schwartz's) implements the same `EventSource` interface as the city's data and goes through the same pipeline: validation, idempotent upsert, run report. Seasonal places (Tam-Tams, Beaver Lake skating) are skipped outside their months.

**"How did you get accurate coordinates?"** A catch only works within 150 m, so a wrong position makes a spawn uncatchable. I geocoded the real addresses with OpenStreetMap's Nominatim (respecting its 1 request/second policy) and kept only results where OSM returned the place's own name. Two ambiguous ones were dropped instead of guessed.

**A good failure story:** running the tests locally *deleted my real ingested events*. The tests empty their tables after each run, and they were pointed at the same database as development. The ingestion safety guard caught the symptom first (it refused to apply a 15-row test file next to 2,868 real rows). Fix: tests now always use a separate `spawn_test` database, created automatically, and assert they're on it.

**Real numbers move:** on Oct 26 the city's file had 4,757 rows → 2,386 accepted (vs 5,254 → 2,868 on Oct 16). Quote numbers with their date.

### Share card (Oct 26)

**"How do people share their progress?"** "Share My Dex" draws a 1080×1350 image (Instagram's portrait size) on a canvas, in the app's own colours and icons, then opens the phone's share sheet with the Web Share API; on a desktop without file sharing, it downloads the PNG. The numbers come from the same pure functions as the Dex, so the card can't disagree with the app.

**"How do you test a canvas?"** You don't in jsdom (there's no canvas). The stats and the caption are pure functions with unit tests; the share function is injected into the component, so its tests check behaviour (what's shared, the status message, the error path) without a real canvas; and the rendered image is checked by eye in a real browser. That last step caught a false caption: "Mostly Food" when four types were tied at one catch each.

### API container image (Oct 27)

**What:** `backend/Dockerfile` builds the API into an image; a CI job builds it on every backend change, starts it, waits for `/health`, and checks it doesn't run as root. It is never pushed (ADR 0009).

**"Why two stages?"** The first stage has uv and installs the exact locked versions; the second copies only the finished virtual environment. The final image has no build tools and no source tree: smaller, and less in it to attack.

**"Why copy `uv.lock` before the code?"** Docker caches each layer and reuses it if its inputs didn't change. Installing dependencies from the lockfile alone means a code change rebuilds in seconds; only a dependency change reinstalls packages.

**"Why a non-root user?"** If someone exploits the process, they get a user that can't change the image's files or install anything.

**"Why not push it?"** Nothing deploys it yet, and a registry means credentials to manage. Pushing to a registry (GHCR, or JFrog Artifactory at a bank) and letting Argo CD deploy from it are the next steps of a real pipeline, and each needs its own decision.

**"What does the smoke test not catch?"** It doesn't attach a database, so it proves the image starts and serves HTTP, not that it can reach PostGIS. The integration tests cover the database.

**Concepts to understand:** image vs container; layers and the build cache; multi-stage builds; `EXPOSE` vs `-p`; why `localhost` inside a container isn't your computer (`host.docker.internal`); `HEALTHCHECK`; what a registry is and why Artifactory exists.

### Technology status (keep this honest)

| Technology | Status |
|---|---|
| React, TypeScript, Vite, Leaflet, Vitest | Built |
| Python, FastAPI, Pydantic, SQLAlchemy, Alembic | Built (Phase 2a) |
| PostgreSQL + PostGIS | Built; verified in CI and locally (Docker Desktop, Oct 16) |
| GitHub Actions | Built: frontend and backend CI, PostGIS service container, contract checks |
| Claude Code | Used throughout, including `/code-review` on PRs from here on |
| GitHub Copilot | Exercises ready (SPAWN-12 rarity, readiness, all-day display); log only what I actually do |
| Jira, Confluence | Content and setup guide ready; setting them up is mine to do |
| Kafka | Planned as a separate lab, after the three deliverables |
| Docker image | Built: multi-stage API image, built and smoke-tested in CI, never pushed |
| Artifactory, Argo CD | Understood conceptually; not used, with reasons (the image is ready to be pushed and deployed when that's decided) |
