"""Command line entry point.

uv run python -m spawn_api.ingest montreal-events               # download and ingest
uv run python -m spawn_api.ingest montreal-events --file x.geojson  # ingest a local file
"""

import argparse
import json
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

from sqlalchemy.orm import sessionmaker

from spawn_api.db.engine import make_engine
from spawn_api.ingest.base import EventSource
from spawn_api.ingest.curated import CuratedSource
from spawn_api.ingest.montreal_events import MontrealEventsSource
from spawn_api.ingest.pipeline import IngestionPipeline, IngestionReport
from spawn_api.settings import get_settings

SOURCES: dict[str, Callable[[Callable[[], Any] | None], EventSource]] = {
    "montreal-events": MontrealEventsSource,
    "curated": CuratedSource,
}


def _print_report(report: IngestionReport) -> None:
    print(f"Ingestion run #{report.run_id} of {report.source}: {report.status}")
    for name in ("fetched", "inserted", "updated", "unchanged", "skipped", "rejected", "deactivated"):
        print(f"  {name:<12}{getattr(report, name):>6}")
    for title, reasons in (("Skipped", report.skip_reasons), ("Rejected", report.reject_reasons)):
        if reasons:
            print(f"{title} because:")
            for reason, count in reasons.most_common():
                print(f"  {count:>6}  {reason}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m spawn_api.ingest", description=__doc__)
    parser.add_argument("source", choices=sorted(SOURCES))
    parser.add_argument("--file", type=Path, help="read the source from a local file instead of downloading")
    args = parser.parse_args(argv)

    loader = (lambda: json.loads(args.file.read_text(encoding="utf-8"))) if args.file else None
    session_factory = sessionmaker(make_engine(get_settings()))
    pipeline = IngestionPipeline(session_factory, SOURCES[args.source](loader))
    try:
        report = pipeline.run()
    except Exception as error:
        print(f"Ingestion failed: {type(error).__name__}: {error}", file=sys.stderr)
        return 1
    _print_report(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
