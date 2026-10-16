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

## Phase 2a: backend and real data (proposed, not built yet)

Design: [architecture/phase-2a-backend.md](architecture/phase-2a-backend.md). Decisions: [ADRs 0002–0006](decisions/README.md). Roadmap: [roadmap.md](roadmap.md).

### Decisions to be able to defend

**"Why Python and FastAPI?"** ([ADR 0002](decisions/0002-python-fastapi-backend.md))
I want to strengthen Python, and the next feature, CLIP photo verification, is PyTorch anyway. FastAPI validates requests and responses from type hints with Pydantic and generates OpenAPI docs automatically. Django was heavier than needed for a read-only API; Node would have meant three runtimes once the ML part arrives.

**"Why PostgreSQL with PostGIS?"** ([ADR 0003](decisions/0003-postgresql-postgis.md))
The main query is "what's within X metres of me that hasn't ended." PostGIS does this with a spatial (GiST) index and correct distances on the Earth's surface, inside the database. The data is relational, and a unique constraint on `(source, external_id)` is what makes ingestion safe to re-run.

**"How does the ingestion work?"** ([ADR 0004](decisions/0004-batch-ingestion-open-data.md))
A batch job: extract → validate → clean → transform → filter → load → report. Each step can be explained with a real finding from the data:
- No ID column, but the event URL is unique across all 5,254 rows → used as the external ID.
- Missing values are the *string* `"nan"` → a cleaning step turns them into real nulls.
- Dates have no times → spawns are "all day" in the Montréal time zone.
- 106 rows have no coordinates → rejected and counted, not silently dropped.
- The download fails without a User-Agent header (`RBAC: access denied`) → the client always sends one.

**"What does idempotent mean here?"**
Running the job twice gives the same database as running it once. Rows are upserted on their natural key, and only written when a hash of their content changed. That makes retries and scheduling safe.

**"Why not Kafka?"** ([ADR 0005](decisions/0005-kafka-as-separate-lab.md))
One file per day, one producer, one consumer: Kafka would add a broker to operate without solving a problem I have. It becomes worth it with many sources pushing updates continuously, or several consumers needing the same events. I'm building it as a separate lab with the same transform code, to learn partitions, keys, consumer groups, offsets and dead-letter topics on real data.

**"Why is the API read-only?"** ([ADR 0006](decisions/0006-private-read-only.md))
Nothing in Phase 2a needs to write through HTTP; ingestion runs from the command line. No write endpoints means no authentication to get wrong yet. That changes when server-side catches arrive.

### Technology status (keep this honest)

| Technology | Status |
|---|---|
| React, TypeScript, Vite, Leaflet, Vitest | Built |
| GitHub Actions | Built (frontend CI) |
| Claude Code | Used throughout |
| Python, FastAPI, PostgreSQL/PostGIS, Alembic | Designed, not built yet |
| Jira, Confluence | Content prepared; setup is mine to do |
| Kafka | Planned as a separate lab |
| GitHub Copilot | Set up and exercises planned; log only what I actually do |
| Artifactory, Argo CD | Understood conceptually; not used, with reasons |
