from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.entities import Admin

_bearer = HTTPBearer(auto_error=False)


def get_current_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Admin:
    sub = decode_access_token(creds.credentials) if creds else None
    admin = db.get(Admin, int(sub)) if sub and sub.isdigit() else None
    if not admin:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentification requise.")
    return admin
