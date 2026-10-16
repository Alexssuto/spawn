"""Shared pytest fixtures.

Integration tests need a real PostGIS database. They run only when SPAWN_DATABASE_URL is set
explicitly (CI sets it; locally, start `docker compose up -d` and export it). Otherwise they are
skipped with a clear reason instead of failing on a missing database.
"""

import os
from collections.abc import Iterator

import pytest
from sqlalchemy import Engine

from spawn_api.db.engine import make_engine
from spawn_api.settings import Settings


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    if not os.environ.get("SPAWN_DATABASE_URL"):
        pytest.skip("SPAWN_DATABASE_URL not set: start PostGIS with `docker compose up -d` and export it")
    engine = make_engine(Settings())
    yield engine
    engine.dispose()
