const { DEFAULT_POLICY, checksum } = require('../../src/services/workflowPolicyService');
const { computeCanonicalPayloadHash } = require('../../src/services/electronicSignatureService');
const { hashScoreEvidence } = require('../../src/services/defenseResultPublicationService');
const { DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS } = require('../../src/services/rubricService');
const { buildAccounts, getSemesterDefinitions, allocateCouncilForRegistration } = require('./demoFixtures');
const { buildStudentProfileData, buildTopicTitleForStudent } = require('./phase1Fixtures');

const RUBRIC_VERSION = DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.version;
const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
const addHours = (base, hours) => new Date(base.getTime() + hours * HOUR_MS);
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

const PHASE2_COHORTS = Object.freeze({
  // Chặng 1A — BM02 & Quyết định giao đề tài (HK2: sv001 – sv024)
  HK2_BM01_PASSED_OPEN_BM02: createRange(1, 8),
  HK2_BM02_SUBMITTED: createRange(9, 14),
  HK2_BM02_NEEDS_REVISION: createRange(15, 18),
  HK2_BM02_APPROVED_READY_DECISION: createRange(19, 24),

  // Chặng 1B — Cửa sổ 168h BM02-A 3 chữ ký & Phụ lục điều chỉnh tên theo đợt (HK1: sv025 – sv048)
  HK1_DECISION_ISSUED_OPEN_168H: createRange(25, 30),
  HK1_BM02A_PENDING_ADVISOR: createRange(31, 34),
  HK1_BM02A_RETURNED_FOR_CORRECTION: createRange(35, 38),
  HK1_BM02A_PENDING_DEPARTMENT: createRange(39, 42),
  HK1_BM02A_APPROVED_PENDING_APPENDIX: createRange(43, 45),
  HK1_BM02A_ADJUSTMENT_ISSUED: createRange(46, 48),

  // Chặng 2 — BM03 Nhật ký hướng dẫn, Đánh giá giữa/cuối kỳ, Viện thẩm định dừng 7+3d & Xác nhận 48h (HK1: sv049 – sv078)
  HK1_BM03_IN_PROGRESS_MEETINGS: createRange(49, 56),
  HK1_BM03_STOP_REVIEW_MIDTERM: createRange(57, 59),
  HK1_BM03_STOP_REVIEW_FINAL_EXTENDED: createRange(60, 62),
  HK1_BM03_READY_ADVISOR_WHOLE_SIGN: createRange(63, 68),
  HK1_BM03_PENDING_STUDENT_ACK_48H: createRange(69, 74),
  HK1_BM03_PASSED_ARCHIVE_SUBMITTED: createRange(75, 78),

  // Chặng 3 — BM04 Đánh giá 4 tiêu chí + 2 kết luận, Viện thẩm định không bảo vệ & Hội đồng bảo vệ (HK1: sv079 – sv120)
  HK1_BM04_DRAFT_OPEN: createRange(79, 84),
  HK1_BM04_REJECT_PENDING_INSTITUTE: createRange(85, 90),
  HK1_DEFENSE_READY: createRange(91, 94), // 91-92 BM04 passed, 93-94 ELIGIBLE_BY_INSTITUTE
  HK1_DEFENSE_SCHEDULED_SHIFT: createRange(95, 98), // 95: 1 member locked, 96: 3 members locked, 97: ABSENT, 98: afternoon shift
  HK1_DEFENSE_AWAITING_APPROVAL: createRange(99, 100), // Chairman locked scorebook, awaiting publication
  HK1_DEFENSE_PASSED_ARCHIVING: createRange(101, 104), // Published DEFENSE_PASSED, 14-day archival window
  HK1_DEFENSE_PASSED_PENDING_DIRECTOR: createRange(105, 106), // PENDING_INSTITUTE_SIGNATURE
  HK1_ARCHIVE_REJECTED: createRange(107, 108), // ARCHIVE_REJECTED
  HK1_ARCHIVE_INCOMPLETE: createRange(109, 110), // ARCHIVE_INCOMPLETE (+15d closed with missing files)
  HK1_DEFENSE_FAILED: createRange(111, 114), // sv111-112 score < 5.0, sv113-114 ABSENT
  HK1_COMPLETED: createRange(115, 120), // COMPLETED with Director signed certificate & immutable PDF
});

function resolveHK1MentorIndex(studentNumber) {
  const swaps = new Map([
    [31, 0], [37, 6],
    [32, 1], [38, 7],
    [61, 2], [63, 0],
    [62, 3], [64, 1],
    [79, 0], [85, 6],
    [80, 1], [86, 7],
  ]);
  if (swaps.has(studentNumber)) {
    return swaps.get(studentNumber);
  }
  return (studentNumber - 25) % 12;
}

function buildBM02AVersionPayload({ registrationId, versionNumber, registeredTitleSnapshot, proposedTitle, reason, studentSnapshot }) {
  return {
    registrationId: Number(registrationId),
    versionNumber: Number(versionNumber || 1),
    registeredTitleSnapshot: String(registeredTitleSnapshot || '').trim(),
    proposedTitle: String(proposedTitle || '').trim(),
    reason: String(reason || '').trim(),
    studentSnapshot: studentSnapshot || {},
  };
}

async function createDefenseCouncils(prisma, semesterId, lecturers, defenseDate, rubricVersionId) {
  const councils = [];
  for (let index = 0; index < 4; index += 1) {
    const members = lecturers.slice(index * 3, index * 3 + 3);
    const council = await prisma.council.create({
      data: {
        semesterId,
        name: `Hội đồng bảo vệ đồ án ${index + 1}`,
        councilType: 'DEFENSE_COUNCIL',
        location: `Hội trường B20${index + 1}`,
        defenseDate,
        meetingMode: 'IN_PERSON',
        schedulePublishedAt: addDays(defenseDate, -5),
        rubricVersionId: rubricVersionId || null,
        scoreBookLocked: false,
      },
    });
    await prisma.councilMember.createMany({
      data: members.map((lecturer, memberIndex) => ({
        councilId: council.id,
        lecturerId: lecturer.id,
        roleInCouncil: ['CHAIRMAN', 'SECRETARY', 'REVIEWER'][memberIndex],
        isScoringMember: true,
        isActive: true,
      })),
    });
    councils.push({
      id: council.id,
      name: council.name,
      memberIds: members.map((m) => m.id),
    });
  }
  return councils;
}

