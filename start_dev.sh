#!/usr/bin/env bash

# ITIX Platform - Script de lancement conjoint (Backend FastAPI + Frontend Vite)
# Utilisation :
#   ./start_dev.sh          # Lancement normal (auto-seed si base vide)
#   ./start_dev.sh --reset  # Réinitialise la base avec des données de test fraîches

set -e

# Couleurs pour le terminal
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo -e "${BOLD}${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          ITIX PLATFORM — ENVIRONNEMENT DE DÉVELOPPEMENT      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 1. Vérification du virtualenv Python
if [ -d ".venv" ]; then
    PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
    UVICORN_BIN="$ROOT_DIR/.venv/bin/uvicorn"
elif command -v python3 &>/dev/null; then
    PYTHON_BIN="python3"
    UVICORN_BIN="uvicorn"
else
    echo -e "${RED}❌ Erreur: Python 3 est introuvable.${NC}"
    exit 1
fi

# 2. Vérification et création du fichier .env si absent
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚙  Création automatique du fichier .env pour le développement local...${NC}"
    "$PYTHON_BIN" -c "
import os, secrets
env_path = '.env'
example_path = '.env.example'
content = ''
if os.path.exists(example_path):
    with open(example_path, 'r', encoding='utf-8') as f:
        content = f.read()

jwt = secrets.token_urlsafe(48)
qr = secrets.token_urlsafe(48)

# Remplacement ou ajout des secrets
if 'QR_SECRET=' in content:
    lines = []
    for line in content.splitlines():
        if line.startswith('QR_SECRET='):
            lines.append(f'QR_SECRET={qr}')
        elif line.startswith('JWT_SECRET=') and len(line.split('=', 1)[1].strip()) < 32:
            lines.append(f'JWT_SECRET={jwt}')
        else:
            lines.append(line)
    content = '\n'.join(lines) + '\n'
else:
    content += f'\nJWT_SECRET={jwt}\nQR_SECRET={qr}\n'

with open(env_path, 'w', encoding='utf-8') as f:
    f.write(content)
"
    echo -e "${GREEN}✓ Fichier .env configuré avec succès avec des secrets sécurisés.${NC}"
fi

# 3. Vérification des dépendances Node.js du Frontend
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}📦 Installation des dépendances frontend (npm install)...${NC}"
    npm --prefix frontend install
    echo -e "${GREEN}✓ Dépendances frontend installées.${NC}"
fi

# 4. Initialisation des données de test
SEED_ARGS=""
if [[ "$*" == *"--reset"* ]] || [[ "$*" == *"--force"* ]]; then
    SEED_ARGS="--force"
fi

echo -e "${CYAN}🌱 Chargement / Vérification des données de démonstration...${NC}"
PYTHONPATH=backend "$PYTHON_BIN" -m app.services.seed_demo $SEED_ARGS

# 5. Gestion des ports (libération si déjà occupés)
check_port() {
    local port=$1
    local name=$2
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}⚠️  Le port $port ($name) est déjà utilisé. Arrêt des processus existants...${NC}"
        kill -9 $pids 2>/dev/null || true
        sleep 1
    fi
}
check_port 8000 "Backend FastAPI"
check_port 5173 "Frontend Vite"

# 6. Fonctions de nettoyage lors de l'arrêt (Ctrl+C)
CLEANED=0
cleanup() {
    if [ "$CLEANED" -eq 1 ]; then
        return
    fi
    CLEANED=1
    echo -e "\n${YELLOW}🛑 Arrêt des serveurs ITIX (Backend & Frontend)...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    echo -e "${GREEN}✓ Tous les serveurs sont arrêtés. À bientôt !${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 7. Démarrage du Backend
echo -e "${GREEN}🚀 Démarrage du Backend FastAPI sur http://localhost:8000...${NC}"
PYTHONPATH=backend "$UVICORN_BIN" app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Petit délai d'attente pour que le backend s'initialise
sleep 1

# 8. Démarrage du Frontend
echo -e "${GREEN}🚀 Démarrage du Frontend Vite sur http://localhost:5173...${NC}"
npm --prefix frontend run dev -- --host &
FRONTEND_PID=$!

echo -e "\n${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  ✨ ITIX PLATFORM EST EN COURS D'EXÉCUTION !                   ${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "  🌐 Frontend : ${CYAN}http://localhost:5173${NC}"
echo -e "  ⚙️  Backend  : ${CYAN}http://localhost:8000${NC}"
echo -e "  📚 Swagger  : ${CYAN}http://localhost:8000/docs${NC}"
echo -e "----------------------------------------------------------------"
echo -e "  💡 Appuyez sur ${BOLD}Ctrl+C${NC} pour stopper simultanément les 2 serveurs."
echo -e "${BOLD}${GREEN}================================================================${NC}\n"

# Attente des processus enfants
wait
