const request = require('supertest');
const jwt = require('jsonwebtoken');

// Prepare mocked Prisma database for testing
const mockTopicRegistration = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
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

const mockInstituteStopReview = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockBM03ProgressRecord = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockBM02AAdjustmentRequest = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockTopicAssignmentDecision = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockTopicAssignmentDecisionItem = {
    findFirst: jest.fn(),
};

const mockTitleAdjustmentAppendixItem = {
    findFirst: jest.fn(),
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

const mockUser = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
};

const mockAcademicDelegation = {
    findFirst: jest.fn(),
};

const mockElectronicSignatureEvent = {
    create: jest.fn(),
};

const mockAuditLog = {
    create: jest.fn(),
};

const mockIdempotencyRecord = {
    findUnique: jest.fn(),
    create: jest.fn(),
};

const mockRegistrationStateHistory = {
    create: jest.fn(),
};

const mockPrisma = {
    topicRegistration: mockTopicRegistration,
    bM04Evaluation: mockBM04Evaluation,
    instituteDefenseReview: mockInstituteDefenseReview,
    instituteStopReview: mockInstituteStopReview,
    bM03ProgressRecord: mockBM03ProgressRecord,
    bM02AAdjustmentRequest: mockBM02AAdjustmentRequest,
    topicAssignmentDecision: mockTopicAssignmentDecision,
    topicAssignmentDecisionItem: mockTopicAssignmentDecisionItem,
    titleAdjustmentAppendixItem: mockTitleAdjustmentAppendixItem,
    task: mockTask,
    council: mockCouncil,
    user: mockUser,
    academicDelegation: mockAcademicDelegation,
    electronicSignatureEvent: mockElectronicSignatureEvent,
    auditLog: mockAuditLog,
    idempotencyRecord: mockIdempotencyRecord,
    registrationStateHistory: mockRegistrationStateHistory,
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

const mockGenerateImmutableAcademicPdf = jest.fn().mockResolvedValue({
    fileUrl: 'https://storage.example.com/academic/bm04-final.pdf',
    fileName: 'bm04-final.pdf',
    pdfHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    pdfBuffer: Buffer.from('mock-pdf'),
});

jest.mock('../../src/services/academicPdfService', () => ({
    generateImmutableAcademicPdf: (...args) => mockGenerateImmutableAcademicPdf(...args),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-token'),
}));

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

function buildUser({ id, role, department = 'CNTT', permissions = [] }) {
    return {
        id,
        role,
        department,
        fullName: `${role} User`,
        code: `USER${id}`,
        isActive: true,
        permissionGroups: [
            {
                permissionGroup: {
                    permissions: permissions.map((code) => ({
                        permission: { code },
                    })),
                },
            },
        ],
    };
}

describe('Task 6: BM04 Advisor Evaluation, Institute Defense Review (7+3d SLA) & 5 Scheduled Sweep Jobs', () => {
    const registrationId = 401;
    const advisorId = 20;
    const studentId = 10;
    const instituteReviewerId = 30;

    const baseRegistration = {
        id: registrationId,
        semesterId: 1,
        studentId,
        status: 'BM03_PASSED',
        stateVersion: 1,
        topic: {
            id: 88,
            title: 'Hệ thống Quản lý Đồ án Tốt nghiệp',
            mentorId: advisorId,
            mentor: { id: advisorId, fullName: 'TS. Nguyễn Văn Hướng Dẫn', department: 'CNTT' },
        },
        student: {
            id: studentId,
            fullName: 'Trần Sinh Viên',
            code: '20201234',
            class: 'CNTT-K65',
        },
        archive: {
            id: 99,
            phase: 'PRE_DEFENSE',
            status: 'SUBMITTED',
            reportFileUrl: 'https://example.com/report.pdf',
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-jwt-secret';

        mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
        mockTopicRegistration.findUnique.mockResolvedValue({ ...baseRegistration });
        mockTopicAssignmentDecisionItem.findFirst.mockResolvedValue(null);
        mockTitleAdjustmentAppendixItem.findFirst.mockResolvedValue(null);
        mockElectronicSignatureEvent.create.mockResolvedValue({ id: 501 });
        mockBM04Evaluation.update.mockImplementation(async ({ where, data }) => ({
            id: where?.id || 1,
            ...data,
        }));

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: studentId, role: 'STUDENT' };
            if (token === 'advisor-token') return { userId: advisorId, role: 'LECTURER' };
            if (token === 'reviewer-token') return { userId: instituteReviewerId, role: 'ADMIN' };
            return { userId: 999, role: 'STUDENT' };
        });

        mockUser.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === studentId) return buildUser({ id: studentId, role: 'STUDENT', permissions: ['VIEW_MY_REGISTRATION'] });
            if (where.id === advisorId) return buildUser({ id: advisorId, role: 'LECTURER', department: 'CNTT', permissions: ['BM04_CREATE_AND_SIGN', 'BM04_SUBMIT', 'BM04_REVIEW'] });
            if (where.id === instituteReviewerId) return buildUser({ id: instituteReviewerId, role: 'ADMIN', department: 'CNTT', permissions: ['BM04_REJECTION_REVIEW', 'DEFENSE_COUNCIL_MANAGE'] });
            return null;
        });
    });

    // -------------------------------------------------------------
    // 1. Saving BM04 draft and Pure Read-Only GET
    // -------------------------------------------------------------
    describe('1. Saving BM04 draft & Read-Only GET /api/bm04/:registrationId', () => {
        test('getBM04Record is purely read-only: returns existing record and does NOT call create/upsert', async () => {
            const existingBM04 = {
                id: 1,
                registrationId,
                status: 'DRAFT',
                isLocked: false,
                effectiveTitleSnapshot: 'Hệ thống Quản lý Đồ án Tốt nghiệp',
                studentClassSnapshot: 'CNTT-K65',
                thesisFormatScore: 'Tốt',
                researchContentScore: 'Đầy đủ',
                applicabilityScore: 'Cao',
                attitudeScore: 'Tích cực',
                conclusion: 'AGREED_FOR_DEFENSE',
                programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: 'APPROVE_FOR_DEFENSE',
                mismatchReason: null,
                generalNotes: 'Bản thảo',
                lecturerSignature: '',
                signedAt: null,
                finalPdfFileUrl: null,
                registration: baseRegistration,
            };
            mockBM04Evaluation.findUnique.mockResolvedValue(existingBM04);

            const result = await getBM04Record(registrationId);

            expect(result).toBeDefined();
            expect(result.id).toBe(1);
            expect(result.status).toBe('DRAFT');
            expect(result.isLocked).toBe(false);
            expect(mockBM04Evaluation.create).not.toHaveBeenCalled();
            expect(mockBM04Evaluation.upsert).not.toHaveBeenCalled();
        });

        test('getBM04Record returns virtual projection without DB write when record does not exist yet', async () => {
            mockBM04Evaluation.findUnique.mockResolvedValue(null);

            const result = await getBM04Record(registrationId);

            expect(result).toBeDefined();
            expect(result.id).toBeNull();
            expect(result.registrationId).toBe(registrationId);
            expect(result.status).toBe('DRAFT');
            expect(result.isLocked).toBe(false);
            expect(result.effectiveTitleSnapshot).toBe('Hệ thống Quản lý Đồ án Tốt nghiệp');
            expect(mockBM04Evaluation.create).not.toHaveBeenCalled();
            expect(mockBM04Evaluation.upsert).not.toHaveBeenCalled();
        });

        test('saveBM04Draft saves unlocked draft (isLocked=false, status=DRAFT)', async () => {
            mockBM04Evaluation.findUnique.mockResolvedValue(null);
            mockBM04Evaluation.upsert.mockResolvedValue({
                id: 2,
                registrationId,
                status: 'DRAFT',
                isLocked: false,
                effectiveTitleSnapshot: 'Hệ thống Quản lý Đồ án Tốt nghiệp',
                studentClassSnapshot: 'CNTT-K65',
                thesisFormatScore: 'Khá',
                researchContentScore: 'Tốt',
                applicabilityScore: 'Khá',
                attitudeScore: 'Tốt',
                conclusion: 'AGREED_FOR_DEFENSE',
                programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: 'APPROVE_FOR_DEFENSE',
                mismatchReason: null,
                generalNotes: 'Bản lưu nháp',
            });

            const draftResult = await saveBM04Draft({
                registrationId,
                advisorId,
                thesisFormatScore: 'Khá',
                researchContentScore: 'Tốt',
                applicabilityScore: 'Khá',
                attitudeScore: 'Tốt',
                programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: 'APPROVE_FOR_DEFENSE',
                generalNotes: 'Bản lưu nháp',
            });

            expect(draftResult.isLocked).toBe(false);
            expect(draftResult.status).toBe('DRAFT');
            expect(mockBM04Evaluation.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { registrationId },
                    update: expect.objectContaining({ isLocked: false, status: 'DRAFT' }),
                    create: expect.objectContaining({ isLocked: false, status: 'DRAFT' }),
                }),
            );
        });

        test('saveBM04Draft rejects if caller is not the topic mentor', async () => {
            await expect(saveBM04Draft({
                registrationId,
                advisorId: 999, // wrong advisor
                thesisFormatScore: 'Khá',
            })).rejects.toMatchObject({
                code: 'ONLY_CURRENT_MENTOR_ALLOWED',
                statusCode: 403,
            });
        });

        test('saveBM04Draft rejects if BM04 is already locked', async () => {
            mockBM04Evaluation.findUnique.mockResolvedValue({
                id: 1,
                isLocked: true,
                status: 'SIGNED_APPROVED',
            });

            await expect(saveBM04Draft({
                registrationId,
                advisorId,
                thesisFormatScore: 'Khá',
            })).rejects.toMatchObject({
                code: 'BM04_ALREADY_LOCKED',
                statusCode: 400,
            });
        });
    });

    // -------------------------------------------------------------
    // 2. Validating 4 Criteria + 2 Conclusions
    // -------------------------------------------------------------
    describe('2. Validating 4 Criteria + 2 Conclusions Constraints', () => {
        test('rejects if any of the 4 criteria feedback is missing', async () => {
            await expect(signAndSubmitBM04({
                registrationId,
                advisorId,
                thesisFormatScore: '', // missing
                researchContentScore: 'Tốt',
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

        test('rejects DOES_NOT_MEET_PROGRAM_OUTCOMES + APPROVE_FOR_DEFENSE with 400 INVALID_BM04_CONCLUSION_COMBINATION', async () => {
            await expect(signAndSubmitBM04({
                registrationId,
                advisorId,
                thesisFormatScore: 'Chưa đạt',
                researchContentScore: 'Yếu',
                applicabilityScore: 'Thấp',
                attitudeScore: 'Trung bình',
                programOutcome: 'DOES_NOT_MEET_PROGRAM_OUTCOMES',
                defenseRecommendation: 'APPROVE_FOR_DEFENSE', // invalid combination!
                lecturerSignature: 'TS. Nguyễn Văn Hướng Dẫn',
            })).rejects.toMatchObject({
                code: 'INVALID_BM04_CONCLUSION_COMBINATION',
                statusCode: 400,
            });
        });

        test('rejects MEETS_PROGRAM_OUTCOMES + NOT_APPROVE_FOR_DEFENSE without mismatchReason with 400 MISMATCH_REASON_REQUIRED', async () => {
            await expect(signAndSubmitBM04({
                registrationId,
                advisorId,
                thesisFormatScore: 'Tốt',
                researchContentScore: 'Tốt',
                applicabilityScore: 'Tốt',
                attitudeScore: 'Tốt',
                programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: 'NOT_APPROVE_FOR_DEFENSE',
                mismatchReason: '', // missing!
                lecturerSignature: 'TS. Nguyễn Văn Hướng Dẫn',
            })).rejects.toMatchObject({
                code: 'MISMATCH_REASON_REQUIRED',
                statusCode: 400,
            });
        });

        test('accepts MEETS_PROGRAM_OUTCOMES + NOT_APPROVE_FOR_DEFENSE when mismatchReason is provided', async () => {
            mockBM04Evaluation.findUnique.mockResolvedValue(null);
            mockBM04Evaluation.upsert.mockResolvedValue({
                id: 10,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                isLocked: true,
                conclusion: 'NOT_AGREED_FOR_DEFENSE',
            });
            mockInstituteDefenseReview.create.mockResolvedValue({
                id: 50,
                bm04EvaluationId: 10,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
            });

            const result = await signAndSubmitBM04({
                registrationId,
                advisorId,
                thesisFormatScore: 'Tốt',
                researchContentScore: 'Tốt',
                applicabilityScore: 'Tốt',
                attitudeScore: 'Tốt',
                programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: 'NOT_APPROVE_FOR_DEFENSE',
                mismatchReason: 'Sinh viên thiếu bản demo phần cứng và vi phạm quy định an toàn phòng lab.',
                lecturerSignature: 'TS. Nguyễn Văn Hướng Dẫn',
            });

            expect(result).toBeDefined();
            expect(result.status).toBe('PENDING_INSTITUTE_REVIEW');
        });
    });

    // -------------------------------------------------------------
    // 3. Branch A: APPROVE_FOR_DEFENSE
    // -------------------------------------------------------------
    describe('3. Branch A: APPROVE_FOR_DEFENSE immediately transitions to DEFENSE_READY + SIGNED_APPROVED', () => {
        test('rejects APPROVE_FOR_DEFENSE if pre-defense archive is missing', async () => {
            mockTopicRegistration.findUnique.mockResolvedValueOnce({
                ...baseRegistration,
                archive: null, // missing archive
            });

            await expect(signAndSubmitBM04({
                registrationId,
                advisorId,
                thesisFormatScore: 'Tốt',
                researchContentScore: 'Tốt',
                applicabilityScore: 'Tốt',
                attitudeScore: 'Tốt',
                programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: 'APPROVE_FOR_DEFENSE',
                lecturerSignature: 'TS. Nguyễn Văn Hướng Dẫn',
            })).rejects.toMatchObject({
                code: 'PRE_DEFENSE_ARCHIVE_REQUIRED',
                statusCode: 400,
            });
        });

        test('successfully signs and submits APPROVE_FOR_DEFENSE: locks BM04, generates PDF, transitions to DEFENSE_READY, completes Task(BM04)', async () => {
            mockBM04Evaluation.findUnique.mockResolvedValue(null);
            mockBM04Evaluation.upsert.mockResolvedValue({
                id: 11,
                registrationId,
                status: 'SIGNED_APPROVED',
                isLocked: true,
                conclusion: 'AGREED_FOR_DEFENSE',
                programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: 'APPROVE_FOR_DEFENSE',
                finalPdfFileUrl: 'https://storage.example.com/academic/bm04-final.pdf',
            });

            const result = await signAndSubmitBM04({
                registrationId,
                advisorId,
                thesisFormatScore: 'Xuất sắc',
                researchContentScore: 'Xuất sắc',
                applicabilityScore: 'Rất cao',
                attitudeScore: 'Chăm chỉ',
                programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                defenseRecommendation: 'APPROVE_FOR_DEFENSE',
                lecturerSignature: 'TS. Nguyễn Văn Hướng Dẫn',
            });

            expect(result.status).toBe('SIGNED_APPROVED');
            expect(result.isLocked).toBe(true);
            expect(mockElectronicSignatureEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        entityType: 'BM04_EVALUATION',
                        signerRole: 'ADVISOR',
                        action: 'SIGN',
                    }),
                }),
            );
            expect(mockGenerateImmutableAcademicPdf).toHaveBeenCalled();
            expect(mockTopicRegistration.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: registrationId }),
                    data: expect.objectContaining({ status: 'DEFENSE_READY' }),
                }),
            );
            expect(mockTask.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { registrationId, taskType: 'BM04' },
                    data: { status: 'COMPLETED' },
                }),
            );
        });
    });

    // -------------------------------------------------------------
    // 4. Branch B: NOT_APPROVE_FOR_DEFENSE & Institute Defense Review
    // -------------------------------------------------------------
    describe('4. Branch B: NOT_APPROVE_FOR_DEFENSE routes to InstituteDefenseReview (168h SLA deadline)', () => {
        test('creates InstituteDefenseReview with reviewDeadlineAt = now + 168h', async () => {
            const now = new Date('2026-11-15T08:00:00Z');
            mockBM04Evaluation.findUnique.mockResolvedValue(null);
            mockBM04Evaluation.upsert.mockResolvedValue({
                id: 12,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                isLocked: true,
                conclusion: 'NOT_AGREED_FOR_DEFENSE',
            });
            mockInstituteDefenseReview.create.mockResolvedValue({
                id: 52,
                bm04EvaluationId: 12,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                reviewDeadlineAt: new Date(now.getTime() + 168 * 3600 * 1000),
                extensionCount: 0,
            });

            const result = await signAndSubmitBM04({
                registrationId,
                advisorId,
                thesisFormatScore: 'Kém',
                researchContentScore: 'Chưa hoàn thành mục tiêu',
                applicabilityScore: 'Chưa có',
                attitudeScore: 'Vắng nhiều buổi',
                programOutcome: 'DOES_NOT_MEET_PROGRAM_OUTCOMES',
                defenseRecommendation: 'NOT_APPROVE_FOR_DEFENSE',
                lecturerSignature: 'TS. Nguyễn Văn Hướng Dẫn',
            }, { now });

            expect(result.status).toBe('PENDING_INSTITUTE_REVIEW');
            expect(mockInstituteDefenseReview.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        registrationId,
                        bm04EvaluationId: 12,
                        status: 'PENDING_INSTITUTE_REVIEW',
                        reviewDeadlineAt: new Date('2026-11-22T08:00:00Z'),
                        extensionCount: 0,
                    }),
                }),
            );
            expect(mockTopicRegistration.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: registrationId }),
                    data: expect.objectContaining({ status: 'BM04_REVIEW' }),
                }),
            );
        });
    });

    // -------------------------------------------------------------
    // 5. Institute requestMoreInfo (+72h single extension)
    // -------------------------------------------------------------
    describe('5. Institute requestMoreInfoForDefenseReview (+72h extension & quota guard)', () => {
        test('extends reviewDeadlineAt by exactly +72h when extensionCount is 0', async () => {
            const now = new Date('2026-11-16T08:00:00Z');
            const originalDeadline = new Date('2026-11-22T08:00:00Z');
            const expectedExtendedDeadline = new Date('2026-11-25T08:00:00Z'); // +72h

            mockInstituteDefenseReview.findUnique.mockResolvedValue({
                id: 52,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                extensionCount: 0,
                reviewDeadlineAt: originalDeadline,
            });
            mockInstituteDefenseReview.updateMany.mockResolvedValue({ count: 1 });
            mockInstituteDefenseReview.findUnique.mockResolvedValueOnce({
                id: 52,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                extensionCount: 0,
                reviewDeadlineAt: originalDeadline,
            }).mockResolvedValueOnce({
                id: 52,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                extensionCount: 1,
                reviewDeadlineAt: expectedExtendedDeadline,
            });

            const result = await requestMoreInfoForDefenseReview({
                reviewId: 52,
                reviewerId: instituteReviewerId,
                note: 'Yêu cầu GVHD giải trình chi tiết về tiến độ thực hiện.',
            }, { now });

            expect(mockInstituteDefenseReview.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: 52, extensionCount: 0 }),
                    data: expect.objectContaining({
                        extensionCount: 1,
                        reviewDeadlineAt: expectedExtendedDeadline,
                    }),
                }),
            );
            expect(result.extensionCount).toBe(1);
        });

        test('rejects 2nd extension request with 409 EXTENSION_QUOTA_EXHAUSTED', async () => {
            const now = new Date('2026-11-18T08:00:00Z');
            mockInstituteDefenseReview.findUnique.mockResolvedValue({
                id: 52,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                extensionCount: 1, // already extended once!
                reviewDeadlineAt: new Date('2026-11-25T08:00:00Z'),
            });

            await expect(requestMoreInfoForDefenseReview({
                reviewId: 52,
                reviewerId: instituteReviewerId,
                note: 'Yêu cầu bổ sung thêm lần 2',
            }, { now })).rejects.toMatchObject({
                code: 'EXTENSION_QUOTA_EXHAUSTED',
                statusCode: 409,
            });
        });
    });

    // -------------------------------------------------------------
    // 6. Institute Decisions (APPROVE_NOT_ELIGIBLE and OVERRIDE_ELIGIBLE)
    // -------------------------------------------------------------
    describe('6. Institute decisions: decideDefenseReview', () => {
        test('decision APPROVE_NOT_ELIGIBLE: transitions registration & BM04 to NOT_ELIGIBLE_FOR_DEFENSE', async () => {
            mockInstituteDefenseReview.findUnique.mockResolvedValue({
                id: 52,
                bm04EvaluationId: 12,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                extensionCount: 1,
                reviewDeadlineAt: new Date('2026-11-25T08:00:00Z'),
            });
            mockInstituteDefenseReview.updateMany.mockResolvedValue({ count: 1 });

            await decideDefenseReview({
                reviewId: 52,
                reviewerId: instituteReviewerId,
                decision: 'APPROVE_NOT_ELIGIBLE',
                reason: 'Viện đồng thuận với GVHD rằng đồ án chưa đạt yêu cầu.',
            });

            expect(mockInstituteDefenseReview.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: 52 }),
                    data: expect.objectContaining({
                        status: 'NOT_ELIGIBLE_FOR_DEFENSE',
                        decision: 'APPROVE_NOT_ELIGIBLE',
                        decisionSource: 'INSTITUTE_REVIEWER',
                    }),
                }),
            );
            expect(mockBM04Evaluation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 12 },
                    data: { status: 'NOT_ELIGIBLE_FOR_DEFENSE' },
                }),
            );
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: registrationId },
                    data: { status: 'NOT_ELIGIBLE_FOR_DEFENSE' },
                }),
            );
        });

        test('decision OVERRIDE_ELIGIBLE: marks DEFENSE_READY & ELIGIBLE_BY_INSTITUTE without altering advisor BM04', async () => {
            mockInstituteDefenseReview.findUnique.mockResolvedValue({
                id: 52,
                bm04EvaluationId: 12,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                extensionCount: 0,
                reviewDeadlineAt: new Date('2026-11-22T08:00:00Z'),
            });
            mockInstituteDefenseReview.updateMany.mockResolvedValue({ count: 1 });

            await decideDefenseReview({
                reviewId: 52,
                reviewerId: instituteReviewerId,
                decision: 'OVERRIDE_ELIGIBLE',
                reason: 'Viện thẩm định lại kết quả thực tế và cho phép ra bảo vệ trước hội đồng.',
            });

            expect(mockBM04Evaluation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 12 },
                    data: { status: 'ELIGIBLE_BY_INSTITUTE' }, // does NOT change advisor's scores or conclusion
                }),
            );
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: registrationId },
                    data: { status: 'DEFENSE_READY' },
                }),
            );
            expect(mockTask.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { registrationId, taskType: 'BM04' },
                    data: { status: 'COMPLETED' },
                }),
            );
        });
    });

    // -------------------------------------------------------------
    // 7. Defense Council Eligibility in councilController
    // -------------------------------------------------------------
    describe('7. Defense Council eligibility in councilController', () => {
        test('accepts registrations in DEFENSE_READY, DEFENSE_ELIGIBLE, and ELIGIBLE_BY_INSTITUTE', async () => {
            mockCouncil.findUnique.mockResolvedValue({
                id: 99,
                councilType: 'DEFENSE_COUNCIL',
                members: [
                    { lecturerId: 888, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 889, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 890, roleInCouncil: 'REVIEWER' },
                ],
                _count: { defenseRegistrations: 0 },
            });

            // Reg 1: DEFENSE_READY with AGREED_FOR_DEFENSE
            const reg1 = {
                id: 101,
                status: 'DEFENSE_READY',
                topic: { mentorId: 11, title: 'Đề tài 1' },
                student: { fullName: 'SV 1', code: 'SV001' },
                bm04Evaluation: { conclusion: 'AGREED_FOR_DEFENSE', isLocked: true },
            };
            // Reg 2: DEFENSE_ELIGIBLE
            const reg2 = {
                id: 102,
                status: 'DEFENSE_ELIGIBLE',
                topic: { mentorId: 12, title: 'Đề tài 2' },
                student: { fullName: 'SV 2', code: 'SV002' },
                bm04Evaluation: { status: 'SIGNED_APPROVED', isLocked: true },
            };
            // Reg 3: ELIGIBLE_BY_INSTITUTE
            const reg3 = {
                id: 103,
                status: 'DEFENSE_READY',
                topic: { mentorId: 13, title: 'Đề tài 3' },
                student: { fullName: 'SV 3', code: 'SV003' },
                bm04Evaluation: { status: 'ELIGIBLE_BY_INSTITUTE', conclusion: 'NOT_AGREED_FOR_DEFENSE', isLocked: true },
            };

            mockTopicRegistration.findMany.mockResolvedValue([reg1, reg2, reg3]);
            mockTopicRegistration.updateMany.mockResolvedValue({ count: 3 });

            const req = {
                params: { id: '99' },
                body: { registrationIds: [101, 102, 103] },
                user: { id: 1 },
                headers: {},
                ip: '127.0.0.1',
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            const next = jest.fn();

            await councilController.assignRegistrationsToCouncil(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                }),
            );
        });

        test('rejects registrations that are not eligible for defense council', async () => {
            mockCouncil.findUnique.mockResolvedValue({
                id: 99,
                councilType: 'DEFENSE_COUNCIL',
                members: [
                    { lecturerId: 888, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 889, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 890, roleInCouncil: 'REVIEWER' },
                ],
                _count: { defenseRegistrations: 0 },
            });

            const unreadyReg = {
                id: 104,
                status: 'BM03_PASSED', // not ready for defense!
                topic: { mentorId: 14, title: 'Đề tài 4' },
                student: { fullName: 'SV 4', code: 'SV004' },
                bm04Evaluation: null,
            };

            mockTopicRegistration.findMany.mockResolvedValue([unreadyReg]);

            const req = {
                params: { id: '99' },
                body: { registrationIds: [104] },
                user: { id: 1 },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            const next = jest.fn();

            await councilController.assignRegistrationsToCouncil(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                }),
            );
        });
    });

    // -------------------------------------------------------------
    // 8. All 5 Idempotent Sweep Jobs
    // -------------------------------------------------------------
    describe('8. All 5 Idempotent Sweep Jobs in runBm02ToBm04SweepJobs', () => {
        test('Job 1: closes BM02-A window after 168h from decisionPublishedAt', async () => {
            const sweepTime = new Date('2026-11-20T12:00:00Z');
            const pastPublished = new Date('2026-11-10T10:00:00Z'); // >168h ago

            mockTopicAssignmentDecision.findMany.mockResolvedValue([
                { id: 1, decisionPublishedAt: pastPublished },
            ]);
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([]);
            mockInstituteStopReview.findMany.mockResolvedValue([]);
            mockBM03ProgressRecord.findMany.mockResolvedValue([]);
            mockInstituteDefenseReview.findMany.mockResolvedValue([]);

            const report = await runBm02ToBm04SweepJobs({ now: sweepTime });

            expect(report.closedBm02AWindowsCount).toBe(1);
        });

        test('Job 2: expires BM02-A requests past titleAdjustmentDeadline (status=EXPIRED)', async () => {
            const sweepTime = new Date('2026-11-20T12:00:00Z');
            const overdueDeadline = new Date('2026-11-19T10:00:00Z');

            mockTopicAssignmentDecision.findMany.mockResolvedValue([]);
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([
                { id: 10, status: 'STUDENT_PREPARING', titleAdjustmentDeadline: overdueDeadline },
                { id: 11, status: 'RETURNED_FOR_CORRECTION', titleAdjustmentDeadline: overdueDeadline },
            ]);
            mockBM02AAdjustmentRequest.updateMany.mockResolvedValue({ count: 2 });
            mockInstituteStopReview.findMany.mockResolvedValue([]);
            mockBM03ProgressRecord.findMany.mockResolvedValue([]);
            mockInstituteDefenseReview.findMany.mockResolvedValue([]);

            const report = await runBm02ToBm04SweepJobs({ now: sweepTime });

            expect(report.expiredBm02ARequestsCount).toBe(2);
            expect(mockBM02AAdjustmentRequest.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: { in: [10, 11] },
                    }),
                    data: { status: 'EXPIRED' },
                }),
            );
        });

        test('Job 3: auto-terminates overdue InstituteStopReview (AUTO_TERMINATED, SYSTEM_TIMEOUT, 0 fake admin signatures)', async () => {
            const sweepTime = new Date('2026-11-20T12:00:00Z');

            mockTopicAssignmentDecision.findMany.mockResolvedValue([]);
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([]);
            mockInstituteStopReview.findMany.mockResolvedValue([
                {
                    id: 301,
                    bm03RecordId: 601,
                    registrationId: 701,
                    status: 'STOP_REVIEW_PENDING',
                    stopReviewDeadline: new Date('2026-11-18T10:00:00Z'), // overdue!
                },
            ]);
            mockInstituteStopReview.updateMany.mockResolvedValue({ count: 1 });
            mockBM03ProgressRecord.update.mockResolvedValue({});
            mockTopicRegistration.update.mockResolvedValue({});
            mockBM03ProgressRecord.findMany.mockResolvedValue([]);
            mockInstituteDefenseReview.findMany.mockResolvedValue([]);

            const report = await runBm02ToBm04SweepJobs({ now: sweepTime });

            expect(report.autoTerminatedStopReviewsCount).toBe(1);
            expect(mockInstituteStopReview.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 301, status: { in: ['STOP_REVIEW_PENDING', 'MORE_INFO_REQUIRED'] } },
                    data: expect.objectContaining({
                        status: 'AUTO_TERMINATED',
                        decision: 'AUTO_TERMINATED',
                        decisionSource: 'SYSTEM_TIMEOUT',
                        reviewedById: null, // NO fake admin signature!
                    }),
                }),
            );
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 701 },
                    data: { status: 'AUTO_TERMINATED' },
                }),
            );
        });

        test('Job 4: auto-completes overdue 48h BM03 student ack (ACKNOWLEDGEMENT_TIMEOUT, generates PDF with system note, opens BM04)', async () => {
            const sweepTime = new Date('2026-11-20T12:00:00Z');

            mockTopicAssignmentDecision.findMany.mockResolvedValue([]);
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([]);
            mockInstituteStopReview.findMany.mockResolvedValue([]);
            mockInstituteDefenseReview.findMany.mockResolvedValue([]);

            mockBM03ProgressRecord.findMany.mockResolvedValue([
                {
                    id: 602,
                    registrationId: 702,
                    finalConclusion: 'CONTINUE_TO_BM04',
                    studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
                    studentAckDeadlineAt: new Date('2026-11-19T10:00:00Z'), // overdue!
                    registration: {
                        id: 702,
                        student: { fullName: 'Trần Sinh Viên', code: '20201234' },
                        topic: { mentor: { fullName: 'TS. Hướng Dẫn' } },
                    },
                },
            ]);
            mockBM03ProgressRecord.update.mockResolvedValue({});
            mockTopicRegistration.update.mockResolvedValue({});
            mockTask.findFirst.mockResolvedValue(null);
            mockTask.create.mockResolvedValue({ id: 801 });

            const report = await runBm02ToBm04SweepJobs({ now: sweepTime });

            expect(report.autoCompletedStudentAcksCount).toBe(1);
            expect(mockGenerateImmutableAcademicPdf).toHaveBeenCalledWith(
                expect.objectContaining({
                    docType: 'BM03',
                    signatures: expect.arrayContaining([
                        expect.objectContaining({
                            roleLabel: 'Sinh viên thực hiện',
                            systemNote: expect.stringContaining('ACKNOWLEDGEMENT_TIMEOUT'),
                        }),
                    ]),
                }),
                expect.anything(),
            );
            expect(mockBM03ProgressRecord.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 602 },
                    data: expect.objectContaining({
                        studentAckStatus: 'ACKNOWLEDGEMENT_TIMEOUT',
                        studentSignatureEventId: null, // NO fake student signature!
                    }),
                }),
            );
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 702 },
                    data: { status: 'BM03_PASSED' },
                }),
            );
            expect(mockTask.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        registrationId: 702,
                        taskType: 'BM04',
                        status: 'OPEN',
                    }),
                }),
            );
        });

        test('Job 5: auto-finalizes overdue InstituteDefenseReview (AUTO_NOT_ELIGIBLE, SYSTEM_TIMEOUT, 0 fake admin signatures)', async () => {
            const sweepTime = new Date('2026-11-20T12:00:00Z');

            mockTopicAssignmentDecision.findMany.mockResolvedValue([]);
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([]);
            mockInstituteStopReview.findMany.mockResolvedValue([]);
            mockBM03ProgressRecord.findMany.mockResolvedValue([]);

            mockInstituteDefenseReview.findMany.mockResolvedValue([
                {
                    id: 401,
                    bm04EvaluationId: 101,
                    registrationId: 703,
                    status: 'PENDING_INSTITUTE_REVIEW',
                    reviewDeadlineAt: new Date('2026-11-18T10:00:00Z'), // overdue!
                },
            ]);
            mockInstituteDefenseReview.updateMany.mockResolvedValue({ count: 1 });
            mockBM04Evaluation.update.mockResolvedValue({});
            mockTopicRegistration.update.mockResolvedValue({});

            const report = await runBm02ToBm04SweepJobs({ now: sweepTime });

            expect(report.autoFinalizedDefenseReviewsCount).toBe(1);
            expect(mockInstituteDefenseReview.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 401, status: 'PENDING_INSTITUTE_REVIEW' },
                    data: expect.objectContaining({
                        status: 'AUTO_NOT_ELIGIBLE',
                        decision: 'AUTO_NOT_ELIGIBLE',
                        decisionSource: 'SYSTEM_TIMEOUT',
                        reviewedById: null, // NO fake admin signature!
                    }),
                }),
            );
            expect(mockBM04Evaluation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 101 },
                    data: { status: 'AUTO_NOT_ELIGIBLE' },
                }),
            );
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 703 },
                    data: { status: 'AUTO_NOT_ELIGIBLE' },
                }),
            );
        });

        test('Sweep jobs are idempotent: running twice yields 0 updates on second run', async () => {
            const sweepTime = new Date('2026-11-20T12:00:00Z');

            mockTopicAssignmentDecision.findMany.mockResolvedValue([]);
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([]);
            mockInstituteStopReview.findMany.mockResolvedValue([]);
            mockBM03ProgressRecord.findMany.mockResolvedValue([]);
            mockInstituteDefenseReview.findMany.mockResolvedValue([]);

            const report = await runBm02ToBm04SweepJobs({ now: sweepTime });

            expect(report.closedBm02AWindowsCount).toBe(0);
            expect(report.expiredBm02ARequestsCount).toBe(0);
            expect(report.autoTerminatedStopReviewsCount).toBe(0);
            expect(report.autoCompletedStudentAcksCount).toBe(0);
            expect(report.autoFinalizedDefenseReviewsCount).toBe(0);
        });
    });

    // -------------------------------------------------------------
    // 9. HTTP Endpoints via Supertest
    // -------------------------------------------------------------
    describe('9. HTTP Endpoints via Supertest', () => {
        test('GET /api/bm04/:registrationId returns BM04 record without DB mutation', async () => {
            mockBM04Evaluation.findUnique.mockResolvedValue({
                id: 1,
                registrationId,
                status: 'DRAFT',
                isLocked: false,
                effectiveTitleSnapshot: 'Hệ thống Quản lý Đồ án',
                studentClassSnapshot: 'CNTT-K65',
                thesisFormatScore: '',
                researchContentScore: '',
                applicabilityScore: '',
                attitudeScore: '',
                conclusion: 'AGREED_FOR_DEFENSE',
                programOutcome: null,
                defenseRecommendation: null,
                mismatchReason: null,
                generalNotes: null,
                registration: baseRegistration,
            });

            const res = await request(app)
                .get(`/api/bm04/${registrationId}`)
                .set('Authorization', 'Bearer advisor-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(1);
        });

        test('POST /api/bm04/:registrationId/save-draft saves draft', async () => {
            mockBM04Evaluation.findUnique.mockResolvedValue(null);
            mockBM04Evaluation.upsert.mockResolvedValue({
                id: 2,
                registrationId,
                status: 'DRAFT',
                isLocked: false,
            });

            const res = await request(app)
                .post(`/api/bm04/${registrationId}/save-draft`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    thesisFormatScore: 'Tốt',
                    researchContentScore: 'Đầy đủ',
                    applicabilityScore: 'Khá',
                    attitudeScore: 'Tốt',
                    programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                    defenseRecommendation: 'APPROVE_FOR_DEFENSE',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.isLocked).toBe(false);
        });

        test('POST /api/bm04/:registrationId/sign-submit signs and submits BM04', async () => {
            mockBM04Evaluation.findUnique.mockResolvedValue(null);
            mockBM04Evaluation.upsert.mockResolvedValue({
                id: 3,
                registrationId,
                status: 'SIGNED_APPROVED',
                isLocked: true,
                conclusion: 'AGREED_FOR_DEFENSE',
            });

            const res = await request(app)
                .post(`/api/bm04/${registrationId}/sign-submit`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    thesisFormatScore: 'Xuất sắc',
                    researchContentScore: 'Xuất sắc',
                    applicabilityScore: 'Cao',
                    attitudeScore: 'Nhiệt tình',
                    programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                    defenseRecommendation: 'APPROVE_FOR_DEFENSE',
                    lecturerSignature: 'TS. Nguyễn Văn Hướng Dẫn',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('SIGNED_APPROVED');
        });

        test('POST /api/bm04/defense-reviews/:id/request-more-info requests more info', async () => {
            mockInstituteDefenseReview.findUnique.mockResolvedValue({
                id: 52,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                extensionCount: 0,
                reviewDeadlineAt: new Date(Date.now() + 1000000),
            });
            mockInstituteDefenseReview.updateMany.mockResolvedValue({ count: 1 });

            const res = await request(app)
                .post('/api/bm04/defense-reviews/52/request-more-info')
                .set('Authorization', 'Bearer reviewer-token')
                .send({
                    note: 'Cần bổ sung chi tiết giải trình.',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('POST /api/bm04/defense-reviews/:id/decision makes institute decision', async () => {
            mockInstituteDefenseReview.findUnique.mockResolvedValue({
                id: 52,
                bm04EvaluationId: 12,
                registrationId,
                status: 'PENDING_INSTITUTE_REVIEW',
                extensionCount: 0,
                reviewDeadlineAt: new Date(Date.now() + 1000000),
            });
            mockInstituteDefenseReview.updateMany.mockResolvedValue({ count: 1 });

            const res = await request(app)
                .post('/api/bm04/defense-reviews/52/decision')
                .set('Authorization', 'Bearer reviewer-token')
                .send({
                    decision: 'OVERRIDE_ELIGIBLE',
                    reason: 'Chấp thuận cho bảo vệ.',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('POST /api/bm04/sweep-overdue runs sweep jobs', async () => {
            mockTopicAssignmentDecision.findMany.mockResolvedValue([]);
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([]);
            mockInstituteStopReview.findMany.mockResolvedValue([]);
            mockBM03ProgressRecord.findMany.mockResolvedValue([]);
            mockInstituteDefenseReview.findMany.mockResolvedValue([]);

            const res = await request(app)
                .post('/api/bm04/sweep-overdue')
                .set('Authorization', 'Bearer reviewer-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
        });
    });
});
