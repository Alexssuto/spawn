import math

import pytest

from spawn_api.ingest.cleaning import blank_to_none, json_safe


@pytest.mark.parametrize("missing", [None, "", "   ", "nan", "NaN", "None", "null", math.nan])
def test_every_spelling_of_missing_becomes_none(missing: object) -> None:
    assert blank_to_none(missing) is None


def test_strings_are_trimmed_and_inner_whitespace_collapsed() -> None:
    assert blank_to_none("  Parc   La Fontaine \n") == "Parc La Fontaine"


def test_real_values_pass_through() -> None:
    assert blank_to_none(45.5) == 45.5
    assert blank_to_none(0) == 0
    assert blank_to_none("Nancy") == "Nancy"  # starts with "nan" but is a real value


def test_json_safe_replaces_nan_at_any_depth() -> None:
    assert json_safe({"lat": math.nan, "tags": [1.0, math.nan], "ok": "x"}) == {
        "lat": None,
        "tags": [1.0, None],
        "ok": "x",
    }
