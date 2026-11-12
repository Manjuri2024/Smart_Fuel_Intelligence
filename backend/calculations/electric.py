"""Electric vehicle calculations (charging losses included in cost)."""
from typing import Optional

from backend.calculations.validation import loss_percent, percent, positive, r2


def calculate_electric(distance_km, efficiency_km_per_kwh, tariff_per_kwh,
                       charging_loss_percent: float = 10.0,
                       battery_percent: Optional[float] = None,
                       battery_capacity_kwh: Optional[float] = None) -> dict:
    distance = positive(distance_km, "Distance")
    efficiency = positive(efficiency_km_per_kwh, "EV efficiency")
    tariff = positive(tariff_per_kwh, "Electricity tariff")
    loss = loss_percent(charging_loss_percent)

    battery_energy = distance / efficiency                      # kWh used by the motor/battery
    drawn_energy = battery_energy / (1 - loss / 100)            # kWh drawn from the charging supply
    trip_cost = drawn_energy * tariff
    effective_efficiency = efficiency * (1 - loss / 100)        # km per kWh drawn from the supply
    cost_per_km = tariff / effective_efficiency

    # Battery % alone is not enough: capacity is required for a reliable range.
    if battery_percent is not None and battery_capacity_kwh is not None:
        available = percent(battery_percent, "Battery") / 100 * positive(battery_capacity_kwh, "Battery capacity")
        range_km = available * efficiency
        sufficient = range_km >= distance
        shortfall = max(battery_energy - available, 0.0)
        range_note = "Range = battery % x battery capacity x efficiency (usable energy assumed equal to rated)."
    else:
        available = range_km = sufficient = shortfall = None
        range_note = "Remaining range needs both battery % and battery capacity (kWh)."

    breakdown = [
        {"label": "Energy used by the vehicle", "formula": f"{distance:g} km / {efficiency:g} km/kWh = {battery_energy:.2f} kWh"},
        {"label": "Energy drawn from supply", "formula": f"{battery_energy:.2f} kWh / (1 - {loss:g}%) = {drawn_energy:.2f} kWh"},
        {"label": "Trip cost", "formula": f"{drawn_energy:.2f} kWh x Rs {tariff:g}/kWh = Rs {trip_cost:.2f}"},
        {"label": "Cost per km", "formula": f"Rs {tariff:g} / {effective_efficiency:.2f} km/kWh = Rs {cost_per_km:.2f}/km"},
    ]
    if range_km is not None:
        breakdown.append({"label": "Remaining range", "formula": f"{available:.2f} kWh x {efficiency:g} km/kWh = {range_km:.1f} km"})

    return {
        "vehicle_type": "electric",
        "distance_km": distance,
        "energy_required": r2(drawn_energy), "energy_unit": "kWh",
        "energy_used_by_vehicle": r2(battery_energy),
        "charging_loss_percent": loss,
        "trip_cost": r2(trip_cost),
        "cost_per_km": r2(cost_per_km),
        "available_energy": r2(available),
        "remaining_range_km": None if range_km is None else round(range_km, 1),
        "range_note": range_note,
        "sufficient": sufficient,
        "shortfall": r2(shortfall),
        "breakdown": breakdown,
    }
