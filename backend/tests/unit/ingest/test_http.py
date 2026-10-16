import httpx
import pytest

from spawn_api.ingest.http import USER_AGENT, download_json, make_client


def test_sends_user_agent_and_follows_redirect_to_storage() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.host == "donnees.montreal.ca":
            return httpx.Response(302, headers={"Location": "https://storage.example/evenements.geojson"})
        return httpx.Response(200, json={"type": "FeatureCollection", "features": []})

    data = download_json(
        "https://donnees.montreal.ca/x.geojson", client=make_client(httpx.MockTransport(handler))
    )

    assert data == {"type": "FeatureCollection", "features": []}
    assert [r.url.host for r in seen] == ["donnees.montreal.ca", "storage.example"]
    assert all(r.headers["User-Agent"] == USER_AGENT for r in seen)


def test_raises_on_http_error() -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(403, text="RBAC: access denied"))
    with pytest.raises(httpx.HTTPStatusError, match="403"):
        download_json("https://donnees.montreal.ca/x.geojson", client=make_client(transport))
