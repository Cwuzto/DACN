const request = require('supertest');
const jwt = require('jsonwebtoken');

// Prepare mocked Prisma database for testing
const mockTopicRegistration = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockBM02Submission = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockTopicAssignmentDecision = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockTopicAssignmentDecisionItem = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
};

const mockAssignmentDecision = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
};

const mockTask = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockUser = {
    findUnique: jest.fn(),
};

const mockSemester = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
};

const mockPeriodWorkflowPolicyVersion = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
};

const mockBM01Evaluation = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
};

const mockCouncilMember = {
    findFirst: jest.fn(),
};

const mockCouncilResultBatch = {
    findFirst: jest.fn(),
    update: jest.fn(),
};

const mockIdempotencyRecord = {
    findUnique: jest.fn(),
    create: jest.fn(),
};

const mockRegistrationStateHistory = {
    create: jest.fn(),
};

const mockAuditLog = {
    create: jest.fn(),
};

const mockPrisma = {
    topicRegistration: mockTopicRegistration,
    bM02Submission: mockBM02Submission,
    topicAssignmentDecision: mockTopicAssignmentDecision,
    topicAssignmentDecisionItem: mockTopicAssignmentDecisionItem,
    assignmentDecision: mockAssignmentDecision,
    task: mockTask,
    user: mockUser,
    semester: mockSemester,
    periodWorkflowPolicyVersion: mockPeriodWorkflowPolicyVersion,
    bM01Evaluation: mockBM01Evaluation,
    councilMember: mockCouncilMember,
    councilResultBatch: mockCouncilResultBatch,
    idempotencyRecord: mockIdempotencyRecord,
    registrationStateHistory: mockRegistrationStateHistory,
    auditLog: mockAuditLog,
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-token'),
}));

const { publishCouncilResults, reviewResubmission } = require('../../src/services/outlineReviewService');
const {
    submitBM02,
    createTopicDecision,
    publishTopicDecision,
} = require('../../src/services/academicDocumentService');
const { reviewBM02 } = require('../../src/services/bm02ReviewService');
const app = require('../../src/app');

function buildUser({ id, role, permissions = [] }) {
    return {
        id,
        role,
        fullName: `${role} User`,
        email: `${role.toLowerCase()}${id}@test.vn`,
        code: `${role}-${id}`,
        isActive: true,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                code: `GROUP_${role}`,
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
    };
}

