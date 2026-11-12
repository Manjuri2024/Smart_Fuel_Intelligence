import os
from typing import Optional

from fastapi import APIRouter, Query

from backend.calculations.geo import haversine_km

router = APIRouter(tags=["maps"])

DEFAULT_LAT = float(os.getenv("DEFAULT_MAP_LAT", "22.5726"))
DEFAULT_LNG = float(os.getenv("DEFAULT_MAP_LNG", "88.3639"))

# DEMO DATA ONLY. These are NOT real charging stations. Each is placed at a fixed offset from the
# search centre so the map UI can be demonstrated anywhere. Replace with a real provider later.
_DEMO_OFFSETS = [
    ("Demo Station A", 0.012, 0.010, "Available", 2, 4),
    ("Demo Station B", -0.020, 0.018, "Busy", 0, 3),
    ("Demo Station C", 0.030, -0.025, "Available", 3, 6),
    ("Demo Station D", -0.045, -0.040, "Offline", 0, 2),
]


@router.get("/maps/charging-stations")
def charging_stations(lat: Optional[float] = Query(None, ge=-90, le=90), lng: Optional[float] = Query(None, ge=-180, le=180),
                      radius_km: float = Query(25, gt=0, le=200)):
    centre_lat = DEFAULT_LAT if lat is None else lat
    centre_lng = DEFAULT_LNG if lng is None else lng
    stations = []
    for i, (name, dlat, dlng, status, free, total) in enumerate(_DEMO_OFFSETS, start=1):
        s_lat, s_lng = centre_lat + dlat, centre_lng + dlng
        distance = haversine_km(centre_lat, centre_lng, s_lat, s_lng)
        if distance <= radius_km:
            stations.append({"id": i, "name": name, "lat": round(s_lat, 6), "lng": round(s_lng, 6),
                             "distance_km": round(distance, 1), "availability": status,
                             "free_connectors": free, "total_connectors": total, "is_demo": True})
    stations.sort(key=lambda s: s["distance_km"])
    return {"is_demo": True, "centre": {"lat": centre_lat, "lng": centre_lng}, "stations": stations,
            "notice": "Demo locations only - not real charging stations. A live provider has not been integrated."}
