-- AlterEnum TaskType
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'BM03_CHECKPOINT_1';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'BM03_CHECKPOINT_2';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'REPORT_DRAFT';

-- AlterTable tasks: add bypass columns
ALTER TABLE "tasks" 
  ADD COLUMN IF NOT EXISTS "is_bypassed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bypass_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "bypassed_by" INTEGER;

-- CreateTable meeting_logs
CREATE TABLE IF NOT EXISTS "meeting_logs" (
    "id" SERIAL NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "meeting_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meeting_type" TEXT NOT NULL DEFAULT 'LAB',
    "student_work_summary" TEXT NOT NULL,
    "next_plan" TEXT,
    "supervisor_notes" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "meeting_logs_registration_id_meeting_date_idx" ON "meeting_logs"("registration_id", "meeting_date");

-- AddForeignKey meeting_logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'meeting_logs_registration_id_fkey'
    ) THEN
        ALTER TABLE "meeting_logs" 
          ADD CONSTRAINT "meeting_logs_registration_id_fkey" 
          FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'meeting_logs_created_by_fkey'
    ) THEN
        ALTER TABLE "meeting_logs" 
          ADD CONSTRAINT "meeting_logs_created_by_fkey" 
          FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Drop Table milestones and MilestoneStatus enum
DROP TABLE IF EXISTS "milestones" CASCADE;
DROP TYPE IF EXISTS "MilestoneStatus";
