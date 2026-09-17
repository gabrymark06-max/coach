"""Seam: le rotte HTTP di /auth e /me."""

from tests.conftest import register


async def test_register_returns_tokens_and_user(client):
    r = await client.post(
        "/auth/register", json={"email": "anna@example.org", "password": "Password-forte-1", "accept_terms": True}
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["user"]["email"] == "anna@example.org"
    assert body["user"]["email_verified"] is False
    assert body["access_token"] and body["refresh_token"]
    assert body["token_type"] == "bearer"


async def test_register_duplicate_email_is_409_with_uniform_error(client):
    await register(client)
    r = await client.post(
        "/auth/register", json={"email": "anna@example.org", "password": "Password-forte-1", "accept_terms": True}
    )
    assert r.status_code == 409
    assert r.json() == {"code": "email_taken", "detail": "Questa email è già registrata."}


async def test_register_without_terms_is_422_uniform(client):
    r = await client.post("/auth/register", json={"email": "b@example.org", "password": "Password-forte-1"})
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "validation_error"
    assert "accept_terms" in body["detail"]


async def test_register_weak_password_rejected(client):
    r = await client.post("/auth/register", json={"email": "b@example.org", "password": "corta", "accept_terms": True})
    assert r.status_code == 422
    assert r.json()["code"] == "validation_error"


async def test_login_wrong_password_is_401_with_italian_detail(client):
    await register(client)
    r = await client.post("/auth/login", json={"email": "anna@example.org", "password": "sbagliata-123"})
    assert r.status_code == 401
    assert r.json() == {"code": "invalid_credentials", "detail": "Email o password non corrispondono."}


async def test_login_then_me(client):
    await register(client)
    r = await client.post("/auth/login", json={"email": "ANNA@example.org", "password": "Password-forte-1"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text
    body = me.json()
    assert body["user"]["email"] == "anna@example.org"
    assert body["entitlement"]["plan"] == "free"
    assert body["engine_active"] is True  # nessun mesociclo ancora: il primo blocco è sempre libero
    assert body["chat_quota"]["used"] == 0
    assert body["chat_quota"]["limit"] == 15
    assert body["chat_quota"]["resets_at"]
    assert body["chat_quota"]["daily_used"] is None
    assert body["mesocycle"] is None
    assert body["subscription"] is None
    assert body["withdrawal_eligible_until"] is None
    assert body["health_consent"] == {"given": False, "given_at": None}
    assert body["onboarding_completed"] is False
    assert body["support_email"]
    assert body["pwa"] == {"installed_reported": False}


async def test_me_without_token_is_401_uniform(client):
    r = await client.get("/me")
    assert r.status_code == 401
    assert r.json()["code"] == "unauthorized"


async def test_refresh_rotates_and_old_refresh_is_rejected(client):
    _, body = await register(client)
    refresh = body["refresh_token"]
    r2 = await client.post("/auth/refresh", json={"refresh_token": refresh})
    assert r2.status_code == 200
    assert r2.json()["refresh_token"] != refresh
    r3 = await client.post("/auth/refresh", json={"refresh_token": refresh})
    assert r3.status_code == 401
    assert r3.json()["code"] == "invalid_refresh_token"


async def test_logout_revokes_refresh(client):
    headers, body = await register(client)
    out = await client.post("/auth/logout", json={"refresh_token": body["refresh_token"]}, headers=headers)
    assert out.status_code == 204
    r3 = await client.post("/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert r3.status_code == 401


async def test_verify_email_flow_with_fake_mailer(client, app):
    headers, _ = await register(client)
    resend = await client.post("/auth/verify/resend", headers=headers)
    assert resend.status_code == 202
    sent = [m for m in app.state.mailer.sent if m.kind == "verify_email"]
    assert sent, "nessuna email di verifica inviata"
    verify_token = sent[-1].meta["token"]
    ok = await client.post("/auth/verify", json={"token": verify_token})
    assert ok.status_code == 200
    me = await client.get("/me", headers=headers)
    assert me.json()["user"]["email_verified"] is True
    again = await client.post("/auth/verify", json={"token": verify_token})
    assert again.status_code == 400
    assert again.json()["code"] == "invalid_token"


async def test_password_reset_flow(client, app):
    await register(client)
    r = await client.post("/auth/password/forgot", json={"email": "anna@example.org"})
    assert r.status_code == 202
    r2 = await client.post("/auth/password/forgot", json={"email": "nessuno@example.org"})
    assert r2.status_code == 202  # non rivela chi è registrato
    sent = [m for m in app.state.mailer.sent if m.kind == "reset_password"]
    token = sent[-1].meta["token"]
    ok = await client.post("/auth/password/reset", json={"token": token, "password": "Nuova-password-9"})
    assert ok.status_code == 200
    login = await client.post("/auth/login", json={"email": "anna@example.org", "password": "Nuova-password-9"})
    assert login.status_code == 200


async def test_user_cannot_read_another_users_resources(client):
    """Ogni query è scopata per owner: una sessione altrui è 404, non 403 (non riveliamo che esiste)."""
    headers_a, _ = await register(client, email="a@example.org")
    headers_b, _ = await register(client, email="b@example.org")
    r = await client.get("/sessions/00000000-0000-0000-0000-000000000000", headers=headers_b)
    assert r.status_code == 404
    assert r.json()["code"] == "not_found"
