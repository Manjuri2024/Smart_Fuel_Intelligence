from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.calculations.dashboard_stats import build_dashboard
from backend.database.connection import get_db
from backend.models.tables import Trip, User, Vehicle
from backend.routes.deps import get_current_user, get_or_create_settings

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
def dashboard(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    settings = get_or_create_settings(db, user)
    trips = db.query(Trip).filter(Trip.user_id == user.id).all()
    vehicle = db.query(Vehicle).filter(Vehicle.user_id == user.id).order_by(Vehicle.id).first()
    return build_dashboard(trips, settings, vehicle, days)
