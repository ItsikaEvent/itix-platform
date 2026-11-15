import base64
import secrets
from typing import Literal

from fastapi import (APIRouter, BackgroundTasks, Depends, File, Form, HTTPException,
                     Response, UploadFile)
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_client
from app.core.config import get_settings
from app.core.security import create_client_token
from app.core.timeutil import local_now
from app.db.session import get_db
from app.models.entities import (Admin, ChatMessage, ClientAccount, Concert, Order,
                                 StoredFile, SupportMessage, TicketType)
from app.services.files import save_image
from app.services.mailer import send_tickets_email, smtp_configured
from app.services.presenters import concert_out, sold_map
from app.services.tickets import ticket_images
from app.services.totp import (generate_totp_secret, get_totp_qr_base64,
                              get_totp_uri, verify_totp)

router = APIRouter(prefix="/api", tags=["public"])


@router.get("/config")
def public_config():
    return {"payment_instructions": get_settings().payment_instructions}


@router.get("/concerts")
def list_concerts(db: Session = Depends(get_db)):
    sold = sold_map(db)
    concerts = db.scalars(select(Concert).order_by(Concert.date)).all()
    return [concert_out(c, sold) for c in concerts]


@router.get("/concerts/{concert_id}")
def get_concert(concert_id: int, db: Session = Depends(get_db)):
    c = db.get(Concert, concert_id)
    if not c:
        raise HTTPException(404, "Concert introuvable.")
    return concert_out(c, sold_map(db))


@router.get("/organizers/{slug}")
def get_public_organizer(slug: str, db: Session = Depends(get_db)):
    clean_slug = slug.strip().lower()
    org = db.scalar(select(Admin).where(Admin.slug == clean_slug, Admin.is_active.is_(True)))
    if not org:
        raise HTTPException(404, "Organisateur introuvable.")
    sold = sold_map(db)
    concerts = db.scalars(
        select(Concert)
        .where(Concert.organizer_id == org.id)
        .order_by(Concert.date.desc())
    ).all()
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "phone": org.phone,
        "concerts": [concert_out(c, sold) for c in concerts],
    }


@router.get("/files/{file_id}")
def get_poster(file_id: str, db: Session = Depends(get_db)):
    """Public uniquement pour les affiches (les preuves de paiement restent privées)."""
    is_poster = db.scalar(select(Concert.id).where(Concert.poster_file_id == file_id))
    f = db.get(StoredFile, file_id) if is_poster else None
    if not f:
        raise HTTPException(404, "Fichier introuvable.")
    return Response(f.data, media_type=f.content_type,
                    headers={"Cache-Control": "public, max-age=86400"})


def _new_reference(db: Session) -> str:
    year = local_now().year
    while True:
        ref = f"CMD-{year}-{secrets.token_hex(3).upper()}"
        if not db.scalar(select(Order.id).where(Order.reference == ref)):
            return ref


