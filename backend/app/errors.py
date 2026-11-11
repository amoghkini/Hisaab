from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    """An error answer: {"error": {"code", "message", "details"}}. `details` lists problems per field."""

    def __init__(self, status: int, code: str, message: str, details: list[dict[str, str]] | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details or []


def _body(code: str, message: str, details: list[dict[str, Any]]) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details}}


def _field_message(error: dict[str, Any]) -> str:
    return str(error.get("msg", "Invalid value.")).removeprefix("Value error, ")


async def _api_error(_: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, ApiError):  # pragma: no cover - registered for ApiError only
        raise exc
    return JSONResponse(_body(exc.code, exc.message, exc.details), status_code=exc.status)


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):  # pragma: no cover
        raise exc
    details = [
        {"field": str(error["loc"][-1]), "message": _field_message(error)} for error in exc.errors() if error.get("loc")
    ]
    message = details[0]["message"] if details else "Some fields are not valid."
    return JSONResponse(_body("validation_failed", message, details), status_code=422)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _api_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
