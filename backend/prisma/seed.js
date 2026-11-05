require('dotenv').config();

const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');
const { seedPermissionCatalog } = require('../src/services/permissionService');
const { buildAccounts, buildMentorAssignments, DEMO_CALENDAR } = require('../scripts/seed/demoFixtures');
const { resetApplicationData, describeDatabaseTarget } = require('../scripts/seed/resetApplicationData');
const { seedAcademicFixtures, seedDefenseEvidenceAndPublications } = require('../scripts/seed/workflowFixtures');
const { validateDemoSeed } = require('../scripts/seed/validateDemoSeed');

async function createAccounts(db) {
  const hashByPassword = new Map();
  const accountsByEmail = new Map();
  for (const account of buildAccounts()) {
    if (!hashByPassword.has(account.password)) {
      hashByPassword.set(account.password, await bcrypt.hash(account.password, 10));
    }
    const { password, ...data } = account;
    const user = await db.user.create({ data: { ...data, passwordHash: hashByPassword.get(password) } });
    accountsByEmail.set(user.email, user);
  }
  return accountsByEmail;
}

async function assignPermissionGroups(db, accountsByEmail) {
  const groups = await db.permissionGroup.findMany({ where: { code: { in: ['GVHD', 'VIEN_TRUONG', 'QUAN_TRI_VIEN', 'SYSTEM_STUDENT_BASE'] } } });
  const groupByCode = new Map(groups.map((group) => [group.code, group.id]));
  const assignments = [];
  for (const user of accountsByEmail.values()) {
    if (user.role === 'STUDENT') {
      const studentGroupId = groupByCode.get('SYSTEM_STUDENT_BASE');
      if (studentGroupId) assignments.push({ userId: user.id, permissionGroupId: studentGroupId });
    } else if (user.role === 'LECTURER') {
      assignments.push({ userId: user.id, permissionGroupId: groupByCode.get('GVHD') });
    }
  }
  assignments.push({ userId: accountsByEmail.get('lecturer01@university.edu.vn').id, permissionGroupId: groupByCode.get('VIEN_TRUONG') });
  assignments.push({ userId: accountsByEmail.get('admin@university.edu.vn').id, permissionGroupId: groupByCode.get('QUAN_TRI_VIEN') });
  await db.userPermissionGroup.createMany({ data: assignments });
}

async function main() {
  console.log('[seed] Target:', describeDatabaseTarget(process.env.DATABASE_URL));
  console.log('[seed] Resetting reviewed application tables...');
  const { academic, publications, summary } = await prisma.$transaction(async (tx) => {
    await resetApplicationData(tx, process.env);
    await seedPermissionCatalog(tx);
    const accountsByEmail = await createAccounts(tx);
    await assignPermissionGroups(tx, accountsByEmail);
    const seededAcademic = await seedAcademicFixtures({ prisma: tx, accountsByEmail, calendar: DEMO_CALENDAR });
    const seededPublications = await seedDefenseEvidenceAndPublications({ prisma: tx, context: seededAcademic, fixtures: seededAcademic.registrations });
    const seededSummary = await validateDemoSeed(tx);
    return { academic: seededAcademic, publications: seededPublications, summary: seededSummary };
  }, { timeout: 120000, maxWait: 30000 });
  console.log('[seed] Controlled demo seed complete.');
  console.table({ ...summary, semester: academic.semester.name, mentorAssignments: buildMentorAssignments().length, publications: Object.keys(publications).length });
  console.log('[seed] Login: admin@university.edu.vn / admin123');
  console.log('[seed] Login: lecturer01@university.edu.vn / lecturer123 (Viện trưởng + GVHD sv001–sv010)');
  console.log('[seed] Login: sv001@university.edu.vn / student123');
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error('[seed] Failed:', error); process.exit(1); });
