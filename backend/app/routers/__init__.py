from __future__ import annotations

from fastapi import FastAPI


def register_routers(app: FastAPI) -> None:
    from app.routers import account, auth, billing, chat, events, knowledge, me, plans, progress, sessions

    app.include_router(auth.router)
    app.include_router(me.router)
    app.include_router(plans.router)
    app.include_router(sessions.router)
    app.include_router(progress.router)
    app.include_router(chat.router)
    app.include_router(billing.router)
    app.include_router(account.router)
    app.include_router(events.router)
    app.include_router(knowledge.router)
