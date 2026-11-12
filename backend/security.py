"""Password hashing, password rules and random tokens.

Passwords are hashed with Argon2 (argon2-cffi, listed in requirements.txt). Older accounts created by
FuelWise 1.0 used PBKDF2; those hashes still verify and are upgraded to Argon2 at the next login.
If argon2-cffi is missing, PBKDF2-SHA256 (600,000 rounds) is used so the app still never stores plain text.
"""
import hashlib
import hmac
import re
import secrets
from typing import Tuple

try:
    from argon2 import PasswordHasher
    from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
    _hasher = PasswordHasher()
except ImportError:  # pragma: no cover - depends on the environment
    _hasher = None

_PBKDF2_ITERATIONS = 600_000
HASHER_NAME = "argon2" if _hasher else "pbkdf2_sha256"


def hash_password(password: str) -> str:
    if _hasher:
        return _hasher.hash(password)
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _PBKDF2_ITERATIONS).hex()
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    if not stored or stored == "!":
        return False                       # "!" marks accounts that have no password (Google / system)
    if stored.startswith("$argon2"):
        if not _hasher:
            return False
        try:
            return _hasher.verify(stored, password)
        except (VerifyMismatchError, InvalidHashError, VerificationError):
            return False
    try:                                   # PBKDF2 (FuelWise 1.0 accounts and the no-argon2 fallback)
        scheme, iterations, salt, digest = stored.split("$")
        if scheme != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations)).hex()
        return hmac.compare_digest(candidate, digest)
    except (ValueError, AttributeError):
        return False


def password_needs_rehash(stored: str) -> bool:
    """True when a verified password should be re-hashed with the current algorithm."""
    if not _hasher or not stored or stored == "!":
        return False
    if stored.startswith("$argon2"):
        return _hasher.check_needs_rehash(stored)
    return True


_dummy_hash = None


def burn_password_time(password: str) -> None:
    """Spend the same time as a real check so login timing does not reveal which e-mails exist."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = hash_password("fuelwise-timing-placeholder")
    verify_password(password, _dummy_hash)


def validate_password_strength(password: str) -> str:
    """Return the password if it meets the rules, otherwise raise ValueError with a clear message."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if len(password) > 128:
        raise ValueError("Password must be at most 128 characters long.")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ValueError("Password must contain at least one letter and one number.")
    return password


def hash_token(raw: str) -> str:
    """Tokens are stored only as SHA-256 hashes, so a leaked database cannot be used to log in."""
    return hashlib.sha256(raw.encode()).hexdigest()


def generate_token() -> Tuple[str, str]:
    """Return (raw_token_for_the_user, hash_to_store)."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)
