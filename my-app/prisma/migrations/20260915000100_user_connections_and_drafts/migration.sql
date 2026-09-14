CREATE TABLE "KeeperhubConnection" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "encryptedKey" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KeeperhubConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "Bot" ADD COLUMN "workflow" JSONB;
