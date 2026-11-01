const prisma = require('../src/config/database');

async function main() {
  console.log('--- Setting up Demo Scenarios ---');

  // Let's find an active semester or use semester with registrations
  const semesters = await prisma.semester.findMany({
    orderBy: { id: 'desc' },
    take: 3
  });
  console.log('Semesters:', semesters.map(s => ({ id: s.id, code: s.code, name: s.name, status: s.status })));

  // Target 3 registrations to put into 3 demo scenarios
  // Scenario 1: BM01_NEEDS_REVISION -> SV resubmits BM01 -> GVHD approves
  // Scenario 2: BM01_PASSED -> SV submits BM02 -> Admin issues Decision
  // Scenario 3: DECISION_ISSUED -> SV requests Topic Title Change -> GVHD approves

  const regs = await prisma.topicRegistration.findMany({
    where: {
      status: { notIn: ['REJECTED', 'DROPPED', 'WITHDRAWN'] }
    },
    include: {
      student: true,
      topic: {
        include: {
          mentor: true,
          semester: true
        }
      }
    },
    take: 10
  });

  if (regs.length < 3) {
    console.error('Not enough registrations found to setup demo. Total found:', regs.length);
    return;
  }

  // Pick 3 registrations
  const reg1 = regs[0];
  const reg2 = regs[1];
  const reg3 = regs[2];

  // Setup Scenario 1:
  await prisma.topicRegistration.update({
    where: { id: reg1.id },
    data: {
      status: 'BM01_NEEDS_REVISION',
      outlineReviewStatus: 'REVISION_REQUIRED',
      outlineFeedback: 'Đề cương cần bổ sung thêm phần Khảo sát tài liệu liên quan và Chi tiết công nghệ sử dụng.',
      decisionDate: null
    }
  });

  // Setup Scenario 2:
  await prisma.topicRegistration.update({
    where: { id: reg2.id },
    data: {
      status: 'BM01_PASSED',
      outlineReviewStatus: 'PASSED',
      outlineFeedback: 'Đề cương BM01 đã đạt yêu cầu chuyên môn.',
      decisionDate: null
    }
  });

  // Setup Scenario 3:
  const now = new Date();
  await prisma.topicRegistration.update({
    where: { id: reg3.id },
    data: {
      status: 'DECISION_ISSUED',
      outlineReviewStatus: 'PASSED',
      decisionDate: now,
      decisionNumber: `QD-KHOALUAN-${reg3.semesterId}-${new Date().getFullYear()}`
    }
  });

  // Check if reg3 already has pending adjustments, clean them up for fresh demo
  await prisma.topicTitleAdjustment.deleteMany({
    where: { registrationId: reg3.id }
  });

  console.log('\n=== KỊCH BẢN DEMO SẴN SÀNG ===');
  console.log('\n1. KỊCH BẢN 1: NỘP LẠI & PHÊ DUYỆT ĐỀ CƯƠNG BM01');
  console.log(`- Sinh viên: ${reg1.student.email} (Họ tên: ${reg1.student.fullName}) | Pass: student123`);
  console.log(`- GVHD: ${reg1.topic.mentor?.email} (Họ tên: ${reg1.topic.mentor?.fullName}) | Pass: lecturer123`);
  console.log(`- Đề tài: "${reg1.topic.title}"`);
  console.log(`- Trạng thái hiện tại: BM01_NEEDS_REVISION (Yêu cầu chỉnh sửa)`);
  console.log(`- Thao tác SV: Đăng nhập -> Vào "Nộp báo cáo & BM" -> Thấy nút "Nộp lại đề cương BM01 đã chỉnh sửa" -> Nộp.`);
  console.log(`- Thao tác GVHD: Đăng nhập -> Dashboard -> Mục "Đề cương BM01 cần thẩm định lại" -> Xem & Bấm "Phê duyệt đạt".`);

  console.log('\n2. KỊCH BẢN 2: NỘP BM02 & BAN HÀNH QUYẾT ĐỊNH VIỆN');
  console.log(`- Sinh viên: ${reg2.student.email} (Họ tên: ${reg2.student.fullName}) | Pass: student123`);
  console.log(`- Viện trưởng: lecturer01@university.edu.vn (Pass: lecturer123) hoặc Admin: admin@university.edu.vn (Pass: admin123)`);
  console.log(`- Đề tài: "${reg2.topic.title}" (Học kỳ: ${reg2.topic.semester?.name})`);
  console.log(`- Trạng thái hiện tại: BM01_PASSED`);
  console.log(`- Thao tác SV: Đăng nhập -> Vào "Nộp báo cáo & BM" -> Mở khóa nút nộp "Nộp đề xuất đề tài BM02" -> Nộp thành công.`);
  console.log(`- Thao tác Viện trưởng / Admin: Đăng nhập -> Vào "Quản lý Viện & Ban hành QĐ" -> Chọn học kỳ ${reg2.topic.semester?.name} -> Bấm "Ký duyệt & Ban hành Quyết định giao đề tài".`);

  console.log('\n3. KỊCH BẢN 3: NỘP PHIẾU ĐỔI TÊN ĐỀ TÀI (CỬA SỔ 7 NGÀY) & GVHD DUYỆT');
  console.log(`- Sinh viên: ${reg3.student.email} (Họ tên: ${reg3.student.fullName}) | Pass: student123`);
  console.log(`- GVHD: ${reg3.topic.mentor?.email} (Họ tên: ${reg3.topic.mentor?.fullName}) | Pass: lecturer123`);
  console.log(`- Đề tài: "${reg3.topic.title}"`);
  console.log(`- Trạng thái hiện tại: DECISION_ISSUED (Đã ban hành QĐ hôm nay: ${now.toLocaleDateString('vi-VN')})`);
  console.log(`- Thao tác SV: Đăng nhập -> Dashboard -> Banner đếm ngược 7 ngày -> Bấm "Đề xuất điều chỉnh tên đề tài" -> Nhập tên mới & lý do -> Gửi.`);
  console.log(`- Thao tác GVHD: Đăng nhập -> Dashboard -> Mục "Đơn xin đổi tên đề tài (7 ngày)" -> Bấm "Phê duyệt".`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
