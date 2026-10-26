"""Shared pytest fixtures.

Integration tests need a real PostGIS database. They run only when SPAWN_DATABASE_URL is set
explicitly (CI sets it; locally, start `docker compose up -d` and export it). Otherwise they are
skipped with a clear reason instead of failing on a missing database.

They never touch the database SPAWN_DATABASE_URL points at: they run against a sibling database
with a `_test` suffix (spawn → spawn_test), created on first use. The tests empty their tables,
and an early version that shared the development database wiped real ingested events.
"""

import os
from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, make_url, text
from sqlalchemy.orm import Session

from spawn_api.db.engine import make_engine
from spawn_api.settings import Settings, get_settings

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def alembic_config() -> Config:
    return Config(str(ALEMBIC_INI))


def _use_test_database() -> None:
    """Points SPAWN_DATABASE_URL at `<name>_test`, creating that database if needed.

    Everything that reads settings (the app, Alembic, the ingestion CLI) then uses it.
    """
    url = make_url(os.environ["SPAWN_DATABASE_URL"])
    if url.database is None or url.database.endswith("_test"):
        return
    test_url = url.set(database=f"{url.database}_test")
    conninfo = url.set(drivername="postgresql").render_as_string(hide_password=False)
    with psycopg.connect(conninfo, autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (test_url.database,)).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{test_url.database}"')
    os.environ["SPAWN_DATABASE_URL"] = test_url.render_as_string(hide_password=False)
    get_settings.cache_clear()


def pytest_configure(config: pytest.Config) -> None:
    if os.environ.get("SPAWN_DATABASE_URL"):
        _use_test_database()


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    if not os.environ.get("SPAWN_DATABASE_URL"):
        pytest.skip("SPAWN_DATABASE_URL not set: start PostGIS with `docker compose up -d` and export it")
    assert make_url(os.environ["SPAWN_DATABASE_URL"]).database.endswith("_test")  # type: ignore[union-attr]
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
