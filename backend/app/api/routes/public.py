import secrets
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.timeutil import local_now
from app.db.session import get_db
from app.models.entities import Concert, Order, StoredFile, TicketType
from app.services.files import save_image
from app.services.presenters import concert_out, sold_map

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
    proof: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
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
        reference=_new_reference(db), concert_id=concert_id, ticket_type_id=tt.id,
        customer_name=customer_name.strip(), customer_email=str(customer_email).lower(),
        quantity=quantity, unit_price=tt.price, total_amount=tt.price * quantity,
        pay_mode=pay_mode, proof_file_id=proof_file.id if proof_file else None,
        payment_status="PROOF_SUBMITTED" if proof_file else "UNPAID",
    )
    db.add(order)
    db.commit()
    return {"reference": order.reference, "quantity": order.quantity,
            "total_amount": order.total_amount, "customer_email": order.customer_email,
            "pay_mode": order.pay_mode}


# ------------------------------------------------------------------ Espace Client & Mes Billets
import base64
from fastapi import BackgroundTasks
from pydantic import BaseModel, Field
from app.models.entities import SupportMessage
from app.services.mailer import send_tickets_email, smtp_configured
from app.services.tickets import ticket_images


@router.get("/client/orders")
def get_client_orders(email: str, db: Session = Depends(get_db)):
    clean_email = email.strip().lower()
    if not clean_email:
        raise HTTPException(400, "Adresse e-mail requise.")

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

        result.append({
            "id": o.id,
            "reference": o.reference,
            "concert_name": o.concert.name,
            "concert_venue": o.concert.venue,
            "concert_date": o.concert.date.isoformat(),
            "ticket_type_name": o.ticket_type.name,
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
def client_resend_email(order_id: int, email: str, bg: BackgroundTasks, db: Session = Depends(get_db)):
    clean_email = email.strip().lower()
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
    subject: str = Field(..., min_length=3, max_length=150)
    message: str = Field(..., min_length=5, max_length=2000)


@router.post("/client/messages", status_code=201)
def create_support_message(body: ClientMessageIn, db: Session = Depends(get_db)):
    msg = SupportMessage(
        customer_email=str(body.customer_email).lower().strip(),
        customer_name=body.customer_name.strip(),
        order_reference=body.order_reference.strip() if body.order_reference else None,
        subject=body.subject.strip(),
        message=body.message.strip(),
    )
    db.add(msg)
    db.commit()
    return {
        "id": msg.id,
        "message": "Votre message a été envoyé à l'équipe. Nous vous répondrons rapidement.",
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


# ------------------------------------------------------------------ Messagerie Instantanée (Chat / SMS Style)
from app.models.entities import ChatMessage


class ChatMessageIn(BaseModel):
    customer_email: EmailStr
    customer_name: str = Field(..., min_length=2, max_length=120)
    message: str = Field(..., min_length=1, max_length=2000)


@router.get("/client/chat")
def get_chat_history(email: str, db: Session = Depends(get_db)):
    clean_email = email.strip().lower()
    if not clean_email:
        raise HTTPException(400, "Adresse e-mail requise.")

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
            "sender": m.sender,  # CLIENT | ADMIN
            "message": m.message,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


@router.post("/client/chat", status_code=201)
def post_chat_message(body: ChatMessageIn, db: Session = Depends(get_db)):
    msg = ChatMessage(
        customer_email=str(body.customer_email).lower().strip(),
        customer_name=body.customer_name.strip(),
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


