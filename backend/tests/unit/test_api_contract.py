"""API behaviour that doesn't need a database: validation, error shape, cursors, OpenAPI."""

import uuid

import pytest
from fastapi.testclient import TestClient

from spawn_api.api.pagination import DistanceCursor, InvalidCursorError
from spawn_api.main import create_app


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def test_cursor_round_trip() -> None:
    cursor = DistanceCursor(distance_m=1234.5678, id=uuid.uuid4())
    assert DistanceCursor.decode(cursor.encode()) == cursor


@pytest.mark.parametrize("token", ["", "not-base64!!", "e30", "eyJkIjogImEiLCAiaWQiOiAieCJ9"])
def test_garbage_cursors_are_rejected(token: str) -> None:
    with pytest.raises(InvalidCursorError):
        DistanceCursor.decode(token)


def test_invalid_cursor_returns_400_in_the_standard_error_shape(client: TestClient) -> None:
    response = client.get("/api/v1/spawns", params={"lat": 45.5, "lng": -73.57, "cursor": "garbage"})
    assert response.status_code == 400
    assert response.json() == {"error": {"status": 400, "message": "invalid cursor", "details": None}}


def test_missing_and_out_of_range_parameters_return_422_with_field_names(client: TestClient) -> None:
    response = client.get("/api/v1/spawns", params={"lat": 123, "radius_m": 999_999})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["message"] == "invalid request"
    fields = {d["field"] for d in error["details"]}
    assert fields == {"query.lat", "query.lng", "query.radius_m"}


def test_unknown_type_is_a_validation_error(client: TestClient) -> None:
    response = client.get("/api/v1/spawns", params={"lat": 45.5, "lng": -73.57, "type": "poetry"})
    assert response.status_code == 422


def test_malformed_spawn_id_is_a_validation_error(client: TestClient) -> None:
    assert client.get("/api/v1/spawns/not-a-uuid").status_code == 422


def test_api_is_read_only(client: TestClient) -> None:
    assert client.post("/api/v1/spawns").status_code == 405
    assert client.delete(f"/api/v1/spawns/{uuid.uuid4()}").status_code == 405


def test_openapi_documents_every_endpoint(client: TestClient) -> None:
    paths = set(client.get("/openapi.json").json()["paths"])
    assert {
        "/health",
        "/api/v1/spawns",
        "/api/v1/spawns/{spawn_id}",
        "/api/v1/sources",
        "/api/v1/ingestion-runs",
    } <= paths
