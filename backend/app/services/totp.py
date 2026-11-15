import base64
import hashlib
import hmac
import io
import secrets
import struct
import time
import urllib.parse

import qrcode


def generate_totp_secret() -> str:
    """Génère un secret Base32 de 160 bits conforme RFC 4226 / RFC 6238."""
    raw = secrets.token_bytes(20)
    return base64.b32encode(raw).decode("ascii").replace("=", "")


def get_totp_token(secret: str, intervals_no: int | None = None) -> str:
    """Calcule le code TOTP à 6 chiffres pour un intervalle donné (par défaut, temps courant // 30)."""
    if intervals_no is None:
        intervals_no = int(time.time()) // 30
    clean_secret = secret.strip().replace(" ", "").upper()
    # Remplir le padding Base32 si nécessaire
    pad = (8 - len(clean_secret) % 8) % 8
    key = base64.b32decode(clean_secret + "=" * pad, casefold=True)
    msg = struct.pack(">Q", intervals_no)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    o = h[19] & 0x0F
    code = (struct.unpack(">I", h[o : o + 4])[0] & 0x7FFFFFFF) % 1000000
    return f"{code:06d}"


def verify_totp(secret: str, token: str, valid_window: int = 1) -> bool:
    """Vérifie le code TOTP avec une fenêtre de tolérance (par défaut ±30 secondes)."""
    clean_token = token.strip()
    if not clean_token.isdigit() or len(clean_token) != 6:
        return False
    now = int(time.time()) // 30
    for i in range(-valid_window, valid_window + 1):
        if hmac.compare_digest(get_totp_token(secret, now + i), clean_token):
            return True
    return False


def get_totp_uri(email: str, secret: str, issuer: str = "ITIX") -> str:
    """Génère l'URI standard otpauth:// reconnue par Google Authenticator, Microsoft Authenticator, FreeOTP, etc."""
    label = urllib.parse.quote(f"{issuer}:{email.strip().lower()}")
    params = urllib.parse.urlencode({
        "secret": secret.strip().replace(" ", "").upper(),
        "issuer": issuer,
        "algorithm": "SHA1",
        "digits": 6,
        "period": 30,
    })
    return f"otpauth://totp/{label}?{params}"


def get_totp_qr_base64(uri: str) -> str:
    """Génère une image PNG QR Code encodée en base64."""
    img = qrcode.make(uri, box_size=6, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