async function seedPhase2AcademicFixtures({ prisma, accountsByEmail, baseDate = new Date() }) {
  const now = baseDate instanceof Date ? new Date(baseDate.getTime()) : new Date(baseDate);
  const semesterDefs = getSemesterDefinitions(now);

  const admin = accountsByEmail.get('admin@university.edu.vn');
  const lecturer01 = accountsByEmail.get('lecturer01@university.edu.vn'); // Viện trưởng
  const lecturer02 = accountsByEmail.get('lecturer02@university.edu.vn'); // Phụ trách bộ môn (ủy quyền BM02 & BM02-A)
  const lecturer03 = accountsByEmail.get('lecturer03@university.edu.vn');

  // 1. Create 2 Semesters
  const semesterHK1Record = await prisma.semester.create({
    data: {
      ...semesterDefs.semesterHK1,
      status: 'ONGOING',
      outlineSubmissionOpenAt: addDays(now, -75),
      outlineSubmissionDeadline: addDays(now, -55),
      lockedPolicyVersionId: null,
    },
  });

  const semesterHK2Record = await prisma.semester.create({
    data: {
      ...semesterDefs.semesterHK2,
      status: 'ONGOING',
      registrationOpen: true,
      outlineSubmissionOpenAt: addDays(now, -25),
      outlineSubmissionDeadline: addDays(now, -5),
      lockedPolicyVersionId: null,
    },
  });

  // 2. Workflow Policy Versions
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

  // 3. Project Catalog
  const catalog = await prisma.projectCatalog.create({
    data: {
      code: 'DATN',
      name: 'Đồ án tốt nghiệp',
      isActive: true,
    },
  });

  // 4. Standardized Rubric (4 groups, 14 criteria, 10.0 maxScore, CLO and 4 levels)
  const rubric = await prisma.rubricVersion.create({
    data: {
      version: DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.version,
      title: DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.title,
      description: DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS.description,
      totalMaxScore: 10.0,
      isActive: true,
      status: 'ACTIVE',
      lockedAt: addDays(now, -10),
      lockedById: admin.id,
      createdById: admin.id,
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
              label: crit.label,
              description: crit.description,
              maxScore: crit.maxScore,
              orderIndex: crit.orderIndex || crIdx + 1,
              cloCode: crit.cloCode,
              levelGoodDesc: crit.levelGoodDesc,
              levelFairDesc: crit.levelFairDesc,
              levelAverageDesc: crit.levelAverageDesc,
              levelPoorDesc: crit.levelPoorDesc,
            })),
          },
        })),
      },
    },
  });

  await prisma.semester.update({
    where: { id: semesterHK1Record.id },
    data: {
      lockedPolicyVersionId: policyHK1.id,
      lockedDefenseRubricVersionId: rubric.id,
      defenseEligibleListPublishedAt: addDays(now, -5),
    },
  });
  await prisma.semester.update({
    where: { id: semesterHK2Record.id },
    data: { lockedPolicyVersionId: policyHK2.id },
  });

  // 5. Academic Delegations for lecturer02 (Phụ trách bộ môn) & expired delegation for lecturer03
  const delegationBM02Review = await prisma.academicDelegation.create({
    data: {
      delegatorId: lecturer01.id,
      delegateeId: lecturer02.id,
      capabilityCode: 'BM02_REVIEW',
      department: 'Viện Công nghệ số',
      semesterId: semesterHK2Record.id,
      effectiveFrom: addDays(now, -10),
      effectiveTo: addDays(now, 60),
      reason: 'Ủy quyền Phụ trách bộ môn thẩm định đơn đăng ký đề tài BM02',
      idempotencyKey: 'phase2-delegation-bm02-review',
      status: 'ACTIVE',
    },
  });

  const delegationBM02View = await prisma.academicDelegation.create({
    data: {
      delegatorId: lecturer01.id,
      delegateeId: lecturer02.id,
      capabilityCode: 'VIEW_BM02_REVIEWS',
      department: 'Viện Công nghệ số',
      semesterId: semesterHK2Record.id,
      effectiveFrom: addDays(now, -10),
      effectiveTo: addDays(now, 60),
      reason: 'Ủy quyền xem danh sách duyệt đơn đăng ký đề tài BM02',
      idempotencyKey: 'phase2-delegation-bm02-view',
      status: 'ACTIVE',
    },
  });

  const delegationBM02AFinalApprove = await prisma.academicDelegation.create({
    data: {
      delegatorId: lecturer01.id,
      delegateeId: lecturer02.id,
      capabilityCode: 'BM02A_FINAL_APPROVE',
      department: 'Viện Công nghệ số',
      semesterId: semesterHK1Record.id,
      effectiveFrom: addDays(now, -10),
      effectiveTo: addDays(now, 60),
      reason: 'Ủy quyền Phụ trách bộ môn ký duyệt bước 3 phiếu điều chỉnh tên đề tài BM02-A',
      idempotencyKey: 'phase2-delegation-bm02a-approve',
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
      effectiveFrom: addDays(now, -90),
      effectiveTo: addDays(now, -15),
      reason: 'Ủy quyền xét duyệt đề cương BM01 Học kỳ 1 (Đã hết hiệu lực)',
      idempotencyKey: 'phase2-delegation-expired',
      status: 'ACTIVE',
    },
  });

  // 6. Public Announcements
  await prisma.publicAnnouncement.createMany({
    data: [
      {
        title: 'Công bố Quyết định giao đề tài tốt nghiệp HK1 (Số QD-2026-DATN-HK1) và thời hạn 168h điều chỉnh tên BM02-A',
        content: 'Sinh viên thuộc HK1 kiểm tra tên đề tài trong Quyết định số QD-2026-DATN-HK1. Nếu cần điều chỉnh tên đề tài, sinh viên lập và ký gửi phiếu BM02-A trong vòng 168 giờ (07 ngày) kể từ thời điểm công bố.',
        category: 'ACADEMIC',
        isPublished: true,
        isPinned: true,
        authorId: admin.id,
      },
      {
        title: 'Hướng dẫn ghi nhật ký BM03, xác nhận 48h của sinh viên và lập phiếu nhận xét BM04',
        content: 'Giảng viên hướng dẫn ký khóa từng buổi hướng dẫn, đánh giá giữa/cuối giai đoạn và ký toàn phiếu BM03. Sinh viên có 48 giờ để xác nhận trên hệ thống trước khi chuyển sang bước đánh giá BM04.',
        category: 'ACADEMIC',
        isPublished: true,
        isPinned: true,
        authorId: admin.id,
      },
      {
        title: 'Lịch bảo vệ chính thức Hội đồng đồ án tốt nghiệp Học kỳ 1 năm học 2026–2027',
        content: 'Danh sách phân công 4 Hội đồng bảo vệ đồ án tốt nghiệp đã được công bố. Sinh viên hoàn tất lưu trữ trước bảo vệ và theo dõi lịch trình.',
        category: 'DEFENSE',
        isPublished: true,
        isPinned: false,
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

  // 9. Defense Councils in HK1 (for sv095 - sv120)
  const defenseCouncils = await createDefenseCouncils(prisma, semesterHK1Record.id, lecturers, now, rubric.id);
  const councilLoadMap = new Map(defenseCouncils.map((c) => [c.id, 0]));

  const registrations = new Map();

  // =========================================================================================
  // CHẶNG 1A — BM02 & QUYẾT ĐỊNH GIAO ĐỀ TÀI (sv001 – sv024, thuộc HK2)
  // =========================================================================================
  for (let number = 1; number <= 24; number += 1) {
    const student = students[number - 1];
    const mentor = lecturers[(number - 1) % 12];
    const padStr = String(number).padStart(3, '0');
    const studentSnap = studentSnapshots.get(number);
    const bm01Title = buildTopicTitleForStudent(number);

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
        proposedById: mentor.id,
        maxStudents: 1,
        title: bm01Title,
        description: `Đề tài tốt nghiệp đã qua vòng xét duyệt đề cương BM01 của sinh viên ${padStr}.`,
        status: 'APPROVED',
      },
    });

    let regStatus = 'BM01_PASSED';
    if (number >= 9 && number <= 14) regStatus = 'BM02_SUBMITTED';
    else if (number >= 15 && number <= 18) regStatus = 'BM02_NEEDS_REVISION';
    else if (number >= 19 && number <= 24) regStatus = 'BM02_APPROVED';

    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK2Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK2.id,
        status: regStatus,
        outlineReviewStatus: 'PASSED',
        bm01ApprovedTitleSnapshot: bm01Title,
        stateVersion: 1,
      },
    });

    // Ensure completed BM01 task
    await prisma.task.create({
      data: {
        registrationId: registration.id,
        title: 'BM01 - Đề cương chi tiết đồ án',
        content: 'Đã hoàn thành xét duyệt đề cương BM01.',
        taskType: 'BM01',
        status: 'COMPLETED',
      },
    });

    if (number <= 8) {
      // sv001 - sv008: BM01_PASSED, Task BM02 đang OPEN
      await prisma.task.create({
        data: {
          registrationId: registration.id,
          title: 'Nộp đơn đăng ký đề tài chính thức (BM02)',
          content: 'Hoàn thiện đơn đăng ký đề tài BM02 (giữ nguyên tên BM01 hoặc tinh chỉnh tên đề tài kèm lý do).',
          taskType: 'BM02',
          dueDate: addDays(now, 10),
          status: 'OPEN',
        },
      });
    } else if (number <= 14) {
      // sv009 - sv014: BM02_SUBMITTED (có tinh chỉnh tên bm02ProposedTitle kèm titleChangeReason rõ ràng)
      const refinedTitle = `${bm01Title} — Tối ưu hóa hiệu năng thực tế`;
      const bm02 = await prisma.bM02Submission.create({
        data: {
          registrationId: registration.id,
          versionNo: 1,
          attemptNo: 1,
          outcome: 'PENDING_REVIEW',
          content: `Đơn đăng ký đề tài tốt nghiệp BM02 của sinh viên ${student.fullName}. Đề xuất tinh chỉnh tên đề tài sát với phạm vi triển khai thực nghiệm.`,
          bm01ApprovedTitle: bm01Title,
          bm02ProposedTitle: refinedTitle,
          titleChangeReason: 'Tinh chỉnh phạm vi tên đề tài theo góp ý của Hội đồng xét duyệt đề cương BM01 để phản ánh rõ mô-đun tối ưu hóa hiệu năng.',
          studentSnapshot: studentSnap,
          mentorSnapshot: { id: mentor.id, fullName: mentor.fullName, email: mentor.email, code: mentor.code },
          fileUrl: `/uploads/demo/bm02/BM02_v1_SV${padStr}.pdf`,
          fileName: `BM02_v1_SV${padStr}.pdf`,
          submittedById: student.id,
          submittedAt: addHours(now, -18),
          policyVersionId: policyHK2.id,
        },
      });
      await prisma.topicRegistration.update({
        where: { id: registration.id },
        data: { currentBM02SubmissionId: bm02.id },
      });
      await prisma.task.create({
        data: {
          registrationId: registration.id,
          title: 'Nộp đơn đăng ký đề tài chính thức (BM02)',
          content: 'Đơn BM02 đang chờ Viện / Bộ môn thẩm định.',
          taskType: 'BM02',
          dueDate: addDays(now, 10),
          status: 'SUBMITTED',
        },
      });
    } else if (number <= 18) {
      // sv015 - sv018: BM02_NEEDS_REVISION (attemptNo = 1, outcome = REVISION_REQUIRED, revisionDeadlineAt +5 ngày)
      const bm02 = await prisma.bM02Submission.create({
        data: {
          registrationId: registration.id,
          versionNo: 1,
          attemptNo: 1,
          outcome: 'REVISION_REQUIRED',
          issues: ['Cần bổ sung chi tiết mục tiêu đầu ra dự kiến và chuẩn hóa lại thuật ngữ tiếng Việt trong tên đề tài đề xuất.'],
          content: `Đơn đăng ký đề tài BM02 lần 1 của sinh viên ${student.fullName}.`,
          bm01ApprovedTitle: bm01Title,
          bm02ProposedTitle: `${bm01Title} (Bản thử nghiệm)`,
          titleChangeReason: 'Cập nhật lại tên đề tài cho phù hợp với bài toán thử nghiệm.',
          studentSnapshot: studentSnap,
          mentorSnapshot: { id: mentor.id, fullName: mentor.fullName, email: mentor.email, code: mentor.code },
          fileUrl: `/uploads/demo/bm02/BM02_v1_SV${padStr}.pdf`,
          fileName: `BM02_v1_SV${padStr}.pdf`,
          submittedById: student.id,
          submittedAt: addDays(now, -3),
          reviewedById: lecturer01.id,
          reviewedAt: addDays(now, -1),
          notifiedAt: addDays(now, -1),
          revisionDeadlineAt: addDays(now, 5),
          policyVersionId: policyHK2.id,
        },
      });
      await prisma.topicRegistration.update({
        where: { id: registration.id },
        data: { currentBM02SubmissionId: bm02.id },
      });
      await prisma.task.create({
        data: {
          registrationId: registration.id,
          title: 'Nộp đơn đăng ký đề tài chính thức (BM02)',
          content: 'Cần chỉnh sửa và nộp lại BM02 lần 2 trước thời hạn.',
          taskType: 'BM02',
          dueDate: addDays(now, 5),
          status: 'REVISION',
        },
      });
    } else {
      // sv019 - sv024: BM02_APPROVED (sẵn sàng để tạo và công bố Quyết định giao đề tài cho HK2)
      const approvedTitle = number % 2 === 0 ? `${bm01Title} — Ứng dụng thực tiễn tại doanh nghiệp` : bm01Title;
      const bm02 = await prisma.bM02Submission.create({
        data: {
          registrationId: registration.id,
          versionNo: 1,
          attemptNo: 1,
          outcome: 'APPROVED',
          content: `Đơn đăng ký đề tài chính thức BM02 của sinh viên ${student.fullName}, đã được Viện thẩm định thông qua.`,
          bm01ApprovedTitle: bm01Title,
          bm02ProposedTitle: approvedTitle,
          titleChangeReason: approvedTitle !== bm01Title ? 'Làm rõ phạm vi ứng dụng thực tiễn tại doanh nghiệp.' : null,
          studentSnapshot: studentSnap,
          mentorSnapshot: { id: mentor.id, fullName: mentor.fullName, email: mentor.email, code: mentor.code },
          fileUrl: `/uploads/demo/bm02/BM02_Approved_SV${padStr}.pdf`,
          fileName: `BM02_Approved_SV${padStr}.pdf`,
          submittedById: student.id,
          submittedAt: addDays(now, -4),
          reviewedById: lecturer01.id,
          reviewedAt: addDays(now, -2),
          notifiedAt: addDays(now, -2),
          policyVersionId: policyHK2.id,
        },
      });
      await prisma.topicRegistration.update({
        where: { id: registration.id },
        data: { currentBM02SubmissionId: bm02.id },
      });
      await prisma.task.create({
        data: {
          registrationId: registration.id,
          title: 'Nộp đơn đăng ký đề tài chính thức (BM02)',
          content: 'Đơn BM02 đã được phê duyệt, chờ ban hành Quyết định giao đề tài.',
          taskType: 'BM02',
          status: 'COMPLETED',
        },
      });
    }

    registrations.set(number, { ...registration, student, topic, mentor });
  }

  // =========================================================================================
  // CHẶNG 1B, 2, 3 — QUYẾT ĐỊNH GIAO ĐỀ TÀI HK1 (sv025 – sv120)
  // Ban hành sẵn TopicAssignmentDecision số QD-2026-DATN-HK1 ở trạng thái PUBLISHED,
  // decisionPublishedAt = now - 48h, titleAdjustmentDeadline = now + 120h (còn 5 ngày trong cửa sổ 168h)
  // =========================================================================================
  const decisionPublishedAt = addHours(now, -48);
  const titleAdjustmentDeadline = addHours(now, 120); // decisionPublishedAt + 168h
  const appendix1SignedDate = addHours(now, -24);

  const hk1Decision = await prisma.topicAssignmentDecision.create({
    data: {
      semesterId: semesterHK1Record.id,
      decisionNumber: 'QD-2026-DATN-HK1',
      decisionDate: decisionPublishedAt,
      decisionPublishedAt,
      fileUrl: '/uploads/demo/decisions/QD-2026-DATN-HK1.pdf',
      fileName: 'QD-2026-DATN-HK1.pdf',
      issuedById: lecturer01.id,
      policyVersionId: policyHK1.id,
      status: 'PUBLISHED',
      idempotencyKey: 'phase2-hk1-published-decision',
    },
  });

  // Create Phụ lục Đợt 1 (PL-01/QD-2026-DATN-HK1) status ISSUED, signedDate = now - 24h
  // Used by sv046 - sv048 (and sv079 - sv080 in BM04 stage to demonstrate effectiveTitleSnapshot from Appendix)
  const appendix1Issued = await prisma.titleAdjustmentAppendix.create({
    data: {
      decisionId: hk1Decision.id,
      appendixNumber: 'PL-01/QD-2026-DATN-HK1',
      sequenceNo: 1,
      signedDate: appendix1SignedDate,
      recordedAt: appendix1SignedDate,
      fileUrl: '/uploads/demo/appendices/PL-01_QD-2026-DATN-HK1.pdf',
      fileName: 'PL-01_QD-2026-DATN-HK1.pdf',
      issuedById: lecturer01.id,
      status: 'ISSUED',
      idempotencyKey: 'phase2-hk1-appendix-01',
    },
  });

  // Helper to create a signed BM02A request + version + 3 signatures + appendix item for students with ISSUED appendix
  const createIssuedBM02AAndAppendixItem = async ({ registration, student, mentor, studentSnap, oldTitle, newTitle, seqKey }) => {
    const req = await prisma.bM02AAdjustmentRequest.create({
      data: {
        registrationId: registration.id,
        decisionId: hk1Decision.id,
        status: 'ADJUSTMENT_ISSUED',
        revisionCount: 0,
        currentVersionNumber: 1,
        titleAdjustmentDeadline,
        createdById: student.id,
      },
    });

    const v1Payload = buildBM02AVersionPayload({
      registrationId: registration.id,
      versionNumber: 1,
      registeredTitleSnapshot: oldTitle,
      proposedTitle: newTitle,
      reason: 'Điều chỉnh tên đề tài để phản ánh chính xác mô hình kiến trúc và dữ liệu thực nghiệm đã triển khai.',
      studentSnapshot: studentSnap,
    });
    const v1Hash = computeCanonicalPayloadHash(v1Payload);

    const ver = await prisma.bM02AFormVersion.create({
      data: {
        requestId: req.id,
        versionNumber: 1,
        studentSnapshot: studentSnap,
        registeredTitleSnapshot: oldTitle,
        proposedTitle: newTitle,
        reason: v1Payload.reason,
        payloadHash: v1Hash,
        isLocked: true,
      },
    });

    const stuSig = await prisma.electronicSignatureEvent.create({
      data: {
        registrationId: registration.id,
        entityType: 'BM02A_VERSION',
        entityId: ver.id,
        versionNumber: 1,
        signerId: student.id,
        signerRole: 'STUDENT',
        action: 'SIGN',
        signedAt: addHours(now, -36),
        payloadHash: v1Hash,
      },
    });
    const advSig = await prisma.electronicSignatureEvent.create({
      data: {
        registrationId: registration.id,
        entityType: 'BM02A_VERSION',
        entityId: ver.id,
        versionNumber: 1,
        signerId: mentor.id,
        signerRole: 'ADVISOR',
        action: 'SIGN',
        signedAt: addHours(now, -30),
        payloadHash: v1Hash,
      },
    });
    const deptSig = await prisma.electronicSignatureEvent.create({
      data: {
        registrationId: registration.id,
        entityType: 'BM02A_VERSION',
        entityId: ver.id,
        versionNumber: 1,
        signerId: lecturer02.id,
        signerRole: 'DEPARTMENT_HEAD',
        action: 'SIGN',
        signedAt: addHours(now, -26),
        payloadHash: v1Hash,
      },
    });

    const pdfUrl = `/uploads/academic-pdfs/BM02A_reg${registration.id}_v1_${seqKey}.pdf`;
    await prisma.bM02AFormVersion.update({
      where: { id: ver.id },
      data: {
        studentSignatureEventId: stuSig.id,
        advisorSignatureEventId: advSig.id,
        departmentSignatureEventId: deptSig.id,
      },
    });
    await prisma.bM02AAdjustmentRequest.update({
      where: { id: req.id },
      data: {
        finalPayloadHash: v1Hash,
        finalPdfFileUrl: pdfUrl,
      },
    });

    await prisma.titleAdjustmentAppendixItem.create({
      data: {
        appendixId: appendix1Issued.id,
        bm02aRequestId: req.id,
        registrationId: registration.id,
        oldTitle,
        newTitle,
      },
    });

    await prisma.topicRegistration.update({
      where: { id: registration.id },
      data: { adjustedTitle: newTitle },
    });
  };

  // Helper to create 3 locked BM03 meetings + Midterm CONTINUE + Final CONTINUE_TO_BM04
  const createCompletedBM03MeetingsAndStages = async ({ registration, mentor, effectiveTitle, signWholeRecord = false, acknowledgeByStudent = false, padStr }) => {
    const bm03Record = await prisma.bM03ProgressRecord.create({
      data: {
        registrationId: registration.id,
        effectiveTitleSnapshot: effectiveTitle,
        finalConclusion: 'CONTINUE_TO_BM04',
        isClosedEarly: false,
      },
    });

    const meetingConfigs = [
      {
        daysAgo: 35,
        mode: 'IN_PERSON',
        loc: 'Phòng Lab A204',
        discuss: 'Thống nhất kiến trúc chi tiết, phân tích yêu cầu hệ thống và thiết kế lược đồ CSDL.',
        work: 'Hoàn thành tài liệu đặc tả yêu cầu và sơ đồ ERD chuẩn hóa.',
        next: 'Xây dựng các API cốt lõi và kiểm thử đơn vị (Unit Test).',
        rating: 'ON_TRACK',
      },
      {
        daysAgo: 21,
        mode: 'IN_PERSON',
        loc: 'Phòng Lab A204',
        discuss: 'Rà soát tiến độ giữa kỳ, kiểm tra mô-đun nghiệp vụ chính và giao diện người dùng.',
        work: 'Hoàn thành 65% chức năng cốt lõi, tích hợp xác thực và phân quyền.',
        next: 'Hoàn thiện toàn bộ luồng nghiệp vụ và viết báo cáo chương 1, 2, 3.',
        rating: 'ON_TRACK',
      },
      {
        daysAgo: 7,
        mode: 'IN_PERSON',
        loc: 'Phòng bộ môn CNTT',
        discuss: 'Nghiệm thu sản phẩm thực nghiệm cuối kỳ và rà soát bản thảo báo cáo toàn văn.',
        work: 'Hoàn thành 100% chức năng, chạy kiểm thử tích hợp và hoàn thiện thuyết minh.',
        next: 'Chuẩn bị hồ sơ lưu trữ trước bảo vệ và slide thuyết trình.',
        rating: 'ON_TRACK',
      },
    ];

    const midComments = 'Sinh viên thực hiện đúng tiến độ đề ra, nắm vững công nghệ và hoàn thành tốt mục tiêu giữa kỳ.';
    const midHash = computeCanonicalPayloadHash({
      registrationId: registration.id,
      stage: 'MIDTERM',
      comments: midComments,
      decision: 'CONTINUE',
    });
    const finComments = 'Sinh viên hoàn thành đầy đủ nội dung nghiên cứu và sản phẩm thực nghiệm, đủ điều kiện chuyển sang bước đánh giá BM04.';
    const finHash = computeCanonicalPayloadHash({
      registrationId: registration.id,
      stage: 'FINAL',
      comments: finComments,
      decision: 'CONTINUE_TO_BM04',
    });

    const [, midEval, finEval] = await Promise.all([
      Promise.all(
        meetingConfigs.map(async (cfg) => {
          const mDate = addDays(now, -cfg.daysAgo);
          const expDate = addDays(mDate, 10);
          const mEntry = await prisma.bM03MeetingEntry.create({
            data: {
              bm03RecordId: bm03Record.id,
              registrationId: registration.id,
              versionNumber: 1,
              meetingDate: mDate,
              meetingMode: cfg.mode,
              locationOrLink: cfg.loc,
              discussionContent: cfg.discuss,
              studentCompletedWork: cfg.work,
              remainingIssues: 'Không có vướng mắc nghiêm trọng.',
              nextTasks: cfg.next,
              expectedDeadline: expDate,
              progressRating: cfg.rating,
              isLocked: false,
            },
          });
          const mHash = computeCanonicalPayloadHash({
            meetingId: mEntry.id,
            registrationId: registration.id,
            versionNumber: 1,
            meetingDate: mEntry.meetingDate,
            meetingMode: mEntry.meetingMode,
            locationOrLink: mEntry.locationOrLink,
            discussionContent: mEntry.discussionContent,
            studentCompletedWork: mEntry.studentCompletedWork,
            remainingIssues: mEntry.remainingIssues,
            nextTasks: mEntry.nextTasks,
            expectedDeadline: mEntry.expectedDeadline,
            progressRating: mEntry.progressRating,
          });
          const mSig = await prisma.electronicSignatureEvent.create({
            data: {
              registrationId: registration.id,
              entityType: 'BM03_MEETING',
              entityId: mEntry.id,
              versionNumber: 1,
              signerId: mentor.id,
              signerRole: 'ADVISOR',
              action: 'SIGN',
              signedAt: addHours(mDate, 2),
              payloadHash: mHash,
            },
          });
          await prisma.bM03MeetingEntry.update({
            where: { id: mEntry.id },
            data: {
              isLocked: true,
              advisorSignedById: mentor.id,
              advisorSignedAt: addHours(mDate, 2),
              payloadHash: mHash,
              signatureEventId: mSig.id,
            },
          });
        })
      ),
      prisma.bM03StageEvaluation.create({
        data: {
          bm03RecordId: bm03Record.id,
          registrationId: registration.id,
          stage: 'MIDTERM',
          comments: midComments,
          decision: 'CONTINUE',
          evaluatedById: mentor.id,
          evaluatedAt: addDays(now, -20),
          payloadHash: midHash,
        },
      }),
      prisma.bM03StageEvaluation.create({
        data: {
          bm03RecordId: bm03Record.id,
          registrationId: registration.id,
          stage: 'FINAL',
          comments: finComments,
          decision: 'CONTINUE_TO_BM04',
          evaluatedById: mentor.id,
          evaluatedAt: addDays(now, -5),
          payloadHash: finHash,
        },
      }),
    ]);

    const recordUpdate = {
      midtermStageEvaluationId: midEval.id,
      finalStageEvaluationId: finEval.id,
      finalConclusion: 'CONTINUE_TO_BM04',
    };

    if (signWholeRecord) {
      const advisorSignedAt = addHours(now, -12);
      const recordPayloadHash = computeCanonicalPayloadHash({
        bm03RecordId: bm03Record.id,
        registrationId: registration.id,
        effectiveTitleSnapshot: effectiveTitle,
        finalConclusion: 'CONTINUE_TO_BM04',
        isClosedEarly: false,
      });
      const advRecordSig = await prisma.electronicSignatureEvent.create({
        data: {
          registrationId: registration.id,
          entityType: 'BM03_RECORD',
          entityId: bm03Record.id,
          versionNumber: 1,
          signerId: mentor.id,
          signerRole: 'ADVISOR',
          action: 'SIGN',
          signedAt: advisorSignedAt,
          payloadHash: recordPayloadHash,
        },
      });
      recordUpdate.advisorSignedById = mentor.id;
      recordUpdate.advisorSignedAt = advisorSignedAt;
      recordUpdate.advisorPayloadHash = recordPayloadHash;
      recordUpdate.advisorSignatureEventId = advRecordSig.id;
      recordUpdate.studentAckStatus = 'PENDING_STUDENT_ACKNOWLEDGEMENT';
      recordUpdate.studentAckDeadlineAt = addHours(now, 36); // advisorSignedAt (-12h) + 48h = +36h

      if (acknowledgeByStudent) {
        const ackAt = addHours(now, -6);
        const stuAckSig = await prisma.electronicSignatureEvent.create({
          data: {
            registrationId: registration.id,
            entityType: 'BM03_RECORD',
            entityId: bm03Record.id,
            versionNumber: 1,
            signerId: registration.studentId,
            signerRole: 'STUDENT',
            action: 'ACKNOWLEDGE',
            signedAt: ackAt,
            payloadHash: recordPayloadHash,
          },
        });
        recordUpdate.studentAckStatus = 'ACKNOWLEDGED';
        recordUpdate.studentAckAt = ackAt;
        recordUpdate.studentComment = 'Em xác nhận đầy đủ nội dung nhật ký hướng dẫn và kết luận đánh giá BM03 của thầy/cô.';
        recordUpdate.studentSignatureEventId = stuAckSig.id;
        recordUpdate.finalPdfFileUrl = `/uploads/academic-pdfs/BM03_reg${registration.id}_v1_SV${padStr}.pdf`;
      }
    }

    return prisma.bM03ProgressRecord.update({
      where: { id: bm03Record.id },
      data: recordUpdate,
    });
  };

  // Loop through all HK1 students: sv025 – sv120
  for (let number = 25; number <= 120; number += 1) {
    const student = students[number - 1];
    const mentor = lecturers[resolveHK1MentorIndex(number)];
    const padStr = String(number).padStart(3, '0');
    const studentSnap = studentSnapshots.get(number);
    const initialTitle = buildTopicTitleForStudent(number);
    if (number % 15 === 0 || number >= 90) {
      console.log(`[seed:phase2] Seeding student ${number}/120`);
    }

    // Determine target status & council for sv025..sv120
    let status = 'DECISION_ISSUED';
    let defenseCouncil = null;
    let defenseSessionShift = null;
    let defenseOrderInShift = null;
    let defenseSequenceNo = null;

    if (number >= 49 && number <= 56) status = 'IN_PROGRESS';
    else if (number >= 57 && number <= 62) status = 'STOP_REVIEW_PENDING';
    else if (number >= 63 && number <= 74) status = 'IN_PROGRESS';
    else if (number >= 75 && number <= 84) status = 'BM03_PASSED';
    else if (number >= 85 && number <= 90) status = 'BM04_REVIEW';
    else if (number >= 91 && number <= 94) {
      status = 'DEFENSE_READY'; // 91-92 BM04 passed, 93-94 ELIGIBLE_BY_INSTITUTE
    } else if (number >= 95 && number <= 98) {
      status = 'AWAITING_SCORES';
      defenseCouncil = allocateCouncilForRegistration({ mentorId: mentor.id, councils: defenseCouncils, councilLoadMap });
      defenseSessionShift = number === 98 ? 'AFTERNOON' : 'MORNING';
      defenseOrderInShift = number === 98 ? 1 : (number - 94);
      defenseSequenceNo = number - 94;
    } else if (number >= 99 && number <= 100) {
      status = 'AWAITING_FINAL_APPROVAL';
      defenseCouncil = allocateCouncilForRegistration({ mentorId: mentor.id, councils: defenseCouncils, councilLoadMap });
      defenseSessionShift = 'MORNING';
      defenseOrderInShift = number - 98;
      defenseSequenceNo = number - 94;
    } else if (number >= 101 && number <= 104) {
      status = 'DEFENSE_PASSED';
      defenseCouncil = allocateCouncilForRegistration({ mentorId: mentor.id, councils: defenseCouncils, councilLoadMap });
      defenseSessionShift = 'MORNING';
      defenseOrderInShift = number - 100;
      defenseSequenceNo = number - 94;
    } else if (number >= 105 && number <= 106) {
      status = 'PENDING_INSTITUTE_SIGNATURE';
      defenseCouncil = allocateCouncilForRegistration({ mentorId: mentor.id, councils: defenseCouncils, councilLoadMap });
      defenseSessionShift = 'AFTERNOON';
      defenseOrderInShift = number - 104;
      defenseSequenceNo = number - 94;
    } else if (number >= 107 && number <= 108) {
      status = 'ARCHIVE_REJECTED';
      defenseCouncil = allocateCouncilForRegistration({ mentorId: mentor.id, councils: defenseCouncils, councilLoadMap });
      defenseSessionShift = 'AFTERNOON';
      defenseOrderInShift = number - 104;
      defenseSequenceNo = number - 94;
    } else if (number >= 109 && number <= 110) {
      status = 'ARCHIVE_INCOMPLETE';
      defenseCouncil = allocateCouncilForRegistration({ mentorId: mentor.id, councils: defenseCouncils, councilLoadMap });
      defenseSessionShift = 'AFTERNOON';
      defenseOrderInShift = number - 104;
      defenseSequenceNo = number - 94;
    } else if (number >= 111 && number <= 114) {
      status = 'DEFENSE_FAILED';
      defenseCouncil = allocateCouncilForRegistration({ mentorId: mentor.id, councils: defenseCouncils, councilLoadMap });
      defenseSessionShift = 'AFTERNOON';
      defenseOrderInShift = number - 110;
      defenseSequenceNo = number - 94;
    } else if (number >= 115 && number <= 120) {
      status = 'COMPLETED';
      defenseCouncil = allocateCouncilForRegistration({ mentorId: mentor.id, councils: defenseCouncils, councilLoadMap });
      defenseSessionShift = (number % 2 === 0) ? 'AFTERNOON' : 'MORNING';
      defenseOrderInShift = number - 114;
      defenseSequenceNo = number - 94;
    }

    const [, topic] = await Promise.all([
      prisma.studentProjectEnrollment.create({
        data: {
          studentId: student.id,
          semesterId: semesterHK1Record.id,
          projectCatalogId: catalog.id,
          status: 'ACTIVE',
          source: 'SEED',
        },
      }),
      prisma.topic.create({
        data: {
          semesterId: semesterHK1Record.id,
          projectCatalogId: catalog.id,
          mentorId: mentor.id,
          proposedById: mentor.id,
          maxStudents: 1,
          title: initialTitle,
          description: `Đề tài tốt nghiệp HK1 của sinh viên ${padStr}.`,
          status: 'APPROVED',
        },
      }),
    ]);

    const registration = await prisma.topicRegistration.create({
      data: {
        studentId: student.id,
        semesterId: semesterHK1Record.id,
        topicId: topic.id,
        periodPolicyVersionId: policyHK1.id,
        status,
        outlineReviewStatus: 'PASSED',
        bm01ApprovedTitleSnapshot: initialTitle,
        decisionNumber: hk1Decision.decisionNumber,
        decisionDate: hk1Decision.decisionDate,
        decisionPublishedAt: hk1Decision.decisionPublishedAt,
        defenseCouncilId: defenseCouncil ? defenseCouncil.id : null,
        defenseSessionShift,
        defenseOrderInShift,
        defenseSequenceNo,
        stateVersion: 2,
      },
    });

    // Every student in sv025..sv120 has an APPROVED BM02Submission and is included in QD-2026-DATN-HK1
    const bm02 = await prisma.bM02Submission.create({
      data: {
        registrationId: registration.id,
        versionNo: 1,
        attemptNo: 1,
        outcome: 'APPROVED',
        content: `Đơn đăng ký đề tài BM02 của sinh viên ${student.fullName}.`,
        bm01ApprovedTitle: initialTitle,
        bm02ProposedTitle: initialTitle,
        studentSnapshot: studentSnap,
        mentorSnapshot: { id: mentor.id, fullName: mentor.fullName, email: mentor.email, code: mentor.code },
        fileUrl: `/uploads/demo/bm02/BM02_HK1_SV${padStr}.pdf`,
        fileName: `BM02_HK1_SV${padStr}.pdf`,
        submittedById: student.id,
        submittedAt: addDays(now, -10),
        reviewedById: lecturer01.id,
        reviewedAt: addDays(now, -7),
        notifiedAt: addDays(now, -7),
        policyVersionId: policyHK1.id,
      },
    });

    await Promise.all([
      prisma.topicRegistration.update({
        where: { id: registration.id },
        data: { currentBM02SubmissionId: bm02.id },
      }),
      prisma.topicAssignmentDecisionItem.create({
        data: {
          decisionId: hk1Decision.id,
          registrationId: registration.id,
          bm02SubmissionId: bm02.id,
          approvedTitleSnapshot: initialTitle,
          studentCodeSnapshot: student.code,
          studentNameSnapshot: student.fullName,
          mentorNameSnapshot: mentor.fullName,
        },
      }),
      prisma.assignmentDecision.create({
        data: {
          registrationId: registration.id,
          bm02SubmissionId: bm02.id,
          decisionNumber: hk1Decision.decisionNumber,
          issuedAt: hk1Decision.decisionDate,
          effectiveAt: hk1Decision.decisionPublishedAt,
          issuedById: lecturer01.id,
          policyVersionId: policyHK1.id,
          idempotencyKey: `phase2-compat-decision-${number}`,
        },
      }),
      prisma.task.createMany({
        data: [
          {
            registrationId: registration.id,
            title: 'BM01 - Đề cương chi tiết đồ án',
            taskType: 'BM01',
            status: 'COMPLETED',
          },
          {
            registrationId: registration.id,
            title: 'Nộp đơn đăng ký đề tài chính thức (BM02)',
            taskType: 'BM02',
            status: 'COMPLETED',
          },
        ],
      }),
    ]);

    // ---------------------------------------------------------------------------------------
    // CHẶNG 1B: Cửa sổ 168h BM02-A 3 chữ ký & Phụ lục điều chỉnh tên theo đợt (sv025 – sv048)
    // ---------------------------------------------------------------------------------------
    if (number >= 25 && number <= 30) {
      // sv025 - sv030: DECISION_ISSUED, đang mở cửa sổ 168h, chưa tạo BM02-A
      await prisma.task.create({
        data: {
          registrationId: registration.id,
          title: 'BM03 - Báo cáo tiến độ Đợt 1 (Tuần 6)',
          taskType: 'BM03_CHECKPOINT_1',
          dueDate: addDays(now, 14),
          status: 'OPEN',
        },
      });
    } else if (number >= 31 && number <= 34) {
      // sv031 - sv034: Đã gửi BM02-A v1, trạng thái PENDING_ADVISOR (có chữ ký Sinh viên)
      const proposedTitle = `${initialTitle} — Tích hợp mô hình học sâu đa phương thức`;
      const reason = 'Mở rộng mô hình xử lý đa phương thức theo định hướng nghiên cứu mới thống nhất với GVHD.';
      const req = await prisma.bM02AAdjustmentRequest.create({
        data: {
          registrationId: registration.id,
          decisionId: hk1Decision.id,
          status: 'PENDING_ADVISOR',
          revisionCount: 0,
          currentVersionNumber: 1,
          titleAdjustmentDeadline,
          createdById: student.id,
        },
      });

      const v1Payload = buildBM02AVersionPayload({
        registrationId: registration.id,
        versionNumber: 1,
        registeredTitleSnapshot: initialTitle,
        proposedTitle,
        reason,
        studentSnapshot: studentSnap,
      });
      const v1Hash = computeCanonicalPayloadHash(v1Payload);

      const ver = await prisma.bM02AFormVersion.create({
        data: {
          requestId: req.id,
          versionNumber: 1,
          studentSnapshot: studentSnap,
          registeredTitleSnapshot: initialTitle,
          proposedTitle,
          reason,
          payloadHash: v1Hash,
          isLocked: false,
        },
      });

      const stuSig = await prisma.electronicSignatureEvent.create({
        data: {
          registrationId: registration.id,
          entityType: 'BM02A_VERSION',
          entityId: ver.id,
          versionNumber: 1,
          signerId: student.id,
          signerRole: 'STUDENT',
          action: 'SIGN',
          signedAt: addHours(now, -6),
          payloadHash: v1Hash,
        },
      });

      await prisma.bM02AFormVersion.update({
        where: { id: ver.id },
        data: { studentSignatureEventId: stuSig.id },
      });
    } else if (number >= 35 && number <= 38) {
      // sv035 - sv038: BM02-A v1 bị trả lại, trạng thái RETURNED_FOR_CORRECTION (revisionCount = 0)
      const proposedTitle = `${initialTitle} (Bản nháp đổi tên)`;
      const reason = 'Đổi tên đề tài ngắn gọn hơn.';
      const returnReason = 'Tên đề tài đề xuất chưa nêu bật được phương pháp kỹ thuật. Đề nghị sinh viên viết rõ công nghệ sử dụng và lý do điều chỉnh học thuật.';
      const req = await prisma.bM02AAdjustmentRequest.create({
        data: {
          registrationId: registration.id,
          decisionId: hk1Decision.id,
          status: 'RETURNED_FOR_CORRECTION',
          revisionCount: 0,
          currentVersionNumber: 1,
          titleAdjustmentDeadline,
          createdById: student.id,
        },
      });

      const v1Payload = buildBM02AVersionPayload({
        registrationId: registration.id,
        versionNumber: 1,
        registeredTitleSnapshot: initialTitle,
        proposedTitle,
        reason,
        studentSnapshot: studentSnap,
      });
      const v1Hash = computeCanonicalPayloadHash(v1Payload);

      const ver = await prisma.bM02AFormVersion.create({
        data: {
          requestId: req.id,
          versionNumber: 1,
          studentSnapshot: studentSnap,
          registeredTitleSnapshot: initialTitle,
          proposedTitle,
          reason,
          payloadHash: v1Hash,
          returnedByRole: 'ADVISOR',
          returnReason,
          returnedAt: addHours(now, -4),
          isLocked: false,
        },
      });

      const stuSig = await prisma.electronicSignatureEvent.create({
        data: {
          registrationId: registration.id,
          entityType: 'BM02A_VERSION',
          entityId: ver.id,
          versionNumber: 1,
          signerId: student.id,
          signerRole: 'STUDENT',
          action: 'SIGN',
          signedAt: addHours(now, -10),
          payloadHash: v1Hash,
        },
      });

      await prisma.electronicSignatureEvent.create({
        data: {
          registrationId: registration.id,
          entityType: 'BM02A_VERSION',
          entityId: ver.id,
          versionNumber: 1,
          signerId: mentor.id,
          signerRole: 'ADVISOR',
          action: 'RETURN',
          signedAt: addHours(now, -4),
          payloadHash: v1Hash,
          rejectionOrReturnReason: returnReason,
        },
      });

      await prisma.bM02AFormVersion.update({
        where: { id: ver.id },
        data: { studentSignatureEventId: stuSig.id },
      });
    } else if (number >= 39 && number <= 42) {
      // sv039 - sv042: BM02-A đã được Sinh viên & GVHD ký cùng payloadHash, trạng thái PENDING_DEPARTMENT_APPROVAL
      const proposedTitle = `${initialTitle} — Kiến trúc hướng sự kiện và bảo mật Zero-Trust`;
      const reason = 'Chuẩn hóa tên đề tài bổ sung kiến trúc Zero-Trust theo yêu cầu thực tế của hệ thống triển khai.';
      const req = await prisma.bM02AAdjustmentRequest.create({
        data: {
          registrationId: registration.id,
          decisionId: hk1Decision.id,
          status: 'PENDING_DEPARTMENT_APPROVAL',
          revisionCount: 0,
          currentVersionNumber: 1,
          titleAdjustmentDeadline,
          createdById: student.id,
        },
      });

      const v1Payload = buildBM02AVersionPayload({
        registrationId: registration.id,
        versionNumber: 1,
        registeredTitleSnapshot: initialTitle,
        proposedTitle,
        reason,
        studentSnapshot: studentSnap,
      });
      const v1Hash = computeCanonicalPayloadHash(v1Payload);

      const ver = await prisma.bM02AFormVersion.create({
        data: {
          requestId: req.id,
          versionNumber: 1,
          studentSnapshot: studentSnap,
          registeredTitleSnapshot: initialTitle,
          proposedTitle,
          reason,
          payloadHash: v1Hash,
          isLocked: false,
        },
      });

      const stuSig = await prisma.electronicSignatureEvent.create({
        data: {
          registrationId: registration.id,
          entityType: 'BM02A_VERSION',
          entityId: ver.id,
          versionNumber: 1,
          signerId: student.id,
          signerRole: 'STUDENT',
          action: 'SIGN',
          signedAt: addHours(now, -16),
          payloadHash: v1Hash,
        },
      });

      const advSig = await prisma.electronicSignatureEvent.create({
        data: {
          registrationId: registration.id,
          entityType: 'BM02A_VERSION',
          entityId: ver.id,
          versionNumber: 1,
          signerId: mentor.id,
          signerRole: 'ADVISOR',
          action: 'SIGN',
          signedAt: addHours(now, -8),
          payloadHash: v1Hash,
        },
      });

      await prisma.bM02AFormVersion.update({
        where: { id: ver.id },
        data: {
          studentSignatureEventId: stuSig.id,
          advisorSignatureEventId: advSig.id,
        },
      });
    } else if (number >= 43 && number <= 45) {
      // sv043 - sv045: BM02-A đã đủ 3 chữ ký, trạng thái APPROVED_PENDING_APPENDIX (sẵn sàng lập Phụ lục Đợt 2)
      const proposedTitle = `${initialTitle} — Triển khai trên hạ tầng Kubernetes Cloud-Native`;
      const reason = 'Cập nhật tên đề tài phản ánh môi trường triển khai thực nghiệm Cloud-Native Kubernetes.';
      const req = await prisma.bM02AAdjustmentRequest.create({
        data: {
          registrationId: registration.id,
          decisionId: hk1Decision.id,
          status: 'APPROVED_PENDING_APPENDIX',
          revisionCount: 0,
          currentVersionNumber: 1,
          titleAdjustmentDeadline,
          createdById: student.id,
        },
      });

      const v1Payload = buildBM02AVersionPayload({
        registrationId: registration.id,
        versionNumber: 1,
        registeredTitleSnapshot: initialTitle,
        proposedTitle,
        reason,
        studentSnapshot: studentSnap,
      });
      const v1Hash = computeCanonicalPayloadHash(v1Payload);

      const ver = await prisma.bM02AFormVersion.create({
        data: {
          requestId: req.id,
          versionNumber: 1,
          studentSnapshot: studentSnap,
          registeredTitleSnapshot: initialTitle,
          proposedTitle,
          reason,
          payloadHash: v1Hash,
          isLocked: true,
        },
      });

      const stuSig = await prisma.electronicSignatureEvent.create({
        data: {
          registrationId: registration.id,
          entityType: 'BM02A_VERSION',
          entityId: ver.id,
          versionNumber: 1,
          signerId: student.id,
          signerRole: 'STUDENT',
          action: 'SIGN',
          signedAt: addHours(now, -20),
          payloadHash: v1Hash,
        },
      });
      const advSig = await prisma.electronicSignatureEvent.create({
        data: {
          registrationId: registration.id,
          entityType: 'BM02A_VERSION',
          entityId: ver.id,
          versionNumber: 1,
          signerId: mentor.id,
          signerRole: 'ADVISOR',
          action: 'SIGN',
          signedAt: addHours(now, -14),
          payloadHash: v1Hash,
        },
      });
      const deptSig = await prisma.electronicSignatureEvent.create({
        data: {
          registrationId: registration.id,
          entityType: 'BM02A_VERSION',
          entityId: ver.id,
          versionNumber: 1,
          signerId: lecturer02.id,
          signerRole: 'DEPARTMENT_HEAD',
          action: 'SIGN',
          signedAt: addHours(now, -6),
          payloadHash: v1Hash,
        },
      });

      await prisma.bM02AFormVersion.update({
        where: { id: ver.id },
        data: {
          studentSignatureEventId: stuSig.id,
          advisorSignatureEventId: advSig.id,
          departmentSignatureEventId: deptSig.id,
        },
      });
      await prisma.bM02AAdjustmentRequest.update({
        where: { id: req.id },
        data: {
          finalPayloadHash: v1Hash,
          finalPdfFileUrl: `/uploads/academic-pdfs/BM02A_reg${registration.id}_v1_SV${padStr}.pdf`,
        },
      });
    } else if (number >= 46 && number <= 48) {
      // sv046 - sv048: BM02-A ở trạng thái ADJUSTMENT_ISSUED, đã nằm trong Phụ lục Đợt 1 (PL-01/QD-2026-DATN-HK1)
      const adjustedTitle = `${initialTitle} (Đã điều chỉnh theo Phụ lục PL-01)`;
      await createIssuedBM02AAndAppendixItem({
        registration,
        student,
        mentor,
        studentSnap,
        oldTitle: initialTitle,
        newTitle: adjustedTitle,
        seqKey: `SV${padStr}`,
      });
    }

    // ---------------------------------------------------------------------------------------
    // CHẶNG 2: BM03 Nhật ký hướng dẫn, Đánh giá giữa/cuối kỳ, Viện thẩm định dừng 7+3d & Xác nhận 48h (sv049 – sv078)
    // ---------------------------------------------------------------------------------------
    if (number >= 49 && number <= 56) {
      // sv049 - sv056: IN_PROGRESS, có BM03ProgressRecord, 2 buổi đã ký khóa (isLocked = true) và 1 buổi mới tạo (isLocked = false)
      const bm03Record = await prisma.bM03ProgressRecord.create({
        data: {
          registrationId: registration.id,
          effectiveTitleSnapshot: initialTitle,
          isClosedEarly: false,
        },
      });

      // 2 locked meetings
      for (let mIdx = 1; mIdx <= 2; mIdx += 1) {
        const mDate = addDays(now, mIdx === 1 ? -28 : -14);
        const mEntry = await prisma.bM03MeetingEntry.create({
          data: {
            bm03RecordId: bm03Record.id,
            registrationId: registration.id,
            versionNumber: 1,
            meetingDate: mDate,
            meetingMode: 'IN_PERSON',
            locationOrLink: 'Phòng Lab A204',
            discussionContent: `Buổi hướng dẫn định kỳ lần ${mIdx}: Rà soát kiến trúc và kiểm tra tiến độ thực hiện mô-đun phần mềm.`,
            studentCompletedWork: `Hoàn thành các hạng mục công việc giai đoạn ${mIdx} đúng kế hoạch.`,
            remainingIssues: 'Cần tối ưu thêm truy vấn cơ sở dữ liệu.',
            nextTasks: `Triển khai các hạng mục tiếp theo của giai đoạn ${mIdx + 1}.`,
            expectedDeadline: addDays(mDate, 10),
            progressRating: 'ON_TRACK',
            isLocked: false,
          },
        });
        const mHash = computeCanonicalPayloadHash({
          meetingId: mEntry.id,
          registrationId: registration.id,
          versionNumber: 1,
          meetingDate: mEntry.meetingDate,
          meetingMode: mEntry.meetingMode,
          locationOrLink: mEntry.locationOrLink,
          discussionContent: mEntry.discussionContent,
          studentCompletedWork: mEntry.studentCompletedWork,
          remainingIssues: mEntry.remainingIssues,
          nextTasks: mEntry.nextTasks,
          expectedDeadline: mEntry.expectedDeadline,
          progressRating: mEntry.progressRating,
        });
        const mSig = await prisma.electronicSignatureEvent.create({
          data: {
            registrationId: registration.id,
            entityType: 'BM03_MEETING',
            entityId: mEntry.id,
            versionNumber: 1,
            signerId: mentor.id,
            signerRole: 'ADVISOR',
            action: 'SIGN',
            signedAt: addHours(mDate, 2),
            payloadHash: mHash,
          },
        });
        await prisma.bM03MeetingEntry.update({
          where: { id: mEntry.id },
          data: {
            isLocked: true,
            advisorSignedById: mentor.id,
            advisorSignedAt: addHours(mDate, 2),
            payloadHash: mHash,
            signatureEventId: mSig.id,
          },
        });
      }

      // 1 newly created unlocked meeting (isLocked = false) for GVHD to test clicking "Ký khóa buổi hướng dẫn"
      await prisma.bM03MeetingEntry.create({
        data: {
          bm03RecordId: bm03Record.id,
          registrationId: registration.id,
          versionNumber: 1,
          meetingDate: addDays(now, -1),
          meetingMode: 'IN_PERSON',
          locationOrLink: 'Phòng bộ môn CNTT',
          discussionContent: 'Buổi hướng dẫn lần 3: Kiểm tra kết quả tích hợp hệ thống và đánh giá tiến độ chuẩn bị báo cáo.',
          studentCompletedWork: 'Đã hoàn thiện tích hợp API và giao diện người dùng.',
          remainingIssues: 'Đang bổ sung bộ dữ liệu kiểm thử hiệu năng.',
          nextTasks: 'Hoàn tất kiểm thử và chuẩn bị đánh giá giai đoạn.',
          expectedDeadline: addDays(now, 7),
          progressRating: 'ON_TRACK',
          isLocked: false,
        },
      });

      await prisma.task.create({
        data: {
          registrationId: registration.id,
          title: 'BM03 - Báo cáo tiến độ Đợt 1 (Tuần 6)',
          taskType: 'BM03_CHECKPOINT_1',
          dueDate: addDays(now, 7),
          status: 'OPEN',
        },
      });
    } else if (number >= 57 && number <= 62) {
      // sv057 - sv062: GVHD đề nghị dừng đề tài (STOP_REVIEW_PENDING)
      const isMidtermStop = number <= 59;
      const bm03Record = await prisma.bM03ProgressRecord.create({
        data: {
          registrationId: registration.id,
          effectiveTitleSnapshot: initialTitle,
          isClosedEarly: false,
        },
      });

      // Create 2 locked meetings showing AT_RISK / NO_PROGRESS
      for (let mIdx = 1; mIdx <= 2; mIdx += 1) {
        const mDate = addDays(now, mIdx === 1 ? -25 : -10);
        const rating = mIdx === 1 ? 'BEHIND' : 'NO_PROGRESS';
        const mEntry = await prisma.bM03MeetingEntry.create({
          data: {
            bm03RecordId: bm03Record.id,
            registrationId: registration.id,
            versionNumber: 1,
            meetingDate: mDate,
            meetingMode: 'IN_PERSON',
            locationOrLink: 'Phòng bộ môn CNTT',
            discussionContent: `Buổi kiểm tra tiến độ lần ${mIdx}: Sinh viên chưa hoàn thành các nhiệm vụ đã giao từ buổi trước.`,
            studentCompletedWork: 'Khối lượng công việc đạt dưới 15% yêu cầu giai đoạn.',
            remainingIssues: 'Sinh viên vắng mặt và chậm tiến độ kéo dài.',
            nextTasks: 'Yêu cầu giải trình và nộp bổ sung sản phẩm.',
            expectedDeadline: addDays(mDate, 5),
            progressRating: rating,
            isLocked: false,
          },
        });
        const mHash = computeCanonicalPayloadHash({
          meetingId: mEntry.id,
          registrationId: registration.id,
          versionNumber: 1,
          meetingDate: mEntry.meetingDate,
          meetingMode: mEntry.meetingMode,
          locationOrLink: mEntry.locationOrLink,
          discussionContent: mEntry.discussionContent,
          studentCompletedWork: mEntry.studentCompletedWork,
          remainingIssues: mEntry.remainingIssues,
          nextTasks: mEntry.nextTasks,
          expectedDeadline: mEntry.expectedDeadline,
          progressRating: mEntry.progressRating,
        });
        const mSig = await prisma.electronicSignatureEvent.create({
          data: {
            registrationId: registration.id,
            entityType: 'BM03_MEETING',
            entityId: mEntry.id,
            versionNumber: 1,
            signerId: mentor.id,
            signerRole: 'ADVISOR',
            action: 'SIGN',
            signedAt: addHours(mDate, 2),
            payloadHash: mHash,
          },
        });
        await prisma.bM03MeetingEntry.update({
          where: { id: mEntry.id },
          data: {
            isLocked: true,
            advisorSignedById: mentor.id,
            advisorSignedAt: addHours(mDate, 2),
            payloadHash: mHash,
            signatureEventId: mSig.id,
          },
        });
      }

      if (isMidtermStop) {
        // sv057 - sv059: Đề nghị dừng ở MIDTERM (STOP_REVIEW_PENDING, stopReviewDeadline = now + 120h, extensionCount = 0)
        const stopComments = 'Sinh viên không đảm bảo tiến độ tối thiểu ở giai đoạn giữa kỳ (< 20% khối lượng), đề nghị Viện xem xét dừng thực hiện đề tài.';
        const stopHash = computeCanonicalPayloadHash({
          registrationId: registration.id,
          stage: 'MIDTERM',
          comments: stopComments,
          decision: 'PROPOSE_STOP',
        });
        const stageEval = await prisma.bM03StageEvaluation.create({
          data: {
            bm03RecordId: bm03Record.id,
            registrationId: registration.id,
            stage: 'MIDTERM',
            comments: stopComments,
            decision: 'PROPOSE_STOP',
            evaluatedById: mentor.id,
            evaluatedAt: addHours(now, -48),
            payloadHash: stopHash,
          },
        });
        await prisma.bM03ProgressRecord.update({
          where: { id: bm03Record.id },
          data: { midtermStageEvaluationId: stageEval.id },
        });
        await prisma.instituteStopReview.create({
          data: {
            bm03RecordId: bm03Record.id,
            stageEvaluationId: stageEval.id,
            registrationId: registration.id,
            stage: 'MIDTERM',
            status: 'STOP_REVIEW_PENDING',
            stopProposalSubmittedAt: addHours(now, -48),
            stopReviewDeadline: addHours(now, 120),
            extensionCount: 0,
            idempotencyKey: `phase2-stop-midterm-${number}`,
          },
        });
      } else {
        // sv060 - sv062: Đề nghị dừng ở FINAL (đã yêu cầu bổ sung 1 lần MORE_INFO_REQUIRED, extensionCount = 1, stopReviewDeadline = now + 192h)
        const midComments = 'Tiến độ giữa kỳ chậm nhưng cho phép cơ hội khắc phục tiếp.';
        const midHash = computeCanonicalPayloadHash({
          registrationId: registration.id,
          stage: 'MIDTERM',
          comments: midComments,
          decision: 'CONTINUE',
        });
        const midEval = await prisma.bM03StageEvaluation.create({
          data: {
            bm03RecordId: bm03Record.id,
            registrationId: registration.id,
            stage: 'MIDTERM',
            comments: midComments,
            decision: 'CONTINUE',
            evaluatedById: mentor.id,
            evaluatedAt: addDays(now, -20),
            payloadHash: midHash,
          },
        });

        const finComments = 'Đến cuối kỳ sinh viên vẫn không hoàn thành sản phẩm thực nghiệm cốt lõi và báo cáo thuyết minh, đề nghị dừng đề tài.';
        const finHash = computeCanonicalPayloadHash({
          registrationId: registration.id,
          stage: 'FINAL',
          comments: finComments,
          decision: 'PROPOSE_STOP',
        });
        const finEval = await prisma.bM03StageEvaluation.create({
          data: {
            bm03RecordId: bm03Record.id,
            registrationId: registration.id,
            stage: 'FINAL',
            comments: finComments,
            decision: 'PROPOSE_STOP',
            evaluatedById: mentor.id,
            evaluatedAt: addHours(now, -48),
            payloadHash: finHash,
          },
        });

        await prisma.bM03ProgressRecord.update({
          where: { id: bm03Record.id },
          data: {
            midtermStageEvaluationId: midEval.id,
            finalStageEvaluationId: finEval.id,
          },
        });

        await prisma.instituteStopReview.create({
          data: {
            bm03RecordId: bm03Record.id,
            stageEvaluationId: finEval.id,
            registrationId: registration.id,
            stage: 'FINAL',
            status: 'MORE_INFO_REQUIRED',
            stopProposalSubmittedAt: addHours(now, -48),
            stopReviewDeadline: addHours(now, 192),
            extensionCount: 1,
            extendedAt: addHours(now, -12),
            moreInfoRequestedById: lecturer01.id,
            moreInfoRequestNote: 'Đề nghị GVHD bổ sung minh chứng các lần nhắc nhở tiến độ và bản chụp kho mã nguồn hiện tại của sinh viên.',
            idempotencyKey: `phase2-stop-final-${number}`,
          },
        });
      }
    } else if (number >= 63 && number <= 68) {
      // sv063 - sv068: IN_PROGRESS, đã có 3 buổi hướng dẫn đã ký khóa, đã đánh giá Giữa kỳ CONTINUE và Cuối kỳ CONTINUE_TO_BM04, chờ GVHD bấm "Ký toàn phiếu BM03"
      await createCompletedBM03MeetingsAndStages({
        registration,
        mentor,
        effectiveTitle: initialTitle,
        signWholeRecord: false,
        acknowledgeByStudent: false,
        padStr,
      });
    } else if (number >= 69 && number <= 74) {
      // sv069 - sv074: GVHD đã ký toàn phiếu BM03 (advisorSignedAt = now - 12h), đang mở cửa sổ 48h chờ sinh viên xác nhận (studentAckDeadlineAt = now + 36h)
      await createCompletedBM03MeetingsAndStages({
        registration,
        mentor,
        effectiveTitle: initialTitle,
        signWholeRecord: true,
        acknowledgeByStudent: false,
        padStr,
      });
    } else if (number >= 75 && number <= 78) {
      // sv075 - sv078: Đã hoàn tất BM03 (BM03_PASSED, studentAckStatus = ACKNOWLEDGED, có finalPdfFileUrl), đã nộp ProjectArchive PRE_DEFENSE, Task BM04 đang OPEN
      await createCompletedBM03MeetingsAndStages({
        registration,
        mentor,
        effectiveTitle: initialTitle,
        signWholeRecord: true,
        acknowledgeByStudent: true,
        padStr,
      });

      await prisma.projectArchive.create({
        data: {
          registrationId: registration.id,
          phase: 'PRE_DEFENSE',
          status: 'SUBMITTED',
          reportFileUrl: `/uploads/demo/archive/Bao_cao_PreDefense_SV${padStr}.pdf`,
          reportFileName: `Bao_cao_PreDefense_SV${padStr}.pdf`,
          slideFileUrl: `/uploads/demo/archive/Slide_PreDefense_SV${padStr}.pptx`,
          slideFileName: `Slide_PreDefense_SV${padStr}.pptx`,
          sourceCodeUrl: `https://github.com/dacn-2026/project-sv${padStr}`,
          demoVideoUrl: `https://demo.dacn.edu.vn/videos/sv${padStr}`,
          summary: `Hồ sơ lưu trữ trước bảo vệ của sinh viên ${student.fullName}.`,
          submittedAt: addHours(now, -4),
        },
      });

      await prisma.task.create({
        data: {
          registrationId: registration.id,
          title: 'Phiếu nhận xét của GVHD (BM04)',
          content: 'Đánh giá kết quả thực hiện đồ án tốt nghiệp của sinh viên (4 tiêu chí + 2 kết luận).',
          taskType: 'BM04',
          dueDate: addDays(now, 7),
          status: 'OPEN',
        },
      });
    }

    // ---------------------------------------------------------------------------------------
    // CHẶNG 3: BM04 Đánh giá 4 tiêu chí + 2 kết luận, Viện thẩm định không bảo vệ & Hội đồng bảo vệ (sv079 – sv120)
    // ---------------------------------------------------------------------------------------
    if (number >= 79 && number <= 120) {
      // For sv079 - sv080: also issue BM02-A in Appendix 1 so effectiveTitleSnapshot on BM03 & BM04 comes from Appendix!
      let effectiveTitle = initialTitle;
      if (number === 79 || number === 80) {
        effectiveTitle = `${initialTitle} (Tên mới theo Phụ lục PL-01/QD-2026-DATN-HK1)`;
        await createIssuedBM02AAndAppendixItem({
          registration,
          student,
          mentor,
          studentSnap,
          oldTitle: initialTitle,
          newTitle: effectiveTitle,
          seqKey: `SV${padStr}`,
        });
      }

      // All sv079 - sv120 have completed BM03 & Pre-Defense Archive
      await createCompletedBM03MeetingsAndStages({
        registration,
        mentor,
        effectiveTitle,
        signWholeRecord: true,
        acknowledgeByStudent: true,
        padStr,
      });

      await prisma.projectArchive.create({
        data: {
          registrationId: registration.id,
          phase: 'PRE_DEFENSE',
          status: 'SUBMITTED',
          reportFileUrl: `/uploads/demo/archive/Bao_cao_PreDefense_SV${padStr}.pdf`,
          reportFileName: `Bao_cao_PreDefense_SV${padStr}.pdf`,
          slideFileUrl: `/uploads/demo/archive/Slide_PreDefense_SV${padStr}.pptx`,
          slideFileName: `Slide_PreDefense_SV${padStr}.pptx`,
          sourceCodeUrl: `https://github.com/dacn-2026/project-sv${padStr}`,
          demoVideoUrl: `https://demo.dacn.edu.vn/videos/sv${padStr}`,
          summary: `Hồ sơ lưu trữ trước bảo vệ của sinh viên ${student.fullName}.`,
          submittedAt: addDays(now, -3),
        },
      });

      if (number >= 79 && number <= 84) {
        // sv079 - sv084: BM03_PASSED, có bản nháp BM04Evaluation (status = DRAFT, isLocked = false)
        await prisma.bM04Evaluation.create({
          data: {
            registrationId: registration.id,
            semesterId: semesterHK1Record.id,
            studentId: student.id,
            lecturerId: mentor.id,
            thesisFormatScore: 'Bố cục báo cáo thuyết minh chặt chẽ, trình bày đúng chuẩn quy định của Viện Công nghệ số, tài liệu tham khảo trích dẫn chuẩn IEEE.',
            researchContentScore: 'Hoàn thành 100% mục tiêu nghiên cứu trong đề cương, xây dựng thành công mô hình thực nghiệm và kiểm thử đầy đủ các kịch bản.',
            applicabilityScore: 'Sản phẩm có khả năng triển khai thực tế cao, giao diện trực quan và đáp ứng tốt yêu cầu hiệu năng.',
            attitudeScore: 'Sinh viên chủ động, nghiêm túc, tham gia đầy đủ các buổi hướng dẫn định kỳ và hoàn thành đúng hạn các nhiệm vụ.',
            conclusion: 'AGREED_FOR_DEFENSE',
            programOutcome: 'MEETS_PROGRAM_OUTCOMES',
            defenseRecommendation: 'APPROVE_FOR_DEFENSE',
            generalNotes: 'Bản nháp nhận xét BM04 đã điền sẵn 4 tiêu chí, sẵn sàng để GVHD bấm Lưu nháp hoặc Ký và nộp.',
            lecturerSignature: '',
            status: 'DRAFT',
            isLocked: false,
            effectiveTitleSnapshot: effectiveTitle,
            studentClassSnapshot: studentSnap.className,
            policyVersionId: policyHK1.id,
          },
        });

        await prisma.task.create({
          data: {
            registrationId: registration.id,
            title: 'Phiếu nhận xét của GVHD (BM04)',
            content: 'GVHD đang soạn bản nháp phiếu nhận xét BM04.',
            taskType: 'BM04',
            dueDate: addDays(now, 5),
            status: 'OPEN',
          },
        });
      } else if (number >= 85 && number <= 90) {
        // sv085 - sv090: GVHD đã ký nộp BM04 với kết luận Không đồng ý cho bảo vệ -> PENDING_INSTITUTE_REVIEW
        const mismatchReason = 'Sinh viên nắm được kiến thức nền tảng nhưng sản phẩm thực nghiệm chưa hoàn thiện mô-đun bảo mật và kiểm thử tải theo yêu cầu tối thiểu để ra hội đồng bảo vệ.';
        const bm04Payload = {
          registrationId: registration.id,
          effectiveTitleSnapshot: effectiveTitle,
          thesisFormatScore: 'Trình bày báo cáo đạt yêu cầu cơ bản nhưng thiếu phụ lục kết quả kiểm thử chi tiết.',
          researchContentScore: 'Đã xây dựng được chức năng cơ bản nhưng thiếu phần đánh giá thực nghiệm trên tập dữ liệu chuẩn.',
          applicabilityScore: 'Sản phẩm mới dừng ở mức nguyên mẫu (prototype), chưa sẵn sàng vận hành thực tế.',
          attitudeScore: 'Sinh viên có cố gắng ở giai đoạn cuối nhưng nộp bản thảo báo cáo muộn so với kế hoạch.',
          programOutcome: 'MEETS_PROGRAM_OUTCOMES',
          defenseRecommendation: 'NOT_APPROVE_FOR_DEFENSE',
          mismatchReason,
          generalNotes: 'Đề nghị Viện thẩm định và xem xét khả năng cho bảo vệ của sinh viên.',
          advisorId: mentor.id,
        };
        const bm04Hash = computeCanonicalPayloadHash(bm04Payload);

        const bm04Eval = await prisma.bM04Evaluation.create({
          data: {
            registrationId: registration.id,
            semesterId: semesterHK1Record.id,
            studentId: student.id,
            lecturerId: mentor.id,
            thesisFormatScore: bm04Payload.thesisFormatScore,
            researchContentScore: bm04Payload.researchContentScore,
            applicabilityScore: bm04Payload.applicabilityScore,
            attitudeScore: bm04Payload.attitudeScore,
            conclusion: 'NOT_AGREED_FOR_DEFENSE',
            programOutcome: 'MEETS_PROGRAM_OUTCOMES',
            defenseRecommendation: 'NOT_APPROVE_FOR_DEFENSE',
            mismatchReason,
            generalNotes: bm04Payload.generalNotes,
            lecturerSignature: mentor.fullName,
            payloadHash: bm04Hash,
            finalPdfFileUrl: `/uploads/academic-pdfs/BM04_reg${registration.id}_v1_SV${padStr}.pdf`,
            signedAt: addHours(now, -28),
            status: 'PENDING_INSTITUTE_REVIEW',
            isLocked: true,
            effectiveTitleSnapshot: effectiveTitle,
            studentClassSnapshot: studentSnap.className,
            policyVersionId: policyHK1.id,
          },
        });

        const bm04Sig = await prisma.electronicSignatureEvent.create({
          data: {
            registrationId: registration.id,
            entityType: 'BM04_EVALUATION',
            entityId: bm04Eval.id,
            versionNumber: 1,
            signerId: mentor.id,
            signerRole: 'ADVISOR',
            action: 'SIGN',
            signedAt: addHours(now, -28),
            payloadHash: bm04Hash,
          },
        });

        await prisma.bM04Evaluation.update({
          where: { id: bm04Eval.id },
          data: { signatureEventId: bm04Sig.id },
        });

        await prisma.instituteDefenseReview.create({
          data: {
            bm04EvaluationId: bm04Eval.id,
            registrationId: registration.id,
            status: 'PENDING_INSTITUTE_REVIEW',
            submittedAt: addHours(now, -28),
            reviewDeadlineAt: addHours(now, 140),
            extensionCount: 0,
            idempotencyKey: `phase2-defense-review-${number}`,
          },
        });

        await prisma.task.create({
          data: {
            registrationId: registration.id,
            title: 'Phiếu nhận xét của GVHD (BM04)',
            content: 'Đang chờ Viện thẩm định đề nghị không bảo vệ BM04.',
            taskType: 'BM04',
            status: 'SUBMITTED',
          },
        });
      } else {
        // sv091 - sv120: Đủ điều kiện bảo vệ (sv091-sv092 & sv095-sv120 do GVHD đồng ý; sv093-sv094 do Viện thẩm định ghi đè ELIGIBLE_BY_INSTITUTE)
        const isInstituteOverride = number === 93 || number === 94;
        const defenseRec = isInstituteOverride ? 'NOT_APPROVE_FOR_DEFENSE' : 'APPROVE_FOR_DEFENSE';
        const bm04Status = isInstituteOverride ? 'ELIGIBLE_BY_INSTITUTE' : 'SIGNED_APPROVED';
        const mismatchReason = isInstituteOverride
          ? 'GVHD đánh giá phần thực nghiệm cần bổ sung thêm kịch bản kiểm thử trước khi bảo vệ.'
          : null;

        const bm04Payload = {
          registrationId: registration.id,
          effectiveTitleSnapshot: effectiveTitle,
          thesisFormatScore: 'Hình thức trình bày chuẩn mực, cấu trúc rõ ràng, văn phong khoa học mạch lạc.',
          researchContentScore: 'Nội dung nghiên cứu sâu sắc, giải quyết trọn vẹn bài toán đặt ra và có kết quả thực nghiệm tốt.',
          applicabilityScore: 'Ứng dụng vận hành ổn định, có giá trị thực tiễn và khả năng mở rộng.',
          attitudeScore: 'Thái độ làm việc nghiêm túc, chủ động sáng tạo trong suốt quá trình thực hiện đồ án.',
          programOutcome: 'MEETS_PROGRAM_OUTCOMES',
          defenseRecommendation: defenseRec,
          mismatchReason,
          generalNotes: 'Sinh viên hoàn thành tốt đồ án tốt nghiệp, đủ điều kiện bảo vệ trước Hội đồng.',
          advisorId: mentor.id,
        };
        const bm04Hash = computeCanonicalPayloadHash(bm04Payload);

        const bm04Eval = await prisma.bM04Evaluation.create({
          data: {
            registrationId: registration.id,
            semesterId: semesterHK1Record.id,
            studentId: student.id,
            lecturerId: mentor.id,
            thesisFormatScore: bm04Payload.thesisFormatScore,
            researchContentScore: bm04Payload.researchContentScore,
            applicabilityScore: bm04Payload.applicabilityScore,
            attitudeScore: bm04Payload.attitudeScore,
            conclusion: 'AGREED_FOR_DEFENSE',
            programOutcome: 'MEETS_PROGRAM_OUTCOMES',
            defenseRecommendation: defenseRec,
            mismatchReason,
            generalNotes: bm04Payload.generalNotes,
            lecturerSignature: mentor.fullName,
            payloadHash: bm04Hash,
            finalPdfFileUrl: `/uploads/academic-pdfs/BM04_reg${registration.id}_v1_SV${padStr}.pdf`,
            signedAt: addDays(now, -2),
            status: bm04Status,
            isLocked: true,
            effectiveTitleSnapshot: effectiveTitle,
            studentClassSnapshot: studentSnap.className,
            policyVersionId: policyHK1.id,
          },
        });

        const bm04Sig = await prisma.electronicSignatureEvent.create({
          data: {
            registrationId: registration.id,
            entityType: 'BM04_EVALUATION',
            entityId: bm04Eval.id,
            versionNumber: 1,
            signerId: mentor.id,
            signerRole: 'ADVISOR',
            action: 'SIGN',
            signedAt: addDays(now, -2),
            payloadHash: bm04Hash,
          },
        });

        await prisma.bM04Evaluation.update({
          where: { id: bm04Eval.id },
          data: { signatureEventId: bm04Sig.id },
        });

        if (isInstituteOverride) {
          await prisma.instituteDefenseReview.create({
            data: {
              bm04EvaluationId: bm04Eval.id,
              registrationId: registration.id,
              status: 'ELIGIBLE_BY_INSTITUTE',
              submittedAt: addDays(now, -2),
              reviewDeadlineAt: addDays(now, 5),
              extensionCount: 0,
              decision: 'OVERRIDE_APPROVE_DEFENSE',
              decisionSource: 'INSTITUTE_REVIEWER',
              reviewedById: lecturer01.id,
              reviewedAt: addHours(now, -6),
              reviewReason: 'Sinh viên đã bổ sung đầy đủ kịch bản kiểm thử và báo cáo thực nghiệm, Viện thẩm định cho phép bảo vệ trước Hội đồng.',
              idempotencyKey: `phase2-defense-override-${number}`,
            },
          });
        }

        await prisma.task.create({
          data: {
            registrationId: registration.id,
            title: 'Phiếu nhận xét của GVHD (BM04)',
            content: 'Đã hoàn thành phiếu nhận xét BM04, đủ điều kiện bảo vệ.',
            taskType: 'BM04',
            status: 'COMPLETED',
          },
        });
      }
    }

    await prisma.registrationStateHistory.create({
      data: {
        registrationId: registration.id,
        fromStatus: 'BM01_PASSED',
        toStatus: status,
        fromStateVersion: 1,
        toStateVersion: 2,
        actorId: admin.id,
        reason: `Khởi tạo dữ liệu Giai đoạn 2 (${status})`,
        idempotencyKey: `phase2-reg-history-${number}`,
      },
    });

    registrations.set(number, {
      ...registration,
      student,
      topic,
      mentor,
      council: defenseCouncil,
    });
  }

  return {
    semester: semesterHK1Record,
    semesters: {
      semesterHK1: semesterHK1Record,
      semesterHK2: semesterHK2Record,
      period1Main: semesterHK1Record,
      period2Supplementary: semesterHK2Record,
    },
    policies: {
      policyHK1,
      policyHK2,
    },
    catalog,
    rubric,
    admin,
    director: lecturer01,
    hk1Decision,
    appendix1Issued,
    councils: defenseCouncils,
    delegations: [delegationBM02Review, delegationBM02View, delegationBM02AFinalApprove, delegationExpired],
    registrations,
    studentSnapshots,
  };
}

