"""Seam: contratto v1.1.1 (2026-09-17) — tre difetti trovati dal frontend in browser.

1. Le opzioni `chat_option` di `GET /today` sono un sottoinsieme delle `options` del messaggio che le porta
   (`POST /chat/options/full` su `return_after_break` era 404).
2. Le risposte del coach a `pause_plan` e `remove_exercise` dicono il vero: data di ripartenza; nessun esercizio tolto.
3. "Oggi" è la data locale (Europe/Rome), non la data UTC: alle 23:30 a Roma /today è ancora oggi.
"""

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest_asyncio
from sqlalchemy import select

from app.clock import today_local
from tests.conftest import register
from tests.helpers import seed
from tests.test_onboarding_plan import ONB


@pytest_asyncio.fixture
async def onboarded(client, db, app):
    await seed(db, app)
    headers, _ = await register(client)
    r = await client.post("/onboarding", json={**ONB, "level": "intermediate", "days_per_week": 4}, headers=headers)
    assert r.status_code == 201, r.text
    return headers, r.json()


async def _shift_plan(db, days: int) -> None:
    from app.models import Mesocycle, PlannedSession, PlanWeek

    shift = timedelta(days=days)
    meso = (await db.execute(select(Mesocycle))).scalar_one()
    meso.started_on -= shift
    for w in (await db.execute(select(PlanWeek))).scalars().all():
        w.starts_on -= shift
    for s in (await db.execute(select(PlannedSession))).scalars().all():
        s.date -= shift
    await db.commit()


