-- Defense score-sheet schema hardening migration
-- Purpose: formalize structures previously synced ad-hoc via db push

-- 1) Add score-sheet metadata columns to defense_results (idempotent)
ALTER TABLE "defense_results"
ADD COLUMN IF NOT EXISTS "score_rubric_version" TEXT NOT NULL DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS "score_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "locked_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "locked_by" INTEGER,
ADD COLUMN IF NOT EXISTS "pdf_url" TEXT,
ADD COLUMN IF NOT EXISTS "pdf_generated_at" TIMESTAMP(3);

-- 2) Create detail scoring table (idempotent)
CREATE TABLE IF NOT EXISTS "defense_criterion_scores" (
    "id" SERIAL NOT NULL,
    "defense_result_id" INTEGER NOT NULL,
    "criterion_code" TEXT NOT NULL,
    "criterion_label" TEXT NOT NULL,
    "max_score" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defense_criterion_scores_pkey" PRIMARY KEY ("id")
);

-- 3) Unique/index constraints (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "defense_criterion_scores_defense_result_id_criterion_code_key"
ON "defense_criterion_scores"("defense_result_id", "criterion_code");

-- 4) FK locked_by -> users.id (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'defense_results_locked_by_fkey'
    ) THEN
        ALTER TABLE "defense_results"
        ADD CONSTRAINT "defense_results_locked_by_fkey"
        FOREIGN KEY ("locked_by") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 5) FK defense_criterion_scores.defense_result_id -> defense_results.id (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'defense_criterion_scores_defense_result_id_fkey'
    ) THEN
        ALTER TABLE "defense_criterion_scores"
        ADD CONSTRAINT "defense_criterion_scores_defense_result_id_fkey"
        FOREIGN KEY ("defense_result_id") REFERENCES "defense_results"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
