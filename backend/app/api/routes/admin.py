import base64
from datetime import datetime

from fastapi import (APIRouter, BackgroundTasks, Depends, File, Form, HTTPException,
                     Query, Response, UploadFile)
from pydantic import BaseModel, Field, TypeAdapter, ValidationError
from sqlalchemy import case, func, or_, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.config import get_settings
from app.core.security import decrypt_ticket
from app.core.timeutil import local_now
from app.db.session import get_db
from app.models.entities import Concert, Order, StoredFile, Ticket, TicketType
from app.services.files import save_image
from app.services.mailer import send_test_email, send_tickets_email, smtp_configured
from app.services.presenters import concert_out, order_out, sold_map
from app.services.tickets import ticket_images

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])



# ------------------------------------------------------------------ Concerts
class TicketTypeIn(BaseModel):
    id: int | None = None
    name: str = Field(min_length=1, max_length=60)
    price: int = Field(ge=0)
    quantity: int = Field(ge=1)


def _parse_types(raw: str, total_seats: int) -> list[TicketTypeIn]:
    try:
        types = TypeAdapter(list[TicketTypeIn]).validate_json(raw)
    except ValidationError:
        raise HTTPException(422, "Types de billets invalides.")
    if not types:
        raise HTTPException(422, "Ajoutez au moins un type de billet.")
    if sum(t.quantity for t in types) > total_seats:
        raise HTTPException(422, "Le total des types de billets dépasse le nombre de places.")
    return types


@router.post("/concerts", status_code=201)
def create_concert(
    name: str = Form(..., min_length=1, max_length=150), description: str = Form(""),
    venue: str = Form(..., min_length=1, max_length=200), date: datetime = Form(...),
    total_seats: int = Form(..., ge=1), ticket_types: str = Form(...),
    poster: UploadFile | None = File(None), db: Session = Depends(get_db),
):
    types = _parse_types(ticket_types, total_seats)
    c = Concert(name=name.strip(), description=description, venue=venue.strip(),
                date=date.replace(tzinfo=None), total_seats=total_seats)
    c.ticket_types = [TicketType(name=t.name, price=t.price, quantity=t.quantity) for t in types]
    if poster and poster.filename:
        c.poster_file_id = save_image(db, poster).id
    db.add(c)
    db.commit()
    return concert_out(c, {})


@router.put("/concerts/{concert_id}")
def update_concert(
    concert_id: int,
    name: str = Form(..., min_length=1, max_length=150), description: str = Form(""),
    venue: str = Form(..., min_length=1, max_length=200), date: datetime = Form(...),
    total_seats: int = Form(..., ge=1), ticket_types: str = Form(...),
    poster: UploadFile | None = File(None), db: Session = Depends(get_db),
):
    c = db.get(Concert, concert_id)
    if not c:
        raise HTTPException(404, "Concert introuvable.")
    types = _parse_types(ticket_types, total_seats)
    sold = sold_map(db)
    existing = {t.id: t for t in c.ticket_types}
    keep: set[int] = set()
    for t in types:
        if t.id and t.id in existing:
            row = existing[t.id]
            if t.quantity < sold.get(row.id, 0):
                raise HTTPException(409, f"« {row.name} » : {sold.get(row.id, 0)} places déjà commandées.")
            row.name, row.price, row.quantity = t.name, t.price, t.quantity
            keep.add(row.id)
        else:
            c.ticket_types.append(TicketType(name=t.name, price=t.price, quantity=t.quantity))
    for tid, row in existing.items():
        if tid not in keep:
            if db.scalar(select(func.count()).select_from(Order).where(Order.ticket_type_id == tid)):
                raise HTTPException(409, f"« {row.name} » a des commandes : suppression impossible.")
            c.ticket_types.remove(row)
    c.name, c.description, c.venue = name.strip(), description, venue.strip()
    c.date, c.total_seats = date.replace(tzinfo=None), total_seats
    if poster and poster.filename:
        old = c.poster_file_id
        c.poster_file_id = save_image(db, poster).id
        db.flush()
        if old and (f := db.get(StoredFile, old)):
            db.delete(f)
    db.commit()
    return concert_out(c, sold_map(db))


