require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

// Tạo adapter và PrismaClient
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Bắt đầu tạo dữ liệu mẫu...\n');

    // ============================
    // 1. Tạo tài khoản Admin
    // ============================
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@university.edu.vn' },
        update: {},
        create: {
            email: 'admin@university.edu.vn',
            passwordHash: adminPassword,
            fullName: 'Quản trị viên',
            code: 'ADMIN001',
            role: 'ADMIN',
            department: 'Viện Công nghệ Số',
        },
    });
    console.log('✅ Tạo Admin:', admin.email);

    // ============================
    // 2. Tạo tài khoản Giảng viên mẫu
    // ============================
    const lecturerPassword = await bcrypt.hash('lecturer123', 10);
    const lecturer1 = await prisma.user.upsert({
        where: { email: 'nguyenvana@university.edu.vn' },
        update: {},
        create: {
            email: 'nguyenvana@university.edu.vn',
            passwordHash: lecturerPassword,
            fullName: 'TS. Nguyễn Văn A',
            code: 'GV001',
            role: 'LECTURER',
            department: 'Bộ môn Công nghệ Phần mềm',
            academicTitle: 'TIEN_SI', // TS: tối đa 15 SV
        },
    });

    const lecturer2 = await prisma.user.upsert({
        where: { email: 'tranvanb@university.edu.vn' },
        update: {},
        create: {
            email: 'tranvanb@university.edu.vn',
            passwordHash: lecturerPassword,
            fullName: 'ThS. Trần Văn B',
            code: 'GV002',
            role: 'LECTURER',
            department: 'Bộ môn Hệ thống Thông tin',
            academicTitle: 'THAC_SI', // ThS: tối đa 10 SV
        },
    });
    console.log('✅ Tạo 2 Giảng viên mẫu');

    // ============================
    // 3. Tạo tài khoản Sinh viên mẫu
    // ============================
    const studentPassword = await bcrypt.hash('student123', 10);
    const student1 = await prisma.user.upsert({
        where: { email: 'sv001@university.edu.vn' },
        update: {},
        create: {
            email: 'sv001@university.edu.vn',
            passwordHash: studentPassword,
            fullName: 'Lê Thị C',
            code: '2021001',
            role: 'STUDENT',
            department: 'Viện Công nghệ Số',
        },
    });

    const student2 = await prisma.user.upsert({
        where: { email: 'sv002@university.edu.vn' },
        update: {},
        create: {
            email: 'sv002@university.edu.vn',
            passwordHash: studentPassword,
            fullName: 'Phạm Văn D',
            code: '2021002',
            role: 'STUDENT',
            department: 'Viện Công nghệ Số',
        },
    });

    const student3 = await prisma.user.upsert({
        where: { email: 'sv003@university.edu.vn' },
        update: {},
        create: {
            email: 'sv003@university.edu.vn',
            passwordHash: studentPassword,
            fullName: 'Hoàng Minh E',
            code: '2021003',
            role: 'STUDENT',
            department: 'Viện Công nghệ Số',
        },
    });
    console.log('✅ Tạo 3 Sinh viên mẫu');

    // ============================
    // 4. Tạo Đợt đồ án mẫu
    // ============================
    const semester = await prisma.semester.upsert({
        where: { id: 1 },
        update: {},
        create: {
            name: 'Đồ án Chuyên ngành - HK1 2026-2027',
            startDate: new Date('2026-09-01'),
            endDate: new Date('2027-01-15'),
            registrationDeadline: new Date('2026-09-30'),
            defenseDate: new Date('2027-01-10'),
            status: 'REGISTRATION',
        },
    });
    console.log('✅ Tạo Đợt đồ án:', semester.name);

    // ============================
    // 5. Tạo Đề tài mẫu (do giảng viên đăng tải)
    // ============================
    const topic1 = await prisma.topic.upsert({
        where: { id: 1 },
        update: {},
        create: {
            semesterId: semester.id,
            title: 'Xây dựng Website Quản lý Đồ án',
            description: 'Xây dựng hệ thống web quản lý đồ án cho Viện Công nghệ Số, bao gồm các chức năng: đăng ký đề tài, theo dõi tiến độ, chấm điểm và bảo vệ đồ án.',
            proposedById: lecturer1.id,
            mentorId: lecturer1.id,
            maxStudents: 3,
            status: 'APPROVED',
        },
    });

    const topic2 = await prisma.topic.upsert({
        where: { id: 2 },
        update: {},
        create: {
            semesterId: semester.id,
            title: 'Ứng dụng AI trong Nhận diện Khuôn mặt',
            description: 'Nghiên cứu và xây dựng ứng dụng nhận diện khuôn mặt sử dụng Deep Learning, áp dụng vào hệ thống điểm danh tự động.',
            proposedById: lecturer2.id,
            mentorId: lecturer2.id,
            maxStudents: 2,
            status: 'APPROVED',
        },
    });

    const topic3 = await prisma.topic.upsert({
        where: { id: 3 },
        update: {},
        create: {
            semesterId: semester.id,
            title: 'Phát triển App Mobile quản lý sức khỏe',
            description: 'Xây dựng ứng dụng di động giúp theo dõi sức khỏe cá nhân, tích hợp IoT và AI để đưa ra khuyến nghị.',
            proposedById: lecturer1.id,
            mentorId: lecturer1.id,
            maxStudents: 2,
            status: 'APPROVED',
        },
    });
    console.log('✅ Tạo 3 Đề tài mẫu');

    // ============================
    // 6. Tạo Đăng ký đề tài mẫu (TopicRegistration)
    // ============================
    const reg1 = await prisma.topicRegistration.upsert({
        where: { id: 1 },
        update: {},
        create: {
            topicId: topic1.id,
            studentId: student1.id,
            semesterId: semester.id,
            status: 'APPROVED', // GV đã duyệt
        },
    });

    const reg2 = await prisma.topicRegistration.upsert({
        where: { id: 2 },
        update: {},
        create: {
            topicId: topic2.id,
            studentId: student2.id,
            semesterId: semester.id,
            status: 'PENDING', // Đang chờ GV duyệt
        },
    });
    console.log('✅ Tạo Đăng ký đề tài mẫu');

    // ============================
    // 7. Tạo Task mẫu (gán cho registration)
    // ============================
    const task1 = await prisma.task.upsert({
        where: { id: 1 },
        update: {},
        create: {
            registrationId: reg1.id,
            title: 'Báo cáo Tuần 1: Khảo sát yêu cầu',
            content: 'Sinh viên nộp bảng khảo sát yêu cầu hệ thống.',
            dueDate: new Date(new Date().setDate(new Date().getDate() + 7)),
            status: 'COMPLETED',
        },
    });

    await prisma.submission.upsert({
        where: { id: 1 },
        update: {},
        create: {
            taskId: task1.id,
            registrationId: reg1.id,
            submittedBy: student1.id,
            content: 'Em đã phỏng vấn 3 thầy cô để lấy yêu cầu.',
            fileUrl: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
            fileName: 'KhaoSatYeuCau.pdf',
            feedback: 'Làm tốt lắm. Tuần tới bắt đầu vẽ Use Case nhé.',
            feedbackAt: new Date(),
        },
    });

    await prisma.task.upsert({
        where: { id: 2 },
        update: {},
        create: {
            registrationId: reg1.id,
            title: 'Báo cáo Tuần 2: Use Case Diagram',
            content: 'Nộp sơ đồ Use Case và System Sequence Diagram.',
            dueDate: new Date(new Date().setDate(new Date().getDate() + 14)),
            status: 'OPEN',
        },
    });
    console.log('✅ Tạo Task và Báo cáo mẫu');

    // ============================
    // 8. Tạo Milestone mẫu
    // ============================
    await prisma.milestone.create({
        data: {
            registrationId: reg1.id,
            title: 'Giai đoạn 1: Phân tích yêu cầu',
            dueDate: new Date('2026-10-15'),
            status: 'PASSED',
            feedback: 'Phân tích yêu cầu tốt, đạt yêu cầu.',
            completedAt: new Date('2026-10-14'),
        }
    });
    await prisma.milestone.create({
        data: {
            registrationId: reg1.id,
            title: 'Giai đoạn 2: Thiết kế hệ thống',
            dueDate: new Date('2026-11-15'),
            status: 'PENDING',
        }
    });
    console.log('✅ Tạo Milestone mẫu');

    console.log('\n🎉 Tạo dữ liệu mẫu hoàn tất!');
    console.log('\n📋 Tài khoản đăng nhập thử:');
    console.log('   Admin:      admin@university.edu.vn / admin123');
    console.log('   Giảng viên: nguyenvana@university.edu.vn / lecturer123');
    console.log('   Sinh viên:  sv001@university.edu.vn / student123\n');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error('❌ Lỗi khi tạo dữ liệu mẫu:', e);
        await prisma.$disconnect();
        process.exit(1);
    });
