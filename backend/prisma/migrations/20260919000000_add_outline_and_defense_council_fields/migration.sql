-- CreateEnum
CREATE TYPE "OutlineReviewStatus" AS ENUM ('PENDING', 'PASSED', 'REVISION_REQUIRED', 'FAILED');

-- AlterTable
ALTER TABLE "topic_registrations" 
  ADD COLUMN "outline_council_id" INTEGER,
  ADD COLUMN "defense_council_id" INTEGER,
  ADD COLUMN "outline_review_status" "OutlineReviewStatus" DEFAULT 'PENDING',
  ADD COLUMN "outline_feedback" TEXT;

-- AddForeignKey
ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_outline_council_id_fkey" FOREIGN KEY ("outline_council_id") REFERENCES "councils"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_defense_council_id_fkey" FOREIGN KEY ("defense_council_id") REFERENCES "councils"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing council assignments based on council_type
UPDATE "topic_registrations" tr
SET "defense_council_id" = tr."council_id"
FROM "councils" c
WHERE tr."council_id" = c."id" AND c."council_type" = 'DEFENSE_COUNCIL' AND tr."defense_council_id" IS NULL;

UPDATE "topic_registrations" tr
SET "outline_council_id" = tr."council_id"
FROM "councils" c
WHERE tr."council_id" = c."id" AND c."council_type" = 'OUTLINE_REVIEW' AND tr."outline_council_id" IS NULL;
