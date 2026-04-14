require("dotenv").config();

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TOPIC_KEYWORDS = [
  "Quản lý đồ án",
  "Phân tích dữ liệu học tập",
  "Hệ thống đăng ký đề tài",
  "Giám sát tiến độ học thuật",
  "Nền tảng nộp báo cáo",
  "Dashboard cảnh báo tiến độ",
  "Chấm điểm và lưu vết đánh giá",
  "Phân tích chất lượng đề tài",
  "Quản trị hội đồng bảo vệ",
  "Kho tài liệu hướng dẫn",
  "Công cụ review báo cáo",
  "API tích hợp LMS",
  "Portal thông báo học vụ",
  "Phân quyền theo vai trò",
  "Kiểm thử và đối soát kết quả",
];

const TOPIC_SCOPES = [
  "cho cấp khoa",
  "cho cấp viện",
  "đa khoa",
  "có tích hợp mobile",
  "có pipeline dữ liệu",
  "có module báo cáo",
  "có lưu vết audit",
  "có tích hợp cloud storage",
  "hỗ trợ realtime",
  "tập trung vào bảo mật",
];

const lastNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Võ", "Đặng", "Bùi", "Đỗ", "Phan"];
const middleNames = ["Minh", "Quốc", "Gia", "Thanh", "Khánh", "Đức", "Anh", "Hữu", "Tuấn", "Ngọc"];
const firstNames = ["An", "Bình", "Châu", "Dũng", "Giang", "Hà", "Hiếu", "Khoa", "Linh", "Nam", "Phương", "Quân", "Trang", "Vy", "Yến"];

function pick(list, index) {
  return list[index % list.length];
}

