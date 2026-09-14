-- Idempotent repair for deployments where the draft-workflow migration was
-- recorded or partially applied without the Bot.workflow column. This is
-- additive only and is safe when the column already exists.
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "workflow" JSONB;
