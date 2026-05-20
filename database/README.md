# Database — QuantGoeuryInvestments

## Stack

- **PostgreSQL 15** — primary datastore
- **Prisma ORM** — type-safe queries, migrations, seed
- **Schema location**: `backend/prisma/schema.prisma`
- **Migrations**: `backend/prisma/migrations/`

---

## Models

| Model | Description |
|-------|-------------|
| `User` | Auth accounts — status: PENDING / APPROVED / REJECTED / SUSPENDED |
| `UserSettings` | Encrypted API keys per user |
| `Stock` | Ticker universe (25 stocks seeded) |
| `StockScore` | Computed composite scores (time-series) |
| `StockSignal` | Alpha engine signals (TTL-based) |
| `Watchlist` | User ↔ Stock many-to-many |
| `Report` | Generated research reports (with optional PDF path) |

---

## Common Commands

```bash
cd backend

# Apply all pending migrations
npx prisma migrate deploy

# Create a new migration (dev)
npx prisma migrate dev --name describe_change

# Reset DB (wipe + re-migrate + re-seed)
npx prisma migrate reset

# Open Prisma Studio (visual DB browser)
npx prisma studio

# Seed (admin user + 25 stocks + demo scores)
npx ts-node prisma/seed.ts

# Generate Prisma client after schema changes
npx prisma generate
```

---

## Indexes

Key indexes defined in `schema.prisma`:

- `Stock.symbol` — unique, used in all lookups
- `User.email` — unique, auth lookup
- `StockScore.stockId + computedAt` — for latest score queries
- `StockSignal.stockId + expiresAt` — for active signal queries
- `Watchlist.userId + stockId` — unique composite

---

## Encryption

All API keys stored in `UserSettings` are encrypted at the application layer with **AES-256-CBC** before being written to the database. The `ENCRYPTION_KEY` environment variable (64-char hex) is the master key. Never store it in the database.

---

## Backup

```bash
# Dump
pg_dump -U quant_user quant_db > backup.sql

# Restore
psql -U quant_user quant_db < backup.sql
```

---

## Connection String Format

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

Default dev: `postgresql://quant_user:quant_password@localhost:5432/quant_db`
