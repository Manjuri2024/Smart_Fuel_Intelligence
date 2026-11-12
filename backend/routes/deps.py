"""Shared route dependencies.

Who is calling?
  * No valid session cookie  -> a GUEST (anonymous). Guests may only use the public/demo endpoints.
  * Valid session            -> a signed-in "user" or "admin". The backend decides the role, never the browser.
"""
from typing import Optional

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from backend import config
from backend.auth_service import find_user_by_session
from backend.database.connection import get_db
from backend.models.tables import User, UserSettings

SAVE_MESSAGE = "Create a free FuelWise account to save your trips and vehicle information."


def get_or_create_settings(db: Session, user: User) -> UserSettings:
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    if not settings:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    """The signed-in user, or None for guests. An invalid or expired session counts as a guest."""
    return find_user_by_session(db, request.cookies.get(config.COOKIE_NAME))


def get_current_user(user: Optional[User] = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    return user


def account_required_to_save(user: Optional[User] = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail=SAVE_MESSAGE)
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator access is required.")
    return user
