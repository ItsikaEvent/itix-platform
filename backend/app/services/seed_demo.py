"""Script d'initialisation de données de démonstration réalistes pour ITIX.

Exécution :
    PYTHONPATH=backend python -m app.services.seed_demo
"""

import os
import sys
from datetime import datetime, timedelta

# Fallback secrets pour initialisation autonome si aucun .env n'est présent
if not os.environ.get("JWT_SECRET"):
    os.environ["JWT_SECRET"] = "dev-jwt-secret-key-at-least-32-chars-long-itix-local"
if not os.environ.get("QR_SECRET"):
    os.environ["QR_SECRET"] = "dev-qr-secret-key-at-least-32-chars-long-itix-local"

from sqlalchemy import select

from app.core.security import encrypt_ticket, hash_password
from app.core.timeutil import local_now
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.entities import (
    ROLE_ORGANIZER,
    ROLE_STAFF_SCANNER,
    ROLE_SUPER_ADMIN,
    Admin,
    ClientAccount,
    Concert,
    Order,
    Payout,
    Ticket,
    TicketType,
    slugify,
)


def seed_demo_data(force: bool = False) -> None:
    # Création des tables si inexistantes
    Base.metadata.create_all(engine)

    with SessionLocal() as db:
        # Vérification si des données existent déjà
        existing_admin = db.scalar(select(Admin.id).where(Admin.email == "admin@itix.mg"))
        if existing_admin:
            if not force:
                print("✓ Les données de démonstration sont déjà initialisées dans la base.")
                return
            print("🔄 Réinitialisation complète des données de test (--force)...")
            db.query(Ticket).delete()
            db.query(Order).delete()
            db.query(Payout).delete()
            db.query(TicketType).delete()
            db.query(Concert).delete()
            db.query(ClientAccount).delete()
            db.query(Admin).delete()
            db.commit()

        print("📦 Initialisation des données de test ITIX...")

        # 1. Super Administrateur
        super_admin = Admin(
            name="Direction Générale ITIX",
            email="admin@itix.mg",
            role=ROLE_SUPER_ADMIN,
            slug="direction-itix",
            phone="+261 34 00 000 01",
            password_hash=hash_password("AdminPass123!"),
            commission_rate=5.0,
            must_change_password=False,
            is_active=True,
            totp_enabled=False,  # Permet à l'utilisateur de tester l'onboarding A2F avec QR code
        )
        db.add(super_admin)
        db.flush()

        # 2. Organisateurs
        org1 = Admin(
            name="Live Nation Madagascar",
            email="livenation@itix.mg",
            role=ROLE_ORGANIZER,
            slug=slugify("Live Nation Madagascar"),
            phone="+261 34 11 222 33",
            password_hash=hash_password("OrganizerPass123!"),
            commission_rate=5.0,
            must_change_password=False,
            is_active=True,
            totp_enabled=False,
        )

        org2 = Admin(
            name="Madagascar Philharmonia Prods",
            email="philharmonia@itix.mg",
            role=ROLE_ORGANIZER,
            slug=slugify("Madagascar Philharmonia Prods"),
            phone="+261 32 44 555 66",
            password_hash=hash_password("OrganizerPass123!"),
            commission_rate=7.5,
            must_change_password=False,
            is_active=True,
            totp_enabled=False,
        )

        org3 = Admin(
            name="Koloina Festival & Events",
            email="koloina@itix.mg",
            role=ROLE_ORGANIZER,
            slug=slugify("Koloina Festival Events"),
            phone="+261 33 77 888 99",
            password_hash=hash_password("OrganizerPass123!"),
            commission_rate=6.0,
            must_change_password=False,
            is_active=True,
            totp_enabled=False,
        )

        db.add_all([org1, org2, org3])
        db.flush()

        # 3. Concerts & Événements
        now = local_now()

        concert1 = Concert(
            organizer_id=org1.id,
            name="Gala Symphonique d'Hiver — Beethoven & Ravel",
            description="Soirée symphonique d'exception avec 80 musiciens sur scène et solistes internationaux.",
            venue="Palais des Sports & de la Culture Mahamasina",
            date=now + timedelta(days=15, hours=4),
            total_seats=600,
        )

        concert2 = Concert(
            organizer_id=org2.id,
            name="Récital de Piano & Voix Sacrées",
            description="Les plus beaux chefs-d'œuvre du baroque et du romantisme dans un cadre acoustique somptueux.",
            venue="Cathédrale d'Andohalo, Antananarivo",
            date=now + timedelta(days=28, hours=2),
            total_seats=300,
        )

        concert3 = Concert(
            organizer_id=org3.id,
            name="Festival Jazz & Rythmes Malagasy 2026",
            description="Le grand rassemblement annuel du jazz malgache et de la musique vivante.",
            venue="CCI Ivato (Centre de Conférence International)",
            date=now + timedelta(days=45, hours=6),
            total_seats=800,
        )

        db.add_all([concert1, concert2, concert3])
        db.flush()

        # 4. Catégories de billets (TicketTypes)
        # Concert 1
        tt1_std = TicketType(concert_id=concert1.id, name="Place Standard", price=25000, quantity=400)
        tt1_vip = TicketType(concert_id=concert1.id, name="Carré VIP", price=60000, quantity=150)
        tt1_vvip = TicketType(concert_id=concert1.id, name="Loge Prestige VVIP", price=120000, quantity=50)

        # Concert 2
        tt2_std = TicketType(concert_id=concert2.id, name="Accès Général", price=20000, quantity=250)
        tt2_priv = TicketType(concert_id=concert2.id, name="Nef d'Honneur", price=45000, quantity=50)

        # Concert 3
        tt3_pass = TicketType(concert_id=concert3.id, name="Pass Soirée", price=30000, quantity=600)
        tt3_gold = TicketType(concert_id=concert3.id, name="Carré d'Or & Backstage", price=90000, quantity=200)

        db.add_all([tt1_std, tt1_vip, tt1_vvip, tt2_std, tt2_priv, tt3_pass, tt3_gold])
        db.flush()

        # 5. Sous-comptes Contrôleurs (Staff Scanner)
        staff1 = Admin(
            name="Contrôleur Porte A (Mahamasina)",
            email="staff.porte.a@itix.mg",
            role=ROLE_STAFF_SCANNER,
            password_hash=hash_password("StaffPass123!"),
            parent_organizer_id=org1.id,
            assigned_concert_id=concert1.id,
            must_change_password=False,
            is_active=True,
        )

        staff2 = Admin(
            name="Contrôleur Entrée VIP",
            email="staff.vip@itix.mg",
            role=ROLE_STAFF_SCANNER,
            password_hash=hash_password("StaffPass123!"),
            parent_organizer_id=org1.id,
            assigned_concert_id=concert1.id,
            must_change_password=False,
            is_active=True,
        )

        db.add_all([staff1, staff2])
        db.flush()

        # 6. Comptes Spectateurs
        client_rakoto = ClientAccount(
            email="rakoto@example.mg",
            name="Jean Rakoto",
            totp_enabled=False,
            is_verified=True,
        )
        client_ravelo = ClientAccount(
            email="ravelo@example.mg",
            name="Mamy Ravelo",
            totp_enabled=False,
            is_verified=True,
        )
        db.add_all([client_rakoto, client_ravelo])
        db.flush()

        # 7. Commandes et Billets
        # Commande 1 : Jean Rakoto (2 places standard Gala - Payées et Acceptées)
        o1 = Order(
            reference="CMD-20261101-001",
            concert_id=concert1.id,
            ticket_type_id=tt1_std.id,
            customer_name="Jean Rakoto",
            customer_email="rakoto@example.mg",
            quantity=2,
            unit_price=25000,
            total_amount=50000,
            pay_mode="PAY_NOW",
            status="ACCEPTED",
            payment_status="PAID",
            consent_cgu_cgv=True,
            consent_privacy=True,
            created_at=now - timedelta(days=5),
            processed_at=now - timedelta(days=5, hours=-1),
        )
        db.add(o1)
        db.flush()

        t1_1 = Ticket(order_id=o1.id, concert_id=concert1.id, number=f"TCK-{o1.id:04d}-01", status="USED", used_at=now - timedelta(hours=2))
        t1_2 = Ticket(order_id=o1.id, concert_id=concert1.id, number=f"TCK-{o1.id:04d}-02", status="VALID")
        db.add_all([t1_1, t1_2])

        # Commande 2 : Mamy Ravelo (1 place VIP Gala - Payée et Acceptée)
        o2 = Order(
            reference="CMD-20261102-002",
            concert_id=concert1.id,
            ticket_type_id=tt1_vip.id,
            customer_name="Mamy Ravelo",
            customer_email="ravelo@example.mg",
            quantity=1,
            unit_price=60000,
            total_amount=60000,
            pay_mode="PAY_NOW",
            status="ACCEPTED",
            payment_status="PAID",
            consent_cgu_cgv=True,
            consent_privacy=True,
            created_at=now - timedelta(days=3),
            processed_at=now - timedelta(days=3, hours=-1),
        )
        db.add(o2)
        db.flush()
        t2_1 = Ticket(order_id=o2.id, concert_id=concert1.id, number=f"TCK-{o2.id:04d}-01", status="VALID")
        db.add(t2_1)

        # Commande 3 : Faly Randria (2 places VVIP Gala - Réservation sur place)
        o3 = Order(
            reference="CMD-20261103-003",
            concert_id=concert1.id,
            ticket_type_id=tt1_vvip.id,
            customer_name="Faly Randria",
            customer_email="faly@example.mg",
            quantity=2,
            unit_price=120000,
            total_amount=240000,
            pay_mode="RESERVE",
            status="ACCEPTED",
            payment_status="UNPAID",
            consent_cgu_cgv=True,
            consent_privacy=True,
            created_at=now - timedelta(days=2),
            processed_at=now - timedelta(days=2, hours=-2),
        )
        db.add(o3)
        db.flush()
        t3_1 = Ticket(order_id=o3.id, concert_id=concert1.id, number=f"TCK-{o3.id:04d}-01", status="VALID")
        t3_2 = Ticket(order_id=o3.id, concert_id=concert1.id, number=f"TCK-{o3.id:04d}-02", status="VALID")
        db.add_all([t3_1, t3_2])

        # Commande 4 : Aina Rajaona (3 places Récital Philharmonia - Payées)
        o4 = Order(
            reference="CMD-20261104-004",
            concert_id=concert2.id,
            ticket_type_id=tt2_std.id,
            customer_name="Aina Rajaona",
            customer_email="aina@example.mg",
            quantity=3,
            unit_price=20000,
            total_amount=60000,
            pay_mode="PAY_NOW",
            status="ACCEPTED",
            payment_status="PAID",
            consent_cgu_cgv=True,
            consent_privacy=True,
            created_at=now - timedelta(days=1),
            processed_at=now - timedelta(hours=12),
        )
        db.add(o4)
        db.flush()
        for idx in range(1, 4):
            db.add(Ticket(order_id=o4.id, concert_id=concert2.id, number=f"TCK-{o4.id:04d}-{idx:02d}", status="VALID"))

        # Commande 5 : En attente de validation
        o5 = Order(
            reference="CMD-20261105-005",
            concert_id=concert3.id,
            ticket_type_id=tt3_pass.id,
            customer_name="Soa Andrianina",
            customer_email="soa@example.mg",
            quantity=2,
            unit_price=30000,
            total_amount=60000,
            pay_mode="PAY_NOW",
            status="PENDING",
            payment_status="PROOF_SUBMITTED",
            consent_cgu_cgv=True,
            consent_privacy=True,
            created_at=now - timedelta(hours=2),
        )
        db.add(o5)

        # 8. Reversements (Payouts)
        p1 = Payout(
            organizer_id=org1.id,
            amount=50000,
            payment_method="MVOLA",
            reference="MV-20261110-0981",
            notes="Acompte sur billetterie Gala Symphonique",
            created_at=now - timedelta(days=2),
        )
        p2 = Payout(
            organizer_id=org2.id,
            amount=30000,
            payment_method="ORANGE_MONEY",
            reference="OM-20261112-4412",
            notes="Reversement billetterie Récital Voix Sacrées",
            created_at=now - timedelta(days=1),
        )
        db.add_all([p1, p2])

        db.commit()

        print("✨ Données de démonstration initialisées avec succès !")
        print("\n" + "=" * 60)
        print("🔐 COMPTES ET IDENTIFIANTS DE TEST DISPONIBLES :")
        print("=" * 60)
        print("1. SUPER ADMIN (Contrôle total & Payouts) :")
        print("   • Email    : admin@itix.mg")
        print("   • Password : AdminPass123!")
        print("-" * 60)
        print("2. ORGANISATEUR (Live Nation Madagascar - 5% commission) :")
        print("   • Email    : livenation@itix.mg")
        print("   • Password : OrganizerPass123!")
        print("-" * 60)
        print("3. CONTRÔLEUR TERRAIN (Staff Scanner - Caméra seule) :")
        print("   • Email    : staff.porte.a@itix.mg")
        print("   • Password : StaffPass123!")
        print("-" * 60)
        print("4. SPECTATEUR (Espace Billets - Connexion directe sans mdp) :")
        print("   • Email    : rakoto@example.mg")
        print("=" * 60 + "\n")


if __name__ == "__main__":
    force_seed = "--force" in sys.argv
    seed_demo_data(force=force_seed)
