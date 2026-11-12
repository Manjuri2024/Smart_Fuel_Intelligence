import hashlib
import random

from backend import security
from backend.ai_engine.ml_model import MIN_SAMPLES, predict_from_rows


def test_password_hash_roundtrip():
    stored = security.hash_password("correct horse 9")
    assert "correct horse" not in stored
    assert security.verify_password("correct horse 9", stored)
    assert not security.verify_password("wrong", stored)


def test_accounts_without_password_never_verify():
    assert not security.verify_password("anything", "!")
    assert not security.verify_password("", "")
    assert not security.verify_password("x", "not-a-valid-hash")


def test_legacy_pbkdf2_hash_from_version_1_still_verifies():
    salt = "abc123"
    digest = hashlib.pbkdf2_hmac("sha256", b"oldpass1", salt.encode(), 260_000).hex()
    legacy = f"pbkdf2_sha256$260000${salt}${digest}"
    assert security.verify_password("oldpass1", legacy)
    assert not security.verify_password("oldpass2", legacy)


def test_password_strength_rules():
    import pytest
    assert security.validate_password_strength("abcdefg1") == "abcdefg1"
    for bad in ["short1", "allletters", "12345678", "a" * 129 + "1"]:
        with pytest.raises(ValueError):
            security.validate_password_strength(bad)


def test_random_tokens_are_unique_and_stored_hashed():
    raw1, h1 = security.generate_token()
    raw2, h2 = security.generate_token()
    assert raw1 != raw2 and h1 != h2
    assert len(raw1) >= 40 and h1 == security.hash_token(raw1) and raw1 not in h1


def _rows(n):
    rng = random.Random(1)
    out = []
    for _ in range(n):
        d = rng.uniform(5, 80)
        out.append({"distance_km": d, "energy_used": d / 40 * 1.1 + rng.uniform(-0.05, 0.05), "avg_speed_kmph": None})
    return out


def test_ml_falls_back_with_too_little_data():
    r = predict_from_rows(_rows(MIN_SAMPLES - 1), 50, "electric", efficiency=40, charging_loss_percent=10)
    assert r["method"] == "formula" and r["predicted_energy"] == 1.389


def test_ml_unavailable_without_data_or_efficiency():
    assert predict_from_rows([], 50, "petrol")["method"] == "unavailable"


def test_ml_trains_with_enough_data():
    r = predict_from_rows(_rows(40), 50, "electric", efficiency=40)
    assert r["method"] == "ml_linear_regression"
    assert 1.2 < r["predicted_energy"] < 1.6
    assert "cross_validated_mae" in r and r["limitations"]
