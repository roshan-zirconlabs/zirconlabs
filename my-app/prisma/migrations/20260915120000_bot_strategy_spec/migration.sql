-- Guided strategy spec for a bot. Null for bots built on the raw node canvas.
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "strategy" JSONB;
