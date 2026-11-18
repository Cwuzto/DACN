-- Migration: 20261119120000_rubric_level_policy
-- Add score_level_policy JSONB column to rubric_versions with default 4-level policy
-- so existing rubric versions receive the default policy without changing scores or locks.

ALTER TABLE "rubric_versions"
ADD COLUMN "score_level_policy" JSONB NOT NULL DEFAULT '{"good":{"minPercent":85,"maxPercent":100,"suggestedPercent":90},"fair":{"minPercent":70,"maxPercent":85,"suggestedPercent":75},"average":{"minPercent":50,"maxPercent":70,"suggestedPercent":60},"poor":{"minPercent":0,"maxPercent":50,"suggestedPercent":30}}'::jsonb;