@router.delete("/concerts/{concert_id}", status_code=204)
def delete_concert(concert_id: int, db: Session = Depends(get_db)):
    c = db.get(Concert, concert_id)
    if not c:
        raise HTTPException(404, "Concert introuvable.")
    if db.scalar(select(func.count()).select_from(Order).where(Order.concert_id == concert_id)):
        raise HTTPException(409, "Ce concert a des commandes : suppression impossible.")
    poster = db.get(StoredFile, c.poster_file_id) if c.poster_file_id else None
    db.delete(c)
    if poster:
        db.delete(poster)
    db.commit()
    return Response(status_code=204)


# ------------------------------------------------------------------ Dashboard
@router.get("/dashboard")
def dashboard(concert_id: int | None = None, db: Session = Depends(get_db)):
    q = select(Concert).order_by(Concert.date)
    if concert_id:
        q = q.where(Concert.id == concert_id)
    concerts = db.scalars(q).all()
    ids = [c.id for c in concerts]

    active = Order.status != "REJECTED"
    paid = Order.payment_status == "PAID"
    rows = db.execute(
        select(
            Order.concert_id,
            func.coalesce(func.sum(Order.quantity), 0),
            func.coalesce(func.sum(case((paid, Order.quantity), else_=0)), 0),
            func.coalesce(func.sum(case((paid, Order.total_amount), else_=0)), 0),
            func.coalesce(func.sum(case((paid, 0), else_=Order.total_amount)), 0),
        ).where(Order.concert_id.in_(ids), active).group_by(Order.concert_id)
    ).all()
    agg = {r[0]: r[1:] for r in rows}
    counts: dict[str, int] = {"PENDING": 0, "ACCEPTED": 0, "REJECTED": 0}
    for st, n in db.execute(select(Order.status, func.count()).where(Order.concert_id.in_(ids)).group_by(Order.status)):
        counts[st] = n
    t_gen, t_used = db.execute(
        select(func.count(), func.coalesce(func.sum(case((Ticket.status == "USED", 1), else_=0)), 0))
        .where(Ticket.concert_id.in_(ids))
    ).one()

    per_concert = []
    for c in concerts:
        ordered, paid_q, rev_paid, rev_pending = (int(x) for x in agg.get(c.id, (0, 0, 0, 0)))
        per_concert.append({
            "id": c.id, "name": c.name, "date": c.date, "total_seats": c.total_seats,
            "ordered": ordered, "paid": paid_q, "unpaid": ordered - paid_q,
            "remaining": c.total_seats - ordered,
            "revenue_paid": rev_paid, "revenue_pending": rev_pending,
        })
    total = {k: sum(p[k] for p in per_concert) for k in
             ("total_seats", "ordered", "paid", "unpaid", "remaining", "revenue_paid", "revenue_pending")}
    return {"totals": {**total, "orders_pending": counts["PENDING"], "orders_accepted": counts["ACCEPTED"],
                       "orders_rejected": counts["REJECTED"], "tickets_generated": int(t_gen),
                       "tickets_used": int(t_used)},
            "per_concert": per_concert}


