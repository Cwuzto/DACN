const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
    semester: { findUnique: jest.fn(), findFirst: jest.fn() },
    topicRegistration: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    topic: { findUnique: jest.fn() },
    studentProjectEnrollment: { findFirst: jest.fn() },
    periodWorkflowPolicyVersion: { findMany: jest.fn() },
    bM02Submission: { findUnique: jest.fn() },
    assignmentDecision: { findUnique: jest.fn(), create: jest.fn() },
    task: { findFirst: jest.fn(), create: jest.fn() },
    idempotencyRecord: { findUnique: jest.fn(), create: jest.fn() },
    notification: { create: jest.fn() },
};

mockDatabase.$transaction.mockImplementation(async (cb, options) => {
    if (typeof cb === 'function') {
        return cb(mockDatabase);
    }
    return cb;
});

jest.mock('../../src/config/database', () => mockDatabase);

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/notificationService', () => ({
    safeNotify: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const prisma = require('../../src/config/database');
const app = require('../../src/app');
const {
    DEFAULT_MAX_STUDENTS_PER_MENTOR,
    ACTIVE_MENTOR_OCCUPANCY_STATUSES,
    ACTIVE_REGISTRATION_STATUSES,
    getMentorMaxSlots,
    countActiveOccupiedMentoredTopics,
    assertMentorCapacity,
} = require('../../src/constants/mentorCapacity');

