"""Response models: the public JSON contract of the API (also what OpenAPI documents)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from spawn_api.domain.catalog import IngestionStatus, Rarity, SpawnType


class Location(BaseModel):
    lat: float
    lng: float


class SpawnOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    type: SpawnType
    rarity: Rarity
    location: Location
    starts_at: datetime
    ends_at: datetime
    all_day: bool
    place_name: str | None
    address: str | None
    borough: str | None
    audience: str | None
    is_free: bool | None
    is_outdoor: bool | None
    hidden: bool
    recurring: str | None
    url: str | None
    source: str = Field(description="Slug of the data source, e.g. montreal-events")


class NearbySpawnOut(SpawnOut):
    distance_m: float = Field(description="Distance from the requested point, in metres")


class NearbyPage(BaseModel):
    items: list[NearbySpawnOut]
    next_cursor: str | None = Field(
        description="Pass as `cursor` to get the next page; null on the last page"
    )


class SourceOut(BaseModel):
    slug: str
    name: str
    url: str | None
    license: str | None
    active_spawns: int
    last_success_at: datetime | None


class IngestionRunOut(BaseModel):
    id: int
    source: str
    status: IngestionStatus
    started_at: datetime
    finished_at: datetime | None
    fetched: int
    inserted: int
    updated: int
    unchanged: int
    skipped: int
    rejected: int
    deactivated: int


class ErrorBody(BaseModel):
    status: int
    message: str
    details: list[dict[str, object]] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody
