INSERT INTO "permissions" ("code", "label", "module")
VALUES
  ('RUBRIC_MANAGE', 'Quản trị rubric bảo vệ', 'DEFENSE'),
  ('NOTIFICATION_MANAGE', 'Quản lý thông báo hệ thống', 'ADMIN'),
  ('LEGACY_REVIEW_MANAGE', 'Thẩm định hồ sơ legacy', 'ADMIN'),
  ('FINAL_DOCUMENT_REVIEW', 'Thẩm định hồ sơ lưu chiểu', 'REVISION')
ON CONFLICT ("code") DO UPDATE
SET "label" = EXCLUDED."label",
    "module" = EXCLUDED."module";

WITH default_mappings("group_code", "permission_code") AS (
  VALUES
    ('QUAN_TRI_VIEN', 'RUBRIC_MANAGE'),
    ('QUAN_TRI_VIEN', 'NOTIFICATION_MANAGE'),
    ('QUAN_TRI_VIEN', 'LEGACY_REVIEW_MANAGE'),
    ('GVHD', 'FINAL_DOCUMENT_REVIEW'),
    ('VIEN_TRUONG', 'RUBRIC_MANAGE'),
    ('VIEN_TRUONG', 'FINAL_DOCUMENT_REVIEW')
)
INSERT INTO "permission_group_permissions" ("permission_group_id", "permission_id")
SELECT permission_group."id", permission."id"
FROM default_mappings
JOIN "permission_groups" AS permission_group
  ON permission_group."code" = default_mappings."group_code"
JOIN "permissions" AS permission
  ON permission."code" = default_mappings."permission_code"
ON CONFLICT ("permission_group_id", "permission_id") DO NOTHING;
