"""Admin area. Every endpoint requires an authenticated user whose role is "admin" (checked on the backend)."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth_service import (LOCAL_EMAIL, config_bool, get_config, log_event, revoke_all_sessions, set_config, utcnow)
from backend.database.connection import get_db
from backend.models import schemas
from backend.models.tables import ActivityLog, AuthSession, Trip, User, Vehicle
from backend.routes.deps import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
def stats(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    now = utcnow()
    real = User.email != LOCAL_EMAIL
    users = db.query(func.count(User.id)).filter(real)
    day = now - timedelta(days=1)
    events = db.query(func.count(ActivityLog.id))
    return {
        "total_users": users.scalar(),
        "active_users": users.filter(User.account_status == "active").scalar(),
        "disabled_users": users.filter(User.account_status == "disabled").scalar(),
        "admins": users.filter(User.role == "admin").scalar(),
        "google_users": users.filter(User.auth_provider == "google").scalar(),
        "new_users_7_days": users.filter(User.created_at >= now - timedelta(days=7)).scalar(),
        "total_trips": db.query(func.count(Trip.id)).scalar(),
        "total_vehicles": db.query(func.count(Vehicle.id)).scalar(),
        "active_sessions": db.query(func.count(AuthSession.id)).filter(
            AuthSession.revoked_at.is_(None), AuthSession.expires_at > now).scalar(),
        "logins_24h": events.filter(ActivityLog.event == "login", ActivityLog.created_at >= day).scalar(),
        "failed_logins_24h": events.filter(ActivityLog.event == "login_failed", ActivityLog.created_at >= day).scalar(),
    }


@router.get("/users")
def list_users(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=50), db: Session = Depends(get_db),
               _admin: User = Depends(require_admin)):
    query = db.query(User).filter(User.email != LOCAL_EMAIL)
    total = query.count()
    rows = query.order_by(User.id).offset((page - 1) * page_size).limit(page_size).all()
    items = [{"id": u.id, "name": u.name, "email": u.email, "role": u.role, "auth_provider": u.auth_provider,
              "account_status": u.account_status, "created_at": u.created_at.isoformat() if u.created_at else None,
              "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
              "trip_count": db.query(func.count(Trip.id)).filter(Trip.user_id == u.id).scalar()} for u in rows]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.patch("/users/{user_id}")
def update_user(user_id: int, payload: schemas.AdminUserUpdate, db: Session = Depends(get_db),
                admin: User = Depends(require_admin)):
    target = db.get(User, user_id)
    if not target or target.email == LOCAL_EMAIL:
        raise HTTPException(status_code=404, detail="User not found.")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot change your own account status.")
    target.account_status = payload.account_status
    db.commit()
    if payload.account_status == "disabled":
        revoke_all_sessions(db, target.id)
    log_event(db, f"admin_{payload.account_status}_user", admin.id, detail=f"user {target.id}")
    return {"id": target.id, "account_status": target.account_status}


@router.get("/activity")
def activity(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    rows = db.query(ActivityLog).order_by(ActivityLog.id.desc()).limit(limit).all()
    emails = {u.id: u.email for u in db.query(User).filter(User.id.in_({r.user_id for r in rows if r.user_id})).all()}
    return [{"id": r.id, "event": r.event, "user_email": emails.get(r.user_id), "detail": r.detail,
             "ip_address": r.ip_address, "created_at": r.created_at.isoformat()} for r in rows]


@router.get("/config")
def get_app_config(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return {"registration_open": config_bool(get_config(db, "registration_open"))}


@router.put("/config")
def put_app_config(payload: schemas.AdminConfigIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    set_config(db, "registration_open", "true" if payload.registration_open else "false")
    log_event(db, "admin_config_changed", admin.id, detail=f"registration_open={payload.registration_open}")
    return {"registration_open": payload.registration_open}
