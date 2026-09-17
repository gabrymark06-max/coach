"""Seam: contratto v1.1 (2026-09-17) — i buchi trovati dal frontend, chiusi in modo additivo.

1. readiness `severe` -> `safety.message_id` eseguibile con `POST /chat/options/{id}`
2. `GET /today` -> `action.message_id` sulle opzioni `chat_option`
3. `POST /sessions/{id}/short` — versione corta senza questionario
4. `GET /chat/texts` -> `support_email`
5. `GET /progress/consistency.planned` conta solo le sedute fino a oggi
"""

from datetime import UTC, datetime, timedelta

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


async def _close(client, headers, sid: str, *, all_sets: bool = True) -> dict:
    s = (await client.get(f"/sessions/{sid}", headers=headers)).json()
    sets = []
    for e in s["exercises"]:
        if e["removed_today"]:
            continue
        for st in e["sets"]:
            sets.append({"set_id": st["id"], "weight_kg": 40, "reps": 8, "rir": 2, "status": "done"})
        if not all_sets:
            break
    r = await client.post(f"/sessions/{sid}/close", json={"client_op_id": f"close-{sid}", "client_updated_at": datetime.now(UTC).isoformat(), "sets": sets}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------- 5. costanza: "contiamo i ritorni", non il futuro


async def test_consistency_planned_counts_only_sessions_up_to_today(client, db, onboarded):
    headers, body = onboarded
    await _shift_plan(db, 14)  # due settimane di piano già passate, due ancora davanti
    today = today_local()
    from app.models import PlannedSession

    dates = [s.date for s in (await db.execute(select(PlannedSession))).scalars().all()]
    expected_planned = sum(1 for d in dates if d <= today)
    assert expected_planned < len(dates), "il piano deve avere sedute future perché il test abbia senso"
    await client.get("/today", headers=headers)  # le passate non fatte diventano skipped
    c = await client.get("/progress/consistency", params={"weeks": 4}, headers=headers)
    assert c.status_code == 200, c.text
    cb = c.json()
    assert cb["planned"] == expected_planned, cb
    assert cb["done"] == 0
    future = [d for d in cb["days"] if d["date"] > today.isoformat() and d.get("session_id")]
    assert future and all(d["status"] == "future" for d in future)


async def test_consistency_today_planned_session_counts_as_in_programma(client, onboarded):
    headers, body = onboarded
    today = today_local()
    c = (await client.get("/progress/consistency", params={"weeks": 4}, headers=headers)).json()
    todays = next(d for d in c["days"] if d["date"] == today.isoformat())
    assert todays["session_id"] and todays["status"] == "future"  # in programma, non "riposo"
    assert c["planned"] == 1 and c["done"] == 0
    await _close(client, headers, body["first_session_id"])
    c2 = (await client.get("/progress/consistency", params={"weeks": 4}, headers=headers)).json()
    assert c2["planned"] == 1 and c2["done"] == 1
    assert next(d for d in c2["days"] if d["date"] == today.isoformat())["status"] == "done"


# ---------------------------------------------------------------- 4. support_email pubblica


async def test_chat_texts_is_public_and_carries_support_email(client, db, app):
    await seed(db, app)
    r = await client.get("/chat/texts")  # senza Bearer: il footer pubblico e /prezzi la leggono
    assert r.status_code == 200, r.text
    body = r.json()
    from app.config import get_settings

    assert body["support_email"] == get_settings().support_email and "@" in body["support_email"]
    assert body["ai_badge_text"] and body["paywall_context_line"]["end_of_block"]


# ---------------------------------------------------------------- 2. /today: action.message_id sulle opzioni chat_option


async def test_today_chat_options_carry_message_id(client, db, onboarded):
    headers, body = onboarded
    await _close(client, headers, body["first_session_id"])  # una seduta fatta, poi 22 giorni di silenzio
    await _shift_plan(db, 22)
    today = today_local()
    from app.models import PlannedSession

    for s in (await db.execute(select(PlannedSession).where(PlannedSession.date == today))).scalars().all():
        s.date = today + timedelta(days=1)  # niente seduta oggi: deve uscire lo stato vuoto del ritorno
    await db.commit()
    t = (await client.get("/today", headers=headers)).json()
    assert t["kind"] == "return_after_break", t
    assert t["redirect"].startswith("/chat?msg=")
    msg_id = t["redirect"].split("msg=")[1]
    chat_opts = [o for o in t["empty_state"]["options"] if o["action"]["type"] == "chat_option"]
    assert [o["id"] for o in chat_opts] == ["short_tomorrow", "full"]
    for o in chat_opts:
        assert o["action"]["message_id"] == msg_id and o["action"]["target"] == o["id"]
    route_opts = [o for o in t["empty_state"]["options"] if o["action"]["type"] == "route"]
    assert route_opts and all(o["action"]["message_id"] is None for o in route_opts)
    # ed è eseguibile così com'è
    r = await client.post(f"/chat/options/{chat_opts[0]['action']['target']}", json={"message_id": chat_opts[0]["action"]["message_id"]}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["kind"] == "proactive" and r.json()["reply_to_id"] == msg_id


# ---------------------------------------------------------------- 1. readiness severe: il blocco di sicurezza è un messaggio in chat, eseguibile


async def test_readiness_severe_creates_safety_message_and_options_are_executable(client, db, onboarded, app):
    headers, body = onboarded
    sid = body["first_session_id"]
    calls_before = len(app.state.llm.calls)
    r = await client.post(f"/sessions/{sid}/readiness", json={"sleep": "gt8", "mood": "high", "pain": "severe"}, headers=headers)
    assert r.status_code == 200, r.text
    safety = r.json()["safety"]
    assert safety["message_id"] and [o["id"] for o in safety["options"]] == ["pause_plan", "remove_exercise", "continue_anyway"]
    assert len(app.state.llm.calls) == calls_before  # testo fisso: niente LLM
    # il messaggio esiste in chat, con la stessa forma del filtro di sicurezza
    msgs = (await client.get("/chat/messages", headers=headers)).json()
    m = next(x for x in msgs if x["id"] == safety["message_id"])
    assert m["role"] == "coach" and m["kind"] == "safety" and m["protocol"] == "safety.readiness"
    block = next(b for b in m["blocks"] if b["type"] == "safety")
    assert block["text"] == safety["text"] and [o["id"] for o in block["options"]] == [o["id"] for o in safety["options"]]
    assert (await client.get("/chat/quota", headers=headers)).json()["used"] == 0
    # ed è eseguibile così com'è: pausa del piano -> tutto slitta di 7 giorni, seduta di oggi compresa
    before = (await client.get(f"/sessions/{sid}", headers=headers)).json()["date"]
    o = await client.post("/chat/options/pause_plan", json={"message_id": safety["message_id"]}, headers=headers)
    assert o.status_code == 200, o.text
    ob = o.json()
    assert ob["kind"] == "proactive" and ob["reply_to_id"] == safety["message_id"]
    pc = next(b for b in ob["blocks"] if b["type"] == "plan_change")
    assert pc["applied"] is True and pc["diff"][0]["field"] == "pausa"
    after = (await client.get(f"/sessions/{sid}", headers=headers)).json()["date"]
    assert (datetime.fromisoformat(after).date() - datetime.fromisoformat(before).date()).days == 7
    again = await client.post("/chat/options/continue_anyway", json={"message_id": safety["message_id"]}, headers=headers)
    assert again.status_code == 409 and again.json()["code"] == "option_already_chosen"


async def test_readiness_not_severe_has_no_safety_message(client, onboarded):
    headers, body = onboarded
    r = await client.post(f"/sessions/{body['first_session_id']}/readiness", json={"sleep": "6to8", "mood": "mid", "pain": "mild"}, headers=headers)
    assert r.status_code == 200 and r.json()["safety"] is None
    assert all(m["kind"] != "safety" for m in (await client.get("/chat/messages", headers=headers)).json())


# ---------------------------------------------------------------- 3. versione corta dall'anteprima di Oggi, senza questionario


async def test_short_from_preview_applies_engine_short_version_with_diff_and_notes(client, onboarded):
    headers, body = onboarded
    sid = body["first_session_id"]
    full = (await client.get(f"/sessions/{sid}", headers=headers)).json()
    t0 = (await client.get("/today", headers=headers)).json()
    assert t0["session_preview"]["short_available"] is True
    r = await client.post(f"/sessions/{sid}/short", headers=headers)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["safety"] is None
    assert out["diff"]["short_version"] is True and out["diff"]["est_minutes"] < full["est_minutes"]
    assert any(c["field"] == "sets" and c["to"] == 2 for c in out["diff"]["changed_sets"])
    assert "[[1]]" in out["coach_line"] and out["notes"] and out["notes"][0]["rule_id"] == "session.short_version"
    s = out["session"]
    assert s["short_version"] is True and s["est_minutes"] == out["diff"]["est_minutes"] and s["readiness_done"] is False
    active = [e for e in s["exercises"] if not e["removed_today"]]
    assert active and all(e["prescription"]["sets"]["value"] == 2 for e in active)
    assert s["updated_at"] > full["updated_at"]
    # Oggi la vede: durata aggiornata, la corta non è più offerta
    t1 = (await client.get("/today", headers=headers)).json()
    assert t1["session_preview"]["est_minutes"] == out["diff"]["est_minutes"] and t1["session_preview"]["short_available"] is False
    # idempotenza: la seconda volta è un 409, non una doppia riduzione
    again = await client.post(f"/sessions/{sid}/short", headers=headers)
    assert again.status_code == 409 and again.json()["code"] == "already_short"
    # la readiness resta possibile sopra la corta
    rd = await client.post(f"/sessions/{sid}/readiness", json={"sleep": "lt6", "mood": "mid", "pain": "none"}, headers=headers)
    assert rd.status_code == 200 and rd.json()["session"]["short_version"] is True


async def test_short_is_refused_on_closed_session_and_hidden_for_other_users(client, onboarded):
    headers, body = onboarded
    sid = body["first_session_id"]
    other, _ = await register(client, email="altro@example.com")
    assert (await client.post(f"/sessions/{sid}/short", headers=other)).status_code == 404
    await _close(client, headers, sid)
    r = await client.post(f"/sessions/{sid}/short", headers=headers)
    assert r.status_code == 409 and r.json()["code"] == "session_closed"
