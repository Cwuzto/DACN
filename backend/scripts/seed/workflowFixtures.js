const { DEFAULT_POLICY, checksum } = require('../../src/services/workflowPolicyService');
const { hashScoreEvidence } = require('../../src/services/defenseResultPublicationService');
const {
  getSemesterDefinitions,
  STUDENT_COHORTS,
  advisorEmailForStudentNumber,
  allocateCouncilForRegistration,
} = require('./demoFixtures');

const RUBRIC_VERSION = 'RUBRIC-DATN-2026';
const TIMELINE_TASK_TYPE = 'BM03_CHECKPOINT';

function statusForStudent(number) {
  if (number <= 10) return null;
  if (number <= 20) return 'PENDING';
  if (number <= 30) return 'APPROVED';
  if (number <= 35) return 'BM01_SUBMITTED';
  if (number <= 40) return 'BM01_NEEDS_REVISION';
  if (number <= 45) return 'BM01_RESUBMITTED';
  if (number <= 50) return 'BM02_SUBMITTED';
  if (number <= 70) return 'DECISION_ISSUED';
  if (number <= 84) return 'IN_PROGRESS';
  if (number === 85) return 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED';
  if (number <= 90) return 'BM03_PASSED';
  if (number <= 95) return 'BM04_REVIEW';
  if (number <= 100) return 'DEFENSE_READY';
  if (number <= 105) return 'AWAITING_SCORES';
  if (number <= 110) return 'AWAITING_FINAL_APPROVAL';
  if (number <= 115) return 'DEFENSE_PASSED';
  return 'DEFENSE_FAILED';
}

function buildRegistrationFixture({ number, semesterId, catalogId, studentId, mentorId, policyVersionId }) {
  const status = statusForStudent(number);
  const enrollment = { studentId, semesterId, projectCatalogId: catalogId, status: 'ACTIVE', source: 'SEED' };
  if (!status) {
    return {
      enrollment,
      topic: null,
      registration: null,
    };
  }
  const hasDecision = !['PENDING', 'APPROVED', 'BM01_SUBMITTED', 'BM01_NEEDS_REVISION', 'BM01_RESUBMITTED', 'BM01_PASSED', 'BM02_SUBMITTED'].includes(status);
  return {
    enrollment,
    topic: {
      semesterId,
      projectCatalogId: catalogId,
      mentorId,
      proposedById: mentorId,
      maxStudents: 1,
      title: `Đồ án tốt nghiệp ${String(number).padStart(3, '0')}`,
      description: `Dữ liệu demo có kiểm soát cho sinh viên ${String(number).padStart(3, '0')}.`,
      status: 'APPROVED',
    },
    registration: {
      studentId,
      semesterId,
      periodPolicyVersionId: policyVersionId,
      status,
      outlineReviewStatus: status === 'BM01_NEEDS_REVISION' ? 'REVISION_REQUIRED' : (['PENDING', 'APPROVED', 'BM01_SUBMITTED'].includes(status) ? 'PENDING' : 'PASSED'),
      outlineFeedback: status === 'BM01_NEEDS_REVISION' ? 'Bổ sung phạm vi và kế hoạch thực hiện.' : null,
      decisionNumber: hasDecision ? 'QD-DATN-2026-HK1' : null,
      decisionDate: hasDecision ? new Date('2026-09-01T00:00:00.000Z') : null,
      stateVersion: 1,
    },
  };
}

function assertDefenseEvidence({ councilMemberIds, memberScores, defenseResult }) {
  const memberIds = new Set(councilMemberIds || []);
  const validScores = (memberScores || []).filter((score) => memberIds.has(score.evaluatorId) && score.scoreLocked && Number.isFinite(Number(score.finalScore)));
  if (memberIds.size !== 3 || validScores.length !== 3 || new Set(validScores.map((score) => score.evaluatorId)).size !== 3 || !defenseResult?.scoreLocked || !Number.isFinite(Number(defenseResult.finalScore)) || !defenseResult.scoreRubricVersion) {
    throw new Error('LOCKED_DEFENSE_EVIDENCE_REQUIRED');
  }
}

async function createCouncils(prisma, semesterId, lecturers, defenseDate) {
  const councils = [];
  for (let index = 0; index < 4; index += 1) {
    const members = lecturers.slice(index * 3, index * 3 + 3);
    const council = await prisma.council.create({
      data: {
        semesterId,
        name: `Hội đồng bảo vệ ${index + 1}`,
        councilType: 'DEFENSE_COUNCIL',
        location: `Phòng ${201 + index}`,
        defenseDate,
      },
    });
    await prisma.councilMember.createMany({
      data: members.map((lecturer, memberIndex) => ({
        councilId: council.id,
        lecturerId: lecturer.id,
        roleInCouncil: ['CHAIRMAN', 'SECRETARY', 'REVIEWER'][memberIndex],
      })),
    });
    councils.push({ id: council.id, memberIds: members.map((member) => member.id) });
  }
  return councils;
}

