"""SQLAlchemy ORM models. The schema itself is created by Alembic migrations (backend/alembic/);
CI runs `alembic check` to make sure these models and the migrations never drift apart.
"""

import uuid
from datetime import datetime
from typing import Any

from geoalchemy2 import Geography, WKBElement
from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from spawn_api.domain.catalog import IngestionStatus, Rarity, SpawnType

# Predictable constraint names, so migrations can refer to them (e.g. "uq_spawns_source_id").
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def _str_enum(enum_cls: type[Any], name: str) -> Enum:
    """Stores an enum as text plus a CHECK constraint instead of a native PostgreSQL ENUM type,
    so adding a value later is a simple constraint change rather than an ALTER TYPE."""
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=16,
        values_callable=lambda e: [m.value for m in e],
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Source(Base):
    """Where spawns come from: the city's open data, the curated seed file, later others."""

    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    slug: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)
    license: Mapped[str | None] = mapped_column(Text)

    spawns: Mapped[list["Spawn"]] = relationship(back_populates="source")


class Spawn(TimestampMixin, Base):
    """One experience on the map, normalized from a source row."""

    __tablename__ = "spawns"
    __table_args__ = (
        # The natural key that makes ingestion idempotent: upsert on (source, external id).
        UniqueConstraint("source_id", "external_id", name="uq_spawns_source_id_external_id"),
        CheckConstraint("ends_at >= starts_at", name="ends_after_start"),
        # Spatial index for "within X metres" queries.
        Index("ix_spawns_location", "location", postgresql_using="gist"),
        # Most queries only want active spawns that haven't ended yet.
        Index("ix_spawns_active_ends_at", "ends_at", postgresql_where=text("is_active")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"))
    external_id: Mapped[str] = mapped_column(Text)

    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    type: Mapped[SpawnType] = mapped_column(_str_enum(SpawnType, "spawn_type"))
    rarity: Mapped[Rarity] = mapped_column(_str_enum(Rarity, "rarity"))

    # geography (not geometry): distances come back in metres on the Earth's surface.
    location: Mapped[WKBElement] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False)
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    all_day: Mapped[bool] = mapped_column(server_default=text("false"))

    place_name: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    borough: Mapped[str | None] = mapped_column(Text)
    audience: Mapped[str | None] = mapped_column(Text)
    is_free: Mapped[bool | None]
    is_outdoor: Mapped[bool | None]
    hidden: Mapped[bool] = mapped_column(server_default=text("false"))
    recurring: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)

    # The original source row, so spawns can be re-derived if the mapping rules change.
    raw: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # Hash of the normalized fields: ingestion skips the write when nothing changed.
    content_hash: Mapped[str] = mapped_column(Text)
    # False once the row disappears from its source. Rows are never deleted by ingestion.
    is_active: Mapped[bool] = mapped_column(server_default=text("true"))

    source: Mapped[Source] = relationship(back_populates="spawns")


class IngestionRun(Base):
    """One execution of the ingestion job, with counts, so data problems are visible."""

    __tablename__ = "ingestion_runs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[IngestionStatus] = mapped_column(_str_enum(IngestionStatus, "ingestion_status"))
    fetched: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    inserted: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    updated: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    unchanged: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    # Filtered out on purpose (online, council meeting, already ended): not a data problem.
    skipped: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    # Invalid rows (no coordinates, outside Montréal, unknown category...): a data problem.
    rejected: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    deactivated: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    # A sample of rejected rows with the reason, plus the error message if the run failed.
    errors: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
