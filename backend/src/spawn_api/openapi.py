"""Writes the API's OpenAPI schema, the contract the frontend's TypeScript types are generated from.

    uv run python -m spawn_api.openapi > openapi.json

CI regenerates it and fails if the committed backend/openapi.json is out of date.
"""

import json
import sys

from spawn_api.main import create_app


def schema_json() -> str:
    return json.dumps(create_app().openapi(), indent=2, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    # Raw UTF-8 bytes, so line endings are LF on every OS (print() would write CRLF on Windows).
    sys.stdout.buffer.write(schema_json().encode("utf-8"))
