"""Shared pytest fixtures.

Integration tests need a real PostGIS database. They run only when SPAWN_DATABASE_URL is set
explicitly (CI sets it; locally, start `docker compose up -d` and export it). Otherwise they are
skipped with a clear reason instead of failing on a missing database.
"""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session

from alembic import command
from spawn_api.db.engine import make_engine
from spawn_api.settings import Settings

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def alembic_config() -> Config:
    return Config(str(ALEMBIC_INI))


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    if not os.environ.get("SPAWN_DATABASE_URL"):
        pytest.skip("SPAWN_DATABASE_URL not set: start PostGIS with `docker compose up -d` and export it")
    engine = make_engine(Settings())
    command.upgrade(alembic_config(), "head")
    yield engine
    engine.dispose()


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    """A session whose changes are rolled back after each test, so tests never see each other's data."""
    with engine.connect() as connection:
        transaction = connection.begin()
        with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
            yield session
        transaction.rollback()


@pytest.fixture
def clean_tables(engine: Engine) -> Iterator[None]:
    """For tests that must commit for real (e.g. the ingestion job): empty the tables afterwards."""
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE ingestion_runs, spawns, sources RESTART IDENTITY CASCADE"))