describe('Registration Policy Fail-Closed, Quota Concurrency & Decision Guards', () => {
    const validSemester = {
        id: 1,
        name: 'HK1-2026',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        registrationDeadline: new Date('2099-12-31T23:59:59.000Z'),
        registrationOpen: true,
    };

    const validTopic1 = {
        id: 101,
        title: 'Hệ thống AI IoT 1',
        semesterId: 1,
        mentorId: 50,
        projectCatalogId: 10,
        status: 'APPROVED',
        maxStudents: 1,
        mentor: { id: 50, fullName: 'GVHD Test', academicTitle: 'TIEN_SI' },
        projectCatalog: { id: 10, name: 'Đồ án tốt nghiệp' },
        _count: { registrations: 0 },
    };

    const validTopic2 = {
        id: 102,
        title: 'Hệ thống AI IoT 2',
        semesterId: 1,
        mentorId: 50,
        projectCatalogId: 10,
        status: 'APPROVED',
        maxStudents: 1,
        mentor: { id: 50, fullName: 'GVHD Test', academicTitle: 'TIEN_SI' },
        projectCatalog: { id: 10, name: 'Đồ án tốt nghiệp' },
        _count: { registrations: 0 },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'task-5-secret';

        mockDatabase.$transaction.mockImplementation(async (cb) => {
            if (typeof cb === 'function') {
                return cb(mockDatabase);
            }
            return cb;
        });

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token-1') return { userId: 11, role: 'STUDENT' };
            if (token === 'student-token-2') return { userId: 12, role: 'STUDENT' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'lecturer-token') return { userId: 50, role: 'LECTURER' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === 50) {
                return {
                    id: 50,
                    email: 'gv50@example.com',
                    fullName: 'GVHD Test',
                    code: 'GV050',
                    role: 'LECTURER',
                    academicTitle: 'TIEN_SI',
                    isActive: true,
                    permissionGroups: [
                        {
                            permissionGroup: {
                                code: 'LECTURER',
                                permissions: [
                                    { permission: { code: 'MENTOR_REQUEST_REVIEW' } },
                                    { permission: { code: 'TOPIC_REVIEW' } },
                                ],
                            },
                        },
                    ],
                };
            }
            if (where?.id === 11) {
                return {
                    id: 11,
                    email: 'sv1@example.com',
                    fullName: 'Sinh Viên 1',
                    code: 'SV011',
                    role: 'STUDENT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where?.id === 12) {
                return {
                    id: 12,
                    email: 'sv2@example.com',
                    fullName: 'Sinh Viên 2',
                    code: 'SV012',
                    role: 'STUDENT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where?.id === 1) {
                return {
                    id: 1,
                    email: 'admin@example.com',
                    fullName: 'Trưởng Viện Admin',
                    role: 'ADMIN',
                    isActive: true,
                    permissionGroups: [
                        {
                            permissionGroup: {
                                code: 'ADMIN',
                                permissions: [{ permission: { code: 'PROJECT_ASSIGNMENT_PUBLISH' } }],
                            },
                        },
                    ],
                };
            }
            return null;
        });

        prisma.semester.findUnique.mockResolvedValue(validSemester);
        prisma.studentProjectEnrollment.findFirst.mockResolvedValue({ id: 99 });
        prisma.topicRegistration.findUnique.mockResolvedValue(null);
        prisma.topicRegistration.findFirst.mockResolvedValue(null);
    });

    it('should reject registration with 400 POLICY_UNAVAILABLE if semester has no active policy', async () => {
        prisma.topic.findUnique.mockResolvedValue(validTopic1);
        prisma.periodWorkflowPolicyVersion.findMany.mockResolvedValue([]);

        const res = await request(app)
            .post('/api/registrations')
            .set('Authorization', 'Bearer student-token-1')
            .send({ topicId: 101, semesterId: 1 });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('POLICY_UNAVAILABLE');
        expect(res.body.message).toContain('Đợt đồ án chưa cấu hình chính sách quy trình hợp lệ.');
    });

    it('should reject registration with 409 POLICY_UNAVAILABLE if semester has >1 active policy', async () => {
        prisma.topic.findUnique.mockResolvedValue(validTopic1);
        prisma.periodWorkflowPolicyVersion.findMany.mockResolvedValue([
            { id: 10, version: 1, isActive: true },
            { id: 11, version: 2, isActive: true },
        ]);

        const res = await request(app)
            .post('/api/registrations')
            .set('Authorization', 'Bearer student-token-1')
            .send({ topicId: 101, semesterId: 1 });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('POLICY_UNAVAILABLE');
        expect(res.body.message).toContain('Phát hiện nhiều hơn 1 phiên bản chính sách quy trình');
    });

    it('should auto-pin policyVersionId when single active policy exists', async () => {
        prisma.topic.findUnique.mockResolvedValue(validTopic1);
        prisma.periodWorkflowPolicyVersion.findMany.mockResolvedValue([
            { id: 42, version: 1, isActive: true },
        ]);
        prisma.topicRegistration.count.mockResolvedValue(0);
        prisma.topicRegistration.create.mockImplementation(async ({ data }) => ({
            id: 888,
            ...data,
            topic: {
                title: validTopic1.title,
                mentor: { fullName: validTopic1.mentor.fullName },
                projectCatalog: validTopic1.projectCatalog,
            },
        }));

        const res = await request(app)
            .post('/api/registrations')
            .set('Authorization', 'Bearer student-token-1')
            .send({ topicId: 101, semesterId: 1 });

        expect(res.status).toBe(201);
        expect(prisma.topicRegistration.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    periodPolicyVersionId: 42,
                    topicId: 101,
                    studentId: 11,
                    semesterId: 1,
                    status: 'PENDING',
                }),
            })
        );
    });

    it('should reject the 11th registration when two simultaneous requests race for the 10th slot', async () => {
        // Current active count for mentor 50 is 9
        let currentCount = 9;

        prisma.topic.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 101) return validTopic1;
            if (where.id === 102) return validTopic2;
            return null;
        });

        prisma.periodWorkflowPolicyVersion.findMany.mockResolvedValue([
            { id: 42, version: 1, isActive: true },
        ]);

        // Mock topicRegistration.count to return currentCount
        prisma.topicRegistration.count.mockImplementation(async () => currentCount);

        // Mock topicRegistration.create to simulate atomic increment of registrations
        prisma.topicRegistration.create.mockImplementation(async ({ data }) => {
            currentCount += 1;
            return {
                id: 900 + currentCount,
                ...data,
                topic: {
                    title: 'Đề tài đua slot',
                    mentor: { fullName: 'GVHD Test' },
                    projectCatalog: { id: 10, name: 'Đồ án' },
                },
            };
        });

        // Fire Promise.all with 2 simultaneous registration requests when current count is 9
        const [res1, res2] = await Promise.all([
            request(app)
                .post('/api/registrations')
                .set('Authorization', 'Bearer student-token-1')
                .send({ topicId: 101, semesterId: 1 }),
            request(app)
                .post('/api/registrations')
                .set('Authorization', 'Bearer student-token-2')
                .send({ topicId: 102, semesterId: 1 }),
        ]);

        const statuses = [res1.status, res2.status].sort();
        expect(statuses).toEqual([201, 400]);

        const failedResponse = res1.status === 400 ? res1 : res2;
        const successResponse = res1.status === 201 ? res1 : res2;

        expect(successResponse.body.success).toBe(true);
        expect(failedResponse.body.code).toBe('MENTOR_CAPACITY_EXCEEDED');
        expect(failedResponse.body.message).toContain('10');
    });

    it('should reject issueDecision if current BM02 does not belong to the target registration', async () => {
        // Setup registration with mismatched / foreign currentBM02Submission
        prisma.topicRegistration.findMany.mockResolvedValue([
            {
                id: 100,
                studentId: 11,
                semesterId: 1,
                status: 'BM02_SUBMITTED',
                periodPolicyVersionId: 42,
                currentBM02SubmissionId: 555,
                currentBM02Submission: {
                    id: 555,
                    registrationId: 999, // Foreign registrationId!
                    outcome: 'APPROVED',
                    policyVersionId: 42,
                },
                student: { id: 11, fullName: 'Sinh Vien 1', code: 'SV011' },
                topic: { id: 101, title: 'AI Đồ án', mentorId: 50 },
            },
        ]);

        const res = await request(app)
            .post('/api/semesters/1/issue-decision')
            .set('Authorization', 'Bearer admin-token')
            .set('Idempotency-Key', 'test-decision-guard-key-1234')
            .send({ decisionNumber: 'QD-TEST-001' });

        expect([400, 409]).toContain(res.status);
        expect(res.body.success).toBe(false);
        // Expect issueAssignmentDecision not to have committed this foreign decision
        expect(prisma.assignmentDecision.create).not.toHaveBeenCalled();
    });

    it('should verify mentorCapacity exports fixed 10 SV quota and active registration statuses', () => {
        expect(DEFAULT_MAX_STUDENTS_PER_MENTOR).toBe(10);
        expect(getMentorMaxSlots('TIEN_SI')).toBe(10);
        expect(getMentorMaxSlots('PHO_GIAO_SU')).toBe(10);
        expect(getMentorMaxSlots('THAC_SI')).toBe(10);
        expect(ACTIVE_REGISTRATION_STATUSES).toEqual(
            expect.arrayContaining([
                'SUBMITTED',
                'APPROVED',
                'IN_PROGRESS',
                'BM01_SUBMITTED',
                'BM01_PASSED',
                'BM02_SUBMITTED',
                'BM02_RESUBMITTED',
                'DECISION_ISSUED',
                'IN_PROGRESS_BM03',
                'BM03_PASSED',
                'DEFENSE_READY',
                'AWAITING_FINAL_APPROVAL',
                'DEFENDED',
                'DEFENSE_PASSED',
            ])
        );

        // Required ACTIVE_MENTOR_OCCUPANCY_STATUSES statuses
        const requiredStatuses = [
            'ASSIGNED',
            'BM01_SUBMITTED',
            'BM01_PASSED',
            'BM01_REVISION_SUBMITTED',
            'BM02_SUBMITTED',
            'BM02_APPROVED',
            'BM03_PASSED',
            'DEFENSE_ELIGIBLE',
            'DEFENSE_READY',
            'DEFENSE_SCHEDULED',
            'COMPLETED',
            'PASSED',
        ];
        expect(ACTIVE_MENTOR_OCCUPANCY_STATUSES).toEqual(expect.arrayContaining(requiredStatuses));

        // Must not include cancelled / rejected / terminated / failed statuses
        const excludedStatuses = [
            'CANCELLED',
            'REJECTED',
            'WITHDRAWN',
            'TERMINATED',
            'FAILED',
            'DROPPED',
            'DEFENSE_FAILED',
            'TERMINATED_BM01',
            'TERMINATED_BM02',
            'TERMINATED_BM04',
        ];
        excludedStatuses.forEach((status) => {
            expect(ACTIVE_MENTOR_OCCUPANCY_STATUSES).not.toContain(status);
        });
    });

    it('should block 11th student when mentor already has 10 active occupied records (including BM01_SUBMITTED)', async () => {
        // Setup mock: 10 active records including BM01_SUBMITTED
        prisma.topicRegistration.count.mockResolvedValue(10);

        // Unit check assertMentorCapacity
        await expect(
            assertMentorCapacity(50, 1, { db: prisma, increment: 1 })
        ).rejects.toMatchObject({
            statusCode: 400,
            code: 'MENTOR_CAPACITY_EXCEEDED',
            message: 'Giảng viên đã đạt giới hạn tối đa 10 sinh viên hướng dẫn trong đợt',
        });

        // Controller check: approve 11th registration
        const mockPendingReg = {
            id: 777,
            studentId: 11,
            semesterId: 1,
            status: 'PENDING',
            topic: {
                id: 101,
                title: 'Hệ thống AI IoT 1',
                mentorId: 50,
                mentor: { id: 50, fullName: 'GVHD Test', academicTitle: 'TIEN_SI' },
            },
            student: { id: 11, fullName: 'Sinh Viên 1', code: 'SV011' },
        };
        prisma.topicRegistration.findUnique.mockResolvedValue(mockPendingReg);

        const res = await request(app)
            .patch('/api/registrations/777/approve')
            .set('Authorization', 'Bearer lecturer-token')
            .send({ action: 'APPROVE' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('MENTOR_CAPACITY_EXCEEDED');
        expect(res.body.message).toBe('Giảng viên đã đạt giới hạn tối đa 10 sinh viên hướng dẫn trong đợt');
    });

    it('should reject second approval when two simultaneous approval requests race for the 10th slot', async () => {
        let currentCount = 9;

        const regA = {
            id: 801,
            studentId: 11,
            semesterId: 1,
            status: 'PENDING',
            topic: { id: 101, title: 'AI Đề tài 1', mentorId: 50, mentor: { id: 50, academicTitle: 'TIEN_SI' } },
            student: { id: 11, fullName: 'Sinh Viên 1', code: 'SV011' },
        };
        const regB = {
            id: 802,
            studentId: 12,
            semesterId: 1,
            status: 'PENDING',
            topic: { id: 102, title: 'AI Đề tài 2', mentorId: 50, mentor: { id: 50, academicTitle: 'TIEN_SI' } },
            student: { id: 12, fullName: 'Sinh Viên 2', code: 'SV012' },
        };

        prisma.topicRegistration.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 801) return regA;
            if (where.id === 802) return regB;
            return null;
        });

        prisma.topicRegistration.count.mockImplementation(async () => currentCount);
        prisma.topicRegistration.update.mockImplementation(async ({ where }) => {
            currentCount += 1;
            return { id: where.id, status: 'APPROVED' };
        });

        const [resA, resB] = await Promise.all([
            request(app)
                .patch('/api/registrations/801/approve')
                .set('Authorization', 'Bearer lecturer-token')
                .send({ action: 'APPROVE' }),
            request(app)
                .patch('/api/registrations/802/approve')
                .set('Authorization', 'Bearer lecturer-token')
                .send({ action: 'APPROVE' }),
        ]);

        const statuses = [resA.status, resB.status].sort();
        expect(statuses).toEqual([200, 400]);

        const failedResponse = resA.status === 400 ? resA : resB;
        const successResponse = resA.status === 200 ? resA : resB;

        expect(successResponse.body.success).toBe(true);
        expect(failedResponse.body.code).toBe('MENTOR_CAPACITY_EXCEEDED');
        expect(failedResponse.body.message).toContain('10');
    });

    it('should return maxSlots 10 and currentCount 10 when mentor is full via topic capacity endpoint', async () => {
        prisma.topicRegistration.count.mockResolvedValue(10);

        const res = await request(app)
            .get('/api/topics/mentors/50/capacity?semesterId=1')
            .set('Authorization', 'Bearer student-token-1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.maxSlots).toBe(10);
        expect(res.body.data.currentCount).toBe(10);
        expect(res.body.data.available).toBe(0);
    });
});

