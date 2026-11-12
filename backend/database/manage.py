"""Administrative commands. Run from the project root (with the virtual environment active):

    python -m backend.database.manage create-admin --email you@example.com --name "Your Name"
    python -m backend.database.manage promote --email existing.user@example.com
    python -m backend.database.manage adopt-legacy --email you@example.com
"""
import argparse
import getpass
import sys

from backend.auth_service import LOCAL_EMAIL, create_user
from backend.database.connection import SessionLocal
from backend.database.init_db import init_db
from backend.models.tables import AIConversation, CalculationRecord, Trip, User, UserSettings, Vehicle
from backend.security import validate_password_strength


def create_admin(db, email: str, name: str) -> int:
    if db.query(User).filter(User.email == email).first():
        print(f"A user with {email} already exists. Use the 'promote' command instead.")
        return 1
    password = getpass.getpass("Choose an admin password: ")
    if password != getpass.getpass("Repeat the password: "):
        print("Passwords do not match.")
        return 1
    try:
        validate_password_strength(password)
    except ValueError as exc:
        print(exc)
        return 1
    create_user(db, name, email, password, role="admin")
    print(f"Admin account created for {email}.")
    return 0


def promote(db, email: str) -> int:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"No user with e-mail {email}.")
        return 1
    user.role = "admin"
    db.commit()
    print(f"{email} is now an admin.")
    return 0


def adopt_legacy(db, email: str) -> int:
    """Give trips/vehicles recorded before accounts existed (FuelWise 1.0) to one real account."""
    legacy = db.query(User).filter(User.email == LOCAL_EMAIL).first()
    target = db.query(User).filter(User.email == email).first()
    if not legacy:
        print("There is no data from FuelWise 1.0 to move.")
        return 0
    if not target:
        print(f"No user with e-mail {email}. Create the account first.")
        return 1
    moved = {}
    for model in (Vehicle, Trip, CalculationRecord, AIConversation):
        moved[model.__tablename__] = db.query(model).filter(model.user_id == legacy.id).update({"user_id": target.id})
    legacy_settings = db.query(UserSettings).filter(UserSettings.user_id == legacy.id).first()
    if legacy_settings:
        if db.query(UserSettings).filter(UserSettings.user_id == target.id).first():
            db.delete(legacy_settings)
        else:
            legacy_settings.user_id = target.id
    db.commit()
    print("Moved records:", moved)
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="FuelWise administration")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create-admin"); p.add_argument("--email", required=True); p.add_argument("--name", default="Administrator")
    p = sub.add_parser("promote"); p.add_argument("--email", required=True)
    p = sub.add_parser("adopt-legacy"); p.add_argument("--email", required=True)
    args = parser.parse_args(argv)

    init_db()
    db = SessionLocal()
    try:
        email = args.email.strip().lower()
        if args.command == "create-admin":
            return create_admin(db, email, args.name.strip())
        if args.command == "promote":
            return promote(db, email)
        return adopt_legacy(db, email)
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