async function seedAcademicFixtures({ prisma, accountsByEmail, baseDate, calendar }) {
  const referenceDate = baseDate
    ? (baseDate instanceof Date ? baseDate : new Date(baseDate))
    : (calendar?.defenseDate ? new Date(calendar.defenseDate) : new Date());

  const semesterDefs = getSemesterDefinitions(referenceDate);
  const admin = accountsByEmail.get('admin@university.edu.vn');
  const lecturer01 = accountsByEmail.get('lecturer01@university.edu.vn');
  const lecturer02 = accountsByEmail.get('lecturer02@university.edu.vn');
  const lecturer03 = accountsByEmail.get('lecturer03@university.edu.vn');

  // 1. Create 2 Semesters and attach policy versions
  const semesterHK1Record = await prisma.semester.create({ data: semesterDefs.semesterHK1 });
  const semesterHK2Record = await prisma.semester.create({ data: semesterDefs.semesterHK2 });

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

  // 2. Project Catalog
  const catalog = await prisma.projectCatalog.create({
    data: {
      code: 'DATN',
      name: 'Đồ án tốt nghiệp',
      isActive: true,
    },
  });

  // 3. Standardized Rubric with 3 categories and 6 criteria
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

  // 4. Academic Delegations
  const delegationActive = await prisma.academicDelegation.create({
    data: {
      delegatorId: lecturer01.id,
      delegateeId: lecturer02.id,
      capabilityCode: 'BM02_REVIEW',
      department: 'Viện Công nghệ số',
      semesterId: semesterHK1Record.id,
      effectiveFrom: new Date(referenceDate.getTime() - 5 * 86400000),
      effectiveTo: new Date(referenceDate.getTime() + 60 * 86400000),
      reason: 'Ủy quyền thẩm định đề cương và duyệt BM02 Học kỳ 1 năm học 2026-2027',
      idempotencyKey: 'seed-delegation-active-01',
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
      effectiveFrom: new Date(referenceDate.getTime() - 90 * 86400000),
      effectiveTo: new Date(referenceDate.getTime() - 10 * 86400000),
      reason: 'Ủy quyền thẩm định đề cương đợt xét duyệt Học kỳ 1',
      idempotencyKey: 'seed-delegation-expired-02',
      status: 'ACTIVE',
    },
  });

  // 5. Public Announcements
  const announcement1 = await prisma.publicAnnouncement.create({
    data: {
      title: 'Thông báo mở đăng ký đề tài tốt nghiệp Học kỳ 2',
      content: 'Viện Công nghệ số thông báo mở cổng đăng ký đề tài tốt nghiệp Học kỳ 2 năm học 2026–2027 cho sinh viên đủ điều kiện. Hạn chót đăng ký theo lịch trình học kỳ.',
      category: 'REGISTRATION',
      isPublished: true,
      isPinned: true,
      authorId: admin.id,
    },
  });

  const announcement2 = await prisma.publicAnnouncement.create({
    data: {
      title: 'Hướng dẫn nộp đề cương BM01 Học kỳ 1',
      content: 'Sinh viên sau khi được GVHD đồng ý hướng dẫn cần hoàn thiện đề cương BM01 và nộp đúng hạn. Lưu ý kiểm tra đạo văn và tỷ lệ trùng lặp theo quy định.',
      category: 'ACADEMIC',
      isPublished: true,
      isPinned: false,
      authorId: admin.id,
    },
  });

  const announcement3 = await prisma.publicAnnouncement.create({
    data: {
      title: 'Lịch bảo vệ chính thức của Hội đồng khóa luận tốt nghiệp Học kỳ 1',
      content: 'Công bố danh sách sinh viên đủ điều kiện bảo vệ và danh sách 4 hội đồng chuyên ngành Học kỳ 1. Sinh viên có mặt đúng giờ quy định.',
      category: 'DEFENSE',
      isPublished: true,
      isPinned: false,
      authorId: admin.id,
    },
  });

  // 6. Councils in HK1
  const lecturers = [...accountsByEmail.values()].filter((user) => user.role === 'LECTURER').sort((a, b) => a.email.localeCompare(b.email));
  const councils = await createCouncils(prisma, semesterHK1Record.id, lecturers, semesterHK1Record.defenseDate || referenceDate);
  const councilLoadMap = new Map(councils.map((c) => [c.id, 0]));

  // Outline Review Council in HK1
  const outlineCouncil = await prisma.council.create({
    data: {
      semesterId: semesterHK1Record.id,
      name: 'Hội đồng thẩm định đề cương 1',
      councilType: 'OUTLINE_REVIEW',
      location: 'Phòng 101',
      defenseDate: referenceDate,
      meetingMode: 'IN_PERSON',
    },
  });
  await prisma.councilMember.createMany({
    data: [
      { councilId: outlineCouncil.id, lecturerId: lecturers[0].id, roleInCouncil: 'CHAIRMAN' },
      { councilId: outlineCouncil.id, lecturerId: lecturers[1].id, roleInCouncil: 'SECRETARY' },
      { councilId: outlineCouncil.id, lecturerId: lecturers[2].id, roleInCouncil: 'MEMBER' },
    ],
  });
  const outlineBatch = await prisma.councilResultBatch.create({
    data: {
      councilId: outlineCouncil.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      chairPublishedAt: referenceDate,
      chairPublishedById: admin.id,
      secretaryCompletedAt: referenceDate,
      secretaryCompletedById: lecturers[1].id,
    },
  });

  const students = [...accountsByEmail.values()].filter((user) => user.role === 'STUDENT').sort((a, b) => a.email.localeCompare(b.email));
  const registrations = new Map();

  // Helper for model compatibility (Prisma uses camelCase bM01Evaluation, etc.)
  const bm01Model = prisma.bM01Evaluation || prisma.bm01Evaluation;
  const bm02Model = prisma.bM02Submission || prisma.bm02Submission;
  const bm04Model = prisma.bM04Evaluation || prisma.bm04Evaluation;

  // --- HK2 COHORTS (sv001–sv030) in semesterHK2Record ---

  // Cohort: HK2 Unregistered (sv001–sv010)
  for (let number = 1; number <= 10; number += 1) {
    const student = students[number - 1];
    await prisma.studentProjectEnrollment.create({
      data: { studentId: student.id, semesterId: semesterHK2Record.id, projectCatalogId: catalog.id, status: 'ACTIVE', source: 'SEED' },
    });
  }

  // Seed 12 open topics in HK2 (1 per mentor lecturer01..lecturer12)
  for (let i = 1; i <= 12; i += 1) {
    const mentor = accountsByEmail.get(`lecturer${String(i).padStart(2, '0')}@university.edu.vn`);
    await prisma.topic.create({
      data: {
        semesterId: semesterHK2Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: `Đề tài gợi ý HK2 - ${mentor.fullName}`,
        description: 'Đề tài mở sẵn sàng tiếp nhận đăng ký cho Học kỳ 2 năm học 2026–2027.',
        status: 'APPROVED',
      },
    });
  }

  // Cohort: HK2 Pending (sv011–sv020)
  for (let number = 11; number <= 20; number += 1) {
    const student = students[number - 1];
    const mentorNumber = ((number - 1) % 12) + 1;
    const mentor = accountsByEmail.get(`lecturer${String(mentorNumber).padStart(2, '0')}@university.edu.vn`);
    const padStr = String(number).padStart(3, '0');

    await prisma.studentProjectEnrollment.create({
      data: { studentId: student.id, semesterId: semesterHK2Record.id, projectCatalogId: catalog.id, status: 'ACTIVE', source: 'SEED' },
    });
    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK2Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: `Đồ án tốt nghiệp ${padStr}`,
        description: `Dữ liệu demo cho sinh viên ${padStr}.`,
        status: 'APPROVED',
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
        defenseCouncilId: null,
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
        reason: 'Đăng ký nguyện vọng đề tài HK2',
        reference: { fixture: number },
        idempotencyKey: `seed-registration-${number}`,
      },
    });
    await prisma.idempotencyRecord.create({
      data: {
        scope: 'seed',
        key: `seed-registration-${number}`,
        commandHash: 'controlled-demo-seed-v2',
        registrationId: registration.id,
        response: { status: 'PENDING' },
      },
    });
    registrations.set(number, { ...registration, student, topic, mentor, council: null });
  }

  // Cohort: HK2 Approved (sv021–sv030)
  for (let number = 21; number <= 30; number += 1) {
    const student = students[number - 1];
    const mentorNumber = ((number - 1) % 12) + 1;
    const mentor = accountsByEmail.get(`lecturer${String(mentorNumber).padStart(2, '0')}@university.edu.vn`);
    const padStr = String(number).padStart(3, '0');

    await prisma.studentProjectEnrollment.create({
      data: { studentId: student.id, semesterId: semesterHK2Record.id, projectCatalogId: catalog.id, status: 'ACTIVE', source: 'SEED' },
    });
    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK2Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: `Đồ án tốt nghiệp ${padStr}`,
        description: `Dữ liệu demo cho sinh viên ${padStr}.`,
        status: 'APPROVED',
      },
    });
    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK2Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK2.id,
        status: 'APPROVED',
        outlineReviewStatus: 'PENDING',
        defenseCouncilId: null,
        stateVersion: 1,
      },
    });
    await prisma.registrationStateHistory.create({
      data: {
        registrationId: registration.id,
        fromStatus: 'PENDING',
        toStatus: 'APPROVED',
        fromStateVersion: 0,
        toStateVersion: 1,
        actorId: mentor.id,
        reason: 'GVHD duyệt đăng ký đề tài HK2',
        reference: { fixture: number },
        idempotencyKey: `seed-registration-${number}`,
      },
    });
    await prisma.idempotencyRecord.create({
      data: {
        scope: 'seed',
        key: `seed-registration-${number}`,
        commandHash: 'controlled-demo-seed-v2',
        registrationId: registration.id,
        response: { status: 'APPROVED' },
      },
    });
    registrations.set(number, { ...registration, student, topic, mentor, council: null });
  }

  // --- HK1 COHORTS (sv031–sv120) in semesterHK1Record ---
  const getHK1Mentor = (num) => {
    const mentorNumber = ((num - 31) % 12) + 1;
    return accountsByEmail.get(`lecturer${String(mentorNumber).padStart(2, '0')}@university.edu.vn`);
  };

  // Cohort: HK1 BM01 Submitted (sv031–sv035)
  for (let number = 31; number <= 35; number += 1) {
    const student = students[number - 1];
    const mentor = getHK1Mentor(number);
    const padStr = String(number).padStart(3, '0');

    await prisma.studentProjectEnrollment.create({
      data: { studentId: student.id, semesterId: semesterHK1Record.id, projectCatalogId: catalog.id, status: 'ACTIVE', source: 'SEED' },
    });
    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: `Đồ án tốt nghiệp ${padStr}`,
        description: `Dữ liệu demo cho sinh viên ${padStr}.`,
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
        outlineCouncilId: outlineCouncil.id,
        defenseCouncilId: null,
        stateVersion: 1,
      },
    });
    await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: 'Nộp đề cương chi tiết (BM01)',
        content: 'Nộp bản đề cương chính thức để Hội đồng thẩm định xét duyệt.',
        taskType: 'BM01_INITIAL_SUBMISSION',
        dueDate: new Date(referenceDate.getTime() + 7 * 86400000),
        status: 'COMPLETED',
      },
    });
    await prisma.registrationStateHistory.create({
      data: {
        registrationId: registration.id,
        fromStatus: 'REGISTERED',
        toStatus: 'BM01_SUBMITTED',
        fromStateVersion: 0,
        toStateVersion: 1,
        actorId: student.id,
        reason: 'Sinh viên nộp đề cương v1',
        reference: { fixture: number },
        idempotencyKey: `seed-registration-${number}`,
      },
    });
    await prisma.idempotencyRecord.create({
      data: {
        scope: 'seed',
        key: `seed-registration-${number}`,
        commandHash: 'controlled-demo-seed-v2',
        registrationId: registration.id,
        response: { status: 'BM01_SUBMITTED' },
      },
    });
    registrations.set(number, { ...registration, student, topic, mentor, council: null });
  }

  // Cohort: HK1 BM01 revision (sv036–sv040)
  for (let number = 36; number <= 40; number += 1) {
    const student = students[number - 1];
    const mentor = getHK1Mentor(number);
    const padStr = String(number).padStart(3, '0');

    await prisma.studentProjectEnrollment.create({
      data: { studentId: student.id, semesterId: semesterHK1Record.id, projectCatalogId: catalog.id, status: 'ACTIVE', source: 'SEED' },
    });
    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: `Đồ án tốt nghiệp ${padStr}`,
        description: `Dữ liệu demo cho sinh viên ${padStr}.`,
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
        outlineFeedback: 'Cần bổ sung phạm vi nghiên cứu và kế hoạch thực nghiệm.',
        outlineCouncilId: outlineCouncil.id,
        defenseCouncilId: null,
        stateVersion: 1,
      },
    });
    await bm01Model.create({
      data: {
        registrationId: registration.id,
        attemptNo: 1,
        initialOutcome: 'REVISION_REQUIRED',
        outcome: 'NEEDS_REVISION',
        issues: { feedback: 'Cần bổ sung phạm vi nghiên cứu và kế hoạch thực nghiệm.' },
        revisionRequirements: 'Bổ sung sơ đồ kiến trúc và kế hoạch thực hiện tuần 1-6.',
        deadlineAt: new Date(referenceDate.getTime() + 5 * 86400000),
        policyVersionId: policyHK1.id,
        reviewedById: mentor.id,
        reviewedAt: referenceDate,
        batchId: outlineBatch.id,
        councilId: outlineCouncil.id,
      },
    });
    await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: 'Nộp lại đề cương đã chỉnh sửa (v2)',
        content: 'Chỉnh sửa theo góp ý của Hội đồng thẩm định đề cương và nộp lại bản v2.',
        taskType: 'BM01_RESUBMISSION',
        dueDate: new Date(referenceDate.getTime() + 5 * 86400000),
        status: 'OPEN',
      },
    });
    await prisma.registrationStateHistory.create({
      data: {
        registrationId: registration.id,
        fromStatus: 'BM01_SUBMITTED',
        toStatus: 'BM01_NEEDS_REVISION',
        fromStateVersion: 0,
        toStateVersion: 1,
        actorId: admin.id,
        reason: 'Hội đồng yêu cầu chỉnh sửa đề cương',
        reference: { fixture: number },
        idempotencyKey: `seed-registration-${number}`,
      },
    });
    await prisma.idempotencyRecord.create({
      data: {
        scope: 'seed',
        key: `seed-registration-${number}`,
        commandHash: 'controlled-demo-seed-v2',
        registrationId: registration.id,
        response: { status: 'BM01_NEEDS_REVISION' },
      },
    });
    registrations.set(number, { ...registration, student, topic, mentor, council: null });
  }

  // Cohort: HK1 BM01 Resubmitted (sv041–sv045)
  for (let number = 41; number <= 45; number += 1) {
    const student = students[number - 1];
    const mentor = getHK1Mentor(number);
    const padStr = String(number).padStart(3, '0');

    await prisma.studentProjectEnrollment.create({
      data: { studentId: student.id, semesterId: semesterHK1Record.id, projectCatalogId: catalog.id, status: 'ACTIVE', source: 'SEED' },
    });
    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: `Đồ án tốt nghiệp ${padStr}`,
        description: `Dữ liệu demo cho sinh viên ${padStr}.`,
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
        outlineFeedback: 'Bản nộp v2 đã cập nhật theo yêu cầu, chờ Chủ tịch hội đồng thẩm định duyệt.',
        outlineCouncilId: outlineCouncil.id,
        defenseCouncilId: null,
        stateVersion: 1,
      },
    });
    await bm01Model.create({
      data: {
        registrationId: registration.id,
        attemptNo: 1,
        initialOutcome: 'REVISION_REQUIRED',
        outcome: 'NEEDS_REVISION',
        issues: { feedback: 'Đã nộp bản sửa đổi v2' },
        deadlineAt: new Date(referenceDate.getTime() + 3 * 86400000),
        policyVersionId: policyHK1.id,
        reviewedById: mentor.id,
        reviewedAt: referenceDate,
        batchId: outlineBatch.id,
        councilId: outlineCouncil.id,
      },
    });
    await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: 'Nộp lại đề cương đã chỉnh sửa (v2)',
        content: 'Chỉnh sửa theo góp ý của Hội đồng thẩm định đề cương và nộp lại bản v2.',
        taskType: 'BM01_RESUBMISSION',
        dueDate: new Date(referenceDate.getTime() + 3 * 86400000),
        status: 'COMPLETED',
      },
    });
    await prisma.registrationStateHistory.create({
      data: {
        registrationId: registration.id,
        fromStatus: 'BM01_NEEDS_REVISION',
        toStatus: 'BM01_RESUBMITTED',
        fromStateVersion: 0,
        toStateVersion: 1,
        actorId: student.id,
        reason: 'Sinh viên nộp lại đề cương v2',
        reference: { fixture: number },
        idempotencyKey: `seed-registration-${number}`,
      },
    });
    await prisma.idempotencyRecord.create({
      data: {
        scope: 'seed',
        key: `seed-registration-${number}`,
        commandHash: 'controlled-demo-seed-v2',
        registrationId: registration.id,
        response: { status: 'BM01_RESUBMITTED' },
      },
    });
    registrations.set(number, { ...registration, student, topic, mentor, council: null });
  }

  // Cohort: HK1 BM02 Submitted (sv046–sv050)
  for (let number = 46; number <= 50; number += 1) {
    const student = students[number - 1];
    const mentor = getHK1Mentor(number);
    const padStr = String(number).padStart(3, '0');

    await prisma.studentProjectEnrollment.create({
      data: { studentId: student.id, semesterId: semesterHK1Record.id, projectCatalogId: catalog.id, status: 'ACTIVE', source: 'SEED' },
    });
    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: `Đồ án tốt nghiệp ${padStr}`,
        description: `Dữ liệu demo cho sinh viên ${padStr}.`,
        status: 'APPROVED',
      },
    });
    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK1.id,
        status: 'BM02_SUBMITTED',
        outlineReviewStatus: 'PASSED',
        defenseCouncilId: null,
        stateVersion: 1,
      },
    });
    const bm02 = await bm02Model.create({
      data: {
        registrationId: registration.id,
        versionNo: 1,
        attemptNo: 1,
        outcome: 'PENDING_REVIEW',
        policyVersionId: policyHK1.id,
        submittedById: student.id,
        submittedAt: referenceDate,
        fileUrl: `https://storage.dacn.edu.vn/demo/bm02/sv${padStr}.pdf`,
        fileName: `BM02_SV${padStr}.pdf`,
      },
    });
    await prisma.topicRegistration.update({
      where: { id: registration.id },
      data: { currentBM02SubmissionId: bm02.id },
    });
    await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: 'Nộp Đơn đăng ký đề tài tốt nghiệp (BM02)',
        content: 'Hoàn thiện hồ sơ BM02 sau khi đề cương được duyệt.',
        taskType: 'BM02',
        dueDate: new Date(referenceDate.getTime() + 10 * 86400000),
        status: 'COMPLETED',
      },
    });
    await prisma.registrationStateHistory.create({
      data: {
        registrationId: registration.id,
        fromStatus: 'BM01_PASSED',
        toStatus: 'BM02_SUBMITTED',
        fromStateVersion: 0,
        toStateVersion: 1,
        actorId: student.id,
        reason: 'Nộp hồ sơ BM02',
        reference: { fixture: number },
        idempotencyKey: `seed-registration-${number}`,
      },
    });
    await prisma.idempotencyRecord.create({
      data: {
        scope: 'seed',
        key: `seed-registration-${number}`,
        commandHash: 'controlled-demo-seed-v2',
        registrationId: registration.id,
        response: { status: 'BM02_SUBMITTED' },
      },
    });
    registrations.set(number, { ...registration, student, topic, mentor, council: null, currentBM02Submission: bm02 });
  }

  // Cohort: HK1 Decision Issued (sv051–sv070, 20 SV)
  for (let number = 51; number <= 70; number += 1) {
    const student = students[number - 1];
    const mentor = getHK1Mentor(number);
    const padStr = String(number).padStart(3, '0');

    await prisma.studentProjectEnrollment.create({
      data: { studentId: student.id, semesterId: semesterHK1Record.id, projectCatalogId: catalog.id, status: 'ACTIVE', source: 'SEED' },
    });
    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: `Đồ án tốt nghiệp ${padStr}`,
        description: `Dữ liệu demo cho sinh viên ${padStr}.`,
        status: 'APPROVED',
      },
    });
    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK1.id,
        status: 'DECISION_ISSUED',
        outlineReviewStatus: 'PASSED',
        decisionNumber: 'QD-DATN-2026-HK1',
        decisionDate: referenceDate,
        defenseCouncilId: null,
        stateVersion: 1,
      },
    });
    const bm02 = await bm02Model.create({
      data: {
        registrationId: registration.id,
        versionNo: 1,
        attemptNo: 1,
        outcome: 'APPROVED',
        policyVersionId: policyHK1.id,
        submittedById: student.id,
        reviewedById: admin.id,
        reviewedAt: referenceDate,
        fileUrl: `https://storage.dacn.edu.vn/demo/bm02/sv${padStr}.pdf`,
        fileName: `BM02_SV${padStr}.pdf`,
      },
    });
    await prisma.topicRegistration.update({
      where: { id: registration.id },
      data: { currentBM02SubmissionId: bm02.id },
    });
    const decision = await prisma.assignmentDecision.create({
      data: {
        registrationId: registration.id,
        bm02SubmissionId: bm02.id,
        decisionNumber: 'QD-DATN-2026-HK1',
        issuedAt: referenceDate,
        effectiveAt: referenceDate,
        issuedById: admin.id,
        policyVersionId: policyHK1.id,
        idempotencyKey: `seed-decision-${number}`,
      },
    });

    if (number === 51) {
      await prisma.topicTitleAdjustment.create({
        data: {
          registrationId: registration.id,
          originalTitle: topic.title,
          newTitle: `${topic.title} (Điều chỉnh)`,
          reason: 'Cập nhật lại phạm vi hệ thống theo khảo sát thực tế',
          status: 'PENDING',
          deadline: new Date(referenceDate.getTime() + 5 * 86400000),
          requestedAt: referenceDate,
        },
      });
    }

    if (number === 52) {
      await prisma.topicTitleAdjustment.create({
        data: {
          registrationId: registration.id,
          originalTitle: topic.title,
          newTitle: `${topic.title} (Đã chuẩn hóa)`,
          reason: 'Chuẩn hóa tên đề tài theo hội đồng thẩm định',
          status: 'APPROVED',
          deadline: new Date(referenceDate.getTime() + 5 * 86400000),
          requestedAt: new Date(referenceDate.getTime() - 2 * 86400000),
          reviewedAt: referenceDate,
          reviewedById: admin.id,
        },
      });
      await prisma.decisionAmendment.create({
        data: {
          assignmentDecisionId: decision.id,
          amendmentNumber: 'PL-01-QD-DATN',
          reason: 'Điều chỉnh tên đề tài theo phê duyệt',
          changes: { adjustedTitle: `${topic.title} (Đã chuẩn hóa)` },
          signedById: admin.id,
          idempotencyKey: 'seed-amendment-sv052',
          effectiveAt: referenceDate,
        },
      });
      await prisma.topicRegistration.update({
        where: { id: registration.id },
        data: { adjustedTitle: `${topic.title} (Đã chuẩn hóa)` },
      });
    }

    await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: `Mốc triển khai ${number}`,
        content: 'Timeline demo',
        taskType: TIMELINE_TASK_TYPE,
        dueDate: new Date(referenceDate.getTime() - 10 * 86400000),
        status: 'OPEN',
      },
    });

    await prisma.registrationStateHistory.create({
      data: {
        registrationId: registration.id,
        fromStatus: 'REGISTERED',
        toStatus: 'DECISION_ISSUED',
        fromStateVersion: 0,
        toStateVersion: 1,
        actorId: admin.id,
        reason: 'Ban hành quyết định giao đề tài',
        reference: { fixture: number },
        idempotencyKey: `seed-registration-${number}`,
      },
    });
    await prisma.idempotencyRecord.create({
      data: {
        scope: 'seed',
        key: `seed-registration-${number}`,
        commandHash: 'controlled-demo-seed-v2',
        registrationId: registration.id,
        response: { status: 'DECISION_ISSUED' },
      },
    });
    registrations.set(number, { ...registration, student, topic, mentor, council: null, decision });
  }

  // Cohort: HK1 Checkpoint & Appeal (sv071–sv085, 15 SV)
  for (let number = 71; number <= 85; number += 1) {
    const student = students[number - 1];
    const mentor = getHK1Mentor(number);
    const padStr = String(number).padStart(3, '0');
    const status = number === 85 ? 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED' : 'IN_PROGRESS';

    await prisma.studentProjectEnrollment.create({
      data: { studentId: student.id, semesterId: semesterHK1Record.id, projectCatalogId: catalog.id, status: 'ACTIVE', source: 'SEED' },
    });
    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: `Đồ án tốt nghiệp ${padStr}`,
        description: `Dữ liệu demo cho sinh viên ${padStr}.`,
        status: 'APPROVED',
      },
    });
    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK1.id,
        status,
        outlineReviewStatus: 'PASSED',
        decisionNumber: 'QD-DATN-2026-HK1',
        decisionDate: new Date(referenceDate.getTime() - 40 * 86400000),
        defenseCouncilId: null,
        stateVersion: 1,
      },
    });
    const bm02 = await bm02Model.create({
      data: {
        registrationId: registration.id,
        versionNo: 1,
        attemptNo: 1,
        outcome: 'APPROVED',
        policyVersionId: policyHK1.id,
        submittedById: student.id,
        reviewedById: admin.id,
        reviewedAt: referenceDate,
      },
    });
    await prisma.topicRegistration.update({
      where: { id: registration.id },
      data: { currentBM02SubmissionId: bm02.id },
    });
    await prisma.assignmentDecision.create({
      data: {
        registrationId: registration.id,
        bm02SubmissionId: bm02.id,
        decisionNumber: 'QD-DATN-2026-HK1',
        issuedAt: referenceDate,
        effectiveAt: referenceDate,
        issuedById: admin.id,
        policyVersionId: policyHK1.id,
        idempotencyKey: `seed-decision-${number}`,
      },
    });

    // Checkpoint 1: Always passed
    await prisma.checkpointEvaluation.create({
      data: {
        registrationId: registration.id,
        checkpointNo: 1,
        attemptNo: 1,
        conclusion: 'ALLOWED_TO_CONTINUE',
        comments: 'Tiến độ tốt, hoàn thành đề cương chi tiết và khảo sát.',
        evidenceUrl: `https://storage.dacn.edu.vn/demo/cp1/sv${padStr}.pdf`,
        evidenceName: `evidence_cp1_sv${padStr}.pdf`,
        mentorSignedById: mentor.id,
        mentorSignature: `SIG_MENTOR_${mentor.id}`,
        studentSignedById: student.id,
        studentSignedAt: referenceDate,
        studentSignature: `SIG_STUDENT_${student.id}`,
        policyVersionId: policyHK1.id,
      },
    });

    // Checkpoint 2:
    if (number === 85) {
      const cp2 = await prisma.checkpointEvaluation.create({
        data: {
          registrationId: registration.id,
          checkpointNo: 2,
          attemptNo: 1,
          conclusion: 'NOT_ALLOWED_TO_CONTINUE',
          comments: 'Chưa đạt yêu cầu tiến độ tối thiểu',
          evidenceUrl: `https://storage.dacn.edu.vn/demo/cp2/sv${padStr}.pdf`,
          evidenceName: `evidence_cp2_sv${padStr}.pdf`,
          mentorSignedById: mentor.id,
          mentorSignature: `SIG_MENTOR_${mentor.id}`,
          studentSignedById: null,
          studentSignedAt: null,
          studentSignature: null,
          studentSignDeadlineAt: new Date(referenceDate.getTime() + 1 * 86400000),
          isAppealed: true,
          policyVersionId: policyHK1.id,
        },
      });
      await prisma.checkpointSignatureAppeal.create({
        data: {
          checkpointEvaluationId: cp2.id,
          registrationId: registration.id,
          studentId: student.id,
          appealDeadlineAt: new Date(referenceDate.getTime() + 3 * 86400000),
          submittedAt: referenceDate,
          status: 'SUBMITTED',
          reason: 'Minh chứng báo cáo đầy đủ nhưng GVHD chưa ký đối soát',
          evidenceUrl: 'https://storage.dacn.edu.vn/demo/appeals/sv085_minh_chung.pdf',
          evidenceName: 'sv085_minh_chung.pdf',
        },
      });
    } else {
      await prisma.checkpointEvaluation.create({
        data: {
          registrationId: registration.id,
          checkpointNo: 2,
          attemptNo: 1,
          conclusion: 'ALLOWED_TO_CONTINUE',
          comments: 'Hoàn thành nội dung cơ bản',
          evidenceUrl: `https://storage.dacn.edu.vn/demo/cp2/sv${padStr}.pdf`,
          evidenceName: `evidence_cp2_sv${padStr}.pdf`,
          mentorSignedById: mentor.id,
          mentorSignature: `SIG_MENTOR_${mentor.id}`,
          studentSignedById: student.id,
          studentSignedAt: referenceDate,
          studentSignature: `SIG_STUDENT_${student.id}`,
          policyVersionId: policyHK1.id,
        },
      });
    }

    await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: `Mốc triển khai ${number}`,
        content: 'Timeline demo',
        taskType: TIMELINE_TASK_TYPE,
        dueDate: new Date(referenceDate.getTime() - 5 * 86400000),
        status: 'OPEN',
      },
    });

    await prisma.registrationStateHistory.create({
      data: {
        registrationId: registration.id,
        fromStatus: 'REGISTERED',
        toStatus: status,
        fromStateVersion: 0,
        toStateVersion: 1,
        actorId: admin.id,
        reason: 'Cập nhật tiến độ BM03',
        reference: { fixture: number },
        idempotencyKey: `seed-registration-${number}`,
      },
    });
    await prisma.idempotencyRecord.create({
      data: {
        scope: 'seed',
        key: `seed-registration-${number}`,
        commandHash: 'controlled-demo-seed-v2',
        registrationId: registration.id,
        response: { status },
      },
    });
    registrations.set(number, { ...registration, student, topic, mentor, council: null });
  }

  // Cohort: HK1 BM04 & Pre-defense Archive (sv086–sv095, 10 SV)
  for (let number = 86; number <= 95; number += 1) {
    const student = students[number - 1];
    const mentor = getHK1Mentor(number);
    const padStr = String(number).padStart(3, '0');
    const status = number <= 90 ? 'BM03_PASSED' : 'BM04_REVIEW';

    await prisma.studentProjectEnrollment.create({
      data: { studentId: student.id, semesterId: semesterHK1Record.id, projectCatalogId: catalog.id, status: 'ACTIVE', source: 'SEED' },
    });
    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: `Đồ án tốt nghiệp ${padStr}`,
        description: `Dữ liệu demo cho sinh viên ${padStr}.`,
        status: 'APPROVED',
      },
    });
    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK1.id,
        status,
        outlineReviewStatus: 'PASSED',
        decisionNumber: 'QD-DATN-2026-HK1',
        decisionDate: new Date(referenceDate.getTime() - 60 * 86400000),
        defenseCouncilId: null,
        stateVersion: 1,
      },
    });
    const bm02 = await bm02Model.create({
      data: {
        registrationId: registration.id,
        versionNo: 1,
        attemptNo: 1,
        outcome: 'APPROVED',
        policyVersionId: policyHK1.id,
        submittedById: student.id,
        reviewedById: admin.id,
        reviewedAt: referenceDate,
      },
    });
    await prisma.topicRegistration.update({
      where: { id: registration.id },
      data: { currentBM02SubmissionId: bm02.id },
    });
    await prisma.assignmentDecision.create({
      data: {
        registrationId: registration.id,
        bm02SubmissionId: bm02.id,
        decisionNumber: 'QD-DATN-2026-HK1',
        issuedAt: referenceDate,
        effectiveAt: referenceDate,
        issuedById: admin.id,
        policyVersionId: policyHK1.id,
        idempotencyKey: `seed-decision-${number}`,
      },
    });

    await bm04Model.create({
      data: {
        registrationId: registration.id,
        semesterId: semesterHK1Record.id,
        studentId: student.id,
        lecturerId: mentor.id,
        thesisFormatScore: '2.0',
        researchContentScore: '5.0',
        applicabilityScore: '2.5',
        attitudeScore: '0.5',
        conclusion: 'AGREED_FOR_DEFENSE',
        generalNotes: 'Sinh viên hoàn thành tốt nội dung nghiên cứu, đủ điều kiện bảo vệ.',
        lecturerSignature: `SIG_LECTURER_${mentor.id}`,
        signedAt: referenceDate,
        isLocked: true,
        policyVersionId: policyHK1.id,
      },
    });

    await prisma.projectArchive.create({
      data: {
        registrationId: registration.id,
        phase: 'PRE_DEFENSE',
        status: 'SUBMITTED',
        reportFileUrl: `https://archive.dacn.edu.vn/pre-defense/sv${padStr}.pdf`,
        reportFileName: `${topic.title}_PreDefense.pdf`,
        sourceCodeUrl: 'https://github.com/dacn/pre-defense',
        slideFileUrl: `https://archive.dacn.edu.vn/pre-defense/slides_sv${padStr}.pptx`,
        slideFileName: `slides_sv${padStr}.pptx`,
        submittedAt: referenceDate,
      },
    });

    await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: `Mốc triển khai ${number}`,
        content: 'Timeline demo',
        taskType: TIMELINE_TASK_TYPE,
        dueDate: new Date(referenceDate.getTime() - 2 * 86400000),
        status: 'OPEN',
      },
    });

    await prisma.registrationStateHistory.create({
      data: {
        registrationId: registration.id,
        fromStatus: 'REGISTERED',
        toStatus: status,
        fromStateVersion: 0,
        toStateVersion: 1,
        actorId: mentor.id,
        reason: 'Đánh giá BM04 hoàn tất',
        reference: { fixture: number },
        idempotencyKey: `seed-registration-${number}`,
      },
    });
    await prisma.idempotencyRecord.create({
      data: {
        scope: 'seed',
        key: `seed-registration-${number}`,
        commandHash: 'controlled-demo-seed-v2',
        registrationId: registration.id,
        response: { status },
      },
    });
    registrations.set(number, { ...registration, student, topic, mentor, council: null });
  }

  // Cohort: HK1 Defense Students (sv096–sv120, 25 SV)
  for (let number = 96; number <= 120; number += 1) {
    const student = students[number - 1];
    const mentor = getHK1Mentor(number);
    const padStr = String(number).padStart(3, '0');
    const status = statusForStudent(number);
    const council = allocateCouncilForRegistration({ mentorId: mentor.id, councils, councilLoadMap });

    await prisma.studentProjectEnrollment.create({
      data: { studentId: student.id, semesterId: semesterHK1Record.id, projectCatalogId: catalog.id, status: 'ACTIVE', source: 'SEED' },
    });
    const topic = await prisma.topic.create({
      data: {
        semesterId: semesterHK1Record.id,
        projectCatalogId: catalog.id,
        mentorId: mentor.id,
        proposedById: mentor.id,
        maxStudents: 1,
        title: `Đồ án tốt nghiệp ${padStr}`,
        description: `Dữ liệu demo cho sinh viên ${padStr}.`,
        status: 'APPROVED',
      },
    });
    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK1.id,
        status,
        outlineReviewStatus: 'PASSED',
        decisionNumber: 'QD-DATN-2026-HK1',
        decisionDate: new Date(referenceDate.getTime() - 60 * 86400000),
        defenseCouncilId: council.id,
        stateVersion: 1,
      },
    });
    const bm02 = await bm02Model.create({
      data: {
        registrationId: registration.id,
        versionNo: 1,
        attemptNo: 1,
        outcome: 'APPROVED',
        policyVersionId: policyHK1.id,
        submittedById: student.id,
        reviewedById: admin.id,
        reviewedAt: referenceDate,
      },
    });
    await prisma.topicRegistration.update({
      where: { id: registration.id },
      data: { currentBM02SubmissionId: bm02.id },
    });
    await prisma.assignmentDecision.create({
      data: {
        registrationId: registration.id,
        bm02SubmissionId: bm02.id,
        decisionNumber: 'QD-DATN-2026-HK1',
        issuedAt: referenceDate,
        effectiveAt: referenceDate,
        issuedById: admin.id,
        policyVersionId: policyHK1.id,
        idempotencyKey: `seed-decision-${number}`,
      },
    });

    await bm04Model.create({
      data: {
        registrationId: registration.id,
        semesterId: semesterHK1Record.id,
        studentId: student.id,
        lecturerId: mentor.id,
        thesisFormatScore: '2.0',
        researchContentScore: '5.0',
        applicabilityScore: '2.5',
        attitudeScore: '0.5',
        conclusion: 'AGREED_FOR_DEFENSE',
        generalNotes: 'Đủ điều kiện bảo vệ trước hội đồng.',
        lecturerSignature: `SIG_LECTURER_${mentor.id}`,
        signedAt: referenceDate,
        isLocked: true,
        policyVersionId: policyHK1.id,
      },
    });

    await prisma.projectArchive.create({
      data: {
        registrationId: registration.id,
        phase: 'PRE_DEFENSE',
        status: 'SUBMITTED',
        reportFileUrl: `https://archive.dacn.edu.vn/pre-defense/sv${padStr}.pdf`,
        reportFileName: `${topic.title}_PreDefense.pdf`,
        sourceCodeUrl: 'https://github.com/dacn/pre-defense',
        slideFileUrl: `https://archive.dacn.edu.vn/pre-defense/slides_sv${padStr}.pptx`,
        slideFileName: `slides_sv${padStr}.pptx`,
        submittedAt: referenceDate,
      },
    });

    if (number <= 100) {
      await prisma.task.create({
        data: {
          registrationId: registration.id,
          title: `Mốc triển khai ${number}`,
          content: 'Timeline demo',
          taskType: TIMELINE_TASK_TYPE,
          dueDate: new Date(referenceDate.getTime() - 1 * 86400000),
          status: 'OPEN',
        },
      });
    }

    await prisma.registrationStateHistory.create({
      data: {
        registrationId: registration.id,
        fromStatus: 'REGISTERED',
        toStatus: status,
        fromStateVersion: 0,
        toStateVersion: 1,
        actorId: admin.id,
        reason: 'Phân công hội đồng bảo vệ',
        reference: { fixture: number },
        idempotencyKey: `seed-registration-${number}`,
      },
    });
    await prisma.idempotencyRecord.create({
      data: {
        scope: 'seed',
        key: `seed-registration-${number}`,
        commandHash: 'controlled-demo-seed-v2',
        registrationId: registration.id,
        response: { status },
      },
    });
    registrations.set(number, { ...registration, student, topic, mentor, council });
  }

  return {
    semester: semesterHK1Record,
    semesters: {
      semesterHK1: semesterHK1Record,
      semesterHK2: semesterHK2Record,
      period1Main: semesterHK1Record,
      period2Supplementary: semesterHK2Record,
      pastSemester: semesterHK1Record,
    },
    catalog,
    policy: policyHK1,
    policies: {
      policyHK1,
      policyHK2,
      period1Policy: policyHK1,
      period2Policy: policyHK2,
      pastPolicy: policyHK1,
    },
    admin,
    registrations,
    councils,
    outlineCouncil,
    rubric,
    delegations: [delegationActive, delegationExpired],
    announcements: [announcement1, announcement2, announcement3],
  };
}

