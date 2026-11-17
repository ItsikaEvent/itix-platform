from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.entities import Admin, Concert, ROLE_SUPER_ADMIN


def seed_admin() -> None:
    s = get_settings()
    if not s.admin_password:
        return
    with SessionLocal() as db:
        email = s.admin_email.lower().strip()
        admin = db.scalar(select(Admin).where(Admin.email == email))
        if not admin:
            admin = Admin(
                name="Super Administrateur",
                email=email,
                role=ROLE_SUPER_ADMIN,
                slug="itix-admin",
                password_hash=hash_password(s.admin_password),
                must_change_password=False,
                is_active=True,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
        else:
            # S'assurer que le compte défini par env est SUPER_ADMIN
            if admin.role != ROLE_SUPER_ADMIN:
                admin.role = ROLE_SUPER_ADMIN
                db.commit()

        # Attacher les concerts orphelins au Super Admin
        db.execute(
            update(Concert)
            .where(Concert.organizer_id.is_(None))
            .values(organizer_id=admin.id)
        )
        db.commit()

