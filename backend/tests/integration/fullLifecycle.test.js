jest.mock('../../src/config/database', () => ({
    $transaction: jest.fn(),
    user: {
        findUnique: jest.fn(),
    },
    semester: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
    },
    topic: {
        findUnique: jest.fn(),
    },
    topicRegistration: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
    },
    task: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn(),
    },
    council: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    defenseMemberScore: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    defenseMemberCriterionScore: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
    },
    defenseResult: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
    },
    projectArchive: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
    },
    meetingLog: {
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
    },
    studentProjectEnrollment: {
        findFirst: jest.fn(),
    },
    notification: {
        create: jest.fn(),
    },
}));

jest.mock('../../src/constants/mentorCapacity', () => ({
    getMentorMaxSlots: jest.fn().mockReturnValue(10),
}));

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/uploadService', () => ({
    uploadBuffer: jest.fn().mockResolvedValue({ secure_url: 'https://test-storage.example.com/test.pdf' }),
}));

jest.mock('../../src/services/scoreSheetPdfService', () => ({
    generateScoreSheetPdfBuffer: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test')),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Full 6-Stage Graduation Project Lifecycle Integration Test Suite', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
        prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
        prisma.notification.create.mockResolvedValue({});

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'mentor-token') return { userId: 20, role: 'LECTURER' };
            if (token === 'evaluator-token') return { userId: 30, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 10) return { id: 10, role: 'STUDENT', fullName: 'Nguyen Van A', code: 'SV010', isActive: true, department: 'CNTT' };
            if (where.id === 20) return { id: 20, role: 'LECTURER', fullName: 'TS. Tran Huong Dan', code: 'GV020', isActive: true, department: 'CNTT' };
            if (where.id === 30) return { id: 30, role: 'LECTURER', fullName: 'ThS. Le Phan Bien', code: 'GV030', isActive: true, department: 'CNTT' };
            if (where.id === 1) return { id: 1, role: 'ADMIN', fullName: 'Vien Truong', code: 'AD001', isActive: true, department: 'BGH' };
            return null;
        });
    });

    // ─────────────────────────────────────────────────────────────
    // STAGE 1: ĐĂNG KÝ ĐỀ TÀI & PHÊ DUYỆT BỞI GVHD
    // ─────────────────────────────────────────────────────────────
    describe('Giai đoạn 1: Đăng ký đề tài & Phê duyệt', () => {
        it('1.1 Sinh viên đăng ký đề tài thành công', async () => {
            prisma.semester.findUnique.mockResolvedValue({
                id: 1,
                startDate: new Date('2026-01-01'),
                registrationDeadline: new Date('2026-12-31'),
                registrationOpen: true,
            });
            prisma.topic.findUnique.mockResolvedValue({
                id: 100,
                title: 'Hệ thống Quản lý Đồ án',
                mentorId: 20,
                status: 'APPROVED',
                semesterId: 1,
                projectCatalogId: 1,
                projectCatalog: { id: 1, name: 'Khóa luận tốt nghiệp' },
                _count: { registrations: 0 },
                mentor: { id: 20, academicTitle: 'TIEN_SI' },
            });
            prisma.studentProjectEnrollment.findFirst.mockResolvedValue({ id: 50, status: 'ACTIVE' });
            prisma.topicRegistration.findUnique.mockResolvedValue(null);
            prisma.topicRegistration.count.mockResolvedValue(0);
            prisma.topicRegistration.create.mockResolvedValue({
                id: 501,
                topicId: 100,
                studentId: 10,
                semesterId: 1,
                status: 'PENDING',
            });

            const res = await request(app)
                .post('/api/registrations')
                .set('Authorization', 'Bearer student-token')
                .send({ topicId: 100, semesterId: 1 });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('PENDING');
        });

        it('1.2 GVHD duyệt đề tài -> chuyển sang APPROVED', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 501,
                studentId: 10,
                semesterId: 1,
                status: 'PENDING',
                topic: {
                    title: 'Hệ thống Quản lý Đồ án',
                    mentorId: 20,
                    mentor: { id: 20, academicTitle: 'TIEN_SI' },
                },
                student: { id: 10, fullName: 'Nguyen Van A', code: 'SV010' },
            });
            prisma.topicRegistration.count = jest.fn().mockResolvedValue(2);
            prisma.topicRegistration.update.mockResolvedValue({
                id: 501,
                status: 'APPROVED',
            });

            const res = await request(app)
                .patch('/api/registrations/501/approve')
                .set('Authorization', 'Bearer mentor-token')
                .send({ action: 'APPROVE' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // STAGE 2: MIỄN THẨM ĐỊNH ĐỀ CƯƠNG (BYPASS BM01-BM02)
    // ─────────────────────────────────────────────────────────────
    describe('Giai đoạn 2: Miễn thẩm định đề cương (Bypass BM01-BM02)', () => {
        it('2.1 Sinh viên hoặc Giảng viên không có quyền gọi Bypass (403)', async () => {
            const res = await request(app)
                .post('/api/registrations/501/bypass-outline')
                .set('Authorization', 'Bearer student-token')
                .send({ reason: 'Xin miễn thẩm định' });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });

        it('2.2 Admin kích hoạt Bypass BM01-BM02 -> Chuyển IN_PROGRESS, PASSED, sinh task BM03', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 501,
                studentId: 10,
                status: 'APPROVED',
                outlineReviewStatus: 'PENDING',
                topic: { id: 100, title: 'Hệ thống Quản lý Đồ án', mentorId: 20 },
                student: { id: 10, fullName: 'Nguyen Van A', code: 'SV010' },
                tasks: [],
            });
            prisma.topicRegistration.update.mockResolvedValue({
                id: 501,
                status: 'IN_PROGRESS',
                outlineReviewStatus: 'PASSED',
                outlineFeedback: '[MIỄN THẨM ĐỊNH / BYPASS BM01-BM02]: Đề tài NCKH nghiệm thu Xuất sắc',
            });
            prisma.task.createMany.mockResolvedValue({ count: 4 });

            const res = await request(app)
                .post('/api/registrations/501/bypass-outline')
                .set('Authorization', 'Bearer admin-token')
                .send({ reason: 'Đề tài NCKH nghiệm thu Xuất sắc' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('IN_PROGRESS');
            expect(res.body.data.outlineReviewStatus).toBe('PASSED');
            expect(prisma.task.createMany).toHaveBeenCalled();
        });

        it('2.3 Admin phê duyệt Miễn thẩm định hàng loạt (batch-bypass-outline)', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 502,
                studentId: 10,
                status: 'APPROVED',
                outlineReviewStatus: 'PENDING',
                topic: { id: 100, title: 'Hệ thống IoT Giám sát', mentorId: 20 },
                student: { id: 10, fullName: 'Nguyen Van B', code: 'SV011' },
                tasks: [],
            });
            prisma.topicRegistration.update.mockResolvedValue({ id: 502, status: 'IN_PROGRESS' });
            prisma.task.createMany.mockResolvedValue({ count: 4 });

            const res = await request(app)
                .post('/api/registrations/batch-bypass-outline')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    registrationIds: [502],
                    reason: 'Miễn thẩm định theo quyết định Hội đồng Khoa',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.updatedCount).toBe(1);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // STAGE 3: TIẾN ĐỘ BM03 (MEETING LOGS)
    // ─────────────────────────────────────────────────────────────
    describe('Giai đoạn 3: Giám sát tiến độ BM03 qua Meeting Logs', () => {
        it('3.1 Sinh viên không thể tự tạo nhật ký gặp gỡ (403)', async () => {
            const res = await request(app)
                .post('/api/registrations/501/meeting-logs')
                .set('Authorization', 'Bearer student-token')
                .send({
                    studentWorkSummary: 'Em đã làm xong giao diện',
                });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });

        it('3.2 GVHD ghi nhận nhật ký gặp gỡ định kỳ BM03 thành công', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 501,
                status: 'IN_PROGRESS',
                studentId: 10,
                topic: { mentorId: 20, title: 'Hệ thống Quản lý Đồ án' },
                student: { fullName: 'Nguyen Van A' },
            });
            prisma.meetingLog.create.mockResolvedValue({
                id: 1,
                registrationId: 501,
                meetingType: 'LAB',
                studentWorkSummary: 'Hoàn thành module quản lý tiến độ',
                nextPlan: 'Lập trình API báo cáo BM04',
                supervisorNotes: 'Tiến độ tốt, bám sát kế hoạch',
                createdBy: 20,
            });

            const res = await request(app)
                .post('/api/registrations/501/meeting-logs')
                .set('Authorization', 'Bearer mentor-token')
                .send({
                    meetingType: 'LAB',
                    studentWorkSummary: 'Hoàn thành module quản lý tiến độ',
                    nextPlan: 'Lập trình API báo cáo BM04',
                    supervisorNotes: 'Tiến độ tốt, bám sát kế hoạch',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.meetingType).toBe('LAB');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // STAGE 4: BM04 & GATEKEEPING HỘI ĐỒNG BẢO VỆ
    // ─────────────────────────────────────────────────────────────
    describe('Giai đoạn 4: Đánh giá BM04 và Gatekeeping Hội đồng', () => {
        it('4.1 Chặn phân công vào Hội đồng bảo vệ nếu chưa hoàn thành BM04 (400)', async () => {
            prisma.council.findUnique.mockResolvedValue({
                id: 88,
                councilType: 'DEFENSE_COUNCIL',
                members: [
                    { lecturerId: 30, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 31, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 32, roleInCouncil: 'REVIEWER' },
                ],
                _count: { defenseRegistrations: 0 },
            });
            prisma.topicRegistration.findMany.mockResolvedValue([
                {
                    id: 501,
                    defenseCouncilId: null,
                    outlineCouncilId: null,
                    topic: { mentorId: 20, title: 'Hệ thống Quản lý Đồ án' },
                    student: { fullName: 'Nguyen Van A', code: 'SV010' },
                },
            ]);
            // Task BM04 chưa tồn tại hoặc chưa COMPLETED
            prisma.task.findMany.mockResolvedValue([]);

            const res = await request(app)
                .post('/api/councils/88/assign')
                .set('Authorization', 'Bearer admin-token')
                .send({ registrationIds: [501] });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('chưa hoàn thành biểu mẫu BM04');
        });

        it('4.2 GVHD lập phiếu nhận xét BM04 AGREED thành công', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 501,
                status: 'IN_PROGRESS',
                topic: { mentorId: 20, title: 'Hệ thống Quản lý Đồ án' },
                student: { fullName: 'Nguyen Van A' },
            });
            prisma.meetingLog.count.mockResolvedValue(5);
            prisma.task.findMany.mockResolvedValue([]);
            prisma.topicRegistration.update.mockResolvedValue({
                id: 501,
                status: 'SUBMITTED',
            });

            const res = await request(app)
                .post('/api/registrations/501/bm04-review')
                .set('Authorization', 'Bearer mentor-token')
                .send({
                    decision: 'AGREED',
                    feedback: 'Sinh viên hoàn thành xuất sắc đồ án, đồng ý cho bảo vệ.',
                    score: 9.0,
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('ĐỒNG Ý');
        });

        it('4.3 Sau khi BM04 COMPLETED, gán vào Hội đồng bảo vệ thành công', async () => {
            prisma.council.findUnique.mockResolvedValue({
                id: 88,
                councilType: 'DEFENSE_COUNCIL',
                members: [
                    { lecturerId: 30, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 31, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 32, roleInCouncil: 'REVIEWER' },
                ],
                _count: { defenseRegistrations: 0 },
            });
            prisma.topicRegistration.findMany.mockResolvedValue([
                {
                    id: 501,
                    defenseCouncilId: null,
                    outlineCouncilId: null,
                    topic: { mentorId: 20, title: 'Hệ thống Quản lý Đồ án' },
                    student: { fullName: 'Nguyen Van A', code: 'SV010' },
                },
            ]);
            prisma.task.findMany.mockResolvedValue([
                { registrationId: 501, status: 'COMPLETED' },
            ]);
            prisma.topicRegistration.updateMany.mockResolvedValue({ count: 1 });

            const res = await request(app)
                .post('/api/councils/88/assign')
                .set('Authorization', 'Bearer admin-token')
                .send({ registrationIds: [501] });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // STAGE 5: CHẤM ĐIỂM HỘI ĐỒNG & KHÓA SỔ ĐIỂM
    // ─────────────────────────────────────────────────────────────
    describe('Giai đoạn 5: Hội đồng chấm điểm và Khóa sổ điểm bảo vệ', () => {
        it('5.1 Thành viên trong defenseCouncil chấm điểm hợp lệ không bị từ chối quyền', async () => {
            // Giảng viên 30 thuộc defenseCouncil, chấm cho registration 501
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 501,
                status: 'SUBMITTED',
                studentId: 10,
                defenseCouncilId: 88,
                topic: { title: 'Hệ thống Quản lý Đồ án', mentorId: 20 },
                defenseCouncil: {
                    members: [{ lecturerId: 30, roleInCouncil: 'REVIEWER' }],
                },
                council: null,
            });
            prisma.defenseMemberScore.findUnique.mockResolvedValue(null);
            prisma.defenseMemberScore.create.mockResolvedValue({ id: 901, finalScore: 9.25 });
            prisma.defenseMemberCriterionScore.deleteMany.mockResolvedValue({ count: 0 });
            prisma.defenseMemberCriterionScore.createMany.mockResolvedValue({ count: 14 });
            prisma.defenseMemberScore.findMany.mockResolvedValue([{ finalScore: 9.25 }]);
            prisma.defenseResult.upsert.mockResolvedValue({ id: 701, finalScore: 9.25 });

            // Danh sách tiêu chí Rubric v1 đầy đủ
            const validScores = [
                { criterionCode: 'STRUCTURE', score: 0.5 },
                { criterionCode: 'CITATION_FORMAT', score: 0.25 },
                { criterionCode: 'LANGUAGE', score: 0.25 },
                { criterionCode: 'PROBLEM_STATEMENT', score: 1.0 },
                { criterionCode: 'RESEARCH_METHOD', score: 0.5 },
                { criterionCode: 'RESEARCH_CONTENT', score: 2.25 },
                { criterionCode: 'RESEARCH_RESULT', score: 1.0 },
                { criterionCode: 'NOVELTY', score: 0.25 },
                { criterionCode: 'APPLICABILITY', score: 0.5 },
                { criterionCode: 'PUBLICATION', score: 0.25 },
                { criterionCode: 'PRESENTATION_SKILL', score: 0.5 },
                { criterionCode: 'ATTITUDE', score: 0.5 },
                { criterionCode: 'PRESENTATION_CONTENT', score: 0.75 },
                { criterionCode: 'QA_RESPONSE', score: 0.75 },
            ];

            const res = await request(app)
                .put('/api/evaluations/501/score-sheet')
                .set('Authorization', 'Bearer evaluator-token')
                .send({
                    scores: validScores,
                    generalComment: 'Đồ án hoàn thành tốt, nắm vững lý thuyết và sản phẩm.',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.finalScore).toBe(9.25);
        });

        it('5.2 Khóa sổ điểm bảo vệ -> Trạng thái chuyển sang DEFENDED', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 501,
                status: 'SUBMITTED',
                memberScores: [{ id: 901 }],
            });
            prisma.topicRegistration.update.mockResolvedValue({
                id: 501,
                status: 'DEFENDED',
            });
            prisma.defenseMemberScore.updateMany.mockResolvedValue({ count: 1 });

            const res = await request(app)
                .patch('/api/evaluations/admin-defense-center/501/score-lock')
                .set('Authorization', 'Bearer admin-token')
                .send({ action: 'LOCK' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('DEFENDED');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // STAGE 6: LƯU CHIỂU TOÀN VĂN & CẤP GIẤY XÁC NHẬN HOÀN THÀNH
    // ─────────────────────────────────────────────────────────────
    describe('Giai đoạn 6: Nộp lưu chiểu toàn văn & Cấp Giấy Xác Nhận Hoàn Thành ĐATN', () => {
        it('6.1 Sinh viên nộp hồ sơ lưu chiểu toàn văn', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 501,
                studentId: 10,
                status: 'DEFENDED',
                topic: { mentorId: 20, title: 'Hệ thống Quản lý Đồ án' },
                student: { fullName: 'Nguyen Van A' },
            });
            prisma.projectArchive.upsert.mockResolvedValue({
                id: 11,
                registrationId: 501,
                reportFileUrl: 'https://storage/report.pdf',
                slideFileUrl: 'https://storage/slide.pptx',
                demoVideoUrl: 'https://youtube.com/watch?v=demo123',
                sourceCodeUrl: 'https://github.com/tdmu/dacn-final',
                status: 'SUBMITTED',
            });

            const res = await request(app)
                .post('/api/archives/registrations/501')
                .set('Authorization', 'Bearer student-token')
                .send({
                    reportFileUrl: 'https://storage/report.pdf',
                    slideFileUrl: 'https://storage/slide.pptx',
                    demoVideoUrl: 'https://youtube.com/watch?v=demo123',
                    sourceCodeUrl: 'https://github.com/tdmu/dacn-final',
                    summary: 'Hệ thống Quản lý Đồ án hoàn chỉnh.',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('SUBMITTED');
        });

        it('6.2 Quản trị viên/Khoa nghiệm thu hồ sơ lưu chiểu -> Trạng thái chính thức là COMPLETED', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 501,
                studentId: 10,
                topic: { mentorId: 20, title: 'Hệ thống Quản lý Đồ án' },
                archive: {
                    id: 11,
                    registrationId: 501,
                    status: 'SUBMITTED',
                },
            });
            prisma.projectArchive.update.mockResolvedValue({
                id: 11,
                registrationId: 501,
                status: 'APPROVED',
            });
            prisma.topicRegistration.update.mockResolvedValue({
                id: 501,
                status: 'COMPLETED',
            });

            const res = await request(app)
                .post('/api/archives/registrations/501/review')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    decision: 'APPROVED',
                    reviewerNotes: 'Hồ sơ đầy đủ, nghiệm thu hoàn tất.',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('APPROVED');
        });

        it('6.3 Cấp Giấy Xác Nhận Hoàn Thành Đồ Án Tốt Nghiệp với mã định danh duy nhất', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 501,
                status: 'COMPLETED',
                updatedAt: new Date('2026-09-21'),
                student: {
                    fullName: 'Nguyen Van A',
                    code: 'SV010',
                    department: 'Viện Công nghệ Số',
                    class: 'D20CNTT01',
                },
                topic: {
                    title: 'Hệ thống Quản lý Đồ án',
                    mentor: { fullName: 'TS. Tran Huong Dan', academicTitle: 'TIEN_SI' },
                    semester: { name: 'Đồ án tốt nghiệp - HK1 2026-2027' },
                },
                defenseResult: { finalScore: 9.0 },
                archive: {
                    status: 'APPROVED',
                    reviewedAt: new Date('2026-09-21'),
                },
            });

            const res = await request(app)
                .get('/api/archives/registrations/501/clearance-certificate')
                .set('Authorization', 'Bearer student-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.certificateNumber).toContain('TDMU-DA-CERT-');
            expect(res.body.data.student.fullName).toBe('Nguyen Van A');
            expect(res.body.data.evaluation.finalScore).toBe(9.0);
        });
    });
});
