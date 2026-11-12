"""In-memory DEMO data for guests. Nothing here is ever written to the database."""
import random
from datetime import date, timedelta
from types import SimpleNamespace


def demo_settings():
    return SimpleNamespace(default_petrol_price=105.0, default_electricity_tariff=8.0,
                           default_petrol_mileage=45.0, default_ev_efficiency=40.0, charging_loss_percent=10.0)


def demo_vehicle():
    return SimpleNamespace(name="Demo Electric Scooter", vehicle_type="electric", efficiency=40.0,
                           tank_capacity_litres=None, battery_capacity_kwh=3.0, current_level_percent=72.0)


def demo_trips(today: date = None):
    today = today or date.today()
    rng = random.Random(7)
    settings, trips = demo_settings(), []
    for i in range(36):
        electric = rng.random() < 0.5
        distance = round(rng.uniform(5, 60), 1)
        efficiency = (settings.default_ev_efficiency if electric else settings.default_petrol_mileage) * rng.uniform(0.9, 1.1)
        energy = distance / efficiency
        if electric:
            energy /= 1 - settings.charging_loss_percent / 100
        price = settings.default_electricity_tariff if electric else settings.default_petrol_price
        trips.append(SimpleNamespace(
            id=-(i + 1), trip_date=today - timedelta(days=rng.randint(0, 35)),
            vehicle_type="electric" if electric else "petrol", distance_km=distance,
            energy_used=round(energy, 3), price_per_unit=price, cost=round(energy * price, 2),
            avg_speed_kmph=round(rng.uniform(20, 45), 1), vehicle_id=None, vehicle=None, notes="DEMO DATA"))
    return trips
