"""Cleaning helpers for messy source values."""

import math
from typing import Any

# How the city's export spells "no value": the strings "nan" and "None" (left over from a
# pandas export), empty strings, and real NaN floats in numeric columns.
_MISSING_STRINGS = frozenset({"", "nan", "none", "null"})


def blank_to_none(value: Any) -> Any:
    """Maps every spelling of "missing" to None and trims strings. Other values pass through."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, str):
        stripped = " ".join(value.split())  # trim and collapse inner whitespace
        return None if stripped.lower() in _MISSING_STRINGS else stripped
    return value


def json_safe(value: Any) -> Any:
    """Recursively replaces NaN floats with None. PostgreSQL's jsonb rejects NaN, which Python's
    json module would otherwise happily write."""
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    return value
