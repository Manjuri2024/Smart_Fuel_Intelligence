from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.calculations.range_calc import remaining_range
from backend.database.connection import get_db
from backend.models import schemas
from backend.models.tables import User, Vehicle
from backend.routes.deps import account_required_to_save, get_current_user

router = APIRouter(tags=["vehicles"])


def vehicle_to_dict(v: Vehicle) -> dict:
    return {"id": v.id, "name": v.name, "vehicle_type": v.vehicle_type, "efficiency": v.efficiency,
            "tank_capacity_litres": v.tank_capacity_litres, "battery_capacity_kwh": v.battery_capacity_kwh,
            "current_level_percent": v.current_level_percent,
            "remaining_range_km": remaining_range(v.vehicle_type, v.efficiency, v.current_level_percent,
                                                  v.tank_capacity_litres, v.battery_capacity_kwh)}


@router.get("/vehicles")
def list_vehicles(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    vehicles = db.query(Vehicle).filter(Vehicle.user_id == user.id).order_by(Vehicle.id).all()
    return [vehicle_to_dict(v) for v in vehicles]


@router.post("/vehicles", status_code=201)
def create_vehicle(payload: schemas.VehicleIn, db: Session = Depends(get_db), user: User = Depends(account_required_to_save)):
    vehicle = Vehicle(user_id=user.id, **payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle_to_dict(vehicle)


@router.put("/vehicles/{vehicle_id}")
def update_vehicle(vehicle_id: int, payload: schemas.VehicleIn, db: Session = Depends(get_db),
                   user: User = Depends(account_required_to_save)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id, Vehicle.user_id == user.id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    for key, value in payload.model_dump().items():
        setattr(vehicle, key, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle_to_dict(vehicle)
