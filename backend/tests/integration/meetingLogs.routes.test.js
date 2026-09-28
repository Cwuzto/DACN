jest.mock('../../src/config/database', () => ({
    $transaction: jest.fn(),
    user: {
        findUnique: jest.fn(),
    },
    topicRegistration: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    task: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    meetingLog: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    notification: {
        create: jest.fn(),
    },
}));

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Integration - Meeting Logs, Bypass & BM04 Review', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'lecturer-token') return { userId: 2, role: 'LECTURER' };
            if (token === 'other-lecturer-token') return { userId: 99, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 10) return { id: 10, role: 'STUDENT', isActive: true, fullName: 'Sinh Vien A' };
            if (where.id === 2) return { id: 2, role: 'LECTURER', isActive: true, fullName: 'GVHD B' };
            if (where.id === 99) return { id: 99, role: 'LECTURER', isActive: true, fullName: 'GV C' };
            if (where.id === 1) return { id: 1, role: 'ADMIN', isActive: true, fullName: 'Admin' };
            return null;
        });
    });

    describe('Meeting Logs Endpoints', () => {
        it('allows GVHD to create meeting log for their student', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 100,
                studentId: 10,
                status: 'IN_PROGRESS',
                topic: { mentorId: 2, title: 'Đồ án tốt nghiệp AI' },
            });

            prisma.meetingLog.create.mockResolvedValue({
                id: 1,
                registrationId: 100,
                meetingType: 'LAB',
                studentWorkSummary: 'Hoàn thành kiến trúc CSDL',
                createdBy: 2,
            });

            const res = await request(app)
                .post('/api/registrations/100/meeting-logs')
                .set('Authorization', 'Bearer lecturer-token')
                .send({
                    meetingType: 'LAB',
                    studentWorkSummary: 'Hoàn thành kiến trúc CSDL',
                    nextPlan: 'Lập trình API',
                    supervisorNotes: 'Làm tốt',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(prisma.meetingLog.create).toHaveBeenCalled();
        });

        it('forbids student from creating meeting log', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 100,
                studentId: 10,
                status: 'IN_PROGRESS',
                topic: { mentorId: 2, title: 'Đồ án tốt nghiệp AI' },
            });

            const res = await request(app)
                .post('/api/registrations/100/meeting-logs')
                .set('Authorization', 'Bearer student-token')
                .send({
                    studentWorkSummary: 'Em tự tạo',
                });

            expect(res.status).toBe(403);
        });

        it('allows student to read meeting logs of their own registration', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 100,
                studentId: 10,
                status: 'IN_PROGRESS',
                topic: { mentorId: 2, title: 'Đồ án tốt nghiệp AI' },
            });

            prisma.meetingLog.findMany.mockResolvedValue([
                { id: 1, meetingType: 'LAB', studentWorkSummary: 'Buổi 1' },
            ]);

            const res = await request(app)
                .get('/api/registrations/100/meeting-logs')
                .set('Authorization', 'Bearer student-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
        });
    });

    describe('Task Bypass Endpoint', () => {
        it('allows GVHD to bypass BM01 task', async () => {
            prisma.task.findUnique.mockResolvedValue({
                id: 50,
                registrationId: 100,
                taskType: 'BM01',
                title: 'BM01 - Đề cương chi tiết đồ án',
                status: 'OPEN',
                registration: {
                    status: 'APPROVED',
                    studentId: 10,
                    topic: { mentorId: 2, title: 'Đề tài mẫu' },
                },
            });

            prisma.task.update.mockResolvedValue({
                id: 50,
                status: 'COMPLETED',
                isBypassed: true,
                bypassReason: 'Đề tài phân bổ sẵn',
            });

            const res = await request(app)
                .post('/api/tasks/50/bypass')
                .set('Authorization', 'Bearer lecturer-token')
                .send({ reason: 'Đề tài phân bổ sẵn' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(prisma.task.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 50 },
                    data: expect.objectContaining({ isBypassed: true, status: 'COMPLETED' }),
                }),
            );
        });

        it('rejects bypass on non-soft-gate tasks', async () => {
            prisma.task.findUnique.mockResolvedValue({
                id: 52,
                registrationId: 100,
                taskType: 'BM03_CHECKPOINT_1',
                title: 'Tiến độ đợt 1',
                registration: {
                    status: 'IN_PROGRESS',
                    studentId: 10,
                    topic: { mentorId: 2 },
                },
            });

            const res = await request(app)
                .post('/api/tasks/52/bypass')
                .set('Authorization', 'Bearer lecturer-token')
                .send({ reason: 'Muốn bỏ qua checkpoint' });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Chỉ cho phép miễn thẩm định');
        });
    });

    describe('BM04 Gatekeeping Review Endpoint', () => {
        it('transitions status to SUBMITTED when GVHD marks AGREED', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 100,
                studentId: 10,
                status: 'IN_PROGRESS',
                topic: { mentorId: 2, title: 'Đồ án chuẩn' },
                meetingLogs: [
                    { id: 1, meetingType: 'LAB' },
                    { id: 2, meetingType: 'ONLINE' },
                ],
                tasks: [],
            });

            prisma.topicRegistration.update.mockResolvedValue({
                id: 100,
                status: 'SUBMITTED',
            });

            const res = await request(app)
                .post('/api/registrations/100/bm04-review')
                .set('Authorization', 'Bearer lecturer-token')
                .send({
                    decision: 'AGREED',
                    feedback: 'Sinh viên làm việc tích cực, kết quả tốt.',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(prisma.topicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 100 },
                    data: expect.objectContaining({ status: 'SUBMITTED' }),
                }),
            );
        });

        it('transitions status to DROPPED when GVHD marks DISAGREED', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 100,
                studentId: 10,
                status: 'IN_PROGRESS',
                topic: { mentorId: 2, title: 'Đồ án không đạt' },
                meetingLogs: [],
                tasks: [],
            });

            prisma.topicRegistration.update.mockResolvedValue({
                id: 100,
                status: 'DROPPED',
            });

            const res = await request(app)
                .post('/api/registrations/100/bm04-review')
                .set('Authorization', 'Bearer lecturer-token')
                .send({
                    decision: 'DISAGREED',
                    feedback: 'Khối lượng chưa đạt 50%, không đủ điều kiện bảo vệ.',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(prisma.topicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 100 },
                    data: expect.objectContaining({ status: 'DROPPED' }),
                }),
            );
        });
    });
});
