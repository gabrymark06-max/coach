"""Seam: job email di mancata seduta, export dati, cancellazione account."""

from datetime import UTC, datetime, timedelta

import pytest_asyncio
from sqlalchemy import select

from app.clock import today_local
from app.config import get_settings
from app.jobs.missed_session import run_once
from app.models import ChatMessage, PlannedSession, User
from tests.conftest import register
from tests.helpers import seed
from tests.test_onboarding_plan import ONB


@pytest_asyncio.fixture
async def onboarded(client, db, app):
    await seed(db, app)
    headers, body = await register(client)
    r = await client.post("/onboarding", json=ONB, headers=headers)
    assert r.status_code == 201, r.text
    app.state.mailer.sent.clear()
    return headers, r.json()


async def test_missed_session_job_sends_one_email_with_no_day_link(client, onboarded, db, app):
    headers, body = onboarded
    sessions = sorted((await db.execute(select(PlannedSession))).scalars().all(), key=lambda s: (s.date, s.index_in_week))
    first = sessions[0]
    first.date = today_local() - timedelta(days=1)
    await db.commit()
    n = await run_once(db, get_settings(), app.state.mailer, app.state.llm)
    assert n == 1
    mail = next(m for m in app.state.mailer.sent if m.kind == "missed_session")
    assert "/chat?msg=" in mail.text and mail.to == "anna@example.org"
    msg = await db.get(ChatMessage, mail.meta["message_id"])
    assert msg is not None and msg.protocol == "no_day" and msg.kind == "proactive"
    n2 = await run_once(db, get_settings(), app.state.mailer, app.state.llm)
    assert n2 == 0, "idempotente per seduta"
    t = (await client.get("/today", headers=headers)).json()
    assert t["kind"] == "session_skipped" and t["redirect"] == f"/chat?msg={msg.id}"
    thread = (await client.get("/chat/messages", headers=headers)).json()
    assert sum(1 for m in thread if m["protocol"] == "no_day") == 1, "il giorno no si apre una volta sola"


async def test_missed_session_job_ignores_sessions_older_than_72h(client, onboarded, db, app):
    headers, body = onboarded
    sessions = sorted((await db.execute(select(PlannedSession))).scalars().all(), key=lambda s: (s.date, s.index_in_week))
    sessions[0].date = today_local() - timedelta(days=10)
    await db.commit()
    n = await run_once(db, get_settings(), app.state.mailer, app.state.llm)
    assert n == 0


async def test_export_returns_download_and_payload(client, onboarded):
    headers, body = onboarded
    r = await client.post("/me/export", headers=headers)
    assert r.status_code == 202, r.text
    out = r.json()
    assert out["download_url"].startswith("/me/export/") and out["expires_at"]
    d = await client.get(out["download_url"], headers=headers)
    assert d.status_code == 200
    payload = d.json()
    assert payload["user"]["email"] == "anna@example.org"
    assert payload["profile"]["goal"] == "hypertrophy"
    assert len(payload["mesocycles"]) == 1 and payload["mesocycles"][0]["sessions"]
    assert payload["chat_messages"] and payload["events"]
    assert "password_hash" not in str(payload)
    other, _ = await register(client, email="b@example.org")
    denied = await client.get(out["download_url"], headers=other)
    assert denied.status_code == 404


async def test_delete_account_removes_everything(client, onboarded, db):
    headers, body = onboarded
    r = await client.delete("/me", headers=headers)
    assert r.status_code == 204
    me = await client.get("/me", headers=headers)
    assert me.status_code == 401
    login = await client.post("/auth/login", json={"email": "anna@example.org", "password": "Password-forte-1"})
    assert login.status_code == 401
    assert (await db.execute(select(User))).scalars().all() == []
    assert (await db.execute(select(PlannedSession))).scalars().all() == []
    assert (await db.execute(select(ChatMessage))).scalars().all() == []
