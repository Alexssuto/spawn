# The API as a container image. Built in CI on every backend change; never pushed to a registry (ADR 0009).
#
#   docker build -t spawn-api backend
#   docker run --rm -p 8000:8000 -e SPAWN_DATABASE_URL=postgresql+psycopg://spawn:spawn@host.docker.internal:5432/spawn spawn-api

# Stage 1: install the locked dependencies and the app into a virtual environment.
FROM python:3.12-slim-bookworm AS build

# uv is copied from its official image, pinned to the version the project uses.
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /usr/local/bin/uv

# Compile bytecode at build time (faster start), copy files instead of hard-linking across layers.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Dependencies first, in their own layer: it is rebuilt only when uv.lock changes, not on every code change.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

# Then the app itself, installed as a regular (non-editable) package so the source folder is not needed.
COPY README.md ./
COPY src ./src
RUN uv sync --locked --no-dev --no-editable

# Stage 2: the runtime image. No uv, no compilers, no source tree: only Python and the virtual environment.
FROM python:3.12-slim-bookworm AS runtime

# A user without privileges: if the process is compromised, it cannot modify the image's files.
RUN useradd --system --uid 10001 --no-create-home spawn

WORKDIR /app
COPY --from=build /app/.venv /app/.venv
# Migrations ship with the image so a deployment can run `alembic upgrade head` from the same build.
COPY alembic.ini ./
COPY migrations ./migrations

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

USER spawn
EXPOSE 8000

# Liveness only (GET /health does not touch the database), using the Python already in the image instead of curl.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"]

CMD ["uvicorn", "spawn_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
