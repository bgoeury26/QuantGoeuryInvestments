#!/usr/bin/env bash
# =============================================================
# QuantGoeuryInvestments — Docker Smoke Test
# Usage: ./scripts/smoke-test.sh
# Requires: docker, curl, jq
# =============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

log()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
ok()   { echo -e "${GREEN}[PASS]${NC}  $1"; ((PASS++)); }
fail() { echo -e "${RED}[FAIL]${NC}  $1"; ((FAIL++)); }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }

API="http://localhost:3001"
FE="http://localhost:3000"

echo ""
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}  QuantGoeuryInvestments — Smoke Test Suite  ${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""

# ---- 1. Docker services running
log "Checking Docker services..."
for svc in quant_postgres quant_backend quant_frontend; do
  if docker ps --filter "name=$svc" --filter "status=running" --format '{{.Names}}' | grep -q "$svc"; then
    ok "Container $svc is running"
  else
    fail "Container $svc is NOT running"
  fi
done

# ---- 2. Backend health endpoint
log "Testing backend health endpoint..."
for i in {1..12}; do
  STATUS=$(curl -sf "$API/health" -o /tmp/health_resp.json -w "%{http_code}" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    DB_STATUS=$(jq -r '.database.status' /tmp/health_resp.json 2>/dev/null || echo "unknown")
    ok "GET /health → 200 OK (db: $DB_STATUS)"
    break
  fi
  if [ $i -eq 12 ]; then fail "GET /health timed out after 60s (last HTTP $STATUS)"; fi
  warn "Waiting for backend... attempt $i/12"
  sleep 5
done

# ---- 3. Backend readiness probe
log "Testing readiness probe..."
READY=$(curl -sf "$API/health/ready" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
[ "$READY" = "200" ] && ok "GET /health/ready → 200" || fail "GET /health/ready → $READY"

# ---- 4. Swagger API docs
log "Testing Swagger docs..."
SWAG=$(curl -sf "$API/api" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
[ "$SWAG" = "200" ] && ok "GET /api (Swagger) → 200" || fail "GET /api → $SWAG"

# ---- 5. Auth endpoint exists
log "Testing auth endpoint..."
AUTH=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"x","password":"x"}' \
  -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
[ "$AUTH" = "401" ] || [ "$AUTH" = "400" ] && ok "POST /auth/login reachable (returns $AUTH as expected)" || fail "POST /auth/login → unexpected $AUTH"

# ---- 6. Frontend home
log "Testing frontend..."
FE_STATUS=$(curl -sf "$FE" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
[ "$FE_STATUS" = "200" ] || [ "$FE_STATUS" = "307" ] || [ "$FE_STATUS" = "302" ] \
  && ok "Frontend → HTTP $FE_STATUS" || fail "Frontend → $FE_STATUS"

# ---- 7. DB connectivity via health response
log "Verifying DB latency from health response..."
if [ -f /tmp/health_resp.json ]; then
  LATENCY=$(jq -r '.database.latencyMs' /tmp/health_resp.json 2>/dev/null || echo "-1")
  if [ "$LATENCY" -ge 0 ] 2>/dev/null; then
    ok "DB latency: ${LATENCY}ms"
  else
    fail "DB latency not reported"
  fi
fi

# ---- Summary
echo ""
echo -e "${BLUE}==============================================${NC}"
TOTAL=$((PASS + FAIL))
echo -e "Results: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC} / $TOTAL total"
echo -e "${BLUE}==============================================${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}Smoke test FAILED. Check logs: docker compose logs${NC}"
  exit 1
else
  echo -e "${GREEN}All smoke tests passed! Platform is running correctly.${NC}"
  exit 0
fi
