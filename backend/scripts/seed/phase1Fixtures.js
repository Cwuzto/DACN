const { DEFAULT_POLICY, checksum } = require('../../src/services/workflowPolicyService');
const { buildAccounts, getSemesterDefinitions } = require('./demoFixtures');

const RUBRIC_VERSION = 'RUBRIC-DATN-2026';
const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (base, days) => new Date(base.getTime() + days * DAY_MS);

function createRange(start, end) {
  const count = end - start + 1;
  const studentNumbers = Array.from({ length: count }, (_, idx) => start + idx);
  return Object.freeze({
    start,
    end,
    count,
    studentNumbers,
    includes(num) {
      return num >= start && num <= end;
    },
  });
}

const PHASE1_COHORTS = Object.freeze({
  HK2_UNREGISTERED: createRange(1, 15),
  HK2_PENDING_APPROVAL: createRange(16, 30),
  HK1_APPROVED_OPEN_BM01: createRange(31, 45),
  HK1_BM01_SUBMITTED_UNASSIGNED: createRange(46, 60),
  HK1_BM01_ASSIGNED_COUNCIL: createRange(61, 75),
  HK1_BM01_NEEDS_REVISION: createRange(76, 90),
  HK1_BM01_RESUBMITTED_V2: createRange(91, 105),
  HK1_BM01_PASSED: createRange(106, 120),
});

const MAJORS = [
  'Công nghệ thông tin',
  'Kỹ thuật phần mềm',
  'An toàn thông tin',
  'Khoa học dữ liệu',
];

const PLACES_OF_BIRTH = [
  'TP. Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Cần Thơ',
  'Đồng Nai',
  'Bình Dương',
  'Khánh Hòa',
  'Thừa Thiên Huế',
];

function buildStudentProfileData(studentNumber, studentUser = {}) {
  const idx = studentNumber - 1;
  const padStr = String(studentNumber).padStart(3, '0');
  const studentCode = studentUser.code || `2200${padStr}`;
  const fullName = studentUser.fullName || `Sinh viên ${padStr}`;
  const email = studentUser.email || `sv${padStr}@university.edu.vn`;
  const gender = studentNumber % 2 === 0 ? 'FEMALE' : 'MALE';
  const year = 2004;
  const month = (idx % 12);
  const day = ((idx * 3) % 27) + 1;
  const dateOfBirth = new Date(Date.UTC(year, month, day));
  const classIndex = (idx % 4) + 1;
  const className = `D22CQCN0${classIndex}-N`;
  const major = MAJORS[idx % MAJORS.length];
  const placeOfBirth = PLACES_OF_BIRTH[idx % PLACES_OF_BIRTH.length];
  const cohort = 'D22';

  return {
    studentId: studentCode,
    fullName,
    gender,
    dateOfBirth,
    placeOfBirth,
    className,
    cohort,
    major,
    dbProfile: {
      studentId: studentUser.id || studentNumber,
      gender,
      dateOfBirth,
      className,
      major,
    },
    snapshot: {
      id: studentUser.id || studentNumber,
      studentCode,
      fullName,
      gender,
      dateOfBirth: dateOfBirth.toISOString().split('T')[0],
      placeOfBirth,
      className,
      cohort,
      major,
      email,
      phone: studentUser.phone || `0912000${padStr}`,
    },
  };
}

const TOPIC_TITLES_PREFIX = [
  'Nghiên cứu và xây dựng hệ thống quản lý học vụ thông minh ứng dụng AI',
  'Phát triển nền tảng giám sát an ninh mạng thời gian thực bằng học sâu',
  'Xây dựng kiến trúc Microservices cho hệ thống thương mại điện tử đa kênh',
  'Ứng dụng mô hình ngôn ngữ lớn (LLM) trong hỗ trợ tư vấn quy chế đào tạo',
  'Thiết kế hệ thống phân tích dữ liệu lớn dự báo nhu cầu chuỗi cung ứng',
  'Xây dựng ứng dụng xác thực chữ ký điện tử và quản lý văn bản số học thuật',
  'Phát triển hệ thống gợi ý lộ trình học tập cá nhân hóa dựa trên Knowledge Graph',
  'Nghiên cứu giải pháp phát hiện bất thường trong giao dịch tài chính số',
  'Xây dựng nền tảng quản lý tiến độ đồ án tốt nghiệp tích hợp kiểm thử tự động',
  'Ứng dụng thị giác máy tính trong nhận diện và số hóa tài liệu lưu trữ',
  'Phát triển hệ thống điều phối tác vụ đám mây tối ưu hóa năng lượng',
  'Xây dựng cổng thông tin học thuật trực tuyến hỗ trợ đánh giá chuẩn đầu ra',
];

function buildTopicTitleForStudent(number) {
  const padStr = String(number).padStart(3, '0');
  const baseTitle = TOPIC_TITLES_PREFIX[(number - 1) % TOPIC_TITLES_PREFIX.length];
  return `${baseTitle} (Mã đề tài DT-${padStr})`;
}

