"""Seam: la seduta — readiness, scritture idempotenti, chiusura con progressione, sync offline, progressi."""

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import select

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


def _now_iso(delta_s: int = 0) -> str:
    return (datetime.now(UTC) + timedelta(seconds=delta_s)).isoformat()


async def _session(client, headers, sid):
    r = await client.get(f"/sessions/{sid}", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


async def test_readiness_low_sleep_adapts_session_and_explains(client, onboarded):
    headers, body = onboarded
    sid = body["first_session_id"]
    r = await client.post(f"/sessions/{sid}/readiness", json={"sleep": "lt6", "mood": "mid", "pain": "none"}, headers=headers)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["diff"]["short_version"] is True and out["diff"]["est_minutes"] <= 30
    assert "[[" in out["coach_line"] and out["notes"]
    assert out["safety"] is None
    active = [e for e in out["session"]["exercises"] if not e["removed_today"]]
    assert len(active) <= 4 and all(e["prescription"]["sets"]["value"] == 2 for e in active)
    assert any(e["changed_today"] for e in active)
    t = (await client.get("/today", headers=headers)).json()
    assert t["readiness_required"] is False
    again = await client.post(f"/sessions/{sid}/readiness", json={"sleep": "lt6", "mood": "mid", "pain": "none"}, headers=headers)
    assert again.status_code == 409 and again.json()["code"] == "readiness_already_done"


async def test_readiness_mild_pain_then_restore(client, onboarded):
    headers, body = onboarded
    plan = (await client.get("/plans/current", headers=headers)).json()
    lower = plan["weeks"][0]["sessions"][1]["session_id"]
    r = await client.post(f"/sessions/{lower}/readiness", json={"sleep": "gt8", "mood": "high", "pain": "mild"}, headers=headers)
    assert r.status_code == 200, r.text
    out = r.json()
    removed = out["diff"]["removed_exercises"]
    assert removed and removed[0]["note_n"]
    ex_id = removed[0]["exercise_id"]
    s = await _session(client, headers, lower)
    assert any(e["exercise_id"] == ex_id and e["removed_today"] for e in s["exercises"])
    rr = await client.post(f"/sessions/{lower}/readiness/restore/{ex_id}", headers=headers)
    assert rr.status_code == 200, rr.text
    s2 = rr.json()
    e = next(e for e in s2["exercises"] if e["exercise_id"] == ex_id)
    assert e["removed_today"] is False and len(e["sets"]) == e["prescription"]["sets"]["value"]


async def test_readiness_severe_pain_is_safety_block(client, onboarded):
    headers, body = onboarded
    sid = body["first_session_id"]
    r = await client.post(f"/sessions/{sid}/readiness", json={"sleep": "gt8", "mood": "high", "pain": "severe"}, headers=headers)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["safety"]["text"] and [o["id"] for o in out["safety"]["options"]][0] == "pause_plan"
    assert out["diff"]["removed_exercises"] == [] and out["diff"]["short_version"] is False


async def test_readiness_validation(client, onboarded):
    headers, body = onboarded
    r = await client.post(f"/sessions/{body['first_session_id']}/readiness", json={"sleep": "molto", "mood": "mid", "pain": "none"}, headers=headers)
    assert r.status_code == 422 and r.json()["code"] == "validation_error"


async def test_patch_set_is_idempotent_by_client_op_id(client, onboarded):
    headers, body = onboarded
    sid = body["first_session_id"]
    s = await _session(client, headers, sid)
    set_id = s["exercises"][0]["sets"][0]["id"]
    payload = {"weight_kg": 60, "reps": 10, "rir": 2, "status": "done", "client_op_id": "op-1", "client_updated_at": _now_iso()}
    r1 = await client.patch(f"/sessions/{sid}/sets/{set_id}", json=payload, headers=headers)
    assert r1.status_code == 200, r1.text
    assert r1.json()["logged"] == {**r1.json()["logged"], "weight_kg": 60.0, "reps": 10, "rir": 2, "status": "done"}
    r2 = await client.patch(f"/sessions/{sid}/sets/{set_id}", json={**payload, "weight_kg": 999}, headers=headers)
    assert r2.status_code == 200
    assert r2.json()["logged"]["weight_kg"] == 60.0, "stesso client_op_id: non si riapplica"
    r3 = await client.patch(f"/sessions/{sid}/sets/{set_id}", json={**payload, "client_op_id": "op-2", "weight_kg": 62.5}, headers=headers)
    assert r3.json()["logged"]["weight_kg"] == 62.5


async def test_patch_set_older_client_timestamp_does_not_overwrite(client, onboarded):
    headers, body = onboarded
    sid = body["first_session_id"]
    s = await _session(client, headers, sid)
    set_id = s["exercises"][0]["sets"][0]["id"]
    newer = {"weight_kg": 60, "reps": 10, "rir": 2, "status": "done", "client_op_id": "a", "client_updated_at": _now_iso()}
    older = {"weight_kg": 40, "reps": 8, "rir": 3, "status": "done", "client_op_id": "b", "client_updated_at": _now_iso(-3600 * 5)}
    await client.patch(f"/sessions/{sid}/sets/{set_id}", json=newer, headers=headers)
    r = await client.patch(f"/sessions/{sid}/sets/{set_id}", json=older, headers=headers)
    assert r.status_code == 200 and r.json()["logged"]["weight_kg"] == 60.0


async def test_patch_set_accepts_timestamps_hours_in_the_past(client, onboarded):
    headers, body = onboarded
    sid = body["first_session_id"]
    s = await _session(client, headers, sid)
    set_id = s["exercises"][0]["sets"][0]["id"]
    r = await client.patch(f"/sessions/{sid}/sets/{set_id}", json={"reps": 9, "status": "done", "client_op_id": "x", "client_updated_at": _now_iso(-3600 * 6)}, headers=headers)
    assert r.status_code == 200


async def test_add_and_remove_set(client, onboarded):
    headers, body = onboarded
    sid = body["first_session_id"]
    s = await _session(client, headers, sid)
    ex = s["exercises"][0]
    r = await client.post(f"/sessions/{sid}/sets", json={"exercise_id": ex["id"], "client_op_id": "add-1", "client_updated_at": _now_iso()}, headers=headers)
    assert r.status_code == 201, r.text
    new_set = r.json()
    assert new_set["n"] == len(ex["sets"]) + 1
    r2 = await client.post(f"/sessions/{sid}/sets", json={"exercise_id": ex["id"], "client_op_id": "add-1", "client_updated_at": _now_iso()}, headers=headers)
    assert r2.status_code == 201 and r2.json()["id"] == new_set["id"]
    d = await client.delete(f"/sessions/{sid}/sets/{ex['sets'][0]['id']}", params={"client_op_id": "del-1"}, headers=headers)
    assert d.status_code == 409 and d.json()["code"] == "not_last_set"
    d2 = await client.delete(f"/sessions/{sid}/sets/{new_set['id']}", params={"client_op_id": "del-2"}, headers=headers)
    assert d2.status_code == 204
    s2 = await _session(client, headers, sid)
    assert len(s2["exercises"][0]["sets"]) == len(ex["sets"])


async def test_substitute_skip_restore(client, onboarded):
    headers, body = onboarded
    sid = body["first_session_id"]
    s = await _session(client, headers, sid)
    ex = s["exercises"][0]
    alt = ex["substitutes"][0]["exercise_id"]
    r = await client.post(f"/sessions/{sid}/exercises/{ex['id']}/substitute", json={"exercise_id": alt, "client_op_id": "sub-1", "client_updated_at": _now_iso()}, headers=headers)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["exercise_id"] == alt and out["substituted_from"]["name_it"] == ex["name_it"]
    assert len(out["sets"]) == len(ex["sets"])
    bad = await client.post(f"/sessions/{sid}/exercises/{ex['id']}/substitute", json={"exercise_id": "non_esiste", "client_op_id": "sub-2", "client_updated_at": _now_iso()}, headers=headers)
    assert bad.status_code == 422 and bad.json()["code"] == "invalid_substitute"
    sk = await client.post(f"/sessions/{sid}/exercises/{ex['id']}/skip", json={"client_op_id": "skip-1", "client_updated_at": _now_iso()}, headers=headers)
    assert sk.status_code == 200 and sk.json()["skipped"] is True
    rs = await client.post(f"/sessions/{sid}/exercises/{ex['id']}/restore", json={"client_op_id": "rest-1", "client_updated_at": _now_iso()}, headers=headers)
    assert rs.status_code == 200 and rs.json()["skipped"] is False


async def test_close_session_applies_progression_and_events(client, onboarded, app):
    headers, body = onboarded
    sid = body["first_session_id"]
    s = await _session(client, headers, sid)
    ex = s["exercises"][0]
    assert ex["prescription"]["reps"]["range"] == [8, 12]
    sets = [{"set_id": st["id"], "weight_kg": 60, "reps": 12, "rir": 3, "status": "done"} for st in ex["sets"]]
    for other in s["exercises"][1:]:
        sets += [{"set_id": st["id"], "weight_kg": 20, "reps": 10, "rir": 3, "status": "done"} for st in other["sets"]]
    r = await client.post(f"/sessions/{sid}/close", json={"client_op_id": "close-1", "client_updated_at": _now_iso(), "sets": sets}, headers=headers)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["close_line"] and out["session"]["status"] == "done"
    assert out["session"]["close_line"] == out["close_line"]
    r2 = await client.post(f"/sessions/{sid}/close", json={"client_op_id": "close-1", "client_updated_at": _now_iso(), "sets": sets}, headers=headers)
    assert r2.status_code == 200 and r2.json()["close_line"] == out["close_line"]
    plan = (await client.get("/plans/current", headers=headers)).json()
    assert plan["weeks"][0]["sessions"][0]["status"] == "done"
    nxt = plan["weeks"][1]["sessions"][0]["session_id"]
    s2 = await _session(client, headers, nxt)
    ex2 = next(e for e in s2["exercises"] if e["exercise_id"] == ex["exercise_id"])
    # tutte le serie al top con RIR ok: +2.5 (bilanciere, parte alta: la prima seduta è Parte alta 1 -> panca)
    assert ex["pattern"] == "push_h"
    assert ex2["sets"][0]["target"]["weight_kg"] == 62.5
    assert ex2["sets"][0]["target"]["reps"] == 8
    assert ex2["sets"][0]["previous"]["weight_kg"] == 60.0 and ex2["sets"][0]["previous"]["reps"] == 12
    names = [e["name"] for e in (await client.get("/events/mine", headers=headers)).json()]
    assert "first_session_logged" in names
    t = (await client.get("/today", headers=headers)).json()
    assert t["kind"] == "session" and t["session_preview"]["status"] == "done"


async def test_close_conflict_returns_server_session(client, onboarded):
    headers, body = onboarded
    sid = body["first_session_id"]
    s = await _session(client, headers, sid)
    set_id = s["exercises"][0]["sets"][0]["id"]
    await client.patch(f"/sessions/{sid}/sets/{set_id}", json={"reps": 9, "status": "done", "client_op_id": "p1", "client_updated_at": _now_iso()}, headers=headers)
    r = await client.post(f"/sessions/{sid}/close", json={"client_op_id": "c1", "client_updated_at": _now_iso(-7200), "sets": []}, headers=headers)
    assert r.status_code == 409
    assert r.json()["code"] == "draft_conflict" and r.json()["server_session"]["id"] == sid


async def test_close_with_nothing_done_is_skipped(client, onboarded):
    headers, body = onboarded
    sid = body["first_session_id"]
    r = await client.post(f"/sessions/{sid}/close", json={"client_op_id": "c0", "client_updated_at": _now_iso(), "sets": []}, headers=headers)
    assert r.status_code == 200 and r.json()["session"]["status"] == "skipped"


async def test_sync_batch_applies_queued_ops_once(client, onboarded):
    headers, body = onboarded
    sid = body["first_session_id"]
    s = await _session(client, headers, sid)
    set_a, set_b = s["exercises"][0]["sets"][0]["id"], s["exercises"][0]["sets"][1]["id"]
    ops = [
        {"op": "patch_set", "client_op_id": "s1", "client_updated_at": _now_iso(-60), "set_id": set_a, "weight_kg": 50, "reps": 10, "rir": 2, "status": "done"},
        {"op": "patch_set", "client_op_id": "s2", "client_updated_at": _now_iso(-30), "set_id": set_b, "weight_kg": 50, "reps": 9, "rir": 2, "status": "done"},
        {"op": "patch_set", "client_op_id": "s1", "client_updated_at": _now_iso(-60), "set_id": set_a, "weight_kg": 1, "reps": 1, "rir": 0, "status": "done"},
        {"op": "close", "client_op_id": "c1", "client_updated_at": _now_iso(), "sets": []},
    ]
    r = await client.post(f"/sessions/{sid}/sync", json={"ops": ops}, headers=headers)
    assert r.status_code == 200, r.text
    res = r.json()["results"]
    assert [x["status"] for x in res] == ["applied", "applied", "duplicate", "applied"]
    sess = r.json()["session"]
    assert sess["status"] in ("done", "short")
    assert sess["exercises"][0]["sets"][0]["logged"]["weight_kg"] == 50.0


async def test_progress_endpoints(client, onboarded):
    headers, body = onboarded
    sid = body["first_session_id"]
    s = await _session(client, headers, sid)
    ex = s["exercises"][0]
    sets = [{"set_id": st["id"], "weight_kg": 60, "reps": 10, "rir": 2, "status": "done"} for st in ex["sets"]]
    await client.post(f"/sessions/{sid}/close", json={"client_op_id": "close-1", "client_updated_at": _now_iso(), "sets": sets}, headers=headers)
    c = await client.get("/progress/consistency", params={"weeks": 4}, headers=headers)
    assert c.status_code == 200, c.text
    cb = c.json()
    assert cb["done"] == 1 and cb["planned"] >= 1 and cb["returns"] == 0
    assert len(cb["days"]) == 28 and cb["caption_it"] and cb["note"]["is_own_note"] is True
    assert cb["window_limited_by_plan"] is True
    assert any(d["status"] in ("done", "short") and d["session_id"] == sid for d in cb["days"])  # 1 esercizio su 6: corta
    e = await client.get("/progress/exercises", headers=headers)
    assert e.status_code == 200
    row = next(x for x in e.json() if x["exercise_id"] == ex["exercise_id"])
    assert row["last_weight_kg"] == 60.0 and row["pr"]["weight_kg"] == 60.0 and row["pr"]["reps"] == 10
    h = await client.get(f"/progress/exercises/{ex['exercise_id']}", headers=headers)
    assert h.status_code == 200
    assert h.json()["points"][0]["best_weight_kg"] == 60.0 and h.json()["points"][0]["is_pr"] is True
    assert h.json()["history_limited"] is True


async def test_session_of_other_user_is_404(client, onboarded):
    headers, body = onboarded
    other, _ = await register(client, email="altro@example.org")
    r = await client.get(f"/sessions/{body['first_session_id']}", headers=other)
    assert r.status_code == 404
    r2 = await client.post(f"/sessions/{body['first_session_id']}/readiness", json={"sleep": "gt8", "mood": "high", "pain": "none"}, headers=other)
    assert r2.status_code == 404
