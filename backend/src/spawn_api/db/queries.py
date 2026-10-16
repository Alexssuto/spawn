"""Read-side queries for the API. Kept apart from the ingestion repository (which only writes)."""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from geoalchemy2 import Geography, Geometry
from sqlalchemy import ColumnElement, Float, and_, cast, func, or_, select, tuple_
from sqlalchemy.orm import Session

from spawn_api.db.models import IngestionRun, Source, Spawn
from spawn_api.domain.catalog import IngestionStatus, SpawnType
from spawn_api.domain.normalized import YOUNG_CHILDREN_AUDIENCES


@dataclass(frozen=True, slots=True)
class NearbyQuery:
    lat: float
    lng: float
    radius_m: float
    now: datetime
    days_ahead: int
    types: Sequence[SpawnType] = ()
    live_only: bool = False
    include_children: bool = False
    free_only: bool = False
    limit: int = 100
    # Keyset pagination: only rows after this (distance_m, id) in the result order.
    after: tuple[float, uuid.UUID] | None = None


def _spawn_columns() -> tuple[Any, ...]:
    """Spawn, its source slug, and plain lat/lng (ST_X/ST_Y need geometry, so cast from geography)."""
    geometry = cast(Spawn.location, Geometry(geometry_type="POINT", srid=4326))
    return (
        Spawn,
        Source.slug.label("source"),
        func.ST_Y(geometry).label("lat"),
        func.ST_X(geometry).label("lng"),
    )


class SpawnQueries:
    def __init__(self, session: Session) -> None:
        self.session = session

    # Rows are typed Any: each one is a SQLAlchemy Row with named fields (row.Spawn, row.lat...).

    def nearby(self, q: NearbyQuery) -> list[Any]:
        """Active spawns within radius_m of (lat, lng) that haven't ended and start within
        days_ahead, nearest first. Fetches limit + 1 rows so the caller knows if there's a next page.

        ST_DWithin on geography uses the GiST index on spawns.location; ST_Distance gives metres.
        """
        point = cast(
            func.ST_SetSRID(func.ST_MakePoint(q.lng, q.lat), 4326),
            Geography(geometry_type="POINT", srid=4326),
        )
        distance = cast(func.ST_Distance(Spawn.location, point), Float).label("distance_m")
        latest_start = q.now if q.live_only else q.now + timedelta(days=q.days_ahead)

        conditions: list[ColumnElement[bool]] = [
            Spawn.is_active.is_(True),
            func.ST_DWithin(Spawn.location, point, q.radius_m),
            Spawn.ends_at > q.now,
            Spawn.starts_at <= latest_start,
        ]
        if q.types:
            conditions.append(Spawn.type.in_(q.types))
        if not q.include_children:
            young = sorted(YOUNG_CHILDREN_AUDIENCES)
            conditions.append(or_(Spawn.audience.is_(None), Spawn.audience.not_in(young)))
        if q.free_only:
            conditions.append(Spawn.is_free.is_(True))
        if q.after is not None:
            conditions.append(tuple_(distance, Spawn.id) > tuple_(*q.after))

        stmt = (
            select(*_spawn_columns(), distance)
            .join(Source, Spawn.source_id == Source.id)
            .where(and_(*conditions))
            .order_by(distance, Spawn.id)
            .limit(q.limit + 1)
        )
        return list(self.session.execute(stmt).all())

    def by_id(self, spawn_id: uuid.UUID) -> Any | None:
        stmt = (
            select(*_spawn_columns()).join(Source, Spawn.source_id == Source.id).where(Spawn.id == spawn_id)
        )
        return self.session.execute(stmt).one_or_none()

    def sources(self) -> list[Any]:
        active = (
            select(func.count())
            .where(Spawn.source_id == Source.id, Spawn.is_active)
            .correlate(Source)
            .scalar_subquery()
        )
        last_success = (
            select(func.max(IngestionRun.finished_at))
            .where(IngestionRun.source_id == Source.id, IngestionRun.status == IngestionStatus.SUCCEEDED)
            .correlate(Source)
            .scalar_subquery()
        )
        stmt = select(Source, active.label("active_spawns"), last_success.label("last_success_at")).order_by(
            Source.slug
        )
        return list(self.session.execute(stmt).all())

    def ingestion_runs(self, limit: int, source: str | None) -> list[Any]:
        stmt = (
            select(IngestionRun, Source.slug.label("source"))
            .join(Source, IngestionRun.source_id == Source.id)
            .order_by(IngestionRun.id.desc())
            .limit(limit)
        )
        if source is not None:
            stmt = stmt.where(Source.slug == source)
        return list(self.session.execute(stmt).all())
