-- Emergency rollback for a verified clone only. Do not run against production.
-- This removes P0B metadata only; it intentionally does not delete legacy academic records.
ALTER TABLE "topic_registrations" DROP COLUMN IF EXISTS "period_policy_version_id";
ALTER TABLE "topic_registrations" DROP COLUMN IF EXISTS "state_version";
DROP TABLE IF EXISTS "manual_review_cases";
DROP TABLE IF EXISTS "idempotency_records";
DROP TABLE IF EXISTS "registration_state_history";
DROP TABLE IF EXISTS "period_workflow_policy_versions";
DROP TYPE IF EXISTS "ManualReviewStatus";
