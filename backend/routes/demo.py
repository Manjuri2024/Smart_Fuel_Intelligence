"""Public demo endpoints for guests. Everything returned is generated in memory and labelled as demo data."""
from fastapi import APIRouter, Query

from backend.calculations.dashboard_stats import build_dashboard
from backend.calculations.demo_data import demo_settings, demo_trips, demo_vehicle

router = APIRouter(prefix="/demo", tags=["demo"])


@router.get("/dashboard")
def demo_dashboard(days: int = Query(7, ge=1, le=90)):
    data = build_dashboard(demo_trips(), demo_settings(), demo_vehicle(), days)
    data["is_demo"] = True
    data["demo_notice"] = "Demo data for illustration only. Create a free account to track your own trips."
    return data
