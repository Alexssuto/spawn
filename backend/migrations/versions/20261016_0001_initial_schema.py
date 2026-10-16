"""Initial schema: sources, spawns, ingestion_runs

Revision ID: 0001
Revises:
Create Date: 2026-10-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geography
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SPAWN_TYPES = ("music", "food", "night", "culture", "sport", "nature", "social")
RARITIES = ("common", "uncommon", "rare", "legendary")
INGESTION_STATUSES = ("running", "succeeded", "failed")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "sources",
        sa.Column("id", sa.SmallInteger(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("license", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sources")),
        sa.UniqueConstraint("slug", name=op.f("uq_sources_slug")),
    )

    op.create_table(
        "spawns",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("source_id", sa.SmallInteger(), nullable=False),
        sa.Column("external_id", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("rarity", sa.String(length=16), nullable=False),
        sa.Column(
            "location",
            Geography(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=False,
        ),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("all_day", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("place_name", sa.Text(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("borough", sa.Text(), nullable=True),
        sa.Column("audience", sa.Text(), nullable=True),
        sa.Column("is_free", sa.Boolean(), nullable=True),
        sa.Column("is_outdoor", sa.Boolean(), nullable=True),
        sa.Column("hidden", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("recurring", sa.Text(), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("content_hash", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_spawns")),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], name=op.f("fk_spawns_source_id_sources")),
        sa.UniqueConstraint("source_id", "external_id", name=op.f("uq_spawns_source_id_external_id")),
        sa.CheckConstraint("ends_at >= starts_at", name=op.f("ck_spawns_ends_after_start")),
        sa.CheckConstraint(_in("type", SPAWN_TYPES), name=op.f("ck_spawns_spawn_type")),
        sa.CheckConstraint(_in("rarity", RARITIES), name=op.f("ck_spawns_rarity")),
    )
    op.create_index("ix_spawns_location", "spawns", ["location"], postgresql_using="gist")
    op.create_index("ix_spawns_active_ends_at", "spawns", ["ends_at"], postgresql_where=sa.text("is_active"))

    op.create_table(
        "ingestion_runs",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("source_id", sa.SmallInteger(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("fetched", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("inserted", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("updated", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("unchanged", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("skipped", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("rejected", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("deactivated", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "errors",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ingestion_runs")),
        sa.ForeignKeyConstraint(
            ["source_id"], ["sources.id"], name=op.f("fk_ingestion_runs_source_id_sources")
        ),
        sa.CheckConstraint(
            _in("status", INGESTION_STATUSES), name=op.f("ck_ingestion_runs_ingestion_status")
        ),
    )


def downgrade() -> None:
    op.drop_table("ingestion_runs")
    op.drop_index("ix_spawns_active_ends_at", table_name="spawns")
    op.drop_index("ix_spawns_location", table_name="spawns")
    op.drop_table("spawns")
    op.drop_table("sources")
    # The postgis extension is left installed: other database objects may rely on it.
