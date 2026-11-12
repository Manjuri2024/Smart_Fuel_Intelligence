"""Authentication helpers: sessions, reset tokens, activity log, app config, user creation, admin bootstrap."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend import config
from backend.models.tables import ActivityLog, AppConfig, AuthSession, PasswordResetToken, User, UserSettings
from backend.security import (generate_token, hash_password, hash_token, validate_password_strength)

logger = logging.getLogger("fuelwise.auth")

LOCAL_EMAIL = "local@fuelwise.local"        # system account that owns data created before accounts existed
CONFIG_DEFAULTS = {"registration_open": "true"}


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def client_ip(request) -> Optional[str]:
    return request.client.host if request.client else None


def user_to_dict(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "phone": u.phone, "role": u.role,
            "auth_provider": u.auth_provider, "account_status": u.account_status,
            "created_at": u.created_at.isoformat() if u.created_at else None}


# ---- activity log and brute-force protection -----------------------------------
def log_event(db: Session, event: str, user_id: Optional[int] = None, detail: Optional[str] = None,
              ip: Optional[str] = None) -> None:
    db.add(ActivityLog(user_id=user_id, event=event, detail=(detail or None) and detail[:255],
                       ip_address=ip, created_at=utcnow()))
    db.commit()


def too_many_failures(db: Session, email: str) -> bool:
    since = utcnow() - timedelta(minutes=config.LOGIN_LOCK_MINUTES)
    count = db.query(func.count(ActivityLog.id)).filter(
        ActivityLog.event == "login_failed", ActivityLog.detail == email[:255], ActivityLog.created_at >= since).scalar()
    return count >= config.LOGIN_MAX_FAILURES


# ---- sessions --------------------------------------------------------------------
def create_session(db: Session, user: User, remember: bool) -> str:
    raw, token_hash = generate_token()
    ttl = timedelta(days=config.REMEMBER_TTL_DAYS) if remember else timedelta(hours=config.SESSION_TTL_HOURS)
    now = utcnow()
    db.add(AuthSession(user_id=user.id, token_hash=token_hash, remember=remember, created_at=now, expires_at=now + ttl))
    user.last_login_at = now
    db.commit()
    return raw


def attach_session_cookie(response, raw: str, remember: bool) -> None:
    response.set_cookie(config.COOKIE_NAME, raw, httponly=True, secure=config.COOKIE_SECURE,
                        samesite=config.COOKIE_SAMESITE, path="/",
                        max_age=config.REMEMBER_TTL_DAYS * 86400 if remember else None)


def clear_session_cookie(response) -> None:
    response.delete_cookie(config.COOKIE_NAME, path="/", httponly=True, secure=config.COOKIE_SECURE,
                           samesite=config.COOKIE_SAMESITE)


def find_user_by_session(db: Session, raw: Optional[str]) -> Optional[User]:
    if not raw:
        return None
    session = db.query(AuthSession).filter(AuthSession.token_hash == hash_token(raw), AuthSession.revoked_at.is_(None),
                                           AuthSession.expires_at > utcnow()).first()
    user = db.get(User, session.user_id) if session else None
    return user if user and user.account_status == "active" else None


def revoke_session(db: Session, raw: Optional[str]) -> None:
    if raw:
        db.query(AuthSession).filter(AuthSession.token_hash == hash_token(raw), AuthSession.revoked_at.is_(None)) \
            .update({"revoked_at": utcnow()})
        db.commit()


def revoke_all_sessions(db: Session, user_id: int) -> None:
    db.query(AuthSession).filter(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None)) \
        .update({"revoked_at": utcnow()})
    db.commit()


# ---- password reset tokens --------------------------------------------------------
def create_reset_token(db: Session, user: User) -> str:
    now = utcnow()
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)) \
        .update({"used_at": now})                                  # older links stop working
    raw, token_hash = generate_token()
    db.add(PasswordResetToken(user_id=user.id, token_hash=token_hash, created_at=now,
                              expires_at=now + timedelta(minutes=config.RESET_TOKEN_MINUTES)))
    db.commit()
    return raw


def use_reset_token(db: Session, raw: str) -> Optional[User]:
    """Mark a valid token as used and return its user (the caller commits). None if invalid/expired/used."""
    row = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == hash_token(raw),
                                              PasswordResetToken.used_at.is_(None),
                                              PasswordResetToken.expires_at > utcnow()).first()
    user = db.get(User, row.user_id) if row else None
    if not row or not user or user.account_status != "active":
        return None
    row.used_at = utcnow()
    return user


# ---- app configuration -------------------------------------------------------------
def get_config(db: Session, key: str) -> str:
    row = db.get(AppConfig, key)
    return row.value if row else CONFIG_DEFAULTS[key]


def set_config(db: Session, key: str, value: str) -> None:
    row = db.get(AppConfig, key)
    if row:
        row.value = value
    else:
        db.add(AppConfig(key=key, value=value))
    db.commit()


def config_bool(value: str) -> bool:
    return value.strip().lower() in ("1", "true", "yes", "on")


# ---- users -------------------------------------------------------------------------
def create_user(db: Session, name: str, email: str, password: Optional[str], phone: Optional[str] = None,
                role: str = "user", provider: str = "local") -> User:
    user = User(name=name, email=email, phone=phone or None, role=role, auth_provider=provider,
                account_status="active", password_hash=hash_password(password) if password else "!")
    db.add(user)
    db.flush()
    db.add(UserSettings(user_id=user.id))
    db.commit()
    db.refresh(user)
    return user


def bootstrap_admin(db: Session) -> None:
    """Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD (only if no such user exists yet)."""
    if not config.ADMIN_EMAIL or not config.ADMIN_PASSWORD:
        return
    if db.query(User).filter(User.email == config.ADMIN_EMAIL).first():
        return                                  # never changes or promotes an existing account
    try:
        validate_password_strength(config.ADMIN_PASSWORD)
    except ValueError as exc:
        logger.error("ADMIN_PASSWORD rejected: %s Admin account NOT created.", exc)
        return
    create_user(db, config.ADMIN_NAME, config.ADMIN_EMAIL, config.ADMIN_PASSWORD, role="admin")
    logger.warning("Admin account %s created. Remove ADMIN_PASSWORD from backend/.env now.", config.ADMIN_EMAIL)
