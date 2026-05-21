-- =============================================================
-- QuantGoeuryInvestments — Full Initial Migration
-- Single source of truth. All tables created in dependency order.
-- =============================================================

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('ACCUMULATION', 'MOMENTUM_IGNITION', 'SENTIMENT_PUMP', 'SMART_MONEY_ENTRY', 'RISK_WARNING', 'NEUTRAL');

-- ---------------------------------------------------------------
-- 1. User (no foreign keys — must be first)
-- ---------------------------------------------------------------
CREATE TABLE "User" (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
    "email"     TEXT NOT NULL,
    "password"  TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "role"      "UserRole"   NOT NULL DEFAULT 'USER',
    "status"    "UserStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- ---------------------------------------------------------------
-- 2. Stock (no foreign keys)
-- ---------------------------------------------------------------
CREATE TABLE "Stock" (
    "id"             TEXT NOT NULL DEFAULT gen_random_uuid(),
    "symbol"         TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "sector"         TEXT,
    "industry"       TEXT,
    "marketCap"      DOUBLE PRECISION,
    "lastPrice"      DOUBLE PRECISION,
    "priceChange"    DOUBLE PRECISION,
    "priceChangePct" DOUBLE PRECISION,
    "volume"         DOUBLE PRECISION,
    "avgVolume30d"   DOUBLE PRECISION,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Stock_symbol_key" ON "Stock"("symbol");

-- ---------------------------------------------------------------
-- 3. Tables that depend only on Stock
-- ---------------------------------------------------------------
CREATE TABLE "StockScore" (
    "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
    "stockId"           TEXT NOT NULL,
    "fundamentalScore"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "technicalScore"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sentimentScore"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "institutionalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "analystScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "politicalScore"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "macroScore"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalScore"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceFactor"  DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "rankingScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "anomalyScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "computedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockScore_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockScore_stockId_idx" ON "StockScore"("stockId");
CREATE INDEX "StockScore_rankingScore_idx" ON "StockScore"("rankingScore");

CREATE TABLE "StockSignal" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
    "stockId"     TEXT NOT NULL,
    "signalType"  "SignalType" NOT NULL DEFAULT 'NEUTRAL',
    "strength"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "drivers"     JSONB,
    "earlyFlag"   BOOLEAN NOT NULL DEFAULT false,
    "detectedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"   TIMESTAMP(3),
    CONSTRAINT "StockSignal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockSignal_stockId_idx" ON "StockSignal"("stockId");
CREATE INDEX "StockSignal_detectedAt_idx" ON "StockSignal"("detectedAt");

-- ---------------------------------------------------------------
-- 4. ApiCache (no foreign keys)
-- ---------------------------------------------------------------
CREATE TABLE "ApiCache" (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
    "cacheKey"  TEXT NOT NULL,
    "data"      JSONB NOT NULL,
    "endpoint"  TEXT NOT NULL,
    "symbol"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiCache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiCache_cacheKey_key" ON "ApiCache"("cacheKey");
CREATE INDEX "ApiCache_cacheKey_idx"   ON "ApiCache"("cacheKey");
CREATE INDEX "ApiCache_expiresAt_idx" ON "ApiCache"("expiresAt");

-- ---------------------------------------------------------------
-- 5. Tables that depend on User
-- ---------------------------------------------------------------
CREATE TABLE "UserSettings" (
    "id"                  TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId"              TEXT NOT NULL,
    "fmpApiKey"           TEXT,
    "finnhubApiKey"       TEXT,
    "polygonApiKey"       TEXT,
    "alphaVantageKey"     TEXT,
    "newsApiKey"          TEXT,
    "fredApiKey"          TEXT,
    "redditClientId"      TEXT,
    "redditClientSecret"  TEXT,
    "blueskyIdentifier"   TEXT,
    "blueskyPassword"     TEXT,
    "congressApiKey"      TEXT,
    "gdeltEnabled"        BOOLEAN NOT NULL DEFAULT true,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

CREATE TABLE "Report" (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId"    TEXT NOT NULL,
    "symbol"    TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "content"   JSONB NOT NULL,
    "pdfPath"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Report_userId_idx" ON "Report"("userId");

-- ---------------------------------------------------------------
-- 6. WatchlistEntry (depends on BOTH User AND Stock)
-- ---------------------------------------------------------------
CREATE TABLE "WatchlistEntry" (
    "id"      TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId"  TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchlistEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WatchlistEntry_userId_stockId_key" ON "WatchlistEntry"("userId", "stockId");
CREATE INDEX "WatchlistEntry_userId_idx" ON "WatchlistEntry"("userId");

-- ---------------------------------------------------------------
-- 7. Foreign key constraints (all referenced tables exist now)
-- ---------------------------------------------------------------
ALTER TABLE "UserSettings"
    ADD CONSTRAINT "UserSettings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report"
    ADD CONSTRAINT "Report_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WatchlistEntry"
    ADD CONSTRAINT "WatchlistEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WatchlistEntry"
    ADD CONSTRAINT "WatchlistEntry_stockId_fkey"
    FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockScore"
    ADD CONSTRAINT "StockScore_stockId_fkey"
    FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockSignal"
    ADD CONSTRAINT "StockSignal_stockId_fkey"
    FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
