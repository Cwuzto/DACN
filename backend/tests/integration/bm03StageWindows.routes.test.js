const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockTopicRegistration = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
};

const mockBM03ProgressRecord = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
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

const mockSemester = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

const mockPeriodWorkflowPolicyVersion = {
    findFirst: jest.fn(),
    create: jest.fn(),
};

const mockUser = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
};

const mockElectronicSignatureEvent = {
    create: jest.fn(),
};

const mockAuditLog = {
    create: jest.fn(),
};

const mockTopicAssignmentDecisionItem = {
    findFirst: jest.fn(),
};

const mockTitleAdjustmentAppendixItem = {
    findFirst: jest.fn(),
};

const mockPrisma = {
    topicRegistration: mockTopicRegistration,
    bM03ProgressRecord: mockBM03ProgressRecord,
    bM03MeetingEntry: mockBM03MeetingEntry,
    bM03StageEvaluation: mockBM03StageEvaluation,
    instituteStopReview: mockInstituteStopReview,
    semester: mockSemester,
    periodWorkflowPolicyVersion: mockPeriodWorkflowPolicyVersion,
    user: mockUser,
    electronicSignatureEvent: mockElectronicSignatureEvent,
    auditLog: mockAuditLog,
    topicAssignmentDecisionItem: mockTopicAssignmentDecisionItem,
    titleAdjustmentAppendixItem: mockTitleAdjustmentAppendixItem,
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

const app = require('../../src/app');
const bm03WorkflowService = require('../../src/services/bm03WorkflowService');

function buildUser({ id, role, permissions = [] }) {
    return {
        id,
        role,
        department: 'CNTT',
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

describe('BM03 Stage Windows, Policy Snapshot & BM01 PDF Lock', () => {
    const adminId = 1;
    const advisorId = 20;
    const studentId = 10;
    const registrationId = 100;
    const bm03RecordId = 500;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-jwt-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: adminId, role: 'ADMIN' };
            if (token === 'advisor-token') return { userId: advisorId, role: 'LECTURER' };
            throw new Error('invalid token');
        });

        mockUser.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === adminId) {
                return buildUser({
                    id: adminId,
                    role: 'ADMIN',
                    permissions: ['SEMESTER_MANAGE', 'PROJECT_ASSIGNMENT_PUBLISH'],
                });
            }
            if (where?.id === advisorId) {
                return buildUser({
                    id: advisorId,
                    role: 'LECTURER',
                    permissions: ['BM03_MEETING_RECORD', 'BM03_STAGE_EVALUATE'],
                });
            }
            return null;
        });

        mockTopicAssignmentDecisionItem.findFirst.mockResolvedValue(null);
        mockTitleAdjustmentAppendixItem.findFirst.mockResolvedValue(null);
        mockInstituteStopReview.findFirst.mockResolvedValue(null);
    });

    describe('Semester BM03 window config & BM01 PDF lock', () => {
        it('rejects POST /api/semesters when bm03MidtermEvaluationOpenAt >= bm03FinalizationOpenAt', async () => {
            const res = await request(app)
                .post('/api/semesters')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    name: 'HK1 2026-2027',
                    startDate: '2026-09-01T00:00:00.000Z',
                    registrationDeadline: '2026-09-15T00:00:00.000Z',
                    endDate: '2027-01-15T00:00:00.000Z',
                    bm03MidtermEvaluationOpenAt: '2026-12-01T00:00:00.000Z',
                    bm03FinalizationOpenAt: '2026-11-15T00:00:00.000Z',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(mockSemester.create).not.toHaveBeenCalled();
        });

        it('normalizes outlineAllowedExtensions to [".pdf"] even if Word extensions are sent on create/update', async () => {
            mockSemester.create.mockImplementation(async ({ data }) => ({
                id: 5,
                ...data,
            }));
            mockPeriodWorkflowPolicyVersion.findFirst.mockResolvedValue(null);
            mockPeriodWorkflowPolicyVersion.create.mockResolvedValue({ id: 11, version: 1 });

            const createRes = await request(app)
                .post('/api/semesters')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    name: 'HK1 2026-2027',
                    startDate: '2026-09-01T00:00:00.000Z',
                    registrationDeadline: '2026-09-15T00:00:00.000Z',
                    endDate: '2027-01-15T00:00:00.000Z',
                    outlineAllowedExtensions: ['.doc', '.docx'],
                    bm03MidtermEvaluationOpenAt: '2026-10-20T00:00:00.000Z',
                    bm03FinalizationOpenAt: '2026-12-10T00:00:00.000Z',
                });

            expect(createRes.status).toBe(201);
            expect(mockSemester.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    outlineAllowedExtensions: ['.pdf'],
                    bm03MidtermEvaluationOpenAt: new Date('2026-10-20T00:00:00.000Z'),
                    bm03FinalizationOpenAt: new Date('2026-12-10T00:00:00.000Z'),
                }),
            }));
            expect(mockPeriodWorkflowPolicyVersion.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    policy: expect.objectContaining({
                        bm03MidtermEvaluationOpenAt: '2026-10-20T00:00:00.000Z',
                        bm03FinalizationOpenAt: '2026-12-10T00:00:00.000Z',
                    }),
                }),
            }));

            mockSemester.findUnique.mockResolvedValue({
                id: 5,
                name: 'HK1 2026-2027',
                startDate: new Date('2026-09-01T00:00:00.000Z'),
                registrationDeadline: new Date('2026-09-15T00:00:00.000Z'),
                endDate: new Date('2027-01-15T00:00:00.000Z'),
                midtermReportDate: null,
                defenseDate: null,
                bm03MidtermEvaluationOpenAt: new Date('2026-10-20T00:00:00.000Z'),
                bm03FinalizationOpenAt: new Date('2026-12-10T00:00:00.000Z'),
                lockedPolicyVersionId: 11,
                registrationOpen: true,
            });
            mockSemester.update.mockImplementation(async ({ data }) => ({ id: 5, ...data }));
            mockPeriodWorkflowPolicyVersion.findFirst.mockResolvedValue({
                id: 11,
                version: 1,
                policy: {
                    bm03MidtermEvaluationOpenAt: '2026-10-20T00:00:00.000Z',
                    bm03FinalizationOpenAt: '2026-12-10T00:00:00.000Z',
                },
            });

            const updateRes = await request(app)
                .put('/api/semesters/5')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    outlineAllowedExtensions: ['.docx'],
                    bm03MidtermEvaluationOpenAt: '2026-10-25T00:00:00.000Z',
                });

            expect(updateRes.status).toBe(200);
            expect(mockSemester.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    outlineAllowedExtensions: ['.pdf'],
                }),
            }));
        });
    });

    describe('assertBM03StageWindow & Stage Evaluation Route Gates', () => {
        it('returns 409 when bm03MidtermEvaluationOpenAt is missing even if Semester.midtermReportDate is in the past', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                id: registrationId,
                studentId,
                status: 'IN_PROGRESS_BM03',
                topic: { id: 42, title: 'Đề tài A', mentorId: advisorId },
                semester: {
                    id: 1,
                    midtermReportDate: new Date('2020-01-01T00:00:00.000Z'),
                    bm03MidtermEvaluationOpenAt: null,
                    bm03FinalizationOpenAt: null,
                },
                periodPolicyVersion: null,
            });

            const res = await request(app)
                .post(`/api/bm03/${registrationId}/midterm-evaluation`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    comments: 'Nhận xét giữa kỳ',
                    decision: 'CONTINUE',
                });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('BM03_MIDTERM_WINDOW_NOT_CONFIGURED');
            expect(mockBM03StageEvaluation.create).not.toHaveBeenCalled();
        });

        it('returns 409 when calling MIDTERM before bm03MidtermEvaluationOpenAt', async () => {
            const futureOpen = new Date(Date.now() + 7 * 24 * 3600 * 1000);
            const futureFinal = new Date(Date.now() + 30 * 24 * 3600 * 1000);

            mockTopicRegistration.findUnique.mockResolvedValue({
                id: registrationId,
                studentId,
                status: 'IN_PROGRESS_BM03',
                topic: { id: 42, title: 'Đề tài A', mentorId: advisorId },
                semester: {
                    id: 1,
                    bm03MidtermEvaluationOpenAt: futureOpen,
                    bm03FinalizationOpenAt: futureFinal,
                },
                periodPolicyVersion: {
                    id: 11,
                    policy: {
                        bm03MidtermEvaluationOpenAt: futureOpen.toISOString(),
                        bm03FinalizationOpenAt: futureFinal.toISOString(),
                    },
                },
            });

            const res = await request(app)
                .post(`/api/bm03/${registrationId}/midterm-evaluation`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    comments: 'Nhận xét giữa kỳ sớm',
                    decision: 'CONTINUE',
                });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('BM03_MIDTERM_NOT_OPEN_YET');
            expect(mockBM03StageEvaluation.create).not.toHaveBeenCalled();
        });

        it('uses registration periodPolicyVersion snapshot even when semester dates are changed later', async () => {
            const snapshotMidterm = new Date('2026-10-01T00:00:00.000Z');
            const snapshotFinal = new Date('2026-12-01T00:00:00.000Z');
            const laterSemesterMidterm = new Date('2099-01-01T00:00:00.000Z');

            const reg = {
                id: registrationId,
                studentId,
                status: 'IN_PROGRESS_BM03',
                topic: { id: 42, title: 'Đề tài A', mentorId: advisorId },
                semester: {
                    id: 1,
                    bm03MidtermEvaluationOpenAt: laterSemesterMidterm,
                    bm03FinalizationOpenAt: new Date('2099-02-01T00:00:00.000Z'),
                },
                periodPolicyVersion: {
                    id: 11,
                    policy: {
                        bm03MidtermEvaluationOpenAt: snapshotMidterm.toISOString(),
                        bm03FinalizationOpenAt: snapshotFinal.toISOString(),
                    },
                },
            };

            expect(() => bm03WorkflowService.assertBM03StageWindow({
                registration: reg,
                stage: 'MIDTERM',
                now: new Date('2026-10-15T00:00:00.000Z'),
            })).not.toThrow();
        });

        it('returns 409 when calling FINAL before bm03FinalizationOpenAt', async () => {
            const pastMidterm = new Date(Date.now() - 10 * 24 * 3600 * 1000);
            const futureFinal = new Date(Date.now() + 10 * 24 * 3600 * 1000);

            mockTopicRegistration.findUnique.mockResolvedValue({
                id: registrationId,
                studentId,
                status: 'IN_PROGRESS_BM03',
                topic: { id: 42, title: 'Đề tài A', mentorId: advisorId },
                semester: {
                    id: 1,
                    bm03MidtermEvaluationOpenAt: pastMidterm,
                    bm03FinalizationOpenAt: futureFinal,
                },
                periodPolicyVersion: {
                    id: 11,
                    policy: {
                        bm03MidtermEvaluationOpenAt: pastMidterm.toISOString(),
                        bm03FinalizationOpenAt: futureFinal.toISOString(),
                    },
                },
            });

            const res = await request(app)
                .post(`/api/bm03/${registrationId}/final-evaluation`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    comments: 'Đánh giá cuối kỳ sớm',
                    decision: 'CONTINUE_TO_BM04',
                });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('BM03_FINAL_NOT_OPEN_YET');
            expect(mockBM03StageEvaluation.create).not.toHaveBeenCalled();
        });

        it('returns 409 when calling FINAL without valid MIDTERM evaluation', async () => {
            const pastMidterm = new Date(Date.now() - 20 * 24 * 3600 * 1000);
            const pastFinal = new Date(Date.now() - 2 * 24 * 3600 * 1000);

            mockTopicRegistration.findUnique.mockResolvedValue({
                id: registrationId,
                studentId,
                status: 'IN_PROGRESS_BM03',
                topic: { id: 42, title: 'Đề tài A', mentorId: advisorId },
                semester: {
                    id: 1,
                    bm03MidtermEvaluationOpenAt: pastMidterm,
                    bm03FinalizationOpenAt: pastFinal,
                },
                periodPolicyVersion: null,
            });
            mockBM03ProgressRecord.findUnique.mockResolvedValue({
                id: bm03RecordId,
                registrationId,
                midtermStageEvaluationId: null,
                finalStageEvaluationId: null,
                isClosedEarly: false,
            });

            const res = await request(app)
                .post(`/api/bm03/${registrationId}/final-evaluation`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    comments: 'Thiếu giữa kỳ',
                    decision: 'CONTINUE_TO_BM04',
                });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('BM03_MIDTERM_EVALUATION_REQUIRED');
        });

        it('returns 409 when calling FINAL while stop review is pending', async () => {
            const pastMidterm = new Date(Date.now() - 20 * 24 * 3600 * 1000);
            const pastFinal = new Date(Date.now() - 2 * 24 * 3600 * 1000);

            mockTopicRegistration.findUnique.mockResolvedValue({
                id: registrationId,
                studentId,
                status: 'STOP_REVIEW_PENDING',
                topic: { id: 42, title: 'Đề tài A', mentorId: advisorId },
                semester: {
                    id: 1,
                    bm03MidtermEvaluationOpenAt: pastMidterm,
                    bm03FinalizationOpenAt: pastFinal,
                },
                periodPolicyVersion: null,
            });
            mockBM03ProgressRecord.findUnique.mockResolvedValue({
                id: bm03RecordId,
                registrationId,
                midtermStageEvaluationId: 10,
                finalStageEvaluationId: null,
                isClosedEarly: false,
            });
            mockInstituteStopReview.findFirst.mockResolvedValue({
                id: 201,
                status: 'STOP_REVIEW_PENDING',
            });

            const res = await request(app)
                .post(`/api/bm03/${registrationId}/final-evaluation`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    comments: 'Đang chờ Viện thẩm định dừng',
                    decision: 'CONTINUE_TO_BM04',
                });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('BM03_STOP_REVIEW_PENDING');
        });

        it('returns 409 when advisor signs whole BM03 before FINAL evaluation or before bm03FinalizationOpenAt', async () => {
            const pastMidterm = new Date(Date.now() - 20 * 24 * 3600 * 1000);
            const futureFinal = new Date(Date.now() + 5 * 24 * 3600 * 1000);

            mockBM03ProgressRecord.findUnique.mockResolvedValue({
                id: bm03RecordId,
                registrationId,
                midtermStageEvaluationId: 10,
                finalStageEvaluationId: 12,
                finalConclusion: 'CONTINUE_TO_BM04',
                isClosedEarly: false,
                advisorSignedAt: null,
                registration: {
                    id: registrationId,
                    status: 'IN_PROGRESS_BM03',
                    topic: { id: 42, title: 'Đề tài A', mentorId: advisorId },
                    semester: {
                        id: 1,
                        bm03MidtermEvaluationOpenAt: pastMidterm,
                        bm03FinalizationOpenAt: futureFinal,
                    },
                    periodPolicyVersion: null,
                },
            });

            const res = await request(app)
                .post(`/api/bm03/${bm03RecordId}/advisor-sign`)
                .set('Authorization', 'Bearer advisor-token')
                .send({ signatureImageId: 'sig-1' });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('BM03_FINAL_NOT_OPEN_YET');
        });

        it('keeps meeting log read-only while stop review is pending, and allows meetings again after reject-stop', async () => {
            mockTopicRegistration.findUnique.mockResolvedValue({
                id: registrationId,
                studentId,
                status: 'STOP_REVIEW_PENDING',
                topic: { id: 42, title: 'Đề tài A', mentorId: advisorId },
            });
            mockBM03ProgressRecord.findUnique.mockResolvedValue({
                id: bm03RecordId,
                registrationId,
                isClosedEarly: false,
                advisorSignedAt: null,
            });
            mockInstituteStopReview.findFirst.mockResolvedValue({
                id: 201,
                status: 'STOP_REVIEW_PENDING',
            });

            const blockedRes = await request(app)
                .post(`/api/bm03/${registrationId}/meetings`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    meetingDate: '2026-11-21T09:00:00.000Z',
                    discussionContent: 'Thử ghi nhật ký khi đang chờ thẩm định',
                    studentCompletedWork: 'Không',
                    nextTasks: 'Chờ',
                    progressRating: 'AT_RISK',
                });

            expect(blockedRes.status).toBe(409);
            expect(blockedRes.body.code).toBe('BM03_READONLY_STOP_REVIEW_PENDING');
            expect(mockBM03MeetingEntry.create).not.toHaveBeenCalled();

            // After Institute rejects stop -> registration is IN_PROGRESS_BM03, no pending stop review
            mockTopicRegistration.findUnique.mockResolvedValue({
                id: registrationId,
                studentId,
                status: 'IN_PROGRESS_BM03',
                topic: { id: 42, title: 'Đề tài A', mentorId: advisorId },
            });
            mockInstituteStopReview.findFirst.mockResolvedValue(null);
            mockBM03MeetingEntry.create.mockResolvedValue({
                id: 301,
                registrationId,
                progressRating: 'ON_TRACK',
            });

            const allowedRes = await request(app)
                .post(`/api/bm03/${registrationId}/meetings`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    meetingDate: '2026-11-23T09:00:00.000Z',
                    discussionContent: 'Tiếp tục hướng dẫn sau khi Viện bác đề nghị dừng',
                    studentCompletedWork: 'Đã bổ sung chương 2',
                    nextTasks: 'Hoàn thiện thực nghiệm',
                    progressRating: 'ON_TRACK',
                });

            expect(allowedRes.status).toBe(201);
            expect(mockBM03MeetingEntry.create).toHaveBeenCalled();
        });
    });
});
