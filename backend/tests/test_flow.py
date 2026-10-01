import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import decrypt_ticket, encrypt_ticket
from app.db.session import SessionLocal
from app.main import app
from app.models.entities import Ticket

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


def order(client, cid, tid, qty, mode="RESERVE", proof=None):
    files = {"proof": ("p.png", proof, "image/png")} if proof else None
    return client.post("/api/orders", data={
        "concert_id": cid, "ticket_type_id": tid, "quantity": qty, "pay_mode": mode,
        "customer_name": "Jean Rakoto", "customer_email": "Jean@Example.com"}, files=files)


def test_admin_routes_require_auth(client):
    assert client.get("/api/admin/dashboard").status_code == 401
    assert client.post("/api/auth/login", json={"email": "admin@test.com", "password": "x"}).status_code == 401


def test_qr_is_encrypted_and_tamper_proof():
    tok = encrypt_ticket("abc-123")
    assert "abc-123" not in tok and decrypt_ticket(tok) == "abc-123"
    assert decrypt_ticket(tok[:-4] + "AAAA") is None and decrypt_ticket("TICKET-1") is None


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
    assert scan(token)["result"] == "NOT_PAID"
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
