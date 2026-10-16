"""The REST API against PostGIS, with the real fixture rows ingested and the clock frozen."""

import json
import uuid
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import sessionmaker

from spawn_api.api.spawns import get_now
from spawn_api.domain.normalized import YOUNG_CHILDREN_AUDIENCES
from spawn_api.ingest.montreal_events import MontrealEventsSource
from spawn_api.ingest.pipeline import IngestionPipeline
from spawn_api.main import create_app

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("clean_tables")]

FIXTURE = Path(__file__).parents[1] / "fixtures" / "montreal_events_sample.geojson"
NOW = datetime(2026, 10, 16, 16, 0, tzinfo=UTC)  # noon in Montréal
PLACE_DES_ARTS = {"lat": 45.5085, "lng": -73.5665}
WHOLE_CITY = PLACE_DES_ARTS | {"radius_m": 25_000, "days_ahead": 60, "include_children": True}


@pytest.fixture
def client(engine: Engine) -> Iterator[TestClient]:
    source = MontrealEventsSource(loader=lambda: json.loads(FIXTURE.read_text(encoding="utf-8")))
    IngestionPipeline(sessionmaker(engine), source, today=lambda: date(2026, 10, 16)).run()

    app = create_app()
    app.dependency_overrides[get_now] = lambda: NOW
    with TestClient(app) as test_client:
        yield test_client


def spawns(client: TestClient, **params: Any) -> list[dict[str, Any]]:
    response = client.get("/api/v1/spawns", params=params)
    assert response.status_code == 200, response.text
    items: list[dict[str, Any]] = response.json()["items"]
    return items


def test_results_are_within_radius_and_sorted_by_distance(client: TestClient) -> None:
    items = spawns(client, **PLACE_DES_ARTS, radius_m=3_000, days_ahead=60, include_children=True)
    distances = [s["distance_m"] for s in items]
    assert all(d <= 3_000 for d in distances)
    assert distances == sorted(distances)


def test_bigger_radius_never_returns_fewer_spawns(client: TestClient) -> None:
    small = spawns(client, **PLACE_DES_ARTS, radius_m=2_000, days_ahead=60)
    large = spawns(client, **PLACE_DES_ARTS, radius_m=25_000, days_ahead=60)
    assert len(large) >= len(small)
    assert {s["id"] for s in small} <= {s["id"] for s in large}


def test_spawn_has_the_full_contract(client: TestClient) -> None:
    spawn = spawns(client, **WHOLE_CITY)[0]
    assert set(spawn) >= {"id", "title", "type", "rarity", "location", "starts_at", "ends_at", "distance_m"}
    assert spawn["source"] == "montreal-events"
    assert spawn["all_day"] is True
    assert 45.3 < spawn["location"]["lat"] < 45.8 and -74.1 < spawn["location"]["lng"] < -73.4


def test_young_children_events_are_hidden_by_default(client: TestClient) -> None:
    default = spawns(client, **(WHOLE_CITY | {"include_children": False}))
    everything = spawns(client, **WHOLE_CITY)
    assert not any(s["audience"] in YOUNG_CHILDREN_AUDIENCES for s in default)
    assert any(s["audience"] in YOUNG_CHILDREN_AUDIENCES for s in everything)
    # Family events are not children-only, so they stay visible by default.
    assert any(s["audience"] == "Famille" for s in default)


def test_type_and_free_filters(client: TestClient) -> None:
    music = spawns(client, **WHOLE_CITY, type="music")
    assert music and all(s["type"] == "music" for s in music)
    several = spawns(client, **WHOLE_CITY, type=["music", "food"])
    assert {s["type"] for s in several} <= {"music", "food"}
    free = spawns(client, **WHOLE_CITY, free=True)
    assert free and all(s["is_free"] is True for s in free)


def test_time_window(client: TestClient) -> None:
    def starts(s: dict[str, Any]) -> datetime:
        return datetime.fromisoformat(s["starts_at"])

    def ends(s: dict[str, Any]) -> datetime:
        return datetime.fromisoformat(s["ends_at"])

    week = spawns(client, **(WHOLE_CITY | {"days_ahead": 7}))
    assert week and all(starts(s) <= NOW + timedelta(days=7) and ends(s) > NOW for s in week)

    live_now = spawns(client, **WHOLE_CITY, live_only=True)
    assert all(starts(s) <= NOW < ends(s) for s in live_now)
    # The fixture has long exhibitions running today, so "live now" is not empty.
    assert live_now


def test_pagination_returns_every_spawn_exactly_once(client: TestClient) -> None:
    expected = [s["id"] for s in spawns(client, **WHOLE_CITY, limit=500)]
    seen: list[str] = []
    cursor = None
    for _ in range(20):
        params = WHOLE_CITY | {"limit": 2} | ({"cursor": cursor} if cursor else {})
        page = client.get("/api/v1/spawns", params=params).json()
        seen += [s["id"] for s in page["items"]]
        cursor = page["next_cursor"]
        if cursor is None:
            break
    assert seen == expected
    assert len(expected) > 2  # the test actually paginated


def test_get_one_spawn_and_404(client: TestClient) -> None:
    first = spawns(client, **WHOLE_CITY)[0]
    response = client.get(f"/api/v1/spawns/{first['id']}")
    assert response.status_code == 200
    assert response.json()["title"] == first["title"]

    missing = client.get(f"/api/v1/spawns/{uuid.uuid4()}")
    assert missing.status_code == 404
    assert missing.json() == {"error": {"status": 404, "message": "spawn not found", "details": None}}


def test_sources_and_ingestion_runs(client: TestClient) -> None:
    sources = client.get("/api/v1/sources").json()
    assert [s["slug"] for s in sources] == ["montreal-events"]
    assert sources[0]["license"] == "CC BY 4.0"
    assert sources[0]["active_spawns"] == 15
    assert sources[0]["last_success_at"] is not None

    runs = client.get("/api/v1/ingestion-runs").json()
    assert runs[0]["status"] == "succeeded"
    assert (runs[0]["inserted"], runs[0]["skipped"], runs[0]["rejected"]) == (15, 8, 3)


def test_cors_header_for_the_local_frontend(client: TestClient) -> None:
    response = client.get("/api/v1/sources", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