# ------------------------------------------------------------------ Commandes
@router.get("/orders")
def list_orders(
    concert_id: int | None = None, status: str | None = None, payment: str | None = None,
    q: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(15, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = select(Order)
    if concert_id:
        stmt = stmt.where(Order.concert_id == concert_id)
    if status == "ACTIVE":  # commandées = en attente + acceptées
        stmt = stmt.where(Order.status != "REJECTED")
    elif status:
        stmt = stmt.where(Order.status == status)
    if payment == "NOT_PAID":
        stmt = stmt.where(Order.payment_status != "PAID")
    elif payment:
        stmt = stmt.where(Order.payment_status == payment)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Order.customer_name.ilike(like), Order.customer_email.ilike(like),
                              Order.reference.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(stmt.order_by(Order.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [order_out(o) for o in items], "total": total, "page": page, "page_size": page_size}


def _get_order(db: Session, order_id: int, lock: bool = False) -> Order:
    stmt = select(Order).where(Order.id == order_id)
    o = db.scalar(stmt.with_for_update() if lock else stmt)
    if not o:
        raise HTTPException(404, "Commande introuvable.")
    return o


@router.get("/orders/{order_id}")
def order_detail(order_id: int, db: Session = Depends(get_db)):
    return order_out(_get_order(db, order_id))


@router.get("/orders/{order_id}/proof")
def order_proof(order_id: int, db: Session = Depends(get_db)):
    o = _get_order(db, order_id)
    f = db.get(StoredFile, o.proof_file_id) if o.proof_file_id else None
    if not f:
        raise HTTPException(404, "Aucune preuve de paiement pour cette commande.")
    return Response(f.data, media_type=f.content_type, headers={"Cache-Control": "private, no-store"})


class AcceptIn(BaseModel):
    mark_paid: bool = False


def _delivery(o: Order, bg: BackgroundTasks) -> dict:
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
    return {
        "order": order_out(o),
        "tickets": [{"number": n, "qr_image": "data:image/png;base64," + base64.b64encode(p).decode()}
                    for n, p in images],
        "email_status": "queued" if smtp_configured() else "smtp_not_configured",
    }


@router.post("/orders/{order_id}/accept")
def accept_order(order_id: int, body: AcceptIn, bg: BackgroundTasks, db: Session = Depends(get_db)):
    o = _get_order(db, order_id, lock=True)
    if o.status != "PENDING":
        raise HTTPException(409, "Cette commande a déjà été traitée.")
    o.status, o.processed_at = "ACCEPTED", local_now()
    if body.mark_paid:
        o.payment_status = "PAID"
    new = [Ticket(order_id=o.id, concert_id=o.concert_id) for _ in range(o.quantity)]
    db.add_all(new)
    db.flush()
    for t in new:
        t.number = f"TCK-{t.id:06d}"
    db.commit()
    db.refresh(o)
    return _delivery(o, bg)


@router.post("/orders/{order_id}/resend")
def resend_tickets(order_id: int, bg: BackgroundTasks, db: Session = Depends(get_db)):
    o = _get_order(db, order_id)
    if o.status != "ACCEPTED":
        raise HTTPException(409, "Seules les commandes acceptées ont des billets.")
    return _delivery(o, bg)


class RejectIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


@router.post("/orders/{order_id}/reject")
def reject_order(order_id: int, body: RejectIn, db: Session = Depends(get_db)):
    o = _get_order(db, order_id, lock=True)
    if o.status != "PENDING":
        raise HTTPException(409, "Cette commande a déjà été traitée.")
    o.status, o.reject_reason, o.processed_at = "REJECTED", body.reason.strip(), local_now()
    db.commit()
    return order_out(o)


@router.post("/orders/{order_id}/mark-paid")
def mark_paid(order_id: int, db: Session = Depends(get_db)):
    o = _get_order(db, order_id, lock=True)
    if o.status != "ACCEPTED":
        raise HTTPException(409, "La commande doit d'abord être acceptée.")
    o.payment_status = "PAID"
    db.commit()
    return order_out(o)


# ------------------------------------------------------------------ Scan QR
class ScanIn(BaseModel):
    token: str = Field(min_length=1, max_length=2000)
    mark_used: bool = True


@router.post("/scan")
def scan(body: ScanIn, db: Session = Depends(get_db)):
    """Le backend est la seule autorité : il déchiffre, retrouve le billet, contrôle paiement et usage."""
    pid = decrypt_ticket(body.token)
    t = db.scalar(select(Ticket).where(Ticket.public_id == pid)) if pid else None
    if not t:
        return {"result": "INVALID", "message": "Ce QR Code ne correspond à aucun billet.", "ticket": None}
    o = t.order

    def info() -> dict:
        return {
            "number": t.number,
            "customer_name": o.customer_name,
            "ticket_type": o.ticket_type.name,
            "unit_price": o.unit_price,
            "concert_name": o.concert.name,
            "concert_date": o.concert.date,
            "payment_status": o.payment_status,
            "used_at": t.used_at,
        }

    if t.status == "USED":
        return {"result": "ALREADY_USED", "message": "Ce billet a déjà été présenté et utilisé.", "ticket": info()}

    if body.mark_used:
        # Mise à jour atomique : un seul des scans simultanés peut passer de VALID à USED.
        res = db.execute(update(Ticket).where(Ticket.id == t.id, Ticket.status == "VALID")
                         .values(status="USED", used_at=local_now()))
        db.commit()
        db.refresh(t)
        if res.rowcount == 0:
            return {"result": "ALREADY_USED", "message": "Ce billet a déjà été présenté et utilisé.", "ticket": info()}

    if o.payment_status != "PAID":
        formatted_price = f"{o.unit_price:,}".replace(",", " ")
        return {
            "result": "RESERVATION",
            "message": f"🎟️ Réservation valide — À encaisser sur place : {formatted_price} Ar",
            "ticket": info(),
        }

    return {"result": "VALID", "message": "✓ Billet valide : entrée autorisée (Paiement validé).", "ticket": info()}


# ------------------------------------------------------------------ E-mail & SMTP Diagnostics
class TestEmailIn(BaseModel):
    recipient: str = Field(..., min_length=3, max_length=255)


@router.get("/email/status")
def get_email_status():
    s = get_settings()
    return {
        "configured": smtp_configured(),
        "smtp_host": s.smtp_host,
        "smtp_port": s.smtp_port,
        "smtp_from": s.smtp_from,
        "smtp_username": s.smtp_username,
        "has_password": bool(s.smtp_password),
    }


@router.post("/email/test")
def test_email(body: TestEmailIn):
    result = send_test_email(body.recipient.strip())
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result)
    return result


# ------------------------------------------------------------------ Support & Messages
from app.models.entities import SupportMessage


@router.get("/messages")
def list_admin_messages(db: Session = Depends(get_db)):
    msgs = db.scalars(select(SupportMessage).order_by(SupportMessage.id.desc())).all()
    return [
        {
            "id": m.id,
            "customer_name": m.customer_name,
            "customer_email": m.customer_email,
            "order_reference": m.order_reference,
            "subject": m.subject,
            "message": m.message,
            "admin_reply": m.admin_reply,
            "replied_at": m.replied_at.isoformat() if m.replied_at else None,
            "is_resolved": m.is_resolved,
            "created_at": m.created_at.isoformat(),
        }
        for m in msgs
    ]


class ReplyIn(BaseModel):
    reply: str = Field(..., min_length=2, max_length=2000)


@router.post("/messages/{msg_id}/reply")
def reply_admin_message(msg_id: int, body: ReplyIn, db: Session = Depends(get_db)):
    m = db.get(SupportMessage, msg_id)
    if not m:
        raise HTTPException(404, "Message introuvable.")
    m.admin_reply = body.reply.strip()
    m.replied_at = local_now()
    m.is_resolved = True
    db.commit()
    return {"message": "Réponse enregistrée."}


@router.post("/messages/{msg_id}/toggle-resolved")
def toggle_resolved_message(msg_id: int, db: Session = Depends(get_db)):
    m = db.get(SupportMessage, msg_id)
    if not m:
        raise HTTPException(404, "Message introuvable.")
    m.is_resolved = not m.is_resolved
    db.commit()
    return {"is_resolved": m.is_resolved}


# ------------------------------------------------------------------ Chat Admin (SMS / Messenger style)
from app.models.entities import ChatMessage


@router.get("/chat/conversations")
def list_chat_conversations(db: Session = Depends(get_db)):
    # Récupérer tous les messages ordonnés par date
    all_msgs = db.scalars(select(ChatMessage).order_by(ChatMessage.created_at.desc())).all()
    convs: dict[str, dict] = {}
    for m in all_msgs:
        if m.customer_email not in convs:
            convs[m.customer_email] = {
                "customer_email": m.customer_email,
                "customer_name": m.customer_name,
                "last_message": m.message,
                "last_sender": m.sender,
                "last_at": m.created_at.isoformat(),
            }
    return list(convs.values())


@router.get("/chat/{customer_email}")
def get_admin_chat(customer_email: str, db: Session = Depends(get_db)):
    clean_email = customer_email.strip().lower()
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


class AdminChatMessageIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


@router.post("/chat/{customer_email}", status_code=201)
def post_admin_chat_reply(customer_email: str, body: AdminChatMessageIn, db: Session = Depends(get_db)):
    clean_email = customer_email.strip().lower()
    # Retrouver le nom du client depuis les messages existants ou "Client"
    last_msg = db.scalar(
        select(ChatMessage)
        .where(ChatMessage.customer_email == clean_email)
        .order_by(ChatMessage.id.desc())
    )
    cust_name = last_msg.customer_name if last_msg else "Client"

    msg = ChatMessage(
        customer_email=clean_email,
        customer_name=cust_name,
        sender="ADMIN",
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



