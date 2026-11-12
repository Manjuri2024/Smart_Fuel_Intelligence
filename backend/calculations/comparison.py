"""EV vs petrol comparison. Compares money (Rs), never km/kWh against km/L."""
from backend.calculations.electric import calculate_electric
from backend.calculations.petrol import calculate_petrol


def compare_vehicles(distance_km, ev_efficiency_km_per_kwh, tariff_per_kwh,
                     petrol_mileage_kmpl, petrol_price_per_litre,
                     charging_loss_percent: float = 10.0) -> dict:
    ev = calculate_electric(distance_km, ev_efficiency_km_per_kwh, tariff_per_kwh, charging_loss_percent)
    petrol = calculate_petrol(distance_km, petrol_mileage_kmpl, petrol_price_per_litre)

    ev_cost, petrol_cost = ev["trip_cost"], petrol["trip_cost"]
    difference = round(abs(petrol_cost - ev_cost), 2)
    if abs(petrol_cost - ev_cost) < 0.005:
        cheaper, savings_percent = "equal", 0.0
    elif ev_cost < petrol_cost:
        cheaper, savings_percent = "electric", (petrol_cost - ev_cost) / petrol_cost * 100
    else:
        cheaper, savings_percent = "petrol", (ev_cost - petrol_cost) / ev_cost * 100

    return {
        "distance_km": ev["distance_km"],
        "electric": {"energy_required": ev["energy_required"], "energy_unit": "kWh",
                     "trip_cost": ev_cost, "cost_per_km": ev["cost_per_km"]},
        "petrol": {"energy_required": petrol["energy_required"], "energy_unit": "L",
                   "trip_cost": petrol_cost, "cost_per_km": petrol["cost_per_km"]},
        "cost_difference": difference,
        "savings_percent": round(savings_percent, 1),
        "cheaper_option": cheaper,
        "charging_loss_percent": ev["charging_loss_percent"],
        "note": "Costs are compared in rupees. km/kWh and km/L are different units and are never compared directly.",
    }
