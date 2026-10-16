from fastapi.testclient import TestClient

from spawn_api.main import create_app
from spawn_api.settings import Settings


def test_liveness_returns_ok() -> None:
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_allows_only_configured_origins() -> None:
    client = TestClient(create_app(Settings(cors_origins=["http://localhost:5173"])))

    allowed = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"

    other = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in other.headers


def test_openapi_schema_is_published() -> None:
    schema = TestClient(create_app()).get("/openapi.json").json()
    assert schema["info"]["title"] == "Spawn API"
    assert "/health" in schema["paths"]
