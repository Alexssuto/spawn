# 0009: The API ships as a container image, built in CI and never pushed

**Status:** Accepted (2026-10-27)

## Context

The API runs on a developer machine with `uv run uvicorn`. Any future deployment (a cloud service, Kubernetes with Argo CD) expects a container image, and an image that is only built the day it's needed tends to break: a missing file, a dependency that only works on Windows, a process running as root. [ADR 0006](0006-private-read-only.md) already says CI builds the image but never pushes or deploys it.

## Decision

- `backend/Dockerfile` builds the API in **two stages**. The build stage installs the exact locked dependencies with uv (pinned to the project's version). The runtime stage copies only the virtual environment, `alembic.ini` and the migrations: no uv, no source tree, no tests.
- **Dependencies get their own layer**, built from `pyproject.toml` and `uv.lock` alone, so a code change rebuilds in seconds and only a lockfile change reinstalls packages.
- The process runs as an **unprivileged user** (`spawn`, uid 10001). A `HEALTHCHECK` calls `GET /health` with the Python already in the image, so no curl is added.
- The app is installed as a regular (non-editable) package, so data files such as the curated seed must be part of the package, and the image proves they are.
- A CI job (`image` in `backend.yml`) builds the image on every backend change, starts it, waits for `/health`, and checks it does not run as root. It uses `push: false`: **no registry, no credentials**.

## Alternatives considered

- **One stage with `pip install`**: simpler, but it ignores `uv.lock` (so CI and the image could resolve different versions) and leaves build tools in the final image.
- **Push to GitHub Container Registry or JFrog Artifactory**: this is what a real pipeline does next, and what Argo CD would deploy from. Not done yet: nothing deploys the image, and a registry adds credentials to manage for no benefit while the project stays private (ADR 0006).
- **Distroless or Alpine base**: smaller, but Alpine's musl breaks prebuilt wheels like `psycopg[binary]`, and distroless has no shell for debugging. `python:3.12-slim` (Debian) is a common default.

## Consequences

- Measured on 2026-10-27: the image is 224 MB, starts, serves real events from the local PostGIS database, runs as `spawn`, and Docker reports it healthy.
- The CI smoke test checks liveness only. It does not attach a database, so a broken database connection would not fail this job; the integration tests cover that.
- Publishing and deploying become small, separate steps: add a registry login and `push: true`, then point a deployment at the tag. Each needs its own decision (hosting, secrets, budget), which ADR 0006 requires before anything goes public.
