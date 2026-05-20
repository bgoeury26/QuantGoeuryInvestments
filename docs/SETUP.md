# Setup Guide — QuantGoeuryInvestments

## Prerequisites

- Node.js 20+
- Docker + Docker Compose
- Git

---

## Quick Start (Docker — Recommended)

```bash
# 1. Clone
git clone https://github.com/bgoeury26/QuantGoeuryInvestments.git
cd QuantGoeuryInvestments

# 2. Configure environment
cp .env.example .env
# Edit .env and fill in your API keys (see docs/API_KEYS.md)

# 3. Start everything
docker-compose up -d

# 4. Run DB migrations + seed
docker-compose exec backend npx prisma migrate dev
docker-compose exec backend npx prisma db seed

# 5. Open the app
open http://localhost:3000
```

The seed creates the admin account `goeurybenjamin@gmail.com` with password `admin123` — **change it immediately**.

---

## Manual Setup (Development)

### 1. Database

```bash
# Start PostgreSQL locally or use a free Supabase/Neon instance
# Update DATABASE_URL in .env
```

### 2. Backend

```bash
cd backend
npm install

# Run migrations
npx prisma migrate dev
npx prisma generate
npx prisma db seed

# Start dev server
npm run start:dev
# API available at http://localhost:3001
# Swagger docs at http://localhost:3001/api
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:3000
```

---

## API Keys Required

Minimum required keys for core functionality:

| Key | Where to get | Free tier |
|---|---|---|
| `FMP_API_KEY` | https://financialmodelingprep.com | 250 calls/day |
| `FINNHUB_API_KEY` | https://finnhub.io | 60 calls/min |
| `FRED_API_KEY` | https://fred.stlouisfed.org | Unlimited |

Optional (enhances signals):

| Key | Where to get |
|---|---|
| `POLYGON_API_KEY` | https://polygon.io |
| `ALPHA_VANTAGE_API_KEY` | https://alphavantage.co |
| `NEWS_API_KEY` | https://newsapi.org |
| `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` | https://www.reddit.com/prefs/apps |
| `BLUESKY_IDENTIFIER` + `BLUESKY_PASSWORD` | https://bsky.app |
| `CONGRESS_API_KEY` | https://api.congress.gov |

---

## First Login

1. Navigate to `http://localhost:3000/login`
2. Log in with `goeurybenjamin@gmail.com` / `admin123`
3. Go to **Settings** and enter your API keys
4. Register additional users from the login page — they will be `PENDING`
5. Approve them from the **Admin Panel** (`/admin`)

---

## Running the Scoring Engine

The scoring engine runs automatically via the NestJS scheduler (every 4 hours). To trigger manually:

```bash
# From backend directory
curl -X POST http://localhost:3001/scoring/run \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Or uncomment the cron trigger in `backend/src/scoring/scoring.scheduler.ts`.

---

## Production Deployment

### Recommended: Railway.app (Free tier available)

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

Set all `.env` variables in Railway dashboard. Add a PostgreSQL plugin from the Railway marketplace.

### Alternative: Render.com

- Web Service (backend) + Static Site (frontend) + PostgreSQL — all on free tier
- Total cost: €0/month

---

## Estimated Monthly Cost

| Component | Provider | Cost |
|---|---|---|
| Frontend hosting | Vercel / Render | €0 |
| Backend hosting | Render / Railway | €0–5 |
| Database | Neon / Supabase | €0 |
| All APIs | Free tiers | €0 |
| **Total** | | **€0–5/month** |
