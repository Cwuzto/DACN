require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');
const { seedPermissionCatalog } = require('../src/services/permissionService');

const OPERATIONAL_TABLES = [
  'academic_delegations',
  'assignment_decisions',
  'audit_logs',
  'bm01_evaluations',
  'bm02_submissions',
  'bm02a_adjustment_requests',
  'bm02a_form_versions',
  'bm03_meeting_entries',
  'bm03_progress_records',
  'bm03_stage_evaluations',
  'bm04_evaluations',
  'checkpoint_evaluations',
  'checkpoint_signature_appeals',
  'council_members',
  'council_result_batches',
  'councils',
  'decision_amendments',
  'defense_criterion_scores',
  'defense_document_snapshots',
  'defense_document_versions',
  'defense_member_criterion_scores',
  'defense_member_scores',
  'defense_result_approvals',
  'defense_results',
  'defense_schedule_adjustment_logs',
  'defense_score_book_return_logs',
  'electronic_signature_events',
  'idempotency_records',
  'institute_defense_reviews',
  'institute_stop_reviews',
  'lecturer_project_assignments',
  'manual_review_cases',
  'meeting_logs',
  'mentor_transfers',
  'notifications',
  'period_workflow_policy_versions',
  'portal_configurations',
  'portal_content_revision_assets',
  'portal_content_revisions',
  'portal_links',
  'portal_templates',
  'project_archives',
  'project_catalogs',
  'public_announcements',
  'registration_state_history',
  'result_publication_items',
  'result_publications',
  'semesters',
  'stored_asset_cleanup_jobs',
  'stored_asset_upload_sessions',
  'stored_assets',
  'student_profiles',
  'student_project_enrollments',
  'submissions',
  'tasks',
  'title_adjustment_appendices',
  'title_adjustment_appendix_items',
  'topic_assignment_decision_items',
  'topic_assignment_decisions',
  'topic_expertise_assessments',
  'topic_registrations',
  'topic_title_adjustments',
  'topics',
];

async function resetKeepAdmin() {
  console.log('--- STARTING DATABASE CLEANUP: KEEP ONLY ADMIN ---');

  // 1. Find or verify existing Admin
  let admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', code: 'ADMIN001' },
  });

  if (!admin) {
    admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });
  }

  const adminEmail = admin?.email || 'admin@university.edu.vn';
  const adminCode = admin?.code || 'ADMIN001';
  const adminFullName = admin?.fullName || 'Quản trị hệ thống';
  const adminPasswordHash = admin?.passwordHash || (await bcrypt.hash('admin123', 10));

  console.log(`Preserving Admin: ${adminFullName} (${adminCode} - ${adminEmail})`);

  // 2. Truncate all operational tables with CASCADE
  console.log(`Truncating ${OPERATIONAL_TABLES.length} operational tables...`);
  const truncateSql = `TRUNCATE TABLE ${OPERATIONAL_TABLES.map(t => `public."${t}"`).join(', ')} RESTART IDENTITY CASCADE;`;
  await prisma.$executeRawUnsafe(truncateSql);
  console.log('Truncated all operational tables successfully.');

  // 3. Clean user_permission_groups for non-admins
  await prisma.$executeRawUnsafe(`DELETE FROM public."user_permission_groups";`);

  // 4. Delete all users except ADMIN001
  await prisma.$executeRawUnsafe(`DELETE FROM public."users" WHERE code != '${adminCode}';`);

  // 5. Ensure the preserved admin exists with clean data
  const finalAdmin = await prisma.user.upsert({
    where: { code: adminCode },
    create: {
      email: adminEmail,
      fullName: adminFullName,
      code: adminCode,
      role: 'ADMIN',
      passwordHash: adminPasswordHash,
      phone: '0900000001',
      department: 'Quản trị hệ thống',
      academicTitle: null,
      isActive: true,
    },
    update: {
      email: adminEmail,
      fullName: adminFullName,
      role: 'ADMIN',
      department: 'Quản trị hệ thống',
      academicTitle: null,
      isActive: true,
    },
  });

  console.log(`Admin record verified: ID=${finalAdmin.id}, Code=${finalAdmin.code}, Email=${finalAdmin.email}`);

  // 6. Seed permission catalog & system groups
  console.log('Seeding permission catalog and system groups...');
  await seedPermissionCatalog(prisma);

  // 7. Assign Admin to QUAN_TRI_VIEN group
  const adminGroup = await prisma.permissionGroup.findUnique({
    where: { code: 'QUAN_TRI_VIEN' },
  });

  if (adminGroup) {
    await prisma.userPermissionGroup.upsert({
      where: {
        userId_permissionGroupId: {
          userId: finalAdmin.id,
          permissionGroupId: adminGroup.id,
        },
      },
      create: {
        userId: finalAdmin.id,
        permissionGroupId: adminGroup.id,
      },
      update: {},
    });
    console.log(`Assigned Admin ${finalAdmin.code} to QUAN_TRI_VIEN group.`);
  }

  // 7b. Seed default Project Catalog (DATN)
  await prisma.projectCatalog.upsert({
    where: { code: 'DATN' },
    update: { name: 'Đồ án tốt nghiệp', isActive: true },
    create: { code: 'DATN', name: 'Đồ án tốt nghiệp', isActive: true },
  });
  console.log('Seeded default project catalog (DATN - Đồ án tốt nghiệp).');

  // 8. Verify final database state
  const remainingUsers = await prisma.user.findMany({
    select: { id: true, code: true, email: true, fullName: true, role: true },
  });
  const remainingSemesters = await prisma.semester.count();
  const remainingTopics = await prisma.topic.count();
  const remainingRegistrations = await prisma.topicRegistration.count();
  const remainingCouncils = await prisma.council.count();

  console.log('\n--- VERIFICATION RESULT ---');
  console.log('Remaining users:', remainingUsers);
  console.log('Remaining semesters:', remainingSemesters);
  console.log('Remaining topics:', remainingTopics);
  console.log('Remaining registrations:', remainingRegistrations);
  console.log('Remaining councils:', remainingCouncils);
  console.log('--- CLEANUP COMPLETE ---');
}

resetKeepAdmin()
  .catch((err) => {
    console.error('Error during cleanup:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
