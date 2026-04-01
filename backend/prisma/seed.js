require("dotenv").config();

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

async function upsertUsers() {
  const passwordHashes = {
    admin: await bcrypt.hash("admin123", 10),
    lecturer: await bcrypt.hash("lecturer123", 10),
    student: await bcrypt.hash("student123", 10),
  };

  const userSeeds = [
    {
      email: "admin@university.edu.vn",
      passwordHash: passwordHashes.admin,
      fullName: "Quản trị hệ thống",
      code: "ADMIN001",
      role: "ADMIN",
      department: "Viện Công nghệ Số",
      isActive: true,
    },
    {
      email: "admin2@university.edu.vn",
      passwordHash: passwordHashes.admin,
      fullName: "Quản trị đào tạo",
      code: "ADMIN002",
      role: "ADMIN",
      department: "Viện Công nghệ Số",
      isActive: true,
    },

    {
      email: "nguyenvana@university.edu.vn",
      passwordHash: passwordHashes.lecturer,
      fullName: "TS. Nguyễn Văn A",
      code: "GV001",
      role: "LECTURER",
      department: "Bộ môn Công nghệ Phần mềm",
      academicTitle: "TIEN_SI",
      isActive: true,
    },
    {
      email: "tranvanb@university.edu.vn",
      passwordHash: passwordHashes.lecturer,
      fullName: "ThS. Trần Văn B",
      code: "GV002",
      role: "LECTURER",
      department: "Bộ môn Hệ thống Thông tin",
      academicTitle: "THAC_SI",
      isActive: true,
    },
    {
      email: "levanc@university.edu.vn",
      passwordHash: passwordHashes.lecturer,
      fullName: "PGS. Lê Văn C",
      code: "GV003",
      role: "LECTURER",
      department: "Bộ môn Trí tuệ nhân tạo",
      academicTitle: "PHO_GIAO_SU",
      isActive: true,
    },
    {
      email: "phamthid@university.edu.vn",
      passwordHash: passwordHashes.lecturer,
      fullName: "TS. Phạm Thị D",
      code: "GV004",
      role: "LECTURER",
      department: "Bộ môn Mạng máy tính",
      academicTitle: "TIEN_SI",
      isActive: true,
    },
    {
      email: "hoangvane@university.edu.vn",
      passwordHash: passwordHashes.lecturer,
      fullName: "ThS. Hoàng Văn E",
      code: "GV005",
      role: "LECTURER",
      department: "Bộ môn Khoa học dữ liệu",
      academicTitle: "THAC_SI",
      isActive: true,
    },

    {
      email: "sv001@university.edu.vn",
      passwordHash: passwordHashes.student,
      fullName: "Lê Thị C",
      code: "2021001",
      role: "STUDENT",
      department: "Viện Công nghệ Số",
      isActive: true,
    },
    {
      email: "sv002@university.edu.vn",
      passwordHash: passwordHashes.student,
      fullName: "Phạm Văn D",
      code: "2021002",
      role: "STUDENT",
      department: "Viện Công nghệ Số",
      isActive: true,
    },
    {
      email: "sv003@university.edu.vn",
      passwordHash: passwordHashes.student,
      fullName: "Hoang Minh E",
      code: "2021003",
      role: "STUDENT",
      department: "Viện Công nghệ Số",
      isActive: true,
    },
    {
      email: "sv004@university.edu.vn",
      passwordHash: passwordHashes.student,
      fullName: "Nguyễn Thị F",
      code: "2021004",
      role: "STUDENT",
      department: "Viện Công nghệ Số",
      isActive: true,
    },
    {
      email: "sv005@university.edu.vn",
      passwordHash: passwordHashes.student,
      fullName: "Trần Quang G",
      code: "2021005",
      role: "STUDENT",
      department: "Viện Công nghệ Số",
      isActive: true,
    },
    {
      email: "sv006@university.edu.vn",
      passwordHash: passwordHashes.student,
      fullName: "Bùi Minh H",
      code: "2021006",
      role: "STUDENT",
      department: "Viện Công nghệ Số",
      isActive: true,
    },
    {
      email: "sv007@university.edu.vn",
      passwordHash: passwordHashes.student,
      fullName: "Võ Tuấn I",
      code: "2021007",
      role: "STUDENT",
      department: "Viện Công nghệ Số",
      isActive: true,
    },
    {
      email: "sv008@university.edu.vn",
      passwordHash: passwordHashes.student,
      fullName: "Đặng Bảo K",
      code: "2021008",
      role: "STUDENT",
      department: "Viện Công nghệ Số",
      isActive: true,
    },
  ];

  for (const user of userSeeds) {
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
    prisma.notification.deleteMany(),
    prisma.defenseResult.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.task.deleteMany(),
    prisma.milestone.deleteMany(),
    prisma.councilMember.deleteMany(),
    prisma.topicRegistration.deleteMany(),
    prisma.council.deleteMany(),
    prisma.topic.deleteMany(),
    prisma.semester.deleteMany(),
  ]);
}

