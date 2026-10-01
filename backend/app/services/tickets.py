import io

import qrcode

from app.core.security import encrypt_ticket
from app.models.entities import Ticket


def qr_png(token: str) -> bytes:
    img = qrcode.make(token, box_size=8, border=3)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def ticket_images(tickets: list[Ticket]) -> list[tuple[str, bytes]]:
    """(numéro, PNG) pour chaque billet. Le QR contient un jeton chiffré, pas de données lisibles."""
    return [(t.number or "", qr_png(encrypt_ticket(t.public_id))) for t in tickets]
