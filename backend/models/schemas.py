"""Pydantic request/response schemas with input validation."""
from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from backend.security import validate_password_strength

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
VehicleType = Literal["petrol", "electric"]


# ---- Calculators -------------------------------------------------------------
class PetrolCalcIn(BaseModel):
    distance_km: float = Field(gt=0, le=100000)
    mileage_kmpl: float = Field(gt=0, le=500)
    price_per_litre: float = Field(gt=0, le=1000)
    current_fuel_litres: Optional[float] = Field(None, ge=0, le=1000)
    fuel_level_percent: Optional[float] = Field(None, ge=0, le=100)
    tank_capacity_litres: Optional[float] = Field(None, gt=0, le=1000)


class ElectricCalcIn(BaseModel):
    distance_km: float = Field(gt=0, le=100000)
    efficiency_km_per_kwh: float = Field(gt=0, le=1000)
    tariff_per_kwh: float = Field(gt=0, le=1000)
    charging_loss_percent: float = Field(10.0, ge=0, lt=60)
    battery_percent: Optional[float] = Field(None, ge=0, le=100)
    battery_capacity_kwh: Optional[float] = Field(None, gt=0, le=2000)


class CompareIn(BaseModel):
    distance_km: float = Field(gt=0, le=100000)
    ev_efficiency_km_per_kwh: float = Field(gt=0, le=1000)
    tariff_per_kwh: float = Field(gt=0, le=1000)
    petrol_mileage_kmpl: float = Field(gt=0, le=500)
    petrol_price_per_litre: float = Field(gt=0, le=1000)
    charging_loss_percent: float = Field(10.0, ge=0, lt=60)


# ---- Vehicles and trips --------------------------------------------------------
class VehicleIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    vehicle_type: VehicleType
    efficiency: float = Field(gt=0, le=1000, description="km/L for petrol, km/kWh for electric")
    tank_capacity_litres: Optional[float] = Field(None, gt=0, le=1000)
    battery_capacity_kwh: Optional[float] = Field(None, gt=0, le=2000)
    current_level_percent: Optional[float] = Field(None, ge=0, le=100)


class VehicleOut(VehicleIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    remaining_range_km: Optional[float] = None


class TripIn(BaseModel):
    trip_date: date
    vehicle_type: VehicleType
    distance_km: float = Field(gt=0, le=100000)
    energy_used: Optional[float] = Field(None, gt=0, le=100000, description="litres, or kWh drawn for electric")
    price_per_unit: Optional[float] = Field(None, gt=0, le=1000)
    cost: Optional[float] = Field(None, ge=0, le=10000000)
    vehicle_id: Optional[int] = None
    avg_speed_kmph: Optional[float] = Field(None, gt=0, le=300)
    notes: Optional[str] = Field(None, max_length=500)


# ---- Auth --------------------------------------------------------------------
PHONE_PATTERN = r"^[0-9+()\-\s]{7,20}$"


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(pattern=EMAIL_PATTERN, max_length=255)
    password: str = Field(min_length=1, max_length=128)
    confirm_password: Optional[str] = Field(None, max_length=128)
    phone: Optional[str] = Field(None, pattern=PHONE_PATTERN)
    accept_terms: bool = False

    @field_validator("password")
    @classmethod
    def _strong(cls, value: str) -> str:
        return validate_password_strength(value)

    @model_validator(mode="after")
    def _checks(self):
        if self.confirm_password is not None and self.confirm_password != self.password:
            raise ValueError("Password and confirmation do not match.")
        if not self.accept_terms:
            raise ValueError("You must accept the Terms and Privacy Policy.")
        return self


class LoginIn(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=255)
    password: str = Field(min_length=1, max_length=128)
    remember: bool = False


class ForgotPasswordIn(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=255)


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=1, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _strong(cls, value: str) -> str:
        return validate_password_strength(value)


class AdminUserUpdate(BaseModel):
    account_status: Literal["active", "disabled"]


class AdminConfigIn(BaseModel):
    registration_open: bool


# ---- Settings ----------------------------------------------------------------
class SettingsIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: str = Field(pattern=EMAIL_PATTERN, max_length=255)
    phone: Optional[str] = Field(None, pattern=PHONE_PATTERN)
    city: Optional[str] = Field(None, max_length=100)
    theme: Literal["light", "dark", "system"] = "light"
    notifications_enabled: bool = True
    email_alerts: bool = False
    price_alerts: bool = True
    share_analytics: bool = False
    store_chat_history: bool = True
    default_petrol_price: float = Field(105.0, gt=0, le=1000)
    default_electricity_tariff: float = Field(8.0, gt=0, le=1000)
    default_petrol_mileage: float = Field(45.0, gt=0, le=500)
    default_ev_efficiency: float = Field(40.0, gt=0, le=1000)
    charging_loss_percent: float = Field(10.0, ge=0, lt=60)


# ---- AI ----------------------------------------------------------------------
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: List[ChatMessage] = Field(default_factory=list, max_length=20)


class PredictIn(BaseModel):
    vehicle_type: VehicleType
    distance_km: float = Field(gt=0, le=100000)
    efficiency: Optional[float] = Field(None, gt=0, le=1000)
    avg_speed_kmph: Optional[float] = Field(None, gt=0, le=300)
