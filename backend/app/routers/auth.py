from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from app.deps import DbDep, MailerDep, SettingsDep, UserDep
from app.ratelimit import limiter
from app.schemas.auth import (
    AcceptedOut,
    ForgotIn,
    LoginIn,
    LogoutIn,
    RefreshIn,
    RegisterIn,
    ResetIn,
    TokenPairOut,
    UserOut,
    VerifyIn,
)
from app.schemas.common import ERROR_RESPONSES, ErrorOut
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

_AUTH_LIMIT = "10/minute"


def _pair(tp: auth_service.TokenPair) -> TokenPairOut:
    return TokenPairOut(
        access_token=tp.access_token,
        refresh_token=tp.refresh_token,
        expires_in=tp.expires_in,
        user=UserOut(id=tp.user.id, email=tp.user.email, email_verified=tp.user.email_verified),
    )


@router.post(
    "/register",
    response_model=TokenPairOut,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorOut, "description": "`email_taken`"}, **ERROR_RESPONSES},
    summary="Registrazione con email e password. Accetta Termini e Privacy. Manda l'email di verifica.",
)
@limiter.limit(_AUTH_LIMIT)
async def register(request: Request, body: RegisterIn, db: DbDep, settings: SettingsDep, mailer: MailerDep):
    return _pair(await auth_service.register(db, settings, mailer, body.email, body.password))


@router.post(
    "/login",
    response_model=TokenPairOut,
    responses={401: {"model": ErrorOut, "description": "`invalid_credentials`"}, **ERROR_RESPONSES},
)
@limiter.limit(_AUTH_LIMIT)
async def login(request: Request, body: LoginIn, db: DbDep, settings: SettingsDep):
    return _pair(await auth_service.login(db, settings, body.email, body.password))


@router.post(
    "/refresh",
    response_model=TokenPairOut,
    responses={401: {"model": ErrorOut, "description": "`invalid_refresh_token`"}, **ERROR_RESPONSES},
    summary="Scambia il refresh token con una nuova coppia. Il vecchio refresh viene revocato (rotazione).",
)
@limiter.limit("30/minute")
async def refresh(request: Request, body: RefreshIn, db: DbDep, settings: SettingsDep):
    return _pair(await auth_service.refresh(db, settings, body.refresh_token))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, responses=ERROR_RESPONSES)
async def logout(body: LogoutIn, db: DbDep, user: UserDep) -> Response:
    await auth_service.logout(db, user, body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/verify/resend",
    response_model=AcceptedOut,
    status_code=status.HTTP_202_ACCEPTED,
    responses=ERROR_RESPONSES,
)
@limiter.limit("5/minute")
async def verify_resend(request: Request, db: DbDep, settings: SettingsDep, mailer: MailerDep, user: UserDep):
    await auth_service.send_verification(db, settings, mailer, user)
    await db.commit()
    return AcceptedOut(detail="Ti ho mandato il link. Vale 24 ore.")


@router.post(
    "/verify",
    response_model=UserOut,
    responses={400: {"model": ErrorOut, "description": "`invalid_token`"}, **ERROR_RESPONSES},
)
@limiter.limit(_AUTH_LIMIT)
async def verify(request: Request, body: VerifyIn, db: DbDep):
    user = await auth_service.verify_email(db, body.token)
    return UserOut(id=user.id, email=user.email, email_verified=user.email_verified)


@router.post(
    "/password/forgot",
    response_model=AcceptedOut,
    status_code=status.HTTP_202_ACCEPTED,
    responses=ERROR_RESPONSES,
    summary="Risponde 202 anche se l'email non esiste: non rivela chi è registrato.",
)
@limiter.limit("5/minute")
async def forgot(request: Request, body: ForgotIn, db: DbDep, settings: SettingsDep, mailer: MailerDep):
    await auth_service.forgot_password(db, settings, mailer, body.email)
    return AcceptedOut(detail="Se l'email è registrata, ti ho mandato il link. Vale 2 ore.")


@router.post(
    "/password/reset",
    response_model=AcceptedOut,
    responses={400: {"model": ErrorOut, "description": "`invalid_token`"}, **ERROR_RESPONSES},
)
@limiter.limit(_AUTH_LIMIT)
async def reset(request: Request, body: ResetIn, db: DbDep):
    await auth_service.reset_password(db, body.token, body.password)
    return AcceptedOut(detail="Password cambiata. Entra con quella nuova.")
