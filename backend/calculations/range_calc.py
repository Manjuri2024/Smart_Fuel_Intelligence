"""Remaining-range helpers used by dashboards and vehicle status."""
from typing import Optional


def remaining_range(vehicle_type: str, efficiency: float, level_percent: Optional[float],
                    tank_capacity_litres: Optional[float] = None,
                    battery_capacity_kwh: Optional[float] = None) -> Optional[float]:
    """Range in km, or None when the capacity needed for a reliable estimate is unknown."""
    if level_percent is None or not efficiency or efficiency <= 0:
        return None
    capacity = tank_capacity_litres if vehicle_type == "petrol" else battery_capacity_kwh
    if not capacity or capacity <= 0:
        return None
    return round(level_percent / 100 * capacity * efficiency, 1)
