# 0002: Backend in Python with FastAPI, in the same repository

**Status:** Accepted (2026-10-16)

## Context

Spawn needs a backend to ingest real events, store them and serve them. The frontend is TypeScript. The developer wants to strengthen Python, and the later CLIP photo-verification feature (Phase 2b) is Python (PyTorch, Hugging Face).

## Decision

Build the backend in **Python 3.12 with FastAPI**, in a `backend/` folder of the same repository (a small monorepo).

## Alternatives considered

- **Node.js (Express / Fastify).** One language for front and back, and types could be shared directly. Rejected because the ML work is Python anyway, which would mean three runtimes, and because building Python skills is a goal.
- **Django + Django REST Framework.** Batteries included (admin, ORM, auth), but heavier than needed for a read-only API, and less explicit about request/response validation than FastAPI's Pydantic models.
- **Separate repository for the backend.** Cleaner ownership in a large team, but for one developer it splits every feature into two PRs and two CI setups.

## Consequences

- Request and response validation comes from type hints (Pydantic), and OpenAPI docs are generated automatically.
- Front/back type sharing is done by **generating TypeScript types from the OpenAPI schema**, not by sharing code.
- CI runs two jobs (frontend and backend) with path filters, so a docs-only or frontend-only change doesn't run the backend suite.
- The future CLIP service can share the same Python tooling (uv, Ruff, mypy, pytest).
