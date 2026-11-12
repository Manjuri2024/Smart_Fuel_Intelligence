import json

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.calculations.comparison import compare_vehicles
from backend.calculations.electric import calculate_electric
from backend.calculations.petrol import calculate_petrol
from backend.database.connection import get_db
from backend.models import schemas
from backend.models.tables import CalculationRecord, User
from backend.routes.deps import get_optional_user

router = APIRouter(tags=["calculations"])


def _record(db: Session, user: Optional[User], kind: str, inputs: dict, result: dict) -> None:
    """Save the calculation for signed-in users only; a storage problem must never block the answer."""
    if user is None:
        return
    try:
        db.add(CalculationRecord(user_id=user.id, kind=kind, inputs_json=json.dumps(inputs),
                                 result_json=json.dumps(result, default=str)))
        db.commit()
    except Exception:
        db.rollback()


def _run(db, user, kind, func, payload):
    data = payload.model_dump()
    try:
        result = func(**data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    _record(db, user, kind, data, result)
    return result


@router.post("/calculate/petrol")
def petrol(payload: schemas.PetrolCalcIn, db: Session = Depends(get_db), user: Optional[User] = Depends(get_optional_user)):
    return _run(db, user, "petrol", calculate_petrol, payload)


@router.post("/calculate/electric")
def electric(payload: schemas.ElectricCalcIn, db: Session = Depends(get_db), user: Optional[User] = Depends(get_optional_user)):
    return _run(db, user, "electric", calculate_electric, payload)


@router.post("/compare")
def compare(payload: schemas.CompareIn, db: Session = Depends(get_db), user: Optional[User] = Depends(get_optional_user)):
    return _run(db, user, "compare", compare_vehicles, payload)
