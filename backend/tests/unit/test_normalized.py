from dataclasses import replace
from datetime import UTC, date, timedelta

from spawn_api.domain.catalog import Rarity, SpawnType
from spawn_api.domain.normalized import MONTREAL_TZ, NormalizedSpawn, all_day_window


def test_single_day_runs_from_midnight_to_next_midnight_in_montreal() -> None:
    start, end = all_day_window(date(2026, 10, 17), date(2026, 10, 17))
    assert start.isoformat() == "2026-10-17T00:00:00-04:00"
    assert end.isoformat() == "2026-10-18T00:00:00-04:00"
    assert end - start == timedelta(hours=24)


def test_day_when_daylight_saving_ends_is_25_hours() -> None:
    # Clocks go back one hour in Montréal on Sunday, November 1, 2026.
    start, end = all_day_window(date(2026, 11, 1), date(2026, 11, 1))
    assert start.utcoffset() == timedelta(hours=-4)
    assert end.utcoffset() == timedelta(hours=-5)
    # Python gotcha: subtracting two datetimes that share a tzinfo gives wall-clock time (24h).
    # Real elapsed time needs both converted to UTC first. PostgreSQL stores real instants.
    assert end - start == timedelta(hours=24)
    assert end.astimezone(UTC) - start.astimezone(UTC) == timedelta(hours=25)


def test_multi_day_window_includes_the_last_day() -> None:
    start, end = all_day_window(date(2026, 10, 1), date(2026, 10, 3))
    assert (start.date(), end.date()) == (date(2026, 10, 1), date(2026, 10, 4))
    assert start.tzinfo == MONTREAL_TZ


def _spawn() -> NormalizedSpawn:
    start, end = all_day_window(date(2026, 10, 17), date(2026, 10, 17))
    return NormalizedSpawn(
        external_id="x",
        title="Jazz",
        type=SpawnType.MUSIC,
        rarity=Rarity.COMMON,
        lat=45.5,
        lng=-73.57,
        starts_at=start,
        ends_at=end,
        all_day=True,
        raw={"titre": "Jazz"},
    )


def test_content_hash_is_stable() -> None:
    assert _spawn().content_hash() == _spawn().content_hash()


def test_content_hash_changes_when_any_field_changes() -> None:
    base = _spawn()
    assert replace(base, title="Jazz!").content_hash() != base.content_hash()
    assert replace(base, rarity=Rarity.RARE).content_hash() != base.content_hash()
    assert replace(base, raw={"titre": "Jazz", "cout": "Gratuit"}).content_hash() != base.content_hash()
