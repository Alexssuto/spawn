"""The ingestion job: fetch → parse (validate, clean, transform, filter) → load → report."""

from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session, sessionmaker

from spawn_api.domain.catalog import IngestionStatus
from spawn_api.domain.normalized import MONTREAL_TZ, NormalizedSpawn
from spawn_api.ingest.base import Accepted, EventSource, Rejected, Skipped
from spawn_api.ingest.repository import IngestionRunRepository, SourceRepository, SpawnRepository

# How many rejected rows to keep as examples in the run report.
MAX_ERROR_SAMPLES = 50


class SuspiciousSnapshotError(Exception):
    """The source returned far fewer usable rows than are currently active.

    Usually means a broken or partial download, not that most events were really cancelled.
    The run fails and nothing is deactivated, instead of wiping the map.
    """


@dataclass
class IngestionReport:
    source: str
    run_id: int | None = None
    status: IngestionStatus = IngestionStatus.RUNNING
    fetched: int = 0
    inserted: int = 0
    updated: int = 0
    unchanged: int = 0
    skipped: int = 0
    rejected: int = 0
    deactivated: int = 0
    skip_reasons: Counter[str] = field(default_factory=Counter)
    reject_reasons: Counter[str] = field(default_factory=Counter)
    errors: list[dict[str, Any]] = field(default_factory=list)

    def counts(self) -> dict[str, Any]:
        return {
            "fetched": self.fetched,
            "inserted": self.inserted,
            "updated": self.updated,
            "unchanged": self.unchanged,
            "skipped": self.skipped,
            "rejected": self.rejected,
            "deactivated": self.deactivated,
            "errors": self.errors,
        }


def _montreal_today() -> date:
    return datetime.now(MONTREAL_TZ).date()


class IngestionPipeline:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        source: EventSource,
        *,
        today: Callable[[], date] = _montreal_today,
        min_snapshot_ratio: float = 0.5,
    ) -> None:
        """`today` is injectable so tests control what "already ended" means.
        `min_snapshot_ratio`: fail if the new snapshot has fewer accepted rows than this
        fraction of the currently active ones (see SuspiciousSnapshotError)."""
        self.session_factory = session_factory
        self.source = source
        self.today = today
        self.min_snapshot_ratio = min_snapshot_ratio

    def run(self) -> IngestionReport:
        report = IngestionReport(source=self.source.info.slug)

        # Bookkeeping is committed on its own, so a failed run is still recorded even though
        # its data changes are rolled back.
        with self.session_factory.begin() as session:
            source_id = SourceRepository(session).ensure(self.source.info)
            report.run_id = IngestionRunRepository(session).start(source_id)

        try:
            accepted = self._parse_all(report)
            with self.session_factory.begin() as session:
                self._load(session, source_id, accepted, report)
        except Exception as error:
            report.status = IngestionStatus.FAILED
            report.errors.append({"error": type(error).__name__, "message": str(error)})
            self._finish(report)
            raise
        report.status = IngestionStatus.SUCCEEDED
        self._finish(report)
        return report

    def _parse_all(self, report: IngestionReport) -> list[NormalizedSpawn]:
        records = self.source.fetch()
        report.fetched = len(records)
        today = self.today()
        by_id: dict[str, NormalizedSpawn] = {}
        for record in records:
            match self.source.parse(record, today):
                case Accepted(spawn) if spawn.external_id in by_id:
                    self._reject(report, Rejected("duplicate external_id in source", spawn.external_id))
                case Accepted(spawn):
                    by_id[spawn.external_id] = spawn
                case Skipped(reason):
                    report.skipped += 1
                    report.skip_reasons[reason] += 1
                case Rejected() as rejection:
                    self._reject(report, rejection)
        return list(by_id.values())

    def _reject(self, report: IngestionReport, rejection: Rejected) -> None:
        report.rejected += 1
        # Group "coordinates outside Montréal (45.48, 73.56)" etc. under one reason for the summary.
        report.reject_reasons[rejection.reason.split(" (")[0]] += 1
        if len(report.errors) < MAX_ERROR_SAMPLES:
            report.errors.append({"external_id": rejection.external_id, "reason": rejection.reason})

    def _load(
        self, session: Session, source_id: int, accepted: list[NormalizedSpawn], report: IngestionReport
    ) -> None:
        spawns = SpawnRepository(session)
        active_before = spawns.count_active(source_id)
        if active_before and len(accepted) < self.min_snapshot_ratio * active_before:
            raise SuspiciousSnapshotError(
                f"only {len(accepted)} usable rows for {active_before} active spawns; "
                "refusing to deactivate the difference"
            )
        counts = spawns.upsert(source_id, accepted)
        report.inserted, report.updated, report.unchanged = counts.inserted, counts.updated, counts.unchanged
        report.deactivated = spawns.deactivate_missing(source_id, (s.external_id for s in accepted))

    def _finish(self, report: IngestionReport) -> None:
        assert report.run_id is not None
        with self.session_factory.begin() as session:
            IngestionRunRepository(session).finish(report.run_id, report.status, **report.counts())
