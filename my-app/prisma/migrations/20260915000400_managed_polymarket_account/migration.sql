CREATE TABLE IF NOT EXISTS "PolymarketManagedAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'privy',
    "providerWalletId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "liveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyLimitUsd" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PolymarketManagedAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PolymarketManagedAccount_userId_key" ON "PolymarketManagedAccount"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "PolymarketManagedAccount_providerWalletId_key" ON "PolymarketManagedAccount"("providerWalletId");
CREATE UNIQUE INDEX IF NOT EXISTS "PolymarketManagedAccount_walletAddress_key" ON "PolymarketManagedAccount"("walletAddress");
CREATE INDEX IF NOT EXISTS "PolymarketManagedAccount_status_idx" ON "PolymarketManagedAccount"("status");
DO $$ BEGIN
  ALTER TABLE "PolymarketManagedAccount" ADD CONSTRAINT "PolymarketManagedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