async function seedBusinessData() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, role: true },
  });

  const idByEmail = Object.fromEntries(users.map((u) => [u.email, u.id]));

  const semesterPast = await prisma.semester.create({
    data: {
      name: "Đồ án chuyên ngành - HK2 2024-2025",
      startDate: new Date("2025-02-01T00:00:00.000Z"),
      registrationDeadline: new Date("2025-02-20T23:59:59.000Z"),
      midtermReportDate: new Date("2025-04-05T00:00:00.000Z"),
      defenseDate: new Date("2025-06-25T00:00:00.000Z"),
      endDate: new Date("2025-07-05T00:00:00.000Z"),
      registrationOpen: false,
      status: "COMPLETED",
    },
  });

  const semesterCurrent = await prisma.semester.create({
    data: {
      name: "Đồ án chuyên ngành - HK2 2025-2026",
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      registrationDeadline: new Date("2026-04-25T23:59:59.000Z"),
      midtermReportDate: new Date("2026-05-20T00:00:00.000Z"),
      defenseDate: new Date("2026-07-10T00:00:00.000Z"),
      endDate: new Date("2026-07-20T00:00:00.000Z"),
      registrationOpen: true,
      status: "REGISTRATION",
    },
  });

  const semesterNext = await prisma.semester.create({
    data: {
      name: "Đồ án chuyên ngành - HK1 2026-2027",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      registrationDeadline: new Date("2026-09-25T23:59:59.000Z"),
      midtermReportDate: new Date("2026-10-25T00:00:00.000Z"),
      defenseDate: new Date("2027-01-10T00:00:00.000Z"),
      endDate: new Date("2027-01-20T00:00:00.000Z"),
      registrationOpen: false,
      status: "UPCOMING",
    },
  });

  const topicA = await prisma.topic.create({
    data: {
      semesterId: semesterCurrent.id,
      title: "Nền tảng quản lý đồ án học thuật",
      description:
        "Xây dựng nền tảng full-stack quản lý toàn bộ luồng đồ án theo vai trò, từ đăng ký đến bảo vệ và chấm điểm.",
      proposedById: idByEmail["nguyenvana@university.edu.vn"],
      mentorId: idByEmail["nguyenvana@university.edu.vn"],
      maxStudents: 3,
      status: "APPROVED",
    },
  });

  const topicB = await prisma.topic.create({
    data: {
      semesterId: semesterCurrent.id,
      title: "Hệ thống điểm danh bằng nhận diện khuôn mặt",
      description:
        "Thiết kế giải pháp điểm danh tự động dùng nhận diện khuôn mặt và suy luận biên cho phòng học thông minh.",
      proposedById: idByEmail["tranvanb@university.edu.vn"],
      mentorId: idByEmail["tranvanb@university.edu.vn"],
      maxStudents: 2,
      status: "APPROVED",
    },
  });

  const topicC = await prisma.topic.create({
    data: {
      semesterId: semesterCurrent.id,
      title: "Bảng điều khiển phát hiện bất thường mạng",
      description:
        "Xây dựng dashboard phát hiện bất thường từ telemetry mạng và nhật ký sự kiện an ninh.",
      proposedById: idByEmail["phamthid@university.edu.vn"],
      mentorId: idByEmail["phamthid@university.edu.vn"],
      maxStudents: 2,
      status: "PENDING",
    },
  });

  const topicD = await prisma.topic.create({
    data: {
      semesterId: semesterCurrent.id,
      title: "Kho dữ liệu phân tích học tập",
      description:
        "Xây dựng pipeline ETL và báo cáo BI phục vụ theo dõi tiến độ học tập và phân tích kết quả đầu ra.",
      proposedById: idByEmail["hoangvane@university.edu.vn"],
      mentorId: idByEmail["hoangvane@university.edu.vn"],
      maxStudents: 2,
      status: "REJECTED",
      rejectReason: "Phạm vi đề tài quá rộng so với một chu kỳ đồ án.",
    },
  });

  const registration1 = await prisma.topicRegistration.create({
    data: {
      topicId: topicA.id,
      studentId: idByEmail["sv001@university.edu.vn"],
      semesterId: semesterCurrent.id,
      status: "IN_PROGRESS",
    },
  });

  const registration2 = await prisma.topicRegistration.create({
    data: {
      topicId: topicB.id,
      studentId: idByEmail["sv002@university.edu.vn"],
      semesterId: semesterCurrent.id,
      status: "APPROVED",
    },
  });

  await prisma.topicRegistration.create({
    data: {
      topicId: topicA.id,
      studentId: idByEmail["sv003@university.edu.vn"],
      semesterId: semesterCurrent.id,
      status: "PENDING",
    },
  });

  await prisma.topicRegistration.create({
    data: {
      topicId: topicC.id,
      studentId: idByEmail["sv004@university.edu.vn"],
      semesterId: semesterCurrent.id,
      status: "REJECTED",
      rejectReason: "Topic not approved yet.",
    },
  });

  const registrationPast = await prisma.topicRegistration.create({
    data: {
      topicId: await prisma.topic
        .create({
          data: {
            semesterId: semesterPast.id,
            title: "Ứng dụng di động theo dõi sức khỏe cá nhân",
            description:
              "Phát triển ứng dụng di động theo dõi sức khỏe cá nhân, đồng bộ đám mây và xuất báo cáo.",
            proposedById: idByEmail["levanc@university.edu.vn"],
            mentorId: idByEmail["levanc@university.edu.vn"],
            maxStudents: 2,
            status: "APPROVED",
          },
        })
        .then((t) => t.id),
      studentId: idByEmail["sv005@university.edu.vn"],
      semesterId: semesterPast.id,
      status: "COMPLETED",
    },
  });

  const task1 = await prisma.task.create({
    data: {
      registrationId: registration1.id,
      title: "Tuần 1 - Khảo sát yêu cầu",
      content: "Thu thập yêu cầu từ luồng nghiệp vụ quản trị viên, giảng viên và sinh viên.",
      dueDate: daysFromNow(5),
      status: "COMPLETED",
    },
  });

  const task2 = await prisma.task.create({
    data: {
      registrationId: registration1.id,
      title: "Tuần 2 - Thiết kế ERD và chốt API",
      content: "Thiết kế ERD và chốt API contract cho luồng học kỳ và đề tài.",
      dueDate: daysFromNow(12),
      status: "IN_PROGRESS",
    },
  });

  await prisma.submission.create({
    data: {
      taskId: task1.id,
      registrationId: registration1.id,
      submittedBy: idByEmail["sv001@university.edu.vn"],
      content: "Đính kèm tài liệu phân tích yêu cầu và user journey theo từng vai trò.",
      fileUrl: "https://example.com/files/khao-sat-yeu-cau-sv001.pdf",
      fileName: "khao-sat-yeu-cau-sv001.pdf",
      submittedAt: daysFromNow(-2),
      feedback: "Bố cục tốt. Bổ sung thêm yêu cầu phi chức năng ở bản cập nhật tiếp theo.",
      feedbackAt: daysFromNow(-1),
    },
  });

  await prisma.submission.create({
    data: {
      taskId: task2.id,
      registrationId: registration1.id,
      submittedBy: idByEmail["sv001@university.edu.vn"],
      content: "Đã hoàn thành bản nháp thiết kế cơ sở dữ liệu và danh sách endpoint ban đầu.",
      fileUrl: "https://example.com/files/ban-nhap-erd-api-sv001.pdf",
      fileName: "ban-nhap-erd-api-sv001.pdf",
      submittedAt: daysFromNow(0),
    },
  });

  await prisma.milestone.createMany({
    data: [
      {
        registrationId: registration1.id,
        title: "Mốc 1 - Phân tích yêu cầu",
        dueDate: daysFromNow(7),
        status: "PASSED",
        feedback: "Đạt yêu cầu sau khi chỉnh sửa nhỏ.",
        completedAt: daysFromNow(-1),
      },
      {
        registrationId: registration1.id,
        title: "Mốc 2 - Nền tảng kiến trúc hệ thống",
        dueDate: daysFromNow(20),
        status: "PENDING",
      },
      {
        registrationId: registration2.id,
        title: "Mốc 1 - Chuẩn bị bộ dữ liệu",
        dueDate: daysFromNow(10),
        status: "PENDING",
      },
    ],
  });

  const council = await prisma.council.create({
    data: {
      semesterId: semesterCurrent.id,
      name: "Hội đồng A - Công nghệ phần mềm và AI",
      location: "Phòng B402",
      defenseDate: semesterCurrent.defenseDate,
    },
  });

  await prisma.councilMember.createMany({
    data: [
      {
        councilId: council.id,
        lecturerId: idByEmail["levanc@university.edu.vn"],
        roleInCouncil: "CHAIRMAN",
      },
      {
        councilId: council.id,
        lecturerId: idByEmail["phamthid@university.edu.vn"],
        roleInCouncil: "SECRETARY",
      },
      {
        councilId: council.id,
        lecturerId: idByEmail["nguyenvana@university.edu.vn"],
        roleInCouncil: "REVIEWER",
      },
    ],
  });

  await prisma.topicRegistration.update({
    where: { id: registration1.id },
    data: { councilId: council.id },
  });

  await prisma.topicRegistration.update({
    where: { id: registrationPast.id },
    data: { status: "DEFENDED" },
  });

  await prisma.defenseResult.create({
    data: {
      registrationId: registrationPast.id,
      finalScore: 8.7,
      comments: "Triển khai tốt, trình bày rõ ràng, trả lời phản biện thuyết phục.",
      scoresheetUrl: "https://example.com/files/bang-diem-bao-ve-sv005.pdf",
      evaluatorId: idByEmail["levanc@university.edu.vn"],
    },
  });

  await prisma.topicRegistration.update({
    where: { id: registrationPast.id },
    data: { status: "COMPLETED" },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: idByEmail["sv001@university.edu.vn"],
        title: "Cập nhật phản hồi nhiệm vụ",
        content: "Bài nộp Tuần 1 của bạn đã có phản hồi mới từ giảng viên.",
        type: "SUBMISSION",
        isRead: false,
      },
      {
        userId: idByEmail["sv002@university.edu.vn"],
        title: "Đăng ký đề tài đã được duyệt",
        content: "Đăng ký đề tài điểm danh bằng nhận diện khuôn mặt của bạn đã được chấp thuận.",
        type: "APPROVAL",
        isRead: true,
      },
      {
        userId: idByEmail["nguyenvana@university.edu.vn"],
        title: "Có bài nộp mới",
        content: "Sinh viên sv001 đã nộp bài cho nhiệm vụ Tuần 2.",
        type: "SUBMISSION",
        isRead: false,
      },
      {
        userId: idByEmail["admin@university.edu.vn"],
        title: "Sẵn sàng phân lịch bảo vệ",
        content: "Hội đồng A đã đủ thành viên để lên lịch bảo vệ.",
        type: "DEFENSE",
        isRead: false,
      },
    ],
  });

  void semesterNext;
  void topicD;
}

async function main() {
  console.log("[seed] Start seeding users + realistic business data...");

  await upsertUsers();
  await clearNonUserData();
  await seedBusinessData();

  const counts = {
    users: await prisma.user.count(),
    semesters: await prisma.semester.count(),
    topics: await prisma.topic.count(),
    registrations: await prisma.topicRegistration.count(),
    tasks: await prisma.task.count(),
    submissions: await prisma.submission.count(),
    councils: await prisma.council.count(),
    defenseResults: await prisma.defenseResult.count(),
    notifications: await prisma.notification.count(),
  };

  console.log("[seed] Done.");
  console.table(counts);
  console.log("\nLogin samples:");
  console.log("- admin@university.edu.vn / admin123");
  console.log("- nguyenvana@university.edu.vn / lecturer123");
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
