"""Read-only REST endpoints under /api/v1."""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from spawn_api.api.pagination import DistanceCursor, InvalidCursorError
from spawn_api.api.schemas import (
    ErrorResponse,
    IngestionRunOut,
    Location,
    NearbyPage,
    NearbySpawnOut,
    SourceOut,
    SpawnOut,
)
from spawn_api.db.queries import NearbyQuery, SpawnQueries
from spawn_api.db.session import get_session
from spawn_api.domain.catalog import SpawnType

router = APIRouter(prefix="/api/v1", tags=["spawns"])

SessionDep = Annotated[Session, Depends(get_session)]


def get_now() -> datetime:
    """The current time, as a dependency so tests can freeze it."""
    return datetime.now(UTC)


NowDep = Annotated[datetime, Depends(get_now)]


def _spawn_fields(row: Any) -> dict[str, Any]:
    spawn = row.Spawn
    return {
        "id": spawn.id,
        "title": spawn.title,
        "description": spawn.description,
        "type": spawn.type,
        "rarity": spawn.rarity,
        "location": Location(lat=row.lat, lng=row.lng),
        "starts_at": spawn.starts_at,
        "ends_at": spawn.ends_at,
        "all_day": spawn.all_day,
        "place_name": spawn.place_name,
        "address": spawn.address,
        "borough": spawn.borough,
        "audience": spawn.audience,
        "is_free": spawn.is_free,
        "is_outdoor": spawn.is_outdoor,
        "hidden": spawn.hidden,
        "recurring": spawn.recurring,
        "url": spawn.url,
        "source": row.source,
    }


@router.get("/spawns", responses={422: {"model": ErrorResponse}})
def nearby_spawns(
    session: SessionDep,
    now: NowDep,
    lat: Annotated[float, Query(ge=-90, le=90, description="Latitude of the user")],
    lng: Annotated[float, Query(ge=-180, le=180, description="Longitude of the user")],
    radius_m: Annotated[float, Query(gt=0, le=25_000)] = 5_000,
    type: Annotated[list[SpawnType] | None, Query(description="Repeat to allow several types")] = None,
    live_only: Annotated[bool, Query(description="Only spawns happening right now")] = False,
    days_ahead: Annotated[int, Query(ge=0, le=60, description="Include spawns starting this soon")] = 7,
    include_children: Annotated[
        bool, Query(description="Also include events aimed specifically at young children")
    ] = False,
    free: Annotated[bool, Query(description="Only free spawns")] = False,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    cursor: Annotated[str | None, Query(description="next_cursor from the previous page")] = None,
) -> NearbyPage:
    """Spawns near a point, nearest first, with keyset pagination."""
    try:
        after = DistanceCursor.decode(cursor) if cursor else None
    except InvalidCursorError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    rows = SpawnQueries(session).nearby(
        NearbyQuery(
            lat=lat,
            lng=lng,
            radius_m=radius_m,
            now=now,
            days_ahead=days_ahead,
            types=type or (),
            live_only=live_only,
            include_children=include_children,
            free_only=free,
            limit=limit,
            after=(after.distance_m, after.id) if after else None,
        )
    )
    page, has_more = rows[:limit], len(rows) > limit
    items = [NearbySpawnOut(**_spawn_fields(r), distance_m=r.distance_m) for r in page]
    next_cursor = DistanceCursor(page[-1].distance_m, page[-1].Spawn.id).encode() if has_more else None
    return NearbyPage(items=items, next_cursor=next_cursor)


@router.get("/spawns/{spawn_id}", responses={404: {"model": ErrorResponse}})
def get_spawn(spawn_id: uuid.UUID, session: SessionDep) -> SpawnOut:
    row = SpawnQueries(session).by_id(spawn_id)
    if row is None:
        raise HTTPException(status_code=404, detail="spawn not found")
    return SpawnOut(**_spawn_fields(row))


@router.get("/sources")
def list_sources(session: SessionDep) -> list[SourceOut]:
    """Data sources, their license, how many spawns they currently provide, and last successful run."""
    return [
        SourceOut(
            slug=r.Source.slug,
            name=r.Source.name,
            url=r.Source.url,
            license=r.Source.license,
            active_spawns=r.active_spawns,
            last_success_at=r.last_success_at,
        )
        for r in SpawnQueries(session).sources()
    ]


@router.get("/ingestion-runs")
def list_ingestion_runs(
    session: SessionDep,
    source: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[IngestionRunOut]:
    """Most recent ingestion runs first, with their counts."""
    return [
        IngestionRunOut(
            id=r.IngestionRun.id,
            source=r.source,
            status=r.IngestionRun.status,
            started_at=r.IngestionRun.started_at,
            finished_at=r.IngestionRun.finished_at,
            fetched=r.IngestionRun.fetched,
            inserted=r.IngestionRun.inserted,
            updated=r.IngestionRun.updated,
            unchanged=r.IngestionRun.unchanged,
            skipped=r.IngestionRun.skipped,
            rejected=r.IngestionRun.rejected,
            deactivated=r.IngestionRun.deactivated,
        )
        for r in SpawnQueries(session).ingestion_runs(limit, source)
    ]
