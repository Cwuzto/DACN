const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    semester: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    topic: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    topicRegistration: { findUnique: jest.fn(), findMany: jest.fn() },
    registrationStateHistory: { findMany: jest.fn() },
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

describe('Package 2 Task 2: Topic Cloning API Integration Tests', () => {
    const adminPerms = [
        {
            permissionGroup: {
                code: 'ADMIN_GROUP',
                permissions: [
                    { permission: { code: 'VIEW_TOPICS' } },
                    { permission: { code: 'TOPIC_CREATE' } },
                    { permission: { code: 'TOPIC_APPROVE' } },
                ],
            },
        },
    ];

    const activeSemester = {
        id: 99,
        name: 'Học kỳ 1 2026-2027',
        code: 'HK1-2026-2027',
        status: 'ACTIVE',
    };

    const priorSemester = {
        id: 88,
        name: 'Học kỳ 2 2025-2026',
        code: 'HK2-2025-2026',
        status: 'COMPLETED',
    };

    const samplePriorTopics = [
        {
            id: 101,
            title: 'Hệ thống Quản lý Đồ án Tốt nghiệp',
            description: 'Mô tả đề tài 101',
            projectCatalogId: 1,
            semesterId: 88,
            mentorId: 2,
            proposedById: 2,
            maxStudents: 1,
            status: 'APPROVED',
            semester: { id: 88, name: 'Học kỳ 2 2025-2026', academicYear: '2025-2026' },
            projectCatalog: { id: 1, name: 'Đồ án Tốt nghiệp CNTT' },
        },
        {
            id: 102,
            title: 'Ứng dụng AI Hỗ trợ Phân loại Văn bản',
            description: 'Mô tả đề tài 102',
            projectCatalogId: 1,
            semesterId: 88,
            mentorId: 2,
            proposedById: 2,
            maxStudents: 1,
            status: 'APPROVED',
            semester: { id: 88, name: 'Học kỳ 2 2025-2026', academicYear: '2025-2026' },
            projectCatalog: { id: 1, name: 'Đồ án Tốt nghiệp CNTT' },
        },
        {
            id: 201,
            title: 'Hệ thống IoT Giám sát Nông nghiệp Thông minh',
            description: 'Mô tả đề tài 201 của GV khác',
            projectCatalogId: 2,
            semesterId: 88,
            mentorId: 3,
            proposedById: 3,
            maxStudents: 1,
            status: 'APPROVED',
            semester: { id: 88, name: 'Học kỳ 2 2025-2026', academicYear: '2025-2026' },
            projectCatalog: { id: 2, name: 'Đồ án Tốt nghiệp IoT' },
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'mentor-token') return { userId: 2, role: 'LECTURER' };
            if (token === 'other-lecturer-token') return { userId: 3, role: 'LECTURER' };
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
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
            if (where.id === 10) {
                return {
                    id: 10,
                    fullName: 'Student User',
                    role: 'STUDENT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            return null;
        });

        prisma.semester.findFirst.mockResolvedValue(activeSemester);
        prisma.topic.findMany.mockResolvedValue([samplePriorTopics[0], samplePriorTopics[1]]);
    });

    describe('1. GET /api/topics/cloneable', () => {
        test('Lecturer receives only their own topics from prior semesters', async () => {
            prisma.topic.findMany.mockResolvedValue([samplePriorTopics[0], samplePriorTopics[1]]);

            const res = await request(app)
                .get('/api/topics/cloneable')
                .set('Authorization', 'Bearer mentor-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(prisma.semester.findFirst).toHaveBeenCalledWith({
                where: { status: 'ACTIVE' },
            });
            expect(prisma.topic.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        semesterId: { not: 99 },
                        status: { in: ['APPROVED', 'COMPLETED', 'DEFENDED'] },
                        mentorId: 2,
                    }),
                    include: {
                        semester: { select: { id: true, name: true, academicYear: true } },
                        projectCatalog: { select: { id: true, name: true } },
                    },
                })
            );
        });

        test('Admin can query all cloneable topics or filter by mentorId', async () => {
            prisma.topic.findMany.mockResolvedValue(samplePriorTopics);

            const resAll = await request(app)
                .get('/api/topics/cloneable')
                .set('Authorization', 'Bearer admin-token');

            expect(resAll.status).toBe(200);
            expect(resAll.body.success).toBe(true);
            expect(prisma.topic.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        semesterId: { not: 99 },
                        status: { in: ['APPROVED', 'COMPLETED', 'DEFENDED'] },
                    }),
                })
            );

            const resFiltered = await request(app)
                .get('/api/topics/cloneable?mentorId=2')
                .set('Authorization', 'Bearer admin-token');

            expect(resFiltered.status).toBe(200);
            expect(prisma.topic.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        semesterId: { not: 99 },
                        status: { in: ['APPROVED', 'COMPLETED', 'DEFENDED'] },
                        mentorId: 2,
                    }),
                })
            );
        });

        test('Student is blocked with 403 Forbidden', async () => {
            const res = await request(app)
                .get('/api/topics/cloneable')
                .set('Authorization', 'Bearer student-token');

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('FORBIDDEN');
        });

        test('Unauthenticated user is rejected with 401 Unauthorized', async () => {
            const res = await request(app).get('/api/topics/cloneable');

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });

    describe('2. POST /api/topics/clone', () => {
        test('Lecturer successfully clones prior topics into active semester with DRAFT status', async () => {
            const sourceTopics = [samplePriorTopics[0], samplePriorTopics[1]];
            prisma.topic.findMany.mockResolvedValue(sourceTopics);

            prisma.topic.create
                .mockResolvedValueOnce({
                    id: 301,
                    title: sourceTopics[0].title,
                    description: sourceTopics[0].description,
                    projectCatalogId: sourceTopics[0].projectCatalogId,
                    semesterId: 99,
                    mentorId: 2,
                    proposedById: 2,
                    maxStudents: 1,
                    status: 'DRAFT',
                })
                .mockResolvedValueOnce({
                    id: 302,
                    title: sourceTopics[1].title,
                    description: sourceTopics[1].description,
                    projectCatalogId: sourceTopics[1].projectCatalogId,
                    semesterId: 99,
                    mentorId: 2,
                    proposedById: 2,
                    maxStudents: 1,
                    status: 'DRAFT',
                });

            const res = await request(app)
                .post('/api/topics/clone')
                .set('Authorization', 'Bearer mentor-token')
                .send({ topicIds: [101, 102] });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(2);
            expect(res.body.data).toHaveLength(2);

            expect(mockDatabase.$transaction).toHaveBeenCalled();
            expect(prisma.topic.create).toHaveBeenCalledWith({
                data: {
                    title: sourceTopics[0].title,
                    description: sourceTopics[0].description,
                    projectCatalogId: sourceTopics[0].projectCatalogId,
                    semesterId: 99,
                    mentorId: 2,
                    proposedById: 2,
                    maxStudents: 1,
                    status: 'DRAFT',
                },
            });
            expect(prisma.topic.create).toHaveBeenCalledWith({
                data: {
                    title: sourceTopics[1].title,
                    description: sourceTopics[1].description,
                    projectCatalogId: sourceTopics[1].projectCatalogId,
                    semesterId: 99,
                    mentorId: 2,
                    proposedById: 2,
                    maxStudents: 1,
                    status: 'DRAFT',
                },
            });
        });

        test('Lecturer cannot clone topics belonging to another lecturer (403 Forbidden)', async () => {
            prisma.topic.findMany.mockResolvedValue([samplePriorTopics[2]]); // mentorId = 3

            const res = await request(app)
                .post('/api/topics/clone')
                .set('Authorization', 'Bearer mentor-token') // userId = 2
                .send({ topicIds: [201] });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('FORBIDDEN');
            expect(prisma.topic.create).not.toHaveBeenCalled();
        });

        test('Admin can clone topics of any lecturer', async () => {
            prisma.topic.findMany.mockResolvedValue([samplePriorTopics[2]]); // mentorId = 3
            prisma.topic.create.mockResolvedValueOnce({
                id: 303,
                title: samplePriorTopics[2].title,
                description: samplePriorTopics[2].description,
                projectCatalogId: samplePriorTopics[2].projectCatalogId,
                semesterId: 99,
                mentorId: 3,
                proposedById: 1,
                maxStudents: 1,
                status: 'DRAFT',
            });

            const res = await request(app)
                .post('/api/topics/clone')
                .set('Authorization', 'Bearer admin-token')
                .send({ topicIds: [201] });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(1);
        });

        test('Student cannot clone topics (403 Forbidden)', async () => {
            const res = await request(app)
                .post('/api/topics/clone')
                .set('Authorization', 'Bearer student-token')
                .send({ topicIds: [101] });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('FORBIDDEN');
        });

        test('Rejects when active semester does not exist (400 Bad Request)', async () => {
            prisma.semester.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/topics/clone')
                .set('Authorization', 'Bearer mentor-token')
                .send({ topicIds: [101] });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/học kỳ/i);
        });

        test('Rejects invalid payload: empty topicIds array or non-integer values (400 Bad Request)', async () => {
            const resEmpty = await request(app)
                .post('/api/topics/clone')
                .set('Authorization', 'Bearer mentor-token')
                .send({ topicIds: [] });

            expect(resEmpty.status).toBe(400);
            expect(resEmpty.body.success).toBe(false);

            const resInvalid = await request(app)
                .post('/api/topics/clone')
                .set('Authorization', 'Bearer mentor-token')
                .send({ topicIds: ['not-an-id'] });

            expect(resInvalid.status).toBe(400);
            expect(resInvalid.body.success).toBe(false);

            const resMissing = await request(app)
                .post('/api/topics/clone')
                .set('Authorization', 'Bearer mentor-token')
                .send({});

            expect(resMissing.status).toBe(400);
            expect(resMissing.body.success).toBe(false);
        });

        test('Returns 404 if no matching topics found for given topicIds', async () => {
            prisma.topic.findMany.mockResolvedValue([]);

            const res = await request(app)
                .post('/api/topics/clone')
                .set('Authorization', 'Bearer mentor-token')
                .send({ topicIds: [9999] });

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });

        test('Unauthenticated user is rejected with 401 Unauthorized', async () => {
            const res = await request(app)
                .post('/api/topics/clone')
                .send({ topicIds: [101] });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
