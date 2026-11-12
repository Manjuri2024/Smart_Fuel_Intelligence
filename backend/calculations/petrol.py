"""Petrol vehicle calculations."""
from typing import Optional

from backend.calculations.validation import non_negative, percent, positive, r2


def available_fuel_litres(current_fuel_litres: Optional[float] = None,
                          fuel_level_percent: Optional[float] = None,
                          tank_capacity_litres: Optional[float] = None) -> Optional[float]:
    """Fuel currently in the tank, or None when it cannot be known reliably."""
    if current_fuel_litres is not None:
        return non_negative(current_fuel_litres, "Current fuel")
    if fuel_level_percent is not None and tank_capacity_litres is not None:
        return percent(fuel_level_percent, "Fuel level") / 100 * positive(tank_capacity_litres, "Tank capacity")
    return None


def calculate_petrol(distance_km, mileage_kmpl, price_per_litre,
                     current_fuel_litres=None, fuel_level_percent=None,
                     tank_capacity_litres=None) -> dict:
    distance = positive(distance_km, "Distance")
    mileage = positive(mileage_kmpl, "Mileage")
    price = positive(price_per_litre, "Petrol price")

    fuel_required = distance / mileage
    trip_cost = fuel_required * price
    cost_per_km = price / mileage

    available = available_fuel_litres(current_fuel_litres, fuel_level_percent, tank_capacity_litres)
    if available is None:
        range_km = sufficient = shortfall = None
        range_note = ("Remaining range needs the fuel left in litres, or the fuel level % "
                      "together with the tank capacity.")
    else:
        range_km = available * mileage
        sufficient = range_km >= distance
        shortfall = max(fuel_required - available, 0.0)
        range_note = "Range = available fuel x mileage."

    breakdown = [
        {"label": "Fuel required", "formula": f"{distance:g} km / {mileage:g} km/L = {fuel_required:.2f} L"},
        {"label": "Trip cost", "formula": f"{fuel_required:.2f} L x Rs {price:g}/L = Rs {trip_cost:.2f}"},
        {"label": "Cost per km", "formula": f"Rs {price:g} / {mileage:g} km/L = Rs {cost_per_km:.2f}/km"},
    ]
    if available is not None:
        breakdown.append({"label": "Remaining range",
                          "formula": f"{available:.2f} L x {mileage:g} km/L = {range_km:.1f} km"})

    return {
        "vehicle_type": "petrol",
        "distance_km": distance,
        "energy_required": r2(fuel_required), "energy_unit": "L",
        "trip_cost": r2(trip_cost),
        "cost_per_km": r2(cost_per_km),
        "available_energy": r2(available),
        "remaining_range_km": None if range_km is None else round(range_km, 1),
        "range_note": range_note,
        "sufficient": sufficient,
        "shortfall": r2(shortfall),
        "breakdown": breakdown,
    }
