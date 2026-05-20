-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "SignalType" AS ENUM ('ACCUMULATION', 'MOMENTUM_IGNITION', 'SENTIMENT_PUMP', 'SMART_MONEY_ENTRY', 'RISK_WARNING', 'NEUTRAL');

-- CreateTable: User
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable: UserSettings
CREATE TABLE "UserSettings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fmpApiKey" TEXT,
  "finnhubApiKey" TEXT,
  "polygonApiKey" TEXT,
  "alphaVantageKey" TEXT,
  "newsApiKey" TEXT,
  "fredApiKey" TEXT,
  "redditClientId" TEXT,
  "redditClientSecret" TEXT,
  "blueskyIdentifier" TEXT,
  "blueskyPassword" TEXT,
  "congressApiKey" TEXT,
  "gdeltEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Stock
CREATE TABLE "Stock" (
  "id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sector" TEXT,
  "industry" TEXT,
  "marketCap" DOUBLE PRECISION,
  "lastPrice" DOUBLE PRECISION,
  "priceChange" DOUBLE PRECISION,
  "priceChangePct" DOUBLE PRECISION,
  "volume" DOUBLE PRECISION,
  "avgVolume30d" DOUBLE PRECISION,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Stock_symbol_key" ON "Stock"("symbol");

-- CreateTable: StockScore
CREATE TABLE "StockScore" (
  "id" TEXT NOT NULL,
  "stockId" TEXT NOT NULL,
  "fundamentalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "technicalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sentimentScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "institutionalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "analystScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "politicalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "macroScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "finalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidenceFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "rankingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "anomalyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockScore_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockScore_stockId_idx" ON "StockScore"("stockId");
CREATE INDEX "StockScore_rankingScore_idx" ON "StockScore"("rankingScore");
ALTER TABLE "StockScore" ADD CONSTRAINT "StockScore_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: StockSignal
CREATE TABLE "StockSignal" (
  "id" TEXT NOT NULL,
  "stockId" TEXT NOT NULL,
  "signalType" "SignalType" NOT NULL DEFAULT 'NEUTRAL',
  "strength" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "description" TEXT,
  "drivers" JSONB,
  "earlyFlag" BOOLEAN NOT NULL DEFAULT false,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "StockSignal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockSignal_stockId_idx" ON "StockSignal"("stockId");
CREATE INDEX "StockSignal_detectedAt_idx" ON "StockSignal"("detectedAt");
ALTER TABLE "StockSignal" ADD CONSTRAINT "StockSignal_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ApiCache
CREATE TABLE "ApiCache" (
  "id" TEXT NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "endpoint" TEXT NOT NULL,
  "symbol" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiCache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiCache_cacheKey_key" ON "ApiCache"("cacheKey");
CREATE INDEX "ApiCache_cacheKey_idx" ON "ApiCache"("cacheKey");
CREATE INDEX "ApiCache_expiresAt_idx" ON "ApiCache"("expiresAt");

-- CreateTable: Watchlist
CREATE TABLE "Watchlist" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stockId" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Watchlist_userId_stockId_key" ON "Watchlist"("userId", "stockId");
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Report
CREATE TABLE "Report" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "pdfPath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Report_userId_idx" ON "Report"("userId");
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
