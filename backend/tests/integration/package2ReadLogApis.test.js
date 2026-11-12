const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    topicRegistration: { findUnique: jest.fn(), findMany: jest.fn() },
    registrationStateHistory: { findMany: jest.fn() },
    council: { findUnique: jest.fn(), findMany: jest.fn() },
    defenseScheduleAdjustmentLog: { findMany: jest.fn() },
    defenseScoreBookReturnLog: { findMany: jest.fn() },
};

mockDatabase.$transaction.mockImplementation(async (cb) => cb(mockDatabase));

jest.mock('../../src/config/database', () => mockDatabase);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const prisma = require('../../src/config/database');
const app = require('../../src/app');

describe('Package 2 Task 1: History, Schedule Adjustment & ScoreBook Return Log Read APIs', () => {
    const adminPerms = [
        {
            permissionGroup: {
                code: 'ADMIN_GROUP',
                permissions: [
                    { permission: { code: 'VIEW_TOPICS' } },
                    { permission: { code: 'TOPIC_APPROVE' } },
                    { permission: { code: 'PROJECT_OVERSIGHT_MANAGE' } },
                    { permission: { code: 'VIEW_COUNCIL_ASSIGNMENTS' } },
                    { permission: { code: 'VIEW_DEFENSE_ASSIGNMENTS' } },
                    { permission: { code: 'DEFENSE_COUNCIL_MANAGE' } },
                ],
            },
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'mentor-token') return { userId: 2, role: 'LECTURER' };
            if (token === 'other-lecturer-token') return { userId: 3, role: 'LECTURER' };
            if (token === 'council-lecturer-token') return { userId: 4, role: 'LECTURER' };
            if (token === 'student1-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'student2-token') return { userId: 20, role: 'STUDENT' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 1) {
                return {
                    id: 1,
                    fullName: 'Admin User',
                    role: 'ADMIN',
                    isActive: true,
                    permissionGroups: adminPerms,
                };
            }
            if (where.id === 2) {
                return {
                    id: 2,
                    fullName: 'Mentor Lecturer',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where.id === 3) {
                return {
                    id: 3,
                    fullName: 'Other Lecturer',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where.id === 4) {
                return {
                    id: 4,
                    fullName: 'Council Lecturer',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where.id === 10) {
                return {
                    id: 10,
                    fullName: 'Student One',
                    role: 'STUDENT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where.id === 20) {
                return {
                    id: 20,
                    fullName: 'Student Two',
                    role: 'STUDENT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            return null;
        });

        prisma.topicRegistration.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 101) {
                return {
                    id: 101,
                    studentId: 10,
                    topicId: 501,
                    topic: { id: 501, title: 'Đồ án AI', mentorId: 2 },
                    student: { id: 10, fullName: 'Student One', code: 'SV001' },
                };
            }
            return null;
        });

        prisma.registrationStateHistory.findMany.mockResolvedValue([
            {
                id: 1,
                registrationId: 101,
                fromStatus: 'REGISTERED',
                toStatus: 'APPROVED',
                fromStateVersion: 1,
                toStateVersion: 2,
                reason: 'Đạt yêu cầu',
                actorId: 2,
                createdAt: new Date('2026-11-01T08:00:00Z'),
                actor: { id: 2, fullName: 'Mentor Lecturer', email: 'mentor@test.com', role: 'LECTURER' },
            },
        ]);

        prisma.council.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 88) {
                return {
                    id: 88,
                    name: 'Hội đồng Bảo vệ 01',
                    councilType: 'DEFENSE_COUNCIL',
                    members: [{ lecturerId: 4, roleInCouncil: 'CHAIRMAN' }],
                };
            }
            return null;
        });

        prisma.defenseScheduleAdjustmentLog.findMany.mockResolvedValue([
            {
                id: 1,
                councilId: 88,
                registrationId: 101,
                oldShift: 'MORNING',
                newShift: 'AFTERNOON',
                oldOrderInShift: 1,
                newOrderInShift: 3,
                reason: 'Trùng lịch thi chuyên đề',
                adjustedById: 1,
                createdAt: new Date('2026-11-10T10:00:00Z'),
                adjustedBy: { id: 1, fullName: 'Admin User', role: 'ADMIN' },
                registration: {
                    id: 101,
                    student: { id: 10, fullName: 'Student One', code: 'SV001' },
                    topic: { title: 'Đồ án AI' },
                },
            },
        ]);

        prisma.defenseScoreBookReturnLog.findMany.mockResolvedValue([
            {
                id: 1,
                councilId: 88,
                registrationId: 101,
                fromLedgerVersion: 1,
                toLedgerVersion: 2,
                reason: 'Hoàn trả để hội đồng chấm lại tiêu chí 3',
                returnedByAdminId: 1,
                returnedAt: new Date('2026-11-11T14:00:00Z'),
                returnedByAdmin: { id: 1, fullName: 'Admin User', email: 'admin@test.com' },
                registration: {
                    id: 101,
                    student: { fullName: 'Student One', code: 'SV001' },
                    topic: { title: 'Đồ án AI' },
                },
            },
        ]);
    });

    describe('1. GET /api/topics/registrations/:id/history and /api/registrations/:id/history', () => {
        test('Student can view their own registration history (200 OK)', async () => {
            const res = await request(app)
                .get('/api/topics/registrations/101/history')
                .set('Authorization', 'Bearer student1-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].actor.fullName).toBe('Mentor Lecturer');

            // Also test via /api/registrations/:id/history
            const res2 = await request(app)
                .get('/api/registrations/101/history')
                .set('Authorization', 'Bearer student1-token');

            expect(res2.status).toBe(200);
            expect(res2.body.success).toBe(true);
        });

        test('Student cannot view another student registration history (403 Forbidden)', async () => {
            const res = await request(app)
                .get('/api/topics/registrations/101/history')
                .set('Authorization', 'Bearer student2-token');

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });

        test('Mentor can view registration history of their mentored student (200 OK)', async () => {
            const res = await request(app)
                .get('/api/topics/registrations/101/history')
                .set('Authorization', 'Bearer mentor-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data[0].toStatus).toBe('APPROVED');
        });

        test('Other lecturer who is not mentor cannot view registration history (403 Forbidden)', async () => {
            const res = await request(app)
                .get('/api/topics/registrations/101/history')
                .set('Authorization', 'Bearer other-lecturer-token');

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });

        test('Admin can view registration history (200 OK)', async () => {
            const res = await request(app)
                .get('/api/topics/registrations/101/history')
                .set('Authorization', 'Bearer admin-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('2. GET /api/councils/:id/schedule-adjustments', () => {
        test('Council member can view schedule adjustments of their council (200 OK)', async () => {
            const res = await request(app)
                .get('/api/councils/88/schedule-adjustments')
                .set('Authorization', 'Bearer council-lecturer-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].adjustedBy.fullName).toBe('Admin User');
            expect(res.body.data[0].registration.student.fullName).toBe('Student One');
            expect(res.body.data[0].registration.student.studentCode).toBe('SV001');
        });

        test('Admin can view schedule adjustments (200 OK)', async () => {
            const res = await request(app)
                .get('/api/councils/88/schedule-adjustments')
                .set('Authorization', 'Bearer admin-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('Lecturer who is not a council member is rejected (403 Forbidden)', async () => {
            const res = await request(app)
                .get('/api/councils/88/schedule-adjustments')
                .set('Authorization', 'Bearer other-lecturer-token');

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });
    });

    describe('3. GET /api/evaluations/councils/:id/return-logs', () => {
        test('Council member can view scorebook return logs of their council (200 OK)', async () => {
            const res = await request(app)
                .get('/api/evaluations/councils/88/return-logs')
                .set('Authorization', 'Bearer council-lecturer-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].returnedByAdmin.fullName).toBe('Admin User');
            expect(res.body.data[0].reason).toContain('tiêu chí 3');
            expect(res.body.data[0].registration.student.fullName).toBe('Student One');
            expect(res.body.data[0].registration.student.studentCode).toBe('SV001');
        });

        test('Admin can view scorebook return logs (200 OK)', async () => {
            const res = await request(app)
                .get('/api/evaluations/councils/88/return-logs')
                .set('Authorization', 'Bearer admin-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('Lecturer who is not a council member is rejected (403 Forbidden)', async () => {
            const res = await request(app)
                .get('/api/evaluations/councils/88/return-logs')
                .set('Authorization', 'Bearer other-lecturer-token');

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });
    });
});