@router.post("/orders", status_code=201)
def create_order(
    concert_id: int = Form(...),
    ticket_type_id: int = Form(...),
    quantity: int = Form(..., ge=1, le=10),
    customer_name: str = Form(..., min_length=2, max_length=120),
    customer_email: EmailStr = Form(...),
    pay_mode: Literal["PAY_NOW", "RESERVE"] = Form(...),
    consent_cgu_cgv: bool = Form(True),
    consent_privacy: bool = Form(True),
    proof: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    if not consent_cgu_cgv or not consent_privacy:
        raise HTTPException(422, "Vous devez accepter les CGV, les CGU et la Politique de Confidentialité.")

    has_proof = proof is not None and bool(proof.filename)
    if pay_mode == "PAY_NOW" and not has_proof:
        raise HTTPException(422, "La preuve de paiement est obligatoire pour payer maintenant.")

    # Verrou de ligne sur le type de billet : deux commandes simultanées sont sérialisées,
    # donc on ne peut jamais dépasser le stock.
    tt = db.scalar(
        select(TicketType)
        .where(TicketType.id == ticket_type_id, TicketType.concert_id == concert_id)
        .with_for_update()
    )
    if not tt:
        raise HTTPException(404, "Type de billet introuvable pour ce concert.")
    if tt.concert.date < local_now():
        raise HTTPException(409, "Ce concert est terminé.")
    if sold_map(db).get(tt.id, 0) + quantity > tt.quantity:
        db.rollback()
        raise HTTPException(409, "Cette quantité de billets n'est plus disponible.")

    proof_file = save_image(db, proof) if pay_mode == "PAY_NOW" and has_proof else None
    order = Order(
        reference=_new_reference(db),
        concert_id=concert_id,
        ticket_type_id=tt.id,
        customer_name=customer_name.strip(),
        customer_email=str(customer_email).lower(),
        quantity=quantity,
        unit_price=tt.price,
        total_amount=tt.price * quantity,
        pay_mode=pay_mode,
        consent_cgu_cgv=consent_cgu_cgv,
        consent_privacy=consent_privacy,
        proof_file_id=proof_file.id if proof_file else None,
        payment_status="PROOF_SUBMITTED" if proof_file else "UNPAID",
    )
    db.add(order)
    clean_cust_email = str(customer_email).lower().strip()
    if not db.scalar(select(ClientAccount.id).where(ClientAccount.email == clean_cust_email)):
        db.add(ClientAccount(
            email=clean_cust_email,
            name=customer_name.strip(),
            totp_secret=generate_totp_secret(),
            is_verified=False,
        ))
    db.commit()
    return {
        "reference": order.reference,
        "quantity": order.quantity,
        "total_amount": order.total_amount,
        "customer_email": order.customer_email,
        "pay_mode": order.pay_mode,
    }


# ------------------------------------------------------------------ Authentification Client TOTP (RFC 6238)
class ClientAuthCheckIn(BaseModel):
    email: EmailStr


class ClientAuthSetupIn(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=120)


class ClientAuthVerifyIn(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


@router.post("/client/auth/check")
def check_client_auth(body: ClientAuthCheckIn, db: Session = Depends(get_db)):
    clean_email = str(body.email).strip().lower()
    acc = db.scalar(select(ClientAccount).where(ClientAccount.email == clean_email))
    if acc:
        return {
            "has_account": True,
            "is_verified": acc.is_verified,
            "name": acc.name,
        }
    last_order = db.scalar(
        select(Order).where(Order.customer_email == clean_email).order_by(Order.id.desc())
    )
    return {
        "has_account": False,
        "is_verified": False,
        "name": last_order.customer_name if last_order else "",
        "has_orders": bool(last_order),
    }


@router.post("/client/auth/setup")
def setup_client_totp(body: ClientAuthSetupIn, db: Session = Depends(get_db)):
    clean_email = str(body.email).strip().lower()
    acc = db.scalar(select(ClientAccount).where(ClientAccount.email == clean_email))
    if acc and acc.is_verified:
        raise HTTPException(
            400,
            "Votre compte est déjà associé à une application d'authentification. Veuillez saisir votre code TOTP.",
        )

    secret = generate_totp_secret()
    if not acc:
        acc = ClientAccount(
            email=clean_email,
            name=body.name.strip(),
            totp_secret=secret,
            is_verified=False,
        )
        db.add(acc)
    else:
        acc.name = body.name.strip()
        acc.totp_secret = secret
        acc.is_verified = False

    db.commit()
    uri = get_totp_uri(clean_email, secret)
    qr_code = get_totp_qr_base64(uri)
    return {
        "email": clean_email,
        "secret": secret,
        "uri": uri,
        "qr_code": qr_code,
        "message": "Scannez ce QR Code dans votre application d'authentification (Google Authenticator, Microsoft Authenticator, FreeOTP) puis saisissez le code à 6 chiffres.",
    }


@router.post("/client/auth/verify")
def verify_client_totp(body: ClientAuthVerifyIn, db: Session = Depends(get_db)):
    clean_email = str(body.email).strip().lower()
    acc = db.scalar(select(ClientAccount).where(ClientAccount.email == clean_email))
    if not acc:
        raise HTTPException(404, "Aucun compte client trouvé pour cette adresse e-mail.")

    if not verify_totp(acc.totp_secret, body.code):
        raise HTTPException(
            401,
            "Code d'accès invalide ou expiré. Assurez-vous que l'heure de votre téléphone est synchronisée.",
        )

    acc.is_verified = True
    db.commit()

    token = create_client_token(acc.email, acc.name)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "email": acc.email,
            "name": acc.name,
        },
    }


