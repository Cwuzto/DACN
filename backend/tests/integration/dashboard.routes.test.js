jest.mock('../../src/config/database', () => ({
    user: {
        findUnique: jest.fn(),
    },
    semester: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
    },
    topic: {
        count: jest.fn(),
        findFirst: jest.fn(),
    },
    topicRegistration: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
    },
    submission: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn(),
    },
    task: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn(),
    },
    topicTitleAdjustment: {
        findMany: jest.fn().mockResolvedValue([]),
    },
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Integration - dashboard routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'integration-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'lecturer-token') return { userId: 77, role: 'LECTURER' };
            if (token === 'student-token') return { userId: 5, role: 'STUDENT' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === 77) {
                return {
                    id: 77,
                    email: 'lecturer@example.com',
                    fullName: 'Giang Vien',
                    code: 'GV077',
                    role: 'LECTURER',
                    department: 'CNTT',
                    isActive: true,
                };
            }
            if (where?.id === 5) {
                return {
                    id: 5,
                    email: 'student@example.com',
                    fullName: 'Sinh Vien',
                    code: 'SV005',
                    role: 'STUDENT',
                    department: 'CNTT',
                    isActive: true,
                };
            }
            return null;
        });
    });

    test('GET /api/dashboard/lecturer returns empty data when no active semester', async () => {
        prisma.semester.findFirst.mockResolvedValue(null);

        const res = await request(app)
            .get('/api/dashboard/lecturer')
            .set('Authorization', 'Bearer lecturer-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.activeSemester).toBeNull();
        expect(res.body.data.stats.activeTopics).toBe(0);
        expect(prisma.topic.count).not.toHaveBeenCalled();
    });

    test('GET /api/dashboard/student returns hasRegistration=false when no active semester', async () => {
        prisma.semester.findFirst.mockResolvedValue(null);

        const res = await request(app)
            .get('/api/dashboard/student')
            .set('Authorization', 'Bearer student-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.activeSemester).toBeNull();
        expect(res.body.data.hasRegistration).toBe(false);
        expect(prisma.topicRegistration.findFirst).not.toHaveBeenCalled();
    });

    test('GET /api/dashboard/lecturer filters data by active semester', async () => {
        prisma.semester.findFirst.mockResolvedValue({
            id: 9,
            name: 'HK Active',
            startDate: new Date('2026-01-01T00:00:00.000Z'),
            registrationDeadline: new Date('2026-01-20T00:00:00.000Z'),
            endDate: new Date('2026-06-01T00:00:00.000Z'),
        });
        prisma.topic.count.mockResolvedValue(3);
        prisma.topicRegistration.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
        prisma.submission.findMany.mockResolvedValue([]);
        prisma.task.findMany.mockResolvedValue([]);

        const res = await request(app)
            .get('/api/dashboard/lecturer')
            .set('Authorization', 'Bearer lecturer-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.activeSemester.id).toBe(9);
        expect(prisma.topic.count).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ semesterId: 9 }),
            })
        );
        expect(res.body.data.mentorSummary).toBeDefined();
        expect(res.body.data.mentorSummary.maxStudents).toBe(10);
        expect(Array.isArray(res.body.data.attentionItems)).toBe(true);
        expect(Array.isArray(res.body.data.students)).toBe(true);
        expect(res.body.data.generatedAt).toBeDefined();
    });

    test('GET /api/dashboard/lecturer returns 400 when semesterId query is invalid', async () => {
        const res = await request(app)
            .get('/api/dashboard/lecturer?semesterId=invalid')
            .set('Authorization', 'Bearer lecturer-token');

        expect(res.status).toBe(400);
    });

    test('GVHD without REPORT_VIEW still accesses /api/dashboard/lecturer via mentor permissions but gets 403 on aggregate dashboard endpoints', async () => {
        prisma.semester.findFirst.mockResolvedValue(null);

        const lecturerRes = await request(app)
            .get('/api/dashboard/lecturer')
            .set('Authorization', 'Bearer lecturer-token');
        expect(lecturerRes.status).toBe(200);

        for (const endpoint of [
            '/api/dashboard/stats',
            '/api/dashboard/semester-overview',
            '/api/dashboard/scores',
            '/api/dashboard/activities',
        ]) {
            const res = await request(app)
                .get(endpoint)
                .set('Authorization', 'Bearer lecturer-token');
            expect(res.status).toBe(403);
        }
    });

    test('GET /api/dashboard/lecturer rejects actor who only has REPORT_VIEW without mentor permissions', async () => {
        jwt.verify.mockImplementation((token) => {
            if (token === 'report-only-token') return { userId: 88, role: 'ADMIN', permissionVersion: 1 };
            throw new Error('invalid token');
        });
        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === 88) {
                return {
                    id: 88,
                    email: 'reportonly@example.com',
                    fullName: 'Report Only',
                    code: 'AD088',
                    role: 'ADMIN',
                    department: 'CNTT',
                    isActive: true,
                    permissionVersion: 1,
                    permissionGroups: [{
                        permissionGroup: {
                            id: 3,
                            code: 'CUSTOM_REPORT',
                            permissions: [{ permission: { code: 'REPORT_VIEW' } }],
                        },
                    }],
                    councilMembers: [],
                };
            }
            return null;
        });

        const res = await request(app)
            .get('/api/dashboard/lecturer')
            .set('Authorization', 'Bearer report-only-token');

        expect(res.status).toBe(403);
    });
});
