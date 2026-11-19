-- AlterTable
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupe_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
