const APPLICATION_TABLES = Object.freeze([
  'permissions', 'permission_groups', 'permission_group_permissions', 'user_permission_groups', 'users',
  'semesters', 'academic_delegations', 'topics', 'topic_registrations', 'bm01_evaluations', 'bm02_submissions',
  'assignment_decisions', 'decision_amendments', 'period_workflow_policy_versions',
  'registration_state_history', 'idempotency_records', 'manual_review_cases', 'meeting_logs',
  'project_archives', 'tasks', 'submissions', 'councils', 'council_members', 'council_result_batches', 'defense_results',
  'defense_member_scores', 'defense_member_criterion_scores', 'defense_criterion_scores',
  'defense_result_approvals', 'result_publications', 'result_publication_items', 'rubric_versions',
  'rubric_categories', 'rubric_criteria', 'notifications', 'audit_logs', 'project_catalogs',
  'student_project_enrollments', 'student_profiles', 'lecturer_project_assignments', 'public_announcements', 'portal_configurations', 'portal_links',
  'portal_templates', 'portal_content_revisions', 'topic_title_adjustments',
  'bm04_evaluations', 'checkpoint_evaluations', 'checkpoint_signature_appeals', 'mentor_transfers',
  'electronic_signature_events', 'topic_assignment_decisions', 'topic_assignment_decision_items',
  'bm02a_adjustment_requests', 'bm02a_form_versions', 'title_adjustment_appendices',
  'title_adjustment_appendix_items', 'bm03_progress_records', 'bm03_meeting_entries',
  'bm03_stage_evaluations', 'institute_stop_reviews', 'institute_defense_reviews',
  'defense_schedule_adjustment_logs', 'defense_document_versions', 'defense_document_snapshots', 'defense_score_book_return_logs',
]);

const RESET_CONFIRMATION = 'RESET_DACN_DEMO';

function assertResetAuthorized(env) {
  if (env?.SEED_RESET_CONFIRM !== RESET_CONFIRMATION) {
    throw new Error(`SEED_RESET_CONFIRM must equal ${RESET_CONFIRMATION}.`);
  }
}

function describeDatabaseTarget(databaseUrl) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const target = new URL(databaseUrl);
  return {
    host: target.hostname,
    port: target.port || '5432',
    database: target.pathname.replace(/^\//, ''),
  };
}

function quotedTableList() {
  return APPLICATION_TABLES.map((table) => `public."${table}"`).join(', ');
}

async function assertNoExternalDependents(prisma) {
  const allowed = APPLICATION_TABLES.map((table) => `'${table}'`).join(', ');
  const rows = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT dependent_ns.nspname AS schema_name, dependent.relname AS table_name
    FROM pg_constraint constraint_row
    JOIN pg_class dependent ON dependent.oid = constraint_row.conrelid
    JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent.relnamespace
    JOIN pg_class referenced ON referenced.oid = constraint_row.confrelid
    JOIN pg_namespace referenced_ns ON referenced_ns.oid = referenced.relnamespace
    WHERE constraint_row.contype = 'f'
      AND referenced_ns.nspname = 'public'
      AND referenced.relname IN (${allowed})
      AND NOT (dependent_ns.nspname = 'public' AND dependent.relname IN (${allowed}));
  `);

  if (rows.length) {
    const names = rows.map((row) => `${row.schema_name}.${row.table_name}`).join(', ');
    throw new Error(`Reset aborted: foreign-key dependents outside application allow-list: ${names}.`);
  }
}

async function resetApplicationData(prisma, env = process.env) {
  assertResetAuthorized(env);
  await assertNoExternalDependents(prisma);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTableList()} RESTART IDENTITY CASCADE;`);
}

module.exports = {
  APPLICATION_TABLES,
  RESET_CONFIRMATION,
  assertResetAuthorized,
  describeDatabaseTarget,
  assertNoExternalDependents,
  resetApplicationData,
};
