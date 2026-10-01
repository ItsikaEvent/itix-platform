import base64
import hashlib
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings

_ph = PasswordHasher()


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def create_access_token(subject: str) -> str:
    s = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(minutes=s.jwt_expire_minutes)
    return jwt.encode({"sub": subject, "exp": exp}, s.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> str | None:
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])["sub"]
    except (jwt.PyJWTError, KeyError):
        return None


# ---------------------------------------------------------------- QR Codes
# Le contenu du QR est un jeton Fernet (AES-128-CBC + HMAC-SHA256) : illisible sans la
# clé du serveur, infalsifiable, et différent à chaque génération.
_PREFIX = "TK1:"


@lru_cache
def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(get_settings().qr_secret.encode()).digest())
    return Fernet(key)


def encrypt_ticket(public_id: str) -> str:
    return _fernet().encrypt((_PREFIX + public_id).encode()).decode()


def decrypt_ticket(token: str) -> str | None:
    try:
        raw = _fernet().decrypt(token.strip().encode()).decode()
    except (InvalidToken, ValueError):
        return None
    return raw[len(_PREFIX):] if raw.startswith(_PREFIX) else None
