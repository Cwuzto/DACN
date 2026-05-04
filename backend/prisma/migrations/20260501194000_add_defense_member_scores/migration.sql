-- Add per-council-member score sheets
CREATE TABLE IF NOT EXISTS "defense_member_scores" (
  "id" SERIAL PRIMARY KEY,
  "registration_id" INTEGER NOT NULL,
  "evaluator_id" INTEGER NOT NULL,
  "final_score" DOUBLE PRECISION,
  "comments" TEXT,
  "score_rubric_version" TEXT NOT NULL DEFAULT 'v1',
  "score_locked" BOOLEAN NOT NULL DEFAULT false,
  "locked_at" TIMESTAMP(3),
  "locked_by" INTEGER,
  "pdf_url" TEXT,
  "pdf_generated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "defense_member_scores_registration_id_evaluator_id_key"
ON "defense_member_scores"("registration_id", "evaluator_id");

CREATE TABLE IF NOT EXISTS "defense_member_criterion_scores" (
  "id" SERIAL PRIMARY KEY,
  "defense_member_score_id" INTEGER NOT NULL,
  "criterion_code" TEXT NOT NULL,
  "criterion_label" TEXT NOT NULL,
  "max_score" DOUBLE PRECISION NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "defense_member_criterion_scores_score_id_code_key"
ON "defense_member_criterion_scores"("defense_member_score_id", "criterion_code");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'defense_member_scores_registration_id_fkey'
  ) THEN
    ALTER TABLE "defense_member_scores"
    ADD CONSTRAINT "defense_member_scores_registration_id_fkey"
    FOREIGN KEY ("registration_id") REFERENCES "topic_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'defense_member_scores_evaluator_id_fkey'
  ) THEN
    ALTER TABLE "defense_member_scores"
    ADD CONSTRAINT "defense_member_scores_evaluator_id_fkey"
    FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'defense_member_scores_locked_by_fkey'
  ) THEN
    ALTER TABLE "defense_member_scores"
    ADD CONSTRAINT "defense_member_scores_locked_by_fkey"
    FOREIGN KEY ("locked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'defense_member_criterion_scores_score_id_fkey'
  ) THEN
    ALTER TABLE "defense_member_criterion_scores"
    ADD CONSTRAINT "defense_member_criterion_scores_score_id_fkey"
    FOREIGN KEY ("defense_member_score_id") REFERENCES "defense_member_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
