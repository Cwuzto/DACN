-- AlterTable
ALTER TABLE "semesters" ADD COLUMN "code" TEXT;

-- Backfill existing rows if any
UPDATE "semesters" SET "code" = 'DATN-HK' || id WHERE "code" IS NULL;

-- AlterColumn to NOT NULL
ALTER TABLE "semesters" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "semesters_code_key" ON "semesters"("code");

