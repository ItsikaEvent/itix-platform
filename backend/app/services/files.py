from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import StoredFile


def _sniff(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def save_image(db: Session, upload: UploadFile) -> StoredFile:
    """Valide (taille + contenu réel, pas seulement l'extension) et enregistre l'image."""
    limit = get_settings().max_upload_mb * 1024 * 1024
    data = upload.file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, "Le fichier envoyé est trop volumineux.")
    mime = _sniff(data)
    if not mime:
        raise HTTPException(422, "Format d'image non accepté (JPG, PNG ou WEBP uniquement).")
    f = StoredFile(filename=(upload.filename or "image")[:255], content_type=mime, data=data)
    db.add(f)
    db.flush()
    return f
