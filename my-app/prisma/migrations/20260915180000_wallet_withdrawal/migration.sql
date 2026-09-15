-- Withdrawal requests, recorded before signing so a retry cannot double-send.
CREATE TABLE IF NOT EXISTS "WalletWithdrawal" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "requestId"   TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "amountUsd"   DECIMAL(12,6) NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'SUBMITTING',
  "txHash"      TEXT,
  "error"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalletWithdrawal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WalletWithdrawal_userId_requestId_key" ON "WalletWithdrawal"("userId", "requestId");
CREATE INDEX IF NOT EXISTS "WalletWithdrawal_userId_createdAt_idx" ON "WalletWithdrawal"("userId", "createdAt");
ALTER TABLE "WalletWithdrawal" DROP CONSTRAINT IF EXISTS "WalletWithdrawal_userId_fkey";
ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
