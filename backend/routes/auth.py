import hmac
import logging
import secrets
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend import config, google_oauth, mailer
from backend.auth_service import (LOCAL_EMAIL, attach_session_cookie, client_ip, clear_session_cookie, config_bool,
                                  create_reset_token, create_session, create_user, get_config, log_event,
                                  revoke_all_sessions, revoke_session, too_many_failures, use_reset_token,
                                  user_to_dict)
from backend.database.connection import get_db
from backend.models import schemas
from backend.models.tables import OAuthAccount, User
from backend.routes.deps import get_current_user
from backend.security import (burn_password_time, hash_password, password_needs_rehash, verify_password)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("fuelwise.auth")

DUPLICATE_MESSAGE = "An account with this email already exists. Try signing in instead."
RESET_MESSAGE = "If an account exists for that email, a password reset link has been sent."
OAUTH_STATE_COOKIE = "fw_oauth_state"


@router.post("/register", status_code=201)
def register(payload: schemas.RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    if not config_bool(get_config(db, "registration_open")):
        raise HTTPException(status_code=403, detail="New registrations are currently closed.")
    email = payload.email.strip().lower()
    if email == LOCAL_EMAIL or db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail=DUPLICATE_MESSAGE)
    try:
        user = create_user(db, payload.name.strip(), email, payload.password, payload.phone)  # role is ALWAYS "user"
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=DUPLICATE_MESSAGE)
    attach_session_cookie(response, create_session(db, user, remember=False), remember=False)
    log_event(db, "register", user.id, ip=client_ip(request))
    return {"user": user_to_dict(user)}


@router.post("/login")
def login(payload: schemas.LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    ip = client_ip(request)
    if too_many_failures(db, email):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please wait a few minutes and try again.")
    user = db.query(User).filter(User.email == email).first()
    if user:
        valid = verify_password(payload.password, user.password_hash)
    else:
        burn_password_time(payload.password)
        valid = False
    if not valid:
        log_event(db, "login_failed", user.id if user else None, detail=email, ip=ip)
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if user.account_status != "active":
        raise HTTPException(status_code=403, detail="This account has been disabled. Please contact the administrator.")
    if password_needs_rehash(user.password_hash):               # upgrade older hashes to Argon2
        user.password_hash = hash_password(payload.password)
    attach_session_cookie(response, create_session(db, user, payload.remember), payload.remember)
    log_event(db, "login", user.id, ip=ip)
    return {"user": user_to_dict(user)}


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(config.COOKIE_NAME)
    revoke_session(db, raw)
    clear_session_cookie(response)
    return {"message": "Signed out."}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"user": user_to_dict(user)}


def _send_reset(email: str, link: str) -> None:
    mailer.send_reset_email(email, link)


@router.post("/forgot-password")
def forgot_password(payload: schemas.ForgotPasswordIn, request: Request, background: BackgroundTasks,
                    db: Session = Depends(get_db)):
    """Always answers the same way, so nobody can find out which e-mails are registered."""
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user and user.account_status == "active" and user.email != LOCAL_EMAIL and user.auth_provider == "local":
        raw = create_reset_token(db, user)
        log_event(db, "password_reset_requested", user.id, ip=client_ip(request))
        background.add_task(_send_reset, user.email, f"{config.FRONTEND_URL}/reset-password?token={raw}")
    return {"message": RESET_MESSAGE}


@router.post("/reset-password")
def reset_password(payload: schemas.ResetPasswordIn, request: Request, db: Session = Depends(get_db)):
    user = use_reset_token(db, payload.token)
    if not user:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    revoke_all_sessions(db, user.id)                              # sign out everywhere
    log_event(db, "password_reset", user.id, ip=client_ip(request))
    return {"message": "Your password has been updated. You can now sign in."}


# ---- Google OAuth ----------------------------------------------------------------
def _login_error(code: str) -> RedirectResponse:
    response = RedirectResponse(f"{config.FRONTEND_URL}/login?error={code}", status_code=303)
    response.delete_cookie(OAUTH_STATE_COOKIE, path="/")
    return response


@router.get("/google")
def google_login():
    if not google_oauth.is_configured():
        return _login_error("google_not_configured")
    state = secrets.token_urlsafe(24)
    response = RedirectResponse(google_oauth.build_authorization_url(state), status_code=302)
    response.set_cookie(OAUTH_STATE_COOKIE, state, max_age=600, httponly=True, secure=config.COOKIE_SECURE,
                        samesite="lax", path="/")
    return response


@router.get("/google/callback")
def google_callback(request: Request, code: Optional[str] = None, state: Optional[str] = None,
                    error: Optional[str] = None, db: Session = Depends(get_db)):
    if not google_oauth.is_configured():
        return _login_error("google_not_configured")
    if error:
        return _login_error("google_cancelled" if error == "access_denied" else "google_failed")
    cookie_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if not code or not state or not cookie_state or not hmac.compare_digest(state, cookie_state):
        return _login_error("google_failed")
    try:
        info = google_oauth.fetch_user_info(code)
    except google_oauth.GoogleAuthError as exc:
        logger.warning("Google sign-in failed: %s", exc)
        return _login_error("google_failed")

    linked = db.query(OAuthAccount).filter(OAuthAccount.provider == "google", OAuthAccount.provider_user_id == info["sub"]).first()
    if linked:
        user = db.get(User, linked.user_id)
    else:
        # A password account with this e-mail is never silently taken over (its e-mail was not verified).
        if info["email"] == LOCAL_EMAIL or db.query(User).filter(User.email == info["email"]).first():
            return _login_error("google_email_exists")
        if not config_bool(get_config(db, "registration_open")):
            return _login_error("registration_closed")
        try:
            user = create_user(db, info["name"], info["email"], None, provider="google")
            db.add(OAuthAccount(user_id=user.id, provider="google", provider_user_id=info["sub"], email=info["email"]))
            db.commit()
        except IntegrityError:
            db.rollback()
            return _login_error("google_failed")
        log_event(db, "register", user.id, detail="google", ip=client_ip(request))
    if not user or user.account_status != "active":
        return _login_error("account_disabled")

    response = RedirectResponse(f"{config.FRONTEND_URL}/dashboard", status_code=303)
    attach_session_cookie(response, create_session(db, user, remember=False), remember=False)
    response.delete_cookie(OAUTH_STATE_COOKIE, path="/")
    log_event(db, "login", user.id, detail="google", ip=client_ip(request))
    return response
