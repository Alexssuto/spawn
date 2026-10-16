"""One JSON error shape for every error the API returns:

{"error": {"status": 404, "message": "spawn not found", "details": null}}
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from spawn_api.api.schemas import ErrorBody, ErrorResponse


def _response(status: int, message: str, details: list[dict[str, Any]] | None = None) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(status=status, message=message, details=details))
    return JSONResponse(status_code=status, content=body.model_dump(mode="json"))


async def _http_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, HTTPException)
    return _response(exc.status_code, str(exc.detail))


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    details = [{"field": ".".join(str(p) for p in err["loc"]), "message": err["msg"]} for err in exc.errors()]
    return _response(422, "invalid request", details)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(HTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
