require('dotenv').config();

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');
const { seedPermissionCatalog } = require('../src/services/permissionService');
const { resetApplicationData, describeDatabaseTarget } = require('../scripts/seed/resetApplicationData');
const {
  buildAccounts,
  seedPhase2AcademicFixtures,
  seedPhase2DefenseEvidenceAndPublications,
} = require('../scripts/seed/phase2Fixtures');
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

async function runPhase2Seed() {
  console.log('[seed:phase2] Target:', describeDatabaseTarget(process.env.DATABASE_URL));
  console.log('[seed:phase2] Precomputing password hashes...');
  const precomputedHashes = new Map();
  for (const pwd of ['admin123', 'lecturer123', 'student123']) {
    precomputedHashes.set(pwd, await bcrypt.hash(pwd, 10));
  }

  console.log('[seed:phase2] Resetting application tables and seeding Phase 2 fixtures...');
  await resetApplicationData(prisma, process.env);
  await seedPermissionCatalog(prisma);
  const accountsByEmail = await createAccounts(prisma, precomputedHashes);
  await assignPermissionGroups(prisma, accountsByEmail);
  const academic = await seedPhase2AcademicFixtures({ prisma, accountsByEmail });
  const publications = await seedPhase2DefenseEvidenceAndPublications({
    prisma,
    context: academic,
    fixtures: academic.registrations,
  });
  const summary = await validateDemoSeed(prisma);

  console.log('[seed:phase2] Phase 2 seed complete.');
  console.table({
    ...summary,
    phase: 'PHASE 2 (BM02 -> Decision -> BM02-A -> Appendix -> BM03 -> BM04 -> Defense)',
    semesterHK1: academic.semesters.semesterHK1.name,
    semesterHK2: academic.semesters.semesterHK2.name,
    publications: Object.keys(publications).length,
  });

  console.log('\n[seed:phase2] === DANH SÁCH TÀI KHOẢN TEST GIAI ĐOẠN 2 ===');
  console.table([
    { Kịch_bản: 'Quản trị hệ thống (Ban hành QĐ, Phụ lục, Thẩm định dừng/bảo vệ)', Email: 'admin@university.edu.vn', Mật_khẩu: 'admin123', Ghi_chú: 'QUAN_TRI_VIEN' },
    { Kịch_bản: 'Viện trưởng kiêm GVHD (Duyệt BM02, Ban hành QĐ/PL, Thẩm định BM03/BM04)', Email: 'lecturer01@university.edu.vn', Mật_khẩu: 'lecturer123', Ghi_chú: 'VIEN_TRUONG + GVHD (sv031, sv049, sv063, sv079)' },
    { Kịch_bản: 'Phụ trách Bộ môn kiêm GVHD (Duyệt bước 3 BM02-A, Ủy quyền BM02)', Email: 'lecturer02@university.edu.vn', Mật_khẩu: 'lecturer123', Ghi_chú: 'BM02A_FINAL_APPROVE + BM02_REVIEW + GVHD (sv032, sv050, sv064, sv080)' },
    { Kịch_bản: '1A.1. HK2 - Đã qua BM01, chờ SV nộp BM02 (sv001..sv008)', Email: 'sv001@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'BM01_PASSED, Task BM02 OPEN' },
    { Kịch_bản: '1A.2. HK2 - Đã nộp BM02 đổi tên, chờ Viện duyệt (sv009..sv014)', Email: 'sv009@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'BM02_SUBMITTED (có titleChangeReason)' },
    { Kịch_bản: '1A.3. HK2 - BM02 yêu cầu chỉnh sửa, chờ SV nộp v2 (sv015..sv018)', Email: 'sv015@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'BM02_NEEDS_REVISION, hạn +5 ngày' },
    { Kịch_bản: '1A.4. HK2 - Đã duyệt BM02, chờ công bố Quyết định (sv019..sv024)', Email: 'sv019@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'BM02_APPROVED, sẵn sàng tạo QĐ giao đề tài' },
    { Kịch_bản: '1B.1. HK1 - Đã có QĐ giao đề tài, mở cửa sổ 168h BM02-A (sv025..sv030)', Email: 'sv025@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'DECISION_ISSUED, còn 120h để tạo BM02-A v1' },
    { Kịch_bản: '1B.2. HK1 - Đã gửi BM02-A v1, chờ GVHD ký duyệt (sv031..sv034)', Email: 'sv031@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'PENDING_ADVISOR (GVHD: lecturer01)' },
    { Kịch_bản: '1B.3. HK1 - BM02-A v1 bị trả lại, chờ SV sửa v2 (sv035..sv038)', Email: 'sv035@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'RETURNED_FOR_CORRECTION (revisionCount = 0)' },
    { Kịch_bản: '1B.4. HK1 - BM02-A chờ Phụ trách Bộ môn ký duyệt cuối (sv039..sv042)', Email: 'sv039@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'PENDING_DEPARTMENT_APPROVAL (lecturer02 duyệt)' },
    { Kịch_bản: '1B.5. HK1 - BM02-A đủ 3 chữ ký, chờ gộp Phụ lục Đợt 2 (sv043..sv045)', Email: 'sv043@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'APPROVED_PENDING_APPENDIX (có finalPdfFileUrl)' },
    { Kịch_bản: '1B.6. HK1 - Đã ban hành Phụ lục Đợt 1 PL-01 (sv046..sv048)', Email: 'sv046@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'ADJUSTMENT_ISSUED, tên mới đã có hiệu lực' },
    { Kịch_bản: '2.1. HK1 - BM03 đang hướng dẫn, có 1 buổi chưa ký khóa (sv049..sv056)', Email: 'sv049@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'IN_PROGRESS (GVHD: lecturer01 ký khóa buổi 3)' },
    { Kịch_bản: '2.2A. HK1 - GVHD đề nghị dừng Giữa kỳ, chờ Viện thẩm định (sv057..sv059)', Email: 'sv057@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'STOP_REVIEW_PENDING (MIDTERM, hạn +120h)' },
    { Kịch_bản: '2.2B. HK1 - Đề nghị dừng Cuối kỳ, Viện yêu cầu bổ sung (sv060..sv062)', Email: 'sv060@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'MORE_INFO_REQUIRED (FINAL, extensionCount = 1)' },
    { Kịch_bản: '2.3. HK1 - BM03 đủ 3 buổi & 2 chặng, chờ GVHD ký toàn phiếu (sv063..sv068)', Email: 'sv063@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'IN_PROGRESS (GVHD: lecturer01 ký toàn phiếu BM03)' },
    { Kịch_bản: '2.4. HK1 - BM03 đang mở cửa sổ 48h chờ SV xác nhận (sv069..sv074)', Email: 'sv069@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'Còn 36h để SV bấm Đồng ý / Đề nghị kiểm tra lại' },
    { Kịch_bản: '2.5A. HK1 - BM03 hoàn tất STUDENT_CONFIRMED (sv075..sv076)', Email: 'sv075@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'BM03_COMPLETED (SV đã xác nhận)' },
    { Kịch_bản: '2.5B. HK1 - BM03 hoàn tất AUTO_CLOSED_AFTER_48H (sv077..sv078)', Email: 'sv077@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'BM03_COMPLETED (Tự động đóng sau 48h)' },
    { Kịch_bản: '3.1. HK1 - BM04 bản nháp DRAFT, chờ GVHD chấm & ký (sv079..sv084)', Email: 'sv079@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'sv079-sv080 có Phụ lục tên mới (GVHD: lecturer01)' },
    { Kịch_bản: '3.2. HK1 - GVHD kết luận Không cho bảo vệ, chờ Viện thẩm định (sv085..sv090)', Email: 'sv085@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'DEFENSE_REVIEW_PENDING (hạn +120h)' },
    { Kịch_bản: '3.3. HK1 - Đủ điều kiện bảo vệ, chờ xếp Hội đồng (sv091..sv094)', Email: 'sv091@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'DEFENSE_READY (sv091-sv092 BM04 đạt, sv093-sv094 Viện duyệt ELIGIBLE_BY_INSTITUTE)' },
    { Kịch_bản: '4.1. HK1 - HĐ Bảo vệ xếp ca Sáng/Chiều & đang chấm (sv095..sv098)', Email: 'sv095@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'AWAITING_SCORES (sv095: 1 người khóa, sv096: 3 người khóa, sv097: ABSENT, sv098: ca Chiều)' },
    { Kịch_bản: '4.2. HK1 - Chủ tịch khóa sổ điểm, chờ công bố (sv099..sv100)', Email: 'sv099@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'AWAITING_FINAL_APPROVAL (Chủ tịch khóa sổ điểm)' },
    { Kịch_bản: '4.3. HK1 - Đã công bố DEFENSE_PASSED, nộp lưu chiểu 14 ngày (sv101..sv104)', Email: 'sv101@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'DEFENSE_PASSED (sv101 nộp 4 file, sv102 thiếu file)' },
    { Kịch_bản: '4.4. HK1 - Đã duyệt 2 tầng lưu chiểu, chờ Viện trưởng ký (sv105..sv106)', Email: 'sv105@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'PENDING_INSTITUTE_SIGNATURE (GVHD + Giáo vụ APPROVED)' },
    { Kịch_bản: '4.5A. HK1 - Lưu chiểu bị từ chối ARCHIVE_REJECTED (sv107..sv108)', Email: 'sv107@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'ARCHIVE_REJECTED (Điểm bảo vệ giữ nguyên)' },
    { Kịch_bản: '4.5B. HK1 - Quá hạn 15 ngày thiếu file ARCHIVE_INCOMPLETE (sv109..sv110)', Email: 'sv109@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'ARCHIVE_INCOMPLETE (Cổng đóng cứng 00:00 ngày +15)' },
    { Kịch_bản: '4.6. HK1 - Không đạt bảo vệ DEFENSE_FAILED (sv111..sv114)', Email: 'sv111@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'sv111-sv112 (Điểm < 5.0), sv113-sv114 (ABSENT vắng mặt không điểm giả)' },
    { Kịch_bản: '4.7. HK1 - Hoàn thành toàn khóa COMPLETED (sv115..sv120)', Email: 'sv115@university.edu.vn', Mật_khẩu: 'student123', Ghi_chú: 'COMPLETED (Có Giấy xác nhận hoàn thành & Chữ ký số Viện trưởng)' },
  ]);

  return { academic, publications, summary };
}

if (require.main === module) {
  runPhase2Seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[seed:phase2] Failed:', error);
      process.exit(1);
    });
}

module.exports = { runPhase2Seed };
