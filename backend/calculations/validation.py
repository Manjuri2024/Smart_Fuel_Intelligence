"""Shared input checks for the calculation modules."""
from typing import Optional


def positive(value, name: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a number.")
    if number != number or number in (float("inf"), float("-inf")) or number <= 0:
        raise ValueError(f"{name} must be greater than 0.")
    return number


def non_negative(value, name: str) -> float:
    number = float(value)
    if number < 0:
        raise ValueError(f"{name} cannot be negative.")
    return number


def percent(value, name: str) -> float:
    number = float(value)
    if not 0 <= number <= 100:
        raise ValueError(f"{name} must be between 0 and 100.")
    return number


def loss_percent(value) -> float:
    number = float(value)
    if not 0 <= number < 60:
        raise ValueError("Charging loss must be at least 0 and below 60 percent.")
    return number


def r2(value: Optional[float]) -> Optional[float]:
    return None if value is None else round(value, 2)
