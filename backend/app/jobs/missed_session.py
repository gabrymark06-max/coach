"""Job: email di mancata seduta (una sola, 24-48 h dopo, con link al 'giorno no').

Task asyncio nel processo backend: nessuna coda in v1 (brief §7). Idempotente per seduta.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import structlog
from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clock import local_date
from app.config import Settings
from app.db import get_sessionmaker
from app.email.base import Mailer, OutgoingEmail
from app.llm.base import LLMProvider
from app.models import EmailLog, PlannedSession, User

log = structlog.get_logger()


async def run_once(db: AsyncSession, settings: Settings, mailer: Mailer, llm: LLMProvider, now: datetime | None = None) -> int:
    """Trova le sedute pianificate non fatte da >= 24h (e < 72h), apre il 'giorno no' in chat e manda l'email."""
    from app.services import today as today_service

    now = now or datetime.now(UTC)
    since = local_date(now - timedelta(hours=settings.missed_session_after_hours), settings.timezone)
    floor = local_date(now - timedelta(hours=72), settings.timezone)
    q = (
        select(PlannedSession, User)
        .join(User, User.id == PlannedSession.user_id)
        .where(
            PlannedSession.status == "planned",
            PlannedSession.date <= since,
            PlannedSession.date >= floor,
            PlannedSession.missed_email_sent_at.is_(None),
        )
    )
    rows = (await db.execute(q)).all()
    sent = 0
    for session, user in rows:
        session.status = "skipped"
        msg = await today_service.ensure_no_day_message(db, settings, llm, user, session, now=now)
        link = f"{settings.frontend_url}/chat?msg={msg.id}"
        await mailer.send(
            OutgoingEmail(
                to=user.email,
                subject="La seduta di ieri",
                text=(
                    "Ieri la seduta non c'è stata. Succede, e conta cosa facciamo adesso.\n"
                    f"Il coach ti ha scritto: {link}\n\nfitcoach - parli con un coach AI, non con una persona."
                ),
                kind="missed_session",
                meta={"session_id": str(session.id), "message_id": str(msg.id)},
            )
        )
        session.missed_email_sent_at = now
        db.add(EmailLog(user_id=user.id, to_email=user.email, kind="missed_session", subject="La seduta di ieri"))
        sent += 1
    await db.commit()
    return sent


async def run_forever(app: FastAPI, settings: Settings) -> None:
    await asyncio.sleep(5)
    while True:
        try:
            async with get_sessionmaker()() as db:
                n = await run_once(db, settings, app.state.mailer, app.state.llm)
                if n:
                    log.info("missed_session_job", emails_sent=n)
        except Exception:  # il job non deve mai uccidere il processo
            log.exception("missed_session_job_failed")
        await asyncio.sleep(settings.missed_session_job_interval_s)
