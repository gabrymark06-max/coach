"""Un solo formato di errore su tutta l'API: { code, detail, ...extra }.

`code` è per la macchina, `detail` è in italiano, nel tono del prodotto (design-system §6.2).
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi.errors import RateLimitExceeded
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class ErrorBody(BaseModel):
    code: str
    detail: str


class ApiError(Exception):
    status_code: int = 400
    code: str = "bad_request"

    def __init__(self, detail: str, *, code: str | None = None, status_code: int | None = None, **extra: Any):
        super().__init__(detail)
        self.detail = detail
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        self.extra = extra

    def body(self) -> dict[str, Any]:
        return {"code": self.code, "detail": self.detail, **self.extra}


class Unauthorized(ApiError):
    status_code = 401
    code = "unauthorized"

    def __init__(self, detail: str = "La sessione è scaduta. Entra di nuovo.", **extra: Any):
        super().__init__(detail, **extra)


class Forbidden(ApiError):
    status_code = 403
    code = "forbidden"


class PlanRequired(ApiError):
    status_code = 403
    code = "plan_required"

    def __init__(self, detail: str = "Per questo serve il blocco 2, e il blocco 2 è Pro.", **extra: Any):
        super().__init__(detail, **extra)


class NotFound(ApiError):
    status_code = 404
    code = "not_found"

    def __init__(self, detail: str = "Non trovo quello che cerchi.", **extra: Any):
        super().__init__(detail, **extra)


class Conflict(ApiError):
    status_code = 409
    code = "conflict"


class UnprocessableError(ApiError):
    status_code = 422
    code = "validation_error"


class QuotaExceeded(ApiError):
    status_code = 429
    code = "chat_quota_exceeded"


def error_response(status_code: int, code: str, detail: str, **extra: Any) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"code": code, "detail": detail, **extra})


_HTTP_CODES = {
    401: ("unauthorized", "La sessione è scaduta. Entra di nuovo."),
    403: ("forbidden", "Non puoi fare questa operazione."),
    404: ("not_found", "Non trovo quello che cerchi."),
    405: ("method_not_allowed", "Metodo non ammesso."),
    429: ("rate_limited", "Troppe richieste in poco tempo. Aspetta un attimo e riprova."),
}


def _field_path(loc: tuple[Any, ...]) -> str:
    return ".".join(str(p) for p in loc if p not in ("body", "query", "path"))


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.body())

    @app.exception_handler(HTTPException)
    async def _http_error(_: Request, exc: HTTPException) -> JSONResponse:
        code, detail = _HTTP_CODES.get(exc.status_code, ("http_error", str(exc.detail)))
        if isinstance(exc.detail, dict) and "code" in exc.detail:
            return JSONResponse(status_code=exc.status_code, content=exc.detail, headers=exc.headers)
        return JSONResponse(status_code=exc.status_code, content={"code": code, "detail": detail}, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {"field": _field_path(tuple(e.get("loc", ()))), "message": e.get("msg", ""), "type": e.get("type", "")}
            for e in exc.errors()
        ]
        first = errors[0]["field"] if errors else ""
        detail = f"Manca o non va bene il campo: {first}." if first else "Alcuni dati non vanno bene."
        return JSONResponse(
            status_code=422, content={"code": "validation_error", "detail": detail, "errors": errors}
        )

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limited(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        resp = error_response(429, "rate_limited", "Troppe richieste in poco tempo. Aspetta un attimo e riprova.")
        resp.headers["Retry-After"] = str(_retry_after_seconds(request, exc))
        return resp

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        # Ultima rete: gira nel ServerErrorMiddleware di Starlette, fuori da CORS. In pratica ci arriva solo
        # un'eccezione sollevata da un middleware esterno: quelle delle rotte le prende UnhandledErrorMiddleware.
        return _internal_error(exc)


def _retry_after_seconds(request: Request, exc: RateLimitExceeded) -> int:
    """Secondi alla fine della finestra (QA M11). slowapi lascia il limite colpito in `request.state.view_rate_limit`;
    se lo storage non risponde si ripiega sulla durata della finestra."""
    import time

    from app.ratelimit import limiter

    current = getattr(request.state, "view_rate_limit", None)
    try:
        if current is not None:
            reset_at, _remaining = limiter.limiter.get_window_stats(current[0], *current[1])
            return max(1, int(reset_at + 1 - time.time()))
    except Exception:  # noqa: BLE001 — l'header è un aiuto, non deve mai rompere il 429
        pass
    try:
        return max(1, int(exc.limit.limit.get_expiry()))
    except Exception:  # noqa: BLE001
        return 60


INTERNAL_ERROR_DETAIL = "Errore dalla nostra parte, non tua. Riprova tra un minuto."


def _internal_error(exc: Exception) -> JSONResponse:
    import structlog

    structlog.get_logger().exception("unhandled_error", error_type=type(exc).__name__)
    return error_response(500, "internal_error", INTERNAL_ERROR_DETAIL)


class UnhandledErrorMiddleware:
    """Cattura le eccezioni non gestite *dentro* CORS e RequestLog (QA B2).

    Va aggiunto per primo con `add_middleware`, cioè più vicino all'app: così anche un 500 esce con
    `Access-Control-Allow-Origin`, `X-Request-Id` e la forma `{code:"internal_error", detail}`.
    Se la risposta è già partita (stream) non c'è più niente da vestire: si rilancia.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = False

        async def _send(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, _send)
        except Exception as exc:  # noqa: BLE001 — è il punto: qualunque cosa, una sola forma
            if started:
                raise
            response = _internal_error(exc)
            await response(scope, receive, send)
