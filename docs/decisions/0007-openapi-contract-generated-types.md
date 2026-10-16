# 0007: The OpenAPI schema is the API contract; frontend types are generated from it

**Status:** Accepted (2026-10-16)

## Context

The backend is Python and the frontend is TypeScript, so they can't share type definitions directly. Without a shared contract, renaming a field in the API silently breaks the app at runtime.

## Decision

- FastAPI generates the OpenAPI schema from the Pydantic response models. It is exported with `python -m spawn_api.openapi` and committed as `backend/openapi.json`.
- The frontend's types (`src/api/schema.d.ts`) are generated from that file with `openapi-typescript` (`npm run api:types`) and committed.
- CI fails if either file is out of date: the backend job regenerates the schema and diffs it, and the frontend job regenerates the types and diffs them.
- `openapi-typescript` runs through a pinned `npx` because version 7 declares TypeScript 5 as a peer dependency while the project uses TypeScript 6.

## Alternatives considered

- **Hand-written TypeScript interfaces.** Simple, but nothing stops them drifting from the backend.
- **Fetch the schema from a running API at build time.** Always fresh, but builds would need a running backend and a database.
- **A full generated client (e.g. openapi-fetch, orval).** More generated code than a few endpoints need; the small hand-written client uses the generated types.

## Consequences

- A backend change that affects the API shows up in the PR as a diff of `openapi.json`, which makes contract changes visible in review.
- Renaming or removing a field breaks the frontend's typecheck in CI instead of in the browser.
- Two generated files are committed and must be regenerated when the API changes (CI says so if forgotten).