async def _close(client, headers, sid: str) -> dict:
    s = (await client.get(f"/sessions/{sid}", headers=headers)).json()
    sets = [{"set_id": st["id"], "weight_kg": 40, "reps": 8, "rir": 2, "status": "done"} for e in s["exercises"] if not e["removed_today"] for st in e["sets"]]
    r = await client.post(f"/sessions/{sid}/close", json={"client_op_id": f"close-{sid}", "client_updated_at": datetime.now(UTC).isoformat(), "sets": sets}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


async def _move_todays_session_to_tomorrow(db) -> None:
    from app.models import PlannedSession

    today = today_local()
    for s in (await db.execute(select(PlannedSession).where(PlannedSession.date == today))).scalars().all():
        s.date = today + timedelta(days=1)
    await db.commit()


async def _assert_today_options_are_subset_of_message(client, headers, t: dict) -> tuple[str, list[dict]]:
    msg_id = t["redirect"].split("msg=")[1]
    chat_opts = [o for o in t["empty_state"]["options"] if o["action"]["type"] == "chat_option"]
    assert chat_opts, t
    thread = (await client.get("/chat/messages", headers=headers)).json()
    msg = next(m for m in thread if m["id"] == msg_id)
    msg_opts = next(b for b in msg["blocks"] if b["type"] == "options")["options"]
    offered = {o["action"]["target"] for o in chat_opts}
    carried = {o["id"] for o in msg_opts}
    assert offered <= carried, f"/today offre {offered} ma il messaggio {msg['protocol']} porta {carried}"
    assert all(o["action"]["message_id"] == msg_id for o in chat_opts)
    return msg_id, chat_opts


# ---------------------------------------------------------------- 1. invariante: /today ⊆ messaggio


async def test_return_after_break_offers_only_what_the_message_carries_and_full_is_executable(client, db, onboarded):
    headers, body = onboarded
    await _close(client, headers, body["first_session_id"])
    await _shift_plan(db, 22)
    await _move_todays_session_to_tomorrow(db)
    t = (await client.get("/today", headers=headers)).json()
    assert t["kind"] == "return_after_break", t
    msg_id, chat_opts = await _assert_today_options_are_subset_of_message(client, headers, t)
    assert [o["id"] for o in chat_opts] == ["short_tomorrow", "full"]
    r = await client.post("/chat/options/full", json={"message_id": msg_id}, headers=headers)
    assert r.status_code == 200, r.text
    reply = r.json()
    assert reply["kind"] == "proactive" and reply["reply_to_id"] == msg_id
    assert reply["protocol"] == "options_reply"
    assert not any(b["type"] == "plan_change" for b in reply["blocks"])  # intera = il piano com'è: niente diff
    assert (await client.get("/chat/quota", headers=headers)).json()["used"] == 0


async def test_week_skipped_offers_only_what_the_message_carries(client, db, onboarded):
    headers, body = onboarded
    # settimana corrente: le prime due sedute sono passate e non fatte, oggi niente
    await _shift_plan(db, 3)
    await _move_todays_session_to_tomorrow(db)
    from app.models import PlannedSession

    today = today_local()
    past = [s for s in (await db.execute(select(PlannedSession))).scalars().all() if s.date < today and s.week_n == 1]
    assert len(past) >= 2, "servono almeno due sedute già passate nella settimana 1"
    t = (await client.get("/today", headers=headers)).json()
    assert t["kind"] == "week_skipped", t
    msg_id, chat_opts = await _assert_today_options_are_subset_of_message(client, headers, t)
    assert [o["id"] for o in chat_opts] == ["short_tomorrow", "full"]
    r = await client.post("/chat/options/full", json={"message_id": msg_id}, headers=headers)
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------- 2. risposte oneste alle opzioni di sicurezza


def _text(msg: dict) -> str:
    return next(b for b in msg["blocks"] if b["type"] == "paragraph")["text"]


async def _severe_readiness(client, headers, sid: str) -> str:
    r = await client.post(f"/sessions/{sid}/readiness", json={"sleep": "gt8", "mood": "high", "pain": "severe"}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["safety"]["message_id"]


async def test_pause_plan_reply_says_when_the_plan_restarts(client, db, onboarded, app):
    headers, body = onboarded
    sid = body["first_session_id"]
    msg_id = await _severe_readiness(client, headers, sid)
    calls_before = len(app.state.llm.calls)
    r = await client.post("/chat/options/pause_plan", json={"message_id": msg_id}, headers=headers)
    assert r.status_code == 200, r.text
    reply = r.json()
    assert len(app.state.llm.calls) == calls_before  # sicurezza: testo fisso, niente LLM
    restart = today_local() + timedelta(days=7)
    from app.services.dates_it import human_date

    text = _text(reply)
    assert human_date(restart) in text, text
    assert "7 giorni" in text or "sette giorni" in text
    assert "!" not in text and "dovresti" not in text.lower()
    pc = next(b for b in reply["blocks"] if b["type"] == "plan_change")
    assert pc["applied"] is True and pc["diff"][0]["field"] == "pausa" and pc["diff"][0]["to"] == restart.isoformat()
    # e la seduta di oggi è davvero il giorno della ripartenza
    assert (await client.get(f"/sessions/{sid}", headers=headers)).json()["date"] == restart.isoformat()


async def test_remove_exercise_reply_is_honest_and_removes_nothing(client, db, onboarded, app):
    headers, body = onboarded
    sid = body["first_session_id"]
    msg_id = await _severe_readiness(client, headers, sid)
    before = (await client.get(f"/sessions/{sid}", headers=headers)).json()
    calls_before = len(app.state.llm.calls)
    r = await client.post("/chat/options/remove_exercise", json={"message_id": msg_id}, headers=headers)
    assert r.status_code == 200, r.text
    reply = r.json()
    assert len(app.state.llm.calls) == calls_before
    text = _text(reply)
    assert not any(b["type"] == "plan_change" for b in reply["blocks"])  # nessun diff: niente è stato tolto
    assert "sistemato" not in text.lower() and "tolto" not in text.lower() and not text.startswith("Fatto")
    assert "Sostituisci" in text and "Salta" in text  # le due azioni in seduta
    assert "chat" in text.lower() or "scriv" in text.lower()  # e la via in chat
    assert "!" not in text and "dovresti" not in text.lower()
    after = (await client.get(f"/sessions/{sid}", headers=headers)).json()
    assert [(e["id"], e["skipped"], e["removed_today"]) for e in after["exercises"]] == [(e["id"], e["skipped"], e["removed_today"]) for e in before["exercises"]]
    assert after["updated_at"] == before["updated_at"]


async def test_full_after_break_reply_names_the_next_session_instead_of_claiming_a_change(client, db, onboarded):
    headers, body = onboarded
    await _close(client, headers, body["first_session_id"])
    await _shift_plan(db, 22)
    await _move_todays_session_to_tomorrow(db)
    t = (await client.get("/today", headers=headers)).json()
    assert t["kind"] == "return_after_break", t
    msg_id = t["redirect"].split("msg=")[1]
    reply = (await client.post("/chat/options/full", json={"message_id": msg_id}, headers=headers)).json()
    from app.services.dates_it import human_date

    text = _text(reply)
    assert human_date(today_local() + timedelta(days=1)) in text, text
    assert "sistemato" not in text.lower()


# ---------------------------------------------------------------- 3. "oggi" è la data locale (Europe/Rome), non quella UTC


def _freeze(monkeypatch, local: datetime) -> datetime:
    """Blocca l'orologio dell'app su un istante espresso in Europe/Rome. Ritorna l'istante in UTC."""
    import app.clock as clock

    instant = local.astimezone(UTC)
    monkeypatch.setattr(clock, "utcnow", lambda: instant)
    return instant


async def test_today_at_2330_rome_is_still_today(client, onboarded, monkeypatch):
    headers, body = onboarded
    today = today_local()  # il piano è partito oggi (ora locale): la prima seduta è oggi
    instant = _freeze(monkeypatch, datetime.combine(today, datetime.min.time(), tzinfo=ZoneInfo("Europe/Rome")).replace(hour=23, minute=30))
    t = (await client.get("/today", headers=headers)).json()
    assert t["date"] == today.isoformat(), (t, instant)
    assert t["kind"] == "session" and t["session_preview"]["session_id"] == body["first_session_id"]


async def test_today_at_0030_rome_is_tomorrow_even_if_utc_says_otherwise(client, onboarded, monkeypatch):
    headers, body = onboarded
    today = today_local()
    tomorrow = today + timedelta(days=1)
    instant = _freeze(monkeypatch, datetime.combine(tomorrow, datetime.min.time(), tzinfo=ZoneInfo("Europe/Rome")).replace(hour=0, minute=30))
    assert instant.date() == today, "in UTC è ancora oggi: è esattamente il caso del difetto"
    t = (await client.get("/today", headers=headers)).json()
    assert t["date"] == tomorrow.isoformat(), t
    assert t["kind"] != "session" or t["session_preview"]["session_id"] != body["first_session_id"]
    # la costanza ragiona sulla stessa "oggi": la seduta di ieri, non fatta, non è più "in programma"
    c = (await client.get("/progress/consistency", params={"weeks": 4}, headers=headers)).json()
    assert next(d for d in c["days"] if d["date"] == today.isoformat())["status"] == "skipped"
    # e la quota si azzera sul mese solare locale (invariato: era già Europe/Rome)
    q = (await client.get("/chat/quota", headers=headers)).json()
    assert q["resets_at"].endswith("Z") or "+00:00" in q["resets_at"]


async def test_missed_session_job_uses_local_calendar_day(onboarded, db, app):
    from app.config import get_settings
    from app.jobs.missed_session import run_once
    from app.models import PlannedSession

    today = today_local()
    yesterday = today - timedelta(days=1)
    sessions = sorted((await db.execute(select(PlannedSession))).scalars().all(), key=lambda s: (s.date, s.index_in_week))
    sessions[0].date = yesterday
    await db.commit()
    app.state.mailer.sent.clear()
    # 00:30 di oggi a Roma: sono passate 24 h dalle 00:30 di ieri, giorno della seduta -> l'email parte
    now = datetime.combine(today, datetime.min.time(), tzinfo=ZoneInfo("Europe/Rome")).replace(hour=0, minute=30).astimezone(UTC)
    assert (now - timedelta(hours=24)).date() == yesterday - timedelta(days=1), "in UTC il calcolo direbbe l'altro ieri"
    n = await run_once(db, get_settings(), app.state.mailer, app.state.llm, now=now)
    assert n == 1
