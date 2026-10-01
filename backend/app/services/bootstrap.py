from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.entities import Admin


def seed_admin() -> None:
    s = get_settings()
    if not s.admin_password:
        return
    with SessionLocal() as db:
        email = s.admin_email.lower()
        if not db.scalar(select(Admin).where(Admin.email == email)):
            db.add(Admin(email=email, password_hash=hash_password(s.admin_password)))
            db.commit()
