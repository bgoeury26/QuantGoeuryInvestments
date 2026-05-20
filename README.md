# QuantGoeuryInvestments 🏦

> **Hedge fund-grade AI financial intelligence platform** — built for ultra-low cost operation (FREE → <€20/month)

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-ready-blue)](https://docker.com)

---

## 🎯 Platform Overview

QuantGoeuryInvestments is a full-stack AI-powered financial intelligence terminal combining:

- **Fundamental analysis** — FMP, Alpha Vantage, Finnhub
- **Technical analysis** — Moving averages, RSI, MACD, volume
- **Institutional flows** — SEC EDGAR 13F, insider trades
- **Political signals** — FEC, Congress API
- **Social & news sentiment** — Reddit, Bluesky, GDELT, NewsAPI
- **Macro environment** — FRED API
- **Alpha Engine** — Hidden signal detection BEFORE price moves
- **Opportunity Ranker** — Dynamic top-10 best stocks right now

---

## 🏗️ Architecture

```
QuantGoeuryInvestments/
├── frontend/          # Next.js 15 App Router + TypeScript + TailwindCSS
├── backend/           # NestJS + Prisma + PostgreSQL
├── database/          # Migrations, seeds, schema
├── docs/              # API docs, scoring formulas
└── docker-compose.yml # Full stack orchestration
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, TypeScript, TailwindCSS, Recharts, Zustand |
| Backend | NestJS, Prisma ORM, JWT Auth |
| Database | PostgreSQL 16 |
| Infra | Docker, Docker Compose |
| Auth | JWT + bcrypt, admin approval flow |

---

## 🔐 Auth Flow

1. User signs up → status = `PENDING`
2. Admin (`goeurybenjamin@gmail.com`) approves in `/admin` panel
3. User receives access to the platform

---

## 🧮 Scoring Engine V2

**Score range: 0 → 10**

| Factor | Weight |
|--------|--------|
| Fundamental | 2.5 |
| Technical | 2.0 |
| Sentiment | 1.5 |
| Institutional | 2.0 |
| Analyst | 1.0 |
| Political | 0.5 |
| Macro | 0.5 |

```
final_score = weighted_sum × confidence_factor
confidence_factor ∈ [0.5, 1.2]
```

---

## ⚡ Alpha Engine — Hidden Signal Detection

Detects unusual activity BEFORE major price moves:

- **Volume Spike Detection** — Z-score vs 30-day average
- **Price-Volume Divergence** — Flat price + rising volume = accumulation
- **Social Attention Spike** — Reddit/Bluesky/Wikipedia spikes
- **News Velocity Burst** — Sudden article frequency increase
- **Insider Cluster Activity** — Multiple insiders buying
- **Institutional Rotation** — Fund position increases

```
anomalyscore = weighted(volume_anomaly, sentiment_velocity, insider_activity, institutional_shift)
ranking_score = final_score + (alpha_boost × anomaly_score) + momentum_bonus
```

---

## 📡 Free API Stack

| Category | APIs | Cost |
|----------|------|------|
| Financial | FMP, Finnhub, Polygon, Alpha Vantage | FREE tiers |
| Flows | SEC EDGAR, Congress API | FREE |
| Sentiment | NewsAPI, GDELT, Reddit, Bluesky, Wikimedia | FREE |
| Macro | FRED API | FREE |

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+

### 1. Clone & Configure

```bash
git clone https://github.com/bgoeury26/QuantGoeuryInvestments.git
cd QuantGoeuryInvestments
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Start with Docker

```bash
docker-compose up -d
```

### 3. Run Migrations

```bash
cd backend
npx prisma migrate deploy
npx prisma db seed
```

### 4. Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api

---

## 💾 Cost Optimization

- All API responses cached in PostgreSQL (TTL-based)
- Batch queries aggregated
- Free tier APIs prioritized
- Computed signals stored, not recalculated
- **Target: FREE → <€20/month**

---

## 📄 License

MIT © Benjamin Goeury
