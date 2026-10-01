from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.timeutil import local_now
from app.models.entities import Concert, Order


def sold_map(db: Session) -> dict[int, int]:
    """Places réservées par type de billet (commandes en attente + acceptées)."""
    rows = db.execute(
        select(Order.ticket_type_id, func.coalesce(func.sum(Order.quantity), 0))
        .where(Order.status.in_(("PENDING", "ACCEPTED")))
        .group_by(Order.ticket_type_id)
    )
    return {tid: int(n) for tid, n in rows}


def concert_out(c: Concert, sold: dict[int, int]) -> dict:
    types = [
        {"id": t.id, "name": t.name, "price": t.price, "quantity": t.quantity,
         "remaining": max(t.quantity - sold.get(t.id, 0), 0)}
        for t in c.ticket_types
    ]
    remaining = sum(t["remaining"] for t in types)
    capacity = sum(t["quantity"] for t in types) or c.total_seats
    if c.date < local_now():
        status = "FINISHED"
    elif remaining == 0:
        status = "SOLD_OUT"
    elif remaining <= max(capacity * 0.1, 1):
        status = "ALMOST_FULL"
    else:
        status = "AVAILABLE"
    return {
        "id": c.id, "name": c.name, "description": c.description, "venue": c.venue,
        "date": c.date, "total_seats": c.total_seats,
        "poster_url": f"/api/files/{c.poster_file_id}" if c.poster_file_id else None,
        "min_price": min((t["price"] for t in types), default=None),
        "remaining": remaining, "status": status, "ticket_types": types,
    }


def order_out(o: Order) -> dict:
    return {
        "id": o.id, "reference": o.reference, "concert_id": o.concert_id,
        "concert_name": o.concert.name, "concert_date": o.concert.date,
        "ticket_type_name": o.ticket_type.name, "unit_price": o.unit_price,
        "quantity": o.quantity, "total_amount": o.total_amount,
        "customer_name": o.customer_name, "customer_email": o.customer_email,
        "pay_mode": o.pay_mode, "status": o.status, "payment_status": o.payment_status,
        "has_proof": o.proof_file_id is not None, "reject_reason": o.reject_reason,
        "created_at": o.created_at,
        "tickets": [{"number": t.number, "status": t.status, "used_at": t.used_at} for t in o.tickets],
    }
