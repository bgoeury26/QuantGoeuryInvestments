# QuantGoeuryInvestments — Setup Guide

## Quick Start (5 minutes)

```bash
git clone https://github.com/bgoeury26/QuantGoeuryInvestments.git
cd QuantGoeuryInvestments
bash scripts/setup.sh
```

Then start the dev servers:

```bash
# Terminal 1 — Backend (NestJS)
cd backend && npm run start:dev

# Terminal 2 — Frontend (Next.js)
cd frontend && npm run dev
```

Open http://localhost:3000

---

## Prerequisites

| Tool | Min version | Install |
|------|------------|----------|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | Bundled with Node |
| Docker | 24+ | https://docker.com |
| Docker Compose | 2.2+ | Bundled with Docker Desktop |

---

## Environment Variables

### Backend `.env`

Copy and edit:
```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Random 32+ char secret |
| `ADMIN_EMAIL` | ✅ | Email of the approved admin account |
| `ENCRYPTION_KEY` | ✅ | 64-char hex for AES-256 API key encryption |
| `FMP_API_KEY` | Recommended | Financial Modeling Prep (250 free/day) |
| `FINNHUB_API_KEY` | Recommended | Finnhub (60 free/min) |
| `ALPHA_VANTAGE_API_KEY` | Optional | Alpha Vantage (25 free/day) |
| `NEWS_API_KEY` | Optional | NewsAPI (100 free/day) |
| `FRED_API_KEY` | Optional | FRED macro data (unlimited free) |
| `REDDIT_CLIENT_ID` | Optional | Reddit sentiment |
| `BLUESKY_IDENTIFIER` | Optional | Bluesky sentiment |
| `CONGRESS_API_KEY` | Optional | Congress.gov political trades |
| `OPENAI_API_KEY` | Optional | AI analysis (falls back to rule-based) |

Generate `ENCRYPTION_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### Frontend `.env.local`

```bash
cp frontend/.env.local.example frontend/.env.local
```

Only `NEXT_PUBLIC_API_URL` needs updating if your backend runs on a non-default port.

---

## Database Setup

### Option A — Docker (recommended)

```bash
docker-compose -f docker-compose.dev.yml up -d db
```

This starts PostgreSQL on port 5432 with:
- Database: `quant_db`
- User: `quant_user`
- Password: `quant_password`

### Option B — Local PostgreSQL

Create the database manually:
```sql
CREATE USER quant_user WITH PASSWORD 'quant_password';
CREATE DATABASE quant_db OWNER quant_user;
```

Then update `DATABASE_URL` in `.env`.

### Migrations + Seed

```bash
cd backend
npx prisma migrate deploy   # apply all migrations
npx prisma generate         # generate Prisma client
npx ts-node prisma/seed.ts  # seed admin user + 25 stocks
```

The seed creates:
- Admin user at `ADMIN_EMAIL` with password `ChangeMe123!` (**change immediately**)
- 25-stock universe (AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, JPM...)
- Demo scores and signals so the dashboard is non-empty on first boot

---

## Docker (Production)

```bash
docker-compose up --build
```

Services:
- `db` — PostgreSQL 15
- `backend` — NestJS on port 3001
- `frontend` — Next.js on port 3000

---

## First Login

1. Go to http://localhost:3000/register
2. Create an account — it will be `PENDING`
3. Log in as admin at http://localhost:3000/login with `ADMIN_EMAIL` / `ChangeMe123!`
4. Navigate to **Admin Panel** → approve the new user
5. The user can now log in and access the platform

---

## API Keys — Where to Get Them (All Free)

| Provider | Free tier | Get key |
|----------|-----------|----------|
| FMP | 250 calls/day | https://financialmodelingprep.com/developer/docs |
| Finnhub | 60 calls/min | https://finnhub.io/register |
| Alpha Vantage | 25 calls/day | https://alphavantage.co/support/#api-key |
| NewsAPI | 100 calls/day | https://newsapi.org/register |
| FRED | Unlimited | https://fred.stlouisfed.org/docs/api/api_key.html |
| Congress.gov | Unlimited | https://api.congress.gov/sign-up |
| Reddit | Unlimited | https://www.reddit.com/prefs/apps |
| Bluesky | Unlimited | https://bsky.app (use account credentials) |
| GDELT | Unlimited | No key needed — toggle in Settings |

All keys are saved encrypted (AES-256-CBC) through the **Settings** page in the UI.

---

## Smoke Test

After setup, verify all endpoints:

```bash
bash scripts/smoke-test.sh
# Or against a remote host:
bash scripts/smoke-test.sh https://your-domain.com
```

Expected output: `All checks passed ✅`

---

## Cost Estimate

| Service | Cost |
|---------|------|
| PostgreSQL (self-hosted / Supabase free) | €0 |
| Backend (Fly.io free / VPS €5) | €0–€5 |
| Frontend (Vercel free) | €0 |
| All APIs | €0 (free tiers) |
| OpenAI GPT-4o-mini (optional) | ~€0–€5/mo |
| **Total** | **€0–€10/mo** |

---

## Troubleshooting

**Prisma migration error**: Run `npx prisma migrate reset` in `/backend` to wipe and re-apply.

**Port conflict**: Change `PORT=3001` in `.env` and `NEXT_PUBLIC_API_URL` in `frontend/.env.local`.

**Docker not starting**: Run `docker-compose down -v` then `docker-compose up --build`.

**"Account pending approval"**: Log in as admin and approve the user in the Admin Panel.
