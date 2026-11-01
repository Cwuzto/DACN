-- P1: versioned BM01/BM02 and immutable assignment decisions.
-- Apply only after P0B foundation on a verified database clone.

CREATE TYPE "BM01Outcome" AS ENUM ('PASSED', 'NEEDS_REVISION', 'TERMINATED');
CREATE TYPE "BM02Outcome" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REVISION_REQUIRED', 'EXCEPTION_REVIEW', 'REJECTED_TERMINAL', 'SUPERSEDED');

ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'BM02_NEEDS_REVISION';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'BM02_RESUBMITTED';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'BM02_EXCEPTION_REVIEW';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'TERMINATED_BM01';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'TERMINATED_BM02';

ALTER TABLE "topic_registrations" ADD COLUMN "current_bm02_submission_id" INTEGER;

CREATE TABLE "bm01_evaluations" (
  "id" SERIAL NOT NULL,
  "registration_id" INTEGER NOT NULL,
  "attempt_no" INTEGER NOT NULL,
  "outcome" "BM01Outcome",
  "issues" JSONB,
  "deadline_at" TIMESTAMP(3),
  "notified_at" TIMESTAMP(3),
  "submitted_at" TIMESTAMP(3),
  "submitted_by_id" INTEGER,
  "submission_id" INTEGER,
  "supersedes_id" INTEGER,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by_id" INTEGER,
  "policy_version_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bm01_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bm02_submissions" (
  "id" SERIAL NOT NULL,
  "registration_id" INTEGER NOT NULL,
  "version_no" INTEGER NOT NULL,
  "attempt_no" INTEGER NOT NULL,
  "supersedes_id" INTEGER,
  "outcome" "BM02Outcome" NOT NULL DEFAULT 'PENDING_REVIEW',
  "issues" JSONB,
  "content" TEXT,
  "file_url" TEXT,
  "file_name" TEXT,
  "submitted_by_id" INTEGER NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by_id" INTEGER,
  "reviewed_at" TIMESTAMP(3),
  "notified_at" TIMESTAMP(3),
  "revision_deadline_at" TIMESTAMP(3),
  "policy_version_id" INTEGER NOT NULL,
  CONSTRAINT "bm02_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assignment_decisions" (
  "id" SERIAL NOT NULL,
  "registration_id" INTEGER NOT NULL,
  "bm02_submission_id" INTEGER NOT NULL,
  "decision_number" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL,
  "effective_at" TIMESTAMP(3) NOT NULL,
  "issued_by_id" INTEGER NOT NULL,
  "policy_version_id" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assignment_decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "decision_amendments" (
  "id" SERIAL NOT NULL,
  "assignment_decision_id" INTEGER NOT NULL,
  "amendment_number" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "changes" JSONB NOT NULL,
  "signed_by_id" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "effective_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "decision_amendments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "topic_registrations_current_bm02_submission_id_key" ON "topic_registrations"("current_bm02_submission_id");
CREATE UNIQUE INDEX "bm01_evaluations_registration_id_attempt_no_key" ON "bm01_evaluations"("registration_id", "attempt_no");
CREATE UNIQUE INDEX "bm01_evaluations_submission_id_key" ON "bm01_evaluations"("submission_id");
CREATE UNIQUE INDEX "bm01_evaluations_supersedes_id_key" ON "bm01_evaluations"("supersedes_id");
CREATE INDEX "bm01_evaluations_registration_id_outcome_idx" ON "bm01_evaluations"("registration_id", "outcome");
CREATE INDEX "bm01_evaluations_submitted_by_id_idx" ON "bm01_evaluations"("submitted_by_id");
CREATE INDEX "bm01_evaluations_reviewed_by_id_idx" ON "bm01_evaluations"("reviewed_by_id");
CREATE INDEX "bm01_evaluations_policy_version_id_idx" ON "bm01_evaluations"("policy_version_id");
CREATE UNIQUE INDEX "bm02_submissions_registration_id_version_no_key" ON "bm02_submissions"("registration_id", "version_no");
CREATE UNIQUE INDEX "bm02_submissions_supersedes_id_key" ON "bm02_submissions"("supersedes_id");
CREATE INDEX "bm02_submissions_registration_id_outcome_idx" ON "bm02_submissions"("registration_id", "outcome");
CREATE INDEX "bm02_submissions_submitted_by_id_idx" ON "bm02_submissions"("submitted_by_id");
CREATE INDEX "bm02_submissions_reviewed_by_id_idx" ON "bm02_submissions"("reviewed_by_id");
CREATE INDEX "bm02_submissions_policy_version_id_idx" ON "bm02_submissions"("policy_version_id");
CREATE UNIQUE INDEX "assignment_decisions_registration_id_key" ON "assignment_decisions"("registration_id");
CREATE UNIQUE INDEX "assignment_decisions_bm02_submission_id_key" ON "assignment_decisions"("bm02_submission_id");
CREATE UNIQUE INDEX "assignment_decisions_idempotency_key_key" ON "assignment_decisions"("idempotency_key");
CREATE INDEX "assignment_decisions_decision_number_issued_at_idx" ON "assignment_decisions"("decision_number", "issued_at");
CREATE UNIQUE INDEX "decision_amendments_amendment_number_key" ON "decision_amendments"("amendment_number");
CREATE UNIQUE INDEX "decision_amendments_idempotency_key_key" ON "decision_amendments"("idempotency_key");
CREATE INDEX "decision_amendments_assignment_decision_id_effective_at_idx" ON "decision_amendments"("assignment_decision_id", "effective_at");
CREATE INDEX "decision_amendments_signed_by_id_idx" ON "decision_amendments"("signed_by_id");

ALTER TABLE "topic_registrations" ADD CONSTRAINT "topic_registrations_current_bm02_submission_id_fkey" FOREIGN KEY ("current_bm02_submission_id") REFERENCES "bm02_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bm01_evaluations" ADD CONSTRAINT "bm01_evaluations_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bm01_evaluations" ADD CONSTRAINT "bm01_evaluations_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bm01_evaluations" ADD CONSTRAINT "bm01_evaluations_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bm01_evaluations" ADD CONSTRAINT "bm01_evaluations_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "bm01_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bm01_evaluations" ADD CONSTRAINT "bm01_evaluations_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bm01_evaluations" ADD CONSTRAINT "bm01_evaluations_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "period_workflow_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bm02_submissions" ADD CONSTRAINT "bm02_submissions_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bm02_submissions" ADD CONSTRAINT "bm02_submissions_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "bm02_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bm02_submissions" ADD CONSTRAINT "bm02_submissions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bm02_submissions" ADD CONSTRAINT "bm02_submissions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bm02_submissions" ADD CONSTRAINT "bm02_submissions_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "period_workflow_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignment_decisions" ADD CONSTRAINT "assignment_decisions_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignment_decisions" ADD CONSTRAINT "assignment_decisions_bm02_submission_id_fkey" FOREIGN KEY ("bm02_submission_id") REFERENCES "bm02_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignment_decisions" ADD CONSTRAINT "assignment_decisions_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignment_decisions" ADD CONSTRAINT "assignment_decisions_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "period_workflow_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "decision_amendments" ADD CONSTRAINT "decision_amendments_assignment_decision_id_fkey" FOREIGN KEY ("assignment_decision_id") REFERENCES "assignment_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "decision_amendments" ADD CONSTRAINT "decision_amendments_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