async function seedDefenseEvidenceAndPublications({ prisma, context, fixtures }) {
  const adminId = context.admin.id;
  const targetSemester = context.semesters?.semesterHK1 || context.semesters?.period1Main || context.semester;

  // 1. Process 101..120 defense evidence
  // 101..105: AWAITING_SCORES (scores entered/unlocked)
  for (let num = 101; num <= 105; num += 1) {
    const fixture = fixtures.get(num);
    if (!fixture || !fixture.council) continue;
    const memberScores = fixture.council.memberIds.map((evaluatorId, idx) => ({
      registrationId: fixture.id,
      evaluatorId,
      finalScore: [7.5, 8.0, 7.5][idx],
      comments: 'Đang chấm điểm bảo vệ',
      scoreRubricVersion: RUBRIC_VERSION,
      scoreLocked: false,
      lockedAt: null,
      lockedBy: null,
    }));
    await prisma.defenseMemberScore.createMany({ data: memberScores });
    await prisma.defenseResult.create({
      data: {
        registrationId: fixture.id,
        finalScore: 7.7,
        comments: 'Kết quả đang tổng hợp',
        evaluatorId: fixture.council.memberIds[0],
        scoreRubricVersion: RUBRIC_VERSION,
        scoreLocked: false,
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  // 106..110: AWAITING_FINAL_APPROVAL (scores locked, no approval yet)
  for (let num = 106; num <= 110; num += 1) {
    const fixture = fixtures.get(num);
    if (!fixture || !fixture.council) continue;
    const memberScores = fixture.council.memberIds.map((evaluatorId, idx) => ({
      registrationId: fixture.id,
      evaluatorId,
      finalScore: [8.0, 8.0, 8.5][idx],
      comments: 'Điểm thành viên đã khóa',
      scoreRubricVersion: RUBRIC_VERSION,
      scoreLocked: true,
      lockedAt: new Date('2026-12-15T08:00:00.000Z'),
      lockedBy: evaluatorId,
    }));
    const resultData = {
      registrationId: fixture.id,
      finalScore: 8.2,
      comments: 'Kết quả tổng hợp đã khóa, chờ duyệt',
      evaluatorId: adminId,
      scoreRubricVersion: RUBRIC_VERSION,
      scoreLocked: true,
      lockedAt: new Date('2026-12-15T09:00:00.000Z'),
      lockedBy: adminId,
    };
    assertDefenseEvidence({ councilMemberIds: fixture.council.memberIds, memberScores, defenseResult: resultData });
    await prisma.defenseMemberScore.createMany({ data: memberScores });
    await prisma.defenseResult.create({ data: resultData });
  }

  // Helper for evidence creation
  const createLockedEvidence = async (fixture, finalScore, comments, outcome) => {
    const scoreDiff = outcome === 'PASSED' ? [finalScore - 0.5, finalScore, finalScore + 0.5] : [3.5, 4.0, 3.9];
    const memberScores = fixture.council.memberIds.map((evaluatorId, idx) => ({
      registrationId: fixture.id,
      evaluatorId,
      finalScore: scoreDiff[idx],
      comments: 'Điểm thành viên chính thức',
      scoreRubricVersion: RUBRIC_VERSION,
      scoreLocked: true,
      lockedAt: new Date('2026-12-15T08:00:00.000Z'),
      lockedBy: evaluatorId,
    }));
    const resultData = {
      registrationId: fixture.id,
      finalScore,
      comments,
      evaluatorId: adminId,
      scoreRubricVersion: RUBRIC_VERSION,
      scoreLocked: true,
      lockedAt: new Date('2026-12-15T09:00:00.000Z'),
      lockedBy: adminId,
    };
    assertDefenseEvidence({ councilMemberIds: fixture.council.memberIds, memberScores, defenseResult: resultData });
    await prisma.defenseMemberScore.createMany({ data: memberScores });
    const result = await prisma.defenseResult.create({ data: resultData });
    const fingerprint = hashScoreEvidence({
      defenseCouncilId: fixture.council.id,
      councilId: null,
      periodPolicyVersionId: fixture.periodPolicyVersionId,
      defenseResult: result,
      memberScores,
    });
    return { result, fingerprint };
  };

  const createApproval = (fixture, evidence, outcome, score, supersedesApprovalId = null) =>
    prisma.defenseResultApproval.create({
      data: {
        registrationId: fixture.id,
        defenseResultId: evidence.result.id,
        outcome,
        finalScoreSnapshot: score,
        scoreFingerprint: evidence.fingerprint,
        rubricVersionSnapshot: RUBRIC_VERSION,
        defenseCouncilId: fixture.council.id,
        policyVersionId: fixture.periodPolicyVersionId,
        approvedById: adminId,
        reason: supersedesApprovalId ? 'Điều chỉnh kết quả bảo vệ' : 'Phê duyệt kết quả bảo vệ',
        supersedesApprovalId,
        isEffective: true,
      },
    });

  const snapshot = (publicationId, fixture, approval, outcome, score, replacesPublicationItemId = null) =>
    prisma.resultPublicationItem.create({
      data: {
        publicationId,
        registrationId: fixture.id,
        sourceApprovalId: approval.id,
        replacesPublicationItemId,
        outcomeSnapshot: outcome,
        finalScoreSnapshot: score,
        studentCodeSnapshot: fixture.student.code,
        studentNameSnapshot: fixture.student.fullName,
        topicTitleSnapshot: fixture.topic.title,
      },
    });

  // 116..120: DEFENSE_FAILED (locked scores, approval with outcome FAILED)
  for (let num = 116; num <= 120; num += 1) {
    const fixture = fixtures.get(num);
    if (!fixture || !fixture.council) continue;
    const evidence = await createLockedEvidence(fixture, 3.8, 'Kết quả bảo vệ không đạt yêu cầu', 'FAILED');
    await createApproval(fixture, evidence, 'FAILED', 3.8);
  }

  // 111..115: DEFENSE_PASSED
  // Create evidence and approvals for 113, 114, 115
  const passedApprovals = new Map();
  for (const num of [113, 114, 115]) {
    const fixture = fixtures.get(num);
    if (!fixture || !fixture.council) continue;
    const evidence = await createLockedEvidence(fixture, 8.5, 'Kết quả bảo vệ xuất sắc', 'PASSED');
    const approval = await createApproval(fixture, evidence, 'PASSED', 8.5);
    passedApprovals.set(num, { fixture, approval });
  }

  // 111 (initial) and 112 (supplementary + correction)
  const initialFixture = fixtures.get(111);
  const supplementaryFixture = fixtures.get(112);

  const initialEvidence = await createLockedEvidence(initialFixture, 8.5, 'Kết quả bảo vệ đạt', 'PASSED');
  const supplementaryEvidence = await createLockedEvidence(supplementaryFixture, 8.5, 'Kết quả bảo vệ công bố bổ sung', 'PASSED');

  const initialApproval = await createApproval(initialFixture, initialEvidence, 'PASSED', 8.5);
  const oldApproval = await createApproval(supplementaryFixture, supplementaryEvidence, 'PASSED', 8.5);

  // Publications
  const initial = await prisma.resultPublication.create({
    data: {
      semesterId: targetSemester.id,
      type: 'INITIAL',
      publishedById: adminId,
      publishedAt: new Date('2026-12-16T08:00:00.000Z'),
      idempotencyKey: 'demo-initial-v1',
    },
  });
  await snapshot(initial.id, initialFixture, initialApproval, 'PASSED', 8.5);
  for (const { fixture, approval } of passedApprovals.values()) {
    await snapshot(initial.id, fixture, approval, 'PASSED', 8.5);
  }

  const supplementary = await prisma.resultPublication.create({
    data: {
      semesterId: targetSemester.id,
      type: 'SUPPLEMENTARY',
      previousPublicationId: initial.id,
      reason: 'Bổ sung kết quả demo',
      publishedById: adminId,
      publishedAt: new Date('2026-12-17T08:00:00.000Z'),
      idempotencyKey: 'demo-supplementary-v1',
    },
  });
  const priorItem = await snapshot(supplementary.id, supplementaryFixture, oldApproval, 'PASSED', 8.5);

  await prisma.defenseResultApproval.update({
    where: { id: oldApproval.id },
    data: { isEffective: false, invalidatedAt: new Date('2026-12-18T08:00:00.000Z'), invalidatedReason: 'Điều chỉnh demo' },
  });

  const correctedApproval = await createApproval(supplementaryFixture, supplementaryEvidence, 'PASSED', 8.5, oldApproval.id);
  const correction = await prisma.resultPublication.create({
    data: {
      semesterId: targetSemester.id,
      type: 'CORRECTION',
      previousPublicationId: supplementary.id,
      reason: 'Điều chỉnh kết quả demo',
      publishedById: adminId,
      publishedAt: new Date('2026-12-18T08:00:00.000Z'),
      idempotencyKey: 'demo-correction-v1',
    },
  });
  const correctionItem = await snapshot(correction.id, supplementaryFixture, correctedApproval, 'PASSED', 8.5, priorItem.id);

  return { initial, supplementary, correction, correctionItem };
}

module.exports = {
  RUBRIC_VERSION,
  TIMELINE_TASK_TYPE,
  buildRegistrationFixture,
  seedAcademicFixtures,
  seedDefenseEvidenceAndPublications,
  assertDefenseEvidence,
  statusForStudent,
};
