from sqlalchemy import Engine, create_engine

from spawn_api.settings import Settings


def make_engine(settings: Settings) -> Engine:
    """Creates the SQLAlchemy engine (a connection pool) for the configured database.

    pool_pre_ping checks a pooled connection is still alive before using it, so a restarted
    database doesn't surface as a one-off error on the next request.
    """
    return create_engine(str(settings.database_url), pool_pre_ping=True)
