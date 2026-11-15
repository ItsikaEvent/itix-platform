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


@pytest.fixture(scope="module")
def auth(client):
    r = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "S3cret-pass"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


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

    # 2. L'organisateur se connecte avec son mot de passe temporaire
    res_login = client.post("/api/auth/login", json={"email": "livenation@test.com", "password": temp_pass})
    assert res_login.status_code == 200
    org_token = res_login.json()["access_token"]
    org_auth = {"Authorization": f"Bearer {org_token}"}
    assert res_login.json()["user"]["must_change_password"] is True

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
    token_org2 = client.post("/api/auth/login", json={"email": "autre@test.com", "password": org2_temp}).json()["access_token"]
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

