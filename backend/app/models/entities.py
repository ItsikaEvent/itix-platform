import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.timeutil import local_now
from app.db.base import Base

# Statuts (chaînes simples, contrôlées côté backend)
ORDER_PENDING, ORDER_ACCEPTED, ORDER_REJECTED = "PENDING", "ACCEPTED", "REJECTED"
PAY_UNPAID, PAY_PROOF, PAY_PAID = "UNPAID", "PROOF_SUBMITTED", "PAID"
TICKET_VALID, TICKET_USED = "VALID", "USED"


def _uuid() -> str:
    return str(uuid.uuid4())


class StoredFile(Base):
    """Images (affiches, preuves) stockées en base : persistantes sur Render sans disque."""
    __tablename__ = "files"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(50))
    data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=local_now)


class Admin(Base):
    __tablename__ = "admins"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))


class Concert(Base):
    __tablename__ = "concerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text, default="")
    venue: Mapped[str] = mapped_column(String(200))
    date: Mapped[datetime] = mapped_column(DateTime, index=True)
    total_seats: Mapped[int] = mapped_column(Integer)
    poster_file_id: Mapped[str | None] = mapped_column(
        ForeignKey("files.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=local_now)

    ticket_types: Mapped[list["TicketType"]] = relationship(
        back_populates="concert", cascade="all, delete-orphan",
        lazy="selectin", order_by="TicketType.price",
    )


class TicketType(Base):
    __tablename__ = "ticket_types"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_tt_quantity"),
        CheckConstraint("price >= 0", name="ck_tt_price"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    concert_id: Mapped[int] = mapped_column(ForeignKey("concerts.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    price: Mapped[int] = mapped_column(Integer)  # en Ariary
    quantity: Mapped[int] = mapped_column(Integer)

    concert: Mapped[Concert] = relationship(back_populates="ticket_types")


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_order_quantity"),
        Index("ix_orders_concert_status", "concert_id", "status"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    concert_id: Mapped[int] = mapped_column(ForeignKey("concerts.id"))
    ticket_type_id: Mapped[int] = mapped_column(ForeignKey("ticket_types.id"), index=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_email: Mapped[str] = mapped_column(String(255), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[int] = mapped_column(Integer)
    total_amount: Mapped[int] = mapped_column(Integer)
    pay_mode: Mapped[str] = mapped_column(String(10))  # PAY_NOW | RESERVE
    status: Mapped[str] = mapped_column(String(12), default=ORDER_PENDING, index=True)
    payment_status: Mapped[str] = mapped_column(String(16), default=PAY_UNPAID, index=True)
    proof_file_id: Mapped[str | None] = mapped_column(
        ForeignKey("files.id", ondelete="SET NULL"), nullable=True
    )
    reject_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=local_now)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    concert: Mapped[Concert] = relationship(lazy="selectin")
    ticket_type: Mapped[TicketType] = relationship(lazy="selectin")
    tickets: Mapped[list["Ticket"]] = relationship(
        back_populates="order", lazy="selectin", order_by="Ticket.id"
    )


class Ticket(Base):
    __tablename__ = "tickets"
    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, index=True, default=_uuid)
    number: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    concert_id: Mapped[int] = mapped_column(ForeignKey("concerts.id"), index=True)
    status: Mapped[str] = mapped_column(String(10), default=TICKET_VALID)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=local_now)

    order: Mapped[Order] = relationship(back_populates="tickets")


class SupportMessage(Base):
    __tablename__ = "support_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_email: Mapped[str] = mapped_column(String(255), index=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    order_reference: Mapped[str | None] = mapped_column(String(30), nullable=True)
    subject: Mapped[str] = mapped_column(String(150))
    message: Mapped[str] = mapped_column(Text)
    admin_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    replied_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_resolved: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=local_now)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_email: Mapped[str] = mapped_column(String(255), index=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    sender: Mapped[str] = mapped_column(String(10), default="CLIENT")  # CLIENT | ADMIN
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=local_now)


