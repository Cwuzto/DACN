require('dotenv').config();

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

process.env.DB_POOL_MAX = '5';
process.env.DB_POOL_CONNECTION_TIMEOUT_MS = '60000';
process.env.DB_POOL_IDLE_TIMEOUT_MS = '60000';

const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');
const { seedPermissionCatalog } = require('../src/services/permissionService');
const { resetApplicationData, describeDatabaseTarget } = require('../scripts/seed/resetApplicationData');
const { DEFAULT_POLICY, checksum } = require('../src/services/workflowPolicyService');
const { DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS } = require('../src/services/rubricService');
const {
  LECTURER_DEFINITIONS,
  CLASSES_CONFIG,
  RUBRIC_VERSION,
  addDays,
  buildThreeSemestersAccounts,
  buildStudentProfilesData,
  getThreeSemesterDefinitions,
  generateTopicTitle,
} = require('../scripts/seed/threeSemestersFixtures');

// Helper chia mảng thành các chunk nhỏ để insert an toàn qua database pool
function chunkArray(items, chunkSize = 50) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function runThreeSemestersSeed() {
  console.log('[seed:3semesters] Target database:', describeDatabaseTarget(process.env.DATABASE_URL));
  const startTime = Date.now();

  // 1. Precompute password hashes
  console.log('[seed:3semesters] Bước 1/8: Băm sẵn mật khẩu bcrypt...');
  const precomputedHashes = new Map();
  for (const pwd of ['admin123', 'lecturer123', 'student123']) {
    precomputedHashes.set(pwd, await bcrypt.hash(pwd, 10));
  }

  // 2. Reset database sạch sẽ
  console.log('[seed:3semesters] Bước 2/8: Reset toàn bộ dữ liệu database (TRUNCATE CASCADE)...');
  await resetApplicationData(prisma, { SEED_RESET_CONFIRM: 'RESET_DACN_DEMO' });

  // 3. Seed Permission Catalog & Lấy nhóm quyền
  console.log('[seed:3semesters] Bước 3/8: Khởi tạo danh mục quyền (Permission Catalog)...');
  await seedPermissionCatalog(prisma);

  const groups = await prisma.permissionGroup.findMany({
    where: { code: { in: ['QUAN_TRI_VIEN', 'VIEN_TRUONG', 'GIAO_VU', 'GVHD'] } },
  });
  const groupByCode = new Map(groups.map((g) => [g.code, g.id]));

  // 4. Tạo Users (1 Admin, 20 Giảng viên, 300 Sinh viên)
  console.log('[seed:3semesters] Bước 4/8: Tạo 321 tài khoản (1 Admin, 20 GV, 300 SV) & StudentProfiles...');
  const { admin, lecturers, students } = buildThreeSemestersAccounts(precomputedHashes);

  // Insert Admin & Giảng viên
  await prisma.user.createMany({
    data: [admin, ...lecturers],
  });

  // Insert 300 Sinh viên theo chunks
  const studentChunks = chunkArray(students, 100);
  for (const chunk of studentChunks) {
    await prisma.user.createMany({ data: chunk });
  }

  // Lấy lại danh sách Users từ DB
  const allUsers = await prisma.user.findMany({
    orderBy: { id: 'asc' },
  });

  const userByEmail = new Map();
  const lecturerList = [];
  const studentList = [];
  let adminUser = null;

  for (const u of allUsers) {
    userByEmail.set(u.email, u);
    if (u.role === 'ADMIN') {
      adminUser = u;
    } else if (u.role === 'LECTURER') {
      lecturerList.push(u);
    } else if (u.role === 'STUDENT') {
      studentList.push(u);
    }
  }

  // Tạo StudentProfiles cho 300 SV
  const studentProfiles = buildStudentProfilesData(studentList);
  const profileChunks = chunkArray(studentProfiles, 100);
  for (const chunk of profileChunks) {
    await prisma.studentProfile.createMany({ data: chunk });
  }

  // Gán nhóm quyền:
  // - Admin: QUAN_TRI_VIEN
  // - lecturer01: VIEN_TRUONG, GVHD
  // - lecturer02: GIAO_VU, GVHD
  // - lecturer03..lecturer20: GVHD
  // - TUYỆT ĐỐI KHÔNG GÁN BẤT KỲ NHÓM QUYỀN NÀO CHO SINH VIÊN
  const userPermAssignments = [];
  userPermAssignments.push({
    userId: adminUser.id,
    permissionGroupId: groupByCode.get('QUAN_TRI_VIEN'),
  });

  for (const def of LECTURER_DEFINITIONS) {
    const lecturerUser = userByEmail.get(def.email);
    if (lecturerUser) {
      for (const groupCode of def.groups) {
        const groupId = groupByCode.get(groupCode);
        if (groupId) {
          userPermAssignments.push({
            userId: lecturerUser.id,
            permissionGroupId: groupId,
          });
        }
      }
    }
  }
  await prisma.userPermissionGroup.createMany({ data: userPermAssignments });

  // 5. Tạo 3 Semesters, Policy Versions & Rubric Version
  console.log('[seed:3semesters] Bước 5/8: Tạo 3 Đợt đồ án (Semesters), Policies & Rubric...');
  const baseDate = new Date();
  const semesterDefs = getThreeSemesterDefinitions(baseDate);

  const sem1 = await prisma.semester.create({ data: semesterDefs.semesterHK1_2526 });
  const sem2 = await prisma.semester.create({ data: semesterDefs.semesterHK2_2526 });
  const sem3 = await prisma.semester.create({ data: semesterDefs.semesterHK1_2627 });

  // 5.1 Tạo 2 Loại đồ án (Project Catalog): DACN & DATN
  const catalogDACN = await prisma.projectCatalog.upsert({
    where: { code: 'DACN' },
    update: { name: 'Đồ án chuyên ngành', isActive: true },
    create: { code: 'DACN', name: 'Đồ án chuyên ngành', isActive: true },
  });
  const catalogDATN = await prisma.projectCatalog.upsert({
    where: { code: 'DATN' },
    update: { name: 'Đồ án tốt nghiệp', isActive: true },
    create: { code: 'DATN', name: 'Đồ án tốt nghiệp', isActive: true },
  });

  const semesters = [
    { sem: sem1, type: 'PAST_1', code: sem1.code, decisionNumber: 'QĐ-ĐATN-2025-01/QĐ-VCNT' },
    { sem: sem2, type: 'PAST_2', code: sem2.code, decisionNumber: 'QĐ-ĐATN-2025-02/QĐ-VCNT' },
    { sem: sem3, type: 'CURRENT', code: sem3.code, decisionNumber: 'QĐ-ĐATN-2026-01/QĐ-VCNT' },
  ];

  // Workflow Policy Versions cho 3 semester
  const policyVersions = {};
  for (const s of semesters) {
    const semPolicy = {
      ...DEFAULT_POLICY,
      bm03MidtermEvaluationOpenAt: s.sem.bm03MidtermEvaluationOpenAt?.toISOString() || null,
      bm03FinalizationOpenAt: s.sem.bm03FinalizationOpenAt?.toISOString() || null,
    };
    const policy = await prisma.periodWorkflowPolicyVersion.create({
      data: {
        semesterId: s.sem.id,
        version: 1,
        policy: semPolicy,
        checksum: checksum(semPolicy),
        createdById: adminUser.id,
      },
    });
    policyVersions[s.sem.id] = policy;
  }

  // Rubric Version chuẩn cho bảo vệ
  const rubric = await prisma.rubricVersion.create({
    data: {
      version: RUBRIC_VERSION,
      title: DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.title,
      description: DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.description,
      totalMaxScore: 10.0,
      isActive: true,
      status: 'ACTIVE',
      lockedAt: addDays(baseDate, -10),
      lockedById: adminUser.id,
      createdById: adminUser.id,
      categories: {
        create: DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.categories.map((cat, cIdx) => ({
          code: cat.code,
          name: cat.name,
          description: cat.description,
          maxScore: cat.maxScore,
          orderIndex: cat.orderIndex || cIdx + 1,
          criteria: {
            create: cat.criteria.map((crit, crIdx) => ({
              code: crit.code,
              label: crit.label || crit.code,
              description: crit.description,
              maxScore: crit.maxScore,
              orderIndex: crit.orderIndex || crIdx + 1,
              cloCode: crit.cloCode || null,
              levelGoodDesc: crit.levelGoodDesc || null,
              levelFairDesc: crit.levelFairDesc || null,
              levelAverageDesc: crit.levelAverageDesc || null,
              levelPoorDesc: crit.levelPoorDesc || null,
            })),
          },
        })),
      },
    },
  });

  const lecturer01 = userByEmail.get('gv001@tdmu.edu.vn'); // Viện trưởng

  // 6. Xử lý phân bổ đề tài & hồ sơ cho 3 đợt
  console.log('[seed:3semesters] Bước 6/8: Phân bổ 300 sinh viên qua 3 đợt, đề tài, BM01, BM02, QĐ giao đề tài...');

  // Danh sách SV theo đợt:
  // Đợt 1: index 0..99 (sv001..sv100)
  // Đợt 2: index 100..199 (sv101..sv200)
  // Đợt 3: index 200..299 (sv201..sv300)
  const semesterStudents = [
    { semesterInfo: semesters[0], students: studentList.slice(0, 100) },
    { semesterInfo: semesters[1], students: studentList.slice(100, 200) },
    { semesterInfo: semesters[2], students: studentList.slice(200, 300) },
  ];

  for (const { semesterInfo, students: batchStudents } of semesterStudents) {
    const sem = semesterInfo.sem;
    const policyVersion = policyVersions[sem.id];
    const isCurrent = semesterInfo.type === 'CURRENT';

    const decisionDate = isCurrent ? addDays(baseDate, -35) : (semesterInfo.type === 'PAST_1' ? addDays(baseDate, -360) : addDays(baseDate, -180));
    const bm01SubmittedAt = isCurrent ? addDays(baseDate, -55) : (semesterInfo.type === 'PAST_1' ? addDays(baseDate, -390) : addDays(baseDate, -210));
    const bm01ReviewedAt = isCurrent ? addDays(baseDate, -48) : (semesterInfo.type === 'PAST_1' ? addDays(baseDate, -380) : addDays(baseDate, -200));
    const bm02SubmittedAt = isCurrent ? addDays(baseDate, -45) : (semesterInfo.type === 'PAST_1' ? addDays(baseDate, -375) : addDays(baseDate, -195));
    const bm02ReviewedAt = isCurrent ? addDays(baseDate, -38) : (semesterInfo.type === 'PAST_1' ? addDays(baseDate, -365) : addDays(baseDate, -185));

    // A. Tạo Topics (mỗi GV 5 SV, chia đều 20 GV)
    const topicsData = [];
    for (let i = 0; i < batchStudents.length; i++) {
      const student = batchStudents[i];
      const mentorIndex = Math.floor(i / 5); // 0..19
      const mentor = lecturerList[mentorIndex];
      const studentProfile = studentProfiles.find((p) => p.studentId === student.id);
      const major = studentProfile?.major || 'Công nghệ thông tin';
      const title = generateTopicTitle(sem.code, i, major);

      const projectCatalog = i < 50 ? catalogDACN : catalogDATN;
      topicsData.push({
        title,
        description: `Đề tài nghiên cứu ứng dụng chuyên sâu cho sinh viên ngành ${major}. Hướng dẫn bởi ${mentor.fullName}.`,
        semesterId: sem.id,
        projectCatalogId: projectCatalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        status: 'APPROVED',
      });
    }

    // Insert Topics theo chunk
    for (const chunk of chunkArray(topicsData, 50)) {
      await prisma.topic.createMany({ data: chunk });
    }

    const createdTopics = await prisma.topic.findMany({
      where: { semesterId: sem.id },
      orderBy: { id: 'asc' },
    });

    // A2. Tạo StudentProjectEnrollments & LecturerProjectAssignments
    const enrollmentsData = batchStudents.map((student, i) => ({
      studentId: student.id,
      semesterId: sem.id,
      projectCatalogId: i < 50 ? catalogDACN.id : catalogDATN.id,
      status: 'ACTIVE',
      source: 'SEED',
    }));
    for (const chunk of chunkArray(enrollmentsData, 50)) {
      await prisma.studentProjectEnrollment.createMany({ data: chunk });
    }

    const lecturerAssignmentsData = [];
    for (const mentor of lecturerList) {
      lecturerAssignmentsData.push(
        {
          lecturerId: mentor.id,
          semesterId: sem.id,
          projectCatalogId: catalogDACN.id,
          plannedQuota: 5,
          status: 'ACTIVE',
          assignedById: adminUser.id,
        },
        {
          lecturerId: mentor.id,
          semesterId: sem.id,
          projectCatalogId: catalogDATN.id,
          plannedQuota: 5,
          status: 'ACTIVE',
          assignedById: adminUser.id,
        }
      );
    }
    await prisma.lecturerProjectAssignment.createMany({ data: lecturerAssignmentsData });

    // B. Tạo TopicRegistrations
    const registrationsData = [];
    for (let i = 0; i < batchStudents.length; i++) {
      const student = batchStudents[i];
      const topic = createdTopics[i];
      const mentorIndex = Math.floor(i / 5);
      const mentor = lecturerList[mentorIndex];

      let regStatus = 'COMPLETED';
      if (isCurrent) {
        // Đợt 3: sv201..sv290 (index 0..89) -> IN_PROGRESS_BM03, sv291..sv300 (index 90..99) -> STOP_REVIEW_PENDING
        regStatus = i < 90 ? 'IN_PROGRESS_BM03' : 'STOP_REVIEW_PENDING';
      }

      registrationsData.push({
        topicId: topic.id,
        studentId: student.id,
        semesterId: sem.id,
        status: regStatus,
        decisionNumber: semesterInfo.decisionNumber,
        decisionDate: decisionDate,
        decisionPublishedAt: decisionDate,
        assignmentStatus: 'ACTIVE',
      });
    }

    for (const chunk of chunkArray(registrationsData, 50)) {
      await prisma.topicRegistration.createMany({ data: chunk });
    }

    const createdRegistrations = await prisma.topicRegistration.findMany({
      where: { semesterId: sem.id },
      include: { student: true, topic: true },
      orderBy: { id: 'asc' },
    });

    // C. Tạo BM01Evaluation (PASSED cho cả 100 SV)
    const bm01Data = createdRegistrations.map((reg, idx) => {
      const mentorIndex = Math.floor(idx / 5);
      const mentor = lecturerList[mentorIndex];
      return {
        registrationId: reg.id,
        attemptNo: 1,
        outcome: 'PASSED',
        submittedAt: bm01SubmittedAt,
        submittedById: reg.studentId,
        reviewedAt: bm01ReviewedAt,
        reviewedById: mentor.id,
        policyVersionId: policyVersion.id,
        comment: 'Đề cương chi tiết đạt yêu cầu, mục tiêu nghiên cứu và kế hoạch thực hiện rõ ràng.',
      };
    });

    for (const chunk of chunkArray(bm01Data, 50)) {
      await prisma.bM01Evaluation.createMany({ data: chunk });
    }

    // D. Tạo BM02Submission (APPROVED cho cả 100 SV)
    const bm02Data = createdRegistrations.map((reg, idx) => {
      const mentorIndex = Math.floor(idx / 5);
      const mentor = lecturerList[mentorIndex];
      return {
        registrationId: reg.id,
        versionNo: 1,
        attemptNo: 1,
        outcome: 'APPROVED',
        bm01ApprovedTitle: reg.topic.title,
        bm02ProposedTitle: reg.topic.title,
        submittedAt: bm02SubmittedAt,
        submittedById: reg.studentId,
        reviewedAt: bm02ReviewedAt,
        reviewedById: lecturer01.id,
        policyVersionId: policyVersion.id,
      };
    });

    for (const chunk of chunkArray(bm02Data, 50)) {
      await prisma.bM02Submission.createMany({ data: chunk });
    }

    const createdBM02s = await prisma.bM02Submission.findMany({
      where: { registrationId: { in: createdRegistrations.map((r) => r.id) } },
      orderBy: { id: 'asc' },
    });
    const bm02ByRegId = new Map(createdBM02s.map((b) => [b.registrationId, b]));

    // Cập nhật currentBM02SubmissionId cho registrations
    for (const reg of createdRegistrations) {
      const b2 = bm02ByRegId.get(reg.id);
      if (b2) {
        await prisma.topicRegistration.update({
          where: { id: reg.id },
          data: { currentBM02SubmissionId: b2.id },
        });
      }
    }

    // E. Tạo TopicAssignmentDecision & TopicAssignmentDecisionItem (100 items)
    const decision = await prisma.topicAssignmentDecision.create({
      data: {
        semesterId: sem.id,
        decisionNumber: semesterInfo.decisionNumber,
        decisionDate: decisionDate,
        decisionPublishedAt: decisionDate,
        fileUrl: `/uploads/decisions/${sem.code}.pdf`,
        fileName: `Quyet_dinh_giao_de_tai_${sem.code}.pdf`,
        issuedById: lecturer01.id,
        policyVersionId: policyVersion.id,
        status: 'PUBLISHED',
        idempotencyKey: `decision-${sem.code}-v1`,
      },
    });

    const decisionItemsData = createdRegistrations.map((reg, idx) => {
      const mentorIndex = Math.floor(idx / 5);
      const mentor = lecturerList[mentorIndex];
      const b2 = bm02ByRegId.get(reg.id);
      return {
        decisionId: decision.id,
        registrationId: reg.id,
        bm02SubmissionId: b2.id,
        approvedTitleSnapshot: reg.topic.title,
        studentCodeSnapshot: reg.student.code,
        studentNameSnapshot: reg.student.fullName,
        mentorNameSnapshot: mentor.fullName,
      };
    });

    for (const chunk of chunkArray(decisionItemsData, 50)) {
      await prisma.topicAssignmentDecisionItem.createMany({ data: chunk });
    }

    // F. Tạo BM03ProgressRecord cho cả 100 SV
    const progressRecordsData = createdRegistrations.map((reg, idx) => {
      const mentorIndex = Math.floor(idx / 5);
      const mentor = lecturerList[mentorIndex];
      return {
        registrationId: reg.id,
        effectiveTitleSnapshot: reg.topic.title,
        isClosedEarly: false,
        finalConclusion: isCurrent ? null : 'Đạt yêu cầu bảo vệ đồ án tốt nghiệp',
        advisorSignedById: isCurrent ? null : mentor.id,
        advisorSignedAt: isCurrent ? null : addDays(decisionDate, 90),
        advisorPayloadHash: isCurrent ? null : checksum({ registrationId: reg.id, status: 'BM03_PASSED' }),
        studentAckStatus: isCurrent ? null : 'ACKNOWLEDGED',
        studentAckAt: isCurrent ? null : addDays(decisionDate, 92),
      };
    });

    for (const chunk of chunkArray(progressRecordsData, 50)) {
      await prisma.bM03ProgressRecord.createMany({ data: chunk });
    }

    const createdProgressRecords = await prisma.bM03ProgressRecord.findMany({
      where: { registrationId: { in: createdRegistrations.map((r) => r.id) } },
      orderBy: { id: 'asc' },
    });
    const progressRecordByRegId = new Map(createdProgressRecords.map((p) => [p.registrationId, p]));

    // G. Tạo BM03MeetingEntry
    const meetingEntriesData = [];
    if (isCurrent) {
      // Đợt 3: 2 buổi họp (buổi 1: -30 ngày ~ 16/10, buổi 2: -15 ngày ~ 31/10)
      for (let i = 0; i < createdRegistrations.length; i++) {
        const reg = createdRegistrations[i];
        const record = progressRecordByRegId.get(reg.id);
        const mentorIndex = Math.floor(i / 5);
        const mentor = lecturerList[mentorIndex];

        // Buổi 1 (16/10): Khởi động đề tài
        const meeting1Date = addDays(baseDate, -30);
        meeting1Date.setHours(8, 30, 0, 0);
        meetingEntriesData.push({
          bm03RecordId: record.id,
          registrationId: reg.id,
          versionNumber: 1,
          meetingDate: meeting1Date,
          meetingMode: 'IN_PERSON',
          locationOrLink: 'Văn phòng Viện B2.01',
          discussionContent: 'Giao nhiệm vụ đồ án, hướng dẫn sinh viên lập kế hoạch chi tiết và khảo sát tài liệu nghiên cứu.',
          studentCompletedWork: 'Sinh viên đã tiếp nhận nhiệm vụ, hoàn thiện đề cương phân rã công việc và thống nhất lịch trao đổi định kỳ.',
          nextTasks: 'Khảo sát hiện trạng công nghệ và phân tích yêu cầu nghiệp vụ.',
          progressRating: 'ON_TRACK',
          advisorSignedById: mentor.id,
          advisorSignedAt: meeting1Date,
          payloadHash: checksum({ regId: reg.id, meeting: 1 }),
          isLocked: true,
        });

        // Buổi 2 (31/10): Thiết kế hệ thống
        const meeting2Date = addDays(baseDate, -15);
        meeting2Date.setHours(14, 0, 0, 0);
        meetingEntriesData.push({
          bm03RecordId: record.id,
          registrationId: reg.id,
          versionNumber: 2,
          meetingDate: meeting2Date,
          meetingMode: 'IN_PERSON',
          locationOrLink: 'Văn phòng Viện B2.01',
          discussionContent: 'Báo cáo khảo sát hiện trạng công nghệ, phân tích yêu cầu nghiệp vụ và thiết kế kiến trúc hệ thống.',
          studentCompletedWork: i < 90
            ? 'Sinh viên trình bày thiết kế CSDL và sơ đồ kiến trúc đạt yêu cầu, tiến độ bám sát kế hoạch.'
            : 'Sinh viên chuẩn bị nội dung sơ sài, chưa hoàn thành thiết kế CSDL.',
          nextTasks: i < 90 ? 'Bắt tay vào cài đặt module backend và kiểm thử API.' : 'Bổ sung thiết kế và báo cáo lại GVHD.',
          progressRating: i < 90 ? 'ON_TRACK' : 'BEHIND',
          advisorSignedById: mentor.id,
          advisorSignedAt: meeting2Date,
          payloadHash: checksum({ regId: reg.id, meeting: 2 }),
          isLocked: true,
        });
      }
    } else {
      // Đợt 1 & 2: 3 buổi họp đầy đủ
      for (let i = 0; i < createdRegistrations.length; i++) {
        const reg = createdRegistrations[i];
        const record = progressRecordByRegId.get(reg.id);
        const mentorIndex = Math.floor(i / 5);
        const mentor = lecturerList[mentorIndex];

        const m1Date = addDays(decisionDate, 10);
        m1Date.setHours(8, 30, 0, 0);
        meetingEntriesData.push({
          bm03RecordId: record.id,
          registrationId: reg.id,
          versionNumber: 1,
          meetingDate: m1Date,
          meetingMode: 'IN_PERSON',
          locationOrLink: 'Văn phòng Viện B2.01',
          discussionContent: 'Khởi động đồ án, thống nhất phương pháp luận và lập kế hoạch các mốc thời gian.',
          studentCompletedWork: 'Sinh viên nắm bắt tốt đề tài, chuẩn bị tài liệu tham khảo phong phú.',
          nextTasks: 'Phân tích yêu cầu và thiết kế kiến trúc hệ thống.',
          progressRating: 'ON_TRACK',
          advisorSignedById: mentor.id,
          advisorSignedAt: m1Date,
          payloadHash: checksum({ regId: reg.id, m: 1 }),
          isLocked: true,
        });

        const m2Date = addDays(decisionDate, 40);
        m2Date.setHours(14, 0, 0, 0);
        meetingEntriesData.push({
          bm03RecordId: record.id,
          registrationId: reg.id,
          versionNumber: 2,
          meetingDate: m2Date,
          meetingMode: 'IN_PERSON',
          locationOrLink: 'Văn phòng Viện B2.01',
          discussionContent: 'Thiết kế cơ sở dữ liệu, kiến trúc phần mềm và xây dựng module lõi.',
          studentCompletedWork: 'Hoàn thành 60% khối lượng công việc, giao diện và backend kết nối mượt mà.',
          nextTasks: 'Hoàn thiện các module còn lại và chuẩn bị tích hợp.',
          progressRating: 'ON_TRACK',
          advisorSignedById: mentor.id,
          advisorSignedAt: m2Date,
          payloadHash: checksum({ regId: reg.id, m: 2 }),
          isLocked: true,
        });

        const m3Date = addDays(decisionDate, 75);
        m3Date.setHours(9, 0, 0, 0);
        meetingEntriesData.push({
          bm03RecordId: record.id,
          registrationId: reg.id,
          versionNumber: 3,
          meetingDate: m3Date,
          meetingMode: 'IN_PERSON',
          locationOrLink: 'Văn phòng Viện B2.01',
          discussionContent: 'Kiểm thử toàn diện, đánh giá hiệu năng và hoàn thiện bản thảo luận văn.',
          studentCompletedWork: 'Đồ án hoàn thiện tốt, chạy thử nghiệm đạt kết quả cao, đồng ý viết báo cáo nghiệm thu.',
          nextTasks: 'Rà soát lỗi chính tả và in bản thảo nộp BM04.',
          progressRating: 'ON_TRACK',
          advisorSignedById: mentor.id,
          advisorSignedAt: m3Date,
          payloadHash: checksum({ regId: reg.id, m: 3 }),
          isLocked: true,
        });
      }
    }

    for (const chunk of chunkArray(meetingEntriesData, 50)) {
      await prisma.bM03MeetingEntry.createMany({ data: chunk });
    }

    // H. Tạo BM03StageEvaluation
    if (isCurrent) {
      // Đợt 3: Đánh giá giữa kỳ (MIDTERM)
      // 90 SV: CONTINUE
      // 10 SV: PROPOSE_STOP + InstituteStopReview
      const stageEvaluationsData = [];
      for (let i = 0; i < createdRegistrations.length; i++) {
        const reg = createdRegistrations[i];
        const record = progressRecordByRegId.get(reg.id);
        const mentorIndex = Math.floor(i / 5);
        const mentor = lecturerList[mentorIndex];
        const isContinue = i < 90;

        stageEvaluationsData.push({
          bm03RecordId: record.id,
          registrationId: reg.id,
          stage: 'MIDTERM',
          decision: isContinue ? 'CONTINUE' : 'PROPOSE_STOP',
          comments: isContinue
            ? 'Sinh viên hoàn thành tốt tiến độ giai đoạn 1, bám sát kế hoạch đề ra và tích cực trao đổi với GVHD.'
            : 'Sinh viên không tham gia đầy đủ các buổi hướng dẫn, tiến độ thực hiện đạt dưới 30% khối lượng yêu cầu giữa kỳ. Đề nghị Viện xem xét dừng thực hiện đồ án.',
          evaluatedById: mentor.id,
          evaluatedAt: addDays(baseDate, -5),
          payloadHash: checksum({ regId: reg.id, stage: 'MIDTERM', decision: isContinue ? 'CONTINUE' : 'PROPOSE_STOP' }),
        });
      }

      for (const chunk of chunkArray(stageEvaluationsData, 50)) {
        await prisma.bM03StageEvaluation.createMany({ data: chunk });
      }

      const createdStageEvals = await prisma.bM03StageEvaluation.findMany({
        where: { registrationId: { in: createdRegistrations.map((r) => r.id) } },
      });

      // Cập nhật midtermStageEvaluationId vào BM03ProgressRecord
      for (const se of createdStageEvals) {
        await prisma.bM03ProgressRecord.update({
          where: { id: se.bm03RecordId },
          data: { midtermStageEvaluationId: se.id },
        });
      }

      // Tạo InstituteStopReview cho 10 sinh viên bị đề nghị dừng (sv291..sv300)
      const stopReviewsData = [];
      for (let i = 90; i < createdRegistrations.length; i++) {
        const reg = createdRegistrations[i];
        const record = progressRecordByRegId.get(reg.id);
        const se = createdStageEvals.find((s) => s.registrationId === reg.id);

        stopReviewsData.push({
          bm03RecordId: record.id,
          stageEvaluationId: se.id,
          registrationId: reg.id,
          stage: 'MIDTERM',
          status: 'STOP_REVIEW_PENDING',
          stopProposalSubmittedAt: addDays(baseDate, -3),
          stopReviewDeadline: addDays(baseDate, 4),
          idempotencyKey: `stop-review-reg-${reg.id}-v1`,
        });
      }

      for (const chunk of chunkArray(stopReviewsData, 50)) {
        await prisma.instituteStopReview.createMany({ data: chunk });
      }
    } else {
      // Đợt 1 & 2: Có đủ 2 chặng MIDTERM & FINAL
      const stageEvaluationsData = [];
      for (let i = 0; i < createdRegistrations.length; i++) {
        const reg = createdRegistrations[i];
        const record = progressRecordByRegId.get(reg.id);
        const mentorIndex = Math.floor(i / 5);
        const mentor = lecturerList[mentorIndex];

        // Midterm
        stageEvaluationsData.push({
          bm03RecordId: record.id,
          registrationId: reg.id,
          stage: 'MIDTERM',
          decision: 'CONTINUE',
          comments: 'Tiến độ giữa kỳ đạt yêu cầu, sản phẩm demo cơ bản hoạt động đúng thiết kế.',
          evaluatedById: mentor.id,
          evaluatedAt: addDays(decisionDate, 45),
          payloadHash: checksum({ regId: reg.id, stage: 'MIDTERM', dec: 'CONTINUE' }),
        });

        // Final
        stageEvaluationsData.push({
          bm03RecordId: record.id,
          registrationId: reg.id,
          stage: 'FINAL',
          decision: 'CONTINUE_TO_BM04',
          comments: 'Sinh viên hoàn thành xuất sắc đồ án, đạt đầy đủ các chuẩn đầu ra và điều kiện để bảo vệ trước Hội đồng.',
          evaluatedById: mentor.id,
          evaluatedAt: addDays(decisionDate, 85),
          payloadHash: checksum({ regId: reg.id, stage: 'FINAL', dec: 'CONTINUE_TO_BM04' }),
        });
      }

      for (const chunk of chunkArray(stageEvaluationsData, 50)) {
        await prisma.bM03StageEvaluation.createMany({ data: chunk });
      }

      const createdStageEvals = await prisma.bM03StageEvaluation.findMany({
        where: { registrationId: { in: createdRegistrations.map((r) => r.id) } },
      });

      for (const reg of createdRegistrations) {
        const mid = createdStageEvals.find((s) => s.registrationId === reg.id && s.stage === 'MIDTERM');
        const fin = createdStageEvals.find((s) => s.registrationId === reg.id && s.stage === 'FINAL');
        const rec = progressRecordByRegId.get(reg.id);

        if (rec) {
          await prisma.bM03ProgressRecord.update({
            where: { id: rec.id },
            data: {
              midtermStageEvaluationId: mid?.id || null,
              finalStageEvaluationId: fin?.id || null,
            },
          });
        }
      }
    }
  }

  // 7. Hoàn thiện toàn bộ quy trình cho Đợt 1 & Đợt 2 (BM04, Hội đồng, Điểm bảo vệ, Công bố, Lưu chiểu)
  console.log('[seed:3semesters] Bước 7/8: Hoàn tất 100% quy trình cho 200 sinh viên Đợt 1 & Đợt 2...');

  const pastSemesters = [semesters[0], semesters[1]];

  for (const sInfo of pastSemesters) {
    const sem = sInfo.sem;
    const policyVersion = policyVersions[sem.id];
    const defenseDate = sem.defenseDate;

    const registrations = await prisma.topicRegistration.findMany({
      where: { semesterId: sem.id },
      include: { student: true, topic: true },
      orderBy: { id: 'asc' },
    });

    // A. BM04Evaluation (200 SV)
    const bm04Data = registrations.map((reg, idx) => {
      const mentorIndex = Math.floor(idx / 5);
      const mentor = lecturerList[mentorIndex];
      const studentClass = CLASSES_CONFIG[idx % CLASSES_CONFIG.length].className;

      return {
        registrationId: reg.id,
        semesterId: sem.id,
        studentId: reg.studentId,
        lecturerId: mentor.id,
        thesisFormatScore: '9.0',
        researchContentScore: '8.8',
        applicabilityScore: '9.0',
        attitudeScore: '9.5',
        conclusion: 'AGREED_FOR_DEFENSE',
        programOutcome: 'MEETS_PROGRAM_OUTCOMES',
        defenseRecommendation: 'APPROVE_FOR_DEFENSE',
        status: 'SIGNED_APPROVED',
        effectiveTitleSnapshot: reg.topic.title,
        studentClassSnapshot: studentClass,
        generalNotes: 'Sinh viên có năng lực nghiên cứu tốt, hoàn thành đầy đủ các yêu cầu của đồ án tốt nghiệp.',
        lecturerSignature: mentor.fullName,
        payloadHash: checksum({ regId: reg.id, bm04: 'SIGNED_APPROVED' }),
        signedAt: addDays(defenseDate, -7),
        isLocked: true,
        policyVersionId: policyVersion.id,
      };
    });

    for (const chunk of chunkArray(bm04Data, 50)) {
      await prisma.bM04Evaluation.createMany({ data: chunk });
    }

    // B. Tạo 5 Hội đồng bảo vệ cho đợt
    // Mỗi hội đồng gồm 20 sinh viên.
    // Để GVHD KHÔNG bị xếp vào hội đồng chấm chính sinh viên của mình:
    // - Council 0 (SV 0..19, mentor 0..3): chấm bởi lecturers [16, 17, 18]
    // - Council 1 (SV 20..39, mentor 4..7): chấm bởi lecturers [0, 1, 2]
    // - Council 2 (SV 40..59, mentor 8..11): chấm bởi lecturers [4, 5, 6]
    // - Council 3 (SV 60..79, mentor 12..15): chấm bởi lecturers [8, 9, 10]
    // - Council 4 (SV 80..99, mentor 16..19): chấm bởi lecturers [12, 13, 14]
    const councilLecturerMap = [
      [16, 17, 18],
      [0, 1, 2],
      [4, 5, 6],
      [8, 9, 10],
      [12, 13, 14],
    ];

    const councils = [];
    for (let cIdx = 0; cIdx < 5; cIdx++) {
      const councilNumber = String(cIdx + 1).padStart(2, '0');
      const c = await prisma.council.create({
        data: {
          semesterId: sem.id,
          name: `Hội đồng bảo vệ đồ án ${councilNumber} — ${sem.code}`,
          councilType: 'DEFENSE_COUNCIL',
          location: `Phòng B2.0${cIdx + 1}`,
          defenseDate: defenseDate,
          meetingMode: 'IN_PERSON',
          schedulePublishedAt: addDays(defenseDate, -5),
          rubricVersionId: rubric.id,
          scoreBookLocked: true,
          scoreBookLockedAt: addDays(defenseDate, 1),
          scoreBookLockedById: adminUser.id,
        },
      });

      const memberIndices = councilLecturerMap[cIdx];
      const memberRoles = ['CHAIRMAN', 'SECRETARY', 'REVIEWER'];

      const councilMembersData = memberIndices.map((lecIdx, rIdx) => ({
        councilId: c.id,
        lecturerId: lecturerList[lecIdx].id,
        roleInCouncil: memberRoles[rIdx],
        isScoringMember: true,
        isActive: true,
      }));

      await prisma.councilMember.createMany({ data: councilMembersData });

      councils.push({
        id: c.id,
        memberLecturerIds: memberIndices.map((i) => lecturerList[i].id),
      });
    }

    // Gán defenseCouncilId vào TopicRegistration
    for (let idx = 0; idx < registrations.length; idx++) {
      const councilIndex = Math.floor(idx / 20); // 0..4
      const council = councils[councilIndex];
      await prisma.topicRegistration.update({
        where: { id: registrations[idx].id },
        data: {
          defenseCouncilId: council.id,
          status: 'COMPLETED',
        },
      });
    }

    // C. DefenseResult & DefenseMemberScores (Điểm từ 7.5 đến 9.8)
    const baseScores = [
      7.5, 7.8, 8.0, 8.2, 8.4, 8.5, 8.6, 8.8, 9.0, 9.1,
      9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 8.7, 8.9, 9.0,
    ];

    const defenseResultsData = [];
    const memberScoresData = [];
    const approvalData = [];

    for (let idx = 0; idx < registrations.length; idx++) {
      const reg = registrations[idx];
      const councilIndex = Math.floor(idx / 20);
      const council = councils[councilIndex];
      const scorePattern = baseScores[idx % baseScores.length];

      defenseResultsData.push({
        registrationId: reg.id,
        finalScore: scorePattern,
        rawAverageScore: scorePattern,
        roundedFinalScore: scorePattern,
        attendanceStatus: 'PRESENT',
        comments: 'Sinh viên trình bày tự tin, trả lời tốt câu hỏi phản biện của Hội đồng.',
        evaluatorId: council.memberLecturerIds[0],
        scoreRubricVersion: RUBRIC_VERSION,
        scoreLocked: true,
        lockedAt: addDays(defenseDate, 1),
        lockedBy: council.memberLecturerIds[0],
      });

      // 3 thành viên chấm
      const s1 = Math.round((scorePattern - 0.2) * 10) / 10;
      const s2 = scorePattern;
      const s3 = Math.round((scorePattern + 0.2) * 10) / 10;
      const memberScores = [s1, s2, s3];

      for (let m = 0; m < 3; m++) {
        memberScoresData.push({
          registrationId: reg.id,
          evaluatorId: council.memberLecturerIds[m],
          finalScore: memberScores[m],
          comments: 'Điểm đánh giá chính thức của thành viên hội đồng.',
          scoreRubricVersion: RUBRIC_VERSION,
          scoreLocked: true,
          lockedAt: addDays(defenseDate, 1),
          lockedBy: council.memberLecturerIds[m],
          isEffective: true,
        });
      }
    }

    for (const chunk of chunkArray(defenseResultsData, 50)) {
      await prisma.defenseResult.createMany({ data: chunk });
    }

    for (const chunk of chunkArray(memberScoresData, 50)) {
      await prisma.defenseMemberScore.createMany({ data: chunk });
    }

    const createdDefenseResults = await prisma.defenseResult.findMany({
      where: { registrationId: { in: registrations.map((r) => r.id) } },
    });
    const resultByRegId = new Map(createdDefenseResults.map((r) => [r.registrationId, r]));

    // D. Phê duyệt kết quả bảo vệ (DefenseResultApproval)
    for (let idx = 0; idx < registrations.length; idx++) {
      const reg = registrations[idx];
      const councilIndex = Math.floor(idx / 20);
      const council = councils[councilIndex];
      const dResult = resultByRegId.get(reg.id);

      approvalData.push({
        registrationId: reg.id,
        defenseResultId: dResult.id,
        outcome: 'PASSED',
        finalScoreSnapshot: dResult.finalScore,
        scoreFingerprint: checksum({ regId: reg.id, score: dResult.finalScore }),
        rubricVersionSnapshot: RUBRIC_VERSION,
        defenseCouncilId: council.id,
        policyVersionId: policyVersion.id,
        approvedById: adminUser.id,
        approvedAt: addDays(defenseDate, 2),
        isEffective: true,
        notes: 'Phê duyệt kết quả bảo vệ chính thức của Hội đồng.',
      });
    }

    for (const chunk of chunkArray(approvalData, 50)) {
      await prisma.defenseResultApproval.createMany({ data: chunk });
    }

    const createdApprovals = await prisma.defenseResultApproval.findMany({
      where: { registrationId: { in: registrations.map((r) => r.id) } },
    });
    const approvalByRegId = new Map(createdApprovals.map((a) => [a.registrationId, a]));

    // E. Công bố kết quả (ResultPublication & Items)
    const publication = await prisma.resultPublication.create({
      data: {
        semesterId: sem.id,
        type: 'INITIAL',
        publishedById: adminUser.id,
        publishedAt: addDays(defenseDate, 3),
        idempotencyKey: `publication-${sem.code}-initial`,
      },
    });

    const publicationItemsData = registrations.map((reg) => {
      const approval = approvalByRegId.get(reg.id);
      return {
        publicationId: publication.id,
        registrationId: reg.id,
        sourceApprovalId: approval.id,
        outcomeSnapshot: 'PASSED',
        finalScoreSnapshot: approval.finalScoreSnapshot,
        studentCodeSnapshot: reg.student.code,
        studentNameSnapshot: reg.student.fullName,
        topicTitleSnapshot: reg.topic.title,
      };
    });

    for (const chunk of chunkArray(publicationItemsData, 50)) {
      await prisma.resultPublicationItem.createMany({ data: chunk });
    }

    // F. Lưu chiểu (ProjectArchive) & ElectronicSignatureEvent
    const archivesData = registrations.map((reg, idx) => {
      const mentorIndex = Math.floor(idx / 5);
      const mentor = lecturerList[mentorIndex];
      const certNumber = `CN-DATN-${sem.code}-${String(idx + 1).padStart(4, '0')}`;

      return {
        registrationId: reg.id,
        reportFileUrl: `/uploads/archive/reg${reg.id}_report.pdf`,
        reportFileName: `Bao_cao_DATN_reg${reg.id}.pdf`,
        reportWordFileUrl: `/uploads/archive/reg${reg.id}_report.docx`,
        reportWordFileName: `Bao_cao_DATN_reg${reg.id}.docx`,
        reportPdfFileUrl: `/uploads/archive/reg${reg.id}_report.pdf`,
        reportPdfFileName: `Bao_cao_DATN_reg${reg.id}.pdf`,
        slideFileUrl: `/uploads/archive/reg${reg.id}_slide.pptx`,
        slideFileName: `Slide_thuyet_trinh_reg${reg.id}.pptx`,
        demoVideoUrl: `/uploads/archive/reg${reg.id}_demo.mp4`,
        phase: 'POST_DEFENSE',
        status: 'COMPLETED',
        mentorReviewStatus: 'APPROVED',
        mentorReviewedById: mentor.id,
        mentorReviewedAt: addDays(defenseDate, 7),
        mentorReviewNotes: 'Đã rà soát đầy đủ bản chỉnh sửa sau bảo vệ, đồng ý lưu chiểu.',
        academicAffairsReviewStatus: 'APPROVED',
        academicAffairsReviewedById: userByEmail.get('gv002@tdmu.edu.vn')?.id || adminUser.id,
        academicAffairsReviewedAt: addDays(defenseDate, 9),
        academicAffairsReviewNotes: 'Hồ sơ đạt chuẩn lưu chiểu của Viện.',
        certificateNumber: certNumber,
        certificateSignedById: lecturer01.id,
        certificateSignedAt: addDays(defenseDate, 12),
        certificatePdfUrl: `/uploads/certificates/reg${reg.id}_cert.pdf`,
        certificatePayloadHash: checksum({ certNumber, regId: reg.id }),
      };
    });

    for (const chunk of chunkArray(archivesData, 50)) {
      await prisma.projectArchive.createMany({ data: chunk });
    }

    const createdArchives = await prisma.projectArchive.findMany({
      where: { registrationId: { in: registrations.map((r) => r.id) } },
    });

    const sigEventsData = createdArchives.map((arc) => ({
      registrationId: arc.registrationId,
      entityType: 'CLEARANCE_CERTIFICATE',
      entityId: arc.id,
      versionNumber: 1,
      signerId: lecturer01.id,
      signerRole: 'VIEN_TRUONG',
      action: 'SIGN_CLEARANCE_CERTIFICATE',
      signedAt: arc.certificateSignedAt || addDays(defenseDate, 12),
      payloadHash: arc.certificatePayloadHash,
    }));

    for (const chunk of chunkArray(sigEventsData, 50)) {
      await prisma.electronicSignatureEvent.createMany({ data: chunk });
    }

    // G. Tạo DefenseDocumentVersion cho 4 loại file lưu chiểu
    const docVersionsData = [];
    const fileTypes = ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'];

    for (const arc of createdArchives) {
      for (const docType of fileTypes) {
        const ext = docType === 'REPORT_WORD' ? 'docx' : docType === 'REPORT_PDF' ? 'pdf' : docType === 'DEMO_VIDEO' ? 'mp4' : 'pptx';
        docVersionsData.push({
          registrationId: arc.registrationId,
          archiveId: arc.id,
          documentType: docType,
          versionNumber: 1,
          phase: 'POST_DEFENSE',
          fileUrl: `/uploads/archive/reg${arc.registrationId}_${docType.toLowerCase()}.${ext}`,
          fileName: `${docType}_reg${arc.registrationId}.${ext}`,
          checksum: checksum(`${arc.registrationId}:${docType}:v1`),
          isLatePreDefense: false,
          uploadedById: registrations.find((r) => r.id === arc.registrationId)?.studentId || adminUser.id,
          uploadedAt: addDays(defenseDate, 5),
        });
      }
    }

    for (const chunk of chunkArray(docVersionsData, 50)) {
      await prisma.defenseDocumentVersion.createMany({ data: chunk });
    }
  }

  // 8. Xác thực & Thống kê
  console.log('[seed:3semesters] Bước 8/8: Xác thực dữ liệu và in báo cáo tổng kết...');
  const userCount = await prisma.user.count();
  const lecturerCount = await prisma.user.count({ where: { role: 'LECTURER' } });
  const studentCount = await prisma.user.count({ where: { role: 'STUDENT' } });
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  const semesterCount = await prisma.semester.count();
  const topicCount = await prisma.topic.count();
  const regCount = await prisma.topicRegistration.count();
  const decisionCount = await prisma.topicAssignmentDecision.count();
  const stopReviewCount = await prisma.instituteStopReview.count();
  const archiveCount = await prisma.projectArchive.count();
  const studentPermCount = await prisma.userPermissionGroup.count({
    where: { user: { role: 'STUDENT' } },
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n======================================================`);
  console.log(`🎉 SEED THÀNH CÔNG BỘ DỮ LIỆU 3 ĐỢT ĐỒ ÁN (${durationSec}s)!`);
  console.log(`======================================================`);
  console.table({
    'Tổng Users': userCount,
    'Admin': adminCount,
    'Giảng viên (LECTURER)': lecturerCount,
    'Sinh viên (STUDENT)': studentCount,
    'StudentProfiles': await prisma.studentProfile.count(),
    'Quyền gán cho Sinh viên (Yêu cầu = 0)': studentPermCount,
    'Semesters': semesterCount,
    'Đề tài (Topics)': topicCount,
    'TopicRegistrations': regCount,
    'Quyết định giao ĐT': decisionCount,
    'Hồ sơ Đợt 3 dừng (STOP_REVIEW_PENDING)': stopReviewCount,
    'Hồ sơ Đợt 1 & 2 hoàn thành (COMPLETED)': archiveCount,
  });

  return {
    userCount,
    lecturerCount,
    studentCount,
    adminCount,
    semesterCount,
    topicCount,
    regCount,
    decisionCount,
    stopReviewCount,
    archiveCount,
    studentPermCount,
  };
}

if (require.main === module) {
  runThreeSemestersSeed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[seed:3semesters] FAILED:', error);
      process.exit(1);
    });
}

module.exports = { runThreeSemestersSeed };
