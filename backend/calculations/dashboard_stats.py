"""Dashboard statistics. Works on any objects shaped like trips, so it serves both real users and guest demo data."""
from collections import defaultdict
from datetime import date, timedelta

from backend import config
from backend.calculations.range_calc import remaining_range


def trip_to_dict(t) -> dict:
    unit = "kWh" if t.vehicle_type == "electric" else "L"
    return {"id": t.id, "trip_date": t.trip_date.isoformat(), "vehicle_type": t.vehicle_type,
            "distance_km": t.distance_km, "energy_used": t.energy_used, "energy_unit": unit,
            "price_per_unit": t.price_per_unit, "cost": t.cost,
            "cost_per_km": round(t.cost / t.distance_km, 2) if t.distance_km else None,
            "avg_speed_kmph": t.avg_speed_kmph, "vehicle_id": t.vehicle_id,
            "vehicle_name": t.vehicle.name if t.vehicle else None, "notes": t.notes}


def build_dashboard(trips, settings, vehicle, days: int = 7, today: date = None) -> dict:
    today = today or date.today()
    litres_avoided = money_saved = co2_saved = 0.0
    by_type = {"petrol": defaultdict(float), "electric": defaultdict(float)}
    for t in trips:
        agg = by_type[t.vehicle_type]
        agg["trips"] += 1
        agg["distance_km"] += t.distance_km
        agg["cost"] += t.cost
        if t.vehicle_type == "electric":
            litres = t.distance_km / settings.default_petrol_mileage
            litres_avoided += litres
            money_saved += litres * settings.default_petrol_price - t.cost
            co2_saved += litres * config.PETROL_CO2_KG_PER_LITRE - t.energy_used * config.GRID_CO2_KG_PER_KWH

    total_distance = sum(t.distance_km for t in trips)
    total_cost = sum(t.cost for t in trips)

    window = [today - timedelta(days=i) for i in range(days - 1, -1, -1)]
    trend = {d: {"petrol": 0.0, "electric": 0.0} for d in window}
    monthly = defaultdict(lambda: {"petrol": 0.0, "electric": 0.0})
    for t in trips:
        if t.trip_date in trend:
            trend[t.trip_date][t.vehicle_type] += t.cost
        monthly[t.trip_date.strftime("%Y-%m")][t.vehicle_type] += t.cost
    cost_trend = [{"date": d.isoformat(), "label": d.strftime("%a") if days <= 7 else d.strftime("%d %b"),
                   "petrol": round(v["petrol"], 2), "electric": round(v["electric"], 2)} for d, v in trend.items()]
    monthly_expenses = [{"month": m, "petrol": round(v["petrol"], 2), "electric": round(v["electric"], 2),
                         "total": round(v["petrol"] + v["electric"], 2)} for m, v in sorted(monthly.items())[-6:]]

    status = {"has_vehicle": False}
    if vehicle:
        status = {"has_vehicle": True, "name": vehicle.name, "vehicle_type": vehicle.vehicle_type,
                  "level_percent": vehicle.current_level_percent,
                  "remaining_range_km": remaining_range(vehicle.vehicle_type, vehicle.efficiency,
                                                        vehicle.current_level_percent, vehicle.tank_capacity_litres,
                                                        vehicle.battery_capacity_kwh)}
    recent = sorted(trips, key=lambda t: (t.trip_date, t.id), reverse=True)[:5]

    return {
        "has_data": bool(trips),
        "is_demo": False,
        "summary": {"total_trips": len(trips), "total_cost": round(total_cost, 2),
                    "total_distance_km": round(total_distance, 1),
                    "petrol_litres_avoided": round(litres_avoided, 2), "money_saved": round(money_saved, 2),
                    "co2_reduced_kg": round(max(co2_saved, 0.0), 2)},
        "assumptions": {"petrol_co2_kg_per_litre": config.PETROL_CO2_KG_PER_LITRE,
                        "grid_co2_kg_per_kwh": config.GRID_CO2_KG_PER_KWH,
                        "comparison_petrol_mileage_kmpl": settings.default_petrol_mileage,
                        "comparison_petrol_price": settings.default_petrol_price},
        "cost_trend": cost_trend,
        "by_vehicle_type": [{"vehicle_type": k, "trips": int(v["trips"]), "distance_km": round(v["distance_km"], 1),
                             "cost": round(v["cost"], 2),
                             "cost_per_km": round(v["cost"] / v["distance_km"], 2) if v["distance_km"] else None}
                            for k, v in by_type.items()],
        "monthly_expenses": monthly_expenses,
        "recent_trips": [trip_to_dict(t) for t in recent],
        "vehicle_status": status,
    }