async function seedPhase2DefenseEvidenceAndPublications({ prisma, context, fixtures }) {
  const adminId = context.admin.id;
  const director = context.director;
  const targetSemester = context.semesters.semesterHK1;
  const baseDate = new Date();

  // Helper to create locked or unlocked member scores
  const createMemberScores = async (fixture, scores, locked = true, lockedAt = addHours(baseDate, -4)) => {
    const memberScores = fixture.council.memberIds.map((evaluatorId, idx) => ({
      registrationId: fixture.id,
      evaluatorId,
      finalScore: scores[idx] !== undefined ? scores[idx] : null,
      comments: locked ? 'Điểm đánh giá bảo vệ chính thức của thành viên hội đồng' : 'Điểm dự thảo đang chấm',
      scoreRubricVersion: RUBRIC_VERSION,
      scoreLocked: locked && scores[idx] !== null,
      lockedAt: locked && scores[idx] !== null ? lockedAt : null,
      lockedBy: locked && scores[idx] !== null ? evaluatorId : null,
      isEffective: true,
    }));
    await prisma.defenseMemberScore.createMany({ data: memberScores });
    return memberScores;
  };

  // Helper to create archive dossier with versions & zero-hour snapshot
  const createArchiveDossier = async ({
    fixture,
    status = 'SUBMITTED',
    fileTypes = ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'],
    mentorReviewStatus = 'PENDING',
    mentorReviewNotes = null,
    academicAffairsReviewStatus = 'PENDING',
    academicAffairsReviewNotes = null,
    certificateNumber = null,
    certificatePdfUrl = null,
    isCompleted = false,
    isClosed = false,
  }) => {
    const defenseSnapshotAt = addDays(baseDate, -5);
    const softDeadlineAt = addDays(baseDate, -8);
    const windowClosesAt = addDays(baseDate, isClosed ? -1 : 10);
    const windowClosedAt = isClosed ? addDays(baseDate, -1) : null;

    const archiveData = {
      status,
      phase: 'POST_DEFENSE',
      softPreparationDeadlineAt: softDeadlineAt,
      defenseSnapshotAt,
      windowClosesAt,
      windowClosedAt,
      reportWordFileUrl: fileTypes.includes('REPORT_WORD') ? `/uploads/archive/reg${fixture.id}_report.docx` : null,
      reportWordFileName: fileTypes.includes('REPORT_WORD') ? `Bao_cao_reg${fixture.id}.docx` : null,
      reportPdfFileUrl: fileTypes.includes('REPORT_PDF') ? `/uploads/archive/reg${fixture.id}_report.pdf` : null,
      reportPdfFileName: fileTypes.includes('REPORT_PDF') ? `Bao_cao_reg${fixture.id}.pdf` : null,
      slideFileUrl: fileTypes.includes('SLIDE_PPTX') ? `/uploads/archive/reg${fixture.id}_slide.pptx` : null,
      slideFileName: fileTypes.includes('SLIDE_PPTX') ? `Slide_reg${fixture.id}.pptx` : null,
      demoVideoUrl: fileTypes.includes('DEMO_VIDEO') ? `/uploads/archive/reg${fixture.id}_demo.mp4` : null,
      mentorReviewStatus,
      mentorReviewedById: mentorReviewStatus !== 'PENDING' ? fixture.mentor.id : null,
      mentorReviewedAt: mentorReviewStatus !== 'PENDING' ? addDays(baseDate, -2) : null,
      mentorReviewNotes,
      academicAffairsReviewStatus,
      academicAffairsReviewedById: academicAffairsReviewStatus !== 'PENDING' ? adminId : null,
      academicAffairsReviewedAt: academicAffairsReviewStatus !== 'PENDING' ? addDays(baseDate, -2) : null,
      academicAffairsReviewNotes,
      certificateNumber,
      certificateSignedById: isCompleted ? director.id : null,
      certificateSignedAt: isCompleted ? addDays(baseDate, -1) : null,
      certificatePdfUrl,
      certificatePayloadHash: isCompleted ? checksum({ certificateNumber, registrationId: fixture.id }) : null,
    };

    const archive = await prisma.projectArchive.upsert({
      where: { registrationId: fixture.id },
      create: {
        registrationId: fixture.id,
        ...archiveData,
      },
      update: archiveData,
    });

    const docVersionIds = {};
    for (const docType of fileTypes) {
      const ext = docType === 'REPORT_WORD' ? 'docx' : docType === 'REPORT_PDF' ? 'pdf' : docType === 'DEMO_VIDEO' ? 'mp4' : 'pptx';
      const version = await prisma.defenseDocumentVersion.create({
        data: {
          registrationId: fixture.id,
          archiveId: archive.id,
          documentType: docType,
          versionNumber: 1,
          phase: 'POST_DEFENSE',
          fileUrl: `/uploads/archive/reg${fixture.id}_${docType.toLowerCase()}.${ext}`,
          fileName: `${docType}_reg${fixture.id}.${ext}`,
          checksum: checksum(`${fixture.id}:${docType}:v1`),
          isLatePreDefense: false,
          uploadedById: fixture.student.id,
          uploadedAt: addDays(baseDate, -4),
        },
      });
      docVersionIds[docType] = version.id;
    }

    // Capture defense zero-hour snapshot
    await prisma.defenseDocumentSnapshot.create({
      data: {
        registrationId: fixture.id,
        snapshotType: 'DEFENSE_SNAPSHOT',
        capturedAt: defenseSnapshotAt,
        reportWordVersionId: docVersionIds['REPORT_WORD'] || null,
        reportPdfVersionId: docVersionIds['REPORT_PDF'] || null,
        demoVideoVersionId: docVersionIds['DEMO_VIDEO'] || null,
        slidePptxVersionId: docVersionIds['SLIDE_PPTX'] || null,
        missingDocumentTypes: ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'].filter((t) => !fileTypes.includes(t)),
      },
    });

    if (isCompleted) {
      await prisma.electronicSignatureEvent.create({
        data: {
          registrationId: fixture.id,
          entityType: 'CLEARANCE_CERTIFICATE',
          entityId: archive.id,
          versionNumber: 1,
          signerId: director.id,
          signerRole: 'VIEN_TRUONG',
          action: 'SIGN_CLEARANCE_CERTIFICATE',
          signedAt: addDays(baseDate, -1),
          payloadHash: checksum({ certificateNumber, registrationId: fixture.id }),
        },
      });
    }

    return archive;
  };

  // 1. sv095..sv098: DEFENSE_SCHEDULED_SHIFT (scoring in progress, shifts Morning/Afternoon)
  // sv095: 1 member locked
  const f95 = fixtures.get(95);
  if (f95 && f95.council) {
    await prisma.defenseMemberScore.createMany({
      data: [
        { registrationId: f95.id, evaluatorId: f95.council.memberIds[0], finalScore: 8.5, scoreRubricVersion: RUBRIC_VERSION, scoreLocked: true, lockedAt: addHours(baseDate, -1), lockedBy: f95.council.memberIds[0], isEffective: true },
        { registrationId: f95.id, evaluatorId: f95.council.memberIds[1], finalScore: 8.0, scoreRubricVersion: RUBRIC_VERSION, scoreLocked: false, isEffective: true },
        { registrationId: f95.id, evaluatorId: f95.council.memberIds[2], finalScore: null, scoreRubricVersion: RUBRIC_VERSION, scoreLocked: false, isEffective: true },
      ],
    });
  }

  // sv096: 3 members locked, Chairman not yet locked scorebook
  const f96 = fixtures.get(96);
  if (f96 && f96.council) {
    await prisma.defenseMemberScore.createMany({
      data: [
        { registrationId: f96.id, evaluatorId: f96.council.memberIds[0], finalScore: 8.0, scoreRubricVersion: RUBRIC_VERSION, scoreLocked: true, lockedAt: addHours(baseDate, -1), lockedBy: f96.council.memberIds[0], isEffective: true },
        { registrationId: f96.id, evaluatorId: f96.council.memberIds[1], finalScore: 8.5, scoreRubricVersion: RUBRIC_VERSION, scoreLocked: true, lockedAt: addHours(baseDate, -1), lockedBy: f96.council.memberIds[1], isEffective: true },
        { registrationId: f96.id, evaluatorId: f96.council.memberIds[2], finalScore: 8.4, scoreRubricVersion: RUBRIC_VERSION, scoreLocked: true, lockedAt: addHours(baseDate, -1), lockedBy: f96.council.memberIds[2], isEffective: true },
      ],
    });
  }

  // sv097: ABSENT (Chairman confirmed absent minutes, 0 member score sheets)
  const f97 = fixtures.get(97);
  if (f97) {
    await prisma.defenseResult.create({
      data: {
        registrationId: f97.id,
        attendanceStatus: 'ABSENT',
        absentMinutesText: 'Sinh viên vắng mặt không lý do tại buổi bảo vệ Hội đồng.',
        absentConfirmedByChairId: f97.council ? f97.council.memberIds[0] : null,
        absentConfirmedAt: addHours(baseDate, -2),
        scoreRubricVersion: RUBRIC_VERSION,
        finalScore: null,
        rawAverageScore: null,
        roundedFinalScore: null,
        scoreLocked: true,
        lockedAt: addHours(baseDate, -2),
        lockedBy: f97.council ? f97.council.memberIds[0] : null,
        evaluatorId: f97.council ? f97.council.memberIds[0] : adminId,
      },
    });
  }

  // sv098: Afternoon shift, order 1 (scoring not started)

  // 2. sv099..sv100: DEFENSE_AWAITING_APPROVAL (Chairman locked scorebook, awaiting publication)
  for (let num = 99; num <= 100; num += 1) {
    const fixture = fixtures.get(num);
    if (!fixture || !fixture.council) continue;
    const scores = [8.0, 8.5, 8.4];
    await createMemberScores(fixture, scores, true, addHours(baseDate, -5));
    await prisma.defenseResult.create({
      data: {
        registrationId: fixture.id,
        finalScore: 8.3,
        rawAverageScore: 8.3,
        roundedFinalScore: 8.3,
        attendanceStatus: 'PRESENT',
        comments: 'Kết quả tổng hợp đã khóa sổ, chờ công bố kết quả bảo vệ',
        evaluatorId: fixture.council.memberIds[0],
        scoreRubricVersion: RUBRIC_VERSION,
        scoreLocked: true,
        lockedAt: addHours(baseDate, -4),
        lockedBy: fixture.council.memberIds[0],
      },
    });
    await prisma.topicRegistration.update({
      where: { id: fixture.id },
      data: { status: 'AWAITING_FINAL_APPROVAL' },
    });
  }

  // 3. Official Result Publication for sv101 - sv120
  const publication = await prisma.resultPublication.create({
    data: {
      semesterId: targetSemester.id,
      type: 'INITIAL',
      publishedById: adminId,
      publishedAt: addDays(baseDate, -3),
      idempotencyKey: 'phase2-publication-defense-results-v1',
    },
  });

  const recordPublishedEvidence = async (fixture, finalScore, roundedFinalScore, outcome, comments) => {
    let memberScores = [];
    if (finalScore !== null && fixture.council) {
      const diff = outcome === 'PASSED' ? [finalScore - 0.2, finalScore, finalScore + 0.2] : [4.8, 5.0, 4.9];
      memberScores = await createMemberScores(fixture, diff, true, addDays(baseDate, -4));
    }
    const result = await prisma.defenseResult.create({
      data: {
        registrationId: fixture.id,
        finalScore,
        rawAverageScore: finalScore,
        roundedFinalScore,
        attendanceStatus: finalScore === null ? 'ABSENT' : 'PRESENT',
        absentMinutesText: finalScore === null ? 'Sinh viên vắng mặt không lý do tại buổi bảo vệ.' : null,
        comments,
        evaluatorId: fixture.council ? fixture.council.memberIds[0] : adminId,
        scoreRubricVersion: RUBRIC_VERSION,
        scoreLocked: true,
        lockedAt: addDays(baseDate, -4),
        lockedBy: fixture.council ? fixture.council.memberIds[0] : adminId,
      },
    });
    const fingerprint = hashScoreEvidence({
      defenseCouncilId: fixture.council ? fixture.council.id : null,
      councilId: null,
      periodPolicyVersionId: fixture.periodPolicyVersionId,
      defenseResult: result,
      memberScores,
    });
    const approval = await prisma.defenseResultApproval.create({
      data: {
        registrationId: fixture.id,
        defenseResultId: result.id,
        outcome,
        finalScoreSnapshot: roundedFinalScore,
        scoreFingerprint: fingerprint,
        rubricVersionSnapshot: RUBRIC_VERSION,
        defenseCouncilId: fixture.council ? fixture.council.id : null,
        policyVersionId: fixture.periodPolicyVersionId,
        approvedById: adminId,
        reason: 'Phê duyệt kết quả bảo vệ chính thức của Viện',
        isEffective: true,
      },
    });
    await prisma.resultPublicationItem.create({
      data: {
        publicationId: publication.id,
        registrationId: fixture.id,
        sourceApprovalId: approval.id,
        outcomeSnapshot: outcome,
        finalScoreSnapshot: roundedFinalScore,
        studentCodeSnapshot: fixture.student.code,
        studentNameSnapshot: fixture.student.fullName,
        topicTitleSnapshot: fixture.topic.title,
      },
    });
    return { result, approval };
  };

  // 101..104: DEFENSE_PASSED in 14-day archival window
  for (let num = 101; num <= 104; num += 1) {
    const fixture = fixtures.get(num);
    if (!fixture) continue;
    await recordPublishedEvidence(fixture, 8.5, 8.5, 'PASSED', 'Bảo vệ thành công, đạt chuẩn đầu ra.');
    const files = num === 101 ? ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX']
      : num === 102 ? ['REPORT_PDF', 'SLIDE_PPTX']
      : num === 103 ? ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO']
      : ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'];
    await createArchiveDossier({
      fixture,
      status: 'SUBMITTED',
      fileTypes: files,
    });
    await prisma.topicRegistration.update({
      where: { id: fixture.id },
      data: { status: 'DEFENSE_PASSED' },
    });
  }

  // 105..106: PENDING_INSTITUTE_SIGNATURE (both Mentor and Academic Affairs approved)
  for (let num = 105; num <= 106; num += 1) {
    const fixture = fixtures.get(num);
    if (!fixture) continue;
    await recordPublishedEvidence(fixture, 9.0, 9.0, 'PASSED', 'Bảo vệ đồ án xuất sắc, hoàn thành đầy đủ yêu cầu.');
    await createArchiveDossier({
      fixture,
      status: 'PENDING_INSTITUTE_SIGNATURE',
      fileTypes: ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'],
      mentorReviewStatus: 'APPROVED',
      mentorReviewNotes: 'Đề tài đạt chuẩn học thuật và hoàn thiện tốt.',
      academicAffairsReviewStatus: 'APPROVED',
      academicAffairsReviewNotes: 'Đầy đủ 4 tài liệu theo quy định lưu chiểu.',
    });
    await prisma.topicRegistration.update({
      where: { id: fixture.id },
      data: { status: 'PENDING_INSTITUTE_SIGNATURE' },
    });
  }

  // 107..108: ARCHIVE_REJECTED (defense score preserved, cannot issue certificate)
  for (let num = 107; num <= 108; num += 1) {
    const fixture = fixtures.get(num);
    if (!fixture) continue;
    await recordPublishedEvidence(fixture, 7.8, 7.8, 'PASSED', 'Điểm bảo vệ đạt nhưng hồ sơ lưu chiểu bị từ chối chuyên môn.');
    await createArchiveDossier({
      fixture,
      status: 'ARCHIVE_REJECTED',
      fileTypes: ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'],
      mentorReviewStatus: 'REJECTED',
      mentorReviewNotes: 'Nội dung khóa luận vi phạm quy chế trích dẫn và sao chép mã nguồn.',
      isClosed: true,
    });
    await prisma.topicRegistration.update({
      where: { id: fixture.id },
      data: { status: 'ARCHIVE_REJECTED' },
    });
  }

  // 109..110: ARCHIVE_INCOMPLETE (closed window at day 15 missing files)
  for (let num = 109; num <= 110; num += 1) {
    const fixture = fixtures.get(num);
    if (!fixture) continue;
    await recordPublishedEvidence(fixture, 8.2, 8.2, 'PASSED', 'Điểm bảo vệ đạt nhưng quá hạn nộp hồ sơ lưu chiểu.');
    await createArchiveDossier({
      fixture,
      status: 'ARCHIVE_INCOMPLETE',
      fileTypes: ['REPORT_PDF'], // missing Word, Video, Slide
      isClosed: true,
    });
    await prisma.topicRegistration.update({
      where: { id: fixture.id },
      data: { status: 'ARCHIVE_INCOMPLETE' },
    });
  }

  // 111..112: DEFENSE_FAILED (score < 5.0: raw 4.9 -> rounded 4.9)
  for (let num = 111; num <= 112; num += 1) {
    const fixture = fixtures.get(num);
    if (!fixture) continue;
    await recordPublishedEvidence(fixture, 4.9, 4.9, 'FAILED', 'Kết quả bảo vệ chưa đạt chuẩn đầu ra (điểm < 5.0).');
    await prisma.topicRegistration.update({
      where: { id: fixture.id },
      data: { status: 'DEFENSE_FAILED' },
    });
  }

  // 113..114: DEFENSE_FAILED (ABSENT, no member scores, finalScore = null)
  for (let num = 113; num <= 114; num += 1) {
    const fixture = fixtures.get(num);
    if (!fixture) continue;
    await recordPublishedEvidence(fixture, null, null, 'FAILED', 'Sinh viên vắng mặt không lý do tại buổi bảo vệ (biên bản ABSENT).');
    await prisma.topicRegistration.update({
      where: { id: fixture.id },
      data: { status: 'DEFENSE_FAILED' },
    });
  }

  // 115..120: COMPLETED (Director signed certificate with immutable PDF)
  for (let num = 115; num <= 120; num += 1) {
    const fixture = fixtures.get(num);
    if (!fixture) continue;
    const finalScore = 9.2;
    await recordPublishedEvidence(fixture, finalScore, finalScore, 'PASSED', 'Đạt chuẩn tốt nghiệp xuất sắc.');
    await createArchiveDossier({
      fixture,
      status: 'COMPLETED',
      fileTypes: ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'],
      mentorReviewStatus: 'APPROVED',
      mentorReviewNotes: 'Đồ án xuất sắc, chất lượng cao.',
      academicAffairsReviewStatus: 'APPROVED',
      academicAffairsReviewNotes: 'Hồ sơ lưu chiểu đầy đủ và hợp lệ.',
      certificateNumber: `XNHT-20261120-${fixture.id}`,
      certificatePdfUrl: `/uploads/certificates/XNHT_${fixture.student.code}.pdf`,
      isCompleted: true,
      isClosed: true,
    });
    await prisma.topicRegistration.update({
      where: { id: fixture.id },
      data: { status: 'COMPLETED' },
    });
  }

  return { initial: publication };
}

module.exports = {
  buildAccounts,
  buildStudentProfileData,
  PHASE2_COHORTS,
  resolveHK1MentorIndex,
  seedPhase2AcademicFixtures,
  seedPhase2DefenseEvidenceAndPublications,
};
