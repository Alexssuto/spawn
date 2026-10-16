"""Database writes for ingestion. All SQL for the pipeline lives here."""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Any

from geoalchemy2.elements import WKTElement
from sqlalchemy import CursorResult, func, literal_column, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session
from sqlalchemy.sql.dml import ReturningInsert

from spawn_api.db.models import IngestionRun, Source, Spawn
from spawn_api.domain.catalog import IngestionStatus
from spawn_api.domain.normalized import NormalizedSpawn
from spawn_api.ingest.base import SourceInfo

# Rows per INSERT statement. ~25 parameters per row keeps each statement far below
# PostgreSQL's limit of 65,535 bind parameters.
BATCH_SIZE = 500

# Columns overwritten when a row changes. id, source_id, external_id and created_at never change.
_UPDATABLE = (
    "title", "description", "type", "rarity", "location", "starts_at", "ends_at", "all_day",
    "place_name", "address", "borough", "audience", "is_free", "is_outdoor", "hidden",
    "recurring", "url", "raw", "content_hash",
)  # fmt: skip


@dataclass(frozen=True, slots=True)
class UpsertCounts:
    inserted: int = 0
    updated: int = 0
    unchanged: int = 0


def _to_row(source_id: int, spawn: NormalizedSpawn) -> dict[str, Any]:
    return {
        "source_id": source_id,
        "external_id": spawn.external_id,
        "title": spawn.title,
        "description": spawn.description,
        "type": spawn.type,
        "rarity": spawn.rarity,
        "location": WKTElement(f"POINT({spawn.lng} {spawn.lat})", srid=4326),
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
        "raw": spawn.raw,
        "content_hash": spawn.content_hash(),
    }


class SourceRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def ensure(self, info: SourceInfo) -> int:
        """Creates the source row, or updates its metadata, and returns its id."""
        stmt = (
            pg_insert(Source)
            .values(slug=info.slug, name=info.name, url=info.url, license=info.license)
            .on_conflict_do_update(
                index_elements=[Source.slug],
                set_={"name": info.name, "url": info.url, "license": info.license},
            )
            .returning(Source.id)
        )
        return self.session.execute(stmt).scalar_one()


class SpawnRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def count_active(self, source_id: int) -> int:
        stmt = select(func.count()).where(Spawn.source_id == source_id, Spawn.is_active)
        return self.session.execute(stmt).scalar_one()

    def upsert(self, source_id: int, spawns: Sequence[NormalizedSpawn]) -> UpsertCounts:
        """INSERT ... ON CONFLICT DO UPDATE on the natural key (source_id, external_id).

        The update only happens when the content hash changed or the row had been deactivated,
        so re-running ingestion on the same data writes nothing. RETURNING (xmax = 0) tells
        inserted rows (true) from updated ones (false); unchanged rows return nothing.
        """
        inserted = updated = 0
        for start in range(0, len(spawns), BATCH_SIZE):
            batch = [_to_row(source_id, s) for s in spawns[start : start + BATCH_SIZE]]
            insert = pg_insert(Spawn).values(batch)
            upsert: ReturningInsert[tuple[bool]] = insert.on_conflict_do_update(
                constraint="uq_spawns_source_id_external_id",
                set_={name: insert.excluded[name] for name in _UPDATABLE}
                | {"is_active": True, "updated_at": func.now()},
                where=(Spawn.content_hash != insert.excluded.content_hash) | Spawn.is_active.is_(False),
            ).returning(literal_column("(xmax = 0)").label("was_inserted"))
            for was_inserted in self.session.execute(upsert).scalars():
                if was_inserted:
                    inserted += 1
                else:
                    updated += 1
        return UpsertCounts(inserted=inserted, updated=updated, unchanged=len(spawns) - inserted - updated)

    def deactivate_missing(self, source_id: int, seen_external_ids: Iterable[str]) -> int:
        """Marks active rows that are no longer in the source as inactive. Never deletes, so ids
        (and anything that will reference them later, like catches) stay valid."""
        stmt = (
            update(Spawn)
            .where(
                Spawn.source_id == source_id,
                Spawn.is_active,
                Spawn.external_id.not_in(list(seen_external_ids)),
            )
            .values(is_active=False, updated_at=func.now())
        )
        result = self.session.execute(stmt)
        assert isinstance(result, CursorResult)  # UPDATE returns a cursor result with rowcount
        return result.rowcount


class IngestionRunRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def start(self, source_id: int) -> int:
        run = IngestionRun(source_id=source_id, status=IngestionStatus.RUNNING)
        self.session.add(run)
        self.session.flush()
        return run.id

    def finish(self, run_id: int, status: IngestionStatus, **counts: Any) -> None:
        self.session.execute(
            update(IngestionRun)
            .where(IngestionRun.id == run_id)
            .values(status=status, finished_at=func.now(), **counts)
        )
