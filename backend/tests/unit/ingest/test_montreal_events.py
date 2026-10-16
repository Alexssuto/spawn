"""Parsing rules for the city's events file, tested on real rows (tests/fixtures)."""

import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from spawn_api.domain.catalog import SpawnType
from spawn_api.ingest.base import Accepted, Rejected, Skipped
from spawn_api.ingest.montreal_events import (
    CATEGORY_TO_TYPE,
    EXCLUDED_CATEGORIES,
    MontrealEventsSource,
)

FIXTURE = Path(__file__).parents[2] / "fixtures" / "montreal_events_sample.geojson"
TODAY = date(2026, 10, 16)

# All 28 categories seen in the real file in October 2026 (plus the missing one).
KNOWN_CATEGORIES = {
    "Art et artisanat", "Heure du conte", "Jeux", "Conseil et comité", "Musique", "Sport et plein air",
    "Club de lecture et littérature", "Science et techno", "Soutien et échange", "Théâtre", "Exposition",
    "Informatique", "Cinéma", "Langues", "Initiation à la musique", "Société et histoire", "Bien-être",
    "Cuisine", "Danse", "Fête et marché", "Consultation publique", "Art de la parole",
    "Rencontre avec personne élue", "Assemblée publique", "Cirque", "Jardinage", "Humour",
}  # fmt: skip


def load_fixture() -> Any:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


@pytest.fixture
def source() -> MontrealEventsSource:
    return MontrealEventsSource(loader=load_fixture)


@pytest.fixture
def records(source: MontrealEventsSource) -> dict[str, dict[str, Any]]:
    """Fixture rows keyed by the numeric id at the end of their URL."""
    return {r["url_fiche"].rsplit("-", 1)[-1]: r for r in source.fetch()}


def test_every_known_category_is_mapped_or_excluded() -> None:
    assert set(CATEGORY_TO_TYPE) | EXCLUDED_CATEGORIES == KNOWN_CATEGORIES
    assert not set(CATEGORY_TO_TYPE) & EXCLUDED_CATEGORIES


def test_fetch_returns_properties_with_nan_made_json_safe(source: MontrealEventsSource) -> None:
    rows = source.fetch()
    assert len(rows) == 26
    assert all("url_fiche" in r for r in rows)
    json.dumps(rows, allow_nan=False)  # raises if any NaN survived


def test_fixture_outcomes(source: MontrealEventsSource) -> None:
    results = [source.parse(r, TODAY) for r in source.fetch()]
    assert sum(isinstance(r, Accepted) for r in results) == 15
    assert sum(isinstance(r, Skipped) for r in results) == 8
    assert sum(isinstance(r, Rejected) for r in results) == 3


def test_accepted_row_is_fully_normalized(source: MontrealEventsSource, records: dict[str, Any]) -> None:
    result = source.parse(records["114726"], TODAY)  # a free circus show, Oct 24
    assert isinstance(result, Accepted)
    spawn = result.spawn
    assert spawn.type is SpawnType.CULTURE
    assert spawn.all_day is True
    assert spawn.starts_at.isoformat() == "2026-10-24T00:00:00-04:00"
    assert spawn.ends_at.isoformat() == "2026-10-25T00:00:00-04:00"
    assert spawn.is_free is True
    assert spawn.external_id == spawn.url == records["114726"]["url_fiche"]
    assert spawn.raw == records["114726"]
    assert 45.3 < spawn.lat < 45.8 and -74.1 < spawn.lng < -73.4


def test_family_and_children_events_are_both_accepted(source: MontrealEventsSource, records: Any) -> None:
    # Hiding young-children events happens in the API, not at ingestion: the data is kept.
    family, children = source.parse(records["114732"], TODAY), source.parse(records["115667"], TODAY)
    assert isinstance(family, Accepted) and family.spawn.audience == "Famille"
    assert isinstance(children, Accepted) and children.spawn.audience == "Enfants"


@pytest.mark.parametrize(
    ("record_id", "reason"),
    [
        ("87905", "online event"),
        ("101300", "not an in-person experience: Conseil et comité"),
        ("59544", "already ended"),
    ],
)
def test_out_of_scope_rows_are_skipped(
    source: MontrealEventsSource, records: Any, record_id: str, reason: str
) -> None:
    assert source.parse(records[record_id], TODAY) == Skipped(reason)


def test_missing_minus_sign_on_longitude_is_rejected(source: MontrealEventsSource, records: Any) -> None:
    result = source.parse(records["109730"], TODAY)
    assert isinstance(result, Rejected)
    assert result.reason.startswith("coordinates outside Montréal")


def test_latitude_equal_to_longitude_is_rejected(source: MontrealEventsSource, records: Any) -> None:
    result = source.parse(records["112214"], TODAY)
    assert isinstance(result, Rejected)
    assert result.reason.startswith("coordinates outside Montréal")


def test_missing_coordinates_are_rejected(source: MontrealEventsSource, records: Any) -> None:
    result = source.parse(records["117410"], TODAY)
    assert result == Rejected("no coordinates", records["117410"]["url_fiche"])


# Variants of a real accepted row, for rules the fixture can't show on its own.


@pytest.fixture
def valid(records: Any) -> dict[str, Any]:
    return dict(records["114726"])


def test_missing_category_is_rejected(source: MontrealEventsSource, valid: dict[str, Any]) -> None:
    result = source.parse(valid | {"type_evenement": "nan"}, TODAY)
    assert isinstance(result, Rejected) and result.reason == "missing category"


def test_new_unknown_category_is_rejected_not_guessed(source: MontrealEventsSource, valid: Any) -> None:
    result = source.parse(valid | {"type_evenement": "Astronomie"}, TODAY)
    assert isinstance(result, Rejected) and result.reason == "unmapped category: Astronomie"


def test_end_before_start_is_rejected(source: MontrealEventsSource, valid: Any) -> None:
    result = source.parse(valid | {"date_debut": "2026-12-01", "date_fin": "2026-11-01"}, TODAY)
    assert isinstance(result, Rejected) and result.reason == "ends before it starts"


def test_invalid_date_is_rejected_with_the_field_name(source: MontrealEventsSource, valid: Any) -> None:
    result = source.parse(valid | {"date_fin": "bientôt"}, TODAY)
    assert isinstance(result, Rejected) and result.reason.startswith("invalid date_fin")


def test_missing_url_is_rejected(source: MontrealEventsSource, valid: Any) -> None:
    result = source.parse(valid | {"url_fiche": "nan"}, TODAY)
    assert isinstance(result, Rejected) and result.reason.startswith("invalid url_fiche")


def test_event_ending_today_is_still_in(source: MontrealEventsSource, valid: Any) -> None:
    today_only = valid | {"date_debut": "2026-10-16", "date_fin": "2026-10-16"}
    assert isinstance(source.parse(today_only, TODAY), Accepted)


def test_paid_and_unknown_cost(source: MontrealEventsSource, valid: Any) -> None:
    paid = source.parse(valid | {"cout": "Payant"}, TODAY)
    unknown = source.parse(valid | {"cout": "nan"}, TODAY)
    assert isinstance(paid, Accepted) and paid.spawn.is_free is False
    assert isinstance(unknown, Accepted) and unknown.spawn.is_free is None


def test_fetch_rejects_a_file_that_is_not_geojson() -> None:
    with pytest.raises(ValueError, match="FeatureCollection"):
        MontrealEventsSource(loader=lambda: {"rows": []}).fetch()
