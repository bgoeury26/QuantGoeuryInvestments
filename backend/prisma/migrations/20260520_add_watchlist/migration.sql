-- CreateTable WatchlistEntry (if not already present)
CREATE TABLE IF NOT EXISTS "WatchlistEntry" (
    "id"      TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId"  TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchlistEntry_pkey" PRIMARY KEY ("id")
);

-- UniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WatchlistEntry_userId_stockId_key"
    ON "WatchlistEntry"("userId", "stockId");

-- FK userId
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WatchlistEntry_userId_fkey'
  ) THEN
    ALTER TABLE "WatchlistEntry"
      ADD CONSTRAINT "WatchlistEntry_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- FK stockId
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WatchlistEntry_stockId_fkey'
  ) THEN
    ALTER TABLE "WatchlistEntry"
      ADD CONSTRAINT "WatchlistEntry_stockId_fkey"
      FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
