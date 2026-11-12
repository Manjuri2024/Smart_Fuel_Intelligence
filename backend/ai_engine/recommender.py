"""Builds grounded facts from real backend data and asks the AI provider to explain them."""
import json
import re
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.ai_engine.providers import LLMProvider
from backend.calculations.comparison import compare_vehicles
from backend.calculations.range_calc import remaining_range
from backend.models.tables import AIConversation, Trip, UserSettings, Vehicle

SYSTEM_PROMPT = (
    "You are FuelWise AI, an assistant for petrol and electric vehicle running costs in India (amounts in rupees). "
    "Answer ONLY from the FACTS JSON supplied with the user's message. Never invent fuel prices, electricity tariffs, "
    "mileage, efficiency, trips or calculation results. If a number you need is not in FACTS, say exactly which "
    "value the user should provide. Never compare km/kWh with km/L directly; compare costs in rupees. "
    "Be concise and practical (under 150 words)."
)

_DISTANCE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:km|kilomet)", re.IGNORECASE)


def build_facts(db: Session, user_id: int, message: str, settings: UserSettings) -> Dict:
    facts: Dict = {
        "user_defaults": {
            "petrol_price_per_litre": settings.default_petrol_price,
            "electricity_tariff_per_kwh": settings.default_electricity_tariff,
            "petrol_mileage_kmpl": settings.default_petrol_mileage,
            "ev_efficiency_km_per_kwh": settings.default_ev_efficiency,
            "charging_loss_percent": settings.charging_loss_percent,
        }
    }
    rows = db.query(Trip.vehicle_type, func.count(Trip.id), func.sum(Trip.distance_km), func.sum(Trip.cost)) \
        .filter(Trip.user_id == user_id).group_by(Trip.vehicle_type).all()
    facts["trip_summary"] = [{"vehicle_type": t, "trips": n, "distance_km": round(d or 0, 1),
                              "total_cost": round(c or 0, 2),
                              "cost_per_km": round((c or 0) / d, 2) if d else None} for t, n, d, c in rows]
    recent = db.query(Trip).filter(Trip.user_id == user_id).order_by(Trip.trip_date.desc()).limit(5).all()
    facts["recent_trips"] = [{"date": str(t.trip_date), "vehicle_type": t.vehicle_type,
                              "distance_km": t.distance_km, "cost": t.cost} for t in recent]
    vehicles = db.query(Vehicle).filter(Vehicle.user_id == user_id).all()
    facts["vehicles"] = [{"name": v.name, "type": v.vehicle_type, "efficiency": v.efficiency,
                          "level_percent": v.current_level_percent,
                          "estimated_range_km": remaining_range(v.vehicle_type, v.efficiency, v.current_level_percent,
                                                                v.tank_capacity_litres, v.battery_capacity_kwh)}
                         for v in vehicles]

    match = _DISTANCE.search(message)
    if match:
        distance = float(match.group(1))
        if 0 < distance <= 100000:
            facts["comparison_for_requested_distance"] = compare_vehicles(
                distance, settings.default_ev_efficiency, settings.default_electricity_tariff,
                settings.default_petrol_mileage, settings.default_petrol_price, settings.charging_loss_percent)
    return facts


def chat(db: Session, user_id: int, settings: UserSettings, provider: LLMProvider,
         message: str, history: List[Dict[str, str]]) -> Dict:
    facts = build_facts(db, user_id, message, settings)
    grounded = f"FACTS (computed by FuelWise, authoritative):\n{json.dumps(facts, default=str)}\n\nQUESTION: {message}"
    messages = [{"role": h["role"], "content": h["content"]} for h in history[-8:]]
    messages.append({"role": "user", "content": grounded})
    reply = provider.generate(SYSTEM_PROMPT, messages)

    if settings.store_chat_history:
        db.add(AIConversation(user_id=user_id, role="user", content=message))
        db.add(AIConversation(user_id=user_id, role="assistant", content=reply))
        db.commit()
    return {"reply": reply, "facts": facts}


def missing_key_response(db: Session, user_id: int, message: str, settings: UserSettings) -> Dict:
    return {"configured": False, "provider": None, "facts": build_facts(db, user_id, message, settings),
            "reply": ("The AI assistant is not configured. Add GEMINI_API_KEY to backend/.env "
                      "(see backend/.env.example) and restart the backend. The calculator and comparison "
                      "pages work without it.")}


def load_training_rows(db: Session, user_id: int, vehicle_type: str) -> List[Dict]:
    trips = db.query(Trip).filter(Trip.user_id == user_id, Trip.vehicle_type == vehicle_type).all()
    return [{"distance_km": t.distance_km, "energy_used": t.energy_used, "avg_speed_kmph": t.avg_speed_kmph}
            for t in trips if t.energy_used and t.distance_km]
