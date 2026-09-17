"""Dipendenze FastAPI: settings, sessione DB, utente corrente."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.email.base import Mailer
from app.errors import Unauthorized
from app.models import User
from app.security import decode_access_token

_bearer = HTTPBearer(auto_error=False)

SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[AsyncSession, Depends(get_session)]


def get_mailer(request: Request) -> Mailer:
    return request.app.state.mailer


MailerDep = Annotated[Mailer, Depends(get_mailer)]


async def current_user(
    db: DbDep,
    settings: SettingsDep,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise Unauthorized()
    user_id = decode_access_token(creds.credentials, settings)
    if user_id is None:
        raise Unauthorized()
    user = await db.get(User, user_id)
    if user is None:
        raise Unauthorized()
    return user


UserDep = Annotated[User, Depends(current_user)]
