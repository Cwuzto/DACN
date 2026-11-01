-- Approval per defense registration and immutable semester publication snapshots.

ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'AWAITING_SCORES';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'AWAITING_FINAL_APPROVAL';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'DEFENSE_PASSED';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'DEFENSE_FAILED';

CREATE TYPE "DefenseApprovalOutcome" AS ENUM ('PASSED', 'FAILED');
CREATE TYPE "ResultPublicationType" AS ENUM ('INITIAL', 'SUPPLEMENTARY', 'CORRECTION');

CREATE TABLE "defense_result_approvals" (
  "id" SERIAL NOT NULL,
  "registration_id" INTEGER NOT NULL,
  "defense_result_id" INTEGER NOT NULL,
  "outcome" "DefenseApprovalOutcome" NOT NULL,
  "final_score_snapshot" DOUBLE PRECISION NOT NULL,
  "score_fingerprint" TEXT NOT NULL,
  "rubric_version_snapshot" TEXT NOT NULL,
  "defense_council_id" INTEGER,
  "policy_version_id" INTEGER,
  "approved_by_id" INTEGER NOT NULL,
  "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT,
  "notes" TEXT,
  "supersedes_approval_id" INTEGER,
  "is_effective" BOOLEAN NOT NULL DEFAULT true,
  "invalidated_at" TIMESTAMP(3),
  "invalidated_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "defense_result_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "result_publications" (
  "id" SERIAL NOT NULL,
  "semester_id" INTEGER NOT NULL,
  "type" "ResultPublicationType" NOT NULL,
  "previous_publication_id" INTEGER,
  "reason" TEXT,
  "published_by_id" INTEGER NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "result_publications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "result_publication_items" (
  "id" SERIAL NOT NULL,
  "publication_id" INTEGER NOT NULL,
  "registration_id" INTEGER NOT NULL,
  "source_approval_id" INTEGER NOT NULL,
  "replaces_publication_item_id" INTEGER,
  "outcome_snapshot" "DefenseApprovalOutcome" NOT NULL,
  "final_score_snapshot" DOUBLE PRECISION NOT NULL,
  "student_code_snapshot" TEXT NOT NULL,
  "student_name_snapshot" TEXT NOT NULL,
  "topic_title_snapshot" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "result_publication_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "defense_result_approvals_supersedes_approval_id_key" ON "defense_result_approvals"("supersedes_approval_id");
CREATE INDEX "defense_result_approvals_registration_id_is_effective_idx" ON "defense_result_approvals"("registration_id", "is_effective");
CREATE INDEX "defense_result_approvals_defense_result_id_idx" ON "defense_result_approvals"("defense_result_id");
CREATE INDEX "defense_result_approvals_approved_by_id_idx" ON "defense_result_approvals"("approved_by_id");
CREATE UNIQUE INDEX "defense_result_approvals_one_effective_per_registration" ON "defense_result_approvals"("registration_id") WHERE "is_effective" = true;

CREATE UNIQUE INDEX "result_publications_semester_id_published_by_id_idempotency_key_key" ON "result_publications"("semester_id", "published_by_id", "idempotency_key");
CREATE INDEX "result_publications_semester_id_published_at_idx" ON "result_publications"("semester_id", "published_at");
CREATE UNIQUE INDEX "result_publication_items_publication_id_registration_id_key" ON "result_publication_items"("publication_id", "registration_id");
CREATE INDEX "result_publication_items_registration_id_idx" ON "result_publication_items"("registration_id");
CREATE INDEX "result_publication_items_source_approval_id_idx" ON "result_publication_items"("source_approval_id");

ALTER TABLE "defense_result_approvals" ADD CONSTRAINT "defense_result_approvals_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defense_result_approvals" ADD CONSTRAINT "defense_result_approvals_defense_result_id_fkey" FOREIGN KEY ("defense_result_id") REFERENCES "defense_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defense_result_approvals" ADD CONSTRAINT "defense_result_approvals_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defense_result_approvals" ADD CONSTRAINT "defense_result_approvals_supersedes_approval_id_fkey" FOREIGN KEY ("supersedes_approval_id") REFERENCES "defense_result_approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "result_publications" ADD CONSTRAINT "result_publications_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "result_publications" ADD CONSTRAINT "result_publications_previous_publication_id_fkey" FOREIGN KEY ("previous_publication_id") REFERENCES "result_publications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "result_publications" ADD CONSTRAINT "result_publications_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "result_publication_items" ADD CONSTRAINT "result_publication_items_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "result_publications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "result_publication_items" ADD CONSTRAINT "result_publication_items_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "result_publication_items" ADD CONSTRAINT "result_publication_items_source_approval_id_fkey" FOREIGN KEY ("source_approval_id") REFERENCES "defense_result_approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "result_publication_items" ADD CONSTRAINT "result_publication_items_replaces_publication_item_id_fkey" FOREIGN KEY ("replaces_publication_item_id") REFERENCES "result_publication_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("code", "label", "module")
VALUES ('DEFENSE_RESULT_APPROVE', 'Phê duyệt kết quả bảo vệ', 'DEFENSE')
ON CONFLICT ("code") DO UPDATE SET "label" = EXCLUDED."label", "module" = EXCLUDED."module";

INSERT INTO "permission_group_permissions" ("permission_group_id", "permission_id")
SELECT pg."id", p."id"
FROM "permission_groups" pg
JOIN "permissions" p ON p."code" = 'DEFENSE_RESULT_APPROVE'
WHERE pg."code" = 'VIEN_TRUONG'
ON CONFLICT ("permission_group_id", "permission_id") DO NOTHING;
