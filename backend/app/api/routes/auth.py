from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.entities import Admin

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: str
    password: str


class ChangePasswordIn(BaseModel):
    old_password: str | None = None
    new_password: str = Field(min_length=8, max_length=120)


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    admin = db.scalar(select(Admin).where(Admin.email == body.email.strip().lower()))
    if not admin or not verify_password(body.password, admin.password_hash):
        raise HTTPException(401, "E-mail ou mot de passe incorrect.")
    if not admin.is_active:
        raise HTTPException(403, "Ce compte organisateur a été désactivé.")
    return {
        "access_token": create_access_token(str(admin.id)),
        "token_type": "bearer",
        "user": {
            "id": admin.id,
            "name": admin.name,
            "email": admin.email,
            "role": admin.role,
            "slug": admin.slug,
            "must_change_password": admin.must_change_password,
        },
    }


@router.get("/me")
def get_me(current: Admin = Depends(get_current_admin)):
    return {
        "id": current.id,
        "name": current.name,
        "email": current.email,
        "role": current.role,
        "slug": current.slug,
        "must_change_password": current.must_change_password,
    }


@router.post("/change-password")
def change_password(
    body: ChangePasswordIn,
    current: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    # Si le changement n'était pas forcé, on vérifie l'ancien mot de passe
    if not current.must_change_password:
        if not body.old_password or not verify_password(body.old_password, current.password_hash):
            raise HTTPException(400, "L'ancien mot de passe est incorrect.")

    current.password_hash = hash_password(body.new_password)
    current.must_change_password = False
    db.commit()
    return {"message": "Mot de passe mis à jour avec succès."}

