"""Seam: /chat e /plans/proposals — l'LLM propone, il motore valida, l'utente conferma. L'LLM non scrive mai nel DB."""

import json
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.config import get_settings
from app.models import ChatMessage, LlmUsage, PlanChangeProposal
from tests.conftest import register
from tests.helpers import seed
from tests.test_onboarding_plan import ONB


@pytest_asyncio.fixture
async def onboarded(client, db, app):
    await seed(db, app)
    headers, _ = await register(client)
    r = await client.post("/onboarding", json={**ONB, "level": "intermediate", "days_per_week": 4}, headers=headers)
    assert r.status_code == 201, r.text
    app.state.llm.calls.clear()
    app.state.llm.forced_text = None
    return headers, r.json()


async def send(client, headers, text, op="op-1"):
    """Legge lo stream SSE e ritorna (eventi, messaggio finale)."""
    events = []
    async with client.stream("POST", "/chat/messages", json={"text": text, "client_op_id": op}, headers=headers) as r:
        if r.status_code != 200:
            body = await r.aread()
            return r.status_code, json.loads(body), None
        async for line in r.aiter_lines():
            if line.startswith("data:"):
                events.append(json.loads(line[5:].strip()))
    done = next(e for e in events if e["type"] == "done")
    return 200, events, done["message"]


