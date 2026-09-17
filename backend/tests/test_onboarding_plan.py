"""Seam: /onboarding, /plans, /today, /mesocycles — il ciclo si chiude senza chat."""

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import select

from tests.conftest import register
from tests.helpers import seed

ONB = {
    "goal": "hypertrophy",
    "level": "beginner",
    "days_per_week": 3,
    "minutes_per_session": 60,
    "location": "gym",
    "equipment": [],
    "health_consent": False,
    "safety_answers": {"q1": False, "q2": False, "q3": False, "q4": False, "q5": False, "q6": False, "q7": False},
}


@pytest_asyncio.fixture
async def seeded(db, app):
    await seed(db, app)


@pytest_asyncio.fixture
async def onboarded(client, seeded):
    headers, _ = await register(client)
    r = await client.post("/onboarding", json=ONB, headers=headers)
    assert r.status_code == 201, r.text
    return headers, r.json()


async def test_onboarding_schema_is_content_not_code(client, seeded):
    r = await client.get("/onboarding/schema")
    assert r.status_code == 200
    body = r.json()
    assert [s["id"] for s in body["steps"]] == ["goal", "level", "schedule", "place", "constraints"]
    assert body["consent"]["note"]["is_own_note"] is True
    assert "GDPR" in body["consent"]["note"]["summary_it"]
    gate = body["gate"]
    assert len(gate["questions"]) == 7
    assert any(q["blocking"] for q in gate["questions"]) and any(not q["blocking"] for q in gate["questions"])
    assert "medico" in gate["blocking_text_it"]
    assert body["disclaimer_it"]


async def test_onboarding_creates_plan_and_coach_comment(client, seeded):
    headers, _ = await register(client)
    r = await client.post("/onboarding", json=ONB, headers=headers)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["mesocycle"]["index"] == 1 and body["mesocycle"]["status"] == "active"
    assert body["mesocycle"]["total_weeks"] == 4
    assert body["first_session_id"]
    assert body["coach_comment_message_id"]
    me = (await client.get("/me", headers=headers)).json()
    assert me["onboarding_completed"] is True
    assert me["mesocycle"] == {"index": 1, "week": 1, "total_weeks": 4, "status": "active"}
    assert me["engine_active"] is True
    msgs = (await client.get("/chat/messages", headers=headers)).json()
    assert msgs[0]["kind"] == "proactive" and msgs[0]["role"] == "coach"
    assert "[[1]]" in msgs[0]["blocks"][0]["text"]
    assert len(msgs[0]["notes"]) == 3


async def test_onboarding_requires_consent_for_constraints(client, seeded):
    headers, _ = await register(client)
    r = await client.post("/onboarding", json={**ONB, "constraints_text": "mal di schiena"}, headers=headers)
    assert r.status_code == 422
    assert r.json()["code"] == "health_consent_required"


async def test_onboarding_with_consent_adapts_plan_to_constraints(client, seeded):
    headers, _ = await register(client)
    r = await client.post(
        "/onboarding", json={**ONB, "health_consent": True, "constraints_text": "ho un'ernia lombare"}, headers=headers
    )
    assert r.status_code == 201, r.text
    plan = (await client.get("/plans/current", headers=headers)).json()
    first = (await client.get(f"/sessions/{plan['weeks'][0]['sessions'][0]['session_id']}", headers=headers)).json()
    assert all(ex["pattern"] != "hinge" for ex in first["exercises"])
    me = (await client.get("/me", headers=headers)).json()
    assert me["health_consent"]["given"] is True


async def test_blocking_safety_answer_requires_acknowledgement_then_conservative_plan(client, seeded):
    headers, _ = await register(client)
    answers = {**ONB["safety_answers"], "q2": True}
    r = await client.post("/onboarding", json={**ONB, "safety_answers": answers}, headers=headers)
    assert r.status_code == 409
    assert r.json()["code"] == "safety_ack_required"
    assert "medico" in r.json()["detail"]
    r2 = await client.post("/onboarding", json={**ONB, "safety_answers": answers, "safety_acknowledged": True}, headers=headers)
    assert r2.status_code == 201, r2.text
    assert r2.json()["safety_notice_it"]
    plan = (await client.get("/plans/current", headers=headers)).json()
    sid = plan["weeks"][1]["sessions"][0]["session_id"]
    s = (await client.get(f"/sessions/{sid}", headers=headers)).json()
    assert all(ex["prescription"]["rir_target"]["value"] >= 3 for ex in s["exercises"])


async def test_onboarding_validation_errors_are_uniform(client, seeded):
    headers, _ = await register(client)
    r = await client.post("/onboarding", json={**ONB, "days_per_week": 9}, headers=headers)
    assert r.status_code == 422
    assert r.json()["code"] == "validation_error"
    assert r.json()["errors"][0]["field"] == "days_per_week"


