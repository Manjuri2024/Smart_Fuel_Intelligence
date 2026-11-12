from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend import config
from backend.ai_engine import recommender
from backend.ai_engine.ml_model import predict_from_rows
from backend.ai_engine.providers import AIProviderError, get_provider
from backend.database.connection import get_db
from backend.models import schemas
from backend.models.tables import User
from backend.routes.deps import get_current_user, get_or_create_settings

router = APIRouter(tags=["ai"])


@router.post("/ai/chat")
def ai_chat(payload: schemas.ChatIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    settings = get_or_create_settings(db, user)
    provider = get_provider()
    if provider is None:
        return recommender.missing_key_response(db, user.id, payload.message, settings)
    try:
        result = recommender.chat(db, user.id, settings, provider, payload.message,
                                  [m.model_dump() for m in payload.history])
    except AIProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"configured": True, "provider": provider.name, **result}


@router.post("/ai/predict")
def predict_energy(payload: schemas.PredictIn, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    """Energy prediction. Uses machine learning only when enough trips exist; otherwise the formula."""
    settings = get_or_create_settings(db, user)
    rows = recommender.load_training_rows(db, user.id, payload.vehicle_type)
    return predict_from_rows(rows, payload.distance_km, payload.vehicle_type, payload.efficiency,
                             payload.avg_speed_kmph, settings.charging_loss_percent)
