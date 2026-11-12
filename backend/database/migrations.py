"""Safe, dependency-free upgrades for databases created by older FuelWise versions."""

# Columns added to the existing "users" table by the authentication update (FuelWise 1.1).
USER_COLUMNS_ADDED_IN_1_1 = {
    "phone": "VARCHAR(30)",
    "role": "VARCHAR(10) NOT NULL DEFAULT 'user'",
    "auth_provider": "VARCHAR(20) NOT NULL DEFAULT 'local'",
    "account_status": "VARCHAR(12) NOT NULL DEFAULT 'active'",
    "last_login_at": "DATETIME",
}


def add_missing_columns(cursor, table: str, columns: dict) -> list:
    """Add columns that an older database lacks. Existing rows and data are kept. Returns the names added."""
    cursor.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cursor.fetchall()}
    if not existing:
        return []  # table does not exist yet; create_all will build it with every column
    added = []
    for name, ddl in columns.items():
        if name not in existing:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
            added.append(name)
    return added
