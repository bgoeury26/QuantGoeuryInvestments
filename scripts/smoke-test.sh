#!/usr/bin/env bash
# =============================================================
# QuantGoeuryInvestments — Smoke test
# Usage: bash scripts/smoke-test.sh [BASE_URL]
# =============================================================
set -euo pipefail

BASE=${1:-http://localhost:3001}
GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
PASS=0; FAIL=0

check() {
  local label=$1 url=$2 expected=${3:-200}
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$code" = "$expected" ]; then
    echo -e "${GREEN}PASS${NC} [$code] $label"
    PASS=$((PASS+1))
  else
    echo -e "${RED}FAIL${NC} [$code] $label (expected $expected)"
    FAIL=$((FAIL+1))
  fi
}

check_auth() {
  local label=$1 url=$2 token=$3 expected=${4:-200}
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $token" "$url")
  if [ "$code" = "$expected" ]; then
    echo -e "${GREEN}PASS${NC} [$code] $label"
    PASS=$((PASS+1))
  else
    echo -e "${RED}FAIL${NC} [$code] $label (expected $expected)"
    FAIL=$((FAIL+1))
  fi
}

echo "=== QuantGoeuryInvestments Smoke Test ==="
echo "Base URL: $BASE"
echo ""

# ── Public endpoints ─────────────────────────────────────────────────────
check "Health check"        "$BASE/health"
check "Auth: missing creds" "$BASE/auth/login" 401

# ── Login ────────────────────────────────────────────────────────────────
ADMIN_EMAIL=${ADMIN_EMAIL:-goeurybenjamin@gmail.com}
ADMIN_PASS=${ADMIN_PASS:-ChangeMe123!}

LOGIN_RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || echo '')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}FAIL${NC} Login — no token returned (check admin credentials in .env)"
  FAIL=$((FAIL+1))
else
  echo -e "${GREEN}PASS${NC} [200] Login — token received"
  PASS=$((PASS+1))

  # ── Authenticated endpoints ─────────────────────────────────────────────
  check_auth "Stocks: list all"         "$BASE/stocks"                      "$TOKEN"
  check_auth "Stocks: search AAPL"      "$BASE/stocks/search?q=AAPL"        "$TOKEN"
  check_auth "Stocks: quote AAPL"       "$BASE/stocks/AAPL/quote"           "$TOKEN"
  check_auth "Scoring: top opps"        "$BASE/scoring/opportunities"        "$TOKEN"
  check_auth "Alpha: early opps"        "$BASE/alpha/early-opportunities"    "$TOKEN"
  check_auth "Opportunities: top"       "$BASE/opportunities/top"            "$TOKEN"
  check_auth "Flows: insider trades"    "$BASE/flows/insider-trades"         "$TOKEN"
  check_auth "Macro: dashboard"         "$BASE/macro/dashboard"              "$TOKEN"
  check_auth "Sentiment: AAPL"          "$BASE/sentiment/AAPL"               "$TOKEN"
  check_auth "Admin: user list"         "$BASE/admin/users"                  "$TOKEN"
  check_auth "Settings: get"            "$BASE/settings"                     "$TOKEN"
  check_auth "Users: me"                "$BASE/users/me"                     "$TOKEN"
  check_auth "Users: watchlist"         "$BASE/users/watchlist"              "$TOKEN"
  check_auth "Reports: list"            "$BASE/reports"                      "$TOKEN"
fi

# ── Summary ──────────────────────────────────────────────────────────────
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && echo -e "${GREEN}All checks passed ✅${NC}" || echo -e "${RED}$FAIL check(s) failed ❌${NC}"
exit $FAIL
