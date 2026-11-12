from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models import schemas
from backend.models.tables import Trip, User, Vehicle
from backend.calculations.dashboard_stats import trip_to_dict
from backend.routes.deps import account_required_to_save, get_current_user

router = APIRouter(tags=["trips"])


@router.get("/trips")
def list_trips(search: Optional[str] = None, vehicle_type: Optional[schemas.VehicleType] = None,
               date_from: Optional[date] = None, date_to: Optional[date] = None,
               page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
               db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(Trip).filter(Trip.user_id == user.id)
    if vehicle_type:
        query = query.filter(Trip.vehicle_type == vehicle_type)
    if date_from:
        query = query.filter(Trip.trip_date >= date_from)
    if date_to:
        query = query.filter(Trip.trip_date <= date_to)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(Trip.notes.ilike(like), Trip.vehicle_type.ilike(like),
                                 func.strftime("%Y-%m-%d", Trip.trip_date).like(like)))

    total, distance, cost = query.with_entities(func.count(Trip.id), func.coalesce(func.sum(Trip.distance_km), 0),
                                                func.coalesce(func.sum(Trip.cost), 0)).one()
    items = query.order_by(Trip.trip_date.desc(), Trip.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [trip_to_dict(t) for t in items], "total": total, "page": page, "page_size": page_size,
            "summary": {"total_trips": total, "total_distance_km": round(distance, 1),
                        "total_cost": round(cost, 2),
                        "avg_cost_per_km": round(cost / distance, 2) if distance else None}}


@router.post("/trips", status_code=201)
def create_trip(payload: schemas.TripIn, db: Session = Depends(get_db), user: User = Depends(account_required_to_save)):
    data = payload.model_dump()
    if data["vehicle_id"] is not None:
        vehicle = db.query(Vehicle).filter(Vehicle.id == data["vehicle_id"], Vehicle.user_id == user.id).first()
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found.")
        if vehicle.vehicle_type != data["vehicle_type"]:
            raise HTTPException(status_code=422, detail="Vehicle type does not match the selected vehicle.")
        if data["energy_used"] is None:
            data["energy_used"] = round(data["distance_km"] / vehicle.efficiency, 3)
    if data["energy_used"] is None:
        raise HTTPException(status_code=422, detail="Provide energy_used, or choose a vehicle so it can be estimated.")
    if data["cost"] is None:
        if data["price_per_unit"] is None:
            raise HTTPException(status_code=422, detail="Provide cost, or price_per_unit so the cost can be calculated.")
        data["cost"] = round(data["energy_used"] * data["price_per_unit"], 2)
    trip = Trip(user_id=user.id, **data)
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip_to_dict(trip)


@router.get("/trips/{trip_id}")
def get_trip(trip_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.user_id == user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
    return trip_to_dict(trip)
