-- P0B foundation only. This migration is additive and must first be applied to a verified database clone.
-- Legacy registrations intentionally remain unpinned until the dry-run backfill classifies their evidence.

CREATE TYPE "ManualReviewStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

ALTER TABLE "topic_registrations"
  ADD COLUMN "state_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "period_policy_version_id" INTEGER;

CREATE TABLE "period_workflow_policy_versions" (
  "id" SERIAL NOT NULL,
  "semester_id" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "policy" JSONB NOT NULL,
  "checksum" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "period_workflow_policy_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "registration_state_history" (
  "id" SERIAL NOT NULL,
  "registration_id" INTEGER NOT NULL,
  "from_status" "RegistrationStatus" NOT NULL,
  "to_status" "RegistrationStatus" NOT NULL,
  "from_state_version" INTEGER NOT NULL,
  "to_state_version" INTEGER NOT NULL,
  "actor_id" INTEGER NOT NULL,
  "reason" TEXT,
  "reference" JSONB,
  "idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "registration_state_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "idempotency_records" (
  "id" SERIAL NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "command_hash" TEXT NOT NULL,
  "registration_id" INTEGER,
  "response" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "manual_review_cases" (
  "id" SERIAL NOT NULL,
  "registration_id" INTEGER NOT NULL,
  "status" "ManualReviewStatus" NOT NULL DEFAULT 'OPEN',
  "reason_codes" JSONB NOT NULL,
  "evidence" JSONB,
  "opened_by_id" INTEGER,
  "resolved_by_id" INTEGER,
  "resolution" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "manual_review_cases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "period_workflow_policy_versions_semester_id_version_key"
  ON "period_workflow_policy_versions"("semester_id", "version");
CREATE INDEX "period_workflow_policy_versions_semester_id_is_active_idx"
  ON "period_workflow_policy_versions"("semester_id", "is_active");
CREATE UNIQUE INDEX "registration_state_history_registration_id_to_state_version_key"
  ON "registration_state_history"("registration_id", "to_state_version");
CREATE INDEX "registration_state_history_registration_id_created_at_idx"
  ON "registration_state_history"("registration_id", "created_at");
CREATE UNIQUE INDEX "idempotency_records_scope_key_key" ON "idempotency_records"("scope", "key");
CREATE INDEX "idempotency_records_registration_id_idx" ON "idempotency_records"("registration_id");
CREATE INDEX "manual_review_cases_status_created_at_idx" ON "manual_review_cases"("status", "created_at");
CREATE UNIQUE INDEX "manual_review_cases_registration_id_status_key"
  ON "manual_review_cases"("registration_id", "status");
CREATE INDEX "topic_registrations_semester_id_period_policy_version_id_idx"
  ON "topic_registrations"("semester_id", "period_policy_version_id");

ALTER TABLE "topic_registrations"
  ADD CONSTRAINT "topic_registrations_period_policy_version_id_fkey"
  FOREIGN KEY ("period_policy_version_id") REFERENCES "period_workflow_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "period_workflow_policy_versions"
  ADD CONSTRAINT "period_workflow_policy_versions_semester_id_fkey"
  FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "period_workflow_policy_versions_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registration_state_history"
  ADD CONSTRAINT "registration_state_history_registration_id_fkey"
  FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "registration_state_history_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "idempotency_records"
  ADD CONSTRAINT "idempotency_records_registration_id_fkey"
  FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manual_review_cases"
  ADD CONSTRAINT "manual_review_cases_registration_id_fkey"
  FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "manual_review_cases_opened_by_id_fkey"
  FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "manual_review_cases_resolved_by_id_fkey"
  FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
