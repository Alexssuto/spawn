from collections.abc import Iterator

from fastapi import Request
from sqlalchemy.orm import Session, sessionmaker


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one database session per request, always closed afterwards.

    The session factory is created once in create_app() and stored on app.state, so tests can
    point the app at a different database without touching globals.
    """
    factory: sessionmaker[Session] = request.app.state.session_factory
    with factory() as session:
        yield session
