# 🎟️ Billetterie Concerts

React + TypeScript + Tailwind (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL · Docker.

## Démarrage local
```bash
cp .env.example .env
# Renseignez dans .env : POSTGRES_PASSWORD, JWT_SECRET, QR_SECRET, ADMIN_PASSWORD
# (secret : python -c "import secrets; print(secrets.token_urlsafe(48))")
docker compose up --build
```
| Service | URL |
|---|---|
| Site public | http://localhost:5173 |
| Connexion admin | bouton « Se connecter en admin » (en haut à gauche) |
| API / Swagger | http://localhost:8000/docs |
| E-mails de test (Mailpit) | http://localhost:8025 |

Les tables sont créées automatiquement au démarrage et le compte admin est créé depuis `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Parcours
1. **Public** : accueil (affiches) → concert → formulaire (nom, e-mail, type, nombre, *payer* ou *commander*) → « Obtenir mes billets » → message de confirmation.
2. **Admin** : Dashboard filtré par événement (cartes cliquables → détail) · Concerts (CRUD, affiche, types de billets) · Commandes (vérifier, **accepter** = génère les QR uniques + e-mail, **refuser** avec motif, marquer payé) · Scanner QR (caméra ou photo).

## Sécurité du QR Code
Le QR contient un **jeton chiffré** (Fernet : AES + HMAC) avec `QR_SECRET`. Un lecteur de QR standard ne voit qu'une suite de caractères illisibles, impossible à falsifier sans la clé. Le serveur déchiffre, retrouve le billet en base, vérifie le paiement, puis passe le billet à « utilisé » par un `UPDATE … WHERE status='VALID'` atomique (pas de double entrée, même avec deux scanners simultanés).
Le contenu d'un QR reste évidemment *copiable* : la protection vient du contrôle serveur, pas du secret du QR.

## Stock
À la commande, la ligne du type de billet est verrouillée (`SELECT … FOR UPDATE`) puis les places déjà commandées (en attente + acceptées) sont recomptées : impossible de dépasser le stock. Un refus libère les places.

## Tests backend
```bash
docker compose exec backend pytest
```

## Déploiement
- **Backend + PostgreSQL sur Render** : `render.yaml` (Blueprint). Renseignez `ADMIN_*`, `CORS_ORIGINS` (URL du frontend) et `SMTP_*` dans le dashboard Render.
- **Frontend** : Vercel (racine `frontend`, variable `VITE_API_URL` = URL du backend Render) ou image Docker `prod` : `docker build --target prod --build-arg VITE_API_URL=https://... ./frontend`.
- La caméra du scanner exige **HTTPS** (ou localhost).
- Les images (affiches, preuves) sont stockées dans PostgreSQL : rien à configurer côté fichiers.
