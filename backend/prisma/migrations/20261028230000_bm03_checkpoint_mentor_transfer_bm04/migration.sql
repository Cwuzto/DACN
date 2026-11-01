-- P2: BM03 Checkpoint evaluations with dual signatures, signature appeals, mentor transfers, and BM04 standardization

CREATE TYPE "CheckpointConclusion" AS ENUM ('ALLOWED_TO_CONTINUE', 'NOT_ALLOWED_TO_CONTINUE');
CREATE TYPE "CheckpointAppealStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED');

ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'BM03_SIGNATURE_PENDING';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'CHECKPOINT_SIGNATURE_APPEAL_OPEN';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'CHECKPOINT_SIGNATURE_APPEAL_REVIEW';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'SIGNATURE_APPEAL_RESOLVED';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'BM04_REVIEW';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'TERMINATED_BM04';

ALTER TYPE "BM04Conclusion" ADD VALUE IF NOT EXISTS 'NOT_AGREED_FOR_DEFENSE';

ALTER TABLE "bm04_evaluations" ADD COLUMN "policy_version_id" INTEGER;

CREATE TABLE "checkpoint_evaluations" (
  "id" SERIAL NOT NULL,
  "registration_id" INTEGER NOT NULL,
  "checkpoint_no" INTEGER NOT NULL,
  "attempt_no" INTEGER NOT NULL DEFAULT 1,
  "conclusion" "CheckpointConclusion" NOT NULL,
  "comments" TEXT,
  "evidence_url" TEXT,
  "evidence_name" TEXT,
  "mentor_signed_by_id" INTEGER NOT NULL,
  "mentor_signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mentor_signature" TEXT NOT NULL,
  "student_signed_by_id" INTEGER,
  "student_signed_at" TIMESTAMP(3),
  "student_signature" TEXT,
  "student_sign_deadline_at" TIMESTAMP(3),
  "notified_at" TIMESTAMP(3),
  "supersedes_evaluation_id" INTEGER,
  "policy_version_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkpoint_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checkpoint_signature_appeals" (
  "id" SERIAL NOT NULL,
  "checkpoint_evaluation_id" INTEGER NOT NULL,
  "registration_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "appeal_deadline_at" TIMESTAMP(3) NOT NULL,
  "submitted_at" TIMESTAMP(3),
  "reason" TEXT,
  "evidence_url" TEXT,
  "evidence_name" TEXT,
  "status" "CheckpointAppealStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_id" INTEGER,
  "reviewed_at" TIMESTAMP(3),
  "review_notes" TEXT,
  "resolution_decision" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkpoint_signature_appeals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mentor_transfers" (
  "id" SERIAL NOT NULL,
  "registration_id" INTEGER NOT NULL,
  "previous_mentor_id" INTEGER NOT NULL,
  "new_mentor_id" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_by_id" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mentor_transfers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "checkpoint_evaluations_registration_id_checkpoint_no_attempt_no_key" ON "checkpoint_evaluations"("registration_id", "checkpoint_no", "attempt_no");
CREATE UNIQUE INDEX "checkpoint_evaluations_supersedes_evaluation_id_key" ON "checkpoint_evaluations"("supersedes_evaluation_id");
CREATE INDEX "checkpoint_evaluations_registration_id_checkpoint_no_idx" ON "checkpoint_evaluations"("registration_id", "checkpoint_no");
CREATE INDEX "checkpoint_evaluations_mentor_signed_by_id_idx" ON "checkpoint_evaluations"("mentor_signed_by_id");
CREATE INDEX "checkpoint_evaluations_student_signed_by_id_idx" ON "checkpoint_evaluations"("student_signed_by_id");
CREATE INDEX "checkpoint_evaluations_policy_version_id_idx" ON "checkpoint_evaluations"("policy_version_id");

CREATE UNIQUE INDEX "checkpoint_signature_appeals_checkpoint_evaluation_id_key" ON "checkpoint_signature_appeals"("checkpoint_evaluation_id");
CREATE INDEX "checkpoint_signature_appeals_registration_id_status_idx" ON "checkpoint_signature_appeals"("registration_id", "status");
CREATE INDEX "checkpoint_signature_appeals_student_id_idx" ON "checkpoint_signature_appeals"("student_id");
CREATE INDEX "checkpoint_signature_appeals_reviewed_by_id_idx" ON "checkpoint_signature_appeals"("reviewed_by_id");

CREATE UNIQUE INDEX "mentor_transfers_idempotency_key_key" ON "mentor_transfers"("idempotency_key");
CREATE INDEX "mentor_transfers_registration_id_effective_at_idx" ON "mentor_transfers"("registration_id", "effective_at");
CREATE INDEX "mentor_transfers_previous_mentor_id_idx" ON "mentor_transfers"("previous_mentor_id");
CREATE INDEX "mentor_transfers_new_mentor_id_idx" ON "mentor_transfers"("new_mentor_id");
CREATE INDEX "mentor_transfers_approved_by_id_idx" ON "mentor_transfers"("approved_by_id");

CREATE INDEX "bm04_evaluations_policy_version_id_idx" ON "bm04_evaluations"("policy_version_id");

ALTER TABLE "bm04_evaluations" ADD CONSTRAINT "bm04_evaluations_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "period_workflow_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "checkpoint_evaluations" ADD CONSTRAINT "checkpoint_evaluations_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkpoint_evaluations" ADD CONSTRAINT "checkpoint_evaluations_mentor_signed_by_id_fkey" FOREIGN KEY ("mentor_signed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkpoint_evaluations" ADD CONSTRAINT "checkpoint_evaluations_student_signed_by_id_fkey" FOREIGN KEY ("student_signed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checkpoint_evaluations" ADD CONSTRAINT "checkpoint_evaluations_supersedes_evaluation_id_fkey" FOREIGN KEY ("supersedes_evaluation_id") REFERENCES "checkpoint_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkpoint_evaluations" ADD CONSTRAINT "checkpoint_evaluations_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "period_workflow_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "checkpoint_signature_appeals" ADD CONSTRAINT "checkpoint_signature_appeals_checkpoint_evaluation_id_fkey" FOREIGN KEY ("checkpoint_evaluation_id") REFERENCES "checkpoint_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkpoint_signature_appeals" ADD CONSTRAINT "checkpoint_signature_appeals_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkpoint_signature_appeals" ADD CONSTRAINT "checkpoint_signature_appeals_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkpoint_signature_appeals" ADD CONSTRAINT "checkpoint_signature_appeals_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mentor_transfers" ADD CONSTRAINT "mentor_transfers_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mentor_transfers" ADD CONSTRAINT "mentor_transfers_previous_mentor_id_fkey" FOREIGN KEY ("previous_mentor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mentor_transfers" ADD CONSTRAINT "mentor_transfers_new_mentor_id_fkey" FOREIGN KEY ("new_mentor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mentor_transfers" ADD CONSTRAINT "mentor_transfers_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
