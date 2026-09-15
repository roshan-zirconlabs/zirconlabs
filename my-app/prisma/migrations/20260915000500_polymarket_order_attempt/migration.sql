CREATE TABLE "PolymarketOrderAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "marketSlug" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "amountUsd" DECIMAL(12,2) NOT NULL CHECK ("amountUsd" > 0),
  "maxPrice" DECIMAL(10,6) NOT NULL CHECK ("maxPrice" > 0 AND "maxPrice" < 1),
  "status" TEXT NOT NULL DEFAULT 'SUBMITTING',
  "orderId" TEXT,
  "receipt" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PolymarketOrderAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PolymarketOrderAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PolymarketOrderAttempt_userId_requestId_key" ON "PolymarketOrderAttempt"("userId", "requestId");
CREATE INDEX "PolymarketOrderAttempt_userId_createdAt_idx" ON "PolymarketOrderAttempt"("userId", "createdAt");