describe('BM02 and Topic Assignment Decision Workflow (Chặng 1A)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-jwt-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'reviewer-token') return { userId: 20, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        mockUser.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 10) return buildUser({ id: 10, role: 'STUDENT', permissions: ['SUBMIT_BM02'] });
            if (where.id === 20) return buildUser({ id: 20, role: 'LECTURER', permissions: ['BM02_REVIEW'] });
            if (where.id === 1) return buildUser({
                id: 1,
                role: 'ADMIN',
                permissions: ['BM02_REVIEW', 'TOPIC_ASSIGNMENT_DECISION_ISSUE', 'PROJECT_ASSIGNMENT_PUBLISH'],
            });
            return null;
        });

        mockIdempotencyRecord.findUnique.mockResolvedValue(null);
        mockIdempotencyRecord.create.mockResolvedValue({});
        mockRegistrationStateHistory.create.mockResolvedValue({});
    });

    describe('1. Transition to BM01_PASSED in outlineReviewService', () => {
        test('publishCouncilResults sets bm01ApprovedTitleSnapshot and inherits lockedPolicyVersionId', async () => {
            const councilId = 101;
            const chairId = 20;

            mockCouncilMember.findFirst.mockResolvedValue({
                id: 1,
                councilId,
                lecturerId: chairId,
                role: 'CHAIR',
            });

            mockCouncilResultBatch.findFirst.mockResolvedValue({
                id: 5,
                councilId,
                status: 'PENDING_CHAIR',
            });
            mockCouncilResultBatch.update.mockResolvedValue({
                id: 5,
                status: 'PUBLISHED',
            });

            mockBM01Evaluation.findMany.mockResolvedValue([
                {
                    id: 201,
                    registrationId: 50,
                    initialOutcome: 'PASS',
                    attemptNo: 1,
                },
            ]);

            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 50,
                status: 'BM01_SUBMITTED',
                stateVersion: 1,
                periodPolicyVersionId: null,
                semesterId: 3,
                topic: { id: 8, title: 'Hệ thống Quản lý Đồ án Tốt nghiệp' },
                semester: { id: 3, lockedPolicyVersionId: 12 },
            });

            mockTask.findFirst.mockResolvedValue(null);
            mockTask.create.mockResolvedValue({ id: 99, taskType: 'BM02', status: 'OPEN' });

            await publishCouncilResults(councilId, chairId, 'publish-key-0001');

            expect(mockTopicRegistration.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 50 },
                data: expect.objectContaining({
                    status: 'BM01_PASSED',
                    bm01ApprovedTitleSnapshot: 'Hệ thống Quản lý Đồ án Tốt nghiệp',
                    periodPolicyVersionId: 12,
                }),
            }));

            expect(mockTask.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    registrationId: 50,
                    taskType: 'BM02',
                    status: 'OPEN',
                }),
            }));
        });

        test('reviewResubmission sets bm01ApprovedTitleSnapshot and inherits lockedPolicyVersionId on approve', async () => {
            const councilId = 101;
            const regId = 50;
            const chairId = 20;

            mockCouncilMember.findFirst.mockResolvedValue({
                id: 1,
                councilId,
                lecturerId: chairId,
                role: 'CHAIR',
            });

            mockBM01Evaluation.findFirst.mockResolvedValue({
                id: 202,
                registrationId: regId,
                attemptNo: 2,
            });
            mockBM01Evaluation.update.mockResolvedValue({});

            mockTopicRegistration.findUnique.mockResolvedValue({
                id: regId,
                status: 'BM01_RESUBMITTED',
                outlineCouncilId: councilId,
                stateVersion: 2,
                periodPolicyVersionId: null,
                semesterId: 3,
                topic: { id: 8, title: 'Hệ thống Quản lý Đồ án Tốt nghiệp (BM01)' },
                semester: { id: 3, lockedPolicyVersionId: 12 },
            });
            mockTopicRegistration.update.mockResolvedValue({ id: regId, status: 'BM01_PASSED' });
            mockTask.findFirst.mockResolvedValue({ id: 99, status: 'SUBMITTED' });
            mockTask.update.mockResolvedValue({ id: 99, status: 'OPEN' });

            await reviewResubmission(councilId, regId, 'APPROVE', 'Đã sửa đạt yêu cầu', chairId);

            expect(mockTopicRegistration.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: regId },
                data: expect.objectContaining({
                    status: 'BM01_PASSED',
                    bm01ApprovedTitleSnapshot: 'Hệ thống Quản lý Đồ án Tốt nghiệp (BM01)',
                    periodPolicyVersionId: 12,
                }),
            }));
        });
    });

    describe('2. submitBM02 in academicDocumentService', () => {
        test('allows refined bm02ProposedTitle and titleChangeReason, syncs Task(BM02) to SUBMITTED', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 50,
                studentId: 10,
                status: 'BM01_PASSED',
                stateVersion: 2,
                periodPolicyVersionId: 12,
                bm01ApprovedTitleSnapshot: 'Tên đề tài BM01 ban đầu',
                topic: {
                    id: 8,
                    title: 'Tên đề tài BM01 ban đầu',
                    mentor: { id: 25, fullName: 'TS. Nguyễn Văn Hướng Dẫn', email: 'hd@test.vn' },
                },
                student: {
                    id: 10,
                    fullName: 'Sinh Viên A',
                    studentCode: 'SV2026001',
                    email: 'sva@test.vn',
                },
            });

            mockBM02Submission.findFirst.mockResolvedValue(null);
            mockBM02Submission.create.mockImplementation(async ({ data }) => ({
                id: 301,
                ...data,
            }));

            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTask.findFirst.mockResolvedValue({ id: 99, registrationId: 50, taskType: 'BM02', status: 'OPEN' });
            mockTask.update.mockResolvedValue({ id: 99, status: 'SUBMITTED' });

            const result = await submitBM02({
                registrationId: 50,
                studentId: 10,
                bm02ProposedTitle: 'Tên đề tài BM02 cập nhật cách diễn đạt theo góp ý hội đồng',
                titleChangeReason: 'Làm rõ phạm vi nghiên cứu theo góp ý của Hội đồng thẩm định BM01',
                content: 'Nội dung kế hoạch BM02',
                fileUrl: 'https://storage.test/bm02_sv.pdf',
                fileName: 'bm02_sv.pdf',
                idempotencyKey: 'bm02-submit-key-001',
            });

            expect(result.id).toBe(301);
            expect(mockBM02Submission.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    registrationId: 50,
                    bm01ApprovedTitle: 'Tên đề tài BM01 ban đầu',
                    bm02ProposedTitle: 'Tên đề tài BM02 cập nhật cách diễn đạt theo góp ý hội đồng',
                    titleChangeReason: 'Làm rõ phạm vi nghiên cứu theo góp ý của Hội đồng thẩm định BM01',
                    attemptNo: 1,
                    versionNo: 1,
                }),
            });

            expect(mockTask.update).toHaveBeenCalledWith({
                where: { id: 99 },
                data: { status: 'SUBMITTED' },
            });
        });
    });

    describe('3. reviewBM02 in bm02ReviewService', () => {
        test('RETURN_FOR_REVISION transitions to BM02_NEEDS_REVISION and syncs Task(BM02) to REVISION', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 50,
                status: 'BM02_SUBMITTED',
                stateVersion: 3,
                periodPolicyVersionId: 12,
                currentBM02SubmissionId: 301,
            });

            mockBM02Submission.findUnique.mockResolvedValue({
                id: 301,
                registrationId: 50,
                attemptNo: 1,
                versionNo: 1,
                outcome: 'PENDING_REVIEW',
                policyVersionId: 12,
            });

            mockPeriodWorkflowPolicyVersion.findUnique.mockResolvedValue({
                id: 12,
                policy: { revisionWindowDays: 7, bm02MaxResubmissions: 1 },
            });

            mockBM02Submission.update.mockImplementation(async ({ data }) => ({
                id: 301,
                ...data,
            }));
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });

            mockTask.findFirst.mockResolvedValue({ id: 99, registrationId: 50, taskType: 'BM02', status: 'SUBMITTED' });
            mockTask.update.mockResolvedValue({ id: 99, status: 'REVISION' });

            const result = await reviewBM02({
                registrationId: 50,
                reviewerId: 20,
                action: 'RETURN_FOR_REVISION',
                issues: ['Cần bổ sung chữ ký của GVHD trong file đính kèm'],
                idempotencyKey: 'bm02-review-return-001',
            });

            expect(result.targetStatus).toBe('BM02_NEEDS_REVISION');
            expect(mockBM02Submission.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 301 },
                data: expect.objectContaining({
                    outcome: 'REVISION_REQUIRED',
                }),
            }));

            expect(mockTask.update).toHaveBeenCalledWith({
                where: { id: 99 },
                data: { status: 'REVISION' },
            });
        });

        test('APPROVE transitions registration to BM02_APPROVED and syncs Task(BM02) to COMPLETED', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 50,
                status: 'BM02_SUBMITTED',
                stateVersion: 3,
                periodPolicyVersionId: 12,
                currentBM02SubmissionId: 301,
            });

            mockBM02Submission.findUnique.mockResolvedValue({
                id: 301,
                registrationId: 50,
                attemptNo: 1,
                versionNo: 1,
                outcome: 'PENDING_REVIEW',
                policyVersionId: 12,
            });

            mockPeriodWorkflowPolicyVersion.findUnique.mockResolvedValue({
                id: 12,
                policy: { revisionWindowDays: 7, bm02MaxResubmissions: 1 },
            });

            mockBM02Submission.update.mockImplementation(async ({ data }) => ({
                id: 301,
                ...data,
            }));
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });

            mockTask.findFirst.mockResolvedValue({ id: 99, registrationId: 50, taskType: 'BM02', status: 'SUBMITTED' });
            mockTask.update.mockResolvedValue({ id: 99, status: 'COMPLETED' });

            const result = await reviewBM02({
                registrationId: 50,
                reviewerId: 20,
                action: 'APPROVE',
                targetStatus: 'BM02_APPROVED',
                idempotencyKey: 'bm02-review-approve-001',
            });

            expect(result.submission.outcome).toBe('APPROVED');
            expect(mockTask.update).toHaveBeenCalledWith({
                where: { id: 99 },
                data: { status: 'COMPLETED' },
            });
        });
    });

    describe('4. createTopicDecision and publishTopicDecision in academicDocumentService', () => {
        test('createTopicDecision creates decision in DRAFT and snapshot items', async () => {
            mockSemester.findUnique.mockResolvedValue({
                id: 3,
                name: 'Học kỳ 1 2026-2027',
                lockedPolicyVersionId: 12,
            });

            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 50,
                semesterId: 3,
                status: 'BM02_APPROVED',
                currentBM02SubmissionId: 301,
                currentBM02Submission: {
                    id: 301,
                    outcome: 'APPROVED',
                    bm01ApprovedTitle: 'Tên BM01',
                    bm02ProposedTitle: 'Tên BM02 Đã duyệt',
                },
                topic: { id: 8, title: 'Tên BM01', mentor: { fullName: 'ThS. Nguyễn Văn A' } },
                student: { id: 10, studentCode: 'SV001', fullName: 'Sinh Viên Một' },
            });

            mockTopicAssignmentDecisionItem.findUnique.mockResolvedValue(null);
            mockTopicAssignmentDecision.findUnique.mockResolvedValue(null);
            mockTopicAssignmentDecision.create.mockResolvedValue({
                id: 701,
                semesterId: 3,
                decisionNumber: 'QD-2026-001',
                decisionDate: new Date('2026-11-15T00:00:00.000Z'),
                status: 'DRAFT',
            });

            mockTopicAssignmentDecisionItem.create.mockResolvedValue({
                id: 801,
                decisionId: 701,
                registrationId: 50,
                approvedTitleSnapshot: 'Tên BM02 Đã duyệt',
            });

            const decision = await createTopicDecision({
                semesterId: 3,
                decisionNumber: 'QD-2026-001',
                decisionDate: new Date('2026-11-15T00:00:00.000Z'),
                registrationIds: [50],
                issuedById: 1,
                idempotencyKey: 'create-decision-001',
            });

            expect(decision.id).toBe(701);
            expect(decision.status).toBe('DRAFT');
            expect(mockTopicAssignmentDecisionItem.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    decisionId: 701,
                    registrationId: 50,
                    approvedTitleSnapshot: 'Tên BM02 Đã duyệt',
                    studentCodeSnapshot: 'SV001',
                    studentNameSnapshot: 'Sinh Viên Một',
                    mentorNameSnapshot: 'ThS. Nguyễn Văn A',
                }),
            });
        });

        test('publishTopicDecision sets PUBLISHED, calculates 168h window from publishedAt and transitions registrations to DECISION_ISSUED', async () => {
            const publishedAt = new Date('2026-11-15T10:00:00.000Z');
            const expectedDeadline = new Date(publishedAt.getTime() + 168 * 3600 * 1000);

            mockTopicAssignmentDecision.findUnique.mockResolvedValue({
                id: 701,
                status: 'DRAFT',
                decisionNumber: 'QD-2026-001',
                decisionDate: new Date('2026-11-10T00:00:00.000Z'),
                policyVersionId: 12,
                items: [
                    {
                        id: 801,
                        decisionId: 701,
                        registrationId: 50,
                        bm02SubmissionId: 301,
                        approvedTitleSnapshot: 'Tên BM02 Đã duyệt',
                    },
                ],
            });

            mockTopicAssignmentDecision.update.mockResolvedValue({
                id: 701,
                status: 'PUBLISHED',
                decisionPublishedAt: publishedAt,
            });

            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 50,
                status: 'BM02_APPROVED',
                stateVersion: 4,
            });
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTopicRegistration.update.mockResolvedValue({});
            mockAssignmentDecision.findUnique.mockResolvedValue(null);
            mockAssignmentDecision.create.mockResolvedValue({ id: 901 });
            mockTask.findFirst.mockResolvedValue(null);
            mockTask.create.mockResolvedValue({ id: 105 });

            const published = await publishTopicDecision({
                decisionId: 701,
                publishedById: 1,
                publishedAt,
                idempotencyKey: 'publish-decision-001',
            });

            expect(published.status).toBe('PUBLISHED');
            expect(new Date(published.titleAdjustmentDeadline).getTime()).toBe(expectedDeadline.getTime());

            expect(mockTopicAssignmentDecision.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 701 },
                data: expect.objectContaining({
                    status: 'PUBLISHED',
                    decisionPublishedAt: publishedAt,
                }),
            }));

            expect(mockTopicRegistration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({ id: 50 }),
                data: expect.objectContaining({
                    status: 'DECISION_ISSUED',
                    decisionNumber: 'QD-2026-001',
                    decisionPublishedAt: publishedAt,
                }),
            }));
        });
    });

    describe('5. HTTP Endpoints and Adapters via Supertest', () => {
        test('POST /api/bm02/applications/:registrationId/submit allows submission with title change reason', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 50,
                studentId: 10,
                status: 'BM01_PASSED',
                stateVersion: 1,
                periodPolicyVersionId: 12,
                topic: { title: 'Tên BM01' },
                student: { fullName: 'SV 10' },
            });
            mockBM02Submission.create.mockResolvedValue({
                id: 301,
                registrationId: 50,
                bm02ProposedTitle: 'Tên BM02 mới',
                titleChangeReason: 'Cập nhật từ ngữ',
            });
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTask.findFirst.mockResolvedValue({ id: 99 });
            mockTask.update.mockResolvedValue({});

            const res = await request(app)
                .post('/api/bm02/applications/50/submit')
                .set('Authorization', 'Bearer student-token')
                .set('Idempotency-Key', 'http-bm02-submit-001')
                .send({
                    bm02ProposedTitle: 'Tên BM02 mới',
                    titleChangeReason: 'Cập nhật từ ngữ',
                    content: 'Nội dung nộp',
                    fileUrl: 'https://test/bm02.pdf',
                    fileName: 'bm02.pdf',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(301);
        });

        test('POST /api/bm02/applications/:id/request-revision returns 200 with review result', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 50,
                status: 'BM02_SUBMITTED',
                stateVersion: 2,
                periodPolicyVersionId: 12,
                currentBM02SubmissionId: 301,
                studentId: 10,
                topic: { title: 'Đề tài 50' },
            });
            mockBM02Submission.findUnique.mockResolvedValue({
                id: 301,
                registrationId: 50,
                attemptNo: 1,
                outcome: 'PENDING_REVIEW',
                policyVersionId: 12,
            });
            mockPeriodWorkflowPolicyVersion.findUnique.mockResolvedValue({
                id: 12,
                policy: { revisionWindowDays: 5, bm02MaxResubmissions: 1 },
            });
            mockBM02Submission.update.mockResolvedValue({
                id: 301,
                outcome: 'REVISION_REQUIRED',
            });
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTask.findFirst.mockResolvedValue({ id: 99 });
            mockTask.update.mockResolvedValue({});

            const res = await request(app)
                .post('/api/bm02/applications/50/request-revision')
                .set('Authorization', 'Bearer reviewer-token')
                .set('Idempotency-Key', 'http-bm02-return-001')
                .send({
                    issues: ['Cần làm rõ mục tiêu số 2'],
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.targetStatus).toBe('BM02_NEEDS_REVISION');
        });

        test('POST /api/bm02/applications/:id/approve returns 200 and approves BM02', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 50,
                status: 'BM02_SUBMITTED',
                stateVersion: 2,
                periodPolicyVersionId: 12,
                currentBM02SubmissionId: 301,
                studentId: 10,
                topic: { title: 'Đề tài 50' },
            });
            mockBM02Submission.findUnique.mockResolvedValue({
                id: 301,
                registrationId: 50,
                attemptNo: 1,
                outcome: 'PENDING_REVIEW',
                policyVersionId: 12,
            });
            mockPeriodWorkflowPolicyVersion.findUnique.mockResolvedValue({
                id: 12,
                policy: { revisionWindowDays: 5, bm02MaxResubmissions: 1 },
            });
            mockBM02Submission.update.mockResolvedValue({
                id: 301,
                outcome: 'APPROVED',
            });
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTask.findFirst.mockResolvedValue({ id: 99 });
            mockTask.update.mockResolvedValue({});

            const res = await request(app)
                .post('/api/bm02/applications/50/approve')
                .set('Authorization', 'Bearer reviewer-token')
                .set('Idempotency-Key', 'http-bm02-approve-001')
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.submission.outcome).toBe('APPROVED');
        });

        test('POST /api/topic-decisions creates draft decision', async () => {
            mockSemester.findUnique.mockResolvedValue({
                id: 3,
                name: 'HK 2026.1',
                lockedPolicyVersionId: 12,
            });
            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 50,
                semesterId: 3,
                status: 'BM02_APPROVED',
                currentBM02SubmissionId: 301,
                currentBM02Submission: { id: 301, outcome: 'APPROVED', bm02ProposedTitle: 'Tên Đề Tài' },
                topic: { title: 'Tên Đề Tài', mentor: { fullName: 'GVHD 1' } },
                student: { studentCode: 'SV01', fullName: 'SV 1' },
            });
            mockTopicAssignmentDecisionItem.findUnique.mockResolvedValue(null);
            mockTopicAssignmentDecision.findUnique.mockResolvedValue(null);
            mockTopicAssignmentDecision.create.mockResolvedValue({
                id: 701,
                semesterId: 3,
                decisionNumber: 'QD-TEST-001',
                status: 'DRAFT',
            });
            mockTopicAssignmentDecisionItem.create.mockResolvedValue({ id: 801 });

            const res = await request(app)
                .post('/api/topic-decisions')
                .set('Authorization', 'Bearer admin-token')
                .set('Idempotency-Key', 'http-create-decision-001')
                .send({
                    semesterId: 3,
                    decisionNumber: 'QD-TEST-001',
                    decisionDate: '2026-11-15',
                    registrationIds: [50],
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(701);
        });

        test('POST /api/topic-decisions/:id/publish publishes decision and calculates 168h window', async () => {
            const pubAt = new Date('2026-11-15T12:00:00.000Z');
            mockTopicAssignmentDecision.findUnique.mockResolvedValue({
                id: 701,
                status: 'DRAFT',
                decisionNumber: 'QD-TEST-001',
                decisionDate: new Date('2026-11-15'),
                policyVersionId: 12,
                items: [{ id: 801, registrationId: 50, bm02SubmissionId: 301, approvedTitleSnapshot: 'Tên' }],
            });
            mockTopicAssignmentDecision.update.mockResolvedValue({
                id: 701,
                status: 'PUBLISHED',
                decisionPublishedAt: pubAt,
            });
            mockTopicRegistration.findUnique.mockResolvedValue({ id: 50, status: 'BM02_APPROVED', stateVersion: 2 });
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTopicRegistration.update.mockResolvedValue({});
            mockAssignmentDecision.findUnique.mockResolvedValue(null);
            mockAssignmentDecision.create.mockResolvedValue({ id: 901 });
            mockTask.findFirst.mockResolvedValue(null);
            mockTask.create.mockResolvedValue({ id: 101 });

            const res = await request(app)
                .post('/api/topic-decisions/701/publish')
                .set('Authorization', 'Bearer admin-token')
                .set('Idempotency-Key', 'http-publish-decision-001')
                .send({ publishedAt: pubAt.toISOString() });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('PUBLISHED');
            expect(res.body.data.titleAdjustmentDeadline).toBeDefined();
        });

        test('Backward-compatible adapter: POST /api/registrations/bm02-submit still functions', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 50,
                studentId: 10,
                status: 'BM01_PASSED',
                stateVersion: 1,
                periodPolicyVersionId: 12,
                topic: { title: 'Tên BM01' },
                student: { fullName: 'SV 10' },
            });
            mockBM02Submission.create.mockResolvedValue({
                id: 302,
                registrationId: 50,
            });
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTask.findFirst.mockResolvedValue({ id: 99 });
            mockTask.update.mockResolvedValue({});

            const res = await request(app)
                .post('/api/registrations/bm02-submit')
                .set('Authorization', 'Bearer student-token')
                .set('Idempotency-Key', 'compat-bm02-submit-001')
                .send({
                    registrationId: 50,
                    content: 'Nội dung nộp cũ',
                    fileUrl: 'https://test/bm02_old.pdf',
                    fileName: 'bm02_old.pdf',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
        test('POST /api/bm02/applications/:id/resubmit allows student to resubmit with revision changes', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 50,
                studentId: 10,
                status: 'BM02_NEEDS_REVISION',
                stateVersion: 3,
                periodPolicyVersionId: 12,
                currentBM02SubmissionId: 301,
                topic: { title: 'Tên BM01' },
                student: { fullName: 'SV 10' },
            });
            mockBM02Submission.findUnique.mockResolvedValue({
                id: 301,
                registrationId: 50,
                versionNo: 1,
                attemptNo: 1,
                outcome: 'REVISION_REQUIRED',
                revisionDeadlineAt: new Date(Date.now() + 86400000),
            });
            mockBM02Submission.create.mockResolvedValue({
                id: 302,
                registrationId: 50,
                versionNo: 2,
                attemptNo: 2,
                bm02ProposedTitle: 'Tên BM02 đã sửa',
            });
            mockBM02Submission.update.mockResolvedValue({});
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTask.findFirst.mockResolvedValue({ id: 99 });
            mockTask.update.mockResolvedValue({});

            const res = await request(app)
                .post('/api/bm02/applications/50/resubmit')
                .set('Authorization', 'Bearer student-token')
                .set('Idempotency-Key', 'http-bm02-resubmit-001')
                .send({
                    bm02ProposedTitle: 'Tên BM02 đã sửa',
                    titleChangeReason: 'Cập nhật lại tên theo yêu cầu',
                    content: 'Nội dung nộp lại',
                    fileUrl: 'https://test/bm02_v2.pdf',
                    fileName: 'bm02_v2.pdf',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(302);
        });

        test('Backward-compatible adapter: POST /api/semesters/:id/issue-decision delegates to create and publish decision', async () => {
            mockSemester.findUnique.mockResolvedValue({
                id: 3,
                name: 'HK 2026.1',
                lockedPolicyVersionId: 12,
            });
            mockTopicRegistration.findMany.mockResolvedValue([
                {
                    id: 50,
                    semesterId: 3,
                    studentId: 10,
                    status: 'BM02_APPROVED',
                    currentBM02SubmissionId: 301,
                    currentBM02Submission: { id: 301, outcome: 'APPROVED', bm02ProposedTitle: 'Tên Đề Tài' },
                    topic: { title: 'Tên Đề Tài', mentor: { fullName: 'GVHD 1' } },
                    student: { studentCode: 'SV01', fullName: 'SV 1' },
                },
            ]);
            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 50,
                semesterId: 3,
                studentId: 10,
                status: 'BM02_APPROVED',
                currentBM02SubmissionId: 301,
                currentBM02Submission: { id: 301, outcome: 'APPROVED', bm02ProposedTitle: 'Tên Đề Tài' },
                topic: { title: 'Tên Đề Tài', mentor: { fullName: 'GVHD 1' } },
                student: { studentCode: 'SV01', fullName: 'SV 1' },
            });
            mockTopicAssignmentDecisionItem.findUnique.mockResolvedValue(null);
            mockTopicAssignmentDecision.findUnique.mockImplementation(async ({ where }) => {
                if (where?.id === 702) {
                    return {
                        id: 702,
                        status: 'DRAFT',
                        decisionNumber: 'QD-HK2026.1-9999',
                        decisionDate: new Date('2026-11-15'),
                        policyVersionId: 12,
                        items: [{ id: 802, registrationId: 50, bm02SubmissionId: 301, approvedTitleSnapshot: 'Tên' }],
                    };
                }
                return null;
            });
            mockTopicAssignmentDecision.create.mockResolvedValue({
                id: 702,
                semesterId: 3,
                decisionNumber: 'QD-HK2026.1-9999',
                status: 'DRAFT',
            });
            mockTopicAssignmentDecisionItem.create.mockResolvedValue({ id: 802 });
            mockTopicAssignmentDecision.update.mockResolvedValue({
                id: 702,
                status: 'PUBLISHED',
                decisionPublishedAt: new Date('2026-11-15'),
            });
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTopicRegistration.update.mockResolvedValue({});
            mockAssignmentDecision.findUnique.mockResolvedValue(null);
            mockAssignmentDecision.create.mockResolvedValue({ id: 902 });
            mockTask.findFirst.mockResolvedValue(null);
            mockTask.create.mockResolvedValue({ id: 102 });

            const res = await request(app)
                .post('/api/semesters/3/issue-decision')
                .set('Authorization', 'Bearer admin-token')
                .set('Idempotency-Key', 'compat-issue-period-001')
                .send({
                    decisionNumber: 'QD-HK2026.1-9999',
                    decisionDate: '2026-11-15',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.decisionNumber).toBe('QD-HK2026.1-9999');
        });
    });
});
