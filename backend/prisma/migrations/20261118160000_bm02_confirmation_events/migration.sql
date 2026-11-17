-- Migration: 20261118160000_bm02_confirmation_events
-- Add nullable payloadHash and 3 signature event references to bm02_submissions.
-- Register BM02_ADVISOR_SIGN and BM02_DEPARTMENT_SIGN permissions,
-- idempotently grant BM02_ADVISOR_SIGN to GVHD (and VIEN_TRUONG) and bump permission_version for affected members.
-- BM02_DEPARTMENT_SIGN is NOT auto-granted to GVHD or VIEN_TRUONG.

ALTER TABLE "bm02_submissions"
ADD COLUMN "payload_hash" TEXT,
ADD COLUMN "student_signature_event_id" INTEGER,
ADD COLUMN "advisor_signature_event_id" INTEGER,
ADD COLUMN "department_signature_event_id" INTEGER;

INSERT INTO "permissions" ("code", "label", "module")
VALUES
    ('BM02_ADVISOR_SIGN', 'Ký xác nhận đơn đăng ký đề tài BM02 (GVHD)', 'REGISTRATION'),
    ('BM02_DEPARTMENT_SIGN', 'Ký xác nhận đơn đăng ký đề tài BM02 (Bộ môn)', 'REGISTRATION')
ON CONFLICT ("code") DO UPDATE
SET "label" = EXCLUDED."label",
    "module" = EXCLUDED."module";

WITH inserted_links AS (
    INSERT INTO "permission_group_permissions" ("permission_group_id", "permission_id")
    SELECT pg."id", p."id"
    FROM "permission_groups" pg
    INNER JOIN "permissions" p ON p."code" = 'BM02_ADVISOR_SIGN'
    WHERE pg."code" IN ('GVHD', 'VIEN_TRUONG')
    ON CONFLICT ("permission_group_id", "permission_id") DO NOTHING
    RETURNING "permission_group_id"
)
UPDATE "users" u
SET "permission_version" = u."permission_version" + 1
WHERE EXISTS (
    SELECT 1
    FROM "user_permission_groups" upg
    INNER JOIN inserted_links il ON il."permission_group_id" = upg."permission_group_id"
    WHERE upg."user_id" = u."id"
);
