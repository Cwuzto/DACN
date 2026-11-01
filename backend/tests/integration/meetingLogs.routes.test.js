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
            if (where.id === 2) return { id: 2, role: 'LECTURER', isActive: true, fullName: 'GVHD B', permissionGroups: [{ permissionGroup: { code: 'GVHD', permissions: ['BM03_SUBMIT', 'BM03_REVIEW'].map((code) => ({ permission: { code } })) } }] };
            if (where.id === 99) return { id: 99, role: 'LECTURER', isActive: true, fullName: 'GV C', permissionGroups: [{ permissionGroup: { code: 'GVHD', permissions: ['BM03_SUBMIT', 'BM03_REVIEW'].map((code) => ({ permission: { code } })) } }] };
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

    describe('Academic workflow containment', () => {
        it('removes the task bypass endpoint', async () => {
            const res = await request(app)
                .post('/api/tasks/50/bypass')
                .set('Authorization', 'Bearer lecturer-token')
                .send({ reason: 'Không được phép bỏ qua BM01' });

            expect(res.status).toBe(404);
            expect(prisma.task.update).not.toHaveBeenCalled();
        });

        it('removes registration bypass endpoints', async () => {
            const single = await request(app)
                .post('/api/registrations/100/bypass-outline')
                .set('Authorization', 'Bearer admin-token')
                .send({ reason: 'Không được phép bỏ qua' });
            const batch = await request(app)
                .post('/api/registrations/batch-bypass-outline')
                .set('Authorization', 'Bearer admin-token')
                .send({ registrationIds: [100], reason: 'Không được phép bỏ qua' });

            expect(single.status).toBe(404);
            expect(batch.status).toBe(404);
            expect(prisma.topicRegistration.update).not.toHaveBeenCalled();
        });

        it('removes the legacy BM04 endpoint', async () => {
            const res = await request(app)
                .post('/api/registrations/100/bm04-review')
                .set('Authorization', 'Bearer lecturer-token')
                .send({ decision: 'AGREED', score: 9 });

            expect(res.status).toBe(404);
            expect(prisma.topicRegistration.update).not.toHaveBeenCalled();
        });

        it('rejects direct status updates for academic tasks', async () => {
            prisma.task.findUnique.mockResolvedValue({
                id: 50,
                taskType: 'BM01',
                registration: {
                    studentId: 10,
                    topic: { mentorId: 2 },
                },
            });

            const res = await request(app)
                .patch('/api/tasks/50/status')
                .set('Authorization', 'Bearer lecturer-token')
                .send({ status: 'COMPLETED' });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('ACADEMIC_TASK_STATUS_IMMUTABLE');
            expect(prisma.task.update).not.toHaveBeenCalled();
        });
    });
});
