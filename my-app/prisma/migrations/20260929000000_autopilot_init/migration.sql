-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TradingMode" AS ENUM ('PAPER', 'LIVE');

-- CreateEnum
CREATE TYPE "AutomationKind" AS ENUM ('EXIT', 'ENTRY', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DONE', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('SUBMITTING', 'FILLED', 'PARTIAL', 'UNFILLED', 'REJECTED', 'QUEUED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mode" "TradingMode" NOT NULL DEFAULT 'PAPER',
    "paperCash" DECIMAL(14,6) NOT NULL DEFAULT 1000,
    "telegramChatId" TEXT,
    "telegramLinkCode" TEXT,
    "telegramLinkExpires" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "TradingAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'privy',
    "providerWalletId" TEXT NOT NULL,
    "signerAddress" TEXT NOT NULL,
    "depositWalletAddress" TEXT,
    "liveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyLimitUsd" DECIMAL(12,2) NOT NULL DEFAULT 100,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "lastClaimCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "marketSlug" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "shares" DECIMAL(20,6) NOT NULL,
    "costUsd" DECIMAL(14,6) NOT NULL,
    "endDate" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "TradingMode" NOT NULL,
    "kind" "AutomationKind" NOT NULL,
    "status" "AutomationStatus" NOT NULL DEFAULT 'ACTIVE',
    "tokenId" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "marketSlug" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "endDate" TIMESTAMP(3),
    "config" JSONB NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "webhookSecretHash" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "lastPrice" DECIMAL(10,6),
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "firedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "automationId" TEXT,
    "mode" "TradingMode" NOT NULL,
    "side" "OrderSide" NOT NULL,
    "tokenId" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "marketSlug" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "requested" DECIMAL(20,6) NOT NULL,
    "limitPrice" DECIMAL(10,6) NOT NULL,
    "filledShares" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "filledUsd" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "feeUsd" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'SUBMITTING',
    "exchangeOrderId" TEXT,
    "txHashes" TEXT[],
    "reason" TEXT NOT NULL,
    "error" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "automationId" TEXT,
    "orderId" TEXT,
    "mode" "TradingMode",
    "level" "ActivityLevel" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "amountUsd" DECIMAL(12,6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTING',
    "txHash" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramLinkCode_key" ON "User"("telegramLinkCode");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "TradingAccount_userId_key" ON "TradingAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TradingAccount_providerWalletId_key" ON "TradingAccount"("providerWalletId");

-- CreateIndex
CREATE UNIQUE INDEX "TradingAccount_signerAddress_key" ON "TradingAccount"("signerAddress");

-- CreateIndex
CREATE UNIQUE INDEX "TradingAccount_depositWalletAddress_key" ON "TradingAccount"("depositWalletAddress");

-- CreateIndex
CREATE INDEX "PaperPosition_settledAt_idx" ON "PaperPosition"("settledAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaperPosition_userId_tokenId_key" ON "PaperPosition"("userId", "tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "Automation_webhookSecretHash_key" ON "Automation"("webhookSecretHash");

-- CreateIndex
CREATE INDEX "Automation_status_idx" ON "Automation"("status");

-- CreateIndex
CREATE INDEX "Automation_userId_createdAt_idx" ON "Automation"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_notifiedAt_level_idx" ON "Activity"("notifiedAt", "level");

-- CreateIndex
CREATE INDEX "Withdrawal_userId_createdAt_idx" ON "Withdrawal"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_userId_requestId_key" ON "Withdrawal"("userId", "requestId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperPosition" ADD CONSTRAINT "PaperPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

