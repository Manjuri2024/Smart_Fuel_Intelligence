"""API tests (need the packages in requirements.txt). Run from the project root:  python -m pytest backend"""
import os
import re
import tempfile
from unittest import mock

_tmp = tempfile.mkdtemp()
os.environ["FUELWISE_DB_PATH"] = os.path.join(_tmp, "test.db")
os.environ["GEMINI_API_KEY"] = ""
os.environ["GOOGLE_CLIENT_ID"] = ""
os.environ["GOOGLE_CLIENT_SECRET"] = ""
os.environ["ADMIN_EMAIL"] = "admin@example.com"
os.environ["ADMIN_PASSWORD"] = "AdminPass123"

import pytest
from fastapi.testclient import TestClient

from backend import config
from backend.main import app

SAVE_MESSAGE = "Create a free FuelWise account to save your trips and vehicle information."


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:      # "with" runs start-up: creates tables and the bootstrap admin
        yield c


def new_client():
    return TestClient(app)          # separate cookie jar = separate browser


def reg(email, name="Asha", **extra):
    return {"name": name, "email": email, "password": "password123", "confirm_password": "password123",
            "accept_terms": True, **extra}


def signed_in(email):
    c = new_client()
    r = c.post("/api/auth/register", json=reg(email))
    assert r.status_code == 201, r.text
    return c


PETROL = {"distance_km": 100, "mileage_kmpl": 45, "price_per_litre": 105}
EV = {"distance_km": 100, "efficiency_km_per_kwh": 40, "tariff_per_kwh": 8, "charging_loss_percent": 0}
COMPARE = {"distance_km": 100, "ev_efficiency_km_per_kwh": 40, "tariff_per_kwh": 8, "petrol_mileage_kmpl": 45,
           "petrol_price_per_litre": 105, "charging_loss_percent": 0}


