"""Run from the project root:  python -m pytest backend"""
import pytest

from backend.calculations.comparison import compare_vehicles
from backend.calculations.electric import calculate_electric
from backend.calculations.petrol import calculate_petrol
from backend.calculations.range_calc import remaining_range
from backend.calculations.geo import haversine_km


def test_petrol_basic():
    r = calculate_petrol(100, 45, 105)
    assert r["energy_required"] == 2.22
    assert r["trip_cost"] == 233.33
    assert r["cost_per_km"] == 2.33
    assert r["remaining_range_km"] is None  # no fuel level given: range must not be guessed


def test_petrol_range_and_sufficiency():
    r = calculate_petrol(100, 40, 100, fuel_level_percent=50, tank_capacity_litres=10)
    assert r["remaining_range_km"] == 200.0 and r["sufficient"] is True
    low = calculate_petrol(100, 40, 100, current_fuel_litres=1)
    assert low["remaining_range_km"] == 40.0 and low["sufficient"] is False and low["shortfall"] == 1.5


def test_petrol_percent_without_capacity_gives_no_range():
    assert calculate_petrol(50, 40, 100, fuel_level_percent=70)["remaining_range_km"] is None


def test_electric_no_loss():
    r = calculate_electric(100, 40, 8, charging_loss_percent=0)
    assert r["energy_required"] == 2.5 and r["trip_cost"] == 20.0 and r["cost_per_km"] == 0.2


def test_electric_with_charging_loss():
    r = calculate_electric(100, 40, 8, charging_loss_percent=10)
    assert r["energy_used_by_vehicle"] == 2.5
    assert r["energy_required"] == 2.78          # drawn from the supply
    assert r["trip_cost"] == 22.22


def test_electric_range_needs_capacity():
    assert calculate_electric(50, 40, 8, battery_percent=80)["remaining_range_km"] is None
    r = calculate_electric(50, 40, 8, battery_percent=50, battery_capacity_kwh=3)
    assert r["remaining_range_km"] == 60.0 and r["sufficient"] is True


def test_comparison_electric_cheaper():
    r = compare_vehicles(100, 40, 8, 45, 105, charging_loss_percent=0)
    assert r["cheaper_option"] == "electric"
    assert r["cost_difference"] == 213.33 and r["savings_percent"] == 91.4


def test_comparison_petrol_cheaper_and_equal():
    r = compare_vehicles(100, 5, 40, 60, 100)           # expensive, inefficient EV
    assert r["cheaper_option"] == "petrol" and r["savings_percent"] > 0
    eq = compare_vehicles(100, 50, 10, 50, 10, charging_loss_percent=0)
    assert eq["cheaper_option"] == "equal" and eq["savings_percent"] == 0


@pytest.mark.parametrize("args", [(0, 45, 105), (-5, 45, 105), (100, 0, 105), (100, 45, 0), ("abc", 45, 105)])
def test_petrol_invalid_input(args):
    with pytest.raises(ValueError):
        calculate_petrol(*args)


@pytest.mark.parametrize("loss", [-1, 60, 100])
def test_invalid_charging_loss(loss):
    with pytest.raises(ValueError):
        calculate_electric(100, 40, 8, charging_loss_percent=loss)


def test_range_helper():
    assert remaining_range("petrol", 45, 68, tank_capacity_litres=5) == 153.0
    assert remaining_range("electric", 40, 80, battery_capacity_kwh=3) == 96.0
    assert remaining_range("electric", 40, 80) is None
    assert remaining_range("petrol", 45, None, tank_capacity_litres=5) is None


def test_haversine():
    assert haversine_km(22.5, 88.3, 22.5, 88.3) == 0
    assert 110 < haversine_km(0, 0, 1, 0) < 112
