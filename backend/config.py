"""Central configuration. All secrets come from environment variables (backend/.env)."""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # python-dotenv is optional at import time
    load_dotenv = None

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
if load_dotenv:
    load_dotenv(BASE_DIR / ".env")


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


APP_NAME = "FuelWise - Smart Fuel Intelligence"
APP_VERSION = "1.1.0"

DATABASE_PATH = Path(os.getenv("FUELWISE_DB_PATH") or ROOT_DIR / "database" / "fuelwise.db")
DATABASE_URL = f"sqlite:///{DATABASE_PATH.as_posix()}"

# ---- Web addresses -------------------------------------------------------------
# Use the SAME host name (localhost) for the frontend and the API so the session cookie is sent.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", FRONTEND_URL + ",http://127.0.0.1:5173").split(",") if o.strip()]

# ---- Sessions ------------------------------------------------------------------
COOKIE_NAME = "fw_session"
COOKIE_SECURE = _bool("COOKIE_SECURE", False)          # set true when the site is served over HTTPS
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").lower()
SESSION_TTL_HOURS = int(os.getenv("SESSION_TTL_HOURS", "24"))
REMEMBER_TTL_DAYS = int(os.getenv("REMEMBER_TTL_DAYS", "30"))
LOGIN_MAX_FAILURES = int(os.getenv("LOGIN_MAX_FAILURES", "5"))
LOGIN_LOCK_MINUTES = int(os.getenv("LOGIN_LOCK_MINUTES", "15"))

# ---- Password reset e-mail -----------------------------------------------------
RESET_TOKEN_MINUTES = int(os.getenv("RESET_TOKEN_MINUTES", "30"))
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "").strip() or SMTP_USER
SMTP_USE_TLS = _bool("SMTP_USE_TLS", True)
# DEVELOPMENT ONLY: print the reset link in the backend terminal when SMTP is not configured.
DEV_PRINT_RESET_LINKS = _bool("DEV_PRINT_RESET_LINKS", False)

# ---- Google OAuth --------------------------------------------------------------
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback").strip()

# ---- First admin account (optional bootstrap, see README) ------------------------
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
ADMIN_NAME = os.getenv("ADMIN_NAME", "Administrator").strip() or "Administrator"

# ---- AI ------------------------------------------------------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Approximate emission factors (assumptions, configurable).
PETROL_CO2_KG_PER_LITRE = float(os.getenv("PETROL_CO2_KG_PER_LITRE", "2.31"))
GRID_CO2_KG_PER_KWH = float(os.getenv("GRID_CO2_KG_PER_KWH", "0.71"))

DEFAULT_CHARGING_LOSS_PERCENT = 10.0
