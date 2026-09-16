ALTER TABLE "PolymarketManagedAccount" ADD COLUMN IF NOT EXISTS "depositWalletAddress" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "PolymarketManagedAccount_depositWalletAddress_key" ON "PolymarketManagedAccount"("depositWalletAddress");
