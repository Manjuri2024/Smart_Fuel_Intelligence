"""SQLAlchemy ORM models (database tables)."""
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.connection import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    role: Mapped[str] = mapped_column(String(10), default="user", server_default="user")             # user | admin
    auth_provider: Mapped[str] = mapped_column(String(20), default="local", server_default="local")  # local | google
    account_status: Mapped[str] = mapped_column(String(12), default="active", server_default="active")  # active | disabled
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    vehicles = relationship("Vehicle", back_populates="user", cascade="all, delete-orphan")
    trips = relationship("Trip", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Vehicle(Base):
    __tablename__ = "vehicles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    vehicle_type: Mapped[str] = mapped_column(String(10))          # "petrol" | "electric"
    efficiency: Mapped[float] = mapped_column(Float)               # km/L or km/kWh
    tank_capacity_litres: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    battery_capacity_kwh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    current_level_percent: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="vehicles")
    trips = relationship("Trip", back_populates="vehicle")


class Trip(Base):
    __tablename__ = "trips"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    vehicle_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True)
    trip_date: Mapped[date] = mapped_column(Date, index=True)
    vehicle_type: Mapped[str] = mapped_column(String(10))
    distance_km: Mapped[float] = mapped_column(Float)
    energy_used: Mapped[float] = mapped_column(Float)              # litres (petrol) or kWh drawn (electric)
    price_per_unit: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cost: Mapped[float] = mapped_column(Float)
    avg_speed_kmph: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="trips")
    vehicle = relationship("Vehicle", back_populates="trips")


class FuelPrice(Base):
    __tablename__ = "fuel_prices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    price_per_litre: Mapped[float] = mapped_column(Float)
    region: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    effective_date: Mapped[date] = mapped_column(Date, default=date.today)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ElectricityTariff(Base):
    __tablename__ = "electricity_tariffs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tariff_per_kwh: Mapped[float] = mapped_column(Float)
    region: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    effective_date: Mapped[date] = mapped_column(Date, default=date.today)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class CalculationRecord(Base):
    __tablename__ = "calculation_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))                  # petrol | electric | compare
    inputs_json: Mapped[str] = mapped_column(Text)
    result_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class UserSettings(Base):
    __tablename__ = "user_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    theme: Mapped[str] = mapped_column(String(10), default="light")
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    email_alerts: Mapped[bool] = mapped_column(Boolean, default=False)
    price_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    share_analytics: Mapped[bool] = mapped_column(Boolean, default=False)
    store_chat_history: Mapped[bool] = mapped_column(Boolean, default=True)
    default_petrol_price: Mapped[float] = mapped_column(Float, default=105.0)
    default_electricity_tariff: Mapped[float] = mapped_column(Float, default=8.0)
    default_petrol_mileage: Mapped[float] = mapped_column(Float, default=45.0)
    default_ev_efficiency: Mapped[float] = mapped_column(Float, default=40.0)
    charging_loss_percent: Mapped[float] = mapped_column(Float, default=10.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="settings")


class AIConversation(Base):
    __tablename__ = "ai_conversations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(10))                  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AuthSession(Base):
    """A login session. Only a SHA-256 hash of the session token is stored."""
    __tablename__ = "auth_sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    remember: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class PasswordResetToken(Base):
    """Single-use, time-limited reset token. Only the hash is stored."""
    __tablename__ = "password_reset_tokens"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class OAuthAccount(Base):
    """Links a FuelWise user to an external identity (Google)."""
    __tablename__ = "oauth_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(20))
    provider_user_id: Mapped[str] = mapped_column(String(255))
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    __table_args__ = (UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_user"),)


class ActivityLog(Base):
    """Security and activity events shown in the admin area (no passwords or tokens)."""
    __tablename__ = "activity_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    event: Mapped[str] = mapped_column(String(40), index=True)
    detail: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)


class AppConfig(Base):
    """Small key/value table for admin-managed application settings."""
    __tablename__ = "app_config"
    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String(255))
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
