import pytest
from sqlalchemy import Engine, text

pytestmark = pytest.mark.integration


def test_database_has_postgis(engine: Engine) -> None:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        version = conn.execute(text("SELECT postgis_lib_version()")).scalar_one()
    assert version.startswith("3.")


def test_geography_distance_is_in_metres(engine: Engine) -> None:
    # One degree of latitude is about 111.2 km: same sanity check as the frontend's haversine test.
    query = text("SELECT ST_Distance(ST_GeogFromText('POINT(-73 45)'), ST_GeogFromText('POINT(-73 46)'))")
    with engine.connect() as conn:
        metres = conn.execute(query).scalar_one()
    assert 111_000 < metres < 111_300
