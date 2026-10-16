"""Downloading source files."""

from typing import Any

import httpx

# The open data portal answers "RBAC: access denied" to requests without a User-Agent.
USER_AGENT = "spawn-ingest/0.1 (+https://github.com/Alexssuto/spawn)"


def make_client(transport: httpx.BaseTransport | None = None, timeout: float = 60.0) -> httpx.Client:
    """HTTP client with the User-Agent the portal requires, redirects followed (downloads redirect
    to cloud storage) and failed connections retried. Tests pass a mock transport."""
    return httpx.Client(
        headers={"User-Agent": USER_AGENT},
        timeout=timeout,
        follow_redirects=True,
        transport=transport or httpx.HTTPTransport(retries=3),
    )


def download_json(url: str, *, client: httpx.Client | None = None) -> Any:
    """GETs a URL and parses JSON. Raises on any non-2xx status."""
    with client or make_client() as http:
        response = http.get(url)
        response.raise_for_status()
        return response.json()
