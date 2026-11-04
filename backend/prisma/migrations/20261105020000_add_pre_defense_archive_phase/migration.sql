-- CreateEnum
CREATE TYPE "ArchivePhase" AS ENUM ('PRE_DEFENSE', 'POST_DEFENSE');

-- AlterTable
ALTER TABLE "project_archives" ADD COLUMN "phase" "ArchivePhase" NOT NULL DEFAULT 'POST_DEFENSE';

-- CreateIndex
CREATE INDEX "project_archives_registration_id_phase_idx" ON "project_archives"("registration_id", "phase");
