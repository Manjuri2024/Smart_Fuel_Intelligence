"""Optional: add clearly labelled DEMO trips to ONE existing account so its charts have something to show.

    python -m backend.database.seed_demo --email you@example.com           (add demo data)
    python -m backend.database.seed_demo --email you@example.com --clear   (remove it again)
"""
import argparse
import random
from datetime import date, timedelta

from backend.database.connection import SessionLocal
from backend.database.init_db import init_db
from backend.models.tables import ElectricityTariff, FuelPrice, Trip, User, Vehicle
from backend.routes.deps import get_or_create_settings

DEMO = "DEMO DATA"


def main(email: str, clear: bool = False) -> None:
    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email.strip().lower()).first()
        if not user:
            print(f"No account with e-mail {email}. Create it in the app first.")
            return
        db.query(Trip).filter(Trip.user_id == user.id, Trip.notes.like(f"{DEMO}%")).delete(synchronize_session=False)
        db.query(Vehicle).filter(Vehicle.user_id == user.id, Vehicle.name.like("Demo %")).delete(synchronize_session=False)
        if clear:
            db.commit()
            print("Demo data removed.")
            return
        settings = get_or_create_settings(db, user)
        petrol = Vehicle(user_id=user.id, name="Demo Petrol Scooter", vehicle_type="petrol", efficiency=45,
                         tank_capacity_litres=5, current_level_percent=68)
        ev = Vehicle(user_id=user.id, name="Demo Electric Scooter", vehicle_type="electric", efficiency=40,
                     battery_capacity_kwh=3, current_level_percent=80)
        db.add_all([petrol, ev, FuelPrice(price_per_litre=settings.default_petrol_price, region="Demo"),
                    ElectricityTariff(tariff_per_kwh=settings.default_electricity_tariff, region="Demo")])
        db.flush()
        rng = random.Random(42)
        for _ in range(40):
            is_ev = rng.random() < 0.5
            vehicle = ev if is_ev else petrol
            distance = round(rng.uniform(5, 60), 1)
            energy = distance / (vehicle.efficiency * rng.uniform(0.9, 1.1))
            if is_ev:
                energy /= 1 - settings.charging_loss_percent / 100
            price = settings.default_electricity_tariff if is_ev else settings.default_petrol_price
            db.add(Trip(user_id=user.id, vehicle_id=vehicle.id, trip_date=date.today() - timedelta(days=rng.randint(0, 39)),
                        vehicle_type=vehicle.vehicle_type, distance_km=distance, energy_used=round(energy, 3),
                        price_per_unit=price, cost=round(energy * price, 2),
                        avg_speed_kmph=round(rng.uniform(20, 45), 1), notes=f"{DEMO} (safe to delete)"))
        db.commit()
        print("Added 2 demo vehicles and 40 demo trips.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--clear", action="store_true")
    args = parser.parse_args()
    main(args.email, args.clear)
