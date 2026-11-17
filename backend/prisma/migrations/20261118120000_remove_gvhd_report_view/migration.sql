-- Migration: 20261118120000_remove_gvhd_report_view
-- Idempotent removal of REPORT_VIEW from default GVHD system group without touching individual grants/delegations,
-- bumping permission_version for affected GVHD group members in the same transaction.

WITH deleted_links AS (
    DELETE FROM "permission_group_permissions" pgp
    USING "permission_groups" pg, "permissions" p
    WHERE pgp."permission_group_id" = pg."id"
      AND pgp."permission_id" = p."id"
      AND pg."code" = 'GVHD'
      AND p."code" = 'REPORT_VIEW'
    RETURNING pgp."permission_group_id"
)
UPDATE "users" u
SET "permission_version" = u."permission_version" + 1
WHERE EXISTS (
    SELECT 1
    FROM "user_permission_groups" upg
    INNER JOIN deleted_links dl ON dl."permission_group_id" = upg."permission_group_id"
    WHERE upg."user_id" = u."id"
);