async def test_chat_texts_expose_ai_badge_and_paywall_lines(client, onboarded):
    headers, _ = onboarded
    r = await client.get("/chat/texts", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert "coach AI" in body["ai_badge_text"]
    assert body["ai_badge_note"]["rule_id"] == "system.about" and body["ai_badge_note"]["is_own_note"] is True
    assert set(body["paywall_context_line"]) == {"end_of_block", "chat_quota", "maintenance_request"}


async def test_plain_message_streams_and_counts_quota(client, onboarded, db):
    headers, _ = onboarded
    status, events, msg = await send(client, headers, "ciao coach, come va")
    assert status == 200
    assert events[0]["type"] == "delta" and any(e["type"] == "delta" for e in events)
    assert msg["role"] == "coach" and msg["kind"] == "user_turn" and msg["blocks"][0]["type"] == "paragraph"
    q = (await client.get("/chat/quota", headers=headers)).json()
    assert q["used"] == 1 and q["limit"] == 15 and q["exhausted"] is False
    usage = (await db.execute(select(LlmUsage))).scalars().all()
    kinds = {u.turn_kind for u in usage}
    assert "user_turn" in kinds and "proactive" in kinds
    assert all(u.provider == "fake" and u.model == "fake" for u in usage)
    thread = (await client.get("/chat/messages", headers=headers)).json()
    assert [m["role"] for m in thread[-2:]] == ["user", "coach"]
    assert thread[-1]["reply_to_id"] == thread[-2]["id"]


async def test_same_client_op_id_does_not_double_send(client, onboarded):
    headers, _ = onboarded
    _, _, m1 = await send(client, headers, "ciao", op="dup")
    _, _, m2 = await send(client, headers, "ciao", op="dup")
    assert m1["id"] == m2["id"]
    q = (await client.get("/chat/quota", headers=headers)).json()
    assert q["used"] == 1


async def test_why_question_uses_corpus_and_cites_only_retrieved_chunks(client, onboarded, app):
    headers, _ = onboarded
    status, events, msg = await send(client, headers, "perché il riposo di 2 minuti tra le serie?")
    assert status == 200
    text = msg["blocks"][0]["text"]
    assert "[[cit:" not in text
    assert "[[1]]" in text and msg["notes"] and msg["notes"][0]["rule_id"].startswith("rest.")
    tool_names = [c["tools"] for c in app.state.llm.calls]
    assert any("search_corpus" in t for t in tool_names)


async def test_citation_validator_removes_unretrieved_ids(client, onboarded, app):
    headers, _ = onboarded
    app.state.llm.forced_text = "Il riposo di tre ore rende di più [[cit:rule.non.esiste]] e lo dice anche [[cit:exercise.plank]]."
    status, events, msg = await send(client, headers, "quanto riposo?")
    assert status == 200
    text = msg["blocks"][0]["text"]
    assert "[[cit:" not in text and "[[1]]" not in text
    assert "non ho una fonte" in text.lower()
    assert msg["notes"] == []


async def test_safety_filter_is_fixed_text_no_llm_no_quota(client, onboarded, app):
    headers, _ = onboarded
    calls_before = len(app.state.llm.calls)
    status, events, msg = await send(client, headers, "ho un dolore forte al petto quando faccio panca")
    assert status == 200
    assert msg["kind"] == "safety"
    block = next(b for b in msg["blocks"] if b["type"] == "safety")
    assert "112" in block["text"] and [o["id"] for o in block["options"]]
    assert len(app.state.llm.calls) == calls_before
    q = (await client.get("/chat/quota", headers=headers)).json()
    assert q["used"] == 0


async def test_quota_exhausted_is_429_with_reset(client, onboarded):
    headers, _ = onboarded
    settings = get_settings()
    old = settings.chat_quota_free_month
    settings.chat_quota_free_month = 2
    try:
        await send(client, headers, "uno", op="a")
        await send(client, headers, "due", op="b")
        status, body, _ = await send(client, headers, "tre", op="c")
        assert status == 429
        assert body["code"] == "chat_quota_exceeded" and body["used"] == 2 and body["limit"] == 2 and body["resets_at"]
        me = (await client.get("/me", headers=headers)).json()
        assert me["chat_quota"]["used"] == 2
    finally:
        settings.chat_quota_free_month = old


async def test_failed_llm_turn_is_not_counted(client, onboarded, app, db):
    headers, _ = onboarded
    app.state.llm.fail_next = True
    status, body, _ = await send(client, headers, "ciao", op="fail")
    assert status == 502 and body["code"] == "llm_failed"
    q = (await client.get("/chat/quota", headers=headers)).json()
    assert q["used"] == 0
    rows = (await db.execute(select(ChatMessage).where(ChatMessage.role == "user"))).scalars().all()
    assert rows and rows[-1].status == "failed"
    usage = (await db.execute(select(LlmUsage).where(LlmUsage.success.is_(False)))).scalars().all()
    assert usage
    status2, _, msg = await send(client, headers, "ciao", op="fail")  # riprova con lo stesso op: riparte
    assert status2 == 200 and msg["role"] == "coach"


async def test_change_request_creates_proposal_then_apply(client, onboarded, db):
    headers, body = onboarded
    plan = (await client.get("/plans/current", headers=headers)).json()
    sid = plan["weeks"][1]["sessions"][0]["session_id"]
    before = (await client.get(f"/sessions/{sid}", headers=headers)).json()
    first_name = before["exercises"][0]["name_it"]
    sets_before = before["exercises"][0]["prescription"]["sets"]["value"]
    status, events, msg = await send(client, headers, f"togli una serie a {first_name}")
    assert status == 200
    pc = next(b for b in msg["blocks"] if b["type"] == "plan_change")
    assert pc["applied"] is None and pc["valid"] is True
    assert pc["diff"] and pc["diff"][0]["field"] == "sets" and pc["diff"][0]["to"] == sets_before - 1
    p = (await db.execute(select(PlanChangeProposal))).scalar_one()
    assert p.status == "proposed" and p.origin == "coach"
    after = (await client.get(f"/sessions/{sid}", headers=headers)).json()
    assert after["exercises"][0]["prescription"]["sets"]["value"] == sets_before, "l'LLM non scrive nel DB"
    r = await client.post(f"/plans/proposals/{pc['proposal_id']}/apply", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "accepted"
    applied = (await client.get(f"/sessions/{sid}", headers=headers)).json()
    assert applied["exercises"][0]["prescription"]["sets"]["value"] == sets_before - 1
    thread = (await client.get("/chat/messages", headers=headers)).json()
    assert next(b for b in thread[-1]["blocks"] if b["type"] == "plan_change")["applied"] is True


async def test_proposal_out_of_bounds_is_invalid(client, onboarded):
    headers, body = onboarded
    plan = (await client.get("/plans/current", headers=headers)).json()
    sid = plan["weeks"][1]["sessions"][0]["session_id"]
    s = (await client.get(f"/sessions/{sid}", headers=headers)).json()
    sets = s["exercises"][0]["prescription"]["sets"]["value"]
    delta = 2 if sets >= 4 else -2  # 5+2=7 > 5, oppure 3-2=1 < 2: fuori dai limiti della regola
    r = await client.post("/plans/proposals", json={"patch": {"op": "adjust_sets", "session_id": sid, "exercise_id": s["exercises"][0]["id"], "delta": delta, "scope": "session"}}, headers=headers)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["valid"] is False and out["invalid_reason_it"] and out["status"] == "invalid"
    r3 = await client.post(f"/plans/proposals/{out['proposal_id']}/apply", headers=headers)
    assert r3.status_code == 409 and r3.json()["code"] == "proposal_not_applicable"


async def test_proposal_reject(client, onboarded):
    headers, body = onboarded
    plan = (await client.get("/plans/current", headers=headers)).json()
    sid = plan["weeks"][1]["sessions"][0]["session_id"]
    s = (await client.get(f"/sessions/{sid}", headers=headers)).json()
    r = await client.post("/plans/proposals", json={"patch": {"op": "substitute", "session_id": sid, "exercise_id": s["exercises"][0]["id"], "new_exercise_id": s["exercises"][0]["substitutes"][0]["exercise_id"]}}, headers=headers)
    assert r.status_code == 200 and r.json()["valid"] is True
    rj = await client.post(f"/plans/proposals/{r.json()['proposal_id']}/reject", headers=headers)
    assert rj.status_code == 200 and rj.json()["status"] == "rejected"


async def test_proposals_are_pro_only_in_maintenance(client, onboarded, db):
    headers, body = onboarded
    from app.models import Mesocycle, PlannedSession, PlanWeek

    meso = (await db.execute(select(Mesocycle))).scalar_one()
    shift = timedelta(days=35)
    meso.started_on -= shift
    for w in (await db.execute(select(PlanWeek))).scalars().all():
        w.starts_on -= shift
    for s in (await db.execute(select(PlannedSession))).scalars().all():
        s.date -= shift
    await db.commit()
    await client.post("/plans/maintenance", headers=headers)
    r = await client.post("/plans/proposals", json={"patch": {"op": "adjust_sets", "exercise_query": "panca", "delta": -1}}, headers=headers)
    assert r.status_code == 403 and r.json()["code"] == "plan_required"
    status, events, msg = await send(client, headers, "togli una serie alla panca")
    assert status == 200
    text = msg["blocks"][0]["text"].lower()
    assert "pro" in text
    assert any(b["type"] == "paywall" and b["surface"] == "maintenance_request" for b in msg["blocks"])
    names = [e["name"] for e in (await client.get("/events/mine", headers=headers)).json()]
    assert "paywall_shown" in names


async def test_no_day_option_short_tomorrow_applies_and_does_not_consume_quota(client, onboarded, db, app):
    headers, body = onboarded
    from app.models import PlannedSession

    sessions = sorted((await db.execute(select(PlannedSession))).scalars().all(), key=lambda s: (s.date, s.index_in_week))
    first = sessions[0]
    first.date -= timedelta(days=1)  # ieri: saltata
    await db.commit()
    t = (await client.get("/today", headers=headers)).json()
    assert t["kind"] == "session_skipped" and t["redirect"].startswith("/chat?msg=")
    msg_id = t["redirect"].split("msg=")[1]
    thread = (await client.get("/chat/messages", headers=headers)).json()
    opener = next(m for m in thread if m["id"] == msg_id)
    assert opener["kind"] == "proactive" and opener["protocol"] == "no_day"
    opts = next(b for b in opener["blocks"] if b["type"] == "options")["options"]
    assert [o["id"] for o in opts] == ["short_tomorrow", "move", "renegotiate"]
    r = await client.post("/chat/options/short_tomorrow", json={"message_id": msg_id}, headers=headers)
    assert r.status_code == 200, r.text
    reply = r.json()
    assert reply["role"] == "coach" and any(b["type"] == "plan_change" and b["applied"] is True for b in reply["blocks"])
    q = (await client.get("/chat/quota", headers=headers)).json()
    assert q["used"] == 0
    nxt = sessions[1]
    s = (await client.get(f"/sessions/{nxt.id}", headers=headers)).json()
    assert s["short_version"] is True
    thread2 = (await client.get("/chat/messages", headers=headers)).json()
    opener2 = next(m for m in thread2 if m["id"] == msg_id)
    assert next(o for o in next(b for b in opener2["blocks"] if b["type"] == "options")["options"] if o["id"] == "short_tomorrow")["chosen"] is True
    again = await client.post("/chat/options/move", json={"message_id": msg_id}, headers=headers)
    assert again.status_code == 409 and again.json()["code"] == "option_already_chosen"
    names = [e["name"] for e in (await client.get("/events/mine", headers=headers)).json()]
    assert "no_day_option_chosen" in names


async def test_unknown_option_is_404(client, onboarded):
    headers, body = onboarded
    r = await client.post("/chat/options/boh", json={"message_id": body["coach_comment_message_id"]}, headers=headers)
    assert r.status_code == 404
