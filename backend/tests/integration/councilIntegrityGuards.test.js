const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockPrisma)),
    user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    semester: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    council: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    councilMember: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
    },
    topicRegistration: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
    },
    defenseResult: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    defenseMemberScore: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    bM01Evaluation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    auditLog: {
        findMany: jest.fn(),
        create: jest.fn(),
    },
    periodWorkflowPolicyVersion: {
        findMany: jest.fn(),
    },
    academicDelegation: {
        findMany: jest.fn(),
    },
};

jest.mock('../../src/config/database', () => mockPrisma);

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn(),
}));

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../src/config/database');
const app = require('../../src/app');

describe('Council Integrity Guards (Completed Semester & Student Removal Lock)', () => {
    const adminUser = {
        id: 1,
        code: 'AD0001',
        fullName: 'Admin Quản Trị',
        role: 'ADMIN',
        isActive: true,
        permissions: [
            'DEFENSE_COUNCIL_MANAGE',
            'OUTLINE_COUNCIL_MANAGE',
            'VIEW_PROJECT_PERIODS',
        ],
        permissionGroups: [
            {
                permissionGroup: {
                    permissions: [
                        { permission: { code: 'DEFENSE_COUNCIL_MANAGE' } },
                        { permission: { code: 'OUTLINE_COUNCIL_MANAGE' } },
                        { permission: { code: 'VIEW_PROJECT_PERIODS' } },
                    ],
                },
            },
        ],
    };

    const token = 'valid-admin-token';

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((t) => {
            if (t === token) return { userId: 1, role: 'ADMIN' };
            throw new Error('Invalid token');
        });

        prisma.user.findUnique.mockResolvedValue(adminUser);
        prisma.user.findFirst.mockResolvedValue(adminUser);
        prisma.semester.findFirst.mockResolvedValue({ id: 1, status: 'ONGOING' });
        prisma.periodWorkflowPolicyVersion.findMany.mockResolvedValue([{ id: 1, version: 1, isActive: true }]);
        prisma.academicDelegation.findMany.mockResolvedValue([]);
    });

    describe('1. removeRegistrationFromCouncil guards', () => {
        test('blocks removing student when council belongs to a COMPLETED semester', async () => {
            prisma.council.findUnique.mockResolvedValue({
                id: 10,
                name: 'HĐ Bảo vệ Khóa 2025',
                councilType: 'DEFENSE_COUNCIL',
                semesterId: 1,
                semester: { status: 'COMPLETED' },
            });

            const res = await request(app)
                .post('/api/councils/10/remove-registration')
                .set('Authorization', `Bearer ${token}`)
                .send({ registrationId: 101 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('SEMESTER_ALREADY_COMPLETED');
            expect(res.body.message).toContain('Đợt đồ án này đã hoàn thành');
            expect(prisma.topicRegistration.updateMany).not.toHaveBeenCalled();
        });

        test('blocks removing student from DEFENSE_COUNCIL if defense result or scores exist', async () => {
            prisma.council.findUnique.mockResolvedValue({
                id: 20,
                name: 'HĐ Bảo vệ Đang diễn ra',
                councilType: 'DEFENSE_COUNCIL',
                semesterId: 2,
                semester: { status: 'DEFENSE' },
                schedulePublishedAt: null,
                scheduleConfirmedAt: null,
            });

            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 201,
                status: 'DEFENSE_PASSED',
                student: { fullName: 'Nguyễn Văn A', code: '2200001' },
                topic: { title: 'Đề tài 1' },
                defenseResult: { id: 50, finalGrade: 8.5 },
                defenseMemberScores: [{ id: 1, score: 8.5 }],
            });

            const res = await request(app)
                .post('/api/councils/20/remove-registration')
                .set('Authorization', `Bearer ${token}`)
                .send({ registrationId: 201 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('CANNOT_REMOVE_GRADED_STUDENT');
            expect(res.body.message).toContain('đã có điểm hoặc đã hoàn thành bảo vệ');
            expect(prisma.topicRegistration.updateMany).not.toHaveBeenCalled();
        });

        test('blocks removing student from DEFENSE_COUNCIL if schedule is already published', async () => {
            prisma.council.findUnique.mockResolvedValue({
                id: 21,
                name: 'HĐ Đã công bố lịch',
                councilType: 'DEFENSE_COUNCIL',
                semesterId: 2,
                semester: { status: 'DEFENSE' },
                schedulePublishedAt: new Date(),
                scheduleConfirmedAt: new Date(),
            });

            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 202,
                status: 'DEFENSE_READY',
                student: { fullName: 'Trần Văn B', code: '2200002' },
                topic: { title: 'Đề tài 2' },
                defenseResult: null,
                defenseMemberScores: [],
            });

            const res = await request(app)
                .post('/api/councils/21/remove-registration')
                .set('Authorization', `Bearer ${token}`)
                .send({ registrationId: 202 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('COUNCIL_SCHEDULE_ALREADY_PUBLISHED');
            expect(res.body.message).toContain('Lịch bảo vệ của hội đồng đã được công bố');
            expect(prisma.topicRegistration.updateMany).not.toHaveBeenCalled();
        });

        test('blocks removing student from OUTLINE_REVIEW council if BM01 evaluation exists', async () => {
            prisma.council.findUnique.mockResolvedValue({
                id: 30,
                name: 'HĐ Đề cương Số 1',
                councilType: 'OUTLINE_REVIEW',
                semesterId: 3,
                semester: { status: 'ONGOING' },
            });

            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 301,
                status: 'IN_PROGRESS',
                student: { fullName: 'Lê Thị C', code: '2200003' },
                topic: { title: 'Đề tài 3' },
                bM01Evaluations: [
                    { id: 99, outlineCouncilId: 30, status: 'PASSED' },
                ],
            });

            const res = await request(app)
                .post('/api/councils/30/remove-registration')
                .set('Authorization', `Bearer ${token}`)
                .send({ registrationId: 301 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('CANNOT_REMOVE_EVALUATED_STUDENT');
            expect(res.body.message).toContain('đã được Hội đồng đánh giá đề cương BM01');
            expect(prisma.topicRegistration.updateMany).not.toHaveBeenCalled();
        });

        test('allows removing student in active semester with no scores and no evaluations', async () => {
            prisma.council.findUnique.mockResolvedValue({
                id: 40,
                name: 'HĐ Bảo vệ Mới lập',
                councilType: 'DEFENSE_COUNCIL',
                semesterId: 2,
                semester: { status: 'ONGOING' },
                schedulePublishedAt: null,
                scheduleConfirmedAt: null,
            });

            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 401,
                status: 'DEFENSE_READY',
                student: { fullName: 'Phạm Văn D', code: '2200004' },
                topic: { title: 'Đề tài 4' },
                defenseResult: null,
                defenseMemberScores: [],
            });

            prisma.topicRegistration.updateMany.mockResolvedValue({ count: 1 });

            const res = await request(app)
                .post('/api/councils/40/remove-registration')
                .set('Authorization', `Bearer ${token}`)
                .send({ registrationId: 401 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('Đã gỡ sinh viên khỏi hội đồng');
            expect(prisma.topicRegistration.updateMany).toHaveBeenCalledWith({
                where: { id: 401, OR: [{ defenseCouncilId: 40 }, { councilId: 40 }] },
                data: { defenseCouncilId: null, councilId: null },
            });
        });
    });

    describe('2. deleteCouncil guards', () => {
        test('blocks deleting council when semester is COMPLETED', async () => {
            prisma.council.findUnique.mockResolvedValue({
                id: 50,
                name: 'HĐ Đã qua',
                semester: { status: 'COMPLETED' },
                _count: { registrations: 0, outlineRegistrations: 0, defenseRegistrations: 0 },
            });

            const res = await request(app)
                .delete('/api/councils/50')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('SEMESTER_ALREADY_COMPLETED');
            expect(prisma.council.delete).not.toHaveBeenCalled();
        });

        test('blocks deleting council when historical defense evaluations exist', async () => {
            prisma.council.findUnique.mockResolvedValue({
                id: 60,
                name: 'HĐ Đã chấm điểm',
                semester: { status: 'DEFENSE' },
                _count: { registrations: 0, outlineRegistrations: 0, defenseRegistrations: 0, resultBatches: 0 },
            });

            prisma.defenseResult.findFirst.mockResolvedValue({ id: 99, councilId: 60 });
            prisma.bM01Evaluation.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .delete('/api/councils/60')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('COUNCIL_HAS_EVALUATIONS');
            expect(res.body.message).toContain('lịch sử chấm điểm hoặc đánh giá đề tài');
            expect(prisma.council.delete).not.toHaveBeenCalled();
        });

        test('allows deleting empty council in active semester without history', async () => {
            prisma.council.findUnique.mockResolvedValue({
                id: 70,
                name: 'HĐ Trống vừa tạo nhầm',
                semester: { status: 'ONGOING' },
                _count: { registrations: 0, outlineRegistrations: 0, defenseRegistrations: 0, resultBatches: 0 },
            });

            prisma.defenseResult.findFirst.mockResolvedValue(null);
            prisma.bM01Evaluation.findFirst.mockResolvedValue(null);
            prisma.councilMember.deleteMany.mockResolvedValue({ count: 3 });
            prisma.council.delete.mockResolvedValue({ id: 70 });

            const res = await request(app)
                .delete('/api/councils/70')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('Đã xóa hội đồng');
        });
    });
});
