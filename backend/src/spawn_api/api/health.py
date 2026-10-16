from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthStatus(BaseModel):
    status: str


@router.get("/health")
def liveness() -> HealthStatus:
    """The process is up and able to answer HTTP requests. Does not touch the database."""
    return HealthStatus(status="ok")
