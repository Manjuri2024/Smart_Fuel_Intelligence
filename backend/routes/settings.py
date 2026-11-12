from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models import schemas
from backend.models.tables import User
from backend.routes.deps import get_current_user, get_or_create_settings

router = APIRouter(tags=["settings"])

_SETTING_FIELDS = ["city", "theme", "notifications_enabled", "email_alerts", "price_alerts", "share_analytics",
                   "store_chat_history", "default_petrol_price", "default_electricity_tariff",
                   "default_petrol_mileage", "default_ev_efficiency", "charging_loss_percent"]


def _to_dict(user: User, settings) -> dict:
    return {"full_name": user.name, "email": user.email, "phone": user.phone, **{f: getattr(settings, f) for f in _SETTING_FIELDS}}


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _to_dict(user, get_or_create_settings(db, user))


@router.put("/settings")
def update_settings(payload: schemas.SettingsIn, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    email = payload.email.lower()
    clash = db.query(User).filter(User.email == email, User.id != user.id).first()
    if clash:
        raise HTTPException(status_code=409, detail="That email is already used by another account.")
    settings = get_or_create_settings(db, user)
    user.name, user.email, user.phone = payload.full_name.strip(), email, payload.phone or None
    for field in _SETTING_FIELDS:
        setattr(settings, field, getattr(payload, field))
    db.commit()
    db.refresh(user)
    db.refresh(settings)
    return _to_dict(user, settings)
