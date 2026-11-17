import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import decrypt_ticket, encrypt_ticket
from app.db.session import SessionLocal
from app.main import app
from app.models.entities import Ticket
from app.services.totp import get_totp_token

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def login_admin(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    data = r.json()
    if data.get("requires_totp_setup"):
        secret = data.get("secret") or data.get("totp_secret")
        code = get_totp_token(secret)
        r2 = client.post("/api/auth/verify-totp", json={"token": data["setup_token"], "code": code})
        assert r2.status_code == 200
        return r2.json()["access_token"], r2.json()["user"]
    if data.get("requires_totp"):
        from app.models.entities import Admin
        with SessionLocal() as db:
            adm = db.scalar(select(Admin).where(Admin.email == email))
            code = get_totp_token(adm.totp_secret)
        r2 = client.post("/api/auth/verify-totp", json={"token": data["auth_token"], "code": code})
        assert r2.status_code == 200
        return r2.json()["access_token"], r2.json()["user"]
    return data["access_token"], data.get("user")


@pytest.fixture(scope="module")
def auth(client):
    token, _ = login_admin(client, "admin@test.com", "S3cret-pass")
    return {"Authorization": f"Bearer {token}"}


def order(client, cid, tid, qty, mode="RESERVE", proof=None, cgu="true", privacy="true"):
    files = {"proof": ("p.png", proof, "image/png")} if proof else None
    data = {
        "concert_id": cid,
        "ticket_type_id": tid,
        "quantity": qty,
        "pay_mode": mode,
        "customer_name": "Jean Rakoto",
        "customer_email": "Jean@Example.com",
        "consent_cgu_cgv": cgu,
        "consent_privacy": privacy,
    }
    return client.post("/api/orders", data=data, files=files)


def test_admin_routes_require_auth(client):
    assert client.get("/api/admin/dashboard").status_code == 401
    assert client.post("/api/auth/login", json={"email": "admin@test.com", "password": "x"}).status_code == 401


def test_qr_is_encrypted_and_tamper_proof():
    tok = encrypt_ticket("abc-123")
    assert "abc-123" not in tok and decrypt_ticket(tok) == "abc-123"
    assert decrypt_ticket(tok[:-4] + "AAAA") is None and decrypt_ticket("TICKET-1") is None


def test_privacy_request_endpoint(client):
    res = client.post("/api/privacy/request", json={
        "customer_name": "Jean Rakoto",
        "customer_email": "jean@example.com",
        "request_type": "ACCESS",
        "details": "Je souhaite recevoir une copie de mes données d'achat."
    })
    assert res.status_code == 201
    assert "demande d'exercice de vos droits" in res.json()["message"]


def test_full_flow(client, auth):
    types = [{"name": "VIP", "price": 50000, "quantity": 3}, {"name": "Standard", "price": 30000, "quantity": 5}]
    r = client.post("/api/admin/concerts", headers=auth, data={
        "name": "À fleur de toi", "venue": "Cité des Cultures", "date": "2030-10-30T19:00",
        "total_seats": 8, "ticket_types": json.dumps(types)}, files={"poster": ("a.png", PNG, "image/png")})
    assert r.status_code == 201, r.text
    c = r.json()
    vip = c["ticket_types"][1]["id"] if c["ticket_types"][1]["name"] == "VIP" else c["ticket_types"][0]["id"]
    assert client.get(c["poster_url"]).status_code == 200
    assert client.get("/api/concerts").json()[0]["remaining"] == 8

    # validations
    assert order(client, c["id"], vip, 1, "PAY_NOW").status_code == 422           # preuve obligatoire
    assert order(client, c["id"], vip, 1, "PAY_NOW", b"not an image").status_code == 422
    assert order(client, c["id"], vip, 4).status_code == 409                       # stock insuffisant

    r = order(client, c["id"], vip, 2, "PAY_NOW", PNG)
    assert r.status_code == 201 and r.json()["total_amount"] == 100000
    assert order(client, c["id"], vip, 2).status_code == 409                       # reste 1 VIP
    oid = client.get("/api/admin/orders", headers=auth).json()["items"][0]["id"]

    # preuve visible par l'admin seulement
    assert client.get(f"/api/admin/orders/{oid}/proof", headers=auth).status_code == 200
    assert client.get(f"/api/admin/orders/{oid}/proof").status_code == 401

    # acceptation (sans marquer payé) -> 2 billets
    r = client.post(f"/api/admin/orders/{oid}/accept", headers=auth, json={"mark_paid": False})
    assert r.status_code == 200 and len(r.json()["tickets"]) == 2
    assert client.post(f"/api/admin/orders/{oid}/accept", headers=auth, json={}).status_code == 409

    with SessionLocal() as db:
        t = db.scalars(select(Ticket)).first()
        token = encrypt_ticket(t.public_id)

    scan = lambda tk: client.post("/api/admin/scan", headers=auth, json={"token": tk}).json()  # noqa: E731
    assert scan(token)["result"] in ("NOT_PAID", "RESERVATION")
    assert client.post(f"/api/admin/orders/{oid}/mark-paid", headers=auth).status_code == 200
    assert scan(token)["result"] == "VALID"
    assert scan(token)["result"] == "ALREADY_USED"                                 # double scan
    assert scan("n'importe quoi")["result"] == "INVALID"

    d = client.get("/api/admin/dashboard", headers=auth).json()["totals"]
    assert (d["ordered"], d["paid"], d["unpaid"], d["tickets_used"]) == (2, 2, 0, 1)
    assert d["revenue_paid"] == 100000

    # refus : libère le stock
    r2 = order(client, c["id"], vip, 1)
    assert r2.status_code == 201
    oid2 = client.get("/api/admin/orders", headers=auth).json()["items"][0]["id"]
    assert client.post(f"/api/admin/orders/{oid2}/reject", headers=auth, json={"reason": "x"}).status_code == 422
    assert client.post(f"/api/admin/orders/{oid2}/reject", headers=auth, json={"reason": "Preuve invalide"}).status_code == 200
    assert order(client, c["id"], vip, 1).status_code == 201


def test_multi_organizer_isolation_and_flow(client, auth):
    # 1. Super Admin crée un organisateur
    res = client.post("/api/admin/organizers", headers=auth, json={
        "name": "Live Nation Madagascar",
        "email": "livenation@test.com",
        "phone": "+261 34 00 000 00",
    })
    assert res.status_code == 201
    data = res.json()
    org_id = data["id"]
    temp_pass = data["temporary_password"]
    assert data["must_change_password"] is True
    assert data["role"] == "ORGANIZER"
    slug = data["slug"]

    # 2. L'organisateur se connecte avec son mot de passe temporaire (et complète son setup TOTP obligatoire)
    org_token, user_info = login_admin(client, "livenation@test.com", temp_pass)
    org_auth = {"Authorization": f"Bearer {org_token}"}
    assert user_info["must_change_password"] is True

    # 3. L'organisateur change son mot de passe
    res_pw = client.post("/api/auth/change-password", headers=org_auth, json={
        "new_password": "NewPermanentPassword123!"
    })
    assert res_pw.status_code == 200

    # Vérification me
    me = client.get("/api/auth/me", headers=org_auth).json()
    assert me["must_change_password"] is False
    assert me["role"] == "ORGANIZER"

    # 4. L'organisateur ne peut PAS accéder aux routes réservées au Super Admin (ex: création d'autres organisateurs)
    res_forbidden = client.get("/api/admin/organizers", headers=org_auth)
    assert res_forbidden.status_code == 403

    # 5. L'organisateur crée son propre concert
    types = [{"name": "Standard", "price": 25000, "quantity": 10}]
    r_c = client.post("/api/admin/concerts", headers=org_auth, data={
        "name": "Festival Malagasy", "venue": "Coliseum Antsonjombe", "date": "2030-11-20T18:00",
        "total_seats": 10, "ticket_types": json.dumps(types)})
    assert r_c.status_code == 201
    org_concert = r_c.json()
    assert org_concert["organizer_id"] == org_id

    # 6. Vérification de la page publique de l'organisateur
    res_public_org = client.get(f"/api/organizers/{slug}")
    assert res_public_org.status_code == 200
    assert res_public_org.json()["name"] == "Live Nation Madagascar"
    assert len(res_public_org.json()["concerts"]) >= 1

    # 7. Commande sur le concert de l'organisateur
    tt_id = org_concert["ticket_types"][0]["id"]
    r_order = order(client, org_concert["id"], tt_id, 1, "RESERVE")
    assert r_order.status_code == 201

    # 8. L'organisateur voit sa commande
    org_orders = client.get("/api/admin/orders", headers=org_auth).json()["items"]
    assert any(o["id"] == r_order.json()["reference"] or o["concert_id"] == org_concert["id"] for o in org_orders)

    # 9. Super Admin voit aussi cette commande (vue globale)
    sa_orders = client.get("/api/admin/orders", headers=auth).json()["items"]
    assert any(o["concert_id"] == org_concert["id"] for o in sa_orders)

    # 10. L'organisateur accepte sa commande et génère un billet
    org_order_id = [o["id"] for o in org_orders if o["concert_id"] == org_concert["id"]][0]
    res_accept = client.post(f"/api/admin/orders/{org_order_id}/accept", headers=org_auth, json={"mark_paid": True})
    assert res_accept.status_code == 200

    with SessionLocal() as db:
        t_org = db.scalars(select(Ticket).where(Ticket.order_id == org_order_id)).first()
        org_token_qr = encrypt_ticket(t_org.public_id)

    # 11. Crée un 2ème organisateur pour tester le rejet du scanner cross-organisateur
    res_org2 = client.post("/api/admin/organizers", headers=auth, json={
        "name": "Autre Prod", "email": "autre@test.com"
    })
    org2_temp = res_org2.json()["temporary_password"]
    token_org2, _ = login_admin(client, "autre@test.com", org2_temp)
    auth_org2 = {"Authorization": f"Bearer {token_org2}"}

    # Le 2ème organisateur tente de scanner le billet du 1er organisateur -> REJET STRICT
    scan_cross = client.post("/api/admin/scan", headers=auth_org2, json={"token": org_token_qr}).json()
    assert scan_cross["result"] == "WRONG_ORGANIZER"
    assert "autre organisateur" in scan_cross["message"]

    # Le 1er organisateur scanne son propre billet -> VALIDE
    scan_ok = client.post("/api/admin/scan", headers=org_auth, json={"token": org_token_qr}).json()
    assert scan_ok["result"] == "VALID"


def test_client_totp_authenticator_flow(client):
    email = "spectateur.securise@example.com"
    name = "Spectateur Sécurisé"

    # 1. Tentative d'accès sans token TOTP -> Refus 401
    r_unauth = client.get("/api/client/orders")
    assert r_unauth.status_code == 401

    # 2. Vérification existence compte -> non configuré
    r_check = client.post("/api/client/auth/check", json={"email": email})
    assert r_check.status_code == 200
    assert r_check.json()["has_account"] is False

    # 3. Setup TOTP -> Génération du secret et du QR code pour Google Authenticator
    r_setup = client.post("/api/client/auth/setup", json={"email": email, "name": name})
    assert r_setup.status_code == 200
    setup_data = r_setup.json()
    assert "secret" in setup_data
    assert "qr_code" in setup_data
    assert setup_data["qr_code"].startswith("data:image/png;base64,")
    secret = setup_data["secret"]

    # 4. Tentative avec mauvais code -> Refus 401
    r_bad_code = client.post("/api/client/auth/verify", json={"email": email, "code": "000000"})
    assert r_bad_code.status_code == 401

    # 5. Calcul du code valide via l'application d'authentification
    valid_code = get_totp_token(secret)
    r_verify = client.post("/api/client/auth/verify", json={"email": email, "code": valid_code})
    assert r_verify.status_code == 200
    verify_data = r_verify.json()
    assert "access_token" in verify_data
    client_token = verify_data["access_token"]
    assert verify_data["user"]["email"] == email

    # 6. Accès autorisé à /api/client/orders avec le token Bearer TOTP
    client_auth = {"Authorization": f"Bearer {client_token}"}
    r_orders = client.get("/api/client/orders", headers=client_auth)
    assert r_orders.status_code == 200
    assert "orders" in r_orders.json()


def test_economic_model_commissions_and_payouts(client, auth):
    # 1. Création d'un organisateur avec commission personnalisée à 7.5%
    res_org = client.post("/api/admin/organizers", headers=auth, json={
        "name": "Festival Prods",
        "email": "festival.prods@test.com",
        "commission_rate": 7.5,
    })
    assert res_org.status_code == 201
    org_data = res_org.json()
    org_id = org_data["id"]
    temp_pass = org_data["temporary_password"]
    assert org_data["commission_rate"] == 7.5

    # 2. Login organisateur
    token_org, _ = login_admin(client, "festival.prods@test.com", temp_pass)
    org_auth = {"Authorization": f"Bearer {token_org}"}

    # 3. Création d'un concert et d'une commande payée
    types = [{"name": "VIP", "price": 100000, "quantity": 10}]
    r_c = client.post("/api/admin/concerts", headers=org_auth, data={
        "name": "Soirée VIP", "venue": "CCI Ivato", "date": "2030-12-31T20:00",
        "total_seats": 10, "ticket_types": json.dumps(types)})
    assert r_c.status_code == 201
    cid = r_c.json()["id"]
    tt_id = r_c.json()["ticket_types"][0]["id"]

    # 4. Commande de 2 billets VIP (Total = 200 000 Ar)
    r_order = order(client, cid, tt_id, 2, "RESERVE")
    assert r_order.status_code == 201
    order_ref = r_order.json()["reference"]

    org_orders = client.get("/api/admin/orders", headers=org_auth).json()["items"]
    order_id = [o["id"] for o in org_orders if o["reference"] == order_ref][0]

    # Acceptation et paiement
    res_accept = client.post(f"/api/admin/orders/{order_id}/accept", headers=org_auth, json={"mark_paid": True})
    assert res_accept.status_code == 200

    # 5. Vérification du calcul de commission côté Super Admin
    # Vente brute = 200 000 Ar. Commission 7.5% = 15 000 Ar. Net organisateur = 185 000 Ar.
    organizers = client.get("/api/admin/organizers", headers=auth).json()
    this_org = [o for o in organizers if o["id"] == org_id][0]
    assert this_org["revenue_total"] == 200000
    assert this_org["commission_rate"] == 7.5
    assert this_org["commission_total"] == 15000
    assert this_org["revenue_net"] == 185000
    assert this_org["balance_due"] == 185000

    # 6. Enregistrement d'un reversement partiel de 100 000 Ar via Mobile Money
    res_payout = client.post("/api/admin/payouts", headers=auth, json={
        "organizer_id": org_id,
        "amount": 100000,
        "payment_method": "MVOLA",
        "reference": "MV-20261117-99988",
        "notes": "Acompte billetterie",
    })
    assert res_payout.status_code == 201

    # 7. Vérification de la liste des payouts
    payouts = client.get(f"/api/admin/payouts?organizer_id={org_id}", headers=auth).json()
    assert len(payouts) == 1
    assert payouts[0]["amount"] == 100000
    assert payouts[0]["payment_method"] == "MVOLA"

    # L'organisateur voit aussi son historique de payouts
    org_payouts = client.get("/api/admin/payouts", headers=org_auth).json()
    assert len(org_payouts) == 1
    assert org_payouts[0]["amount"] == 100000

    # 8. Vérification que le solde restant dû s'est actualisé (185 000 - 100 000 = 85 000 Ar)
    organizers2 = client.get("/api/admin/organizers", headers=auth).json()
    this_org2 = [o for o in organizers2 if o["id"] == org_id][0]
    assert this_org2["payouts_total"] == 100000
    assert this_org2["balance_due"] == 85000


def test_staff_scanner_and_offline_manifest(client, auth):
    # 1. Création d'un concert dédié et génération d'un billet valide
    types = [{"name": "Standard", "price": 10000, "quantity": 5}]
    r_c = client.post("/api/admin/concerts", headers=auth, data={
        "name": "Concert Scanner Test", "venue": "Palais des Sports", "date": "2030-10-10T19:00",
        "total_seats": 5, "ticket_types": json.dumps(types)})
    assert r_c.status_code == 201
    cid = r_c.json()["id"]
    tt_id = r_c.json()["ticket_types"][0]["id"]

    r_ord = order(client, cid, tt_id, 1, "RESERVE")
    assert r_ord.status_code == 201
    order_ref = r_ord.json()["reference"]
    orders = client.get("/api/admin/orders", headers=auth).json()["items"]
    order_id = [o["id"] for o in orders if o["reference"] == order_ref][0]
    client.post(f"/api/admin/orders/{order_id}/accept", headers=auth, json={"mark_paid": True})

    # 2. Création d'un sous-compte contrôleur (STAFF_SCANNER)
    res_staff = client.post("/api/admin/staff", headers=auth, json={
        "name": "Porte A - Contrôleur",
        "email": "scanner.porte.a@test.com",
        "password": "PasswordStaff123!",
        "assigned_concert_id": cid,
    })
    assert res_staff.status_code == 201
    staff_id = res_staff.json()["id"]

    # 3. Connexion directe du staff scanner
    r_login = client.post("/api/auth/login", json={
        "email": "scanner.porte.a@test.com",
        "password": "PasswordStaff123!",
    })
    assert r_login.status_code == 200
    staff_token = r_login.json()["access_token"]
    staff_auth = {"Authorization": f"Bearer {staff_token}"}

    # 4. Le staff NE PEUT PAS accéder au dashboard ou aux commandes
    r_no_dash = client.get("/api/admin/dashboard", headers=staff_auth)
    assert r_no_dash.status_code == 403
    r_no_orders = client.get("/api/admin/orders", headers=staff_auth)
    assert r_no_orders.status_code == 403

    # 5. Le staff peut télécharger le manifest hors-ligne de son concert
    r_manifest = client.get(f"/api/admin/scanner/manifest?concert_id={cid}", headers=staff_auth)
    assert r_manifest.status_code == 200
    manifest = r_manifest.json()
    assert manifest["concert_id"] == cid
    assert "tickets" in manifest
    assert len(manifest["tickets"]) > 0

    valid_ticket = [t for t in manifest["tickets"] if t["status"] == "VALID"][0]
    offline_token = valid_ticket["token"]

    # 6. Synchronisation hors-ligne par lot
    sync_payload = {
        "concert_id": cid,
        "scans": [
            {"token": offline_token, "scanned_at": "2030-11-20T18:05:00"},
        ],
    }
    r_sync = client.post("/api/admin/scanner/sync-offline", headers=staff_auth, json=sync_payload)
    assert r_sync.status_code == 200
    assert r_sync.json()["synced"] == 1

    # 7. Un nouveau scan de ce même billet retourne ALREADY_USED
    r_scan2 = client.post("/api/admin/scan", headers=staff_auth, json={"token": offline_token})
    assert r_scan2.status_code == 200
    assert r_scan2.json()["result"] == "ALREADY_USED"

    # 8. Nettoyage staff
    r_del = client.delete(f"/api/admin/staff/{staff_id}", headers=auth)
    assert r_del.status_code == 204


def test_orders_csv_export(client, auth):
    r_csv = client.get("/api/admin/orders/export-csv", headers=auth)
    assert r_csv.status_code == 200
    assert "text/csv" in r_csv.headers["content-type"]
    assert "attachment" in r_csv.headers["content-disposition"]
    # Vérification présence de l'en-tête BOM et colonnes
    content = r_csv.text
    assert "Référence;Concert;Organisateur;Client;Email" in content


def test_spectator_simple_login_and_2fa_toggle(client):
    email = "spectateur.simple@example.com"
    name = "Spectateur Simple"

    # Créer un compte client en passant une commande
    concerts = client.get("/api/concerts").json()
    cid = concerts[0]["id"]
    tt_id = concerts[0]["ticket_types"][0]["id"]
    r_o = order(client, cid, tt_id, 1, "RESERVE")
    assert r_o.status_code == 201

    with SessionLocal() as db:
        from app.models.entities import ClientAccount
        ca = db.scalar(select(ClientAccount).where(ClientAccount.email == email))
        if not ca:
            ca = ClientAccount(email=email, name=name, totp_enabled=False)
            db.add(ca)
            db.commit()

    # 1. Vérification : l'A2F n'est PAS activée par défaut pour les spectateurs
    r_check = client.post("/api/client/auth/check", json={"email": email})
    assert r_check.status_code == 200
    assert r_check.json()["totp_enabled"] is False

    # 2. Connexion simple en un clic (sans code requis)
    r_login = client.post("/api/client/auth/login-simple", json={"email": email})
    assert r_login.status_code == 200
    client_token = r_login.json()["access_token"]
    c_auth = {"Authorization": f"Bearer {client_token}"}

    # 3. Le spectateur accède à son espace
    r_orders = client.get("/api/client/orders", headers=c_auth)
    assert r_orders.status_code == 200

    # 4. Le spectateur choisit d'activer l'A2F
    r_enable = client.post("/api/client/auth/enable-2fa", headers=c_auth)
    assert r_enable.status_code == 200
    secret = r_enable.json()["secret"]
    assert r_enable.json()["qr_code"].startswith("data:image/png;base64,")

    # 5. Confirmation avec code valide de Google Authenticator
    valid_code = get_totp_token(secret)
    r_confirm = client.post("/api/client/auth/confirm-enable-2fa", headers=c_auth, json={"code": valid_code})
    assert r_confirm.status_code == 200

    # 6. Vérification : A2F est désormais activée
    r_check2 = client.post("/api/client/auth/check", json={"email": email})
    assert r_check2.json()["totp_enabled"] is True

    # 7. La connexion simple est désormais bloquée
    r_fail_simple = client.post("/api/client/auth/login-simple", json={"email": email})
    assert r_fail_simple.status_code == 403

    # 8. Connexion avec code A2F
    new_code = get_totp_token(secret)
    r_login_2fa = client.post("/api/client/auth/verify", json={"email": email, "code": new_code})
    assert r_login_2fa.status_code == 200
    token_2fa = r_login_2fa.json()["access_token"]
    c_auth2 = {"Authorization": f"Bearer {token_2fa}"}

    # 9. Le spectateur désactive l'A2F
    curr_code = get_totp_token(secret)
    r_disable = client.post("/api/client/auth/disable-2fa", headers=c_auth2, json={"code": curr_code})
    assert r_disable.status_code == 200

    # 10. Vérification : A2F est désactivée
    r_check3 = client.post("/api/client/auth/check", json={"email": email})
    assert r_check3.json()["totp_enabled"] is False


def test_sliding_window_rate_limiter():
    from app.core.limiter import SlidingWindowLimiter
    limiter = SlidingWindowLimiter()
    key = "test-client-ip"

    # Autorise 3 requêtes en 10 secondes
    assert limiter.check(key, max_requests=3, window_seconds=10)[0] is True
    assert limiter.check(key, max_requests=3, window_seconds=10)[0] is True
    assert limiter.check(key, max_requests=3, window_seconds=10)[0] is True

    # La 4ème requête est rejetée avec Retry-After
    allowed, remaining, retry_after = limiter.check(key, max_requests=3, window_seconds=10)
    assert allowed is False
    assert remaining == 0
    assert retry_after >= 1

