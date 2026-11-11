const request = require('supertest');
const jwt = require('jsonwebtoken');

// ============================================================================
// 1. Mock Prisma Database for BM02 to BM04 Full E2E Lifecycle
// ============================================================================

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
    updateMany: jest.fn(),
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

const mockBM02AAdjustmentRequest = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockBM02AFormVersion = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockTitleAdjustmentAppendix = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
};

const mockTitleAdjustmentAppendixItem = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
};

const mockBM03ProgressRecord = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockBM03MeetingEntry = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockBM03StageEvaluation = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockInstituteStopReview = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockBM04Evaluation = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
};

const mockInstituteDefenseReview = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockTask = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockCouncil = {
    findUnique: jest.fn(),
};

const mockCouncilMember = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
};

const mockSemester = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
};

const mockTopic = {
    findUnique: jest.fn(),
    update: jest.fn(),
};

const mockPeriodWorkflowPolicyVersion = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
};

const mockUser = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
};

const mockAcademicDelegation = {
    findFirst: jest.fn(),
};

const mockElectronicSignatureEvent = {
    create: jest.fn(),
    findMany: jest.fn(),
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
    bM02AAdjustmentRequest: mockBM02AAdjustmentRequest,
    bM02AFormVersion: mockBM02AFormVersion,
    titleAdjustmentAppendix: mockTitleAdjustmentAppendix,
    titleAdjustmentAppendixItem: mockTitleAdjustmentAppendixItem,
    bM03ProgressRecord: mockBM03ProgressRecord,
    bM03MeetingEntry: mockBM03MeetingEntry,
    bM03StageEvaluation: mockBM03StageEvaluation,
    instituteStopReview: mockInstituteStopReview,
    bM04Evaluation: mockBM04Evaluation,
    instituteDefenseReview: mockInstituteDefenseReview,
    task: mockTask,
    council: mockCouncil,
    councilMember: mockCouncilMember,
    semester: mockSemester,
    topic: mockTopic,
    periodWorkflowPolicyVersion: mockPeriodWorkflowPolicyVersion,
    user: mockUser,
    academicDelegation: mockAcademicDelegation,
    electronicSignatureEvent: mockElectronicSignatureEvent,
    idempotencyRecord: mockIdempotencyRecord,
    registrationStateHistory: mockRegistrationStateHistory,
    auditLog: mockAuditLog,
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

const mockGenerateImmutableAcademicPdf = jest.fn().mockResolvedValue({
    fileUrl: 'https://storage.example.com/academic/e2e-final.pdf',
    fileName: 'e2e-final.pdf',
    pdfHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    pdfBuffer: Buffer.from('mock-e2e-pdf'),
});

jest.mock('../../src/services/academicPdfService', () => ({
    generateImmutableAcademicPdf: (...args) => mockGenerateImmutableAcademicPdf(...args),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-token'),
}));

// ============================================================================
// 2. Services, Controllers & App Imports
// ============================================================================

const {
    submitBM02,
    createTopicDecision,
    publishTopicDecision,
} = require('../../src/services/academicDocumentService');

const { reviewBM02 } = require('../../src/services/bm02ReviewService');

const {
    createBM02ARequest,
    studentSignAndSubmitBM02A,
    advisorSignBM02A,
    departmentSignBM02A,
    returnBM02A,
    reviseBM02A,
    BM02AWorkflowError,
} = require('../../src/services/bm02aWorkflowService');

const {
    createAppendixDraft,
    updateAppendixItems,
    issueAppendix,
} = require('../../src/services/titleAdjustmentAppendixService');

const { resolveEffectiveTopicTitle } = require('../../src/services/topicTitleResolverService');
const { computeCanonicalPayloadHash } = require('../../src/services/electronicSignatureService');

const {
    getBM03Record,
    getOrCreateBM03Record,
    createBM03Meeting,
    signBM03Meeting,
    submitStageEvaluation,
    requestMoreInfoForStopReview,
    decideStopReview,
    advisorSignWholeBM03,
    studentAcknowledgeBM03,
    studentDeclineBM03,
    BM03WorkflowError,
} = require('../../src/services/bm03WorkflowService');

const {
    getBM04Record,
    saveBM04Draft,
    signAndSubmitBM04,
    requestMoreInfoForDefenseReview,
    decideDefenseReview,
    BM04WorkflowError,
} = require('../../src/services/bm04WorkflowService');

const {
    runBm02ToBm04SweepJobs,
} = require('../../src/services/bm02ToBm04SweepService');

const councilController = require('../../src/controllers/councilController');
const app = require('../../src/app');

// ============================================================================
// 3. User & Fixture Factories
// ============================================================================

function buildUser({ id, role, department = 'CNTT', permissions = [] }) {
    return {
        id,
        role,
        department,
        fullName: `${role} User`,
        email: `${role.toLowerCase()}${id}@test.vn`,
        code: `${role}-${id}`,
        isActive: true,
        studentProfile: role === 'STUDENT' ? {
            dateOfBirth: new Date('2002-05-15T00:00:00Z'),
            placeOfBirth: 'Hà Nội',
            className: 'CNTT1-K65',
            cohort: 'K65',
            major: 'Công nghệ thông tin',
        } : null,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                code: `GROUP_${role}`,
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
    };
}

describe('BM02 to BM04 Academic Lifecycle Full End-to-End Integration Test', () => {
    const studentId = 101;
    const advisorId = 201;
    const deptHeadId = 202;
    const adminId = 301;
    const councilChairId = 401;
    const councilSecId = 402;
    const councilRevId = 403;

    const registrationId = 1001;
    const semesterId = 3;
    const topicId = 88;
    const decisionId = 701;
    const bm02aId = 801;
    const appendixId = 901;
    const bm03RecordId = 501;
    const defenseCouncilId = 601;

    let baseRegistration;
    let baseTopic;
    let baseSemester;
    let basePolicy;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-jwt-secret';

        jwt.verify.mockImplementation((token) => {
            const rawToken = token.startsWith('Bearer ') ? token.slice(7) : token;
            if (rawToken === 'student-token') return { userId: studentId, role: 'STUDENT' };
            if (rawToken === 'advisor-token') return { userId: advisorId, role: 'LECTURER' };
            if (rawToken === 'dept-head-token') return { userId: deptHeadId, role: 'LECTURER' };
            if (rawToken === 'admin-token') return { userId: adminId, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        mockUser.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === studentId) {
                return buildUser({
                    id: studentId,
                    role: 'STUDENT',
                    permissions: ['SUBMIT_BM02', 'RENAME_TOPIC', 'BM03_SUBMIT', 'CHECKPOINT_SIGN', 'VIEW_MY_TOPIC'],
                });
            }
            if (where.id === advisorId) {
                return buildUser({
                    id: advisorId,
                    role: 'LECTURER',
                    permissions: ['BM02A_ADVISOR_SIGN', 'BM03_MEETING_RECORD', 'BM03_STAGE_EVALUATE', 'BM04_CREATE_AND_SIGN'],
                });
            }
            if (where.id === deptHeadId) {
                return buildUser({
                    id: deptHeadId,
                    role: 'LECTURER',
                    permissions: ['BM02A_FINAL_APPROVE'],
                });
            }
            if (where.id === adminId) {
                return buildUser({
                    id: adminId,
                    role: 'ADMIN',
                    permissions: [
                        'BM02_REVIEW',
                        'PROJECT_ASSIGNMENT_PUBLISH',
                        'TOPIC_ASSIGNMENT_DECISION_ISSUE',
                        'TITLE_ADJUSTMENT_APPENDIX_ISSUE',
                        'BM03_STOP_REVIEW',
                        'BM04_REVIEW',
                        'BM04_REJECTION_REVIEW',
                        'DEFENSE_COUNCIL_MANAGE',
                    ],
                });
            }
            return null;
        });

        mockElectronicSignatureEvent.create.mockImplementation(async ({ data }) => ({
            id: Math.floor(Math.random() * 10000) + 1,
            ...data,
            signedAt: new Date(),
        }));

        mockIdempotencyRecord.findUnique.mockResolvedValue(null);
        mockIdempotencyRecord.create.mockImplementation(async ({ data }) => ({ id: 1, ...data }));
        mockRegistrationStateHistory.create.mockImplementation(async ({ data }) => ({ id: 1, ...data }));
        mockAuditLog.create.mockImplementation(async ({ data }) => ({ id: 1, ...data }));
        mockAcademicDelegation.findFirst.mockResolvedValue(null);

        baseTopic = {
            id: topicId,
            title: 'Hệ thống AI Phát hiện Sâu bệnh trên Cây trồng',
            mentorId: advisorId,
            mentor: {
                id: advisorId,
                fullName: 'TS. Nguyễn Văn Hướng Dẫn',
                email: 'hd@test.vn',
                department: 'CNTT',
            },
        };

        baseSemester = {
            id: semesterId,
            name: 'Học kỳ 1 2026-2027',
            lockedPolicyVersionId: 12,
        };

        basePolicy = {
            id: 12,
            policy: {
                maxStudents: 1,
                revisionWindowDays: 7,
                bm02MaxResubmissions: 1,
            },
        };

        baseRegistration = {
            id: registrationId,
            studentId,
            topicId,
            semesterId,
            status: 'BM01_PASSED',
            stateVersion: 1,
            periodPolicyVersionId: 12,
            bm01ApprovedTitleSnapshot: 'Hệ thống AI Phát hiện Sâu bệnh trên Cây trồng',
            titleAdjustmentDeadline: null,
            currentBM02SubmissionId: null,
            bm03ProgressRecordId: null,
            outlineCouncilId: null,
            defenseCouncilId: null,
            councilId: null,
            topic: baseTopic,
            semester: baseSemester,
            student: {
                id: studentId,
                fullName: 'Trần Văn Sinh Viên',
                studentCode: 'SV2026001',
                code: 'SV2026001',
                email: 'sv2026001@test.vn',
            },
            archive: {
                id: 99,
                phase: 'PRE_DEFENSE',
                status: 'SUBMITTED',
                reportFileUrl: 'https://example.com/pre-defense-report.pdf',
            },
        };

        mockTopicRegistration.findUnique.mockResolvedValue(baseRegistration);
        mockSemester.findUnique.mockResolvedValue(baseSemester);
        mockPeriodWorkflowPolicyVersion.findUnique.mockResolvedValue(basePolicy);
    });

    // ========================================================================
    // Golden Path: Complete Seamless E2E Walkthrough from BM01 to Defense Council
    // ========================================================================
    describe('Full Golden Path: From BM01_PASSED to Defense Council Assignment', () => {
        test('Full Lifecycle: BM01_PASSED -> BM02 -> Decision -> BM02-A -> Appendix -> BM03 -> BM04 -> Defense Council', async () => {
            // -------------------------------------------------------------
            // Step 1: Registration at BM01_PASSED (AC1)
            // -------------------------------------------------------------
            expect(baseRegistration.status).toBe('BM01_PASSED');
            expect(baseRegistration.bm01ApprovedTitleSnapshot).toBe('Hệ thống AI Phát hiện Sâu bệnh trên Cây trồng');

            // -------------------------------------------------------------
            // Step 2: Student submits BM02 with refined title (AC2)
            // -------------------------------------------------------------
            mockTask.findFirst.mockResolvedValue({ id: 91, registrationId, taskType: 'BM02', status: 'OPEN' });
            mockTask.update.mockResolvedValue({ id: 91, status: 'SUBMITTED' });
            mockBM02Submission.findFirst.mockResolvedValue(null);
            mockBM02Submission.create.mockResolvedValue({
                id: 201,
                registrationId,
                bm01ApprovedTitle: 'Hệ thống AI Phát hiện Sâu bệnh trên Cây trồng',
                bm02ProposedTitle: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp',
                titleChangeReason: 'Làm rõ phạm vi ứng dụng trong nông nghiệp thực tế theo góp ý Hội đồng BM01',
                attemptNo: 1,
                versionNo: 1,
                outcome: 'PENDING_REVIEW',
            });
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });

            const bm02Result = await submitBM02({
                registrationId,
                studentId,
                bm02ProposedTitle: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp',
                titleChangeReason: 'Làm rõ phạm vi ứng dụng trong nông nghiệp thực tế theo góp ý Hội đồng BM01',
                content: 'Kế hoạch triển khai đề tài chi tiết',
                fileUrl: 'https://storage.test/bm02-sv.pdf',
                fileName: 'bm02-sv.pdf',
                idempotencyKey: 'golden-path-bm02-001',
            });

            expect(bm02Result.id).toBe(201);
            expect(mockBM02Submission.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    bm01ApprovedTitle: 'Hệ thống AI Phát hiện Sâu bệnh trên Cây trồng',
                    bm02ProposedTitle: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp',
                }),
            }));

            // -------------------------------------------------------------
            // Step 3: Admin reviews and approves BM02
            // -------------------------------------------------------------
            mockTopicRegistration.findUnique.mockResolvedValue({
                ...baseRegistration,
                status: 'BM02_SUBMITTED',
                currentBM02SubmissionId: 201,
            });
            mockBM02Submission.findUnique.mockResolvedValue({
                id: 201,
                registrationId,
                attemptNo: 1,
                versionNo: 1,
                outcome: 'PENDING_REVIEW',
                policyVersionId: 12,
            });
            mockBM02Submission.update.mockResolvedValue({ id: 201, outcome: 'APPROVED' });
            mockTask.findFirst.mockResolvedValue({ id: 91, registrationId, taskType: 'BM02', status: 'SUBMITTED' });
            mockTask.update.mockResolvedValue({ id: 91, status: 'COMPLETED' });

            const reviewRes = await reviewBM02({
                registrationId,
                reviewerId: adminId,
                action: 'APPROVE',
                targetStatus: 'BM02_APPROVED',
                idempotencyKey: 'golden-path-review-001',
            });

            expect(reviewRes.targetStatus).toBe('BM02_APPROVED');

            // -------------------------------------------------------------
            // Step 4: Admin creates and publishes TopicAssignmentDecision (AC3)
            // -------------------------------------------------------------
            const publishedAt = new Date('2026-11-15T08:00:00.000Z');
            const expected168hDeadline = new Date(publishedAt.getTime() + 168 * 3600 * 1000);

            mockTopicRegistration.findUnique.mockResolvedValue({
                ...baseRegistration,
                status: 'BM02_APPROVED',
                currentBM02SubmissionId: 201,
                currentBM02Submission: {
                    id: 201,
                    outcome: 'APPROVED',
                    bm01ApprovedTitle: 'Hệ thống AI Phát hiện Sâu bệnh trên Cây trồng',
                    bm02ProposedTitle: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp',
                },
            });
            mockTopicAssignmentDecision.findUnique.mockResolvedValue(null);
            mockTopicAssignmentDecision.create.mockResolvedValue({
                id: decisionId,
                semesterId,
                decisionNumber: 'QD-2026-DHQG-01',
                decisionDate: new Date('2026-11-15T00:00:00.000Z'),
                status: 'DRAFT',
            });
            mockTopicAssignmentDecisionItem.findUnique.mockResolvedValue(null);
            mockTopicAssignmentDecisionItem.create.mockResolvedValue({
                id: 777,
                decisionId,
                registrationId,
                approvedTitleSnapshot: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp',
            });

            const createdDecision = await createTopicDecision({
                semesterId,
                decisionNumber: 'QD-2026-DHQG-01',
                decisionDate: new Date('2026-11-15T00:00:00.000Z'),
                registrationIds: [registrationId],
                issuedById: adminId,
                idempotencyKey: 'golden-decision-create',
            });
            expect(createdDecision.id).toBe(decisionId);

            mockTopicAssignmentDecision.findUnique.mockResolvedValue({
                id: decisionId,
                status: 'DRAFT',
                decisionNumber: 'QD-2026-DHQG-01',
                items: [{ registrationId, approvedTitleSnapshot: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp' }],
            });
            mockTopicAssignmentDecision.update.mockResolvedValue({
                id: decisionId,
                status: 'PUBLISHED',
                decisionPublishedAt: publishedAt,
            });
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });

            const publishRes = await publishTopicDecision({
                decisionId,
                publishedById: adminId,
                publishedAt,
                idempotencyKey: 'golden-decision-publish',
            });

            expect(publishRes.status).toBe('PUBLISHED');
            expect(publishRes.titleAdjustmentDeadline).toEqual(expected168hDeadline);
            expect(mockTopicRegistration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({ id: registrationId }),
                data: expect.objectContaining({
                    status: 'DECISION_ISSUED',
                }),
            }));

            // -------------------------------------------------------------
            // Step 5: Student creates BM02-A v1, Advisor returns, Student revises to v2 (AC4)
            // -------------------------------------------------------------
            const validBM02ANow = new Date('2026-11-16T10:00:00.000Z');
            mockTopicRegistration.findUnique.mockResolvedValue({
                ...baseRegistration,
                titleAdjustmentDeadline: expected168hDeadline,
            });
            mockTopicAssignmentDecisionItem.findFirst.mockResolvedValue({
                id: 777,
                decisionId,
                registrationId,
                approvedTitleSnapshot: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp',
                decision: {
                    id: decisionId,
                    decisionNumber: 'QD-2026-DHQG-01',
                    decisionPublishedAt: publishedAt,
                    status: 'PUBLISHED',
                },
            });
            mockBM02AAdjustmentRequest.findFirst.mockResolvedValue(null);
            mockBM02AAdjustmentRequest.create.mockResolvedValue({
                id: bm02aId,
                registrationId,
                studentId,
                advisorId,
                currentVersionNumber: 1,
                registeredTitleSnapshot: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp',
                proposedTitle: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh Cây trồng',
                reason: 'Tập trung chuyên sâu kiến trúc Deep Learning',
                status: 'STUDENT_PREPARING',
                revisionCount: 0,
                titleAdjustmentDeadline: expected168hDeadline,
            });
            mockBM02AFormVersion.create.mockResolvedValue({
                id: 11,
                requestId: bm02aId,
                versionNumber: 1,
                proposedTitle: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh Cây trồng',
                reason: 'Tập trung chuyên sâu kiến trúc Deep Learning',
            });

            const bm02aReq = await createBM02ARequest({
                registrationId,
                studentId,
                proposedTitle: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh Cây trồng',
                reason: 'Tập trung chuyên sâu kiến trúc Deep Learning',
            }, { now: validBM02ANow });

            expect(bm02aReq.id).toBe(bm02aId);
            expect(bm02aReq.revisionCount).toBe(0);

            // Advisor returns v1
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue({
                ...bm02aReq,
                status: 'PENDING_ADVISOR',
                titleAdjustmentDeadline: expected168hDeadline,
                currentVersionNumber: 1,
                registration: {
                    id: registrationId,
                    studentId,
                    topic: {
                        id: baseTopic.id,
                        title: baseTopic.title,
                        mentorId: advisorId,
                        mentor: { id: advisorId, fullName: 'TS. Nguyễn Văn Hướng Dẫn', department: 'CNTT' },
                    },
                },
                versions: [{ id: 11, versionNumber: 1, payloadHash: 'v1-payload-hash-001' }],
            });
            mockBM02AAdjustmentRequest.updateMany.mockResolvedValue({ count: 1 });
            mockBM02AFormVersion.update.mockResolvedValue({});

            await returnBM02A({
                requestId: bm02aId,
                actorId: advisorId,
                actorRole: 'ADVISOR',
                reason: 'Cần nêu rõ đối tượng cây ăn quả trong tên đề tài',
            }, { now: validBM02ANow });

            // Student revises to v2 (revisionCount = 0 -> 1)
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue({
                id: bm02aId,
                registrationId,
                studentId,
                advisorId,
                status: 'RETURNED_FOR_CORRECTION',
                revisionCount: 0,
                currentVersionNumber: 1,
                titleAdjustmentDeadline: expected168hDeadline,
                registeredTitleSnapshot: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp',
                registration: { id: registrationId, studentId, topic: baseTopic },
                versions: [{ id: 11, versionNumber: 1, payloadHash: 'v1-payload-hash-001' }],
            });
            mockBM02AAdjustmentRequest.updateMany.mockResolvedValue({ count: 1 });
            mockBM02AFormVersion.create.mockResolvedValue({
                id: 12,
                requestId: bm02aId,
                versionNumber: 2,
                proposedTitle: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh trên Cây ăn quả',
            });

            const v2Result = await reviseBM02A({
                requestId: bm02aId,
                studentId,
                proposedTitle: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh trên Cây ăn quả',
                reason: 'Đã bổ sung đối tượng cụ thể là cây ăn quả theo yêu cầu của GVHD',
            }, { now: validBM02ANow });

            expect(v2Result.newVersion.versionNumber).toBe(2);
            expect(mockBM02AAdjustmentRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    revisionCount: 1,
                    currentVersionNumber: 2,
                }),
            }));

            // -------------------------------------------------------------
            // Step 6: Three internal signatures on BM02-A v2 (AC5)
            // -------------------------------------------------------------
            const v2VersionPayload = {
                registrationId,
                versionNumber: 2,
                registeredTitleSnapshot: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp',
                proposedTitle: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh trên Cây ăn quả',
                reason: 'Đã bổ sung đối tượng cụ thể là cây ăn quả theo yêu cầu của GVHD',
                studentSnapshot: {},
            };
            const v2CanonicalHash = computeCanonicalPayloadHash(v2VersionPayload);

            const currentV2Request = {
                id: bm02aId,
                registrationId,
                studentId,
                advisorId,
                currentVersionNumber: 2,
                registeredTitleSnapshot: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp',
                proposedTitle: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh trên Cây ăn quả',
                reason: 'Đã bổ sung đối tượng cụ thể là cây ăn quả theo yêu cầu của GVHD',
                titleAdjustmentDeadline: expected168hDeadline,
                studentNameSnapshot: 'Trần Văn Sinh Viên',
                studentCodeSnapshot: 'SV2026001',
                versions: [{
                    id: 12,
                    versionNumber: 2,
                    registeredTitleSnapshot: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp',
                    proposedTitle: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh trên Cây ăn quả',
                    reason: 'Đã bổ sung đối tượng cụ thể là cây ăn quả theo yêu cầu của GVHD',
                    studentSnapshot: {},
                    payloadHash: v2CanonicalHash,
                }],
                registration: { id: registrationId, studentId, topic: baseTopic },
            };

            // 1) Student signs
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue({
                ...currentV2Request,
                status: 'STUDENT_PREPARING',
            });
            mockBM02AAdjustmentRequest.updateMany.mockResolvedValue({ count: 1 });
            mockBM02AAdjustmentRequest.update.mockResolvedValue({
                ...currentV2Request,
                status: 'PENDING_ADVISOR',
            });
            mockBM02AFormVersion.update.mockResolvedValue({});

            const studentSignRes = await studentSignAndSubmitBM02A({
                requestId: bm02aId,
                studentId,
            }, { now: validBM02ANow });
            expect(studentSignRes.status).toBe('PENDING_ADVISOR');

            // 2) Advisor signs
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue({
                ...currentV2Request,
                status: 'PENDING_ADVISOR',
            });
            mockBM02AAdjustmentRequest.update.mockResolvedValue({
                ...currentV2Request,
                status: 'PENDING_DEPARTMENT_APPROVAL',
            });
            const advisorSignRes = await advisorSignBM02A({
                requestId: bm02aId,
                advisorId,
            }, { now: validBM02ANow });
            expect(advisorSignRes.status).toBe('PENDING_DEPARTMENT_APPROVAL');

            // 3) Department Head signs
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue({
                ...currentV2Request,
                status: 'PENDING_DEPARTMENT_APPROVAL',
            });
            mockBM02AAdjustmentRequest.update.mockResolvedValue({
                ...currentV2Request,
                status: 'APPROVED_PENDING_APPENDIX',
                finalPayloadHash: v2CanonicalHash,
            });

            const deptSignRes = await departmentSignBM02A({
                requestId: bm02aId,
                departmentHeadId: deptHeadId,
            }, { now: validBM02ANow });
            expect(deptSignRes.status).toBe('APPROVED_PENDING_APPENDIX');

            // -------------------------------------------------------------
            // Step 7: Batch Title Adjustment Appendix & Effective Date (AC6, AC15)
            // -------------------------------------------------------------
            const appendixSignedDate = new Date('2026-11-20T00:00:00.000Z');
            mockTopicAssignmentDecision.findUnique.mockResolvedValue({
                id: decisionId,
                status: 'PUBLISHED',
                decisionNumber: 'QD-2026-DHQG-01',
            });
            mockTitleAdjustmentAppendixItem.findFirst.mockResolvedValue(null);
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([{
                id: bm02aId,
                registrationId,
                status: 'APPROVED_PENDING_APPENDIX',
                registeredTitleSnapshot: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp',
                proposedTitle: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh trên Cây ăn quả',
                currentVersionNumber: 2,
                versions: [{
                    id: 12,
                    versionNumber: 2,
                    proposedTitle: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh trên Cây ăn quả',
                }],
            }]);
            mockTitleAdjustmentAppendix.count.mockResolvedValue(0);
            mockTitleAdjustmentAppendix.create.mockResolvedValue({
                id: appendixId,
                decisionId,
                appendixNumber: 'PL-01/QD-2026',
                sequenceNo: 1,
                signedDate: appendixSignedDate,
                status: 'DRAFT',
            });

            const draftAppx = await createAppendixDraft({
                decisionId,
                appendixNumber: 'PL-01/QD-2026',
                signedDate: appendixSignedDate,
                bm02aRequestIds: [bm02aId],
                issuedById: adminId,
            });
            expect(draftAppx.status).toBe('DRAFT');

            mockTitleAdjustmentAppendix.findUnique.mockResolvedValue({
                id: appendixId,
                status: 'DRAFT',
                decisionId,
                items: [{
                    id: 101,
                    bm02aRequestId: bm02aId,
                    registrationId,
                    newTitle: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh trên Cây ăn quả',
                }],
            });
            mockTitleAdjustmentAppendix.update.mockResolvedValue({
                id: appendixId,
                status: 'ISSUED',
                signedDate: appendixSignedDate,
            });
            mockTopicRegistration.update.mockResolvedValue({});

            const issuedAppx = await issueAppendix({
                appendixId,
                issuerId: adminId,
            });
            expect(issuedAppx.status).toBe('ISSUED');

            // Verify resolveEffectiveTopicTitle before vs after signedDate
            mockTitleAdjustmentAppendixItem.findFirst.mockImplementation(async ({ where }) => {
                if (where.appendix.signedDate.lte >= appendixSignedDate) {
                    return {
                        id: 101,
                        newTitle: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh trên Cây ăn quả',
                        appendix: {
                            id: appendixId,
                            appendixNumber: 'PL-01/QD-2026',
                            sequenceNo: 1,
                            signedDate: appendixSignedDate,
                            status: 'ISSUED',
                        },
                    };
                }
                return null;
            });

            mockTopicAssignmentDecisionItem.findFirst.mockResolvedValue({
                id: 777,
                approvedTitleSnapshot: 'Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp',
                decision: {
                    id: decisionId,
                    decisionNumber: 'QD-2026-DHQG-01',
                    decisionDate: new Date('2026-11-15T00:00:00Z'),
                    decisionPublishedAt: publishedAt,
                    status: 'PUBLISHED',
                },
            });

            // Before signedDate: original title from Decision
            const titleBefore = await resolveEffectiveTopicTitle(registrationId, new Date('2026-11-18T00:00:00Z'));
            expect(titleBefore.title).toBe('Nghiên cứu và Ứng dụng AI Phát hiện Sâu bệnh Nông nghiệp');
            expect(titleBefore.source).toBe('DECISION');

            // At or after signedDate: new title from Appendix
            const titleAfter = await resolveEffectiveTopicTitle(registrationId, new Date('2026-11-21T00:00:00Z'));
            expect(titleAfter.title).toBe('Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh trên Cây ăn quả');
            expect(titleAfter.source).toBe('APPENDIX');

            // -------------------------------------------------------------
            // Step 8: Advisor logs & locks BM03 meeting entry (AC7)
            // -------------------------------------------------------------
            const baseBM03Record = {
                id: bm03RecordId,
                registrationId,
                effectiveTitleSnapshot: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh trên Cây ăn quả',
                finalConclusion: null,
                isClosedEarly: false,
                advisorSignedById: null,
                advisorSignedAt: null,
                advisorPayloadHash: 'canonical-bm03-advisor-hash-999',
                studentAckStatus: null,
                meetings: [],
                stageEvaluations: [],
                stopReviews: [],
                registration: {
                    ...baseRegistration,
                    status: 'IN_PROGRESS_BM03',
                },
            };

            mockBM03ProgressRecord.findUnique.mockResolvedValue(baseBM03Record);
            mockBM03ProgressRecord.findFirst.mockResolvedValue(baseBM03Record);

            mockBM03MeetingEntry.create.mockResolvedValue({
                id: 301,
                bm03RecordId,
                registrationId,
                meetingDate: new Date('2026-11-25T08:00:00Z'),
                meetingType: 'IN_PERSON',
                location: 'Văn phòng Bộ môn CNTT',
                content: 'Bàn giao kiến trúc mô hình YOLOv8 và bộ dữ liệu cây có múi',
                progressRating: 'ON_TRACK',
                isLocked: false,
            });

            const meeting = await createBM03Meeting({
                registrationId,
                advisorId,
                meetingDate: new Date('2026-11-25T08:00:00Z'),
                meetingMode: 'IN_PERSON',
                locationOrLink: 'Văn phòng Bộ môn CNTT',
                discussionContent: 'Bàn giao kiến trúc mô hình YOLOv8 và bộ dữ liệu cây có múi',
                studentCompletedWork: 'Thu thập 1500 ảnh lá cây cam, quýt, bưởi',
                remainingIssues: 'Dữ liệu thiếu nhãn một số loại sâu ăn lá',
                nextTasks: 'Gán nhãn phần ảnh còn lại và train baseline YOLOv8',
                expectedDeadline: new Date('2026-12-05T08:00:00Z'),
                progressRating: 'ON_TRACK',
            });

            expect(meeting.id).toBe(301);

            mockBM03MeetingEntry.findUnique.mockResolvedValue({
                id: 301,
                bm03RecordId,
                registrationId,
                isLocked: false,
                bm03Record: baseBM03Record,
                registration: {
                    id: registrationId,
                    topic: { mentorId: advisorId },
                },
            });
            mockBM03MeetingEntry.update.mockResolvedValue({
                id: 301,
                isLocked: true,
                advisorLockedAt: new Date(),
                advisorSignatureEventId: 444,
            });

            const lockedMeeting = await signBM03Meeting({
                meetingId: 301,
                advisorId,
            });

            expect(lockedMeeting.isLocked).toBe(true);
            expect(lockedMeeting.advisorSignatureEventId).toBeDefined();

            // -------------------------------------------------------------
            // Step 9: Advisor submits Midterm (CONTINUE) & Final (CONTINUE_TO_BM04)
            // -------------------------------------------------------------
            mockBM03StageEvaluation.findFirst.mockResolvedValue(null);
            mockBM03StageEvaluation.create.mockResolvedValue({
                id: 401,
                bm03RecordId,
                stage: 'MIDTERM',
                evaluationResult: 'CONTINUE',
                comments: 'Tiến độ rất tốt, đã hoàn thiện module thu thập ảnh',
            });
            mockBM03ProgressRecord.update.mockResolvedValue({
                ...baseBM03Record,
                midtermStageEvaluationId: 401,
            });

            const midtermEval = await submitStageEvaluation({
                registrationId,
                advisorId,
                stage: 'MIDTERM',
                decision: 'CONTINUE',
                comments: 'Tiến độ rất tốt, đã hoàn thiện module thu thập ảnh',
            });
            expect(midtermEval.stageEvaluation.evaluationResult).toBe('CONTINUE');

            mockBM03StageEvaluation.create.mockResolvedValue({
                id: 402,
                bm03RecordId,
                stage: 'FINAL',
                evaluationResult: 'CONTINUE_TO_BM04',
                comments: 'Đã hoàn thiện toàn bộ mô hình và kiểm thử đạt độ chính xác 94%',
            });
            mockBM03ProgressRecord.update.mockResolvedValue({
                ...baseBM03Record,
                finalStageEvaluationId: 402,
                finalConclusion: 'CONTINUE_TO_BM04',
            });

            const finalEval = await submitStageEvaluation({
                registrationId,
                advisorId,
                stage: 'FINAL',
                decision: 'CONTINUE_TO_BM04',
                comments: 'Đã hoàn thiện toàn bộ mô hình và kiểm thử đạt độ chính xác 94%',
            });
            expect(finalEval.stageEvaluation.evaluationResult).toBe('CONTINUE_TO_BM04');

            // -------------------------------------------------------------
            // Step 10: Advisor signs whole BM03 & Student acknowledges (AC11)
            // -------------------------------------------------------------
            const wholeSignTime = new Date('2026-11-28T10:00:00Z');
            const expected48hStudentAckDeadline = new Date(wholeSignTime.getTime() + 48 * 3600 * 1000);

            mockBM03ProgressRecord.findUnique.mockResolvedValue({
                ...baseBM03Record,
                finalConclusion: 'CONTINUE_TO_BM04',
                advisorSignedById: null,
            });
            mockBM03ProgressRecord.update.mockResolvedValue({
                ...baseBM03Record,
                advisorSignedById: advisorId,
                advisorSignedAt: wholeSignTime,
                studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
                studentAckDeadlineAt: expected48hStudentAckDeadline,
            });

            const wholeBM03SignRes = await advisorSignWholeBM03({
                registrationId,
                advisorId,
            }, { now: wholeSignTime });

            expect(wholeBM03SignRes.studentAckStatus).toBe('PENDING_STUDENT_ACKNOWLEDGEMENT');
            expect(wholeBM03SignRes.studentAckDeadlineAt).toEqual(expected48hStudentAckDeadline);

            // Student acknowledges within 48h
            mockBM03ProgressRecord.findUnique.mockResolvedValue({
                ...baseBM03Record,
                advisorSignedById: advisorId,
                finalConclusion: 'CONTINUE_TO_BM04',
                studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
                studentAckDeadlineAt: expected48hStudentAckDeadline,
            });
            mockBM03ProgressRecord.update.mockResolvedValue({
                ...baseBM03Record,
                studentAckStatus: 'ACKNOWLEDGED_WITH_COMMENT',
            });
            mockTopicRegistration.update.mockResolvedValue({});
            mockTask.findFirst.mockResolvedValue(null);
            mockTask.create.mockResolvedValue({ id: 991, taskType: 'BM04', status: 'OPEN' });

            const ackRes = await studentAcknowledgeBM03({
                bm03RecordId,
                studentId,
                action: 'ACKNOWLEDGED_WITH_COMMENT',
                comment: 'Em xin cảm ơn thầy đã tận tình hướng dẫn.',
            }, { now: new Date('2026-11-29T08:00:00Z') });

            expect(ackRes.studentAckStatus).toBe('ACKNOWLEDGED_WITH_COMMENT');
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: registrationId },
                data: { status: 'BM03_PASSED' },
            }));
            expect(mockTask.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    registrationId,
                    taskType: 'BM04',
                    status: 'OPEN',
                }),
            }));

            // -------------------------------------------------------------
            // Step 11: Advisor evaluates BM04 with APPROVE_FOR_DEFENSE (AC12, AC13)
            // -------------------------------------------------------------
            mockTopicRegistration.findUnique.mockResolvedValue({
                ...baseRegistration,
                status: 'BM03_PASSED',
                archive: {
                    id: 99,
                    phase: 'PRE_DEFENSE',
                    status: 'SUBMITTED',
                    reportFileUrl: 'https://example.com/pre-defense-report.pdf',
                },
            });
            mockBM04Evaluation.findUnique.mockResolvedValue(null);
            mockBM04Evaluation.upsert.mockResolvedValue({
                id: 55,
                registrationId,
                status: 'SIGNED_APPROVED',
                isLocked: true,
                conclusion: 'AGREED_FOR_DEFENSE',
                programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: 'APPROVE_FOR_DEFENSE',
            });
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTask.updateMany.mockResolvedValue({ count: 1 });

            const bm04SignRes = await signAndSubmitBM04({
                registrationId,
                advisorId,
                thesisFormatScore: 'Đạt chuẩn xuất sắc',
                researchContentScore: 'Đầy đủ cơ sở lý thuyết, thử nghiệm kỹ lưỡng trên 5 loại sâu bệnh',
                applicabilityScore: 'Khả năng ứng dụng thực địa cao',
                attitudeScore: 'Nghiêm túc, chủ động, hoàn thành đúng hạn',
                programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: 'APPROVE_FOR_DEFENSE',
                lecturerSignature: 'TS. Nguyễn Văn Hướng Dẫn',
            });

            expect(bm04SignRes.status).toBe('SIGNED_APPROVED');
            expect(mockTopicRegistration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: registrationId },
                data: expect.objectContaining({ status: 'DEFENSE_READY' }),
            }));
            expect(mockTask.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { registrationId, taskType: 'BM04' },
                data: { status: 'COMPLETED' },
            }));

            // -------------------------------------------------------------
            // Step 12: Admin assigns student to Defense Council via HTTP Supertest
            // -------------------------------------------------------------
            mockCouncil.findUnique.mockResolvedValue({
                id: defenseCouncilId,
                name: 'Hội đồng Chấm Bảo vệ Đồ án Tốt nghiệp CNTT 01',
                councilType: 'DEFENSE_COUNCIL',
                semesterId,
                members: [
                    { lecturerId: councilChairId, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: councilSecId, roleInCouncil: 'SECRETARY' },
                    { lecturerId: councilRevId, roleInCouncil: 'REVIEWER' },
                ],
                _count: {
                    registrations: 0,
                    outlineRegistrations: 0,
                    defenseRegistrations: 0,
                },
            });

            mockTopicRegistration.findMany.mockResolvedValue([
                {
                    id: registrationId,
                    status: 'DEFENSE_READY',
                    outlineCouncilId: null,
                    defenseCouncilId: null,
                    student: { fullName: 'Trần Văn Sinh Viên', code: 'SV2026001' },
                    topic: { title: 'Nghiên cứu Deep Learning trong Phát hiện Sâu bệnh trên Cây ăn quả', mentorId: advisorId },
                    bm04Evaluation: {
                        id: 55,
                        status: 'SIGNED_APPROVED',
                        conclusion: 'AGREED_FOR_DEFENSE',
                        isLocked: true,
                    },
                },
            ]);
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });

            const assignResponse = await request(app)
                .post(`/api/councils/${defenseCouncilId}/assign`)
                .set('Authorization', 'Bearer admin-token')
                .send({
                    registrationIds: [registrationId],
                });

            expect(assignResponse.status).toBe(200);
            expect(assignResponse.body.success).toBe(true);
            expect(mockTopicRegistration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: { in: [registrationId] } },
                data: expect.objectContaining({
                    defenseCouncilId,
                    councilId: defenseCouncilId,
                }),
            }));
        });
    });

    // ========================================================================
    // AC1: BM02 Opening & Locked Semester Policy
    // ========================================================================
    describe('AC1: BM02 Opening & Locked Semester Policy Enforcement', () => {
        test('rejects submitBM02 when registration is NOT in BM01_PASSED state', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                ...baseRegistration,
                status: 'BM01_SUBMITTED', // not passed!
            });

            await expect(submitBM02({
                registrationId,
                studentId,
                content: 'Nội dung kế hoạch BM02',
                fileUrl: 'https://storage.test/bm02.pdf',
                fileName: 'bm02.pdf',
                idempotencyKey: 'idemp-bm02-ac1-001',
            })).rejects.toMatchObject({
                code: 'INVALID_TRANSITION',
            });
        });

        test('strictly requires periodPolicyVersionId and rejects missing workflow policy with WORKFLOW_POLICY_REQUIRED', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                ...baseRegistration,
                status: 'BM01_PASSED',
                periodPolicyVersionId: null, // missing locked policy version!
            });

            await expect(submitBM02({
                registrationId,
                studentId,
                content: 'Nội dung kế hoạch BM02',
                fileUrl: 'https://storage.test/bm02.pdf',
                fileName: 'bm02.pdf',
                idempotencyKey: 'idemp-bm02-ac1-002',
            })).rejects.toMatchObject({
                code: 'WORKFLOW_POLICY_REQUIRED',
            });
        });
    });

    // ========================================================================
    // AC2: BM02 Title Refinement & Snapshot Isolation
    // ========================================================================
    describe('AC2: BM02 Title Refinement & Snapshot Isolation', () => {
        test('allows bm02ProposedTitle different from bm01ApprovedTitle without mutating registration snapshot', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                ...baseRegistration,
                status: 'BM01_PASSED',
                bm01ApprovedTitleSnapshot: 'Tên đề tài BM01 ban đầu',
            });
            mockBM02Submission.findFirst.mockResolvedValue(null);
            mockBM02Submission.create.mockResolvedValue({ id: 203 });
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTask.findFirst.mockResolvedValue(null);

            await submitBM02({
                registrationId,
                studentId,
                bm02ProposedTitle: 'Tên đề tài BM02 đã tinh chỉnh',
                titleChangeReason: 'Tinh chỉnh cách diễn đạt cho rõ nghĩa theo góp ý của Hội đồng BM01',
                fileUrl: 'https://storage.test/bm02.pdf',
                fileName: 'bm02.pdf',
                idempotencyKey: 'idemp-bm02-ac2-001',
            });

            expect(mockBM02Submission.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    bm01ApprovedTitle: 'Tên đề tài BM01 ban đầu',
                    bm02ProposedTitle: 'Tên đề tài BM02 đã tinh chỉnh',
                    titleChangeReason: 'Tinh chỉnh cách diễn đạt cho rõ nghĩa theo góp ý của Hội đồng BM01',
                }),
            }));

            // Verify topic registration update does NOT overwrite bm01ApprovedTitleSnapshot
            expect(mockTopicRegistration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({ id: registrationId }),
                data: expect.not.objectContaining({
                    bm01ApprovedTitleSnapshot: 'Tên đề tài BM02 đã tinh chỉnh',
                }),
            }));
        });

        test('rejects title change when titleChangeReason is omitted', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                ...baseRegistration,
                status: 'BM01_PASSED',
                bm01ApprovedTitleSnapshot: 'Tên đề tài BM01 ban đầu',
            });

            await expect(submitBM02({
                registrationId,
                studentId,
                bm02ProposedTitle: 'Tên đề tài BM02 khác biệt',
                titleChangeReason: '', // missing reason!
                fileUrl: 'https://storage.test/bm02.pdf',
                fileName: 'bm02.pdf',
                idempotencyKey: 'idemp-bm02-ac2-002',
            })).rejects.toMatchObject({
                code: 'TITLE_CHANGE_REASON_REQUIRED',
            });
        });
    });

    // ========================================================================
    // AC3: BM02-A 168-Hour Window Calculation
    // ========================================================================
    describe('AC3: BM02-A Adjustment Window (168h from decisionPublishedAt)', () => {
        test('sets titleAdjustmentDeadline to exactly decisionPublishedAt + 168h when publishing decision', async () => {
            const pubDate = new Date('2026-11-10T14:00:00.000Z');
            const expectedDeadline = new Date(pubDate.getTime() + 168 * 3600 * 1000);

            mockTopicAssignmentDecision.findUnique.mockResolvedValue({
                id: decisionId,
                status: 'DRAFT',
                decisionNumber: 'QD-2026-001',
                items: [{ registrationId }],
            });
            mockTopicAssignmentDecision.update.mockResolvedValue({ id: decisionId, status: 'PUBLISHED' });
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });

            const result = await publishTopicDecision({
                decisionId,
                publishedById: adminId,
                publishedAt: pubDate,
                idempotencyKey: 'publish-topic-dec-ac3-001',
            });

            expect(result.titleAdjustmentDeadline).toEqual(expectedDeadline);
            expect(mockTopicRegistration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({ id: registrationId }),
                data: expect.objectContaining({
                    status: 'DECISION_ISSUED',
                }),
            }));
        });

        test('rejects createBM02ARequest if current time exceeds 168h window', async () => {
            const pubDate = new Date('2026-11-01T08:00:00Z');
            const deadline = new Date(pubDate.getTime() + 168 * 3600 * 1000); // 2026-11-08T08:00:00Z
            const afterDeadline = new Date(deadline.getTime() + 1000); // 1s past deadline

            mockTopicRegistration.findUnique.mockResolvedValue({
                ...baseRegistration,
                titleAdjustmentDeadline: deadline,
            });

            await expect(createBM02ARequest({
                registrationId,
                studentId,
                proposedTitle: 'Tên mới sau hạn',
                reason: 'Lý do gửi trễ',
            }, { now: afterDeadline })).rejects.toMatchObject({
                code: 'TITLE_ADJUSTMENT_WINDOW_CLOSED',
                statusCode: 409,
            });
        });
    });

    // ========================================================================
    // AC4: BM02-A Maximum 2 Versions & Signature Reset
    // ========================================================================
    describe('AC4: BM02-A Maximum 2 Versions & Signature Invalidation on Revision', () => {
        test('allows revision from v1 to v2 with revisionCount increment', async () => {
            const now = new Date('2026-11-12T00:00:00Z');
            const deadline = new Date(now.getTime() + 100000);

            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue({
                id: bm02aId,
                registrationId,
                studentId,
                advisorId,
                status: 'RETURNED_FOR_CORRECTION',
                revisionCount: 0, // ready for v2
                currentVersionNumber: 1,
                titleAdjustmentDeadline: deadline,
                registeredTitleSnapshot: 'Tên gốc',
                registration: { id: registrationId, studentId, topic: baseTopic },
                versions: [{ id: 11, versionNumber: 1, payloadHash: 'v1-payload-hash-001' }],
            });
            mockBM02AAdjustmentRequest.updateMany.mockResolvedValue({ count: 1 });
            mockBM02AFormVersion.create.mockResolvedValue({
                id: 12,
                requestId: bm02aId,
                versionNumber: 2,
            });

            const revised = await reviseBM02A({
                requestId: bm02aId,
                studentId,
                proposedTitle: 'Tên đề tài đã chỉnh sửa lần 2',
                reason: 'Chỉnh sửa theo góp ý của GVHD',
            }, { now });

            expect(revised.newVersion.versionNumber).toBe(2);
            expect(mockBM02AAdjustmentRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    revisionCount: 1,
                    currentVersionNumber: 2,
                }),
            }));
        });

        test('rejects 3rd revision when revisionCount is already 1 with REVISION_LIMIT_EXCEEDED', async () => {
            const now = new Date('2026-11-12T00:00:00Z');
            const deadline = new Date(now.getTime() + 100000);

            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue({
                id: bm02aId,
                registrationId,
                studentId,
                advisorId,
                status: 'RETURNED_FOR_CORRECTION',
                revisionCount: 1, // quota already exhausted!
                currentVersionNumber: 2,
                titleAdjustmentDeadline: deadline,
                registeredTitleSnapshot: 'Tên gốc',
                registration: { id: registrationId, studentId, topic: baseTopic },
                versions: [{ id: 11, versionNumber: 1 }, { id: 12, versionNumber: 2 }],
            });
            mockBM02AAdjustmentRequest.updateMany.mockResolvedValue({ count: 0 }); // fails condition update!

            await expect(reviseBM02A({
                requestId: bm02aId,
                studentId,
                proposedTitle: 'Tên đề tài lần 3',
                reason: 'Thử sửa lần 3',
            }, { now })).rejects.toMatchObject({
                code: 'REVISION_LIMIT_EXCEEDED',
                statusCode: 409,
            });
        });
    });

    // ========================================================================
    // AC5: BM02-A Three Internal Signatures & Matching Payload Hash
    // ========================================================================
    describe('AC5: BM02-A Three Internal Signatures & Matching Payload Hash', () => {
        test('enforces strict 3-step sequence: Student -> Advisor -> Department Head', async () => {
            const now = new Date('2026-11-12T00:00:00Z');
            const deadline = new Date(now.getTime() + 100000);

            // Dept Head cannot sign while still in STUDENT_PREPARING
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue({
                id: bm02aId,
                status: 'STUDENT_PREPARING',
                titleAdjustmentDeadline: deadline,
                advisorId,
                currentVersionNumber: 1,
                versions: [{ id: 11, versionNumber: 1, payloadHash: 'hash-v1' }],
            });

            await expect(departmentSignBM02A({
                requestId: bm02aId,
                departmentHeadId: deptHeadId,
            }, { now })).rejects.toMatchObject({
                code: 'INVALID_STATUS_FOR_DEPARTMENT_SIGN',
                statusCode: 409,
            });

            // Dept Head cannot sign while in PENDING_ADVISOR
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue({
                id: bm02aId,
                status: 'PENDING_ADVISOR',
                titleAdjustmentDeadline: deadline,
                advisorId,
                currentVersionNumber: 1,
                versions: [{ id: 11, versionNumber: 1, payloadHash: 'hash-v1' }],
            });

            await expect(departmentSignBM02A({
                requestId: bm02aId,
                departmentHeadId: deptHeadId,
            }, { now })).rejects.toMatchObject({
                code: 'INVALID_STATUS_FOR_DEPARTMENT_SIGN',
                statusCode: 409,
            });
        });

        test('generates sealed academic PDF with finalPayloadHash upon Department Head approval', async () => {
            const now = new Date('2026-11-12T00:00:00Z');
            const deadline = new Date(now.getTime() + 100000);

            const v1Payload = {
                registrationId,
                versionNumber: 1,
                registeredTitleSnapshot: 'Tên cũ',
                proposedTitle: 'Tên mới',
                reason: 'Lý do đổi',
                studentSnapshot: {},
            };
            const v1CanonicalHash = computeCanonicalPayloadHash(v1Payload);

            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue({
                id: bm02aId,
                registrationId,
                studentId,
                advisorId,
                status: 'PENDING_DEPARTMENT_APPROVAL',
                currentVersionNumber: 1,
                registeredTitleSnapshot: 'Tên cũ',
                proposedTitle: 'Tên mới',
                reason: 'Lý do đổi',
                titleAdjustmentDeadline: deadline,
                studentNameSnapshot: 'Sinh Viên A',
                studentCodeSnapshot: 'SV01',
                versions: [{
                    id: 11,
                    versionNumber: 1,
                    registeredTitleSnapshot: 'Tên cũ',
                    proposedTitle: 'Tên mới',
                    reason: 'Lý do đổi',
                    studentSnapshot: {},
                    payloadHash: v1CanonicalHash,
                }],
                registration: { id: registrationId, topic: baseTopic },
            });
            mockBM02AAdjustmentRequest.updateMany.mockResolvedValue({ count: 1 });
            mockBM02AFormVersion.update.mockResolvedValue({});
            mockBM02AAdjustmentRequest.update.mockResolvedValue({
                id: bm02aId,
                status: 'APPROVED_PENDING_APPENDIX',
                finalPayloadHash: v1CanonicalHash,
            });

            const result = await departmentSignBM02A({
                requestId: bm02aId,
                departmentHeadId: deptHeadId,
            }, { now });

            expect(result.status).toBe('APPROVED_PENDING_APPENDIX');
            expect(mockGenerateImmutableAcademicPdf).toHaveBeenCalledWith(expect.objectContaining({
                docType: 'BM02A',
            }), expect.anything());
        });
    });

    // ========================================================================
    // AC6: Multiple Title Adjustment Appendices & Effective Date Resolution
    // ========================================================================
    describe('AC6: Multiple Title Adjustment Appendices & Effective Date Resolution', () => {
        test('allows multiple appendices per decision batch with unique sequenceNo', async () => {
            mockTopicAssignmentDecision.findUnique.mockResolvedValue({
                id: decisionId,
                status: 'PUBLISHED',
                decisionNumber: 'QD-2026-001',
            });
            mockTitleAdjustmentAppendixItem.findFirst.mockResolvedValue(null);
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([{
                id: bm02aId,
                registrationId,
                status: 'APPROVED_PENDING_APPENDIX',
                registeredTitleSnapshot: 'Tên cũ',
                proposedTitle: 'Tên mới',
                currentVersionNumber: 1,
                versions: [{
                    id: 11,
                    versionNumber: 1,
                    proposedTitle: 'Tên mới',
                }],
            }]);
            mockTitleAdjustmentAppendix.count.mockResolvedValue(1); // 1 existing appendix
            mockTitleAdjustmentAppendix.create.mockResolvedValue({
                id: 902,
                decisionId,
                appendixNumber: 'PL-02/QD-2026',
                sequenceNo: 2,
                status: 'DRAFT',
            });

            const appx2 = await createAppendixDraft({
                decisionId,
                appendixNumber: 'PL-02/QD-2026',
                signedDate: new Date('2026-11-22T00:00:00Z'),
                bm02aRequestIds: [bm02aId],
                issuedById: adminId,
            });

            expect(appx2.id).toBe(902);
            expect(appx2.sequenceNo).toBe(2);
        });

        test('effective title switches from decision title to appendix title exactly on signedDate', async () => {
            const signedDate = new Date('2026-11-20T00:00:00.000Z');

            mockTitleAdjustmentAppendixItem.findFirst.mockImplementation(async ({ where }) => {
                if (where.appendix.signedDate.lte >= signedDate) {
                    return {
                        id: 1,
                        newTitle: 'Tên mới sau phụ lục',
                        appendix: {
                            id: appendixId,
                            appendixNumber: 'PL-01',
                            sequenceNo: 1,
                            signedDate,
                            status: 'ISSUED',
                        },
                    };
                }
                return null;
            });

            mockTopicAssignmentDecisionItem.findFirst.mockResolvedValue({
                id: 2,
                approvedTitleSnapshot: 'Tên gốc theo quyết định',
                decision: {
                    id: decisionId,
                    decisionNumber: 'QD-2026',
                    decisionDate: new Date('2026-11-15T00:00:00Z'),
                    decisionPublishedAt: new Date('2026-11-15T00:00:00Z'),
                    status: 'PUBLISHED',
                },
            });

            // 1 minute before signedDate
            const titleBefore = await resolveEffectiveTopicTitle(registrationId, new Date('2026-11-19T23:59:00Z'));
            expect(titleBefore.title).toBe('Tên gốc theo quyết định');
            expect(titleBefore.source).toBe('DECISION');

            // Exactly on signedDate
            const titleAt = await resolveEffectiveTopicTitle(registrationId, signedDate);
            expect(titleAt.title).toBe('Tên mới sau phụ lục');
            expect(titleAt.source).toBe('APPENDIX');
        });
    });

    // ========================================================================
    // AC7: BM03 Meeting Entries: Advisor Lock Signature Only
    // ========================================================================
    describe('AC7: BM03 Meeting Entries: Advisor Lock Signature Only', () => {
        test('meeting entry requires only Advisor signature and locks permanently', async () => {
            mockBM03MeetingEntry.findUnique.mockResolvedValue({
                id: 302,
                bm03RecordId,
                registrationId,
                isLocked: false,
                bm03Record: {
                    id: bm03RecordId,
                    registrationId,
                    registration: baseRegistration,
                },
                registration: {
                    id: registrationId,
                    topic: { mentorId: advisorId },
                },
            });
            mockBM03MeetingEntry.update.mockResolvedValue({
                id: 302,
                isLocked: true,
                advisorLockedAt: new Date(),
                advisorSignatureEventId: 555,
            });

            const locked = await signBM03Meeting({
                meetingId: 302,
                advisorId,
            });

            expect(locked.isLocked).toBe(true);
            expect(locked.advisorSignatureEventId).toBe(555);

            // Re-signing locked meeting entry returns already locked meeting (idempotent, Advisor-only lock)
            mockBM03MeetingEntry.findUnique.mockResolvedValue({
                id: 302,
                bm03RecordId,
                registrationId,
                isLocked: true, // already locked
                bm03Record: { id: bm03RecordId, registrationId, registration: baseRegistration },
                registration: { id: registrationId, topic: { mentorId: advisorId } },
            });

            const reLocked = await signBM03Meeting({
                meetingId: 302,
                advisorId,
            });
            expect(reLocked.isLocked).toBe(true);
        });
    });

    // ========================================================================
    // AC8: BM03 PROPOSE_STOP Pending Institute Review Does NOT Terminate Student
    // ========================================================================
    describe('AC8: BM03 PROPOSE_STOP Pending Institute Review Does NOT Terminate Student', () => {
        test('PROPOSE_STOP creates InstituteStopReview but preserves registration active status', async () => {
            mockBM03ProgressRecord.findUnique.mockResolvedValue({
                id: bm03RecordId,
                registrationId,
                finalConclusion: null,
                registration: { ...baseRegistration, status: 'IN_PROGRESS_BM03' },
            });
            mockBM03StageEvaluation.findFirst.mockResolvedValue(null);
            mockBM03StageEvaluation.create.mockResolvedValue({
                id: 403,
                bm03RecordId,
                stage: 'MIDTERM',
                evaluationResult: 'PROPOSE_STOP',
                comments: 'Sinh viên không tham gia các buổi hướng dẫn',
            });
            mockBM03ProgressRecord.update.mockResolvedValue({});
            mockInstituteStopReview.create.mockResolvedValue({
                id: 701,
                bm03RecordId,
                registrationId,
                status: 'STOP_REVIEW_PENDING',
                stopReviewDeadline: new Date(Date.now() + 168 * 3600 * 1000),
            });

            await submitStageEvaluation({
                registrationId,
                advisorId,
                stage: 'MIDTERM',
                decision: 'PROPOSE_STOP',
                comments: 'Sinh viên không tham gia các buổi hướng dẫn',
            });

            expect(mockInstituteStopReview.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    status: 'STOP_REVIEW_PENDING',
                    registrationId,
                }),
            }));

            // Crucial assertion: registration status is NOT set to TERMINATED or STOPPED
            expect(mockTopicRegistration.update).not.toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: 'TERMINATED' }),
            }));
            expect(mockTopicRegistration.update).not.toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: 'STOPPED' }),
            }));
        });
    });

    // ========================================================================
    // AC9: Institute Stop Review 7-Day SLA & Max ONE 3-Day (+72h) Extension
    // ========================================================================
    describe('AC9: Institute Stop Review 7-Day SLA (168h) & Max ONE 3-Day (+72h) Extension', () => {
        test('extends stopReviewDeadline by +72h on first requestMoreInfo', async () => {
            const proposalTime = new Date('2026-11-10T10:00:00Z');
            const initialDeadline = new Date(proposalTime.getTime() + 168 * 3600 * 1000);
            const expectedExtendedDeadline = new Date(initialDeadline.getTime() + 72 * 3600 * 1000);

            mockInstituteStopReview.findUnique
                .mockResolvedValueOnce({
                    id: 701,
                    registrationId,
                    status: 'STOP_REVIEW_PENDING',
                    extensionCount: 0,
                    stopReviewDeadline: initialDeadline,
                })
                .mockResolvedValueOnce({
                    id: 701,
                    registrationId,
                    status: 'MORE_INFO_REQUIRED',
                    extensionCount: 1,
                    stopReviewDeadline: expectedExtendedDeadline,
                });
            mockInstituteStopReview.updateMany.mockResolvedValue({ count: 1 });

            const extRes = await requestMoreInfoForStopReview({
                reviewId: 701,
                reviewerId: adminId,
                note: 'Yêu cầu GVHD bổ sung biên bản các buổi vắng mặt',
            }, { now: proposalTime });

            expect(extRes.extensionCount).toBe(1);
            expect(extRes.stopReviewDeadline).toEqual(expectedExtendedDeadline);
        });

        test('rejects 2nd extension request with 409 EXTENSION_QUOTA_EXHAUSTED', async () => {
            mockInstituteStopReview.findUnique.mockResolvedValue({
                id: 701,
                registrationId,
                status: 'MORE_INFO_REQUIRED',
                extensionCount: 1, // quota already used!
                stopReviewDeadline: new Date(Date.now() + 1000000),
            });

            await expect(requestMoreInfoForStopReview({
                reviewId: 701,
                reviewerId: adminId,
                note: 'Thử xin gia hạn lần 2',
            })).rejects.toMatchObject({
                code: 'EXTENSION_QUOTA_EXHAUSTED',
                statusCode: 409,
            });
        });
    });

    // ========================================================================
    // AC10: Overdue Stop Review Auto-Termination with ZERO Fake Admin Signatures
    // ========================================================================
    describe('AC10: Overdue Stop Review Auto-Termination with ZERO Fake Admin Signatures', () => {
        test('sweep job auto-terminates overdue review with SYSTEM_TIMEOUT and reviewedById: null', async () => {
            const sweepTime = new Date('2026-11-20T12:00:00Z');

            mockTopicAssignmentDecision.findMany.mockResolvedValue([]);
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([]);
            mockBM03ProgressRecord.findMany.mockResolvedValue([]);
            mockInstituteDefenseReview.findMany.mockResolvedValue([]);

            mockInstituteStopReview.findMany.mockResolvedValue([
                {
                    id: 701,
                    bm03RecordId,
                    registrationId,
                    status: 'STOP_REVIEW_PENDING',
                    stopReviewDeadline: new Date('2026-11-18T10:00:00Z'), // overdue!
                },
            ]);
            mockInstituteStopReview.updateMany.mockResolvedValue({ count: 1 });
            mockBM03ProgressRecord.update.mockResolvedValue({});
            mockTopicRegistration.update.mockResolvedValue({});

            const sweepReport = await runBm02ToBm04SweepJobs({ now: sweepTime });

            expect(sweepReport.autoTerminatedStopReviewsCount).toBe(1);
            expect(mockInstituteStopReview.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({ id: 701 }),
                data: expect.objectContaining({
                    status: 'AUTO_TERMINATED',
                    decision: 'AUTO_TERMINATED',
                    decisionSource: 'SYSTEM_TIMEOUT',
                    reviewedById: null, // STRICT INVARIANT: 0 fake admin signature
                }),
            }));
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: registrationId },
                data: { status: 'AUTO_TERMINATED' },
            }));
        });
    });

    // ========================================================================
    // AC11: Overdue BM03 Student Ack (48h Timeout) Does NOT Block BM04
    // ========================================================================
    describe('AC11: Overdue BM03 Student Ack (48h Timeout) Does NOT Block BM04', () => {
        test('sweep job auto-completes overdue 48h BM03 ack and opens Task(BM04)', async () => {
            const sweepTime = new Date('2026-11-20T12:00:00Z');

            mockTopicAssignmentDecision.findMany.mockResolvedValue([]);
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([]);
            mockInstituteStopReview.findMany.mockResolvedValue([]);
            mockInstituteDefenseReview.findMany.mockResolvedValue([]);

            mockBM03ProgressRecord.findMany.mockResolvedValue([
                {
                    id: bm03RecordId,
                    registrationId,
                    finalConclusion: 'CONTINUE_TO_BM04',
                    studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
                    studentAckDeadlineAt: new Date('2026-11-19T10:00:00Z'), // overdue!
                    registration: baseRegistration,
                },
            ]);
            mockBM03ProgressRecord.update.mockResolvedValue({});
            mockTopicRegistration.update.mockResolvedValue({});
            mockTask.findFirst.mockResolvedValue(null);
            mockTask.create.mockResolvedValue({ id: 992 });

            const sweepReport = await runBm02ToBm04SweepJobs({ now: sweepTime });

            expect(sweepReport.autoCompletedStudentAcksCount).toBe(1);
            expect(mockBM03ProgressRecord.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: bm03RecordId },
                data: expect.objectContaining({
                    studentAckStatus: 'ACKNOWLEDGEMENT_TIMEOUT',
                    studentSignatureEventId: null, // STRICT INVARIANT: NO fake student signature
                }),
            }));

            // Opens Task BM04 and transitions registration to BM03_PASSED
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: registrationId },
                data: { status: 'BM03_PASSED' },
            }));
            expect(mockTask.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    registrationId,
                    taskType: 'BM04',
                    status: 'OPEN',
                }),
            }));

            // System note included in PDF
            expect(mockGenerateImmutableAcademicPdf).toHaveBeenCalledWith(expect.objectContaining({
                docType: 'BM03',
                signatures: expect.arrayContaining([
                    expect.objectContaining({
                        systemNote: expect.stringContaining('ACKNOWLEDGEMENT_TIMEOUT'),
                    }),
                ]),
            }), expect.anything());
        });
    });

    // ========================================================================
    // AC12: BM04 Advisor Evaluation: 4 Criteria + 2 Conclusions Enforcement
    // ========================================================================
    describe('AC12: BM04 Advisor Evaluation: 4 Criteria + 2 Conclusions Enforcement', () => {
        test('rejects signAndSubmitBM04 if any criteria feedback is missing', async () => {
            await expect(signAndSubmitBM04({
                registrationId,
                advisorId,
                thesisFormatScore: '', // missing!
                researchContentScore: 'Đầy đủ',
                applicabilityScore: 'Tốt',
                attitudeScore: 'Tốt',
                programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: 'APPROVE_FOR_DEFENSE',
                lecturerSignature: 'TS. Nguyễn Văn Hướng Dẫn',
            })).rejects.toMatchObject({
                code: 'MISSING_CRITERIA_FEEDBACK',
                statusCode: 400,
            });
        });

        test('rejects DOES_NOT_MEET_PROGRAM_OUTCOMES + APPROVE_FOR_DEFENSE combination', async () => {
            await expect(signAndSubmitBM04({
                registrationId,
                advisorId,
                thesisFormatScore: 'Đạt',
                researchContentScore: 'Yếu',
                applicabilityScore: 'Thấp',
                attitudeScore: 'Đạt',
                programOutcome: 'DOES_NOT_MEET_PROGRAM_OUTCOMES',
                defenseRecommendation: 'APPROVE_FOR_DEFENSE', // invalid combo!
                lecturerSignature: 'TS. Nguyễn Văn Hướng Dẫn',
            })).rejects.toMatchObject({
                code: 'INVALID_BM04_CONCLUSION_COMBINATION',
                statusCode: 400,
            });
        });

        test('rejects MEETS_PROGRAM_OUTCOMES + NOT_APPROVE_FOR_DEFENSE without mismatchReason', async () => {
            await expect(signAndSubmitBM04({
                registrationId,
                advisorId,
                thesisFormatScore: 'Đạt',
                researchContentScore: 'Đạt',
                applicabilityScore: 'Đạt',
                attitudeScore: 'Đạt',
                programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: 'NOT_APPROVE_FOR_DEFENSE',
                mismatchReason: '', // missing mismatchReason!
                lecturerSignature: 'TS. Nguyễn Văn Hướng Dẫn',
            })).rejects.toMatchObject({
                code: 'MISMATCH_REASON_REQUIRED',
                statusCode: 400,
            });
        });
    });

    // ========================================================================
    // AC13: BM04 APPROVE_FOR_DEFENSE Transitions to DEFENSE_READY & Council Eligibility
    // ========================================================================
    describe('AC13: BM04 APPROVE_FOR_DEFENSE Transitions to DEFENSE_READY & Council Eligibility', () => {
        test('transitions registration immediately to DEFENSE_READY upon APPROVE_FOR_DEFENSE', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                ...baseRegistration,
                status: 'BM03_PASSED',
                archive: {
                    id: 99,
                    phase: 'PRE_DEFENSE',
                    status: 'SUBMITTED',
                    reportFileUrl: 'https://example.com/pre-defense-report.pdf',
                },
            });
            mockBM04Evaluation.findUnique.mockResolvedValue(null);
            mockBM04Evaluation.upsert.mockResolvedValue({
                id: 56,
                registrationId,
                status: 'SIGNED_APPROVED',
                conclusion: 'AGREED_FOR_DEFENSE',
                isLocked: true,
            });
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTask.updateMany.mockResolvedValue({ count: 1 });

            const res = await signAndSubmitBM04({
                registrationId,
                advisorId,
                thesisFormatScore: 'Tốt',
                researchContentScore: 'Tốt',
                applicabilityScore: 'Tốt',
                attitudeScore: 'Tốt',
                programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: 'APPROVE_FOR_DEFENSE',
                lecturerSignature: 'TS. Nguyễn Văn Hướng Dẫn',
            });

            expect(res.status).toBe('SIGNED_APPROVED');
            expect(mockTopicRegistration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: registrationId },
                data: expect.objectContaining({ status: 'DEFENSE_READY' }),
            }));
        });
    });

    // ========================================================================
    // AC14: BM04 NOT_APPROVE_FOR_DEFENSE Routes to Institute Defense Review (7+3d SLA)
    // ========================================================================
    describe('AC14: BM04 NOT_APPROVE_FOR_DEFENSE Routes to Institute Defense Review', () => {
        test('routes to InstituteDefenseReview with 168h SLA deadline', async () => {
            const now = new Date('2026-11-15T08:00:00Z');
            const expectedDeadline = new Date(now.getTime() + 168 * 3600 * 1000);

            mockTopicRegistration.findUnique.mockResolvedValue({
                ...baseRegistration,
                status: 'BM03_PASSED',
                archive: {
                    id: 99,
                    phase: 'PRE_DEFENSE',
                    status: 'SUBMITTED',
                    reportFileUrl: 'https://example.com/pre-defense-report.pdf',
                },
            });
            mockBM04Evaluation.findUnique.mockResolvedValue(null);
            mockBM04Evaluation.upsert.mockResolvedValue({
                id: 57,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                conclusion: 'NOT_AGREED_FOR_DEFENSE',
                isLocked: true,
            });
            mockInstituteDefenseReview.create.mockResolvedValue({
                id: 88,
                bm04EvaluationId: 57,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                reviewDeadlineAt: expectedDeadline,
            });
            mockTopicRegistration.update.mockResolvedValue({});

            const res = await signAndSubmitBM04({
                registrationId,
                advisorId,
                thesisFormatScore: 'Chưa đạt',
                researchContentScore: 'Thiếu thực nghiệm',
                applicabilityScore: 'Thấp',
                attitudeScore: 'Trung bình',
                programOutcome: 'DOES_NOT_MEET_PROGRAM_OUTCOMES',
                defenseRecommendation: 'NOT_APPROVE_FOR_DEFENSE',
                lecturerSignature: 'TS. Nguyễn Văn Hướng Dẫn',
            }, { now });

            expect(res.status).toBe('PENDING_INSTITUTE_REVIEW');
            expect(mockInstituteDefenseReview.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    registrationId,
                    status: 'PENDING_INSTITUTE_REVIEW',
                    reviewDeadlineAt: expectedDeadline,
                }),
            }));
        });

        test('institute OVERRIDE_ELIGIBLE decision marks registration DEFENSE_READY without changing advisor score', async () => {
            mockInstituteDefenseReview.findUnique.mockResolvedValue({
                id: 88,
                bm04EvaluationId: 57,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                extensionCount: 0,
            });
            mockInstituteDefenseReview.updateMany.mockResolvedValue({ count: 1 });
            mockBM04Evaluation.update.mockResolvedValue({});
            mockTopicRegistration.update.mockResolvedValue({});
            mockTask.updateMany.mockResolvedValue({});

            await decideDefenseReview({
                reviewId: 88,
                reviewerId: adminId,
                decision: 'OVERRIDE_ELIGIBLE',
                reason: 'Viện thẩm định thực nghiệm bổ sung và cho phép bảo vệ',
            });

            expect(mockBM04Evaluation.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 57 },
                data: { status: 'ELIGIBLE_BY_INSTITUTE' }, // does not alter advisor's score
            }));
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: registrationId },
                data: { status: 'DEFENSE_READY' },
            }));
        });

        test('sweep job auto-finalizes overdue InstituteDefenseReview to AUTO_NOT_ELIGIBLE with 0 fake signatures', async () => {
            const sweepTime = new Date('2026-11-20T12:00:00Z');

            mockTopicAssignmentDecision.findMany.mockResolvedValue([]);
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([]);
            mockInstituteStopReview.findMany.mockResolvedValue([]);
            mockBM03ProgressRecord.findMany.mockResolvedValue([]);

            mockInstituteDefenseReview.findMany.mockResolvedValue([
                {
                    id: 88,
                    bm04EvaluationId: 57,
                    registrationId,
                    status: 'PENDING_INSTITUTE_REVIEW',
                    reviewDeadlineAt: new Date('2026-11-18T10:00:00Z'), // overdue!
                },
            ]);
            mockInstituteDefenseReview.updateMany.mockResolvedValue({ count: 1 });
            mockBM04Evaluation.update.mockResolvedValue({});
            mockTopicRegistration.update.mockResolvedValue({});

            const sweepReport = await runBm02ToBm04SweepJobs({ now: sweepTime });

            expect(sweepReport.autoFinalizedDefenseReviewsCount).toBe(1);
            expect(mockInstituteDefenseReview.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({ id: 88 }),
                data: expect.objectContaining({
                    status: 'AUTO_NOT_ELIGIBLE',
                    decision: 'AUTO_NOT_ELIGIBLE',
                    decisionSource: 'SYSTEM_TIMEOUT',
                    reviewedById: null, // STRICT INVARIANT: 0 fake admin signature
                }),
            }));
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: registrationId },
                data: { status: 'AUTO_NOT_ELIGIBLE' },
            }));
        });
    });

    // ========================================================================
    // AC15: Effective Topic Title Resolution & Snapshot Integrity
    // ========================================================================
    describe('AC15: Effective Topic Title Resolution & Snapshot Integrity', () => {
        test('strictly follows hierarchy: Appendix > Decision > Initial without retroactive mutations', async () => {
            const timeT1 = new Date('2026-11-14T00:00:00Z'); // before decision
            const timeT2 = new Date('2026-11-16T00:00:00Z'); // after decision, before appendix
            const timeT3 = new Date('2026-11-25T00:00:00Z'); // after appendix

            const appxSignedDate = new Date('2026-11-20T00:00:00Z');
            const decisionPubDate = new Date('2026-11-15T00:00:00Z');

            mockTitleAdjustmentAppendixItem.findFirst.mockImplementation(async ({ where }) => {
                const targetTime = where.appendix.signedDate.lte;
                if (targetTime >= appxSignedDate) {
                    return {
                        id: 1,
                        newTitle: 'Tên đề tài đã đổi theo Phụ lục 1',
                        appendix: { signedDate: appxSignedDate, appendixNumber: 'PL-01' },
                    };
                }
                return null;
            });

            mockTopicAssignmentDecisionItem.findFirst.mockImplementation(async ({ where }) => {
                const targetTime = where.decision.OR[0].decisionPublishedAt.lte;
                if (targetTime >= decisionPubDate) {
                    return {
                        id: 1,
                        approvedTitleSnapshot: 'Tên đề tài giao theo Quyết định gốc',
                        decision: { decisionPublishedAt: decisionPubDate, decisionNumber: 'QD-01' },
                    };
                }
                return null;
            });

            mockTopicRegistration.findUnique.mockResolvedValue({
                id: registrationId,
                bm01ApprovedTitleSnapshot: 'Tên đề tài BM01 sơ khai ban đầu',
                topic: { title: 'Tên đề tài BM01 sơ khai ban đầu' },
            });

            // T1: Initial title
            const resT1 = await resolveEffectiveTopicTitle(registrationId, timeT1);
            expect(resT1.title).toBe('Tên đề tài BM01 sơ khai ban đầu');
            expect(resT1.source).toBe('TOPIC_INITIAL');

            // T2: Decision title
            const resT2 = await resolveEffectiveTopicTitle(registrationId, timeT2);
            expect(resT2.title).toBe('Tên đề tài giao theo Quyết định gốc');
            expect(resT2.source).toBe('DECISION');

            // T3: Appendix title
            const resT3 = await resolveEffectiveTopicTitle(registrationId, timeT3);
            expect(resT3.title).toBe('Tên đề tài đã đổi theo Phụ lục 1');
            expect(resT3.source).toBe('APPENDIX');
        });
    });

    // ========================================================================
    // Defense Council Assignment Security & Conflict of Interest Guards
    // ========================================================================
    describe('Defense Council Assignment Guards in councilController', () => {
        test('rejects council assignment if registration is NOT in DEFENSE_READY status', async () => {
            mockCouncil.findUnique.mockResolvedValue({
                id: defenseCouncilId,
                councilType: 'DEFENSE_COUNCIL',
                members: [
                    { lecturerId: councilChairId, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: councilSecId, roleInCouncil: 'SECRETARY' },
                    { lecturerId: councilRevId, roleInCouncil: 'REVIEWER' },
                ],
                _count: { registrations: 0, outlineRegistrations: 0, defenseRegistrations: 0 },
            });

            mockTopicRegistration.findMany.mockResolvedValue([
                {
                    id: registrationId,
                    status: 'IN_PROGRESS_BM03', // not eligible!
                    student: { fullName: 'Sinh Viên A', code: 'SV01' },
                    topic: { title: 'Đề tài', mentorId: advisorId },
                    bm04Evaluation: null,
                },
            ]);

            const res = await request(app)
                .post(`/api/councils/${defenseCouncilId}/assign`)
                .set('Authorization', 'Bearer admin-token')
                .send({ registrationIds: [registrationId] });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('chưa có kết luận ĐỒNG Ý cho ra bảo vệ');
        });

        test('rejects council assignment if advisor (mentorId) is a member of the defense council (Conflict of Interest)', async () => {
            mockCouncil.findUnique.mockResolvedValue({
                id: defenseCouncilId,
                councilType: 'DEFENSE_COUNCIL',
                members: [
                    { lecturerId: advisorId, roleInCouncil: 'CHAIRMAN' }, // advisor in council!
                    { lecturerId: councilSecId, roleInCouncil: 'SECRETARY' },
                    { lecturerId: councilRevId, roleInCouncil: 'REVIEWER' },
                ],
                _count: { registrations: 0, outlineRegistrations: 0, defenseRegistrations: 0 },
            });

            mockTopicRegistration.findMany.mockResolvedValue([
                {
                    id: registrationId,
                    status: 'DEFENSE_READY',
                    student: { fullName: 'Sinh Viên A', code: 'SV01' },
                    topic: { title: 'Đề tài AI', mentorId: advisorId },
                    bm04Evaluation: {
                        conclusion: 'AGREED_FOR_DEFENSE',
                        isLocked: true,
                        status: 'SIGNED_APPROVED',
                    },
                },
            ]);

            const res = await request(app)
                .post(`/api/councils/${defenseCouncilId}/assign`)
                .set('Authorization', 'Bearer admin-token')
                .send({ registrationIds: [registrationId] });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Conflict of interest');
        });
    });
});
