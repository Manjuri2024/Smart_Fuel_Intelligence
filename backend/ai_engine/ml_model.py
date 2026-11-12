"""Energy-consumption prediction using scikit-learn.

This is kept separate from ordinary cost calculations. A model is trained ONLY when there are
enough real trips; otherwise the formula-based estimate is returned and clearly labelled.
"""
from typing import Dict, List, Optional

MIN_SAMPLES = 20

LIMITATIONS = [
    "The model only learns from the trips you have logged; it knows nothing about traffic, terrain or weather.",
    "Predictions are most reliable for distances similar to those in your history.",
    "With few trips the accuracy figures are rough estimates.",
]


def _formula(distance_km: float, vehicle_type: str, efficiency: Optional[float], loss_percent: float):
    if not efficiency or efficiency <= 0:
        return None
    energy = distance_km / efficiency
    if vehicle_type == "electric":
        energy = energy / (1 - loss_percent / 100)
    return energy


def predict_from_rows(rows: List[Dict], distance_km: float, vehicle_type: str,
                      efficiency: Optional[float] = None, avg_speed_kmph: Optional[float] = None,
                      charging_loss_percent: float = 10.0) -> Dict:
    """rows: dicts with distance_km, energy_used, avg_speed_kmph (optional), for ONE vehicle type."""
    unit = "kWh" if vehicle_type == "electric" else "L"
    formula_value = _formula(distance_km, vehicle_type, efficiency, charging_loss_percent)
    base = {"vehicle_type": vehicle_type, "unit": unit, "training_samples": len(rows),
            "min_samples_required": MIN_SAMPLES, "limitations": LIMITATIONS}

    def fallback(reason: str) -> Dict:
        if formula_value is None:
            return {**base, "method": "unavailable", "predicted_energy": None,
                    "note": f"{reason} Provide the vehicle efficiency to get a formula-based estimate."}
        return {**base, "method": "formula", "predicted_energy": round(formula_value, 3),
                "note": f"{reason} Showing the formula-based estimate (distance / efficiency)."}

    if len(rows) < MIN_SAMPLES:
        return fallback(f"Not enough trips to train a model ({len(rows)} of {MIN_SAMPLES} needed).")

    try:
        import numpy as np
        from sklearn.linear_model import LinearRegression
        from sklearn.model_selection import KFold, cross_val_predict
        from sklearn.metrics import mean_absolute_error, r2_score
    except ImportError:
        return fallback("scikit-learn is not installed.")

    distances = np.array([r["distance_km"] for r in rows], dtype=float)
    energies = np.array([r["energy_used"] for r in rows], dtype=float)
    if np.ptp(distances) == 0:
        return fallback("All logged trips have the same distance, so a model cannot learn from them.")

    use_speed = avg_speed_kmph is not None and all(r.get("avg_speed_kmph") for r in rows)
    X = np.column_stack([distances, [r["avg_speed_kmph"] for r in rows]]) if use_speed else distances.reshape(-1, 1)
    model = LinearRegression()
    cv_predictions = cross_val_predict(model, X, energies, cv=KFold(5, shuffle=True, random_state=0))
    mae = float(mean_absolute_error(energies, cv_predictions))
    r2 = float(r2_score(energies, cv_predictions))
    model.fit(X, energies)
    point = [[distance_km, avg_speed_kmph]] if use_speed else [[distance_km]]
    predicted = float(model.predict(point)[0])
    if predicted <= 0:
        return fallback("The model produced an unusable (non-positive) prediction.")

    return {**base, "method": "ml_linear_regression", "predicted_energy": round(predicted, 3),
            "features": ["distance_km", "avg_speed_kmph"] if use_speed else ["distance_km"],
            "cross_validated_mae": round(mae, 3), "cross_validated_r2": round(r2, 3),
            "formula_estimate": None if formula_value is None else round(formula_value, 3),
            "note": "Linear regression trained on your own logged trips (5-fold cross-validated)."}
