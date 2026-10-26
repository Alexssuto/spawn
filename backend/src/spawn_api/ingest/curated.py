"""Hand-picked, evergreen experiences (seeds/curated.json): the places that make Montréal, Montréal,
which no event calendar lists. They go through the same pipeline as the city's data.
"""

import json
from collections.abc import Callable
from datetime import date, timedelta
from importlib.resources import files
from typing import Annotated, Any, ClassVar

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

from spawn_api.domain.catalog import SpawnType
from spawn_api.domain.normalized import NormalizedSpawn, all_day_window
from spawn_api.domain.rarity import rarity_for
from spawn_api.ingest.base import Accepted, EventSource, ParseResult, Record, Rejected, Skipped, SourceInfo
from spawn_api.ingest.montreal_events import MONTREAL_BBOX

# An evergreen spawn is always there, but each run publishes it for the coming week only,
# so the map never shows a window that nobody re-checked.
WINDOW_DAYS = 7

Slug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")]
Month = Annotated[int, Field(ge=1, le=12)]


class CuratedExperience(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: Slug
    title: Annotated[str, StringConstraints(min_length=1)]
    type: SpawnType
    description: str
    place: str
    address: str | None = None
    lat: float
    lng: float
    recurring: str
    hidden: bool = False
    is_free: bool | None = None
    is_outdoor: bool = False
    # Months when it exists (1-12); absent means all year.
    season_months: list[Month] | None = None


def _load_seed() -> Any:
    return json.loads(files("spawn_api.ingest").joinpath("seeds/curated.json").read_text(encoding="utf-8"))


class CuratedSource(EventSource):
    info: ClassVar[SourceInfo] = SourceInfo(
        slug="curated",
        name="Spawn: curated Montréal experiences",
        license="Coordinates © OpenStreetMap contributors (ODbL)",
    )

    def __init__(self, loader: Callable[[], Any] | None = None) -> None:
        self._load = loader or _load_seed

    def fetch(self) -> list[Record]:
        experiences: list[Record] = self._load()["experiences"]
        return experiences

    def parse(self, record: Record, today: date) -> ParseResult:
        try:
            exp = CuratedExperience.model_validate(record)
        except ValidationError as error:
            first = error.errors()[0]
            field = ".".join(str(part) for part in first["loc"])
            return Rejected(f"invalid {field}: {first['msg']}", record.get("id"))

        if exp.season_months is not None and today.month not in exp.season_months:
            return Skipped("out of season")
        (lat_min, lat_max), (lng_min, lng_max) = MONTREAL_BBOX["lat"], MONTREAL_BBOX["lng"]
        if not (lat_min <= exp.lat <= lat_max and lng_min <= exp.lng <= lng_max):
            return Rejected(f"coordinates outside Montréal ({exp.lat}, {exp.lng})", exp.id)

        last_day = today + timedelta(days=WINDOW_DAYS - 1)
        starts_at, ends_at = all_day_window(today, last_day)
        return Accepted(
            NormalizedSpawn(
                external_id=exp.id,
                title=exp.title,
                description=exp.description,
                type=exp.type,
                rarity=rarity_for(exp.type, today, last_day, is_outdoor=exp.is_outdoor),
                lat=exp.lat,
                lng=exp.lng,
                starts_at=starts_at,
                ends_at=ends_at,
                all_day=True,
                place_name=exp.place,
                address=exp.address,
                is_free=exp.is_free,
                is_outdoor=exp.is_outdoor,
                hidden=exp.hidden,
                recurring=exp.recurring,
                raw=record,
            )
        )
