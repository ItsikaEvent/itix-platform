from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.limiter import rate_limit
from app.core.security import (
    create_access_token,
    create_admin_2fa_pending_token,
    create_admin_2fa_setup_token,
    decode_admin_2fa_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.entities import Admin, ROLE_SUPER_ADMIN, ROLE_ORGANIZER, ROLE_STAFF_SCANNER
from app.services.totp import generate_totp_secret, get_totp_qr_base64, get_totp_uri, verify_totp

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: str
    password: str


class VerifyTotpIn(BaseModel):
    token: str
    code: str = Field(..., min_length=6, max_length=6)


class ChangePasswordIn(BaseModel):
    old_password: str | None = None
    new_password: str = Field(min_length=8, max_length=120)


@router.post("/login", dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60, key_prefix="login"))])
def login(body: LoginIn, db: Session = Depends(get_db)):
    admin = db.scalar(select(Admin).where(Admin.email == body.email.strip().lower()))
    if not admin or not verify_password(body.password, admin.password_hash):
        raise HTTPException(401, "E-mail ou mot de passe incorrect.")
    if not admin.is_active:
        raise HTTPException(403, "Ce compte a été désactivé.")

    # 1. Pour le personnel de contrôle (STAFF_SCANNER), connexion directe autorisée
    if admin.role == ROLE_STAFF_SCANNER:
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
                "parent_organizer_id": admin.parent_organizer_id,
                "assigned_concert_id": admin.assigned_concert_id,
            },
        }

    # 2. Pour le SUPER_ADMIN et les ORGANISATEURS : A2F OBLIGATOIRE
    if admin.totp_enabled and admin.totp_secret:
        # A2F déjà configuré -> Demande du code à 6 chiffres
        temp_token = create_admin_2fa_pending_token(admin.id)
        return {
            "requires_totp": True,
            "auth_token": temp_token,
            "email": admin.email,
        }

    # A2F pas encore configuré -> Obligation d'initialisation avec QR code
    secret = generate_totp_secret()
    label_role = "ITIX-Admin" if admin.role == ROLE_SUPER_ADMIN else f"ITIX-{admin.slug}"
    uri = get_totp_uri(admin.email, secret, issuer=label_role)
    qr_code = get_totp_qr_base64(uri)
    setup_token = create_admin_2fa_setup_token(admin.id, secret)

    return {
        "requires_totp_setup": True,
        "setup_token": setup_token,
        "qr_code": qr_code,
        "secret": secret,
        "email": admin.email,
    }


@router.post("/verify-totp", dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60, key_prefix="totp"))])
def verify_admin_totp(body: VerifyTotpIn, db: Session = Depends(get_db)):
    payload = decode_admin_2fa_token(body.token)
    if not payload:
        raise HTTPException(401, "Session A2F expirée. Veuillez vous reconnecter.")

    admin_id = int(payload["sub"])
    admin = db.get(Admin, admin_id)
    if not admin or not admin.is_active:
        raise HTTPException(401, "Compte introuvable ou désactivé.")

    scope = payload.get("scope")
    if scope == "2fa_setup":
        secret = payload.get("secret")
        if not secret or not verify_totp(secret, body.code):
            raise HTTPException(401, "Code d'authentification incorrect. Vérifiez l'heure de votre appareil.")
        admin.totp_secret = secret
        admin.totp_enabled = True
        db.commit()
    elif scope == "2fa_pending":
        if not admin.totp_secret or not verify_totp(admin.totp_secret, body.code):
            raise HTTPException(401, "Code d'authentification incorrect.")
    else:
        raise HTTPException(401, "Action A2F non reconnue.")

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
            "parent_organizer_id": admin.parent_organizer_id,
            "assigned_concert_id": admin.assigned_concert_id,
            "totp_enabled": True,
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
        "commission_rate": current.commission_rate,
        "parent_organizer_id": current.parent_organizer_id,
        "assigned_concert_id": current.assigned_concert_id,
        "totp_enabled": current.totp_enabled,
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

