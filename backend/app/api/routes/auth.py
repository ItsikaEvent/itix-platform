from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.entities import Admin

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    admin = db.scalar(select(Admin).where(Admin.email == body.email.strip().lower()))
    if not admin or not verify_password(body.password, admin.password_hash):
        raise HTTPException(401, "E-mail ou mot de passe incorrect.")
    return {"access_token": create_access_token(str(admin.id)), "token_type": "bearer"}
