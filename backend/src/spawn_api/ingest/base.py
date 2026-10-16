"""The contract every data source implements, and the possible outcomes of parsing one record."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Any, ClassVar

from spawn_api.domain.normalized import NormalizedSpawn

Record = dict[str, Any]


@dataclass(frozen=True, slots=True)
class SourceInfo:
    slug: str
    name: str
    url: str | None = None
    license: str | None = None


@dataclass(frozen=True, slots=True)
class Accepted:
    spawn: NormalizedSpawn


@dataclass(frozen=True, slots=True)
class Skipped:
    """Filtered out on purpose (online, not an experience, already over). Not a data problem."""

    reason: str


@dataclass(frozen=True, slots=True)
class Rejected:
    """Invalid or unusable data. Counted and sampled in the ingestion report."""

    reason: str
    external_id: str | None = None


ParseResult = Accepted | Skipped | Rejected


class EventSource(ABC):
    """A source of events. The pipeline only talks to this interface, so adding a source
    (sports programming, a curated file...) means adding one subclass, not changing the pipeline."""

    info: ClassVar[SourceInfo]

    @abstractmethod
    def fetch(self) -> list[Record]:
        """Returns the source's current full snapshot as raw records."""

    @abstractmethod
    def parse(self, record: Record, today: date) -> ParseResult:
        """Validates and normalizes one record. Must not raise for bad data: return Rejected."""