# ---- guests: allowed ---------------------------------------------------------------
def test_health(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok" and body["google_configured"] is False


def test_guest_can_use_calculators_and_comparison(client):
    assert client.post("/api/calculate/petrol", json=PETROL).json()["trip_cost"] == 233.33
    assert client.post("/api/calculate/electric", json=EV).json()["trip_cost"] == 20.0
    body = client.post("/api/compare", json=COMPARE).json()
    assert body["cheaper_option"] == "electric" and body["savings_percent"] == 91.4


def test_invalid_calculator_input_rejected(client):
    assert client.post("/api/calculate/petrol", json={**PETROL, "distance_km": -1}).status_code == 422
    assert client.post("/api/calculate/petrol", json={"distance_km": 10}).status_code == 422


def test_guest_gets_labelled_demo_dashboard_and_demo_map(client):
    d = client.get("/api/demo/dashboard").json()
    assert d["is_demo"] is True and d["has_data"] and "Demo" in d["demo_notice"]
    m = client.get("/api/maps/charging-stations", params={"lat": 22.5, "lng": 88.3}).json()
    assert m["is_demo"] and all(s["is_demo"] for s in m["stations"])


# ---- guests: blocked on the backend -------------------------------------------------
@pytest.mark.parametrize("url", ["/api/dashboard", "/api/trips", "/api/vehicles", "/api/settings", "/api/auth/me",
                                 "/api/admin/stats", "/api/admin/users", "/api/trips/1"])
def test_guest_cannot_read_private_data(client, url):
    assert new_client().get(url).status_code == 401


def test_guest_cannot_save_or_use_private_ai(client):
    g = new_client()
    trip = {"trip_date": "2026-11-01", "vehicle_type": "petrol", "distance_km": 5, "energy_used": 0.1, "price_per_unit": 100}
    r = g.post("/api/trips", json=trip)
    assert r.status_code == 401 and r.json()["detail"] == SAVE_MESSAGE
    r = g.post("/api/vehicles", json={"name": "V", "vehicle_type": "petrol", "efficiency": 40})
    assert r.status_code == 401 and r.json()["detail"] == SAVE_MESSAGE
    assert g.put("/api/settings", json={}).status_code == 401
    assert g.post("/api/ai/chat", json={"message": "hi"}).status_code == 401
    assert g.patch("/api/admin/users/1", json={"account_status": "disabled"}).status_code == 401


def test_forged_cookie_is_treated_as_guest(client):
    c = new_client()
    c.cookies.set(config.COOKIE_NAME, "not-a-real-session-token")
    assert c.get("/api/auth/me").status_code == 401


# ---- registration ---------------------------------------------------------------------
@pytest.mark.parametrize("change", [{"password": "short1", "confirm_password": "short1"},
                                    {"password": "onlyletters", "confirm_password": "onlyletters"},
                                    {"confirm_password": "different123"}, {"accept_terms": False},
                                    {"email": "not-an-email"}, {"phone": "abc"}, {"name": ""}])
def test_registration_validation(client, change):
    assert new_client().post("/api/auth/register", json={**reg("valid@example.com"), **change}).status_code == 422


def test_registration_success_duplicate_and_no_public_admin(client):
    c = new_client()
    r = c.post("/api/auth/register", json={**reg("Asha.New@Example.com", phone="+91 98765 43210"), "role": "admin"})
    assert r.status_code == 201
    user = r.json()["user"]
    assert user["role"] == "user" and user["email"] == "asha.new@example.com" and "password" not in str(user).lower()
    assert c.get("/api/auth/me").json()["user"]["role"] == "user"          # auto signed in, still not an admin
    dup = new_client().post("/api/auth/register", json=reg("asha.new@example.com"))
    assert dup.status_code == 409 and "already exists" in dup.json()["detail"]


# ---- login / logout / session ------------------------------------------------------------
def test_login_logout_flow(client):
    signed_in("flow@example.com")
    c = new_client()
    assert c.post("/api/auth/login", json={"email": "flow@example.com", "password": "wrongpass1"}).status_code == 401
    assert c.post("/api/auth/login", json={"email": "nobody@example.com", "password": "password123"}).status_code == 401
    assert c.post("/api/auth/login", json={"email": "flow@example.com"}).status_code == 422           # missing field
    assert c.post("/api/auth/login", json={}).status_code == 422
    ok = c.post("/api/auth/login", json={"email": "flow@example.com", "password": "password123"})
    assert ok.status_code == 200 and "httponly" in ok.headers["set-cookie"].lower()
    assert "max-age" not in ok.headers["set-cookie"].lower()                                           # session cookie
    assert c.get("/api/auth/me").json()["user"]["email"] == "flow@example.com"
    assert c.post("/api/auth/logout").status_code == 200
    assert c.get("/api/auth/me").status_code == 401                                                    # session revoked


def test_logged_out_session_cookie_cannot_be_reused(client):
    c = signed_in("reuse@example.com")
    stolen = c.cookies.get(config.COOKIE_NAME)
    c.post("/api/auth/logout")
    other = new_client()
    other.cookies.set(config.COOKIE_NAME, stolen)
    assert other.get("/api/auth/me").status_code == 401


def test_remember_me_sets_persistent_cookie(client):
    signed_in("remember@example.com")
    r = new_client().post("/api/auth/login", json={"email": "remember@example.com", "password": "password123", "remember": True})
    assert "max-age" in r.headers["set-cookie"].lower()


def test_account_lockout_after_repeated_failures(client):
    signed_in("lock@example.com")
    c = new_client()
    for _ in range(config.LOGIN_MAX_FAILURES):
        assert c.post("/api/auth/login", json={"email": "lock@example.com", "password": "badpass123"}).status_code == 401
    assert c.post("/api/auth/login", json={"email": "lock@example.com", "password": "password123"}).status_code == 429


# ---- password reset ------------------------------------------------------------------------
def test_password_reset_flow(client):
    signed_in("reset@example.com")
    sent = []
    with mock.patch("backend.routes.auth._send_reset", side_effect=lambda email, link: sent.append((email, link))):
        known = new_client().post("/api/auth/forgot-password", json={"email": "reset@example.com"})
        unknown = new_client().post("/api/auth/forgot-password", json={"email": "ghost@example.com"})
    assert known.status_code == unknown.status_code == 200 and known.json() == unknown.json()   # no e-mail enumeration
    assert len(sent) == 1 and sent[0][0] == "reset@example.com"
    token = re.search(r"token=([\w-]+)", sent[0][1]).group(1)
    assert token not in known.text                                                                # token never in the response

    c = new_client()
    assert c.post("/api/auth/reset-password", json={"token": token, "new_password": "weak"}).status_code == 422
    assert c.post("/api/auth/reset-password", json={"token": "x" * 40, "new_password": "newpass123"}).status_code == 400
    assert c.post("/api/auth/reset-password", json={"token": token, "new_password": "newpass123"}).status_code == 200
    assert c.post("/api/auth/reset-password", json={"token": token, "new_password": "another123"}).status_code == 400  # single use
    assert c.post("/api/auth/login", json={"email": "reset@example.com", "password": "password123"}).status_code == 401
    assert c.post("/api/auth/login", json={"email": "reset@example.com", "password": "newpass123"}).status_code == 200


def test_reset_signs_out_existing_sessions(client):
    victim = signed_in("victim@example.com")
    sent = []
    with mock.patch("backend.routes.auth._send_reset", side_effect=lambda email, link: sent.append(link)):
        new_client().post("/api/auth/forgot-password", json={"email": "victim@example.com"})
    token = re.search(r"token=([\w-]+)", sent[0]).group(1)
    new_client().post("/api/auth/reset-password", json={"token": token, "new_password": "newpass123"})
    assert victim.get("/api/auth/me").status_code == 401


def test_expired_reset_token_rejected(client):
    from backend.database.connection import SessionLocal
    from backend.models.tables import PasswordResetToken
    signed_in("expired@example.com")
    sent = []
    with mock.patch("backend.routes.auth._send_reset", side_effect=lambda email, link: sent.append(link)):
        new_client().post("/api/auth/forgot-password", json={"email": "expired@example.com"})
    token = re.search(r"token=([\w-]+)", sent[0]).group(1)
    db = SessionLocal()
    from datetime import timedelta
    from backend.auth_service import utcnow
    db.query(PasswordResetToken).update({"expires_at": utcnow() - timedelta(minutes=1)})
    db.commit(); db.close()
    assert new_client().post("/api/auth/reset-password", json={"token": token, "new_password": "newpass123"}).status_code == 400


# ---- Google ---------------------------------------------------------------------------------
def test_google_without_credentials_shows_configuration_error(client):
    for path in ("/api/auth/google", "/api/auth/google/callback"):
        r = new_client().get(path, follow_redirects=False)
        assert r.status_code == 303 and "error=google_not_configured" in r.headers["location"]


def test_google_flow_with_mocked_google(client):
    """Tests OUR logic (state check, account creation, errors). It does NOT prove real Google sign-in works."""
    info = {"sub": "g-123", "email": "gus@example.com", "name": "Gus"}
    with mock.patch.object(config, "GOOGLE_CLIENT_ID", "cid"), mock.patch.object(config, "GOOGLE_CLIENT_SECRET", "sec"):
        c = new_client()
        start = c.get("/api/auth/google", follow_redirects=False)
        assert start.status_code == 302 and start.headers["location"].startswith("https://accounts.google.com/")
        state = c.cookies.get("fw_oauth_state")
        assert "sec" not in start.headers["location"]
        assert "google_cancelled" in c.get("/api/auth/google/callback", params={"error": "access_denied"}, follow_redirects=False).headers["location"]
        assert "google_failed" in c.get("/api/auth/google/callback", params={"code": "c", "state": "wrong"}, follow_redirects=False).headers["location"]

        c.cookies.set("fw_oauth_state", state)
        with mock.patch("backend.routes.auth.google_oauth.fetch_user_info", return_value=info):
            ok = c.get("/api/auth/google/callback", params={"code": "c", "state": state}, follow_redirects=False)
        assert ok.status_code == 303 and ok.headers["location"].endswith("/dashboard")
        me = c.get("/api/auth/me").json()["user"]
        assert me["email"] == "gus@example.com" and me["auth_provider"] == "google" and me["role"] == "user"

        # an existing PASSWORD account is never taken over by a Google login with the same e-mail
        signed_in("taken@example.com")
        c2 = new_client(); c2.get("/api/auth/google", follow_redirects=False); st = c2.cookies.get("fw_oauth_state")
        with mock.patch("backend.routes.auth.google_oauth.fetch_user_info", return_value={**info, "sub": "g-999", "email": "taken@example.com"}):
            r = c2.get("/api/auth/google/callback", params={"code": "c", "state": st}, follow_redirects=False)
        assert "google_email_exists" in r.headers["location"]


# ---- roles ------------------------------------------------------------------------------------
def admin_client():
    c = new_client()
    r = c.post("/api/auth/login", json={"email": "admin@example.com", "password": "AdminPass123"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"
    return c


def test_regular_user_cannot_use_admin_area(client):
    u = signed_in("plain@example.com")
    for method, url in (("get", "/api/admin/stats"), ("get", "/api/admin/users"), ("get", "/api/admin/activity"), ("get", "/api/admin/config")):
        assert getattr(u, method)(url).status_code == 403
    assert u.put("/api/admin/config", json={"registration_open": False}).status_code == 403
    assert u.patch("/api/admin/users/1", json={"account_status": "disabled"}).status_code == 403


def test_admin_can_view_stats_and_manage_users_and_config(client):
    target = signed_in("target@example.com")
    target_id = target.get("/api/auth/me").json()["user"]["id"]
    a = admin_client()
    assert a.get("/api/admin/stats").json()["total_users"] >= 2
    users = a.get("/api/admin/users").json()
    assert any(u["email"] == "target@example.com" for u in users["items"]) and "password_hash" not in str(users)
    assert a.get("/api/admin/activity").status_code == 200

    assert a.patch(f"/api/admin/users/{target_id}", json={"account_status": "disabled"}).status_code == 200
    assert target.get("/api/auth/me").status_code == 401                                              # sessions revoked
    assert new_client().post("/api/auth/login", json={"email": "target@example.com", "password": "password123"}).status_code == 403
    assert a.patch(f"/api/admin/users/{target_id}", json={"account_status": "active"}).status_code == 200
    assert new_client().post("/api/auth/login", json={"email": "target@example.com", "password": "password123"}).status_code == 200

    admin_id = a.get("/api/auth/me").json()["user"]["id"]
    assert a.patch(f"/api/admin/users/{admin_id}", json={"account_status": "disabled"}).status_code == 400

    assert a.put("/api/admin/config", json={"registration_open": False}).status_code == 200
    assert new_client().post("/api/auth/register", json=reg("late@example.com")).status_code == 403
    assert a.put("/api/admin/config", json={"registration_open": True}).status_code == 200
    assert new_client().post("/api/auth/register", json=reg("late@example.com")).status_code == 201


# ---- data isolation -------------------------------------------------------------------------------
def test_users_cannot_see_or_change_each_others_data(client):
    alice, bob = signed_in("alice@example.com"), signed_in("bob@example.com")
    vehicle = alice.post("/api/vehicles", json={"name": "Alice EV", "vehicle_type": "electric", "efficiency": 40}).json()
    trip = alice.post("/api/trips", json={"trip_date": "2026-11-01", "vehicle_type": "electric", "distance_km": 50,
                                          "energy_used": 1.25, "price_per_unit": 8}).json()
    assert alice.get("/api/trips").json()["total"] == 1
    assert bob.get("/api/trips").json()["total"] == 0 and bob.get("/api/vehicles").json() == []
    assert bob.get(f"/api/trips/{trip['id']}").status_code == 404
    assert bob.put(f"/api/vehicles/{vehicle['id']}", json={"name": "Hacked", "vehicle_type": "electric", "efficiency": 1}).status_code == 404
    assert bob.post("/api/trips", json={"trip_date": "2026-11-01", "vehicle_type": "electric", "distance_km": 5, "vehicle_id": vehicle["id"]}).status_code == 404
    assert bob.get("/api/dashboard").json()["summary"]["total_trips"] == 0
    assert alice.get("/api/vehicles").json()[0]["name"] == "Alice EV"


# ---- existing FuelWise features still work for signed-in users ------------------------------------
def test_vehicles_trips_dashboard_flow(client):
    u = signed_in("features@example.com")
    v = u.post("/api/vehicles", json={"name": "EV", "vehicle_type": "electric", "efficiency": 40,
                                      "battery_capacity_kwh": 3, "current_level_percent": 50})
    assert v.status_code == 201 and v.json()["remaining_range_km"] == 60.0
    vid = v.json()["id"]
    assert u.put(f"/api/vehicles/{vid}", json={"name": "EV2", "vehicle_type": "electric", "efficiency": 42}).json()["name"] == "EV2"
    assert u.put("/api/vehicles/9999", json={"name": "x", "vehicle_type": "petrol", "efficiency": 40}).status_code == 404

    t = u.post("/api/trips", json={"trip_date": "2026-11-01", "vehicle_type": "electric", "distance_km": 50, "energy_used": 1.25, "price_per_unit": 8})
    assert t.status_code == 201 and t.json()["cost"] == 10.0
    assert u.get(f"/api/trips/{t.json()['id']}").status_code == 200 and u.get("/api/trips/9999").status_code == 404
    assert u.post("/api/trips", json={"trip_date": "2026-11-01", "vehicle_type": "petrol", "distance_km": 5}).status_code == 422
    listing = u.get("/api/trips", params={"vehicle_type": "electric"}).json()
    assert listing["total"] == 1 and listing["summary"]["total_distance_km"] == 50
    assert u.get("/api/trips", params={"vehicle_type": "petrol"}).json()["items"] == []

    d = u.get("/api/dashboard").json()
    assert d["has_data"] and d["is_demo"] is False and len(d["cost_trend"]) == 7


def test_ai_settings_and_predict_for_signed_in_user(client):
    u = signed_in("ai@example.com")
    body = u.post("/api/ai/chat", json={"message": "Which is cheaper for 100 km?"}).json()
    assert body["configured"] is False and "GEMINI_API_KEY" in body["reply"]
    assert body["facts"]["comparison_for_requested_distance"]["distance_km"] == 100
    assert u.post("/api/ai/predict", json={"vehicle_type": "electric", "distance_km": 40, "efficiency": 40}).json()["method"] == "formula"

    s = u.get("/api/settings").json()
    assert s["full_name"] == "Asha" and s["email"] == "ai@example.com"
    s.update(default_petrol_price=110, phone="+91 98765 43210")
    assert u.put("/api/settings", json=s).json()["default_petrol_price"] == 110
    s["default_petrol_price"] = -5
    assert u.put("/api/settings", json=s).status_code == 422
    other = signed_in("ai2@example.com").get("/api/settings").json()
    assert other["default_petrol_price"] == 105                                   # settings are per user
