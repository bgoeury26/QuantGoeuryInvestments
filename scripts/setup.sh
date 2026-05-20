#!/usr/bin/env bash
# =============================================================
# QuantGoeuryInvestments — One-command setup script
# Usage: bash scripts/setup.sh
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERR]${NC}   $*"; exit 1; }

info "QuantGoeuryInvestments — Setup"
echo "-------------------------------------------"

# ── 1. Prerequisites check ───────────────────────────────────────────────
for cmd in node npm docker docker-compose; do
  command -v "$cmd" &>/dev/null || error "$cmd not found. Please install it first."
done
info "Prerequisites OK"

NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
[ "$NODE_VER" -ge 18 ] || error "Node.js >= 18 required (found v${NODE_VER})"

# ── 2. Environment files ─────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env created from .env.example — fill in your API keys before starting."
fi

if [ ! -f frontend/.env.local ]; then
  cp frontend/.env.local.example frontend/.env.local 2>/dev/null || true
fi

# ── 3. Install dependencies ──────────────────────────────────────────────
info "Installing backend dependencies..."
(cd backend && npm install --silent)

info "Installing frontend dependencies..."
(cd frontend && npm install --silent)

# ── 4. Start PostgreSQL via Docker ───────────────────────────────────────
info "Starting PostgreSQL..."
docker-compose -f docker-compose.dev.yml up -d db
sleep 4   # wait for postgres to be ready

# ── 5. Database setup ────────────────────────────────────────────────────
info "Running Prisma migrations..."
(cd backend && npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init --skip-seed)

info "Generating Prisma client..."
(cd backend && npx prisma generate)

info "Seeding database..."
(cd backend && npx ts-node prisma/seed.ts)

# ── 6. Done ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}✅  Setup complete!${NC}"
echo ""
echo "  Start dev servers:"
echo "    Terminal 1:  cd backend  && npm run start:dev"
echo "    Terminal 2:  cd frontend && npm run dev"
echo ""
echo "  Or run everything with Docker:"
echo "    docker-compose up --build"
echo ""
echo "  Default admin: check ADMIN_EMAIL in .env"
echo "  Admin default password: ChangeMe123! (change after first login)"
echo ""
