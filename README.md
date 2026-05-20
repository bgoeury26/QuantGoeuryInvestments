# QuantGoeuryInvestments

> **Hedge fund-grade AI financial intelligence platform** — ultra-low cost, signal-first, built for early opportunity detection.

[![Backend Tests](https://img.shields.io/badge/tests-59%20passing-brightgreen)]
[![Docker](https://img.shields.io/badge/docker-ready-blue)]
[![Cost Target](https://img.shields.io/badge/cost-FREE%20%2F%20%3C%E2%82%AC20%2Fmo-success)]

---

## 🎯 What This Is

QuantGoeuryInvestments is a complete AI-powered financial research terminal combining:

| Layer | What it does |
|---|---|
| **Scoring Engine V2** | 0→10 score across 7 weighted dimensions with z-score normalization & time decay |
| **Alpha Engine** | Hidden signal detection — volume spikes, price-volume divergence, social attention bursts, insider clusters |
| **Opportunity Ranker** | Dynamic ranking system identifying the best stocks at any moment |
| **AI Multi-Agent Analysis** | Bullish / Bearish / Neutral analysts argue a stock in parallel |
| **Flows Intelligence** | Institutional 13F filings, insider trades, political trades (FEC/Congress API) |
| **Macro Dashboard** | FRED data: Fed rate, inflation, GDP, VIX, DXY, yield curve |
| **PDF Reports** | Puppeteer-generated one-click research reports |

---

## 📁 Repository Structure

```
QuantGoeuryInvestments/
├── backend/                    # NestJS API server
│   ├── src/
│   │   ├── alpha/              # Alpha engine & hidden signal detection
│   │   ├── ai/                 # Multi-agent AI analysis
│   │   ├── auth/               # JWT + bcrypt authentication
│   │   ├── cache/              # Redis-less in-memory + DB caching layer
│   │   ├── flows/              # Institutional, insider, political flows
│   │   ├── macro/              # FRED macroeconomic data
│   │   ├── opportunities/      # Opportunity ranking engine
│   │   ├── prisma/             # Database service
│   │   ├── reports/            # PDF generation (Puppeteer)
│   │   ├── scoring/            # Scoring engine V2
│   │   ├── sentiment/          # News + social + GDELT sentiment
│   │   ├── settings/           # API key management
│   │   ├── stocks/             # Stock data aggregation
│   │   ├── users/              # User management
│   │   ├── admin/              # Admin panel backend
│   │   └── health.controller.ts  # /health, /health/ready, /health/live
│   ├── test/                   # 59 unit + integration tests
│   └── prisma/
│       ├── schema.prisma       # Full database schema
│       └── seed.ts             # Sample data seeding
├── frontend/                   # Next.js 14 App Router
│   └── src/
│       ├── app/                # Pages (dashboard, analysis, flows, opportunities, reports, settings)
│       ├── components/         # UI component library
│       ├── hooks/              # Data-fetching hooks (useStock, useDashboard, useOpportunities)
│       ├── lib/api.ts          # Typed API client (25+ interfaces, all endpoints)
│       └── store/              # Zustand state (authStore, stockStore)
├── database/
│   └── migrations/
├── scripts/
│   ├── smoke-test.sh       # Automated Docker smoke test
│   └── setup.sh            # One-command first-time setup
├── docker-compose.yml          # Production services
├── docker-compose.dev.yml      # Dev hot-reload override
├── .env.example                # All required environment variables
└── docs/
    ├── SCORING_ENGINE.md
    ├── ALPHA_ENGINE.md
    └── API_REFERENCE.md
```

---

## ⚡ Quick Start

### Prerequisites

- Docker 24+ and Docker Compose
- Node.js 20+
- Git

### 1. Clone

```bash
git clone https://github.com/bgoeury26/QuantGoeuryInvestments.git
cd QuantGoeuryInvestments
```

### 2. One-command setup

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This will:
- Copy `.env.example` → `.env`
- Install all dependencies
- Generate Prisma client
- Start Docker services (PostgreSQL + Backend + Frontend)
- Run database migrations
- Seed sample data

### 3. Add your API keys

Edit `.env` with your keys (see [Free API Stack](#-free-api-stack) below):

```bash
nano .env
```

### 4. Verify

```bash
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh
```

**Access:**
| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| Swagger Docs | http://localhost:3001/api |
| Health Check | http://localhost:3001/health |

---

## 🔧 Manual / Dev Setup

```bash
# Terminal 1 — Database
docker compose up postgres -d

# Terminal 2 — Backend (hot reload)
cd backend
npm install
npx prisma migrate dev
npm run start:dev

# Terminal 3 — Frontend
cd frontend
npm install
npm run dev
```

Or use the dev Docker override:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## 🔐 Authentication

- Email + password signup → account starts in **PENDING** status
- Admin (`goeurybenjamin@gmail.com`) approves users via Admin Panel
- Approved users get full platform access
- JWT tokens stored in HTTP-only cookies (7-day expiry)
- Middleware blocks all protected routes for non-approved users

---

## 🧠 Scoring Engine V2

Final score range: **0 → 10**

```
final_score = weighted_sum × confidence_factor
```

| Dimension | Weight | Source |
|---|---|---|
| Fundamental | 2.5 | FMP, Alpha Vantage |
| Technical | 2.0 | Computed (RSI, MACD, MA) |
| Sentiment | 1.5 | NewsAPI, Reddit, Bluesky, GDELT |
| Institutional | 2.0 | SEC EDGAR, 13F filings |
| Analyst | 1.0 | FMP, Finnhub |
| Political | 0.5 | FEC API, Congress API |
| Macro | 0.5 | FRED API |

**Confidence factor** (0.5 → 1.2) is computed from:
- Data completeness across sources
- Signal agreement between independent sources
- Recency of underlying data
- Noise / conflict level

All sub-scores are **z-score normalized** and **time-decay weighted** before combination.

---

## 🔥 Alpha Engine — Hidden Signal Detection

The Alpha Engine detects unusual activity **before price moves**.

### Anomaly Score (0 → 1)

```
anomaly_score = α·volume_anomaly + β·sentiment_velocity
              + γ·insider_activity + δ·institutional_shift
```

### Detection Modules

| Module | Method | Threshold |
|---|---|---|
| **Volume Spike** | Current vs 30-day avg z-score | z > 2.0 |
| **Price-Volume Divergence** | Price flat but volume rising | corr < -0.3 |
| **Social Attention Spike** | Reddit + Bluesky + Wikipedia pageviews | +50% 7d avg |
| **News Velocity Burst** | Article frequency increase | 3× baseline |
| **Insider Cluster** | Multiple insiders buying, same 30d window | ≥2 insiders |
| **Institutional Rotation** | Fund position increases across filings | net positive |

### Signal Types

- `ACCUMULATION` — Smart money quietly building positions
- `MOMENTUM_IGNITION` — Technical breakout setup forming
- `SENTIMENT_PUMP` — Social/news velocity driving attention
- `SMART_MONEY_ENTRY` — Insider + institutional convergence
- `RISK_WARNING` — Negative anomaly pattern detected

### Early Opportunity Flag

Triggered when:
```
anomaly_score > 0.65 AND price_change_5d < 3%
```

---

## 📊 Opportunity Ranking Engine

```
ranking_score = final_score
              + (1.5 × anomaly_score)
              + momentum_bonus
```

Outputs: **Top 10 opportunities** sorted by ranking_score, with:
- Score + Confidence factor
- Signal type classification
- Key drivers (bulleted)
- Early opportunity flag
- Price + % change

---

## 📡 Free API Stack

| Provider | What it powers | Free tier |
|---|---|---|
| [FMP](https://financialmodelingprep.com) | Fundamentals, earnings, analyst ratings | 250 calls/day |
| [Finnhub](https://finnhub.io) | Real-time quotes, news, insider trades | 60 calls/min |
| [Polygon.io](https://polygon.io) | OHLCV charts, aggregates | Unlimited delayed |
| [Alpha Vantage](https://alphavantage.co) | Technicals, fundamentals | 25 calls/day |
| [NewsAPI](https://newsapi.org) | News articles & sentiment | 100 calls/day |
| [FRED](https://fred.stlouisfed.org/docs/api) | Macro indicators | Unlimited free |
| [SEC EDGAR](https://efts.sec.gov/LATEST/search-index) | 13F filings, insider trades | Unlimited free |
| [FEC API](https://api.open.fec.gov) | Political donations | Unlimited free |
| [Congress API](https://api.congress.gov) | Political trades | Unlimited free |
| [Reddit](https://www.reddit.com/dev/api) | WallStreetBets, investing subs | Unlimited free |
| [GDELT](https://www.gdeltproject.org) | Global news sentiment | Unlimited free |
| [Wikipedia Pageviews](https://wikimedia.org/api/rest_v1) | Attention spikes | Unlimited free |

**Estimated monthly cost: €0 — €15** (hosting only if deployed to cloud)

---

## ⚙️ Settings Page — API Key Management

All API keys are managed through the in-app Settings page:
- Keys are **masked** in the UI
- **Encrypted at rest** in the database (AES-256)
- **Status indicators** show live/dead state per provider
- Test each provider individually with latency readout

---

## 📊 Frontend Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/dashboard` | Top 10 opportunities, early signals, macro summary |
| Analysis | `/analysis/[symbol]` | Full stock deep-dive with all signals |
| Flows | `/flows` | Institutional + insider + political flows |
| Opportunities | `/opportunities` | Full ranked list with filters |
| Reports | `/reports` | Generate + download PDF reports |
| Settings | `/settings` | API key management |
| Admin | `/admin` | User approval panel (admin only) |

---

## 🧪 Test Suite

```bash
cd backend
npm test              # Run all 59 tests
npm run test:watch    # Watch mode
npm run test:cov      # Coverage report
```

Test coverage:
- Scoring Engine (z-score, weights, confidence, time decay)
- Alpha Engine (anomaly scoring, signal classification, early detection)
- Opportunity Ranker (ranking formula, sorting, filters)
- Auth (JWT, bcrypt, approval workflow)
- Health endpoint

---

## 🐳 Docker

```bash
# Production
docker compose up -d

# Development (hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Logs
docker compose logs -f backend
docker compose logs -f frontend

# Smoke test
./scripts/smoke-test.sh
```

Services:
| Container | Port | Description |
|---|---|---|
| `quant_postgres` | 5432 | PostgreSQL 16 |
| `quant_backend` | 3001 | NestJS API |
| `quant_frontend` | 3000 | Next.js |

---

## 🔒 Environment Variables

See `.env.example` for all required variables. Key sections:

```env
# Database
DATABASE_URL=postgresql://quant_user:quant_password@localhost:5432/quant_db

# Auth
JWT_SECRET=your-long-random-secret
ADMIN_EMAIL=goeurybenjamin@gmail.com

# Financial APIs (get free keys at each provider)
FMP_API_KEY=
FINNHUB_API_KEY=
POLYGON_API_KEY=
ALPHA_VANTAGE_API_KEY=

# Sentiment APIs
NEWS_API_KEY=
FRED_API_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=

# Feature flags
GDELT_ENABLED=true

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 🤖 AI Analysis Engine

Three parallel agents analyze each stock:

**Bullish Analyst** — Argues for upside using fundamental strength, technical breakouts, positive flow signals

**Bearish Analyst** — Highlights risks: valuation, macro headwinds, distribution signals, insider selling

**Neutral Analyst** — Synthesizes contradictions, weighs evidence, produces probabilistic outlook

Output: Recommendation (BUY/HOLD/SELL) + Confidence score + Price target + Structured arguments

---

## 📚 Docs

- [`docs/SCORING_ENGINE.md`](docs/SCORING_ENGINE.md) — Full scoring formula derivation
- [`docs/ALPHA_ENGINE.md`](docs/ALPHA_ENGINE.md) — Signal detection methodology
- [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) — All API endpoints

---

## 💰 Cost Optimisation

| Strategy | Implementation |
|---|---|
| **Response caching** | All API responses cached in PostgreSQL with TTL |
| **Batch queries** | Multiple symbols fetched in single API call |
| **Computed signal storage** | Scores stored; only recomputed on schedule |
| **Rate limiting** | Per-provider call budgets enforced |
| **Free tier prioritisation** | EDGAR, FRED, GDELT, Wikipedia = unlimited free |

Target: **€0 free tier / €15 max with cloud hosting**

---

*Built by Benjamin Goeury — Luxembourg 🇱🇺*
