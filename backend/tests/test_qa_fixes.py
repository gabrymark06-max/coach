"""Seam: le correzioni del rapporto QA (docs/qa-report.md) — B1, B2, G1, G5, M11, M12.

Ogni test riproduce prima il difetto com'era descritto nel rapporto, poi fissa il comportamento atteso.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select, text

from app.models import ChatMessage
from tests.conftest import register
from tests.test_chat import onboarded, send  # noqa: F401  (fixture riusata)


# ---------------------------------------------------------------- B1: punteggiatura in chat


@pytest.mark.parametrize(
    "msg",
    [
        "perché 2 minuti?!",
        "perché xkcd:42 e non 3:1?",
        "perché zzzq! zzzz & yyyy",
        "quanto pesa zzzqqq <10kg?",
        "perché zzzqqq alert(1)?",
    ],
)
async def test_chat_with_punctuation_answers_and_counts_one_turn(client, onboarded, msg):
    headers, _ = onboarded
    status, _, reply = await send(client, headers, msg, op=f"p-{abs(hash(msg))}")
    assert status == 200, reply
    assert reply["role"] == "coach" and reply["status"] == "sent"
    q = (await client.get("/chat/quota", headers=headers)).json()
    assert q["used"] == 1


async def test_chat_with_only_punctuation_does_not_break(client, onboarded):
    headers, _ = onboarded
    status, _, reply = await send(client, headers, "perché ! ( : & <", op="only-punct")
    assert status == 200
    assert reply["role"] == "coach"
    q = (await client.get("/chat/quota", headers=headers)).json()
    assert q["used"] == 1


async def test_db_error_inside_tool_loop_marks_turn_failed_and_does_not_count(client, onboarded, db, monkeypatch):
    """Qualunque eccezione nel tool loop (anche una transazione Postgres abortita) -> 502 llm_failed, turno non contato."""
    from app.services import chat as svc

    async def broken_search(db_, embedder, query, *, limit=4):
        await db_.execute(text("SELECT 1/0"))  # abortisce la transazione: come il vecchio to_tsquery
        return []

    monkeypatch.setattr(svc, "search_corpus", broken_search)
    headers, _ = onboarded
    status, body, _ = await send(client, headers, "perché il riposo di due minuti?", op="dberr")
    assert status == 502, body
    assert body["code"] == "llm_failed" and body["detail"]
    q = (await client.get("/chat/quota", headers=headers)).json()
    assert q["used"] == 0
    rows = (await db.execute(select(ChatMessage).where(ChatMessage.role == "user"))).scalars().all()
    assert rows and rows[-1].status == "failed"
    thread = (await client.get("/chat/messages", headers=headers)).json()
    assert thread[-1]["role"] == "user" and thread[-1]["status"] == "failed"


# ---------------------------------------------------------------- B2: i 500 escono vestiti (CORS, X-Request-Id, forma)


async def test_unhandled_error_has_cors_request_id_and_error_shape(client, monkeypatch):
    from app.services import chat as svc

    async def boom(db, settings):
        raise RuntimeError("simulated crash (test)")

    monkeypatch.setattr(svc, "chat_texts", boom)
    r = await client.get("/chat/texts", headers={"Origin": "http://localhost:3000", "X-Request-Id": "qa-b2-0001"})
    assert r.status_code == 500
    body = r.json()
    assert body["code"] == "internal_error" and body["detail"]
    assert "simulated crash" not in r.text  # niente dettagli interni al client
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert r.headers.get("x-request-id") == "qa-b2-0001"


# ---------------------------------------------------------------- G1: la seduta chiusa non accetta scritture


from tests.test_sessions import _now_iso, _session, onboarded as onboarded_session  # noqa: E402,F401


async def _close(client, headers, sid, op="close-1"):
    s = await _session(client, headers, sid)
    sets = [{"set_id": st["id"], "weight_kg": 40, "reps": 10, "rir": 2, "status": "done"} for e in s["exercises"] for st in e["sets"]]
    r = await client.post(f"/sessions/{sid}/close", json={"client_op_id": op, "client_updated_at": _now_iso(), "sets": sets}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["session"]


async def test_closed_session_rejects_every_write_with_session_closed(client, onboarded_session):
    headers, body = onboarded_session
    sid = body["first_session_id"]
    before = await _close(client, headers, sid)
    ex = before["exercises"][0]
    set_id = ex["sets"][0]["id"]
    when = _now_iso()
    calls = [
        ("PATCH", f"/sessions/{sid}/sets/{set_id}", {"weight_kg": 99, "status": "done", "client_op_id": "w1", "client_updated_at": when}),
        ("POST", f"/sessions/{sid}/sets", {"exercise_id": ex["id"], "client_op_id": "w2", "client_updated_at": when}),
        ("DELETE", f"/sessions/{sid}/sets/{ex['sets'][-1]['id']}?client_op_id=w3", None),
        ("POST", f"/sessions/{sid}/exercises/{ex['id']}/substitute", {"exercise_id": ex["substitutes"][0]["exercise_id"], "client_op_id": "w4", "client_updated_at": when}),
        ("POST", f"/sessions/{sid}/exercises/{ex['id']}/skip", {"client_op_id": "w5", "client_updated_at": when}),
        ("POST", f"/sessions/{sid}/exercises/{ex['id']}/restore", {"client_op_id": "w6", "client_updated_at": when}),
        ("POST", f"/sessions/{sid}/readiness", {"sleep": "lt6", "mood": "mid", "pain": "none"}),
        ("POST", f"/sessions/{sid}/short", None),
        ("POST", f"/sessions/{sid}/readiness/restore/{ex['exercise_id']}", None),
    ]
    for method, url, payload in calls:
        r = await client.request(method, url, json=payload, headers=headers)
        assert r.status_code == 409, (method, url, r.status_code, r.text)
        assert r.json()["code"] == "session_closed", (method, url, r.json())
    after = await _session(client, headers, sid)
    assert after["status"] == before["status"]
    assert after["exercises"][0]["sets"][0]["logged"]["weight_kg"] == 40.0
    assert len(after["exercises"][0]["sets"]) == len(ex["sets"])


async def test_sync_on_closed_session_fails_per_op_without_breaking_the_batch(client, onboarded_session):
    headers, body = onboarded_session
    sid = body["first_session_id"]
    s = await _session(client, headers, sid)
    set_a = s["exercises"][0]["sets"][0]["id"]
    ok = await client.patch(f"/sessions/{sid}/sets/{set_a}", json={"weight_kg": 50, "reps": 10, "rir": 2, "status": "done", "client_op_id": "s1", "client_updated_at": _now_iso(-60)}, headers=headers)
    assert ok.status_code == 200
    await _close(client, headers, sid, op="c1")  # chiusa nel frattempo (altro dispositivo)
    ops = [
        {"op": "patch_set", "client_op_id": "s1", "client_updated_at": _now_iso(-60), "set_id": set_a, "weight_kg": 50, "reps": 10, "rir": 2, "status": "done"},
        {"op": "patch_set", "client_op_id": "s2", "client_updated_at": _now_iso(-30), "set_id": set_a, "weight_kg": 99, "reps": 1, "rir": 0, "status": "done"},
        {"op": "add_set", "client_op_id": "s3", "client_updated_at": _now_iso(-20), "exercise_id": s["exercises"][0]["id"]},
        {"op": "close", "client_op_id": "c1", "client_updated_at": _now_iso(), "sets": []},
        {"op": "close", "client_op_id": "c2", "client_updated_at": _now_iso(), "sets": []},
    ]
    r = await client.post(f"/sessions/{sid}/sync", json={"ops": ops}, headers=headers)
    assert r.status_code == 200, r.text
    res = r.json()["results"]
    assert [x["status"] for x in res] == ["duplicate", "error", "error", "duplicate", "error"]
    assert all(x["code"] == "session_closed" and x["detail"] for x in res if x["status"] == "error")
    sess = r.json()["session"]
    assert sess["exercises"][0]["sets"][0]["logged"]["weight_kg"] == 40.0
    assert len(sess["exercises"][0]["sets"]) == len(s["exercises"][0]["sets"])


# ---------------------------------------------------------------- G5: dopo la scelta, /today va avanti


from datetime import timedelta  # noqa: E402

from app.clock import today_local  # noqa: E402
from app.services.dates_it import human_date  # noqa: E402
from tests.test_contract_v111 import _close as _close_v111, _move_todays_session_to_tomorrow, _shift_plan  # noqa: E402


async def _return_after_break(client, db, headers, body) -> dict:
    await _close_v111(client, headers, body["first_session_id"])
    await _shift_plan(db, 22)
    await _move_todays_session_to_tomorrow(db)
    t = (await client.get("/today", headers=headers)).json()
    assert t["kind"] == "return_after_break", t
    return t


@pytest.mark.parametrize("option", ["full", "short_tomorrow"])
async def test_after_choosing_return_after_break_today_moves_on(client, db, onboarded_session, option):
    headers, body = onboarded_session
    t = await _return_after_break(client, db, headers, body)
    msg_id = t["redirect"].split("msg=")[1]
    r = await client.post(f"/chat/options/{option}", json={"message_id": msg_id}, headers=headers)
    assert r.status_code == 200, r.text
    t2 = (await client.get("/today", headers=headers)).json()
    assert t2["kind"] == "rest_day", t2
    assert t2.get("redirect") is None
    assert not any(o["action"]["type"] == "chat_option" for o in t2["empty_state"]["options"])
    assert human_date(today_local() + timedelta(days=1)) in t2["empty_state"]["coach_text"]
    t3 = (await client.get("/today", headers=headers)).json()
    assert t3["kind"] == "rest_day"
    thread = (await client.get("/chat/messages", headers=headers)).json()
    assert sum(1 for m in thread if m["protocol"] == "return_after_break") == 1, "nessun secondo messaggio di bentornato"


async def test_return_after_break_is_still_offered_until_the_user_chooses(client, db, onboarded_session):
    headers, body = onboarded_session
    t = await _return_after_break(client, db, headers, body)
    t2 = (await client.get("/today", headers=headers)).json()
    assert t2["kind"] == "return_after_break" and t2["redirect"] == t["redirect"]


async def test_after_choosing_week_skipped_today_moves_on(client, db, onboarded_session):
    headers, body = onboarded_session
    await _shift_plan(db, 3)
    await _move_todays_session_to_tomorrow(db)
    t = (await client.get("/today", headers=headers)).json()
    assert t["kind"] == "week_skipped", t
    msg_id = t["redirect"].split("msg=")[1]
    r = await client.post("/chat/options/full", json={"message_id": msg_id}, headers=headers)
    assert r.status_code == 200, r.text
    t2 = (await client.get("/today", headers=headers)).json()
    assert t2["kind"] == "rest_day", t2


async def test_after_choosing_no_day_option_today_no_longer_redirects_to_chat(client, db, onboarded_session):
    headers, body = onboarded_session
    from sqlalchemy import select as _select

    from app.models import PlannedSession

    sessions = sorted((await db.execute(_select(PlannedSession))).scalars().all(), key=lambda s: (s.date, s.index_in_week))
    sessions[0].date -= timedelta(days=1)
    await db.commit()
    t = (await client.get("/today", headers=headers)).json()
    assert t["kind"] == "session_skipped"
    msg_id = t["redirect"].split("msg=")[1]
    r = await client.post("/chat/options/short_tomorrow", json={"message_id": msg_id}, headers=headers)
    assert r.status_code == 200, r.text
    t2 = (await client.get("/today", headers=headers)).json()
    assert t2["kind"] in ("session", "rest_day") and t2.get("redirect") is None, t2


# ---------------------------------------------------------------- M11: Retry-After sul 429 e header di sicurezza


SECURITY_HEADERS = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
}


async def test_rate_limited_response_has_retry_after(client):
    from app.ratelimit import limiter

    limiter.enabled = True
    limiter.reset()
    try:
        last = None
        for _ in range(11):
            last = await client.post("/auth/login", json={"email": "x@example.org", "password": "sbagliata-123"})
        assert last.status_code == 429 and last.json()["code"] == "rate_limited"
        retry = last.headers.get("retry-after")
        assert retry is not None and retry.isdigit() and 1 <= int(retry) <= 60, retry
    finally:
        limiter.enabled = False


async def test_every_response_carries_security_headers(client, auth, monkeypatch):
    ok = await client.get("/me", headers=auth)
    assert ok.status_code == 200
    not_found = await client.get("/non-esiste")
    assert not_found.status_code == 404
    from app.services import chat as svc

    async def boom(db, settings):
        raise RuntimeError("simulated crash (test)")

    monkeypatch.setattr(svc, "chat_texts", boom)
    crashed = await client.get("/chat/texts")
    assert crashed.status_code == 500
    for r in (ok, not_found, crashed):
        for k, v in SECURITY_HEADERS.items():
            assert r.headers.get(k) == v, (r.request.url, k, r.headers.get(k))


# ---------------------------------------------------------------- M12: Stripe senza chiavi -> 503 onesto, non 500


async def test_billing_without_stripe_keys_is_503_billing_unavailable(client, app, db):
    from tests.test_billing import FakeStripe, _post_event, _sub_event

    headers, me = await register(client, email="pro@example.org")
    previous = app.state.stripe
    app.state.stripe = FakeStripe()  # l'abbonamento esiste (webhook di test), poi le chiavi spariscono
    await _post_event(client, _sub_event("evt_a", user_id=me["user"]["id"]))
    await _post_event(client, _sub_event("evt_b", "invoice.paid", user_id=me["user"]["id"]))
    from app.config import get_settings
    from app.services.stripe_gateway import build_stripe

    settings = get_settings()
    old_key = settings.stripe_secret_key
    settings.stripe_secret_key = ""
    app.state.stripe = build_stripe(settings)
    try:
        for method, url, payload in [
            ("POST", "/billing/checkout", {"price": "month", "from_surface": "pricing"}),
            ("POST", "/billing/portal", {}),
            ("POST", "/billing/withdraw", None),
        ]:
            r = await client.request(method, url, json=payload, headers={**headers, "Origin": "http://localhost:3000"})
            assert r.status_code == 503, (url, r.status_code, r.text)
            body = r.json()
            assert body["code"] == "billing_unavailable" and "supporto@" in body["detail"], body
            assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
        wh = await client.post("/billing/webhook", content=b"{}", headers={"Stripe-Signature": "x"})
        assert wh.status_code == 503 and wh.json()["code"] == "billing_unavailable"
        founders = await client.get("/billing/founders")
        assert founders.status_code == 200 and founders.json()["remaining"] == 100, "la pagina prezzi resta viva"
        still = (await client.get("/me", headers=headers)).json()
        assert still["entitlement"]["plan"] == "pro", "il recesso fallito non tocca l'abbonamento"
    finally:
        settings.stripe_secret_key = old_key
        app.state.stripe = previous


# ---------------------------------------------------------------- N2: due scritture identiche in volo sulla stessa seduta


import asyncio  # noqa: E402


async def test_two_identical_syncs_in_flight_apply_once_and_answer_duplicate(client, onboarded_session):
    """Secondo QA N2: due `sync` con lo stesso batch nello stesso istante -> 200 + 200, mai 500 (uq_session_op)."""
    headers, body = onboarded_session
    sid = body["first_session_id"]
    s = await _session(client, headers, sid)
    sets = s["exercises"][0]["sets"]
    ops = [
        {"op": "patch_set", "client_op_id": "r1", "client_updated_at": _now_iso(-60), "set_id": sets[0]["id"], "weight_kg": 50, "reps": 9, "rir": 2, "status": "done"},
        {"op": "patch_set", "client_op_id": "r2", "client_updated_at": _now_iso(-30), "set_id": sets[1]["id"], "weight_kg": 50, "reps": 9, "rir": 2, "status": "done"},
        {"op": "close", "client_op_id": "rc", "client_updated_at": _now_iso(), "sets": []},
    ]
    a, b = await asyncio.gather(
        client.post(f"/sessions/{sid}/sync", json={"ops": ops}, headers=headers),
        client.post(f"/sessions/{sid}/sync", json={"ops": ops}, headers=headers),
    )
    assert (a.status_code, b.status_code) == (200, 200), (a.text, b.text)
    outcomes = sorted([[x["status"] for x in r.json()["results"]] for r in (a, b)])
    assert outcomes == [["applied", "applied", "applied"], ["duplicate", "duplicate", "duplicate"]], outcomes
    for r in (a, b):
        sess = r.json()["session"]
        assert sess["status"] in ("done", "short")
        assert sess["exercises"][0]["sets"][0]["logged"]["weight_kg"] == 50.0
    after = await _session(client, headers, sid)
    assert after["status"] in ("done", "short")


async def test_two_identical_set_patches_in_flight_apply_once(client, onboarded_session):
    """Stesso `client_op_id` su PATCH set da due richieste concorrenti: entrambe 200, una sola scrittura, stato coerente."""
    headers, body = onboarded_session
    sid = body["first_session_id"]
    s = await _session(client, headers, sid)
    set_a = s["exercises"][0]["sets"][0]["id"]
    payload = {"weight_kg": 42.5, "reps": 8, "rir": 2, "status": "done", "client_op_id": "p-race", "client_updated_at": _now_iso(-10)}
    a, b = await asyncio.gather(
        client.patch(f"/sessions/{sid}/sets/{set_a}", json=payload, headers=headers),
        client.patch(f"/sessions/{sid}/sets/{set_a}", json=payload, headers=headers),
    )
    assert (a.status_code, b.status_code) == (200, 200), (a.text, b.text)
    for r in (a, b):
        assert r.json()["logged"]["weight_kg"] == 42.5 and r.json()["logged"]["status"] == "done"
    after = await _session(client, headers, sid)
    assert after["exercises"][0]["sets"][0]["logged"]["weight_kg"] == 42.5


async def test_two_identical_add_sets_in_flight_add_one_row(client, onboarded_session):
    """Stesso `client_op_id` su POST sets da due richieste concorrenti: una sola serie in più, stesso id in risposta."""
    headers, body = onboarded_session
    sid = body["first_session_id"]
    s = await _session(client, headers, sid)
    ex = s["exercises"][0]
    payload = {"exercise_id": ex["id"], "client_op_id": "a-race", "client_updated_at": _now_iso(-10)}
    a, b = await asyncio.gather(
        client.post(f"/sessions/{sid}/sets", json=payload, headers=headers),
        client.post(f"/sessions/{sid}/sets", json=payload, headers=headers),
    )
    assert (a.status_code, b.status_code) == (201, 201), (a.text, b.text)
    assert a.json()["id"] == b.json()["id"]
    after = await _session(client, headers, sid)
    assert len(after["exercises"][0]["sets"]) == len(ex["sets"]) + 1
