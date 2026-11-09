jest.mock('../../src/config/database', () => ({
    user: { findUnique: jest.fn() },
    councilMember: { findFirst: jest.fn() },
    topicRegistration: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
}));

jest.mock('../../src/services/outlineReviewService', () => ({
    submitInitialOutline: jest.fn(),
    submitResubmissionOutline: jest.fn(),
    publishCouncilSchedule: jest.fn(),
    saveDraftResults: jest.fn(),
    completeSecretaryReview: jest.fn(),
    returnResultsToSecretary: jest.fn(),
    publishCouncilResults: jest.fn(),
    setRevisionDeadline: jest.fn(),
    reviewResubmission: jest.fn(),
    reopenCouncilResults: jest.fn(),
    finalizeOverdueResubmissions: jest.fn(),
}));

jest.mock('../../src/services/outlineAutoSetupService', () => ({
    runAutoOutlineCouncilSetupForSemester: jest.fn(),
}));

jest.mock('../../src/services/outlineSweepService', () => ({
    isResubmissionOverdue: jest.fn(),
}));

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../../src/config/database');
const outlineReviewService = require('../../src/services/outlineReviewService');
const outlineAutoSetupService = require('../../src/services/outlineAutoSetupService');
const outlineSweepService = require('../../src/services/outlineSweepService');
const { ConflictError, BadRequestError, UnprocessableEntityError } = require('../../src/utils/errors');
const app = require('../../src/app');

function makeUser(id, role, permissions = []) {
    return {
        id,
        role,
        email: `${role.toLowerCase()}_${id}@test.local`,
        fullName: `${role} User ${id}`,
        code: `${role}-${id}`,
        isActive: true,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                code: `GRP_${id}`,
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
    };
}

