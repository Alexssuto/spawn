"""The normalized shape every source is converted into, before it is written to the database."""

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from spawn_api.domain.catalog import Rarity, SpawnType

MONTREAL_TZ = ZoneInfo("America/Montreal")

# Audiences that mean "specifically for young children". Hidden from the API by default
# (decision of 2026-10-16); "Famille" and "Pour tous" are deliberately not in this set.
YOUNG_CHILDREN_AUDIENCES = frozenset({"Enfants", "Enfants d'âge préscolaire"})


@dataclass(frozen=True, slots=True)
class NormalizedSpawn:
    external_id: str
    title: str
    type: SpawnType
    rarity: Rarity
    lat: float
    lng: float
    starts_at: datetime
    ends_at: datetime
    all_day: bool
    description: str | None = None
    place_name: str | None = None
    address: str | None = None
    borough: str | None = None
    audience: str | None = None
    is_free: bool | None = None
    is_outdoor: bool | None = None
    hidden: bool = False
    recurring: str | None = None
    url: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)

    def content_hash(self) -> str:
        """SHA-256 of every field, in a stable order. Ingestion only rewrites a row when this changes."""
        payload = json.dumps(asdict(self), sort_keys=True, default=str, ensure_ascii=False)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def all_day_window(first_day: date, last_day: date) -> tuple[datetime, datetime]:
    """Turns an inclusive range of dates into [start, end) timestamps in Montréal time.

    The end is exclusive (midnight after the last day) rather than 23:59:59, so nothing falls in
    a one-second gap at the end of the day. Daylight saving changes come from the time zone
    database: Nov 1, 2026 really lasts 25 hours once stored as instants in PostgreSQL (in Python,
    compare in UTC to see it, since same-tzinfo subtraction uses wall-clock time).
    """
    start = datetime.combine(first_day, time.min, tzinfo=MONTREAL_TZ)
    end = datetime.combine(last_day + timedelta(days=1), time.min, tzinfo=MONTREAL_TZ)
    return start, end