async def test_plans_current_shape(client, onboarded):
    headers, _ = onboarded
    r = await client.get("/plans/current", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mesocycle"]["index"] == 1 and body["mesocycle"]["editable"] is True
    assert len(body["weeks"]) == 4
    w1 = body["weeks"][0]
    assert w1["is_current"] is True and w1["label_it"] == "Settimana 1"
    assert w1["changes_it"] and all(c["note_n"] for c in w1["changes_it"])
    assert body["weeks"][3]["label_it"] == "Settimana 4 · deload"
    s = w1["sessions"][0]
    assert s["status"] == "today" and s["day"] in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
    assert s["exercises_count"] >= 3 and s["sets_count"] > 0 and s["est_minutes"] > 0
    assert body["notes"] and all(n["n"] >= 1 for n in body["notes"])


async def test_plans_current_without_plan_is_404_no_plan(client, seeded):
    headers, _ = await register(client)
    r = await client.get("/plans/current", headers=headers)
    assert r.status_code == 404
    assert r.json()["code"] == "no_plan"


async def test_today_is_a_session_with_readiness_required(client, onboarded):
    headers, body = onboarded
    r = await client.get("/today", headers=headers)
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["kind"] == "session"
    assert t["session_preview"]["session_id"] == body["first_session_id"]
    assert t["session_preview"]["short_available"] is True
    assert t["readiness_required"] is True
    assert t["empty_state"] is None


async def test_second_mesocycle_is_pro_only(client, onboarded):
    headers, _ = onboarded
    r = await client.post("/plans/mesocycles", headers=headers)
    assert r.status_code == 403
    assert r.json() == {"code": "plan_required", "detail": "Per questo serve il blocco 2, e il blocco 2 è Pro."}


async def test_session_detail_contract(client, onboarded):
    headers, body = onboarded
    r = await client.get(f"/sessions/{body['first_session_id']}", headers=headers)
    assert r.status_code == 200, r.text
    assert r.headers.get("etag")
    s = r.json()
    assert s["week"] == 1 and s["index_in_week"] == 0 and s["sessions_in_week"] == 3
    ex = s["exercises"][0]
    assert ex["prescription"]["sets"]["note_n"] >= 1
    assert ex["prescription"]["reps"]["range"] == [8, 12]
    assert ex["prescription"]["rest_s"]["unit"] == "s"
    assert ex["prescription"]["rir_target"]["value"] == 4  # settimana 1: +1
    assert ex["media"]["gif_url"] is None
    assert 1 <= len(ex["substitutes"]) <= 5
    assert ex["sets"][0]["target"]["weight_kg"] is None and ex["sets"][0]["previous"] is None and ex["sets"][0]["logged"] is None
    assert ex["notes"] and all(any(n["n"] == x["n"] for x in s["notes"]) for n in ex["notes"])
    assert s["notes"]
    r304 = await client.get(f"/sessions/{body['first_session_id']}", headers={**headers, "If-None-Match": r.headers["etag"]})
    assert r304.status_code == 304


async def test_mesocycle_summary_before_end_is_409(client, onboarded):
    headers, _ = onboarded
    r = await client.get("/mesocycles/1/summary", headers=headers)
    assert r.status_code == 409
    assert r.json()["code"] == "block_not_completed"


async def test_summary_and_maintenance_after_block_ends(client, onboarded, db):
    """Simuliamo la fine del blocco spostando indietro le date: il free entra in mantenimento."""
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
    t = (await client.get("/today", headers=headers)).json()
    assert t["kind"] == "block_completed"
    assert [o["id"] for o in t["empty_state"]["options"]] == ["build_block_2", "continue_maintenance"]
    assert t["empty_state"]["options"][0]["is_pro"] is True
    me = (await client.get("/me", headers=headers)).json()
    assert me["mesocycle"]["status"] == "completed" and me["engine_active"] is False
    summ = await client.get("/mesocycles/1/summary", headers=headers)
    assert summ.status_code == 200, summ.text
    sb = summ.json()
    assert sb["block_index"] == 1 and sb["sessions_planned"] == 12 and sb["is_pro"] is False
    assert sb["coach_paragraph"] and sb["notes"]
    assert 0 <= len(sb["highlights"]) <= 3
    ev = await client.get("/events/mine", headers=headers)
    names = [e["name"] for e in ev.json()]
    assert "mesocycle_completed" in names and "paywall_shown" in names
    m = await client.post("/plans/maintenance", headers=headers)
    assert m.status_code == 200, m.text
    plan = (await client.get("/plans/current", headers=headers)).json()
    assert plan["mesocycle"]["status"] == "maintenance" and plan["mesocycle"]["editable"] is False
    assert plan["mesocycle"]["maintenance_note_it"]
    assert plan["weeks"][-1]["label_it"] == "Settimana che si ripete"
    t2 = (await client.get("/today", headers=headers)).json()
    assert t2["kind"] in ("session", "maintenance")
    r = await client.post("/plans/mesocycles", headers=headers)
    assert r.status_code == 403 and r.json()["code"] == "plan_required"


async def test_pro_user_can_build_block_2(client, onboarded, db):
    headers, _ = onboarded
    from app.models import Entitlement, Mesocycle, PlannedSession, PlanWeek

    ent = (await db.execute(select(Entitlement))).scalar_one()
    ent.plan, ent.source = "pro", "manual"
    meso = (await db.execute(select(Mesocycle))).scalar_one()
    shift = timedelta(days=35)
    meso.started_on -= shift
    for w in (await db.execute(select(PlanWeek))).scalars().all():
        w.starts_on -= shift
    for s in (await db.execute(select(PlannedSession))).scalars().all():
        s.date -= shift
    await db.commit()
    r = await client.post("/plans/mesocycles", headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["mesocycle"]["index"] == 2
    me = (await client.get("/me", headers=headers)).json()
    assert me["mesocycle"]["index"] == 2 and me["engine_active"] is True
    plan = (await client.get("/plans/current", headers=headers)).json()
    assert plan["mesocycle"]["index"] == 2 and plan["mesocycle"]["editable"] is True