describe('Integration - Outline Review & Council Routes (Task 4)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'task4-test-jwt-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'chairman-token') return { userId: 30, role: 'LECTURER' };
            if (token === 'secretary-token') return { userId: 31, role: 'LECTURER' };
            if (token === 'outsider-token') return { userId: 32, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 10) return makeUser(10, 'STUDENT', ['SUBMIT_BM01', 'VIEW_MY_REGISTRATION']);
            if (where.id === 30) return makeUser(30, 'LECTURER', ['OUTLINE_REVIEW']);
            if (where.id === 31) return makeUser(31, 'LECTURER', ['OUTLINE_REVIEW']);
            if (where.id === 32) return makeUser(32, 'LECTURER', ['OUTLINE_REVIEW']);
            if (where.id === 1) return makeUser(1, 'ADMIN', []);
            return null;
        });

        prisma.councilMember.findFirst.mockImplementation(async ({ where }) => {
            if (where.councilId === 100) {
                if (where.lecturerId === 30) {
                    return { id: 1, councilId: 100, lecturerId: 30, roleInCouncil: 'CHAIRMAN' };
                }
                if (where.lecturerId === 31) {
                    return { id: 2, councilId: 100, lecturerId: 31, roleInCouncil: 'SECRETARY' };
                }
            }
            return null;
        });
    });

    describe('1. Sinh viên Endpoints (/api/outline)', () => {
        const fileData = {
            fileUrl: 'https://storage.test/decuong.pdf',
            fileName: 'decuong.pdf',
            fileSize: 102400,
            mimeType: 'application/pdf',
        };

        test('POST /api/outline/submissions - returns 200 on success', async () => {
            outlineReviewService.submitInitialOutline.mockResolvedValue({
                registrationId: 50,
                status: 'BM01_SUBMITTED',
            });

            const res = await request(app)
                .post('/api/outline/submissions')
                .set('Authorization', 'Bearer student-token')
                .send({ registrationId: 50, fileData });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(outlineReviewService.submitInitialOutline).toHaveBeenCalledWith(50, fileData, 10);
        });

        test('POST /api/outline/submissions - returns 409 when v1 already submitted', async () => {
            outlineReviewService.submitInitialOutline.mockRejectedValue(
                new ConflictError('INITIAL_SUBMISSION_ALREADY_USED')
            );

            const res = await request(app)
                .post('/api/outline/submissions')
                .set('Authorization', 'Bearer student-token')
                .send({ registrationId: 50, fileData });

            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('INITIAL_SUBMISSION_ALREADY_USED');
        });

        test('POST /api/outline/submissions - returns 400 when missing fileData', async () => {
            const res = await request(app)
                .post('/api/outline/submissions')
                .set('Authorization', 'Bearer student-token')
                .send({ registrationId: 50 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        test('POST /api/outline/submissions - returns 403 when user is outsider lecturer', async () => {
            const res = await request(app)
                .post('/api/outline/submissions')
                .set('Authorization', 'Bearer outsider-token')
                .send({ registrationId: 50, fileData });

            expect(res.status).toBe(403);
        });

        test('POST /api/outline/resubmissions - returns 200 on success', async () => {
            outlineReviewService.submitResubmissionOutline.mockResolvedValue({
                registrationId: 50,
                status: 'BM01_RESUBMITTED',
            });

            const res = await request(app)
                .post('/api/outline/resubmissions')
                .set('Authorization', 'Bearer student-token')
                .send({ registrationId: 50, fileData });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(outlineReviewService.submitResubmissionOutline).toHaveBeenCalledWith(50, fileData, 10);
        });

        test('POST /api/outline/resubmissions - returns 409 when v2 already submitted', async () => {
            outlineReviewService.submitResubmissionOutline.mockRejectedValue(
                new ConflictError('RESUBMISSION_ALREADY_USED')
            );

            const res = await request(app)
                .post('/api/outline/resubmissions')
                .set('Authorization', 'Bearer student-token')
                .send({ registrationId: 50, fileData });

            expect(res.status).toBe(409);
            expect(res.body.message).toBe('RESUBMISSION_ALREADY_USED');
        });

        test('GET /api/outline/my-outline - returns outline data and isOverdue flag without changing DB', async () => {
            const mockRegistration = {
                id: 50,
                studentId: 10,
                status: 'BM01_NEEDS_REVISION',
                outlineCouncil: { id: 100, revisionSubmissionDeadline: '2026-11-01T00:00:00.000Z' },
            };
            prisma.topicRegistration.findFirst.mockResolvedValue(mockRegistration);
            outlineSweepService.isResubmissionOverdue.mockReturnValue(true);

            const res = await request(app)
                .get('/api/outline/my-outline?semesterId=1')
                .set('Authorization', 'Bearer student-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.isOverdue).toBe(true);
            expect(res.body.data.id).toBe(50);
        });
    });

    describe('2. Admin Endpoints', () => {
        test('POST /api/councils/auto-assign-outline - returns 200 when called by Admin', async () => {
            outlineAutoSetupService.runAutoOutlineCouncilSetupForSemester.mockResolvedValue({
                createdCouncils: 2,
                assignedStudents: 15,
                skippedStudents: [],
                warnings: [],
            });

            const res = await request(app)
                .post('/api/councils/auto-assign-outline')
                .set('Authorization', 'Bearer admin-token')
                .send({ semesterId: 1 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(outlineAutoSetupService.runAutoOutlineCouncilSetupForSemester).toHaveBeenCalledWith(
                1,
                expect.objectContaining({ actorId: 1 })
            );
        });

        test('POST /api/councils/auto-assign-outline - returns 403 when called by student', async () => {
            const res = await request(app)
                .post('/api/councils/auto-assign-outline')
                .set('Authorization', 'Bearer student-token')
                .send({ semesterId: 1 });

            expect(res.status).toBe(403);
        });

        test('POST /api/councils/:id/results/reopen - returns 409 with blockingRegistrations when BM02 exists', async () => {
            const blocking = [{ registrationId: 50, studentName: 'Nguyen Van A', bm02Status: 'BM02_SUBMITTED' }];
            outlineReviewService.reopenCouncilResults.mockRejectedValue(
                new ConflictError('BM02_DEPENDENCY_EXISTS', { blockingRegistrations: blocking })
            );

            const res = await request(app)
                .post('/api/councils/100/results/reopen')
                .set('Authorization', 'Bearer admin-token')
                .send({ reason: 'Phúc khảo điểm sinh viên' });

            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('BM02_DEPENDENCY_EXISTS');
            expect(res.body.blockingRegistrations).toEqual(blocking);
        });

        test('POST /api/councils/:id/results/reopen - returns 200 when reopening succeeds', async () => {
            outlineReviewService.reopenCouncilResults.mockResolvedValue({
                newBatch: { id: 10, status: 'REOPENED', versionNumber: 2 },
            });

            const res = await request(app)
                .post('/api/councils/100/results/reopen')
                .set('Authorization', 'Bearer admin-token')
                .send({ reason: 'Lỗi nhập nhầm điểm' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(outlineReviewService.reopenCouncilResults).toHaveBeenCalledWith(
                100,
                'Lỗi nhập nhầm điểm',
                1
            );
        });

        test('POST /api/councils/:id/results/reopen - returns 403 when non-admin calls', async () => {
            const res = await request(app)
                .post('/api/councils/100/results/reopen')
                .set('Authorization', 'Bearer chairman-token')
                .send({ reason: 'Lỗi nhập nhầm' });

            expect(res.status).toBe(403);
        });
    });

    describe('3. Chủ tịch & Thư ký Hội đồng Endpoints', () => {
        test('PUT /api/councils/:id/schedule - Chairman returns 200', async () => {
            outlineReviewService.publishCouncilSchedule.mockResolvedValue({
                id: 100,
                defenseDate: '2026-11-15T08:00:00.000Z',
            });

            const schedulePayload = {
                defenseDate: '2026-11-15T08:00:00.000Z',
                meetingMode: 'IN_PERSON',
                location: 'Phòng A101',
            };

            const res = await request(app)
                .put('/api/councils/100/schedule')
                .set('Authorization', 'Bearer chairman-token')
                .send(schedulePayload);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(outlineReviewService.publishCouncilSchedule).toHaveBeenCalledWith(
                100,
                schedulePayload,
                30
            );
        });

        test('PUT /api/councils/:id/schedule - Non-chair returns 403', async () => {
            const res = await request(app)
                .put('/api/councils/100/schedule')
                .set('Authorization', 'Bearer secretary-token')
                .send({
                    defenseDate: '2026-11-15T08:00:00.000Z',
                    meetingMode: 'IN_PERSON',
                    location: 'Phòng A101',
                });

            expect(res.status).toBe(403);
        });

        test('PUT /api/councils/:id/results/:registrationId - Secretary returns 200', async () => {
            outlineReviewService.saveDraftResults.mockResolvedValue({ id: 99, initialOutcome: 'PASS' });

            const draftPayload = {
                initialOutcome: 'PASS',
                attendanceStatus: 'PRESENT',
                comment: 'Đề cương tốt',
                revisionRequirements: null,
            };

            const res = await request(app)
                .put('/api/councils/100/results/50')
                .set('Authorization', 'Bearer secretary-token')
                .send(draftPayload);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(outlineReviewService.saveDraftResults).toHaveBeenCalledWith(
                100,
                50,
                draftPayload,
                31
            );
        });

        test('POST /api/councils/:id/results/secretary-complete - Secretary completes returns 200', async () => {
            outlineReviewService.completeSecretaryReview.mockResolvedValue({
                batchId: 1,
                status: 'PENDING_CHAIR',
            });

            const res = await request(app)
                .post('/api/councils/100/results/secretary-complete')
                .set('Authorization', 'Bearer secretary-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(outlineReviewService.completeSecretaryReview).toHaveBeenCalledWith(100, 31);
        });

        test('POST /api/councils/:id/results/return - Chairman returns list with reason', async () => {
            outlineReviewService.returnResultsToSecretary.mockResolvedValue({
                batchId: 1,
                status: 'RETURNED_TO_SECRETARY',
            });

            const res = await request(app)
                .post('/api/councils/100/results/return')
                .set('Authorization', 'Bearer chairman-token')
                .send({ returnReason: 'Thiếu nhận xét sinh viên 50' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(outlineReviewService.returnResultsToSecretary).toHaveBeenCalledWith(
                100,
                'Thiếu nhận xét sinh viên 50',
                30
            );
        });

        test('POST /api/councils/:id/results/publish - Chairman publishes results with Idempotency-Key', async () => {
            outlineReviewService.publishCouncilResults.mockResolvedValue({
                batchId: 1,
                status: 'PUBLISHED',
                publishedResultsCount: 5,
            });

            const res = await request(app)
                .post('/api/councils/100/results/publish')
                .set('Authorization', 'Bearer chairman-token')
                .set('Idempotency-Key', 'pub-key-123');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(outlineReviewService.publishCouncilResults).toHaveBeenCalledWith(
                100,
                30,
                'pub-key-123'
            );
        });

        test('POST /api/councils/:id/results/publish - returns 422 if Idempotency-Key reused with mismatch', async () => {
            outlineReviewService.publishCouncilResults.mockRejectedValue(
                new UnprocessableEntityError('IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH')
            );

            const res = await request(app)
                .post('/api/councils/100/results/publish')
                .set('Authorization', 'Bearer chairman-token')
                .set('Idempotency-Key', 'pub-key-123');

            expect(res.status).toBe(422);
            expect(res.body.message).toBe('IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH');
        });

        test('PUT /api/councils/:id/revision-deadline - Chairman sets deadline returns 200', async () => {
            outlineReviewService.setRevisionDeadline.mockResolvedValue({
                councilId: 100,
                revisionSubmissionDeadline: '2026-11-20T23:59:59.000Z',
            });

            const res = await request(app)
                .put('/api/councils/100/revision-deadline')
                .set('Authorization', 'Bearer chairman-token')
                .send({ revisionDeadline: '2026-11-20T23:59:59.000Z' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(outlineReviewService.setRevisionDeadline).toHaveBeenCalledWith(
                100,
                '2026-11-20T23:59:59.000Z',
                30
            );
        });

        test('POST /api/councils/:id/resubmissions/:registrationId/review - Chairman reviews resubmission returns 200', async () => {
            outlineReviewService.reviewResubmission.mockResolvedValue({
                registrationId: 50,
                status: 'BM01_PASSED',
            });

            const res = await request(app)
                .post('/api/councils/100/resubmissions/50/review')
                .set('Authorization', 'Bearer chairman-token')
                .send({ decision: 'APPROVE', revisionFeedback: 'Đạt yêu cầu' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(outlineReviewService.reviewResubmission).toHaveBeenCalledWith(
                100,
                50,
                'APPROVE',
                'Đạt yêu cầu',
                30
            );
        });

        test('POST /api/councils/:id/finalize-resubmissions - Chairman or Admin can finalize overdue', async () => {
            outlineReviewService.finalizeOverdueResubmissions.mockResolvedValue({
                terminatedCount: 2,
                affectedRegistrationIds: [51, 52],
            });

            const res = await request(app)
                .post('/api/councils/100/finalize-resubmissions')
                .set('Authorization', 'Bearer chairman-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(outlineReviewService.finalizeOverdueResubmissions).toHaveBeenCalledWith(100, 30);
        });

        test('POST /api/councils/:id/finalize-resubmissions - Outsider lecturer returns 403', async () => {
            const res = await request(app)
                .post('/api/councils/100/finalize-resubmissions')
                .set('Authorization', 'Bearer outsider-token');

            expect(res.status).toBe(403);
        });
    });
});
