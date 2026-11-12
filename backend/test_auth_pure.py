"""Authentication helpers that need no web server or database."""
import sqlite3
from unittest import mock

import pytest

from backend import config, google_oauth, mailer
from backend.calculations.dashboard_stats import build_dashboard
from backend.calculations.demo_data import demo_settings, demo_trips, demo_vehicle
from backend.database.migrations import USER_COLUMNS_ADDED_IN_1_1, add_missing_columns


# ---- database upgrade ----------------------------------------------------------
def test_migration_keeps_old_users_and_adds_columns():
    cur = sqlite3.connect(":memory:").cursor()
    cur.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, password_hash TEXT, created_at DATETIME)")
    cur.execute("INSERT INTO users (name, email, password_hash) VALUES ('Old', 'old@x.com', 'h')")
    assert set(add_missing_columns(cur, "users", USER_COLUMNS_ADDED_IN_1_1)) == set(USER_COLUMNS_ADDED_IN_1_1)
    assert cur.execute("SELECT name, role, auth_provider, account_status FROM users").fetchall() == [("Old", "user", "local", "active")]
    assert add_missing_columns(cur, "users", USER_COLUMNS_ADDED_IN_1_1) == []   # safe to run twice


# ---- e-mail ---------------------------------------------------------------------
def test_mailer_does_nothing_when_not_configured(capsys):
    with mock.patch.object(config, "SMTP_HOST", ""), mock.patch.object(config, "DEV_PRINT_RESET_LINKS", False):
        assert mailer.send_reset_email("a@b.com", "http://x/reset?token=T") == "not_configured"
    assert "reset?token" not in capsys.readouterr().out          # link is NOT printed unless dev mode is on


def test_mailer_dev_console_mode_prints_link(capsys):
    with mock.patch.object(config, "SMTP_HOST", ""), mock.patch.object(config, "DEV_PRINT_RESET_LINKS", True):
        assert mailer.send_reset_email("a@b.com", "http://x/reset?token=T") == "dev_console"
    assert "http://x/reset?token=T" in capsys.readouterr().out


def test_mailer_sends_through_smtp_when_configured():
    fake = mock.MagicMock()
    fake.__enter__.return_value = fake
    with mock.patch.object(config, "SMTP_HOST", "smtp.test"), mock.patch.object(config, "SMTP_FROM", "no@reply"), \
            mock.patch.object(config, "SMTP_USER", "u"), mock.patch.object(config, "SMTP_PORT", 587), \
            mock.patch("backend.mailer.smtplib.SMTP", return_value=fake):
        assert mailer.send_reset_email("a@b.com", "http://x/link") == "sent"
    fake.starttls.assert_called_once()
    fake.login.assert_called_once()
    assert "http://x/link" in fake.send_message.call_args[0][0].get_content()


def test_mailer_failure_is_swallowed():
    with mock.patch.object(config, "SMTP_HOST", "smtp.test"), mock.patch.object(config, "SMTP_FROM", "no@reply"), \
            mock.patch("backend.mailer.smtplib.SMTP", side_effect=OSError("down")):
        assert mailer.send_reset_email("a@b.com", "http://x/link") == "not_configured"


# ---- Google OAuth ------------------------------------------------------------------
def test_google_not_configured_by_default():
    with mock.patch.object(config, "GOOGLE_CLIENT_ID", ""), mock.patch.object(config, "GOOGLE_CLIENT_SECRET", ""):
        assert google_oauth.is_configured() is False


def _google_config():
    return (mock.patch.object(config, "GOOGLE_CLIENT_ID", "cid"), mock.patch.object(config, "GOOGLE_CLIENT_SECRET", "secret"),
            mock.patch.object(config, "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback"))


def test_google_authorization_url_has_state_and_no_secret():
    a, b, c = _google_config()
    with a, b, c:
        url = google_oauth.build_authorization_url("STATE123")
    assert url.startswith(google_oauth.AUTH_URL) and "state=STATE123" in url and "client_id=cid" in url
    assert "secret" not in url


def _response(status, payload):
    r = mock.MagicMock(status_code=status)
    r.json.return_value = payload
    return r


def test_google_user_info_success_and_failures():
    a, b, c = _google_config()
    with a, b, c:
        with mock.patch("backend.google_oauth.requests.post", return_value=_response(200, {"access_token": "t"})), \
                mock.patch("backend.google_oauth.requests.get", return_value=_response(200, {"sub": "1", "email": "A@B.com", "email_verified": True, "name": "Asha"})):
            assert google_oauth.fetch_user_info("code") == {"sub": "1", "email": "a@b.com", "name": "Asha"}
        with mock.patch("backend.google_oauth.requests.post", return_value=_response(400, {})):
            with pytest.raises(google_oauth.GoogleAuthError):
                google_oauth.fetch_user_info("bad")
        with mock.patch("backend.google_oauth.requests.post", return_value=_response(200, {"access_token": "t"})), \
                mock.patch("backend.google_oauth.requests.get", return_value=_response(200, {"sub": "1", "email": "a@b.com", "email_verified": False})):
            with pytest.raises(google_oauth.GoogleAuthError):
                google_oauth.fetch_user_info("code")


# ---- guest demo data ---------------------------------------------------------------
def test_demo_dashboard_is_generated_in_memory():
    data = build_dashboard(demo_trips(), demo_settings(), demo_vehicle(), days=7)
    assert data["has_data"] and data["summary"]["total_trips"] == 36
    assert len(data["cost_trend"]) == 7 and data["vehicle_status"]["remaining_range_km"] == 86.4
    assert all(t["notes"] == "DEMO DATA" for t in data["recent_trips"])


def test_dashboard_with_no_trips():
    data = build_dashboard([], demo_settings(), None, days=7)
    assert data["has_data"] is False and data["vehicle_status"] == {"has_vehicle": False}
