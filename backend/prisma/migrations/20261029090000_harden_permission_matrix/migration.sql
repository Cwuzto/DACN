-- Keep the executable permission catalog aligned with the code catalog.
INSERT INTO "permissions" ("code", "label", "module")
VALUES ('BM02_REVIEW', 'Thẩm định đơn BM02', 'REGISTRATION')
ON CONFLICT ("code") DO UPDATE
SET "label" = EXCLUDED."label",
    "module" = EXCLUDED."module";

-- Ensure the institute-leader system group exists without replacing any
-- permission customizations already made through the RBAC matrix.
INSERT INTO "permission_groups" (
  "name",
  "code",
  "description",
  "is_system",
  "updated_at"
)
VALUES (
  'Viện trưởng',
  'VIEN_TRUONG',
  'Quyền quản lý nghiệp vụ của Viện trưởng kiêm GVHD',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE
SET "is_system" = true,
    "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "permission_group_permissions" ("permission_group_id", "permission_id")
SELECT permission_group."id", permission."id"
FROM "permission_groups" AS permission_group
CROSS JOIN "permissions" AS permission
WHERE permission_group."code" = 'VIEN_TRUONG'
  AND permission."code" = 'BM02_REVIEW'
ON CONFLICT ("permission_group_id", "permission_id") DO NOTHING;
