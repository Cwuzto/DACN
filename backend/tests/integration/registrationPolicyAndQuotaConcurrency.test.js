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
    ACTIVE_REGISTRATION_STATUSES,
    getMentorMaxSlots,
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
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
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
    });
});

