-- Migration: 20261118150000_bm01_pdf_only
-- Restrict BM01 outlineAllowedExtensions default and existing semesters to PDF only.
-- Historical .docx submissions are preserved untouched.

ALTER TABLE "semesters"
ALTER COLUMN "outline_allowed_extensions" SET DEFAULT '[".pdf"]'::jsonb;

UPDATE "semesters"
SET "outline_allowed_extensions" = '[".pdf"]'::jsonb
WHERE "outline_allowed_extensions" IS DISTINCT FROM '[".pdf"]'::jsonb;