function makeDate(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function shiftDays(date, amount) {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
}

function scoreByIndex(i) {
  const raw = 6.7 + (i % 24) * 0.12;
  return Math.min(9.8, Number(raw.toFixed(2)));
}

function registrationStatusByProgress(progress) {
  if (progress >= 100) return "COMPLETED";
  if (progress >= 90) return "DEFENDED";
  if (progress >= 70) return "SUBMITTED";
  if (progress >= 35) return "IN_PROGRESS";
  return "APPROVED";
}

async function upsertUsers() {
  const passwordHashes = {
    admin: await bcrypt.hash("admin123", 10),
    lecturer: await bcrypt.hash("lecturer123", 10),
    student: await bcrypt.hash("student123", 10),
  };

  const admins = [
    {
      email: "admin@university.edu.vn",
      passwordHash: passwordHashes.admin,
      fullName: "Quản trị hệ thống",
      code: "ADMIN001",
      role: "ADMIN",
      department: "Viện Công nghệ số",
      isActive: true,
    },
    {
      email: "admin2@university.edu.vn",
      passwordHash: passwordHashes.admin,
      fullName: "Quản trị đào tạo",
      code: "ADMIN002",
      role: "ADMIN",
      department: "Viện Công nghệ số",
      isActive: true,
    },
  ];

  const lecturers = Array.from({ length: 12 }, (_, i) => {
    const idx = i + 1;
    const title = idx % 3 === 0 ? "PHO_GIAO_SU" : idx % 2 === 0 ? "TIEN_SI" : "THAC_SI";

    return {
      email: `lecturer${String(idx).padStart(2, "0")}@university.edu.vn`,
      passwordHash: passwordHashes.lecturer,
      fullName: `${pick(lastNames, idx)} ${pick(middleNames, idx + 3)} ${pick(firstNames, idx + 7)}`,
      code: `GV${String(idx).padStart(3, "0")}`,
      role: "LECTURER",
      department: idx % 2 === 0 ? "Kỹ thuật phần mềm" : "Hệ thống thông tin",
      academicTitle: title,
      isActive: true,
    };
  });

  const students = Array.from({ length: 72 }, (_, i) => {
    const idx = i + 1;
    return {
      email: `sv${String(idx).padStart(3, "0")}@university.edu.vn`,
      passwordHash: passwordHashes.student,
      fullName: `${pick(lastNames, idx + 9)} ${pick(middleNames, idx + 11)} ${pick(firstNames, idx + 13)}`,
      code: `2021${String(idx).padStart(3, "0")}`,
      role: "STUDENT",
      department: idx % 3 === 0 ? "Khoa học dữ liệu" : "Viện Công nghệ số",
      isActive: true,
    };
  });

  const allUsers = [...admins, ...lecturers, ...students];

  for (const user of allUsers) {
    const { email, ...data } = user;
    await prisma.user.upsert({
      where: { email },
      update: data,
      create: { email, ...data },
    });
  }
}

async function clearNonUserData() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.defenseResult.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.task.deleteMany(),
    prisma.milestone.deleteMany(),
    prisma.topicRegistration.deleteMany(),
    prisma.councilMember.deleteMany(),
    prisma.council.deleteMany(),
    prisma.topic.deleteMany(),
    prisma.semester.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function createSemesters() {
  const semesterA = await prisma.semester.create({
    data: {
      name: "Đồ án chuyên ngành - HK1 2024-2025",
      startDate: makeDate("2024-09-01"),
      registrationDeadline: makeDate("2024-09-25"),
      midtermReportDate: makeDate("2024-11-05"),
      defenseDate: makeDate("2025-01-10"),
      endDate: makeDate("2025-01-20"),
      registrationOpen: false,
      status: "COMPLETED",
    },
  });

  const semesterB = await prisma.semester.create({
    data: {
      name: "Đồ án chuyên ngành - HK2 2024-2025",
      startDate: makeDate("2025-02-10"),
      registrationDeadline: makeDate("2025-03-02"),
      midtermReportDate: makeDate("2025-04-12"),
      defenseDate: makeDate("2025-06-28"),
      endDate: makeDate("2025-07-08"),
      registrationOpen: false,
      status: "COMPLETED",
    },
  });

  const semesterC = await prisma.semester.create({
    data: {
      name: "Đồ án chuyên ngành - HK2 2025-2026",
      startDate: makeDate("2026-02-25"),
      registrationDeadline: makeDate("2026-03-20"),
      midtermReportDate: makeDate("2026-04-22"),
      defenseDate: makeDate("2026-05-28"),
      endDate: makeDate("2026-06-10"),
      registrationOpen: false,
      status: "DEFENSE",
    },
  });

  const semesterD = await prisma.semester.create({
    data: {
      name: "Đồ án chuyên ngành - HK1 2026-2027",
      startDate: makeDate("2026-09-05"),
      registrationDeadline: makeDate("2026-09-30"),
      midtermReportDate: makeDate("2026-11-08"),
      defenseDate: makeDate("2027-01-12"),
      endDate: makeDate("2027-01-22"),
      registrationOpen: true,
      status: "REGISTRATION",
    },
  });

  return [semesterA, semesterB, semesterC, semesterD];
}

function buildTopicTitle(index) {
  const keyword = pick(TOPIC_KEYWORDS, index);
  const scope = pick(TOPIC_SCOPES, index + 2);
  return `${keyword} ${scope}`;
}

async function createTopicsForSemester({ semester, lecturerIds, approvedCount, pendingCount, rejectedCount, startIndex }) {
  const topics = [];
  const total = approvedCount + pendingCount + rejectedCount;

  for (let i = 0; i < total; i += 1) {
    const topicIndex = startIndex + i;
    const mentorId = lecturerIds[topicIndex % lecturerIds.length];
    let status = "APPROVED";

    if (i >= approvedCount && i < approvedCount + pendingCount) {
      status = "PENDING";
    }
    if (i >= approvedCount + pendingCount) {
      status = "REJECTED";
    }

    const topic = await prisma.topic.create({
      data: {
        semesterId: semester.id,
        title: buildTopicTitle(topicIndex),
        description: `Đề tài tập trung vào bài toán thực tế, có mock API, dashboard quản trị và bộ tiêu chí đánh giá rõ ràng. Biên số: DT-${semester.id}-${String(i + 1).padStart(3, "0")}.`,
        proposedById: mentorId,
        mentorId,
        maxStudents: 1,
        status,
        rejectReason: status === "REJECTED" ? "Phạm vi đề tài vượt quá 1 học kỳ đồ án." : null,
      },
    });

    topics.push(topic);
  }

  return topics;
}

async function createRegistrationsAndProgress({
  semester,
  approvedTopics,
  studentIds,
  targetCount,
  profile,
}) {
  const registrations = [];

  for (let i = 0; i < targetCount; i += 1) {
    const topic = approvedTopics[i % approvedTopics.length];
    const studentId = studentIds[i % studentIds.length];
    const progress = profile(i);
    const status = registrationStatusByProgress(progress);

    const registration = await prisma.topicRegistration.create({
      data: {
        topicId: topic.id,
        studentId,
        semesterId: semester.id,
        status,
        rejectReason: null,
      },
    });

    registrations.push({ registration, progress, topic, studentId });
  }

  return registrations;
}

async function addRejectedOrWithdrawnCases({ semester, approvedTopics, studentIds, usedTopicIds, usedStudentIds }) {
  const extra = [];
  const availableTopics = approvedTopics.filter((topic) => !usedTopicIds.has(topic.id));
  const availableStudents = studentIds.filter((studentId) => !usedStudentIds.has(studentId));
  const baseIndexes = [0, 1, 2, 3, 4, 5];
  const statuses = ["REJECTED", "WITHDRAWN", "DROPPED", "REJECTED", "WITHDRAWN", "DROPPED"];

  for (let i = 0; i < baseIndexes.length; i += 1) {
    if (!availableTopics[i] || !availableStudents[i]) {
      break;
    }

    const topic = availableTopics[(baseIndexes[i] + 7) % availableTopics.length];
    const studentId = availableStudents[(baseIndexes[i] + 19) % availableStudents.length];

    const created = await prisma.topicRegistration.create({
      data: {
        topicId: topic.id,
        studentId,
        semesterId: semester.id,
        status: statuses[i],
        rejectReason: statuses[i] === "REJECTED" ? "Sinh viên chưa đạt điều kiện tiên quyết." : null,
      },
    });

    usedTopicIds.add(topic.id);
    usedStudentIds.add(studentId);
    extra.push(created);
  }

  return extra;
}

async function createTasksMilestonesSubmissions({ semester, registrationEntries }) {
  let createdTasks = 0;
  let createdSubmissions = 0;
  let createdMilestones = 0;

  for (let i = 0; i < registrationEntries.length; i += 1) {
    const { registration, progress, studentId } = registrationEntries[i];

    const taskTemplates = [
      { title: "Khảo sát yêu cầu", delta: -35, status: progress >= 40 ? "COMPLETED" : "IN_PROGRESS" },
      { title: "Thiết kế kiến trúc và CSDL", delta: -20, status: progress >= 55 ? "COMPLETED" : "IN_PROGRESS" },
      { title: "Xây dựng module chính", delta: -8, status: progress >= 70 ? "SUBMITTED" : "IN_PROGRESS" },
      { title: "Kiểm thử và tinh chỉnh", delta: 3, status: progress >= 85 ? "COMPLETED" : progress >= 60 ? "IN_PROGRESS" : "OPEN" },
      { title: "Báo cáo tổng kết", delta: 10, status: progress >= 90 ? "SUBMITTED" : "OPEN" },
    ];

    for (let t = 0; t < taskTemplates.length; t += 1) {
      const template = taskTemplates[t];
      const dueDate = shiftDays(semester.midtermReportDate || semester.startDate, template.delta + t);
      const task = await prisma.task.create({
        data: {
          registrationId: registration.id,
          title: `${template.title} - Task ${t + 1}`,
          content: "Cần có tài liệu minh chứng, commit rõ ràng và video demo ngắn cho từng mốc.",
          dueDate,
          status: template.status,
        },
      });
      createdTasks += 1;

      if (["SUBMITTED", "COMPLETED"].includes(template.status)) {
        await prisma.submission.create({
          data: {
            taskId: task.id,
            registrationId: registration.id,
            submittedBy: studentId,
            content: "Đã nộp bản cập nhật bao gồm mã nguồn, tài liệu mô tả và kết quả kiểm thử.",
            fileUrl: `https://demo.example.edu/files/${registration.id}-${task.id}.pdf`,
            fileName: `submission-${registration.id}-${task.id}.pdf`,
            submittedAt: shiftDays(dueDate, -1),
            feedback: "Đã nhận bài. Nội dung đạt mục tiêu của giai đoạn.",
            feedbackAt: shiftDays(dueDate, 1),
          },
        });
        createdSubmissions += 1;
      }
    }

    const milestoneTemplates = [
      { title: "Mốc 1 - Phân tích bài toán", offset: -25, gate: 35 },
      { title: "Mốc 2 - Bản chạy thử", offset: -5, gate: 65 },
      { title: "Mốc 3 - Hoàn thiện bảo vệ", offset: 12, gate: 90 },
    ];

    for (const milestoneTemplate of milestoneTemplates) {
      const passed = progress >= milestoneTemplate.gate;
      await prisma.milestone.create({
        data: {
          registrationId: registration.id,
          title: milestoneTemplate.title,
          dueDate: shiftDays(semester.midtermReportDate || semester.startDate, milestoneTemplate.offset),
          status: passed ? "PASSED" : "PENDING",
          feedback: passed ? "Đạt yêu cầu của hội đồng hướng dẫn." : null,
          completedAt: passed ? shiftDays(semester.startDate, 40) : null,
        },
      });
      createdMilestones += 1;
    }
  }

  return { createdTasks, createdSubmissions, createdMilestones };
}

async function createCouncilsAndResults({ semester, lecturerIds, registrations, createDefenseResult }) {
  const councils = [];
  const candidateRegs = registrations.filter((entry) => ["DEFENDED", "COMPLETED"].includes(entry.registration.status));

  if (candidateRegs.length === 0) {
    return { councilsCreated: 0, membersCreated: 0, defenseResultsCreated: 0 };
  }

  const councilCount = Math.min(3, Math.max(1, Math.ceil(candidateRegs.length / 6)));

  for (let i = 0; i < councilCount; i += 1) {
    const council = await prisma.council.create({
      data: {
        semesterId: semester.id,
        name: `Hội đồng ${String.fromCharCode(65 + i)} - Đợt ${semester.id}`,
        location: `Phòng B${401 + i}`,
        defenseDate: shiftDays(semester.defenseDate || semester.endDate, i),
      },
    });
    councils.push(council);

    const chair = lecturerIds[(i * 3) % lecturerIds.length];
    const secretary = lecturerIds[(i * 3 + 1) % lecturerIds.length];
    const reviewer = lecturerIds[(i * 3 + 2) % lecturerIds.length];

    await prisma.councilMember.createMany({
      data: [
        { councilId: council.id, lecturerId: chair, roleInCouncil: "CHAIRMAN" },
        { councilId: council.id, lecturerId: secretary, roleInCouncil: "SECRETARY" },
        { councilId: council.id, lecturerId: reviewer, roleInCouncil: "REVIEWER" },
      ],
    });
  }

  let assigned = 0;
  let defenseResultsCreated = 0;

  for (const entry of candidateRegs) {
    const council = councils[assigned % councils.length];
    assigned += 1;

    await prisma.topicRegistration.update({
      where: { id: entry.registration.id },
      data: { councilId: council.id },
    });

    if (createDefenseResult) {
      await prisma.defenseResult.create({
        data: {
          registrationId: entry.registration.id,
          finalScore: scoreByIndex(entry.registration.id),
          comments: "Kết quả bảo vệ đạt yêu cầu, giải trình rõ, làm chủ hệ thống.",
          scoresheetUrl: `https://demo.example.edu/scores/${entry.registration.id}.pdf`,
          evaluatorId: lecturerIds[(entry.registration.id + 2) % lecturerIds.length],
        },
      });
      defenseResultsCreated += 1;

      if (entry.registration.status === "DEFENDED") {
        await prisma.topicRegistration.update({
          where: { id: entry.registration.id },
          data: { status: "COMPLETED" },
        });
      }
    }
  }

  return {
    councilsCreated: councils.length,
    membersCreated: councils.length * 3,
    defenseResultsCreated,
  };
}

async function createNotifications({ allUserIds, semesters }) {
  const notifications = [];

  for (let i = 0; i < 220; i += 1) {
    const userId = allUserIds[i % allUserIds.length];
    const semester = semesters[i % semesters.length];
    const typeCycle = ["SYSTEM", "APPROVAL", "REGISTRATION", "TASK_REMINDER", "SUBMISSION", "DEFENSE"];
    const type = typeCycle[i % typeCycle.length];

    notifications.push({
      userId,
      title: `Thông báo ${i + 1} - ${semester.name}`,
      content: "Hệ thống cập nhật tiến độ, lịch học vụ và trạng thái duyệt đề tài cho tài khoản của bạn.",
      type,
      isRead: i % 4 === 0,
      referenceUrl: `/dashboard/notifications/${i + 1}`,
    });
  }

  await prisma.notification.createMany({ data: notifications });
  return notifications.length;
}

async function seedBusinessData() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, role: true, email: true },
    orderBy: { id: "asc" },
  });

  const lecturerIds = users.filter((u) => u.role === "LECTURER").map((u) => u.id);
  const studentIds = users.filter((u) => u.role === "STUDENT").map((u) => u.id);
  const allUserIds = users.map((u) => u.id);

  const semesters = await createSemesters();

  const semesterPlans = [
    { semester: semesters[0], topics: { approved: 26, pending: 3, rejected: 4 }, registrations: 24, profile: () => 100 },
    { semester: semesters[1], topics: { approved: 30, pending: 4, rejected: 5 }, registrations: 28, profile: (i) => 95 + (i % 6) },
    { semester: semesters[2], topics: { approved: 34, pending: 5, rejected: 5 }, registrations: 30, profile: (i) => [88, 78, 72, 64, 55, 45, 92, 97][i % 8] },
    { semester: semesters[3], topics: { approved: 38, pending: 8, rejected: 4 }, registrations: 26, profile: (i) => [30, 35, 40, 50, 60, 25][i % 6] },
  ];

  let topicStartIndex = 1;
  let createdTasks = 0;
  let createdSubmissions = 0;
  let createdMilestones = 0;
  let councilsCreated = 0;
  let membersCreated = 0;
  let defenseResultsCreated = 0;

  for (let s = 0; s < semesterPlans.length; s += 1) {
    const plan = semesterPlans[s];

    const topics = await createTopicsForSemester({
      semester: plan.semester,
      lecturerIds,
      approvedCount: plan.topics.approved,
      pendingCount: plan.topics.pending,
      rejectedCount: plan.topics.rejected,
      startIndex: topicStartIndex,
    });
    topicStartIndex += topics.length;

    const approvedTopics = topics.filter((topic) => topic.status === "APPROVED");
    const semesterStudents = studentIds.slice((s * 18) % studentIds.length).concat(studentIds.slice(0, (s * 18) % studentIds.length));

    const baseRegistrations = await createRegistrationsAndProgress({
      semester: plan.semester,
      approvedTopics,
      studentIds: semesterStudents,
      targetCount: plan.registrations,
      profile: plan.profile,
    });

    const usedTopicIds = new Set(baseRegistrations.map((entry) => entry.topic.id));
    const usedStudentIds = new Set(baseRegistrations.map((entry) => entry.studentId));

    const extraRegs = await addRejectedOrWithdrawnCases({
      semester: plan.semester,
      approvedTopics,
      studentIds: semesterStudents,
      usedTopicIds,
      usedStudentIds,
    });

    const mergedEntries = baseRegistrations.concat(
      extraRegs.map((registration) => ({ registration, progress: 15, studentId: registration.studentId }))
    );

    const taskStats = await createTasksMilestonesSubmissions({
      semester: plan.semester,
      registrationEntries: mergedEntries,
    });
    createdTasks += taskStats.createdTasks;
    createdSubmissions += taskStats.createdSubmissions;
    createdMilestones += taskStats.createdMilestones;

    const councilStats = await createCouncilsAndResults({
      semester: plan.semester,
      lecturerIds,
      registrations: mergedEntries,
      createDefenseResult: ["COMPLETED", "DEFENSE"].includes(plan.semester.status),
    });
    councilsCreated += councilStats.councilsCreated;
    membersCreated += councilStats.membersCreated;
    defenseResultsCreated += councilStats.defenseResultsCreated;
  }

  const notificationsCreated = await createNotifications({ allUserIds, semesters });

  return {
    semesters: semesters.length,
    tasks: createdTasks,
    submissions: createdSubmissions,
    milestones: createdMilestones,
    councils: councilsCreated,
    councilMembers: membersCreated,
    defenseResults: defenseResultsCreated,
    notifications: notificationsCreated,
  };
}

async function main() {
  console.log("[seed] Start seeding realistic demo data...");

  await clearNonUserData();
  await upsertUsers();
  const generated = await seedBusinessData();

  const counts = {
    users: await prisma.user.count(),
    semesters: await prisma.semester.count(),
    topics: await prisma.topic.count(),
    registrations: await prisma.topicRegistration.count(),
    tasks: await prisma.task.count(),
    submissions: await prisma.submission.count(),
    milestones: await prisma.milestone.count(),
    councils: await prisma.council.count(),
    councilMembers: await prisma.councilMember.count(),
    defenseResults: await prisma.defenseResult.count(),
    notifications: await prisma.notification.count(),
  };

  console.log("[seed] Generated summary:");
  console.table(generated);

  console.log("[seed] Final DB counts:");
  console.table(counts);

  console.log("\\nLogin samples:");
  console.log("- admin@university.edu.vn / admin123");
  console.log("- lecturer01@university.edu.vn / lecturer123");
  console.log("- sv001@university.edu.vn / student123");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("[seed] Failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
