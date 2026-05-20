# QuantGoeuryInvestments — Architecture

## Overview

QuantGoeuryInvestments is a hedge-fund-grade AI research terminal built as a full-stack TypeScript monorepo. It combines financial fundamentals, technical analysis, institutional flows, political signals, social sentiment, and macro data into a unified scoring and ranking engine.

```
QuantGoeuryInvestments/
├── frontend/          # Next.js 14 App Router (TypeScript + TailwindCSS)
├── backend/           # NestJS API (TypeScript)
├── database/          # PostgreSQL schema docs & seed data
├── docs/              # Architecture, API reference, setup guide
└── docker-compose.yml # Full stack Docker setup
```

---

## Frontend — Next.js App Router

### Pages

| Route | Description |
|---|---|
| `/login` | Email/password authentication |
| `/register` | Self-signup (auto-PENDING status) |
| `/dashboard` | Live market overview, top opportunities, recent signals |
| `/analysis/[symbol]` | Full per-stock deep-dive (6 tabs) |
| `/flows` | Institutional, insider & political flows |
| `/opportunities` | Dynamic opportunity ranking engine |
| `/reports` | PDF report generation & archive |
| `/settings` | API key management (AES-256-CBC encrypted) |
| `/admin` | User approval panel (ADMIN only) |

### State Management
- **Zustand** — auth store, persisted to sessionStorage
- **TanStack Query** — all server state, cache + background refetch
- **Axios** instance — auto-injects JWT Bearer token

---

## Backend — NestJS Modules

### Module Map

```
AppModule
├── AuthModule          — JWT login/register, bcrypt, Passport
├── UsersModule         — CRUD, watchlist, admin status
├── AdminModule         — Approve/reject/suspend users
├── StocksModule        — Quote, fundamentals, technicals, history
├── ScoringModule       — V2 scoring engine (7-factor weighted)
├── AlphaModule         — Hidden signal detection, anomaly scoring
├── FlowsModule         — 13F institutional, Form 4 insider, FEC/Congress
├── SentimentModule     — NewsAPI, Reddit, Bluesky, GDELT, Wikimedia
├── MacroModule         — FRED API (rates, CPI, GDP)
├── AiModule            — Multi-agent analysis (Bullish/Bearish/Neutral)
├── OpportunitiesModule — Dynamic ranking engine
├── ReportsModule       — PDF export via Puppeteer
└── SettingsModule      — Encrypted API key storage
```

---

## Scoring Engine V2

### Formula

```
final_score = weighted_sum(components) / W_TOTAL × confidence_factor
```

### Weights

| Factor | Weight |
|---|---|
| Fundamental | 2.5 |
| Technical | 2.0 |
| Institutional | 2.0 |
| Sentiment | 1.5 |
| Analyst | 1.0 |
| Political | 0.5 |
| Macro | 0.5 |
| **Total** | **10.0** |

### Confidence Factor

Range: `0.5 → 1.2`

```
confidence = 0.7 + completeness×0.2 + agreement×0.15 + recency×0.15 - noise×0.2
```

### Ranking Score

```
ranking_score = final_score + 2.0×anomaly_score + momentum_bonus
```

---

## Alpha Engine — Hidden Signal Detection

### Modules

| Module | Signal |
|---|---|
| Volume Spike | Z-score vs 30-day average |
| Price-Volume Divergence | Flat price + rising volume |
| Social Attention Spike | Reddit + Bluesky + GDELT velocity |
| News Velocity Burst | Article frequency acceleration |
| Insider Cluster | Multiple buys within 30 days |
| Institutional Rotation | Cross-filing fund accumulation |

### Anomaly Score

```
anomaly = vol×0.30 + sentiment_velocity×0.25 + insider×0.25 + institutional×0.20
```

### Signal Types

- `ACCUMULATION` — High volume, flat price
- `SMART_MONEY_ENTRY` — Insider + institutional convergence
- `MOMENTUM_IGNITION` — Volume spike + price breakout
- `SENTIMENT_PUMP` — Social/news velocity dominance
- `RISK_WARNING` — Negative anomaly pattern

---

## Database Schema (PostgreSQL + Prisma)

Key models: `User`, `Stock`, `StockScore`, `StockSignal`, `InsiderTrade`, `InstitutionalFlow`, `PoliticalSignal`, `SentimentData`, `MacroIndicator`, `WatchlistItem`, `Report`, `UserApiSettings`.

See `backend/prisma/schema.prisma` for the full schema.

---

## API Endpoints

Full Swagger docs available at `http://localhost:3001/api` when running in development.

### Auth
- `POST /auth/register`
- `POST /auth/login`

### Stocks
- `GET /stocks/:sym`
- `GET /stocks/:sym/quote`
- `GET /stocks/:sym/fundamentals`
- `GET /stocks/:sym/technicals`
- `GET /stocks/:sym/analyst`
- `GET /stocks/:sym/history`

### Alpha
- `GET /alpha/anomaly/:symbol`
- `GET /alpha/signals/:id`
- `GET /alpha/early-opportunities`
- `GET /alpha/signals/recent`

### Flows
- `GET /flows/:sym/institutional`
- `GET /flows/:sym/insider`
- `GET /flows/:sym/political`
- `GET /flows/:sym/summary`

### Opportunities
- `GET /opportunities/top`
- `GET /opportunities/early`

### Reports
- `GET /reports`
- `POST /reports/generate`
- `GET /reports/:id/pdf`

### Admin
- `GET /admin/users`
- `POST /admin/users/:id/approve`
- `POST /admin/users/:id/reject`
- `POST /admin/users/:id/suspend`

---

## Free API Stack

| Provider | Use | Limit |
|---|---|---|
| FMP | Fundamentals, quotes | 250 calls/day |
| Finnhub | Real-time quotes, news | 60 calls/min |
| Polygon | OHLCV history (delayed) | Unlimited |
| Alpha Vantage | Technicals, indicators | 25 calls/day |
| NewsAPI | News sentiment | 100 calls/day |
| FRED | Macro (rates, CPI, GDP) | Unlimited |
| SEC EDGAR | 13F, Form 4 filings | Unlimited |
| Reddit API | Social mentions | 60 calls/min |
| Bluesky ATP | Social sentiment | Unlimited |
| GDELT | Global news events | Unlimited |
| Wikimedia | Page view spikes | Unlimited |
| Congress API | Political trades | Unlimited |
| FEC API | Campaign finance | Unlimited |

**Estimated monthly cost: €0 – €5** (hosting only)
