const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    semester: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    projectCatalog: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
    },
    lecturerProjectAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
    },
    studentProjectEnrollment: {
        findFirst: jest.fn(),
    },
    periodWorkflowPolicyVersion: {
        findMany: jest.fn(),
    },
    topic: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
    },
    topicRegistration: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    notification: {
        create: jest.fn(),
    },
};

mockDatabase.$transaction.mockImplementation(async (callback) => {
    if (typeof callback === 'function') {
        return callback(mockDatabase);
    }
    return callback;
});

jest.mock('../../src/config/database', () => mockDatabase);

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/notificationService', () => ({
    safeNotify: jest.fn().mockResolvedValue(undefined),
    safeNotifyMany: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const prisma = require('../../src/config/database');
const app = require('../../src/app');

describe('Task 4: Concurrency-Safe Student Assignment & Hard-Gate Guards', () => {
    const sem1 = {
        id: 1,
        name: 'Đợt 1',
        startDate: new Date('2026-01-01T00:00:00+07:00'),
        endDate: new Date('2026-06-30T23:59:59+07:00'),
        registrationDeadline: new Date('2099-12-31T23:59:59+07:00'),
        registrationOpen: true,
    };

    const sem2 = {
        id: 2,
        name: 'Đợt 2',
        startDate: new Date('2026-05-15T00:00:00+07:00'),
        endDate: new Date('2026-08-31T23:59:59+07:00'),
        registrationDeadline: new Date('2099-12-31T23:59:59+07:00'),
        registrationOpen: true,
    };

    const defaultCatalog = {
        id: 10,
        code: 'DATN',
        name: 'Đồ án tốt nghiệp',
        isActive: true,
    };

    const activePolicy = {
        id: 42,
        version: 1,
        isActive: true,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'guard-test-secret';

        mockDatabase.$transaction.mockImplementation(async (callback) => {
            if (typeof callback === 'function') {
                return callback(mockDatabase);
            }
            return callback;
        });

        jwt.verify.mockImplementation((token) => {
            if (token === 'lecturer-token') return { userId: 10, role: 'LECTURER' };
            if (token === 'student-token-1') return { userId: 101, role: 'STUDENT' };
            if (token === 'student-token-2') return { userId: 102, role: 'STUDENT' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === 10) {
                return {
                    id: 10,
                    fullName: 'TS. Nguyễn Văn A',
                    code: 'GV010',
                    email: 'gv10@school.edu.vn',
                    role: 'LECTURER',
                    academicTitle: 'TIEN_SI',
                    department: 'CNTT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where?.id === 20) {
                return {
                    id: 20,
                    fullName: 'ThS. Trần Thị B',
                    code: 'GV020',
                    email: 'gv20@school.edu.vn',
                    role: 'LECTURER',
                    academicTitle: 'THAC_SI',
                    department: 'CNTT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where?.id === 101) {
                return {
                    id: 101,
                    fullName: 'Sinh Viên 1',
                    code: 'SV101',
                    email: 'sv101@student.edu.vn',
                    role: 'STUDENT',
                    department: 'CNTT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where?.id === 102) {
                return {
                    id: 102,
                    fullName: 'Sinh Viên 2',
                    code: 'SV102',
                    email: 'sv102@student.edu.vn',
                    role: 'STUDENT',
                    department: 'CNTT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where?.id === 1) {
                return {
                    id: 1,
                    fullName: 'Admin Khoa',
                    code: 'ADMIN01',
                    role: 'ADMIN',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            return null;
        });

        prisma.semester.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === 1) return sem1;
            if (where?.id === 2) return sem2;
            return null;
        });

        prisma.projectCatalog.findUnique.mockResolvedValue(defaultCatalog);
        prisma.projectCatalog.findFirst.mockResolvedValue(defaultCatalog);
        prisma.periodWorkflowPolicyVersion.findMany.mockResolvedValue([activePolicy]);
        prisma.studentProjectEnrollment.findFirst.mockResolvedValue({ id: 999 });
        prisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
    });

    describe('1. Topic Creation Hard-Gate Guard', () => {
        it('should return HTTP 403 when a lecturer proposes a topic without an ACTIVE LecturerProjectAssignment in semesterId', async () => {
            // Mentor has no ACTIVE assignment in semester 1
            prisma.lecturerProjectAssignment.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/topics')
                .set('Authorization', 'Bearer lecturer-token')
                .send({
                    title: 'Hệ thống Blockchain cho chuỗi cung ứng',
                    semesterId: 1,
                    projectCatalogId: 10,
                });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Bạn chưa được phân công nhiệm vụ hướng dẫn trong đợt đồ án này.');
            expect(prisma.topic.create).not.toHaveBeenCalled();
        });

        it('should create topic when lecturer has an ACTIVE assignment in target semesterId', async () => {
            prisma.lecturerProjectAssignment.findFirst.mockResolvedValue({
                id: 1,
                lecturerId: 10,
                semesterId: 1,
                projectCatalogId: 10,
                status: 'ACTIVE',
            });

            prisma.topic.create.mockResolvedValue({
                id: 501,
                title: 'Hệ thống Blockchain',
                semesterId: 1,
                mentorId: 10,
                proposedById: 10,
                status: 'APPROVED',
                maxStudents: 1,
                proposedBy: { id: 10, fullName: 'TS. Nguyễn Văn A', code: 'GV010' },
                mentor: { id: 10, fullName: 'TS. Nguyễn Văn A', code: 'GV010' },
                semester: { id: 1, name: 'Đợt 1' },
                projectCatalog: { id: 10, code: 'DATN', name: 'Đồ án tốt nghiệp' },
            });

            const res = await request(app)
                .post('/api/topics')
                .set('Authorization', 'Bearer lecturer-token')
                .send({
                    title: 'Hệ thống Blockchain',
                    semesterId: 1,
                    projectCatalogId: 10,
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });

        it('should return HTTP 400 when proposing topic with a mentor who does not have an ACTIVE assignment', async () => {
            // Student proposing topic with mentor 20 who lacks active assignment in semester 1
            prisma.lecturerProjectAssignment.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/topics')
                .set('Authorization', 'Bearer student-token-1')
                .send({
                    title: 'Đề xuất đề tài sinh viên',
                    mentorId: 20,
                    semesterId: 1,
                    projectCatalogId: 10,
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('chưa được phân công nhiệm vụ trong đợt đồ án này');
        });
    });

    describe('2. Dropdown Mentors Query Guard', () => {
        it('should filter mentors with ACTIVE assignment in specified semesterId', async () => {
            prisma.user.findMany.mockResolvedValue([
                {
                    id: 10,
                    fullName: 'TS. Nguyễn Văn A',
                    code: 'GV010',
                    academicTitle: 'TIEN_SI',
                    department: 'CNTT',
                },
            ]);

            const res = await request(app)
                .get('/api/topics/mentors?semesterId=1')
                .set('Authorization', 'Bearer student-token-1');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(prisma.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        role: 'LECTURER',
                        isActive: true,
                        lecturerProjectAssignments: {
                            some: expect.objectContaining({
                                semesterId: 1,
                                status: 'ACTIVE',
                            }),
                        },
                    }),
                })
            );
        });
    });

    describe('3. Registration Assignment & Workload Capacity Guards', () => {
        const validTopicSem1 = {
            id: 201,
            title: 'Đề tài Đợt 1',
            semesterId: 1,
            mentorId: 10,
            projectCatalogId: 10,
            status: 'APPROVED',
            maxStudents: 1,
            mentor: { id: 10, fullName: 'TS. Nguyễn Văn A', academicTitle: 'TIEN_SI' },
            projectCatalog: { id: 10, name: 'Đồ án tốt nghiệp' },
            _count: { registrations: 0 },
        };

        const validTopicSem2 = {
            id: 202,
            title: 'Đề tài Đợt 2',
            semesterId: 2,
            mentorId: 10,
            projectCatalogId: 10,
            status: 'APPROVED',
            maxStudents: 1,
            mentor: { id: 10, fullName: 'TS. Nguyễn Văn A', academicTitle: 'TIEN_SI' },
            projectCatalog: { id: 10, name: 'Đồ án tốt nghiệp' },
            _count: { registrations: 0 },
        };

        it('should reject registration with HTTP 400 when mentor does not have an ACTIVE assignment in semester', async () => {
            prisma.topic.findUnique.mockResolvedValue(validTopicSem1);
            prisma.topicRegistration.findUnique.mockResolvedValue(null);
            prisma.lecturerProjectAssignment.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/registrations')
                .set('Authorization', 'Bearer student-token-1')
                .send({ topicId: 201, semesterId: 1 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('chưa được phân công nhiệm vụ');
        });

        it('should reject registration with HTTP 400 when mentor already reached round plannedQuota', async () => {
            prisma.topic.findUnique.mockResolvedValue(validTopicSem1);
            prisma.topicRegistration.findUnique.mockResolvedValue(null);

            // Mentor has plannedQuota = 3 in semester 1
            prisma.lecturerProjectAssignment.findFirst.mockResolvedValue({
                id: 1,
                lecturerId: 10,
                semesterId: 1,
                projectCatalogId: 10,
                plannedQuota: 3,
                status: 'ACTIVE',
            });

            // Mentor already has 3 students in semester 1
            prisma.topicRegistration.count.mockResolvedValue(3);

            const res = await request(app)
                .post('/api/registrations')
                .set('Authorization', 'Bearer student-token-1')
                .send({ topicId: 201, semesterId: 1 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('MENTOR_CAPACITY_EXCEEDED');
            expect(res.body.message).toContain('3');
        });

        it('should reject 11th student across overlapping rounds with exact formatted diagnostic message', async () => {
            // Student registering for topic in sem2 (Đợt 2: 15/05–31/08)
            prisma.topic.findUnique.mockResolvedValue(validTopicSem2);
            prisma.topicRegistration.findUnique.mockResolvedValue(null);

            // In sem2, plannedQuota is 10, and mentor currently has only 4 students in sem2 (< 10)
            prisma.lecturerProjectAssignment.findFirst.mockResolvedValue({
                id: 2,
                lecturerId: 10,
                semesterId: 2,
                projectCatalogId: 10,
                plannedQuota: 10,
                status: 'ACTIVE',
            });
            prisma.topicRegistration.count.mockResolvedValue(4);

            // But across overlapping rounds:
            // 6 students in sem1 (01/01–30/06) + 4 students in sem2 (15/05–31/08) = 10 peak
            // Adding a 5th in sem2 pushes peak to 11 in [15/05, 30/06)
            const regsSem1 = Array.from({ length: 6 }, (_, i) => ({
                id: 100 + i,
                assignmentStatus: 'ACTIVE',
                effectiveAt: sem1.startDate,
                semester: sem1,
                topic: { mentorId: 10, semester: sem1 },
            }));

            const regsSem2 = Array.from({ length: 4 }, (_, i) => ({
                id: 200 + i,
                assignmentStatus: 'ACTIVE',
                effectiveAt: sem2.startDate,
                semester: sem2,
                topic: { mentorId: 10, semester: sem2 },
            }));

            prisma.topicRegistration.findMany.mockResolvedValue([...regsSem1, ...regsSem2]);

            const res = await request(app)
                .post('/api/registrations')
                .set('Authorization', 'Bearer student-token-1')
                .send({ topicId: 202, semesterId: 2 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe(
                'Việc phân công này sẽ làm tải của giảng viên tăng từ 10 lên 11 sinh viên trong khoảng 15/05–30/06 (Đợt 1, Đợt 2) nên không thể thực hiện.'
            );
        });

        it('should create registration with assignmentStatus ACTIVE and effectiveAt date when within quota', async () => {
            prisma.topic.findUnique.mockResolvedValue(validTopicSem1);
            prisma.topicRegistration.findUnique.mockResolvedValue(null);

            prisma.lecturerProjectAssignment.findFirst.mockResolvedValue({
                id: 1,
                lecturerId: 10,
                semesterId: 1,
                projectCatalogId: 10,
                plannedQuota: 10,
                status: 'ACTIVE',
            });
            prisma.topicRegistration.count.mockResolvedValue(3);
            prisma.topicRegistration.findMany.mockResolvedValue([]);

            prisma.topicRegistration.create.mockImplementation(async ({ data }) => ({
                id: 999,
                ...data,
                topic: {
                    title: validTopicSem1.title,
                    mentor: { fullName: validTopicSem1.mentor.fullName },
                    projectCatalog: validTopicSem1.projectCatalog,
                },
            }));

            const res = await request(app)
                .post('/api/registrations')
                .set('Authorization', 'Bearer student-token-1')
                .send({ topicId: 201, semesterId: 1 });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(prisma.topicRegistration.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        assignmentStatus: 'ACTIVE',
                        effectiveAt: expect.any(Date),
                    }),
                })
            );
        });
    });

    describe('4. Concurrency Locking with FOR UPDATE', () => {
        it('should execute FOR UPDATE lock on lecturer_project_assignments to serialize concurrent requests', async () => {
            const topic1 = {
                id: 301,
                title: 'Đề tài slot cuối 1',
                semesterId: 1,
                mentorId: 10,
                projectCatalogId: 10,
                status: 'APPROVED',
                maxStudents: 1,
                mentor: { id: 10, fullName: 'TS. Nguyễn Văn A', academicTitle: 'TIEN_SI' },
                projectCatalog: { id: 10, name: 'Đồ án tốt nghiệp' },
                _count: { registrations: 0 },
            };

            const topic2 = {
                id: 302,
                title: 'Đề tài slot cuối 2',
                semesterId: 1,
                mentorId: 10,
                projectCatalogId: 10,
                status: 'APPROVED',
                maxStudents: 1,
                mentor: { id: 10, fullName: 'TS. Nguyễn Văn A', academicTitle: 'TIEN_SI' },
                projectCatalog: { id: 10, name: 'Đồ án tốt nghiệp' },
                _count: { registrations: 0 },
            };

            prisma.topic.findUnique.mockImplementation(async ({ where }) => {
                if (where.id === 301) return topic1;
                if (where.id === 302) return topic2;
                return null;
            });

            prisma.topicRegistration.findUnique.mockResolvedValue(null);
            prisma.lecturerProjectAssignment.findFirst.mockResolvedValue({
                id: 1,
                lecturerId: 10,
                semesterId: 1,
                projectCatalogId: 10,
                plannedQuota: 10,
                status: 'ACTIVE',
            });

            // Simulate race: current count is 9, capacity is 10
            let currentCount = 9;
            prisma.topicRegistration.count.mockImplementation(async () => currentCount);
            prisma.topicRegistration.findMany.mockImplementation(async () => {
                return Array.from({ length: currentCount }, (_, i) => ({
                    id: 1000 + i,
                    assignmentStatus: 'ACTIVE',
                    effectiveAt: sem1.startDate,
                    semester: sem1,
                    topic: { mentorId: 10, semester: sem1 },
                }));
            });

            prisma.topicRegistration.create.mockImplementation(async ({ data }) => {
                currentCount += 1;
                return {
                    id: 2000 + currentCount,
                    ...data,
                    topic: {
                        title: 'Đề tài',
                        mentor: { fullName: 'TS. Nguyễn Văn A' },
                        projectCatalog: { id: 10, name: 'Đồ án' },
                    },
                };
            });

            const [res1, res2] = await Promise.all([
                request(app)
                    .post('/api/registrations')
                    .set('Authorization', 'Bearer student-token-1')
                    .send({ topicId: 301, semesterId: 1 }),
                request(app)
                    .post('/api/registrations')
                    .set('Authorization', 'Bearer student-token-2')
                    .send({ topicId: 302, semesterId: 1 }),
            ]);

            // Verify FOR UPDATE pessimistic locking was invoked
            expect(prisma.$queryRaw).toHaveBeenCalled();

            const statuses = [res1.status, res2.status].sort();
            expect(statuses).toEqual([201, 400]);

            const failedResponse = res1.status === 400 ? res1 : res2;
            const successResponse = res1.status === 201 ? res1 : res2;

            expect(successResponse.body.success).toBe(true);
            expect(failedResponse.body.success).toBe(false);
        });
    });
});
