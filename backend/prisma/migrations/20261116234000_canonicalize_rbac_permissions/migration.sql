-- Migration: 20261116234000_canonicalize_rbac_permissions
-- Idempotent RBAC permission canonicalization and system group protection

-- 1. Ensure the 5 system groups are flagged as is_system = true
UPDATE "permission_groups"
SET "is_system" = true
WHERE "code" IN ('SYSTEM_STUDENT_BASE', 'GVHD', 'GIAO_VU', 'VIEN_TRUONG', 'QUAN_TRI_VIEN');

-- 2. Migrate stored permission_group_permissions from alias IDs to canonical IDs safely
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT 'TOPIC_ASSIGNMENT_DECISION_ISSUE' AS alias_code, 'PROJECT_ASSIGNMENT_PUBLISH' AS canonical_code UNION ALL
    SELECT 'VIEW_MENTORED_STUDENTS', 'VIEW_MENTOR_STUDENTS' UNION ALL
    SELECT 'VIEW_ASSIGNMENT_DECISIONS', 'VIEW_TOPIC_ASSIGNMENT_DECISIONS' UNION ALL
    SELECT 'VIEW_COUNCIL_ASSIGNMENTS', 'VIEW_DEFENSE_ASSIGNMENTS' UNION ALL
    SELECT 'VIEW_DEFENSE_LOCK_LEDGER', 'VIEW_RESULT_LOCKS' UNION ALL
    SELECT 'VIEW_DEFENSE_RESULT_APPROVALS', 'VIEW_DEFENSE_RESULTS_APPROVAL' UNION ALL
    SELECT 'VIEW_RUBRIC_CONFIG', 'RUBRIC_MANAGE' UNION ALL
    SELECT 'VIEW_ALL_TOPICS', 'TOPIC_REVIEW' UNION ALL
    SELECT 'VIEW_PERMISSIONS', 'VIEW_PERMISSION_GROUPS' UNION ALL
    SELECT 'VIEW_ANNOUNCEMENTS', 'PUBLIC_ANNOUNCEMENT_MANAGE' UNION ALL
    SELECT 'VIEW_NOTIFICATIONS', 'NOTIFICATION_MANAGE'
  LOOP
    -- Step A: If a group already has the canonical permission, remove duplicate alias assignment
    DELETE FROM "permission_group_permissions" pgp_alias
    USING "permissions" p_alias, "permissions" p_canonical, "permission_group_permissions" pgp_canonical
    WHERE p_alias.code = rec.alias_code
      AND p_canonical.code = rec.canonical_code
      AND pgp_alias.permission_id = p_alias.id
      AND pgp_canonical.permission_group_id = pgp_alias.permission_group_id
      AND pgp_canonical.permission_id = p_canonical.id;

    -- Step B: Update remaining alias assignments to canonical permission id
    UPDATE "permission_group_permissions" pgp
    SET permission_id = p_canonical.id
    FROM "permissions" p_alias, "permissions" p_canonical
    WHERE p_alias.code = rec.alias_code
      AND p_canonical.code = rec.canonical_code
      AND pgp.permission_id = p_alias.id;
  END LOOP;
END $$;
