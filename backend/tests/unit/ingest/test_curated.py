from datetime import date
from typing import Any

import pytest

from spawn_api.domain.catalog import SpawnType
from spawn_api.ingest.base import Accepted, Rejected, Skipped
from spawn_api.ingest.curated import WINDOW_DAYS, CuratedExperience, CuratedSource
from spawn_api.ingest.montreal_events import MONTREAL_BBOX

OCTOBER = date(2026, 10, 26)


@pytest.fixture
def source() -> CuratedSource:
    return CuratedSource()


@pytest.fixture
def seed(source: CuratedSource) -> list[dict[str, Any]]:
    return source.fetch()


def test_seed_file_is_valid(seed: list[dict[str, Any]]) -> None:
    experiences = [CuratedExperience.model_validate(r) for r in seed]
    assert len(experiences) >= 10
    assert len({e.id for e in experiences}) == len(experiences)


def test_every_seed_place_is_in_montreal(seed: list[dict[str, Any]]) -> None:
    (lat_min, lat_max), (lng_min, lng_max) = MONTREAL_BBOX["lat"], MONTREAL_BBOX["lng"]
    for r in seed:
        assert lat_min <= r["lat"] <= lat_max and lng_min <= r["lng"] <= lng_max, r["id"]


def test_every_seed_entry_has_a_recurring_label(seed: list[dict[str, Any]]) -> None:
    # Evergreen spawns show their schedule ("Daily", "Sundays") instead of a countdown.
    assert all(r["recurring"].strip() for r in seed)


def test_accepted_spawn_is_published_for_the_coming_week(source: CuratedSource, seed: Any) -> None:
    schwartzs = next(r for r in seed if r["id"] == "schwartzs")
    result = source.parse(schwartzs, OCTOBER)
    assert isinstance(result, Accepted)
    spawn = result.spawn
    assert spawn.external_id == "schwartzs"
    assert spawn.type is SpawnType.FOOD
    assert spawn.recurring == "Daily"
    assert spawn.starts_at.date() == OCTOBER
    assert (spawn.ends_at.date() - spawn.starts_at.date()).days == WINDOW_DAYS


def test_seasonal_experiences_only_appear_in_season(source: CuratedSource, seed: Any) -> None:
    skating = next(r for r in seed if r["id"] == "beaver-lake-skating")
    assert source.parse(skating, OCTOBER) == Skipped("out of season")
    assert isinstance(source.parse(skating, date(2027, 1, 15)), Accepted)


def test_hidden_flag_is_kept(source: CuratedSource, seed: Any) -> None:
    tiki = next(r for r in seed if r["id"] == "pineapple-tiki-bar")
    result = source.parse(tiki, OCTOBER)
    assert isinstance(result, Accepted) and result.spawn.hidden is True


@pytest.mark.parametrize(
    ("change", "reason"),
    [
        ({"type": "poetry"}, "invalid type"),
        ({"id": "Not A Slug"}, "invalid id"),
        ({"season_months": [13]}, "invalid season_months"),
        ({"lat": 45.48, "lng": 73.56}, "coordinates outside Montréal"),
        ({"unexpected": True}, "invalid unexpected"),
    ],
)
def test_bad_entries_are_rejected_with_a_reason(
    source: CuratedSource, seed: Any, change: dict[str, Any], reason: str
) -> None:
    result = source.parse(seed[0] | change, OCTOBER)
    assert isinstance(result, Rejected)
    assert result.reason.startswith(reason)
