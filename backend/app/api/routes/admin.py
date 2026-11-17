import base64
import csv
import io
import secrets
from datetime import datetime

from fastapi import (APIRouter, BackgroundTasks, Depends, File, Form, HTTPException,
                     Query, Response, UploadFile)
from pydantic import BaseModel, EmailStr, Field, TypeAdapter, ValidationError
from sqlalchemy import case, func, or_, select, update
from sqlalchemy.orm import Session

from app.api.deps import (get_current_admin, require_admin_or_organizer,
                         require_scanner_access, require_super_admin)
from app.core.config import get_settings
from app.core.limiter import rate_limit
from app.core.security import decrypt_ticket, encrypt_ticket, hash_password
from app.core.timeutil import local_now
from app.db.session import get_db
from app.models.entities import (Admin, ChatMessage, Concert, Order, Payout,
                                 ROLE_ORGANIZER, ROLE_STAFF_SCANNER,
                                 ROLE_SUPER_ADMIN, StoredFile, SupportMessage,
                                 Ticket, TicketType, slugify)
from app.services.files import save_image
from app.services.mailer import send_test_email, send_tickets_email, smtp_configured
from app.services.presenters import concert_out, order_out, sold_map
from app.services.tickets import ticket_images

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])


def _check_concert_access(c: Concert, current: Admin) -> None:
    if current.role != ROLE_SUPER_ADMIN and c.organizer_id != current.id:
        raise HTTPException(403, "Accès refusé : vous n'êtes pas propriétaire de cet événement.")


def _get_order(db: Session, order_id: int, current: Admin, lock: bool = False) -> Order:
    stmt = select(Order).where(Order.id == order_id)
    o = db.scalar(stmt.with_for_update() if lock else stmt)
    if not o:
        raise HTTPException(404, "Commande introuvable.")
    if current.role != ROLE_SUPER_ADMIN and o.concert.organizer_id != current.id:
        raise HTTPException(403, "Accès refusé : cette commande appartient à un autre organisateur.")
    return o


# ------------------------------------------------------------------ Gestion des Organisateurs (Super Admin)
class CreateOrganizerIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=30)
    temp_password: str | None = Field(default=None, min_length=6, max_length=64)
    commission_rate: float = Field(default=5.0, ge=0.0, le=100.0)


class UpdateOrganizerIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    is_active: bool | None = None
    commission_rate: float | None = Field(default=None, ge=0.0, le=100.0)


