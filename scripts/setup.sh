#!/usr/bin/env bash
# =============================================================
# QuantGoeuryInvestments — First-Time Setup Script
# Usage: ./scripts/setup.sh
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${BLUE}[SETUP]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC}    $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  QuantGoeuryInvestments — Setup           ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# 1. .env file
if [ ! -f .env ]; then
  cp .env.example .env
  ok "Created .env from .env.example — fill in your API keys!"
else
  warn ".env already exists, skipping copy"
fi

# 2. Backend deps
log "Installing backend dependencies..."
cd backend && npm install && cd ..
ok "Backend deps installed"

# 3. Frontend deps
log "Installing frontend dependencies..."
cd frontend && npm install && cd ..
ok "Frontend deps installed"

# 4. Generate Prisma client
log "Generating Prisma client..."
cd backend && npx prisma generate && cd ..
ok "Prisma client generated"

# 5. Docker
log "Starting Docker services (postgres + backend + frontend)..."
docker compose up -d --build
ok "Docker services started"

# 6. Wait for DB
log "Waiting for PostgreSQL to be healthy..."
for i in {1..20}; do
  if docker exec quant_postgres pg_isready -U quant_user -d quant_db -q 2>/dev/null; then
    ok "PostgreSQL is ready"
    break
  fi
  echo -n "."
  sleep 3
done

# 7. Run migrations
log "Running Prisma migrations..."
cd backend && DATABASE_URL=postgresql://quant_user:quant_password@localhost:5432/quant_db npx prisma migrate deploy && cd ..
ok "Database migrations applied"

# 8. Seed DB
log "Seeding database with sample data..."
cd backend && DATABASE_URL=postgresql://quant_user:quant_password@localhost:5432/quant_db npm run prisma:seed && cd ..
ok "Database seeded"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Setup complete!                          ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  Frontend:  ${BLUE}http://localhost:3000${NC}"
echo -e "  Backend:   ${BLUE}http://localhost:3001${NC}"
echo -e "  Swagger:   ${BLUE}http://localhost:3001/api${NC}"
echo -e "  Health:    ${BLUE}http://localhost:3001/health${NC}"
echo ""
echo -e "  Run smoke test: ${YELLOW}./scripts/smoke-test.sh${NC}"
echo ""
