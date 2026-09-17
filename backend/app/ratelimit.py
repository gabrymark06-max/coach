"""Rate limiting in-process (slowapi, storage memory). Regge con 1 worker/1 replica: vincolo di deploy v1."""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings
from app.security import decode_access_token


def _key(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        uid = decode_access_token(auth[7:], get_settings())
        if uid:
            return f"user:{uid}"
    return f"ip:{get_remote_address(request)}"


_settings = get_settings()
limiter = Limiter(
    key_func=_key,
    default_limits=[_settings.rate_limit_default],
    enabled=_settings.rate_limit_enabled,
    headers_enabled=False,  # con True slowapi pretende un parametro Response su ogni rotta decorata
    storage_uri="memory://",
)