# ------------------------------------------------------------------ Espace Client & Mes Billets (Sécurisé TOTP)
@router.get("/client/orders")
def get_client_orders(
    client: dict = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    clean_email = client["sub"]

    orders = db.scalars(
        select(Order)
        .where(Order.customer_email == clean_email)
        .order_by(Order.id.desc())
    ).all()

    result = []
    for o in orders:
        tickets_data = []
        if o.status == "ACCEPTED" and o.tickets:
            imgs = ticket_images(o.tickets)
            for n, p in imgs:
                tickets_data.append({
                    "number": n,
                    "qr_image": "data:image/png;base64," + base64.b64encode(p).decode(),
                })

        org_name = o.concert.organizer.name if o.concert and o.concert.organizer else "ITIX"
        org_slug = o.concert.organizer.slug if o.concert and o.concert.organizer else "itix"

        result.append({
            "id": o.id,
            "reference": o.reference,
            "concert_name": o.concert.name if o.concert else "",
            "concert_venue": o.concert.venue if o.concert else "",
            "concert_date": o.concert.date.isoformat() if o.concert else "",
            "organizer_name": org_name,
            "organizer_slug": org_slug,
            "ticket_type_name": o.ticket_type.name if o.ticket_type else "",
            "quantity": o.quantity,
            "unit_price": o.unit_price,
            "total_amount": o.total_amount,
            "status": o.status,  # PENDING, ACCEPTED, REJECTED
            "payment_status": o.payment_status,  # UNPAID, PROOF_SUBMITTED, PAID
            "pay_mode": o.pay_mode,
            "reject_reason": o.reject_reason,
            "created_at": o.created_at.isoformat(),
            "tickets": tickets_data,
            "email_available": smtp_configured(),
        })

    return {"orders": result}


@router.post("/client/orders/{order_id}/resend-email")
def client_resend_email(
    order_id: int,
    bg: BackgroundTasks,
    client: dict = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    clean_email = client["sub"]
    o = db.scalar(select(Order).where(Order.id == order_id, Order.customer_email == clean_email))
    if not o:
        raise HTTPException(404, "Commande introuvable pour cette adresse e-mail.")
    if o.status != "ACCEPTED":
        raise HTTPException(400, "Cette commande n'a pas encore été acceptée par l'administrateur.")

    images = ticket_images(o.tickets)
    date_txt = o.concert.date.strftime("%d/%m/%Y à %H:%M")
    is_paid = (o.payment_status == "PAID")
    bg.add_task(
        send_tickets_email,
        o.customer_email,
        o.customer_name,
        o.concert.name,
        date_txt,
        o.concert.venue,
        o.ticket_type.name,
        images,
        is_paid,
        o.unit_price,
    )
    return {"message": f"E-mail avec billets et QR Codes renvoyé à {o.customer_email}."}


# ------------------------------------------------------------------ Messagerie Support Client
class ClientMessageIn(BaseModel):
    customer_email: EmailStr
    customer_name: str = Field(..., min_length=2, max_length=120)
    order_reference: str | None = None
    concert_id: int | None = None
    subject: str = Field(..., min_length=3, max_length=150)
    message: str = Field(..., min_length=5, max_length=2000)


@router.post("/client/messages", status_code=201)
def create_support_message(body: ClientMessageIn, db: Session = Depends(get_db)):
    effective_org_id = None
    effective_cid = body.concert_id

    # Si un numéro de commande est fourni mais pas de concert_id
    if not effective_cid and body.order_reference:
        order = db.scalar(select(Order).where(Order.reference == body.order_reference.strip()))
        if order:
            effective_cid = order.concert_id

    if effective_cid:
        concert = db.get(Concert, effective_cid)
        if concert:
            effective_org_id = concert.organizer_id

    msg = SupportMessage(
        customer_email=str(body.customer_email).lower().strip(),
        customer_name=body.customer_name.strip(),
        order_reference=body.order_reference.strip() if body.order_reference else None,
        concert_id=effective_cid,
        organizer_id=effective_org_id,
        subject=body.subject.strip(),
        message=body.message.strip(),
    )
    db.add(msg)
    db.commit()
    return {
        "id": msg.id,
        "message": "Votre message a été transmis à l'équipe organisatrice. Nous vous répondrons rapidement.",
        "created_at": msg.created_at.isoformat(),
    }


@router.get("/client/messages")
def list_client_messages(email: str, db: Session = Depends(get_db)):
    clean_email = email.strip().lower()
    if not clean_email:
        raise HTTPException(400, "Adresse e-mail requise.")

    msgs = db.scalars(
        select(SupportMessage)
        .where(SupportMessage.customer_email == clean_email)
        .order_by(SupportMessage.id.desc())
    ).all()

    return [
        {
            "id": m.id,
            "subject": m.subject,
            "message": m.message,
            "order_reference": m.order_reference,
            "admin_reply": m.admin_reply,
            "replied_at": m.replied_at.isoformat() if m.replied_at else None,
            "is_resolved": m.is_resolved,
            "created_at": m.created_at.isoformat(),
        }
        for m in msgs
    ]


# ------------------------------------------------------------------ Messagerie Instantanée (Chat)
class ChatMessageIn(BaseModel):
    customer_email: EmailStr | None = None
    customer_name: str | None = None
    concert_id: int | None = None
    message: str = Field(..., min_length=1, max_length=2000)


@router.get("/client/chat")
def get_chat_history(
    client: dict = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    clean_email = client["sub"]

    messages = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.customer_email == clean_email)
        .order_by(ChatMessage.created_at.asc())
    ).all()

    return [
        {
            "id": m.id,
            "customer_email": m.customer_email,
            "customer_name": m.customer_name,
            "sender": m.sender,
            "message": m.message,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


@router.post("/client/chat", status_code=201)
def post_chat_message(
    body: ChatMessageIn,
    client: dict = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    clean_email = client["sub"]
    cust_name = client.get("name") or body.customer_name or "Client"

    effective_org_id = None
    if body.concert_id:
        c = db.get(Concert, body.concert_id)
        if c:
            effective_org_id = c.organizer_id

    msg = ChatMessage(
        customer_email=clean_email,
        customer_name=cust_name,
        concert_id=body.concert_id,
        organizer_id=effective_org_id,
        sender="CLIENT",
        message=body.message.strip(),
    )
    db.add(msg)
    db.commit()
    return {
        "id": msg.id,
        "customer_email": msg.customer_email,
        "customer_name": msg.customer_name,
        "sender": msg.sender,
        "message": msg.message,
        "created_at": msg.created_at.isoformat(),
    }


# ------------------------------------------------------------------ RGPD & CMIL Madagascar (Loi 2014-038)
class PrivacyRequestIn(BaseModel):
    customer_name: str = Field(..., min_length=2, max_length=120)
    customer_email: EmailStr
    request_type: Literal["ACCESS", "RECTIFICATION", "DELETION", "OPPOSITION"]
    details: str = Field(..., min_length=5, max_length=1000)


@router.post("/privacy/request", status_code=201)
def submit_privacy_request(body: PrivacyRequestIn, db: Session = Depends(get_db)):
    labels = {
        "ACCESS": "Droit d'accès",
        "RECTIFICATION": "Droit de rectification",
        "DELETION": "Droit à l'effacement / suppression",
        "OPPOSITION": "Droit d'opposition",
    }
    label = labels.get(body.request_type, body.request_type)
    msg = SupportMessage(
        customer_email=str(body.customer_email).lower().strip(),
        customer_name=body.customer_name.strip(),
        subject=f"[RGPD/CMIL - {label}] Exercice des droits sur les données personnelles",
        message=f"Type de demande : {label} ({body.request_type})\n\nDétails :\n{body.details.strip()}",
    )
    db.add(msg)
    db.commit()
    return {
        "message": (
            "Votre demande d'exercice de vos droits (conforme RGPD et Loi n° 2014-038 / CMIL Madagascar) "
            "a été enregistrée avec succès. Notre équipe vous apportera une réponse sous un délai légal de 30 jours."
        ),
        "request_id": msg.id,
    }
