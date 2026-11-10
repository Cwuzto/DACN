require('dotenv').config();

const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');
const { seedPermissionCatalog } = require('../src/services/permissionService');
const { buildAccounts } = require('../scripts/seed/demoFixtures');
const { resetApplicationData, describeDatabaseTarget } = require('../scripts/seed/resetApplicationData');
const { seedAcademicFixtures, seedDefenseEvidenceAndPublications } = require('../scripts/seed/workflowFixtures');
const { validateDemoSeed } = require('../scripts/seed/validateDemoSeed');

async function createAccounts(db, precomputedHashes) {
  const accounts = buildAccounts();
  const accountsData = accounts.map(({ password, ...data }) => ({
    ...data,
    passwordHash: precomputedHashes.get(password),
  }));
  await db.user.createMany({ data: accountsData });
  const allUsers = await db.user.findMany();
  const accountsByEmail = new Map();
  for (const user of allUsers) {
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
  console.log('[seed] Precomputing password hashes...');
  const precomputedHashes = new Map();
  for (const pwd of ['admin123', 'lecturer123', 'student123']) {
    precomputedHashes.set(pwd, await bcrypt.hash(pwd, 10));
  }
  console.log('[seed] Resetting reviewed application tables...');
  const { academic, publications, summary } = await prisma.$transaction(async (tx) => {
    await resetApplicationData(tx, process.env);
    await seedPermissionCatalog(tx);
    const accountsByEmail = await createAccounts(tx, precomputedHashes);
    await assignPermissionGroups(tx, accountsByEmail);
    const seededAcademic = await seedAcademicFixtures({ prisma: tx, accountsByEmail });
    const seededPublications = await seedDefenseEvidenceAndPublications({ prisma: tx, context: seededAcademic, fixtures: seededAcademic.registrations });
    const seededSummary = await validateDemoSeed(tx);
    return { academic: seededAcademic, publications: seededPublications, summary: seededSummary };
  }, { timeout: 360000, maxWait: 60000 });
  console.log('[seed] Controlled demo seed complete.');
  console.table({
    ...summary,
    semesterHK1: academic.semesters.semesterHK1.name,
    semesterHK2: academic.semesters.semesterHK2.name,
    publications: Object.keys(publications).length,
  });
  console.log('[seed] Test Account Credentials:');
  console.log('[seed] - Admin: admin@university.edu.vn / admin123');
  console.log('[seed] - Viện trưởng: lecturer01@university.edu.vn / lecturer123');
  console.log('[seed] - GV ủy quyền BM02: lecturer02@university.edu.vn / lecturer123');
  console.log('[seed] - HK2 chưa ĐK: sv001@university.edu.vn / student123');
  console.log('[seed] - HK2 chờ duyệt: sv011@university.edu.vn / student123');
  console.log('[seed] - HK2 đã duyệt đề tài: sv021@university.edu.vn / student123');
  console.log('[seed] - HK1 nộp đề cương v1: sv031@university.edu.vn / student123');
  console.log('[seed] - HK1 sửa đề cương: sv036@university.edu.vn / student123');
  console.log('[seed] - HK1 nộp lại v2: sv041@university.edu.vn / student123');
  console.log('[seed] - HK1 nộp BM02: sv046@university.edu.vn / student123');
  console.log('[seed] - HK1 QĐ giao: sv051@university.edu.vn / student123');
  console.log('[seed] - HK1 Checkpoint: sv071@university.edu.vn / student123');
  console.log('[seed] - HK1 Khiếu nại chữ ký: sv085@university.edu.vn / student123');
  console.log('[seed] - HK1 Đánh giá BM04: sv086@university.edu.vn / student123');
  console.log('[seed] - HK1 Sẵn sàng bảo vệ: sv096@university.edu.vn / student123');
  console.log('[seed] - HK1 Hội đồng bảo vệ: sv101@university.edu.vn / student123');
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error('[seed] Failed:', error); process.exit(1); });
