require('dotenv').config();

const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');
const { seedPermissionCatalog } = require('../src/services/permissionService');
const { resetApplicationData, describeDatabaseTarget } = require('../scripts/seed/resetApplicationData');
const { buildAccounts, seedPhase1AcademicFixtures } = require('../scripts/seed/phase1Fixtures');
const { validateDemoSeed } = require('../scripts/seed/validateDemoSeed');

async function createAccounts(db, precomputedHashes) {
  const accounts = buildAccounts();
  const accountsData = accounts.map(({ password, ...data }, idx) => ({
    ...data,
    phone: data.role === 'ADMIN'
      ? '0900000001'
      : data.role === 'LECTURER'
        ? `0901000${String(idx).padStart(3, '0')}`
        : `0912000${String(idx - 12).padStart(3, '0')}`,
    academicTitle: data.role === 'LECTURER' ? (idx <= 2 ? 'TIEN_SI' : 'THAC_SI') : null,
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
  const groups = await db.permissionGroup.findMany({
    where: { code: { in: ['GVHD', 'VIEN_TRUONG', 'QUAN_TRI_VIEN', 'SYSTEM_STUDENT_BASE'] } },
  });
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
  assignments.push({
    userId: accountsByEmail.get('lecturer01@university.edu.vn').id,
    permissionGroupId: groupByCode.get('VIEN_TRUONG'),
  });
  assignments.push({
    userId: accountsByEmail.get('admin@university.edu.vn').id,
    permissionGroupId: groupByCode.get('QUAN_TRI_VIEN'),
  });
  await db.userPermissionGroup.createMany({ data: assignments });
}

async function runPhase1Seed() {
  console.log('[seed:phase1] Target:', describeDatabaseTarget(process.env.DATABASE_URL));
  console.log('[seed:phase1] Precomputing password hashes...');
  const precomputedHashes = new Map();
  for (const pwd of ['admin123', 'lecturer123', 'student123']) {
    precomputedHashes.set(pwd, await bcrypt.hash(pwd, 10));
  }

  console.log('[seed:phase1] Resetting application tables and seeding Phase 1 fixtures...');
  await resetApplicationData(prisma, process.env);
  await seedPermissionCatalog(prisma);
  const accountsByEmail = await createAccounts(prisma, precomputedHashes);
  await assignPermissionGroups(prisma, accountsByEmail);
  const academic = await seedPhase1AcademicFixtures({ prisma, accountsByEmail });
  const summary = await validateDemoSeed(prisma);

  console.log('[seed:phase1] Phase 1 seed complete.');
  console.table({
    ...summary,
    phase: 'PHASE 1 (Topic Registration -> BM01 Outline Review)',
    semesterHK1: academic.semesters.semesterHK1.name,
    semesterHK2: academic.semesters.semesterHK2.name,
    outlineCouncils: academic.outlineCouncils.length,
  });

  console.log('\n[seed:phase1] === DANH SÁCH TÀI KHOẢN TEST GIAI ĐOẠN 1 ===');
  console.table([
    { Kịch_bản: 'Quản trị hệ thống (Phân công HĐ, Reopen)', Email: 'admin@university.edu.vn', Mật_khẩu: 'admin123', Ghi_chú: 'QUAN_TRI_VIEN' },
    { Kịch_bản: 'Viện trưởng / Chủ tịch HĐ Đề cương 1', Email: 'lecturer01@university.edu.vn', Mật_khẩu: 'lecturer123', Ghi_chú: 'VIEN_TRUONG + CHAIRMAN HĐ1' },
    { Kịch_bản: 'Thư ký HĐ Đề cương 1 (Nhập nháp sv061-sv068)', Email: 'lecturer02@university.edu.vn', Mật_khẩu: 'lecturer123', Ghi_chú: 'SECRETARY HĐ1 (Batch DRAFT)' },
    { Kịch_bản: 'Chủ tịch HĐ Đề cương 2 (Công bố sv069-sv075)', Email: 'lecturer04@university.edu.vn', Mật_khẩu: 'lecturer123', Ghi_chú: 'CHAIRMAN HĐ2 (Batch PENDING_CHAIR)' },
    { Kịch_bản: 'Chủ tịch HĐ Đề cương 3 (Duyệt v2 sv091-sv105)', Email: 'lecturer07@university.edu.vn', Mật_khẩu: 'lecturer123', Ghi_chú: 'CHAIRMAN HĐ3 (Duyệt BM01 v2)' },
    { Kịch_bản: '1. HK2 - Chưa đăng ký đề tài (sv001..sv015)', Email: 'sv001@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'Test đăng ký đề tài có sẵn / đề xuất mới' },
    { Kịch_bản: '2. HK2 - Chờ GVHD duyệt ĐK (sv016..sv030)', Email: 'sv016@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'Trạng thái PENDING (GVHD: lecturer01)' },
    { Kịch_bản: '3. HK1 - Đã duyệt, chờ nộp BM01 v1 (sv031..sv045)', Email: 'sv031@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'Trạng thái APPROVED, Task BM01 OPEN' },
    { Kịch_bản: '4. HK1 - Đã nộp BM01 v1, chờ gán HĐ (sv046..sv060)', Email: 'sv046@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'BM01_SUBMITTED, outlineCouncilId = null' },
    { Kịch_bản: '5A. HK1 - Đã gán HĐ1, Thư ký đang chấm (sv061..sv068)', Email: 'sv061@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'HĐ Đề cương 1 (Batch DRAFT)' },
    { Kịch_bản: '5B. HK1 - Đã gán HĐ2, chờ Chủ tịch công bố (sv069..sv075)', Email: 'sv069@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'HĐ Đề cương 2 (Batch PENDING_CHAIR)' },
    { Kịch_bản: '6. HK1 - Yêu cầu sửa đổi BM01 (sv076..sv090)', Email: 'sv076@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'BM01_NEEDS_REVISION, hạn +7 ngày' },
    { Kịch_bản: '7. HK1 - Đã nộp lại BM01 v2 (sv091..sv105)', Email: 'sv091@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'BM01_RESUBMITTED, chờ Chủ tịch HĐ3 duyệt' },
    { Kịch_bản: '8. HK1 - Đã đạt đề cương BM01 (sv106..sv120)', Email: 'sv106@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'BM01_PASSED, sẵn sàng Reopen / nộp BM02' },
  ]);

  return { academic, summary };
}

if (require.main === module) {
  runPhase1Seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[seed:phase1] Failed:', error);
      process.exit(1);
    });
}

module.exports = { runPhase1Seed };
