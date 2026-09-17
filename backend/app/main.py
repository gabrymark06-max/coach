"""App factory. Tutto ciò che parte e si ferma con il processo sta nel lifespan."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.middleware import SlowAPIMiddleware

from app.config import get_settings
from app.db import dispose_engine, get_engine
from app.email import build_mailer
from app.errors import UnhandledErrorMiddleware, install_error_handlers
from app.logging_setup import RequestLogMiddleware, configure_logging
from app.ratelimit import limiter
from app.security_headers import SecurityHeadersMiddleware

TAGS = [
    {"name": "auth", "description": "Registrazione, accesso, refresh, verifica email, reset password."},
    {"name": "me", "description": "Stato dell'utente: entitlement, quota, mesociclo, abbonamento."},
    {"name": "onboarding", "description": "Schema del form, invio delle risposte, consenso art. 9."},
    {"name": "today", "description": "Hub di Oggi: seduta o stato vuoto del coach."},
    {"name": "plans", "description": "Mesociclo corrente, settimane, proposte di modifica, riepilogo di fine blocco."},
    {"name": "sessions", "description": "Seduta: lettura, readiness, scritture idempotenti, chiusura, sync offline."},
    {"name": "progress", "description": "Costanza, grafici per esercizio, PR."},
    {"name": "chat", "description": "Il coach AI: messaggi, opzioni, quota. Non scrive mai nel DB direttamente."},
    {"name": "billing", "description": "Stripe Checkout, Portal, recesso 14 giorni, contatore fondatori, webhook."},
    {"name": "account", "description": "Export dati, cancellazione, eventi di prodotto."},
    {"name": "knowledge", "description": "Regole, citazioni ed esercizi: la base che alimenta le note."},
]


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.app_env)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        get_engine()
        app.state.mailer = build_mailer(settings)
        from app.llm import build_embedder, build_llm

        app.state.llm = build_llm(settings)
        app.state.embedder = build_embedder(settings)
        from app.services.stripe_gateway import build_stripe

        app.state.stripe = build_stripe(settings)
        job_task = None
        if settings.missed_session_job_enabled:
            from app.jobs.missed_session import run_forever

            job_task = asyncio.create_task(run_forever(app, settings))
        structlog.get_logger().info(
            "startup", env=settings.app_env, llm_provider=settings.llm_provider, email_provider=settings.email_provider
        )
        try:
            yield
        finally:
            if job_task:
                job_task.cancel()
            await dispose_engine()

    app = FastAPI(
        title="fitcoach API",
        version="1.0.0",
        description=(
            "Contratto congelato: il frontend legge questo documento come fonte di verità.\n\n"
            "Ogni errore ha la forma `{ code, detail, ...extra }` con `detail` in italiano nel tono del prodotto. "
            "I numeri del piano arrivano come `{ value, unit, note_n }`: se `note_n` è null l'apice non si disegna. "
            "I testi del coach marcano gli apici con `[[n]]`."
        ),
        openapi_tags=TAGS,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url=None,
    )
    app.state.limiter = limiter
    # Ordine: l'ultimo aggiunto è il più esterno. Il catch-all va per primo (più interno) così CORS e
    # RequestLog vestono anche i 500 (QA B2).
    app.add_middleware(UnhandledErrorMiddleware)
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(RequestLogMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-Id", "If-None-Match"],
        expose_headers=["X-Request-Id", "ETag", "Retry-After"],
    )
    app.add_middleware(SecurityHeadersMiddleware)  # il più esterno: vale anche per ciò che esce da CORS e dal 500 di Starlette
    install_error_handlers(app)

    from app.routers import register_routers

    register_routers(app)
    return app


app = create_app()
