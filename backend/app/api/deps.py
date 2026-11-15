from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token, decode_client_token
from app.db.session import get_db
from app.models.entities import Admin, ROLE_SUPER_ADMIN

_bearer = HTTPBearer(auto_error=False)


def get_current_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Admin:
    sub = decode_access_token(creds.credentials) if creds else None
    admin = db.get(Admin, int(sub)) if sub and sub.isdigit() else None
    if not admin:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentification requise.")
    if not admin.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ce compte a été désactivé.")
    return admin


def require_super_admin(current: Admin = Depends(get_current_admin)) -> Admin:
    if current.role != ROLE_SUPER_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cette action est réservée au Super Administrateur.")
    return current


def get_current_client(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Accès sécurisé : veuillez vous authentifier avec votre code TOTP.")
    payload = decode_client_token(creds.credentials)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expirée ou code d'accès invalide.")
    return payload


