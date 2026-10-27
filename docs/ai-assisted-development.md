# AI-assisted development

Spawn is developed with two AI tools that do different jobs. This page records what each one was actually used for, so it's clear which work came from where.

| Tool | Where it runs | Best at |
|---|---|---|
| **Claude Code** | Terminal / desktop app, works across the whole repo | Multi-file changes, architecture, writing and running tests, Git and GitHub operations, code review |
| **GitHub Copilot** | Inside VS Code, as you type | Inline completions, quick questions about the open file, small focused edits |

**Rule for both:** nothing is merged without being read, understood, and passing CI.

## Claude Code: log of contributions

| Change | What Claude Code did | What was checked |
|---|---|---|
| Initial prototype | Scaffolded the Vite project; wrote the map, list, catch flow and Dex from a feature description | Clicked through the full flow in a mobile-size browser |
| Architecture | Separated game rules into pure functions in `src/lib/` so they can be tested without a browser | Tests run in Node in under 2 seconds |
| Unit tests | Set up Vitest and wrote 52 tests for distance, time windows, catch rules, progression, storage and data integrity | All pass locally and in CI |
| Bugs found by tests | `formatDistance(996)` returned `"1000 m"`; a non-list value in `localStorage` crashed the app on load. Each was fixed in its own commit, with a regression test | Tests were red before the fix and green after |
| CI | Wrote the GitHub Actions workflow (lint → typecheck → test → build) | Runs on the Phase 1 pull request |
| Repository hygiene | Checked tracked files for secrets before the first push, hardened `.gitignore`, created the private repo | Confirmed through the GitHub API that the repo is private |
| Phase 2a design | Profiled the real city data file (5,254 rows) and proposed the architecture, schema, endpoints and ADRs | The owner reviewed and approved each decision before any code (PR #2) |
| Backend skeleton and schema | uv project, FastAPI app factory, settings, SQLAlchemy models, Alembic migration, CI with a PostGIS service container | CI green; `alembic check` proves models and migrations match (PRs #3, #4) |
| Ingestion | Pydantic validation, cleaning, category mapping, idempotent upsert, deactivation, snapshot guard, CLI, 26-row real fixture | Unit tests + integration tests on PostGIS; parser run on the full file (PR #5) |
| REST API | Nearby query with PostGIS and keyset pagination, detail, sources, ingestion runs, error format | 79 backend tests, 99% coverage in CI (PR #6) |
| Frontend integration | OpenAPI export, generated TypeScript types, API client, demo fallback, attribution | 61 frontend tests; demo fallback checked in the browser (PR #7) |
| Local end-to-end check | Fixed Docker Desktop (an empty 2023 disk file blocked the engine), ran migrations, all 79 backend tests, real ingestion twice, the API, and the app in the browser | Real events on the map with the CC BY attribution; second ingestion run changed nothing |
| UI quality pass | Reviewed the frontend with two installed skills (Vercel's Web Interface Guidelines, and Taste Skill's in-browser inspector), then fixed the findings: reset confirmation, keyboard/Escape/focus on dialogs, ARIA, reduced motion, map icon caching, shareable links | 17 new tests (78 frontend total); deep links and Escape checked in the browser; Taste Skill FAILs went from 5 to 3 (the remaining ones are the visual identity, handled separately) |
| Visual identity | Dealt a style with Taste Skill (`draw.mjs --app`), chose `true-black-flat`, replaced emoji and per-type colours with an icon set and one accent, self-hosted Inter, patched a Vite advisory | Taste linter 0 FAIL / 0 WARN, inspector 5 → 1 FAIL on dev and production builds; every screen checked by screenshot, which found 3 bugs the tools missed (ADR 0008) |
| Curated source | Added 13 hand-picked evergreen places as a second `EventSource`, positions geocoded with Nominatim and matched by name; moved integration tests to a separate `_test` database after a local run wiped real ingested events | Unit + integration tests; dev data checked intact after a full test run (2,386 city events + 11 curated) |
| Share card | Dex share image drawn on a canvas in the app's tokens and icons, shared with the Web Share API (download fallback); stats and caption as tested pure functions | 89 frontend tests; the rendered PNG was looked at, which found a false "Mostly Food" caption on a four-way tie (fixed, with a test reproducing it) |
| API container image | Wrote the two-stage Dockerfile (uv, locked dependencies, non-root user, healthcheck), `.dockerignore`, and a CI job that builds and smoke-tests the image without pushing it; ADR 0009 | Built and run locally against the dev database: `/health` OK, real events served, user `spawn`, migrations at head, curated seed packaged, Docker status healthy, 224 MB |
| Mistakes caught along the way | Doubled constraint names, Alembic wanting to drop PostGIS's own tables, a stale Ruff cache, a time zone test that measured wall-clock time, fixture rows that never reached the rule under test | Each was found by a check (offline SQL render, CI, tests) and fixed in its own commit |

Claude Code features used: project memory (`CLAUDE.md`), running tests and builds, Git/GitHub CLI operations, and browser checks of the running app. `/code-review` will be used on pull requests from here on.

## GitHub Copilot: setup and how to use it

### Setup

1. **Get access.** As a student, apply for the [GitHub Student Developer Pack](https://education.github.com/pack), which includes Copilot Pro for free. Without it, the limited **Copilot Free** plan works for getting started.
2. In VS Code, install the **GitHub Copilot** extension (Copilot Chat comes with it) and sign in with the GitHub account that owns this repo.
3. Open the `spawn` folder in VS Code (`code .` from the project folder).

### Features to actually use

| Feature | How | Try it on Spawn |
|---|---|---|
| Inline suggestions | Type and press `Tab` to accept, `Esc` to reject | Start writing a new test in `src/lib/time.test.ts` and see what it proposes |
| Copilot Chat | `Ctrl+Alt+I` | Select `levelFromXp` and ask "explain this function and its edge cases" |
| `/tests` | In Chat, with a function selected | Generate cases for `formatDuration`, then delete the ones that are wrong or redundant |
| `/explain` | In Chat | Ask it to explain the haversine formula in `geo.ts` |
| Edit / agent mode | The mode selector in the Chat panel | Small, scoped multi-file edits |
| Commit messages | Sparkle icon in the Source Control panel | Compare its message with what you would write |

### Your Copilot tasks for Phase 2a

These stories are labeled `copilot-practice` in the roadmap and were deliberately left unimplemented. Write the code yourself with Copilot helping; Claude Code reviews the PR (`/code-review`) instead of writing it. Make sure you can explain every line.

**1. SPAWN-12: rarity rules** (Python, backend). The best first task.
- File: `backend/src/spawn_api/domain/rarity.py`. It returns `COMMON` for everything today; its docstring suggests rules.
- Start with the tests: create `backend/tests/unit/test_rarity.py` with one test per rule, including the boundaries (exactly 1 day, exactly 30 days). Ask Copilot Chat `/tests` for ideas, then delete the cases that are wrong or redundant.
- Implement until the tests pass: `cd backend && uv run pytest tests/unit/test_rarity.py`.
- Run all checks: `uv run ruff check && uv run ruff format --check && uv run mypy && uv run pytest`.
- Existing tests don't assume everything is Common, so they keep passing. After merging, re-run ingestion: rarity is part of the content hash, so existing rows are updated once, then unchanged on the next run. That's idempotence working as designed, and a good thing to observe in `ingestion_runs`.

**2. SPAWN-4: readiness endpoint** (Python, backend).
- Add `GET /health/ready` in `backend/src/spawn_api/api/health.py`: run `SELECT 1` through the `get_session` dependency; return 200 if it works, 503 if the database is unreachable.
- Tests: a unit test where the database is unreachable (point `Settings` at a closed port) expects 503; an integration test expects 200.

**3. SPAWN-25: all-day display** (TypeScript, frontend).
- Real events are all-day, but the app still shows countdowns like "ends in 11h". In `src/lib/time.ts`, make `timeLabel` return "Today" or "Until Nov 3" when `spawn.allDay` is true.
- Tests first, in `src/lib/time.test.ts`.

Open each task as its own branch with its Jira key (`feat/SPAWN-12-rarity-rules`), and its own PR.

### Small warm-up exercises (optional)

1. **Add a "Free" filter** in `App.tsx` that shows only spawns with `price === 'Free'`.
2. **Add a test** that hidden spawns reveal at exactly `REVEAL_RADIUS` (boundary case) in `src/lib/spawnView.test.ts`.
3. **Show total XP** on the Dex card using `totalXp` from `src/lib/progression.ts`.

### Copilot usage log

Fill this in as you go. It's the most convincing thing to show in an interview.

| Date | Task | What Copilot suggested | What I kept / changed and why |
|---|---|---|---|
| | | | |