async function seedPhase1AcademicFixtures({ prisma, accountsByEmail, baseDate = new Date() }) {
  const referenceDate = baseDate instanceof Date ? new Date(baseDate.getTime()) : new Date(baseDate);
  const semesterDefs = getSemesterDefinitions(referenceDate);

  const admin = accountsByEmail.get('admin@university.edu.vn');
  const lecturer01 = accountsByEmail.get('lecturer01@university.edu.vn');
  const lecturer02 = accountsByEmail.get('lecturer02@university.edu.vn');
  const lecturer03 = accountsByEmail.get('lecturer03@university.edu.vn');

  // 1. Create 2 Semesters (HK1 active for outline review, HK2 open for topic registration)
  const semesterHK1Record = await prisma.semester.create({
    data: {
      ...semesterDefs.semesterHK1,
      status: 'ONGOING',
      outlineSubmissionOpenAt: addDays(referenceDate, -20),
      outlineSubmissionDeadline: addDays(referenceDate, 14),
      outlineAllowedExtensions: ['.docx', '.pdf'],
      outlineMaxFileSizeBytes: 20971520,
    },
  });

  const semesterHK2Record = await prisma.semester.create({
    data: {
      ...semesterDefs.semesterHK2,
      status: 'REGISTRATION',
      registrationOpen: true,
      outlineSubmissionOpenAt: addDays(referenceDate, 15),
      outlineSubmissionDeadline: addDays(referenceDate, 35),
      outlineAllowedExtensions: ['.docx', '.pdf'],
      outlineMaxFileSizeBytes: 20971520,
    },
  });

  // 2. Workflow Policy Versions & Lock on Semesters
  const policyHK1 = await prisma.periodWorkflowPolicyVersion.create({
    data: {
      semesterId: semesterHK1Record.id,
      version: 1,
      policy: DEFAULT_POLICY,
      checksum: checksum(DEFAULT_POLICY),
      createdById: admin.id,
    },
  });

  const policyHK2 = await prisma.periodWorkflowPolicyVersion.create({
    data: {
      semesterId: semesterHK2Record.id,
      version: 1,
      policy: DEFAULT_POLICY,
      checksum: checksum(DEFAULT_POLICY),
      createdById: admin.id,
    },
  });

  await prisma.semester.update({
    where: { id: semesterHK1Record.id },
    data: { lockedPolicyVersionId: policyHK1.id },
  });
  await prisma.semester.update({
    where: { id: semesterHK2Record.id },
    data: { lockedPolicyVersionId: policyHK2.id },
  });

  // 3. Project Catalog
  const catalog = await prisma.projectCatalog.create({
    data: {
      code: 'DATN',
      name: 'Đồ án tốt nghiệp',
      isActive: true,
    },
  });

  // 4. Standardized Rubric with 3 categories and 6 criteria
  const rubric = await prisma.rubricVersion.create({
    data: {
      version: RUBRIC_VERSION,
      title: 'Rubric đánh giá đồ án tốt nghiệp chuẩn',
      totalMaxScore: 10.0,
      isActive: true,
      status: 'ACTIVE',
      createdById: admin.id,
      categories: {
        create: [
          {
            code: 'HINH_THUC',
            name: 'Hình thức và cấu trúc báo cáo',
            maxScore: 2.0,
            orderIndex: 1,
            criteria: {
              create: [
                { code: 'DINH_DANG', label: 'Định dạng và quy chuẩn trình bày', maxScore: 1.0, orderIndex: 1 },
                { code: 'TAI_LIEU', label: 'Cấu trúc và tài liệu tham khảo', maxScore: 1.0, orderIndex: 2 },
              ],
            },
          },
          {
            code: 'NOI_DUNG',
            name: 'Nội dung nghiên cứu và sản phẩm thực nghiệm',
            maxScore: 5.0,
            orderIndex: 2,
            criteria: {
              create: [
                { code: 'GIAI_PHAP', label: 'Phương pháp và giải pháp kỹ thuật', maxScore: 2.5, orderIndex: 1 },
                { code: 'SAN_PHAM', label: 'Mức độ hoàn thiện sản phẩm', maxScore: 2.5, orderIndex: 2 },
              ],
            },
          },
          {
            code: 'BAO_VE',
            name: 'Kỹ năng thuyết trình và phản biện',
            maxScore: 3.0,
            orderIndex: 3,
            criteria: {
              create: [
                { code: 'THUYET_TRINH', label: 'Kỹ năng thuyết trình và báo cáo', maxScore: 1.5, orderIndex: 1 },
                { code: 'PHAN_BIEN', label: 'Khả năng phản biện và trả lời câu hỏi', maxScore: 1.5, orderIndex: 2 },
              ],
            },
          },
        ],
      },
    },
  });

  // 5. Academic Delegations
  const delegationOutlineActive = await prisma.academicDelegation.create({
    data: {
      delegatorId: lecturer01.id,
      delegateeId: lecturer02.id,
      capabilityCode: 'OUTLINE_REVIEW',
      department: 'Viện Công nghệ số',
      semesterId: semesterHK1Record.id,
      effectiveFrom: addDays(referenceDate, -15),
      effectiveTo: addDays(referenceDate, 60),
      reason: 'Ủy quyền phụ trách bộ môn rà soát và thẩm định đề cương BM01 Học kỳ 1',
      idempotencyKey: 'phase1-delegation-outline-01',
      status: 'ACTIVE',
    },
  });

  const delegationBm02Active = await prisma.academicDelegation.create({
    data: {
      delegatorId: lecturer01.id,
      delegateeId: lecturer02.id,
      capabilityCode: 'BM02_REVIEW',
      department: 'Viện Công nghệ số',
      semesterId: semesterHK1Record.id,
      effectiveFrom: addDays(referenceDate, -15),
      effectiveTo: addDays(referenceDate, 60),
      reason: 'Ủy quyền thẩm định đơn đăng ký đề tài BM02 Học kỳ 1',
      idempotencyKey: 'phase1-delegation-bm02-02',
      status: 'ACTIVE',
    },
  });

  const delegationExpired = await prisma.academicDelegation.create({
    data: {
      delegatorId: lecturer01.id,
      delegateeId: lecturer03.id,
      capabilityCode: 'OUTLINE_REVIEW',
      department: 'Viện Công nghệ số',
      semesterId: semesterHK1Record.id,
      effectiveFrom: addDays(referenceDate, -90),
      effectiveTo: addDays(referenceDate, -10),
      reason: 'Ủy quyền thẩm định đề cương đợt sớm Học kỳ 1 (Đã hết hạn)',
      idempotencyKey: 'phase1-delegation-expired-03',
      status: 'ACTIVE',
    },
  });

  // 6. Public Announcements
  await prisma.publicAnnouncement.createMany({
    data: [
      {
        title: 'Thông báo mở đăng ký đề tài tốt nghiệp Học kỳ 2 năm học 2026–2027',
        content: 'Sinh viên thuộc đợt Học kỳ 2 thực hiện đăng ký đề tài có sẵn từ danh mục hoặc đề xuất đề tài mới với Giảng viên hướng dẫn.',
        category: 'REGISTRATION',
        isPublished: true,
        isPinned: true,
        authorId: admin.id,
      },
      {
        title: 'Lịch trình nộp và xét duyệt đề cương BM01 Học kỳ 1',
        content: 'Sinh viên đã được GVHD duyệt đề tài thực hiện nộp đề cương BM01 lần 1 và theo dõi kết quả xét duyệt của Hội đồng.',
        category: 'ACADEMIC',
        isPublished: true,
        isPinned: true,
        authorId: admin.id,
      },
    ],
  });

  // 7. Lecturer Project Assignments (12 lecturers x 2 semesters, quota 10 SV/GV)
  const lecturers = [...accountsByEmail.values()]
    .filter((u) => u.role === 'LECTURER')
    .sort((a, b) => a.email.localeCompare(b.email));

  const lecturerAssignmentsData = [];
  for (const sem of [semesterHK1Record, semesterHK2Record]) {
    for (const lect of lecturers) {
      lecturerAssignmentsData.push({
        lecturerId: lect.id,
        semesterId: sem.id,
        projectCatalogId: catalog.id,
        plannedQuota: 10,
        status: 'ACTIVE',
        assignedById: admin.id,
      });
    }
  }
  await prisma.lecturerProjectAssignment.createMany({ data: lecturerAssignmentsData });

  // 8. Student Profiles for all 120 students
  const students = [...accountsByEmail.values()]
    .filter((u) => u.role === 'STUDENT')
    .sort((a, b) => a.email.localeCompare(b.email));

  const profileRows = [];
  const studentSnapshots = new Map();
  for (let number = 1; number <= 120; number += 1) {
    const student = students[number - 1];
    const { dbProfile, snapshot } = buildStudentProfileData(number, student);
    profileRows.push(dbProfile);
    studentSnapshots.set(number, snapshot);
  }
  await prisma.studentProfile.createMany({ data: profileRows });

  // 9. Create 4 Outline Review Councils in HK1 (disjoint lecturer triples for Zero-COI)
  // Council 1: lecturer01 (CHAIRMAN), lecturer02 (SECRETARY), lecturer03 (REVIEWER)
  // Council 2: lecturer04 (CHAIRMAN), lecturer05 (SECRETARY), lecturer06 (REVIEWER)
  // Council 3: lecturer07 (CHAIRMAN), lecturer08 (SECRETARY), lecturer09 (REVIEWER)
  // Council 4: lecturer10 (CHAIRMAN), lecturer11 (SECRETARY), lecturer12 (REVIEWER)
  const outlineCouncils = [];
  for (let cIdx = 0; cIdx < 4; cIdx += 1) {
    const members = lecturers.slice(cIdx * 3, cIdx * 3 + 3);
    const council = await prisma.council.create({
      data: {
        semesterId: semesterHK1Record.id,
        name: `Hội đồng Xét duyệt Đề cương ${cIdx + 1}`,
        councilType: 'OUTLINE_REVIEW',
        location: `Phòng A10${cIdx + 1}`,
        defenseDate: addDays(referenceDate, 20),
        meetingMode: 'IN_PERSON',
        schedulePublishedAt: addDays(referenceDate, -2),
        revisionSubmissionDeadline: addDays(referenceDate, 7),
      },
    });
    await prisma.councilMember.createMany({
      data: [
        { councilId: council.id, lecturerId: members[0].id, roleInCouncil: 'CHAIRMAN' },
        { councilId: council.id, lecturerId: members[1].id, roleInCouncil: 'SECRETARY' },
        { councilId: council.id, lecturerId: members[2].id, roleInCouncil: 'REVIEWER' },
      ],
    });
    outlineCouncils.push({
      id: council.id,
      name: council.name,
      chair: members[0],
      secretary: members[1],
      reviewer: members[2],
      memberIds: members.map((m) => m.id),
    });
  }

  // Council 1 Batch: DRAFT (for sv061-sv068: Thư ký đang nhập nháp và chuẩn bị bấm Hoàn tất rà soát)
  const batchCouncil1Draft = await prisma.councilResultBatch.create({
    data: {
      councilId: outlineCouncils[0].id,
      versionNumber: 1,
      status: 'DRAFT',
    },
  });

  // Council 2 Batch: PENDING_CHAIR (for sv069-sv075: Thư ký đã hoàn tất rà soát, chờ Chủ tịch công bố)
  const batchCouncil2PendingChair = await prisma.councilResultBatch.create({
    data: {
      councilId: outlineCouncils[1].id,
      versionNumber: 1,
      status: 'PENDING_CHAIR',
      secretaryCompletedAt: addDays(referenceDate, -1),
      secretaryCompletedById: outlineCouncils[1].secretary.id,
    },
  });

  // Council 3 Batch: PUBLISHED (for sv076-sv090 Needs Revision & sv091-sv105 Resubmitted v2)
  const batchCouncil3Published = await prisma.councilResultBatch.create({
    data: {
      councilId: outlineCouncils[2].id,
      versionNumber: 1,
      status: 'PUBLISHED',
      secretaryCompletedAt: addDays(referenceDate, -6),
      secretaryCompletedById: outlineCouncils[2].secretary.id,
      chairPublishedAt: addDays(referenceDate, -5),
      chairPublishedById: outlineCouncils[2].chair.id,
    },
  });

  // Council 4 Batch: PUBLISHED (for sv106-sv120 BM01_PASSED — ready for Reopen or Phase 2 transition)
  const batchCouncil4Published = await prisma.councilResultBatch.create({
    data: {
      councilId: outlineCouncils[3].id,
      versionNumber: 1,
      status: 'PUBLISHED',
      secretaryCompletedAt: addDays(referenceDate, -6),
      secretaryCompletedById: outlineCouncils[3].secretary.id,
      chairPublishedAt: addDays(referenceDate, -5),
      chairPublishedById: outlineCouncils[3].chair.id,
    },
  });

  // Helper to pick a mentor in HK1 that guarantees Zero-COI with assigned outline council AND keeps <= 8 SV/mentor
  // Let's pre-calculate deterministic mentor assignments for sv031..sv120 (90 students across 12 lecturers: 6x8 + 6x7 = 90)
  // such that:
  // - sv061..sv068 (Council 1: lecturers 1,2,3) have mentors from {4..11}
  // - sv069..sv075 (Council 2: lecturers 4,5,6) have mentors from {7..12, 1}
  // - sv076..sv090 & sv091..sv105 (Council 3: lecturers 7,8,9) have mentors from {1..6, 10..12}
  // - sv106..sv120 (Council 4: lecturers 10,11,12) have mentors from {1..9}
  const hk1MentorLoad = new Map(lecturers.map((l) => [l.id, 0]));
  const pickZeroCoiMentor = (excludedIds = []) => {
    const excluded = new Set(excludedIds);
    const eligible = lecturers
      .filter((l) => !excluded.has(l.id) && (hk1MentorLoad.get(l.id) || 0) < 8)
      .sort((a, b) => {
        const diff = (hk1MentorLoad.get(a.id) || 0) - (hk1MentorLoad.get(b.id) || 0);
        return diff !== 0 ? diff : a.id - b.id;
      });
    const chosen = eligible[0];
    hk1MentorLoad.set(chosen.id, (hk1MentorLoad.get(chosen.id) || 0) + 1);
    return chosen;
  };

  // Pre-assign mentors for cohorts with fixed councils first so they never hit excluded lecturers
  const hk1MentorByStudent = new Map();
  for (let num = 61; num <= 68; num += 1) {
    hk1MentorByStudent.set(num, pickZeroCoiMentor(outlineCouncils[0].memberIds));
  }
  for (let num = 69; num <= 75; num += 1) {
    hk1MentorByStudent.set(num, pickZeroCoiMentor(outlineCouncils[1].memberIds));
  }
  for (let num = 76; num <= 105; num += 1) {
    hk1MentorByStudent.set(num, pickZeroCoiMentor(outlineCouncils[2].memberIds));
  }
  for (let num = 106; num <= 120; num += 1) {
    hk1MentorByStudent.set(num, pickZeroCoiMentor(outlineCouncils[3].memberIds));
  }
  for (let num = 31; num <= 60; num += 1) {
    hk1MentorByStudent.set(num, pickZeroCoiMentor([]));
  }

  const registrations = new Map();

  // --- COHORT 1: sv001 – sv015 (HK2) Chưa đăng ký đề tài ---
  for (let number = 1; number <= 15; number += 1) {
    const student = students[number - 1];
    await prisma.studentProjectEnrollment.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK2Record.id,
        projectCatalogId: catalog.id,
        status: 'ACTIVE',
        source: 'SEED',
      },
    });
  }

  // Seed 15 open topics in HK2 (available for sv001-sv015 to register)
  for (let i = 1; i <= 15; i += 1) {
    const mentor = lecturers[(i - 1) % 12];
    await prisma.topic.create({
      data: {
        semesterId: semesterHK2Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: `Đề tài gợi ý HK2 #${String(i).padStart(2, '0')} — ${TOPIC_TITLES_PREFIX[(i - 1) % TOPIC_TITLES_PREFIX.length]}`,
        description: 'Đề tài mở sẵn sàng tiếp nhận sinh viên đăng ký trong đợt Đồ án tốt nghiệp HK2 2026–2027.',
        status: 'APPROVED',
      },
    });
  }

  // --- COHORT 2: sv016 – sv030 (HK2) Đã đăng ký đề tài, trạng thái PENDING ---
  for (let number = 16; number <= 30; number += 1) {
    const student = students[number - 1];
    const mentor = lecturers[(number - 16) % 12];
    const padStr = String(number).padStart(3, '0');

    await prisma.studentProjectEnrollment.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK2Record.id,
        projectCatalogId: catalog.id,
        status: 'ACTIVE',
        source: 'SEED',
      },
    });

    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK2Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: student.id,
        maxStudents: 1,
        title: buildTopicTitleForStudent(number),
        description: `Đề tài đăng ký nguyện vọng của sinh viên ${padStr}, đang chờ GVHD xét duyệt.`,
        status: 'PENDING',
      },
    });

    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK2Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK2.id,
        status: 'PENDING',
        outlineReviewStatus: 'PENDING',
        stateVersion: 1,
      },
    });

    await prisma.registrationStateHistory.create({
      data: {
        registrationId: registration.id,
        fromStatus: 'REGISTERED',
        toStatus: 'PENDING',
        fromStateVersion: 0,
        toStateVersion: 1,
        actorId: student.id,
        reason: 'Sinh viên gửi đăng ký đề tài chờ GVHD xét duyệt',
        idempotencyKey: `phase1-reg-history-${number}`,
      },
    });

    registrations.set(number, { ...registration, student, topic, mentor });
  }

  // --- COHORT 3: sv031 – sv045 (HK1) Đã được GVHD duyệt (APPROVED), Task BM01 đang OPEN ---
  for (let number = 31; number <= 45; number += 1) {
    const student = students[number - 1];
    const mentor = hk1MentorByStudent.get(number);
    const padStr = String(number).padStart(3, '0');

    await prisma.studentProjectEnrollment.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        status: 'ACTIVE',
        source: 'SEED',
      },
    });

    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: buildTopicTitleForStudent(number),
        description: `Đề tài đã được GVHD phê duyệt cho sinh viên ${padStr}, sẵn sàng nộp đề cương BM01 v1.`,
        status: 'APPROVED',
      },
    });

    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK1.id,
        status: 'APPROVED',
        outlineReviewStatus: 'PENDING',
        stateVersion: 1,
      },
    });

    await prisma.task.createMany({
      data: [
        {
          registrationId: registration.id,
          title: 'Nộp đề cương đồ án tốt nghiệp (BM01)',
          content: 'Sinh viên tải biểu mẫu BM01, hoàn thiện đề cương chi tiết và nộp bản v1 đúng hạn.',
          taskType: 'BM01_INITIAL_SUBMISSION',
          dueDate: addDays(referenceDate, 14),
          status: 'OPEN',
        },
        {
          registrationId: registration.id,
          title: 'BM01 - Đề cương chi tiết đồ án',
          content: 'Nộp đề cương chi tiết đồ án gồm mục tiêu, phạm vi nghiên cứu và kế hoạch thực hiện.',
          taskType: 'BM01',
          dueDate: addDays(referenceDate, 14),
          status: 'OPEN',
        },
      ],
    });

    registrations.set(number, { ...registration, student, topic, mentor });
  }

  // --- COHORT 4: sv046 – sv060 (HK1) Đã nộp đề cương v1 (BM01_SUBMITTED), chưa gán hội đồng (outlineCouncilId = null) ---
  for (let number = 46; number <= 60; number += 1) {
    const student = students[number - 1];
    const mentor = hk1MentorByStudent.get(number);
    const padStr = String(number).padStart(3, '0');

    await prisma.studentProjectEnrollment.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        status: 'ACTIVE',
        source: 'SEED',
      },
    });

    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: buildTopicTitleForStudent(number),
        description: `Đề tài đã nộp đề cương BM01 v1 của sinh viên ${padStr}, chờ phân công hội đồng xét duyệt.`,
        status: 'APPROVED',
      },
    });

    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK1.id,
        status: 'BM01_SUBMITTED',
        outlineReviewStatus: 'PENDING',
        outlineCouncilId: null,
        stateVersion: 1,
      },
    });

    const taskV1 = await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: 'Nộp đề cương đồ án tốt nghiệp (BM01)',
        content: 'Đã nộp bản đề cương BM01 lần 1.',
        taskType: 'BM01_INITIAL_SUBMISSION',
        dueDate: addDays(referenceDate, 14),
        status: 'COMPLETED',
      },
    });

    const subV1 = await prisma.submission.create({
      data: {
        registrationId: registration.id,
        taskId: taskV1.id,
        submittedBy: student.id,
        content: `Bản nộp đề cương BM01 lần 1 của sinh viên ${student.fullName}`,
        fileUrl: `/uploads/demo/bm01/BM01_v1_SV${padStr}.pdf`,
        fileName: `BM01_v1_SV${padStr}.pdf`,
        submittedAt: addDays(referenceDate, -3),
      },
    });

    await prisma.bM01Evaluation.create({
      data: {
        registrationId: registration.id,
        attemptNo: 1,
        submissionId: subV1.id,
        submittedAt: addDays(referenceDate, -3),
        submittedById: student.id,
        policyVersionId: policyHK1.id,
        councilId: null,
        batchId: null,
      },
    });

    registrations.set(number, { ...registration, student, topic, mentor });
  }

  // --- COHORT 5: sv061 – sv075 (HK1) Đã nộp đề cương v1 và đã gán vào Hội đồng Xét duyệt Đề cương 1 & 2 ---
  for (let number = 61; number <= 75; number += 1) {
    const student = students[number - 1];
    const mentor = hk1MentorByStudent.get(number);
    const padStr = String(number).padStart(3, '0');
    const isCouncil1 = number <= 68;
    const assignedCouncil = isCouncil1 ? outlineCouncils[0] : outlineCouncils[1];
    const assignedBatch = isCouncil1 ? batchCouncil1Draft : batchCouncil2PendingChair;

    await prisma.studentProjectEnrollment.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        status: 'ACTIVE',
        source: 'SEED',
      },
    });

    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: buildTopicTitleForStudent(number),
        description: `Đề tài của sinh viên ${padStr} đã phân vào ${assignedCouncil.name}.`,
        status: 'APPROVED',
      },
    });

    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK1.id,
        status: 'BM01_SUBMITTED',
        outlineReviewStatus: 'PENDING',
        outlineCouncilId: assignedCouncil.id,
        stateVersion: 1,
      },
    });

    const taskV1 = await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: 'Nộp đề cương đồ án tốt nghiệp (BM01)',
        content: 'Đã nộp bản đề cương BM01 lần 1.',
        taskType: 'BM01_INITIAL_SUBMISSION',
        dueDate: addDays(referenceDate, 14),
        status: 'COMPLETED',
      },
    });

    const subV1 = await prisma.submission.create({
      data: {
        registrationId: registration.id,
        taskId: taskV1.id,
        submittedBy: student.id,
        content: `Bản nộp đề cương BM01 lần 1 của sinh viên ${student.fullName}`,
        fileUrl: `/uploads/demo/bm01/BM01_v1_SV${padStr}.pdf`,
        fileName: `BM01_v1_SV${padStr}.pdf`,
        submittedAt: addDays(referenceDate, -4),
      },
    });

    // In Council 1 (sv061-sv068): prefill draft outcomes so Secretary can test editing or immediately click "Hoàn tất rà soát"
    // In Council 2 (sv069-sv075): Secretary has completed review (PENDING_CHAIR), ready for Chair to click "Công bố kết quả"
    const isRevisionDraft = number % 3 === 0;
    await prisma.bM01Evaluation.create({
      data: {
        registrationId: registration.id,
        attemptNo: 1,
        submissionId: subV1.id,
        submittedAt: addDays(referenceDate, -4),
        submittedById: student.id,
        policyVersionId: policyHK1.id,
        councilId: assignedCouncil.id,
        batchId: assignedBatch.id,
        initialOutcome: isRevisionDraft ? 'REVISION_REQUIRED' : 'PASS',
        attendanceStatus: 'PRESENT',
        comment: isRevisionDraft
          ? 'Đề cương cần làm rõ hơn phương pháp đánh giá thực nghiệm.'
          : 'Đề cương trình bày rõ ràng, mục tiêu và phạm vi phù hợp chuẩn đầu ra.',
        revisionRequirements: isRevisionDraft
          ? 'Bổ sung chương mô tả kiến trúc hệ thống và kịch bản kiểm thử.'
          : null,
        reviewedById: assignedCouncil.secretary.id,
        reviewedAt: addDays(referenceDate, -1),
      },
    });

    registrations.set(number, { ...registration, student, topic, mentor });
  }

  // --- COHORT 6: sv076 – sv090 (HK1) Hội đồng đã công bố Yêu cầu sửa đổi (BM01_NEEDS_REVISION) ---
  for (let number = 76; number <= 90; number += 1) {
    const student = students[number - 1];
    const mentor = hk1MentorByStudent.get(number);
    const padStr = String(number).padStart(3, '0');
    const assignedCouncil = outlineCouncils[2];

    await prisma.studentProjectEnrollment.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        status: 'ACTIVE',
        source: 'SEED',
      },
    });

    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: buildTopicTitleForStudent(number),
        description: `Đề tài của sinh viên ${padStr} được Hội đồng yêu cầu chỉnh sửa đề cương BM01.`,
        status: 'APPROVED',
      },
    });

    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK1.id,
        status: 'BM01_NEEDS_REVISION',
        outlineReviewStatus: 'REVISION_REQUIRED',
        outlineFeedback: 'Bổ sung sơ đồ kiến trúc tổng thể, thiết kế cơ sở dữ liệu và kế hoạch thực hiện chi tiết theo tuần.',
        outlineCouncilId: assignedCouncil.id,
        stateVersion: 2,
      },
    });

    const taskV1 = await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: 'Nộp đề cương đồ án tốt nghiệp (BM01)',
        content: 'Đã nộp bản đề cương BM01 lần 1.',
        taskType: 'BM01_INITIAL_SUBMISSION',
        dueDate: addDays(referenceDate, -5),
        status: 'COMPLETED',
      },
    });

    const subV1 = await prisma.submission.create({
      data: {
        registrationId: registration.id,
        taskId: taskV1.id,
        submittedBy: student.id,
        content: `Bản nộp đề cương BM01 lần 1 của sinh viên ${student.fullName}`,
        fileUrl: `/uploads/demo/bm01/BM01_v1_SV${padStr}.pdf`,
        fileName: `BM01_v1_SV${padStr}.pdf`,
        submittedAt: addDays(referenceDate, -7),
      },
    });

    await prisma.bM01Evaluation.create({
      data: {
        registrationId: registration.id,
        attemptNo: 1,
        submissionId: subV1.id,
        submittedAt: addDays(referenceDate, -7),
        submittedById: student.id,
        policyVersionId: policyHK1.id,
        councilId: assignedCouncil.id,
        batchId: batchCouncil3Published.id,
        initialOutcome: 'REVISION_REQUIRED',
        outcome: 'NEEDS_REVISION',
        attendanceStatus: 'PRESENT',
        comment: 'Cần làm rõ phạm vi kỹ thuật và phương pháp đánh giá.',
        revisionRequirements: 'Bổ sung sơ đồ kiến trúc tổng thể, thiết kế cơ sở dữ liệu và kế hoạch thực hiện chi tiết theo tuần.',
        revisionApprovalStatus: 'PENDING',
        deadlineAt: addDays(referenceDate, 7),
        reviewedById: assignedCouncil.secretary.id,
        reviewedAt: addDays(referenceDate, -5),
      },
    });

    await prisma.task.createMany({
      data: [
        {
          registrationId: registration.id,
          title: 'Nộp lại đề cương đồ án tốt nghiệp (BM01 v2)',
          content: 'Chỉnh sửa đề cương theo yêu cầu của Hội đồng xét duyệt và nộp lại trước thời hạn.',
          taskType: 'BM01_RESUBMISSION',
          dueDate: addDays(referenceDate, 7),
          status: 'OPEN',
        },
        {
          registrationId: registration.id,
          title: 'BM01 - Đề cương chi tiết đồ án',
          content: 'Cập nhật lại đề cương theo yêu cầu sửa đổi của hội đồng.',
          taskType: 'BM01',
          dueDate: addDays(referenceDate, 7),
          status: 'REVISION',
        },
      ],
    });

    registrations.set(number, { ...registration, student, topic, mentor });
  }

  // --- COHORT 7: sv091 – sv105 (HK1) Sinh viên đã nộp lại đề cương BM01 v2 (BM01_RESUBMITTED) ---
  for (let number = 91; number <= 105; number += 1) {
    const student = students[number - 1];
    const mentor = hk1MentorByStudent.get(number);
    const padStr = String(number).padStart(3, '0');
    const assignedCouncil = outlineCouncils[2];

    await prisma.studentProjectEnrollment.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        status: 'ACTIVE',
        source: 'SEED',
      },
    });

    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: buildTopicTitleForStudent(number),
        description: `Đề tài của sinh viên ${padStr} đã nộp lại đề cương BM01 v2, chờ Chủ tịch hội đồng thẩm định.`,
        status: 'APPROVED',
      },
    });

    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK1.id,
        status: 'BM01_RESUBMITTED',
        outlineReviewStatus: 'REVISION_REQUIRED',
        outlineFeedback: 'Đã nộp bản chỉnh sửa đề cương v2, chờ Chủ tịch Hội đồng xét duyệt.',
        outlineCouncilId: assignedCouncil.id,
        stateVersion: 3,
      },
    });

    const taskV1 = await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: 'Nộp đề cương đồ án tốt nghiệp (BM01)',
        content: 'Đã nộp bản đề cương BM01 lần 1.',
        taskType: 'BM01_INITIAL_SUBMISSION',
        dueDate: addDays(referenceDate, -6),
        status: 'COMPLETED',
      },
    });

    const taskV2 = await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: 'Nộp lại đề cương đồ án tốt nghiệp (BM01 v2)',
        content: 'Đã nộp lại bản đề cương BM01 lần 2.',
        taskType: 'BM01_RESUBMISSION',
        dueDate: addDays(referenceDate, 7),
        status: 'COMPLETED',
      },
    });

    const subV1 = await prisma.submission.create({
      data: {
        registrationId: registration.id,
        taskId: taskV1.id,
        submittedBy: student.id,
        content: `Bản nộp đề cương BM01 lần 1 (attempt 1) của sinh viên ${student.fullName}`,
        fileUrl: `/uploads/demo/bm01/BM01_v1_SV${padStr}.pdf`,
        fileName: `BM01_v1_SV${padStr}.pdf`,
        submittedAt: addDays(referenceDate, -7),
      },
    });

    const subV2 = await prisma.submission.create({
      data: {
        registrationId: registration.id,
        taskId: taskV2.id,
        submittedBy: student.id,
        content: `Bản nộp lại đề cương BM01 đã chỉnh sửa v2 (attempt 2) của sinh viên ${student.fullName}`,
        fileUrl: `/uploads/demo/bm01/BM01_v2_Revised_SV${padStr}.pdf`,
        fileName: `BM01_v2_Revised_SV${padStr}.pdf`,
        submittedAt: addDays(referenceDate, -1),
      },
    });

    await prisma.bM01Evaluation.create({
      data: {
        registrationId: registration.id,
        attemptNo: 1,
        submissionId: subV1.id,
        revisionSubmissionId: subV2.id,
        submittedAt: addDays(referenceDate, -7),
        submittedById: student.id,
        policyVersionId: policyHK1.id,
        councilId: assignedCouncil.id,
        batchId: batchCouncil3Published.id,
        initialOutcome: 'REVISION_REQUIRED',
        outcome: 'NEEDS_REVISION',
        attendanceStatus: 'PRESENT',
        comment: 'Cần bổ sung kiến trúc chi tiết và kế hoạch thực nghiệm.',
        revisionRequirements: 'Cập nhật chương 2 (Kiến trúc hệ thống) và chương 3 (Kế hoạch thực nghiệm).',
        revisionApprovalStatus: 'PENDING',
        deadlineAt: addDays(referenceDate, 7),
        reviewedById: assignedCouncil.secretary.id,
        reviewedAt: addDays(referenceDate, -5),
      },
    });

    registrations.set(number, { ...registration, student, topic, mentor });
  }

  // --- COHORT 8: sv106 – sv120 (HK1) Đã hoàn tất Giai đoạn 1 Đạt đề cương (BM01_PASSED) ---
  for (let number = 106; number <= 120; number += 1) {
    const student = students[number - 1];
    const mentor = hk1MentorByStudent.get(number);
    const padStr = String(number).padStart(3, '0');
    const assignedCouncil = outlineCouncils[3];

    await prisma.studentProjectEnrollment.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        status: 'ACTIVE',
        source: 'SEED',
      },
    });

    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: buildTopicTitleForStudent(number),
        description: `Đề tài của sinh viên ${padStr} đã đạt xét duyệt đề cương BM01, sẵn sàng mở BM02 hoặc test Reopen.`,
        status: 'APPROVED',
      },
    });

    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK1.id,
        status: 'BM01_PASSED',
        outlineReviewStatus: 'PASSED',
        bm01ApprovedTitleSnapshot: topic.title,
        outlineCouncilId: assignedCouncil.id,
        stateVersion: 2,
      },
    });

    const taskV1 = await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: 'Nộp đề cương đồ án tốt nghiệp (BM01)',
        content: 'Đã hoàn thành xét duyệt đề cương BM01.',
        taskType: 'BM01_INITIAL_SUBMISSION',
        dueDate: addDays(referenceDate, -6),
        status: 'COMPLETED',
      },
    });

    const subV1 = await prisma.submission.create({
      data: {
        registrationId: registration.id,
        taskId: taskV1.id,
        submittedBy: student.id,
        content: `Bản đề cương BM01 đạt yêu cầu của sinh viên ${student.fullName}`,
        fileUrl: `/uploads/demo/bm01/BM01_v1_Passed_SV${padStr}.pdf`,
        fileName: `BM01_v1_Passed_SV${padStr}.pdf`,
        submittedAt: addDays(referenceDate, -7),
      },
    });

    await prisma.bM01Evaluation.create({
      data: {
        registrationId: registration.id,
        attemptNo: 1,
        submissionId: subV1.id,
        submittedAt: addDays(referenceDate, -7),
        submittedById: student.id,
        policyVersionId: policyHK1.id,
        councilId: assignedCouncil.id,
        batchId: batchCouncil4Published.id,
        initialOutcome: 'PASS',
        outcome: 'PASSED',
        attendanceStatus: 'PRESENT',
        comment: 'Đề cương hoàn chỉnh, mục tiêu nghiên cứu và phạm vi rõ ràng, đồng ý thông qua.',
        revisionApprovalStatus: 'NOT_REQUIRED',
        reviewedById: assignedCouncil.secretary.id,
        reviewedAt: addDays(referenceDate, -5),
      },
    });

    await prisma.task.createMany({
      data: [
        {
          registrationId: registration.id,
          title: 'BM01 - Đề cương chi tiết đồ án',
          content: 'Đề cương đã được Hội đồng xét duyệt thông qua.',
          taskType: 'BM01',
          status: 'COMPLETED',
        },
        {
          registrationId: registration.id,
          title: 'Nộp đơn đăng ký đề tài chính thức (BM02)',
          content: 'Sinh viên nộp đơn đăng ký đề tài chính thức BM02 để chuyển sang Giai đoạn 2.',
          taskType: 'BM02',
          dueDate: addDays(referenceDate, 10),
          status: 'OPEN',
        },
      ],
    });

    registrations.set(number, { ...registration, student, topic, mentor });
  }

  return {
    semesters: {
      semesterHK1: semesterHK1Record,
      semesterHK2: semesterHK2Record,
    },
    policies: {
      policyHK1,
      policyHK2,
    },
    catalog,
    rubric,
    outlineCouncils,
    delegations: [delegationOutlineActive, delegationBm02Active, delegationExpired],
    registrations,
    studentSnapshots,
  };
}

module.exports = {
  PHASE1_COHORTS,
  buildAccounts,
  buildStudentProfileData,
  buildTopicTitleForStudent,
  seedPhase1AcademicFixtures,
};
