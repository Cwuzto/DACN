-- Migration: 20261110050000_outline_review_dossier_foundation
-- Subsystem: Outline Review & Dossier Management (BM01) Foundation

-- 1. Create Enums if not exist
DO $$ BEGIN
    CREATE TYPE "CouncilMeetingMode" AS ENUM ('IN_PERSON', 'MICROSOFT_TEAMS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CouncilBatchStatus" AS ENUM ('DRAFT', 'PENDING_CHAIR', 'PUBLISHED', 'SUPERSEDED', 'REOPENED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "OutlineInitialOutcome" AS ENUM ('PASS', 'REVISION_REQUIRED', 'FAIL', 'ABSENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "OutlineRevisionApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Alter existing Enums
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'BM01_RESUBMITTED';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'BM01_INITIAL_SUBMISSION';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'BM01_RESUBMISSION';

-- 3. Alter Table: semesters
ALTER TABLE "semesters" ADD COLUMN IF NOT EXISTS "outline_submission_open_at" TIMESTAMP(3);
ALTER TABLE "semesters" ADD COLUMN IF NOT EXISTS "outline_submission_deadline" TIMESTAMP(3);
ALTER TABLE "semesters" ADD COLUMN IF NOT EXISTS "outline_template_file_url" TEXT;
ALTER TABLE "semesters" ADD COLUMN IF NOT EXISTS "outline_template_file_id" INTEGER;
ALTER TABLE "semesters" ADD COLUMN IF NOT EXISTS "outline_allowed_extensions" JSONB NOT NULL DEFAULT '[".docx", ".pdf"]';
ALTER TABLE "semesters" ADD COLUMN IF NOT EXISTS "outline_max_file_size_bytes" INTEGER NOT NULL DEFAULT 20971520;

-- 4. Alter Table: councils
ALTER TABLE "councils" ADD COLUMN IF NOT EXISTS "meeting_mode" "CouncilMeetingMode" DEFAULT 'IN_PERSON';
ALTER TABLE "councils" ADD COLUMN IF NOT EXISTS "meeting_url" TEXT;
ALTER TABLE "councils" ADD COLUMN IF NOT EXISTS "schedule_published_at" TIMESTAMP(3);
ALTER TABLE "councils" ADD COLUMN IF NOT EXISTS "revision_submission_deadline" TIMESTAMP(3);
ALTER TABLE "councils" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "councils" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "councils" ADD COLUMN IF NOT EXISTS "row_version" INTEGER NOT NULL DEFAULT 1;

-- 5. Create Table: council_result_batches
CREATE TABLE IF NOT EXISTS "council_result_batches" (
    "id" SERIAL NOT NULL,
    "council_id" INTEGER NOT NULL,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "status" "CouncilBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "secretary_completed_at" TIMESTAMP(3),
    "secretary_completed_by_id" INTEGER,
    "chair_published_at" TIMESTAMP(3),
    "chair_published_by_id" INTEGER,
    "returned_at" TIMESTAMP(3),
    "returned_by_id" INTEGER,
    "return_reason" TEXT,
    "reopened_at" TIMESTAMP(3),
    "reopened_by_id" INTEGER,
    "reopen_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "council_result_batches_pkey" PRIMARY KEY ("id")
);

-- 6. Indexes & Unique constraints on council_result_batches
CREATE INDEX IF NOT EXISTS "council_result_batches_council_id_status_idx" ON "council_result_batches"("council_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "council_result_batches_council_id_version_number_key" ON "council_result_batches"("council_id", "version_number");

-- 7. Alter Table: bm01_evaluations
ALTER TABLE "bm01_evaluations" ADD COLUMN IF NOT EXISTS "council_id" INTEGER;
ALTER TABLE "bm01_evaluations" ADD COLUMN IF NOT EXISTS "batch_id" INTEGER;
ALTER TABLE "bm01_evaluations" ADD COLUMN IF NOT EXISTS "initial_outcome" "OutlineInitialOutcome";
ALTER TABLE "bm01_evaluations" ADD COLUMN IF NOT EXISTS "attendance_status" "AttendanceStatus" DEFAULT 'PRESENT';
ALTER TABLE "bm01_evaluations" ADD COLUMN IF NOT EXISTS "comment" TEXT;
ALTER TABLE "bm01_evaluations" ADD COLUMN IF NOT EXISTS "revision_requirements" TEXT;
ALTER TABLE "bm01_evaluations" ADD COLUMN IF NOT EXISTS "revision_submission_id" INTEGER;
ALTER TABLE "bm01_evaluations" ADD COLUMN IF NOT EXISTS "revision_approval_status" "OutlineRevisionApprovalStatus" DEFAULT 'NOT_REQUIRED';
ALTER TABLE "bm01_evaluations" ADD COLUMN IF NOT EXISTS "revision_reviewed_at" TIMESTAMP(3);
ALTER TABLE "bm01_evaluations" ADD COLUMN IF NOT EXISTS "revision_reviewed_by_id" INTEGER;
ALTER TABLE "bm01_evaluations" ADD COLUMN IF NOT EXISTS "revision_feedback" TEXT;

-- 8. Indexes & Unique constraints on bm01_evaluations
CREATE UNIQUE INDEX IF NOT EXISTS "bm01_evaluations_revision_submission_id_key" ON "bm01_evaluations"("revision_submission_id");
CREATE INDEX IF NOT EXISTS "bm01_evaluations_council_id_idx" ON "bm01_evaluations"("council_id");
CREATE INDEX IF NOT EXISTS "bm01_evaluations_batch_id_idx" ON "bm01_evaluations"("batch_id");
CREATE UNIQUE INDEX IF NOT EXISTS "bm01_evaluations_batch_id_registration_id_key" ON "bm01_evaluations"("batch_id", "registration_id");

-- 9. Foreign Keys with Restrict onDelete
DO $$ BEGIN
    ALTER TABLE "council_result_batches" ADD CONSTRAINT "council_result_batches_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "councils"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "council_result_batches" ADD CONSTRAINT "council_result_batches_secretary_completed_by_id_fkey" FOREIGN KEY ("secretary_completed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "council_result_batches" ADD CONSTRAINT "council_result_batches_chair_published_by_id_fkey" FOREIGN KEY ("chair_published_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "council_result_batches" ADD CONSTRAINT "council_result_batches_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "council_result_batches" ADD CONSTRAINT "council_result_batches_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "bm01_evaluations" ADD CONSTRAINT "bm01_evaluations_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "councils"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "bm01_evaluations" ADD CONSTRAINT "bm01_evaluations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "council_result_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "bm01_evaluations" ADD CONSTRAINT "bm01_evaluations_revision_submission_id_fkey" FOREIGN KEY ("revision_submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "bm01_evaluations" ADD CONSTRAINT "bm01_evaluations_revision_reviewed_by_id_fkey" FOREIGN KEY ("revision_reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
