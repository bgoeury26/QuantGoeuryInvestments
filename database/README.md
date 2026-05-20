# Database — QuantGoeuryInvestments

## Engine

PostgreSQL 15+ via Prisma ORM.

## Connection

Set `DATABASE_URL` in your `.env` file:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/quant_db
```

## Migrations

```bash
# From backend/
npx prisma migrate dev     # Run pending migrations
npx prisma migrate deploy  # Production deploy
npx prisma studio          # Visual DB browser
```

## Schema Summary

| Model | Purpose |
|---|---|
| `User` | Auth, roles (USER/ADMIN), approval status |
| `UserApiSettings` | AES-256-CBC encrypted API keys per user |
| `Stock` | Ticker master list with metadata |
| `StockScore` | V2 scoring engine results (all 7 components) |
| `StockSignal` | Alpha engine signals with TTL |
| `InsiderTrade` | Form 4 SEC filings |
| `InstitutionalFlow` | 13F quarterly holdings |
| `PoliticalSignal` | FEC/Congress STOCK Act disclosures |
| `SentimentData` | Reddit/Bluesky/NewsAPI/GDELT aggregated scores |
| `MacroIndicator` | FRED time-series snapshots |
| `WatchlistItem` | User watchlists (many-to-many User↔Stock) |
| `Report` | Generated PDF reports with metadata |

## Seed Data

The seed script (`backend/prisma/seed.ts`) creates:
- Admin user: `goeurybenjamin@gmail.com`
- 20 default watchlist stocks (AAPL, NVDA, MSFT, TSLA, META, etc.)

Run with: `npx prisma db seed`

## Backup (Production)

```bash
# Dump
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup-20260520.sql
```

## Free Hosting Options

| Provider | Free Tier | Notes |
|---|---|---|
| Neon.tech | 512 MB | Serverless, auto-pause |
| Supabase | 500 MB | Includes auth + storage |
| Railway | 1 GB | 5 USD/month after free tier |
| Render | 1 GB | 90-day free trial |
