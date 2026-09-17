"""Identità: registrazione, login, refresh con rotazione, verifica email, reset password."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.email.base import Mailer, OutgoingEmail
from app.errors import ApiError, Conflict, Unauthorized
from app.models import Entitlement, OneTimeToken, RefreshToken, User
from app.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_opaque_token,
    verify_password,
)

VERIFY_TTL = timedelta(hours=24)
RESET_TTL = timedelta(hours=2)


class TokenPair:
    def __init__(self, access: str, refresh: str, expires_in: int, user: User):
        self.access_token = access
        self.refresh_token = refresh
        self.expires_in = expires_in
        self.user = user


async def _issue_tokens(db: AsyncSession, user: User, settings: Settings) -> TokenPair:
    refresh = new_opaque_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
        )
    )
    await db.commit()
    access = create_access_token(user.id, settings)
    return TokenPair(access, refresh, settings.access_token_minutes * 60, user)


async def register(db: AsyncSession, settings: Settings, mailer: Mailer, email: str, password: str) -> TokenPair:
    user = User(
        email=email,
        password_hash=hash_password(password),
        terms_accepted_at=datetime.now(UTC),
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise Conflict("Questa email è già registrata.", code="email_taken")
    db.add(Entitlement(user_id=user.id, plan="free", source="none"))
    await db.flush()
    await send_verification(db, settings, mailer, user)
    return await _issue_tokens(db, user, settings)


async def login(db: AsyncSession, settings: Settings, email: str, password: str) -> TokenPair:
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise Unauthorized("Email o password non corrispondono.", code="invalid_credentials")
    return await _issue_tokens(db, user, settings)


async def refresh(db: AsyncSession, settings: Settings, refresh_token: str) -> TokenPair:
    now = datetime.now(UTC)
    row = (
        await db.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token)))
    ).scalar_one_or_none()
    if row is None or row.revoked_at is not None or row.expires_at < now:
        raise Unauthorized("La sessione è scaduta. Entra di nuovo.", code="invalid_refresh_token")
    user = await db.get(User, row.user_id)
    if user is None:
        raise Unauthorized("La sessione è scaduta. Entra di nuovo.", code="invalid_refresh_token")
    row.revoked_at = now  # rotazione: il vecchio non vale più
    return await _issue_tokens(db, user, settings)


async def logout(db: AsyncSession, user: User, refresh_token: str) -> None:
    row = (
        await db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == hash_token(refresh_token), RefreshToken.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is not None and row.revoked_at is None:
        row.revoked_at = datetime.now(UTC)
        await db.commit()


async def _new_one_time(db: AsyncSession, user: User, purpose: str, ttl: timedelta) -> str:
    token = new_opaque_token()
    db.add(
        OneTimeToken(user_id=user.id, purpose=purpose, token_hash=hash_token(token), expires_at=datetime.now(UTC) + ttl)
    )
    await db.flush()
    return token


async def _consume_one_time(db: AsyncSession, token: str, purpose: str) -> User:
    row = (
        await db.execute(
            select(OneTimeToken).where(OneTimeToken.token_hash == hash_token(token), OneTimeToken.purpose == purpose)
        )
    ).scalar_one_or_none()
    now = datetime.now(UTC)
    if row is None or row.used_at is not None or row.expires_at < now:
        raise ApiError("Questo link non vale più. Chiedine uno nuovo.", code="invalid_token", status_code=400)
    row.used_at = now
    user = await db.get(User, row.user_id)
    if user is None:
        raise ApiError("Questo link non vale più. Chiedine uno nuovo.", code="invalid_token", status_code=400)
    return user


async def send_verification(db: AsyncSession, settings: Settings, mailer: Mailer, user: User) -> None:
    token = await _new_one_time(db, user, "verify_email", VERIFY_TTL)
    link = f"{settings.frontend_url}/verifica?token={token}"
    await mailer.send(
        OutgoingEmail(
            to=user.email,
            subject="Conferma la tua email",
            text=f"Ciao. Per confermare l'email apri questo link: {link}\nVale 24 ore.",
            kind="verify_email",
            meta={"token": token},
        )
    )


async def verify_email(db: AsyncSession, token: str) -> User:
    user = await _consume_one_time(db, token, "verify_email")
    user.email_verified = True
    await db.commit()
    return user


async def forgot_password(db: AsyncSession, settings: Settings, mailer: Mailer, email: str) -> None:
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        return  # stessa risposta: non riveliamo chi è registrato
    token = await _new_one_time(db, user, "reset_password", RESET_TTL)
    link = f"{settings.frontend_url}/password/reset?token={token}"
    await mailer.send(
        OutgoingEmail(
            to=user.email,
            subject="Reimposta la password",
            text=f"Per scegliere una nuova password apri questo link: {link}\nVale 2 ore.",
            kind="reset_password",
            meta={"token": token},
        )
    )
    await db.commit()


async def reset_password(db: AsyncSession, token: str, password: str) -> None:
    user = await _consume_one_time(db, token, "reset_password")
    user.password_hash = hash_password(password)
    # tutte le sessioni aperte cadono
    rows = (await db.execute(select(RefreshToken).where(RefreshToken.user_id == user.id))).scalars().all()
    now = datetime.now(UTC)
    for r in rows:
        r.revoked_at = now
    await db.commit()


async def get_user(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)
