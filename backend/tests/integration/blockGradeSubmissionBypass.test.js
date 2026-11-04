const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
    submission: { findUnique: jest.fn(), update: jest.fn() },
    task: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findFirst: jest.fn() },
    topicRegistration: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    semester: { findUnique: jest.fn() },
    idempotencyRecord: { findUnique: jest.fn(), create: jest.fn() },
    notification: { create: jest.fn() },
};
mockDatabase.$transaction.mockImplementation(async (cb) => cb(mockDatabase));

jest.mock('../../src/config/database', () => mockDatabase);

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/notificationService', () => ({
    safeNotify: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/academicDocumentService', () => ({
    issueAssignmentDecision: jest.fn().mockResolvedValue({ id: 501, decisionNumber: 'QD-TEST-001' }),
    createDecisionAmendment: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const prisma = require('../../src/config/database');
const { issueAssignmentDecision } = require('../../src/services/academicDocumentService');
const app = require('../../src/app');

describe('Block gradeSubmission Bypass & Task Status Lock (C01)', () => {
    const idempotencyStore = new Map();

    beforeEach(() => {
        jest.clearAllMocks();
        idempotencyStore.clear();

        prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
        process.env.JWT_SECRET = 'bypass-test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'lecturer-token') return { userId: 20, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === 20) {
                return {
                    id: 20,
                    email: 'lecturer@example.com',
                    fullName: 'GVHD User',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: [
                        {
                            permissionGroup: {
                                code: 'GVHD',
                                permissions: [
                                    { permission: { code: 'BM03_CHECKPOINT_DECIDE' } },
                                    { permission: { code: 'BM03_SUBMIT' } },
                                    { permission: { code: 'TOPIC_UPDATE_OWN' } },
                                ],
                            },
                        },
                    ],
                };
            }
            if (where?.id === 1) {
                return {
                    id: 1,
                    email: 'admin@example.com',
                    fullName: 'Admin User',
                    role: 'ADMIN',
                    isActive: true,
                    permissionGroups: [
                        {
                            permissionGroup: {
                                code: 'QUAN_TRI_VIEN',
                                permissions: [
                                    { permission: { code: 'PROJECT_ASSIGNMENT_PUBLISH' } },
                                    { permission: { code: 'SEMESTER_MANAGE' } },
                                ],
                            },
                        },
                    ],
                };
            }
            return null;
        });

        prisma.idempotencyRecord.findUnique.mockImplementation(async ({ where }) => {
            const compositeKey = `${where.scope_key.scope}:${where.scope_key.key}`;
            return idempotencyStore.get(compositeKey) || null;
        });

        prisma.idempotencyRecord.create.mockImplementation(async ({ data }) => {
            const compositeKey = `${data.scope}:${data.key}`;
            idempotencyStore.set(compositeKey, data);
            return data;
        });
    });

    it('should reject gradeSubmission for BM01 task with 400 USE_DEDICATED_WORKFLOW_COMMAND', async () => {
        prisma.submission.findUnique.mockResolvedValue({
            id: 101,
            taskId: 201,
            registrationId: 301,
            submittedBy: 10,
            task: {
                id: 201,
                title: 'Nhiệm vụ Đề cương BM01',
                taskType: 'BM01',
                registration: {
                    id: 301,
                    status: 'BM01_SUBMITTED',
                    topic: { mentorId: 20 },
                },
            },
        });

        const res = await request(app)
            .post('/api/tasks/submission/101/grade')
            .set('Authorization', 'Bearer lecturer-token')
            .send({
                decision: 'COMPLETED',
                feedback: 'Đạt yêu cầu BM01',
            });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('USE_DEDICATED_WORKFLOW_COMMAND');
        expect(prisma.topicRegistration.update).not.toHaveBeenCalled();
    });

    it('should reject gradeSubmission for BM03_CHECKPOINT_1 and BM03_CHECKPOINT_2 with 400', async () => {
        // BM03_CHECKPOINT_1
        prisma.submission.findUnique.mockResolvedValueOnce({
            id: 102,
            taskId: 202,
            registrationId: 301,
            submittedBy: 10,
            task: {
                id: 202,
                title: 'BM03 Đợt 1',
                taskType: 'BM03_CHECKPOINT_1',
                registration: {
                    id: 301,
                    status: 'DECISION_ISSUED',
                    topic: { mentorId: 20 },
                },
            },
        });

        const res1 = await request(app)
            .post('/api/tasks/submission/102/grade')
            .set('Authorization', 'Bearer lecturer-token')
            .send({
                decision: 'FAILED',
                feedback: 'Không đạt tiến độ đợt 1',
            });

        expect(res1.status).toBe(400);
        expect(res1.body.success).toBe(false);
        expect(res1.body.code).toBe('USE_DEDICATED_WORKFLOW_COMMAND');
        expect(prisma.topicRegistration.update).not.toHaveBeenCalled();

        // BM03_CHECKPOINT_2
        prisma.submission.findUnique.mockResolvedValueOnce({
            id: 103,
            taskId: 203,
            registrationId: 301,
            submittedBy: 10,
            task: {
                id: 203,
                title: 'BM03 Đợt 2',
                taskType: 'BM03_CHECKPOINT_2',
                registration: {
                    id: 301,
                    status: 'IN_PROGRESS_BM03',
                    topic: { mentorId: 20 },
                },
            },
        });

        const res2 = await request(app)
            .post('/api/tasks/submission/103/grade')
            .set('Authorization', 'Bearer lecturer-token')
            .send({
                decision: 'COMPLETED',
                feedback: 'Đạt tiến độ đợt 2',
            });

        expect(res2.status).toBe(400);
        expect(res2.body.success).toBe(false);
        expect(res2.body.code).toBe('USE_DEDICATED_WORKFLOW_COMMAND');
        expect(prisma.topicRegistration.update).not.toHaveBeenCalled();
    });

    it('should verify PATCH /tasks/:id/status cannot mutate TopicRegistration.status', async () => {
        // Subcase 1: Academic task is rejected with 409 and does not touch TopicRegistration
        prisma.task.findUnique.mockResolvedValueOnce({
            id: 201,
            title: 'BM01 Task',
            taskType: 'BM01',
            status: 'OPEN',
            registration: {
                id: 301,
                studentId: 10,
                status: 'BM01_SUBMITTED',
                topic: { mentorId: 20 },
            },
        });

        const resAcademic = await request(app)
            .patch('/api/tasks/201/status')
            .set('Authorization', 'Bearer lecturer-token')
            .send({
                status: 'COMPLETED',
            });

        expect(resAcademic.status).toBe(409);
        expect(resAcademic.body.code).toBe('ACADEMIC_TASK_STATUS_IMMUTABLE');
        expect(prisma.topicRegistration.update).not.toHaveBeenCalled();

        // Subcase 2: Generic task updates task status but does not mutate TopicRegistration
        prisma.task.findUnique.mockResolvedValueOnce({
            id: 204,
            title: 'Generic meeting task',
            taskType: 'GENERIC',
            status: 'OPEN',
            registration: {
                id: 301,
                studentId: 10,
                status: 'IN_PROGRESS',
                topic: { mentorId: 20 },
            },
        });
        prisma.task.update.mockResolvedValueOnce({
            id: 204,
            status: 'COMPLETED',
        });

        const resGeneric = await request(app)
            .patch('/api/tasks/204/status')
            .set('Authorization', 'Bearer lecturer-token')
            .send({
                status: 'COMPLETED',
            });

        expect(resGeneric.status).toBe(200);
        expect(resGeneric.body.success).toBe(true);
        expect(prisma.task.update).toHaveBeenCalled();
        expect(prisma.topicRegistration.update).not.toHaveBeenCalled();
    });

    it('should require Idempotency-Key header on POST /semesters/:id/issue-decision with 400 if missing', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 1,
            name: 'Học kỳ 1 2026-2027',
        });

        const res = await request(app)
            .post('/api/semesters/1/issue-decision')
            .set('Authorization', 'Bearer admin-token')
            .send({
                decisionNumber: 'QD-2026-001',
            });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('should replay original decision batch result when replayed with same Idempotency-Key', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 1,
            name: 'Học kỳ 1 2026-2027',
        });

        const eligibleList = [
            {
                id: 301,
                studentId: 10,
                semesterId: 1,
                status: 'BM02_SUBMITTED',
                student: { id: 10, fullName: 'Sinh Vien 1', code: 'SV001' },
                topic: { id: 401, title: 'Đề tài 1', mentorId: 20 },
            },
            {
                id: 302,
                studentId: 11,
                semesterId: 1,
                status: 'BM02_SUBMITTED',
                student: { id: 11, fullName: 'Sinh Vien 2', code: 'SV002' },
                topic: { id: 402, title: 'Đề tài 2', mentorId: 20 },
            },
        ];

        prisma.topicRegistration.findMany.mockResolvedValueOnce(eligibleList);
        prisma.task.findFirst.mockResolvedValue(null);
        prisma.task.create.mockResolvedValue({ id: 501 });

        const testIdempotencyKey = 'period-decision-batch-unique-key-001';
        const payload = {
            decisionNumber: 'QD-2026-FINAL',
            decisionDate: '2026-11-05',
            note: 'Ban hành đợt 1',
        };

        // First call: Should execute batch and store idempotency receipt
        const res1 = await request(app)
            .post('/api/semesters/1/issue-decision')
            .set('Authorization', 'Bearer admin-token')
            .set('Idempotency-Key', testIdempotencyKey)
            .send(payload);

        expect(res1.status).toBe(200);
        expect(res1.body.success).toBe(true);
        expect(res1.body.data.studentCount).toBe(2);
        expect(issueAssignmentDecision).toHaveBeenCalledTimes(2);

        // Second call: With same key, should replay cached response without querying eligible or calling issueAssignmentDecision again
        prisma.topicRegistration.findMany.mockResolvedValueOnce([]); // no more eligible registrations

        const res2 = await request(app)
            .post('/api/semesters/1/issue-decision')
            .set('Authorization', 'Bearer admin-token')
            .set('Idempotency-Key', testIdempotencyKey)
            .send(payload);

        expect(res2.status).toBe(200);
        expect(res2.body.success).toBe(true);
        expect(res2.body.data.studentCount).toBe(2);
        expect(res2.body.data.decisionNumber).toBe(res1.body.data.decisionNumber);
        // issueAssignmentDecision should NOT have been called again (still 2 times total from first call)
        expect(issueAssignmentDecision).toHaveBeenCalledTimes(2);
    });
});
