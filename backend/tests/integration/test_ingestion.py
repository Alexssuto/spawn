"""The ingestion job end to end, on real fixture rows, against PostGIS."""

import copy
import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from spawn_api.db.models import IngestionRun, Spawn
from spawn_api.domain.catalog import IngestionStatus
from spawn_api.ingest.__main__ import main as cli_main
from spawn_api.ingest.montreal_events import MontrealEventsSource
from spawn_api.ingest.pipeline import IngestionPipeline, SuspiciousSnapshotError

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("clean_tables")]

FIXTURE = Path(__file__).parents[1] / "fixtures" / "montreal_events_sample.geojson"
TODAY = date(2026, 10, 16)


def geojson() -> dict[str, Any]:
    data: dict[str, Any] = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return data


@pytest.fixture
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(engine, expire_on_commit=False)


def run(session_factory: sessionmaker[Session], data: dict[str, Any]) -> Any:
    source = MontrealEventsSource(loader=lambda: copy.deepcopy(data))
    return IngestionPipeline(session_factory, source, today=lambda: TODAY).run()


def active_count(engine: Engine) -> int:
    with Session(engine) as session:
        return session.scalar(select(func.count()).where(Spawn.is_active)) or 0


def test_first_run_inserts_accepted_rows_and_records_the_run(
    engine: Engine, session_factory: sessionmaker[Session]
) -> None:
    report = run(session_factory, geojson())

    assert report.status is IngestionStatus.SUCCEEDED
    assert (report.fetched, report.inserted, report.skipped, report.rejected) == (26, 15, 8, 3)
    assert active_count(engine) == 15
    with Session(engine) as session:
        recorded = session.get(IngestionRun, report.run_id)
        assert recorded is not None
        assert recorded.status is IngestionStatus.SUCCEEDED
        assert (recorded.inserted, recorded.skipped, recorded.rejected) == (15, 8, 3)
        assert recorded.finished_at is not None
        assert {e["reason"] for e in recorded.errors} >= {"no coordinates"}


def test_second_run_on_the_same_data_writes_nothing(session_factory: sessionmaker[Session]) -> None:
    run(session_factory, geojson())
    report = run(session_factory, geojson())
    assert (report.inserted, report.updated, report.unchanged, report.deactivated) == (0, 0, 15, 0)


def test_changed_row_is_updated_in_place(engine: Engine, session_factory: sessionmaker[Session]) -> None:
    run(session_factory, geojson())
    with Session(engine) as session:
        before = session.scalars(select(Spawn).where(Spawn.external_id.like("%-114726"))).one()

    data = geojson()
    target = next(f for f in data["features"] if f["properties"]["url_fiche"].endswith("-114726"))
    target["properties"]["titre"] = "Shirono Ballon (nouvelle date)"
    report = run(session_factory, data)

    assert (report.updated, report.unchanged) == (1, 14)
    with Session(engine) as session:
        after = session.scalars(select(Spawn).where(Spawn.external_id.like("%-114726"))).one()
    assert after.id == before.id  # same row, so anything referencing it stays valid
    assert after.title == "Shirono Ballon (nouvelle date)"


def test_row_missing_from_source_is_deactivated_then_reactivated(
    engine: Engine, session_factory: sessionmaker[Session]
) -> None:
    run(session_factory, geojson())
    data = geojson()
    data["features"] = [f for f in data["features"] if not f["properties"]["url_fiche"].endswith("-114726")]

    assert run(session_factory, data).deactivated == 1
    assert active_count(engine) == 14

    report = run(session_factory, geojson())
    assert (report.updated, report.unchanged) == (1, 14)  # the returning row is reactivated
    assert active_count(engine) == 15


def test_suspiciously_small_snapshot_fails_and_keeps_existing_data(
    engine: Engine, session_factory: sessionmaker[Session]
) -> None:
    run(session_factory, geojson())
    broken = geojson()
    broken["features"] = broken["features"][:3]  # e.g. a truncated download

    with pytest.raises(SuspiciousSnapshotError):
        run(session_factory, broken)

    assert active_count(engine) == 15
    with Session(engine) as session:
        last = session.scalars(select(IngestionRun).order_by(IngestionRun.id.desc())).first()
    assert last is not None and last.status is IngestionStatus.FAILED
    assert last.errors[-1]["error"] == "SuspiciousSnapshotError"


def test_locations_are_queryable_by_distance(engine: Engine, session_factory: sessionmaker[Session]) -> None:
    run(session_factory, geojson())
    place_des_arts = func.ST_GeogFromText("POINT(-73.5665 45.5085)")
    with Session(engine) as session:
        within_10_km = session.scalar(
            select(func.count()).where(func.ST_DWithin(Spawn.location, place_des_arts, 10_000))
        )
        within_100_km = session.scalar(
            select(func.count()).where(func.ST_DWithin(Spawn.location, place_des_arts, 100_000))
        )
    assert within_100_km == 15  # everything that was accepted is in the Montréal area
    assert within_10_km is not None and 0 < within_10_km <= 15


def test_cli_ingests_a_local_file(capsys: pytest.CaptureFixture[str]) -> None:
    # The CLI uses the real date, so only check what doesn't depend on which fixture rows have ended.
    assert cli_main(["montreal-events", "--file", str(FIXTURE)]) == 0
    output = capsys.readouterr().out
    assert "montreal-events: succeeded" in output
    assert "fetched" in output and "26" in output
