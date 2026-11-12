"""Create the SQLite database/tables and upgrade older databases. Safe to run many times.

Run from the project root:   python -m backend.database.init_db
"""
from backend.database.connection import Base, engine
from backend.database.migrations import USER_COLUMNS_ADDED_IN_1_1, add_missing_columns
from backend.models import tables  # noqa: F401  (registers the models)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)          # creates any missing tables (never drops anything)
    raw = engine.raw_connection()
    try:
        cursor = raw.cursor()
        add_missing_columns(cursor, "users", USER_COLUMNS_ADDED_IN_1_1)   # upgrades a 1.0 database in place
        raw.commit()
    finally:
        raw.close()


if __name__ == "__main__":
    init_db()
    print("FuelWise database is ready.")
