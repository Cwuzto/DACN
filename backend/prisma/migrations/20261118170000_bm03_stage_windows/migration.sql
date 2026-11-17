-- Migration: 20261118170000_bm03_stage_windows
-- Add nullable BM03 stage evaluation open timestamps to semesters.

ALTER TABLE "semesters"
ADD COLUMN "bm03_midterm_evaluation_open_at" TIMESTAMP(3),
ADD COLUMN "bm03_finalization_open_at" TIMESTAMP(3);