@router.get("/organizers")
def list_organizers(
    current: Admin = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    orgs = db.scalars(
        select(Admin)
        .where(Admin.role.in_([ROLE_SUPER_ADMIN, ROLE_ORGANIZER]))
        .order_by(Admin.id.asc())
    ).all()
    result = []
    for org in orgs:
        c_count = db.scalar(select(func.count(Concert.id)).where(Concert.organizer_id == org.id)) or 0
        o_count = db.scalar(
            select(func.count(Order.id))
            .join(Concert, Order.concert_id == Concert.id)
            .where(Concert.organizer_id == org.id)
        ) or 0
        rev = db.scalar(
            select(func.coalesce(func.sum(Order.total_amount), 0))
            .join(Concert, Order.concert_id == Concert.id)
            .where(Concert.organizer_id == org.id, Order.payment_status == "PAID", Order.status != "REJECTED")
        ) or 0

        rate = org.commission_rate if org.commission_rate is not None else 5.0
        rev_int = int(rev)
        comm_total = int(rev_int * (rate / 100.0))
        net_total = rev_int - comm_total
        payouts_total = int(
            db.scalar(select(func.coalesce(func.sum(Payout.amount), 0)).where(Payout.organizer_id == org.id)) or 0
        )
        balance_due = net_total - payouts_total

        result.append({
            "id": org.id,
            "name": org.name,
            "email": org.email,
            "phone": org.phone,
            "role": org.role,
            "slug": org.slug,
            "is_active": org.is_active,
            "commission_rate": rate,
            "commission_total": comm_total,
            "revenue_total": rev_int,
            "revenue_net": net_total,
            "payouts_total": payouts_total,
            "balance_due": balance_due,
            "must_change_password": org.must_change_password,
            "totp_enabled": org.totp_enabled,
            "concerts_count": c_count,
            "orders_count": o_count,
            "created_at": org.created_at.isoformat() if org.created_at else None,
        })
    return result


@router.post("/organizers", status_code=201)
def create_organizer(
    body: CreateOrganizerIn,
    current: Admin = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    clean_email = str(body.email).strip().lower()
    if db.scalar(select(Admin.id).where(Admin.email == clean_email)):
        raise HTTPException(409, "Un compte avec cette adresse e-mail existe déjà.")

    # Génération du slug unique
    base_slug = slugify(body.name)
    slug = base_slug
    idx = 1
    while db.scalar(select(Admin.id).where(Admin.slug == slug)):
        slug = f"{base_slug}-{idx}"
        idx += 1

    temp_pass = body.temp_password.strip() if body.temp_password else secrets.token_urlsafe(8)

    org = Admin(
        name=body.name.strip(),
        email=clean_email,
        phone=body.phone.strip() if body.phone else None,
        role=ROLE_ORGANIZER,
        slug=slug,
        password_hash=hash_password(temp_pass),
        commission_rate=body.commission_rate,
        must_change_password=True,
        is_active=True,
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    return {
        "id": org.id,
        "name": org.name,
        "email": org.email,
        "phone": org.phone,
        "role": org.role,
        "slug": org.slug,
        "commission_rate": org.commission_rate,
        "temporary_password": temp_pass,
        "must_change_password": org.must_change_password,
        "message": "Compte organisateur créé avec succès. Transmettez le mot de passe temporaire.",
    }


@router.put("/organizers/{organizer_id}")
def update_organizer(
    organizer_id: int,
    body: UpdateOrganizerIn,
    current: Admin = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    org = db.get(Admin, organizer_id)
    if not org:
        raise HTTPException(404, "Organisateur introuvable.")
    if body.name is not None:
        org.name = body.name.strip()
    if body.phone is not None:
        org.phone = body.phone.strip() if body.phone else None
    if body.is_active is not None:
        org.is_active = body.is_active
    if body.commission_rate is not None:
        org.commission_rate = body.commission_rate
    db.commit()
    return {
        "message": "Organisateur mis à jour.",
        "id": org.id,
        "name": org.name,
        "is_active": org.is_active,
        "commission_rate": org.commission_rate,
    }


@router.post("/organizers/{organizer_id}/reset-password")
def reset_organizer_password(
    organizer_id: int,
    current: Admin = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    org = db.get(Admin, organizer_id)
    if not org:
        raise HTTPException(404, "Organisateur introuvable.")

    new_temp_pass = secrets.token_urlsafe(8)
    org.password_hash = hash_password(new_temp_pass)
    org.must_change_password = True
    db.commit()
    return {
        "temporary_password": new_temp_pass,
        "message": f"Nouveau mot de passe temporaire généré pour {org.email}.",
    }


@router.delete("/organizers/{organizer_id}", status_code=200)
def delete_or_deactivate_organizer(
    organizer_id: int,
    current: Admin = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    if organizer_id == current.id:
        raise HTTPException(400, "Vous ne pouvez pas supprimer votre propre compte Super Admin.")
    org = db.get(Admin, organizer_id)
    if not org:
        raise HTTPException(404, "Organisateur introuvable.")

    has_orders = db.scalar(
        select(func.count(Order.id))
        .join(Concert, Order.concert_id == Concert.id)
        .where(Concert.organizer_id == org.id)
    )
    if has_orders:
        org.is_active = False
        db.commit()
        return {"message": "L'organisateur a des commandes existantes : son compte a été désactivé."}

    db.delete(org)
    db.commit()
    return {"message": "Compte organisateur supprimé avec succès."}


# ------------------------------------------------------------------ Modèle Économique : Commissions & Reversements (Payouts)
class CreatePayoutIn(BaseModel):
    organizer_id: int
    amount: int = Field(..., ge=1000)
    payment_method: str = Field(..., min_length=2, max_length=30)
    reference: str = Field(..., min_length=2, max_length=100)
    notes: str | None = None


@router.get("/payouts")
def list_payouts(
    organizer_id: int | None = None,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    stmt = select(Payout).order_by(Payout.created_at.desc())
    if current.role == ROLE_ORGANIZER:
        stmt = stmt.where(Payout.organizer_id == current.id)
    elif current.role == ROLE_SUPER_ADMIN and organizer_id:
        stmt = stmt.where(Payout.organizer_id == organizer_id)

    payouts = db.scalars(stmt).all()
    return [
        {
            "id": p.id,
            "organizer_id": p.organizer_id,
            "organizer_name": p.organizer.name if p.organizer else "Organisateur",
            "amount": p.amount,
            "payment_method": p.payment_method,
            "reference": p.reference,
            "notes": p.notes,
            "created_at": p.created_at.isoformat(),
        }
        for p in payouts
    ]


@router.post("/payouts", status_code=201)
def create_payout(
    body: CreatePayoutIn,
    current: Admin = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    org = db.get(Admin, body.organizer_id)
    if not org or org.role != ROLE_ORGANIZER:
        raise HTTPException(404, "Organisateur introuvable.")

    p = Payout(
        organizer_id=body.organizer_id,
        amount=body.amount,
        payment_method=body.payment_method.strip().upper(),
        reference=body.reference.strip(),
        notes=body.notes.strip() if body.notes else None,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return {
        "id": p.id,
        "organizer_id": p.organizer_id,
        "organizer_name": org.name,
        "amount": p.amount,
        "payment_method": p.payment_method,
        "reference": p.reference,
        "created_at": p.created_at.isoformat(),
        "message": f"Reversement de {p.amount:,} Ar enregistré avec succès.".replace(",", " "),
    }


# ------------------------------------------------------------------ Sous-Comptes Staff Scanner
class CreateStaffIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=64)
    assigned_concert_id: int | None = None


@router.get("/staff")
def list_staff(
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    stmt = select(Admin).where(Admin.role == ROLE_STAFF_SCANNER).order_by(Admin.id.desc())
    if current.role == ROLE_ORGANIZER:
        stmt = stmt.where(Admin.parent_organizer_id == current.id)

    staff_list = db.scalars(stmt).all()
    result = []
    for s in staff_list:
        concert = db.get(Concert, s.assigned_concert_id) if s.assigned_concert_id else None
        result.append({
            "id": s.id,
            "name": s.name,
            "email": s.email,
            "role": s.role,
            "parent_organizer_id": s.parent_organizer_id,
            "assigned_concert_id": s.assigned_concert_id,
            "assigned_concert_name": concert.name if concert else None,
            "is_active": s.is_active,
            "created_at": s.created_at.isoformat(),
        })
    return result


@router.post("/staff", status_code=201)
def create_staff(
    body: CreateStaffIn,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    clean_email = str(body.email).strip().lower()
    if db.scalar(select(Admin.id).where(Admin.email == clean_email)):
        raise HTTPException(409, "Un compte avec cette adresse e-mail existe déjà.")

    if body.assigned_concert_id:
        c = db.get(Concert, body.assigned_concert_id)
        if not c:
            raise HTTPException(404, "Concert assigné introuvable.")
        if current.role == ROLE_ORGANIZER and c.organizer_id != current.id:
            raise HTTPException(403, "Vous ne pouvez assigner que vos propres concerts.")

    staff = Admin(
        name=body.name.strip(),
        email=clean_email,
        role=ROLE_STAFF_SCANNER,
        password_hash=hash_password(body.password),
        parent_organizer_id=current.id if current.role == ROLE_ORGANIZER else None,
        assigned_concert_id=body.assigned_concert_id,
        must_change_password=False,
        is_active=True,
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return {
        "id": staff.id,
        "name": staff.name,
        "email": staff.email,
        "role": staff.role,
        "assigned_concert_id": staff.assigned_concert_id,
        "message": f"Sous-compte contrôleur créé pour {staff.name}.",
    }


@router.delete("/staff/{staff_id}", status_code=204)
def delete_staff(
    staff_id: int,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    staff = db.get(Admin, staff_id)
    if not staff or staff.role != ROLE_STAFF_SCANNER:
        raise HTTPException(404, "Compte contrôleur introuvable.")
    if current.role == ROLE_ORGANIZER and staff.parent_organizer_id != current.id:
        raise HTTPException(403, "Accès refusé.")

    db.delete(staff)
    db.commit()
    return Response(status_code=204)


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


@router.get("/concerts")
def list_admin_concerts(
    organizer_id: int | None = None,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    stmt = select(Concert).order_by(Concert.date.desc())
    if current.role == ROLE_ORGANIZER:
        stmt = stmt.where(Concert.organizer_id == current.id)
    elif current.role == ROLE_SUPER_ADMIN and organizer_id:
        stmt = stmt.where(Concert.organizer_id == organizer_id)

    concerts = db.scalars(stmt).all()
    sold = sold_map(db)
    return [concert_out(c, sold) for c in concerts]


@router.post("/concerts", status_code=201)
def create_concert(
    name: str = Form(..., min_length=1, max_length=150),
    description: str = Form(""),
    venue: str = Form(..., min_length=1, max_length=200),
    date: datetime = Form(...),
    total_seats: int = Form(..., ge=1),
    ticket_types: str = Form(...),
    organizer_id: int | None = Form(None),
    poster: UploadFile | None = File(None),
    current: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    types = _parse_types(ticket_types, total_seats)

    # Déterminer l'organisateur propriétaire
    if current.role == ROLE_SUPER_ADMIN and organizer_id:
        target_org = db.get(Admin, organizer_id)
        if not target_org:
            raise HTTPException(404, "Organisateur cible introuvable.")
        effective_org_id = target_org.id
    else:
        effective_org_id = current.id

    c = Concert(
        name=name.strip(),
        description=description,
        venue=venue.strip(),
        date=date.replace(tzinfo=None),
        total_seats=total_seats,
        organizer_id=effective_org_id,
    )
    c.ticket_types = [TicketType(name=t.name, price=t.price, quantity=t.quantity) for t in types]
    if poster and poster.filename:
        c.poster_file_id = save_image(db, poster).id
    db.add(c)
    db.commit()
    db.refresh(c)
    return concert_out(c, {})


@router.put("/concerts/{concert_id}")
def update_concert(
    concert_id: int,
    name: str = Form(..., min_length=1, max_length=150),
    description: str = Form(""),
    venue: str = Form(..., min_length=1, max_length=200),
    date: datetime = Form(...),
    total_seats: int = Form(..., ge=1),
    ticket_types: str = Form(...),
    organizer_id: int | None = Form(None),
    poster: UploadFile | None = File(None),
    current: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    c = db.get(Concert, concert_id)
    if not c:
        raise HTTPException(404, "Concert introuvable.")
    _check_concert_access(c, current)

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

    if current.role == ROLE_SUPER_ADMIN and organizer_id is not None:
        c.organizer_id = organizer_id

    if poster and poster.filename:
        old = c.poster_file_id
        c.poster_file_id = save_image(db, poster).id
        db.flush()
        if old and (f := db.get(StoredFile, old)):
            db.delete(f)
    db.commit()
    return concert_out(c, sold_map(db))


@router.delete("/concerts/{concert_id}", status_code=204)
def delete_concert(
    concert_id: int,
    current: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    c = db.get(Concert, concert_id)
    if not c:
        raise HTTPException(404, "Concert introuvable.")
    _check_concert_access(c, current)

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
def dashboard(
    concert_id: int | None = None,
    organizer_id: int | None = None,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    q = select(Concert).order_by(Concert.date)
    if current.role == ROLE_ORGANIZER:
        q = q.where(Concert.organizer_id == current.id)
    elif current.role == ROLE_SUPER_ADMIN and organizer_id:
        q = q.where(Concert.organizer_id == organizer_id)

    if concert_id:
        q = q.where(Concert.id == concert_id)

    concerts = db.scalars(q).all()
    ids = [c.id for c in concerts]

    if not ids:
        empty_total = {
            "total_seats": 0, "ordered": 0, "paid": 0, "unpaid": 0,
            "remaining": 0, "revenue_paid": 0, "revenue_pending": 0,
            "commission_amount": 0, "net_revenue": 0,
            "orders_pending": 0, "orders_accepted": 0, "orders_rejected": 0,
            "tickets_generated": 0, "tickets_used": 0,
            "overall_fill_rate": 0.0, "overall_attendance_rate": 0.0,
            "payouts_total": 0, "balance_due": 0,
        }
        return {"totals": empty_total, "per_concert": []}

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
        fill_rate = round((ordered / c.total_seats) * 100, 1) if c.total_seats > 0 else 0.0
        c_used = db.scalar(select(func.count(Ticket.id)).where(Ticket.concert_id == c.id, Ticket.status == "USED")) or 0
        c_tck = db.scalar(select(func.count(Ticket.id)).where(Ticket.concert_id == c.id)) or 0
        attendance_rate = round((c_used / c_tck) * 100, 1) if c_tck > 0 else 0.0
        comm_rate = c.organizer.commission_rate if c.organizer else 5.0
        comm_amount = int(round(rev_paid * (comm_rate / 100.0)))
        net_org = rev_paid - comm_amount
        per_concert.append({
            "id": c.id, "name": c.name, "date": c.date, "total_seats": c.total_seats,
            "organizer_name": c.organizer.name if c.organizer else "ITIX",
            "ordered": ordered, "paid": paid_q, "unpaid": ordered - paid_q,
            "remaining": c.total_seats - ordered,
            "revenue_paid": rev_paid, "revenue_pending": rev_pending,
            "fill_rate": fill_rate,
            "attendance_rate": attendance_rate,
            "tickets_used": c_used,
            "tickets_generated": c_tck,
            "commission_rate": comm_rate,
            "commission_amount": comm_amount,
            "net_revenue": net_org,
        })
    total = {k: sum(p[k] for p in per_concert) for k in
             ("total_seats", "ordered", "paid", "unpaid", "remaining", "revenue_paid", "revenue_pending", "commission_amount", "net_revenue")}

    payout_stmt = select(func.coalesce(func.sum(Payout.amount), 0))
    if current.role == ROLE_ORGANIZER:
        payout_stmt = payout_stmt.where(Payout.organizer_id == current.id)
    elif current.role == ROLE_SUPER_ADMIN and organizer_id:
        payout_stmt = payout_stmt.where(Payout.organizer_id == organizer_id)
    payouts_total = int(db.scalar(payout_stmt) or 0)
    balance_due = max(0, total["net_revenue"] - payouts_total)

    overall_fill_rate = round((total["ordered"] / total["total_seats"]) * 100, 1) if total["total_seats"] > 0 else 0.0
    overall_attendance_rate = round((int(t_used) / int(t_gen)) * 100, 1) if int(t_gen) > 0 else 0.0

    return {
        "totals": {
            **total,
            "orders_pending": counts["PENDING"],
            "orders_accepted": counts["ACCEPTED"],
            "orders_rejected": counts["REJECTED"],
            "tickets_generated": int(t_gen),
            "tickets_used": int(t_used),
            "overall_fill_rate": overall_fill_rate,
            "overall_attendance_rate": overall_attendance_rate,
            "payouts_total": payouts_total,
            "balance_due": balance_due,
        },
        "per_concert": per_concert,
    }


# ------------------------------------------------------------------ Commandes
@router.get("/orders")
def list_orders(
    concert_id: int | None = None,
    organizer_id: int | None = None,
    status: str | None = None,
    payment: str | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    stmt = select(Order).join(Concert, Order.concert_id == Concert.id)

    if current.role == ROLE_ORGANIZER:
        stmt = stmt.where(Concert.organizer_id == current.id)
    elif current.role == ROLE_SUPER_ADMIN and organizer_id:
        stmt = stmt.where(Concert.organizer_id == organizer_id)

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


@router.get("/orders/export-csv")
def export_orders_csv(
    concert_id: int | None = None,
    organizer_id: int | None = None,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    stmt = select(Order).join(Concert, Order.concert_id == Concert.id).order_by(Order.id.desc())
    if current.role == ROLE_ORGANIZER:
        stmt = stmt.where(Concert.organizer_id == current.id)
    elif current.role == ROLE_SUPER_ADMIN and organizer_id:
        stmt = stmt.where(Concert.organizer_id == organizer_id)
    if concert_id:
        stmt = stmt.where(Order.concert_id == concert_id)

    orders = db.scalars(stmt).all()

    output = io.StringIO()
    output.write("\ufeff")  # BOM UTF-8
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "Référence",
        "Concert",
        "Organisateur",
        "Client",
        "Email",
        "Type de billet",
        "Quantité",
        "Prix unitaire (Ar)",
        "Montant total (Ar)",
        "Statut commande",
        "Statut paiement",
        "Date de commande",
    ])

    for o in orders:
        writer.writerow([
            o.reference,
            o.concert.name if o.concert else "",
            o.concert.organizer.name if o.concert and o.concert.organizer else "ITIX",
            o.customer_name,
            o.customer_email,
            o.ticket_type.name if o.ticket_type else "",
            o.quantity,
            o.unit_price,
            o.total_amount,
            o.status,
            o.payment_status,
            o.created_at.strftime("%d/%m/%Y %H:%M") if o.created_at else "",
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="commandes_itix_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        },
    )


@router.get("/orders/{order_id}")
def order_detail(
    order_id: int,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    return order_out(_get_order(db, order_id, current))


@router.get("/orders/{order_id}/proof")
def order_proof(
    order_id: int,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    o = _get_order(db, order_id, current)
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
def accept_order(
    order_id: int,
    body: AcceptIn,
    bg: BackgroundTasks,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    o = _get_order(db, order_id, current, lock=True)
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
def resend_tickets(
    order_id: int,
    bg: BackgroundTasks,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    o = _get_order(db, order_id, current)
    if o.status != "ACCEPTED":
        raise HTTPException(409, "Seules les commandes acceptées ont des billets.")
    return _delivery(o, bg)


class RejectIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


@router.post("/orders/{order_id}/reject")
def reject_order(
    order_id: int,
    body: RejectIn,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    o = _get_order(db, order_id, current, lock=True)
    if o.status != "PENDING":
        raise HTTPException(409, "Cette commande a déjà été traitée.")
    o.status, o.reject_reason, o.processed_at = "REJECTED", body.reason.strip(), local_now()
    db.commit()
    return order_out(o)


@router.post("/orders/{order_id}/mark-paid")
def mark_paid(
    order_id: int,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    o = _get_order(db, order_id, current, lock=True)
    if o.status != "ACCEPTED":
        raise HTTPException(409, "La commande doit d'abord être acceptée.")
    o.payment_status = "PAID"
    db.commit()
    return order_out(o)


# ------------------------------------------------------------------ Scan QR & Mode Hors-ligne
class ScanIn(BaseModel):
    token: str = Field(min_length=1, max_length=2000)
    mark_used: bool = True


@router.post("/scan")
def scan(
    body: ScanIn,
    current: Admin = Depends(require_scanner_access),
    db: Session = Depends(get_db),
    _limiter: None = Depends(rate_limit(max_requests=120, window_seconds=60, key_prefix="scan")),
):
    """Le backend déchiffre, vérifie l'organisateur propriétaire, contrôle paiement et usage atomique."""
    pid = decrypt_ticket(body.token)
    t = db.scalar(select(Ticket).where(Ticket.public_id == pid)) if pid else None
    if not t:
        return {"result": "INVALID", "message": "Ce QR Code ne correspond à aucun billet.", "ticket": None}

    o = t.order
    concert = o.concert

    # Isolation multi-organisateur stricte & contrôleur staff
    if current.role == ROLE_ORGANIZER and concert.organizer_id != current.id:
        return {
            "result": "WRONG_ORGANIZER",
            "message": f"Accès refusé : Ce billet est valide pour l'événement « {concert.name} » d'un autre organisateur.",
            "ticket": None,
        }
    if current.role == ROLE_STAFF_SCANNER:
        if current.assigned_concert_id and concert.id != current.assigned_concert_id:
            return {
                "result": "WRONG_ORGANIZER",
                "message": f"Accès refusé : Vous n'êtes pas assigné à l'événement « {concert.name} ».",
                "ticket": None,
            }
        if current.parent_organizer_id and concert.organizer_id != current.parent_organizer_id:
            return {
                "result": "WRONG_ORGANIZER",
                "message": f"Accès refusé : Ce billet appartient à un autre organisateur.",
                "ticket": None,
            }

    def info() -> dict:
        return {
            "number": t.number,
            "customer_name": o.customer_name,
            "ticket_type": o.ticket_type.name,
            "unit_price": o.unit_price,
            "concert_name": concert.name,
            "concert_date": concert.date,
            "payment_status": o.payment_status,
            "used_at": t.used_at,
        }

    if t.status == "USED":
        return {"result": "ALREADY_USED", "message": "Ce billet a déjà été présenté et utilisé.", "ticket": info()}

    if o.payment_status != "PAID":
        formatted_price = f"{o.unit_price:,}".replace(",", " ")
        return {
            "result": "RESERVATION",
            "message": f"🎟️ Réservation valide — À encaisser sur place : {formatted_price} Ar",
            "ticket": info(),
        }

    if body.mark_used:
        res = db.execute(
            update(Ticket)
            .where(Ticket.id == t.id, Ticket.status == "VALID")
            .values(status="USED", used_at=local_now())
        )
        db.commit()
        db.refresh(t)
        if res.rowcount == 0:
            return {"result": "ALREADY_USED", "message": "Ce billet a déjà été présenté et utilisé.", "ticket": info()}

    return {"result": "VALID", "message": "✓ Billet valide : entrée autorisée (Paiement validé).", "ticket": info()}


@router.get("/scanner/manifest")
def get_scanner_manifest(
    concert_id: int = Query(...),
    current: Admin = Depends(require_scanner_access),
    db: Session = Depends(get_db),
):
    concert = db.get(Concert, concert_id)
    if not concert:
        raise HTTPException(404, "Concert introuvable.")

    if current.role == ROLE_ORGANIZER and concert.organizer_id != current.id:
        raise HTTPException(403, "Accès refusé pour cet événement.")
    if current.role == ROLE_STAFF_SCANNER:
        if current.assigned_concert_id and current.assigned_concert_id != concert.id:
            raise HTTPException(403, "Accès refusé : vous n'êtes pas affecté à ce concert.")
        if current.parent_organizer_id and concert.organizer_id != current.parent_organizer_id:
            raise HTTPException(403, "Accès refusé pour cet événement.")

    tickets = db.scalars(
        select(Ticket)
        .join(Order, Ticket.order_id == Order.id)
        .where(Ticket.concert_id == concert_id)
    ).all()

    manifest_tickets = []
    for t in tickets:
        token = encrypt_ticket(t.public_id)
        manifest_tickets.append({
            "token": token,
            "ticket_number": t.number,
            "status": t.status,
            "payment_status": t.order.payment_status,
            "customer_name": t.order.customer_name,
            "ticket_type": t.order.ticket_type.name,
            "unit_price": t.order.unit_price,
            "used_at": t.used_at.isoformat() if t.used_at else None,
        })

    return {
        "concert_id": concert.id,
        "concert_name": concert.name,
        "concert_date": concert.date.isoformat(),
        "venue": concert.venue,
        "downloaded_at": local_now().isoformat(),
        "total_tickets": len(manifest_tickets),
        "tickets": manifest_tickets,
    }


class OfflineSyncItem(BaseModel):
    token: str
    scanned_at: str | None = None


class OfflineSyncIn(BaseModel):
    concert_id: int
    scans: list[OfflineSyncItem]


@router.post("/scanner/sync-offline")
def sync_offline_scans(
    body: OfflineSyncIn,
    current: Admin = Depends(require_scanner_access),
    db: Session = Depends(get_db),
):
    concert = db.get(Concert, body.concert_id)
    if not concert:
        raise HTTPException(404, "Concert introuvable.")

    if current.role == ROLE_ORGANIZER and concert.organizer_id != current.id:
        raise HTTPException(403, "Accès refusé pour cet événement.")
    if current.role == ROLE_STAFF_SCANNER:
        if current.assigned_concert_id and current.assigned_concert_id != concert.id:
            raise HTTPException(403, "Accès refusé : vous n'êtes pas affecté à ce concert.")
        if current.parent_organizer_id and concert.organizer_id != current.parent_organizer_id:
            raise HTTPException(403, "Accès refusé pour cet événement.")

    synced = 0
    already_used = 0
    invalid = 0

    for scan in body.scans:
        pid = decrypt_ticket(scan.token)
        if not pid:
            invalid += 1
            continue
        t = db.scalar(select(Ticket).where(Ticket.public_id == pid, Ticket.concert_id == body.concert_id))
        if not t:
            invalid += 1
            continue

        if t.status == "USED":
            already_used += 1
            continue

        scan_time = None
        if scan.scanned_at:
            try:
                scan_time = datetime.fromisoformat(scan.scanned_at)
            except Exception:
                scan_time = local_now()
        else:
            scan_time = local_now()

        t.status = "USED"
        t.used_at = scan_time
        synced += 1

    db.commit()
    return {
        "message": f"{synced} scan(s) synchronisé(s) avec succès.",
        "synced": synced,
        "already_used": already_used,
        "invalid": invalid,
        "total": len(body.scans),
    }


# ------------------------------------------------------------------ E-mail & SMTP Diagnostics
class TestEmailIn(BaseModel):
    recipient: str = Field(..., min_length=3, max_length=255)


@router.get("/email/status")
def get_email_status():
    s = get_settings()
    return {
        "configured": smtp_configured(),
        "provider": "Resend API",
        "from": s.resend_from,
        "has_api_key": bool(s.resend_api_key),
    }


@router.post("/email/test")
def test_email(
    body: TestEmailIn,
    current: Admin = Depends(require_super_admin),
):
    result = send_test_email(body.recipient.strip())
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result)
    return result


# ------------------------------------------------------------------ Support & Messages
@router.get("/messages")
def list_admin_messages(
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    stmt = select(SupportMessage).order_by(SupportMessage.id.desc())
    if current.role == ROLE_ORGANIZER:
        my_cids = select(Concert.id).where(Concert.organizer_id == current.id)
        stmt = stmt.where(
            or_(
                SupportMessage.organizer_id == current.id,
                SupportMessage.concert_id.in_(my_cids),
            )
        )
    msgs = db.scalars(stmt).all()
    return [
        {
            "id": m.id,
            "concert_id": m.concert_id,
            "organizer_id": m.organizer_id,
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
def reply_admin_message(
    msg_id: int,
    body: ReplyIn,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    m = db.get(SupportMessage, msg_id)
    if not m:
        raise HTTPException(404, "Message introuvable.")

    if current.role == ROLE_ORGANIZER:
        if m.organizer_id != current.id:
            c = db.get(Concert, m.concert_id) if m.concert_id else None
            if not c or c.organizer_id != current.id:
                raise HTTPException(403, "Vous ne pouvez pas répondre à ce message.")

    m.admin_reply = body.reply.strip()
    m.replied_at = local_now()
    m.is_resolved = True
    db.commit()
    return {"message": "Réponse enregistrée."}


@router.post("/messages/{msg_id}/toggle-resolved")
def toggle_resolved_message(
    msg_id: int,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    m = db.get(SupportMessage, msg_id)
    if not m:
        raise HTTPException(404, "Message introuvable.")
    if current.role == ROLE_ORGANIZER:
        if m.organizer_id != current.id:
            c = db.get(Concert, m.concert_id) if m.concert_id else None
            if not c or c.organizer_id != current.id:
                raise HTTPException(403, "Accès refusé.")

    m.is_resolved = not m.is_resolved
    db.commit()
    return {"is_resolved": m.is_resolved}


# ------------------------------------------------------------------ Chat Admin
@router.get("/chat/conversations")
def list_chat_conversations(
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    stmt = select(ChatMessage).order_by(ChatMessage.created_at.desc())
    if current.role == ROLE_ORGANIZER:
        my_cids = select(Concert.id).where(Concert.organizer_id == current.id)
        stmt = stmt.where(
            or_(
                ChatMessage.organizer_id == current.id,
                ChatMessage.concert_id.in_(my_cids),
            )
        )
    all_msgs = db.scalars(stmt).all()
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
def get_admin_chat(
    customer_email: str,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    clean_email = customer_email.strip().lower()
    stmt = select(ChatMessage).where(ChatMessage.customer_email == clean_email)
    if current.role == ROLE_ORGANIZER:
        my_cids = select(Concert.id).where(Concert.organizer_id == current.id)
        stmt = stmt.where(
            or_(
                ChatMessage.organizer_id == current.id,
                ChatMessage.concert_id.in_(my_cids),
            )
        )
    messages = db.scalars(stmt.order_by(ChatMessage.created_at.asc())).all()
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
    concert_id: int | None = None


@router.post("/chat/{customer_email}", status_code=201)
def post_admin_chat_reply(
    customer_email: str,
    body: AdminChatMessageIn,
    current: Admin = Depends(require_admin_or_organizer),
    db: Session = Depends(get_db),
):
    clean_email = customer_email.strip().lower()
    last_msg = db.scalar(
        select(ChatMessage)
        .where(ChatMessage.customer_email == clean_email)
        .order_by(ChatMessage.id.desc())
    )
    cust_name = last_msg.customer_name if last_msg else "Client"

    msg = ChatMessage(
        concert_id=body.concert_id or (last_msg.concert_id if last_msg else None),
        organizer_id=current.id,
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
