const prisma = require('../../src/config/database');
const {
    Prisma,
    CouncilMeetingMode,
    CouncilBatchStatus,
    OutlineInitialOutcome,
    OutlineRevisionApprovalStatus,
    AttendanceStatus,
    TaskType,
    RegistrationStatus,
    SemesterScalarFieldEnum,
    CouncilScalarFieldEnum,
    CouncilResultBatchScalarFieldEnum,
    BM01EvaluationScalarFieldEnum,
} = require('@prisma/client');

describe('Prisma Schema Validation for Outline Review & Dossier Management (Task 1)', () => {
    describe('New Enums', () => {
        it('should define CouncilMeetingMode enum correctly', () => {
            expect(CouncilMeetingMode).toBeDefined();
            expect(CouncilMeetingMode).toEqual({
                IN_PERSON: 'IN_PERSON',
                MICROSOFT_TEAMS: 'MICROSOFT_TEAMS',
            });
        });

        it('should define CouncilBatchStatus enum correctly', () => {
            expect(CouncilBatchStatus).toBeDefined();
            expect(CouncilBatchStatus).toEqual({
                DRAFT: 'DRAFT',
                PENDING_CHAIR: 'PENDING_CHAIR',
                PUBLISHED: 'PUBLISHED',
                SUPERSEDED: 'SUPERSEDED',
                REOPENED: 'REOPENED',
            });
        });

        it('should define OutlineInitialOutcome enum correctly', () => {
            expect(OutlineInitialOutcome).toBeDefined();
            expect(OutlineInitialOutcome).toEqual({
                PASS: 'PASS',
                REVISION_REQUIRED: 'REVISION_REQUIRED',
                FAIL: 'FAIL',
                ABSENT: 'ABSENT',
            });
        });

        it('should define OutlineRevisionApprovalStatus enum correctly', () => {
            expect(OutlineRevisionApprovalStatus).toBeDefined();
            expect(OutlineRevisionApprovalStatus).toEqual({
                NOT_REQUIRED: 'NOT_REQUIRED',
                PENDING: 'PENDING',
                APPROVED: 'APPROVED',
                REJECTED: 'REJECTED',
            });
        });

        it('should define AttendanceStatus enum correctly', () => {
            expect(AttendanceStatus).toBeDefined();
            expect(AttendanceStatus).toEqual({
                PRESENT: 'PRESENT',
                ABSENT: 'ABSENT',
                EXCUSED: 'EXCUSED',
            });
        });

        it('should have new values in TaskType enum', () => {
            expect(TaskType).toEqual(
                expect.objectContaining({
                    BM01_INITIAL_SUBMISSION: 'BM01_INITIAL_SUBMISSION',
                    BM01_RESUBMISSION: 'BM01_RESUBMISSION',
                })
            );
        });

        it('should have new value BM01_RESUBMITTED in RegistrationStatus enum', () => {
            expect(RegistrationStatus).toEqual(
                expect.objectContaining({
                    BM01_RESUBMITTED: 'BM01_RESUBMITTED',
                })
            );
        });
    });

    describe('Model CouncilResultBatch', () => {
        it('should be registered in Prisma.ModelName', () => {
            expect(Prisma.ModelName?.CouncilResultBatch).toBe('CouncilResultBatch');
        });

        it('should have client delegate on prisma instance', () => {
            expect(prisma.councilResultBatch).toBeDefined();
            expect(typeof prisma.councilResultBatch?.findMany).toBe('function');
            expect(typeof prisma.councilResultBatch?.create).toBe('function');
        });

        it('should have all expected scalar fields', () => {
            expect(CouncilResultBatchScalarFieldEnum).toBeDefined();
            expect(CouncilResultBatchScalarFieldEnum).toEqual(
                expect.objectContaining({
                    id: 'id',
                    councilId: 'councilId',
                    versionNumber: 'versionNumber',
                    status: 'status',
                    secretaryCompletedAt: 'secretaryCompletedAt',
                    secretaryCompletedById: 'secretaryCompletedById',
                    chairPublishedAt: 'chairPublishedAt',
                    chairPublishedById: 'chairPublishedById',
                    returnedAt: 'returnedAt',
                    returnedById: 'returnedById',
                    returnReason: 'returnReason',
                    reopenedAt: 'reopenedAt',
                    reopenedById: 'reopenedById',
                    reopenReason: 'reopenReason',
                    createdAt: 'createdAt',
                    updatedAt: 'updatedAt',
                })
            );
        });
    });

    describe('Model Semester Updates', () => {
        it('should have outline submission and template configuration fields', () => {
            expect(SemesterScalarFieldEnum).toEqual(
                expect.objectContaining({
                    outlineSubmissionOpenAt: 'outlineSubmissionOpenAt',
                    outlineSubmissionDeadline: 'outlineSubmissionDeadline',
                    outlineTemplateFileUrl: 'outlineTemplateFileUrl',
                    outlineTemplateFileId: 'outlineTemplateFileId',
                    outlineAllowedExtensions: 'outlineAllowedExtensions',
                    outlineMaxFileSizeBytes: 'outlineMaxFileSizeBytes',
                })
            );
        });
    });

    describe('Model Council Updates', () => {
        it('should have meeting mode, audit, and lifecycle fields', () => {
            expect(CouncilScalarFieldEnum).toEqual(
                expect.objectContaining({
                    meetingMode: 'meetingMode',
                    meetingUrl: 'meetingUrl',
                    schedulePublishedAt: 'schedulePublishedAt',
                    revisionSubmissionDeadline: 'revisionSubmissionDeadline',
                    isActive: 'isActive',
                    deletedAt: 'deletedAt',
                    rowVersion: 'rowVersion',
                })
            );
        });
    });

    describe('Model BM01Evaluation Updates', () => {
        it('should have council review and revision tracking scalar fields', () => {
            expect(BM01EvaluationScalarFieldEnum).toEqual(
                expect.objectContaining({
                    councilId: 'councilId',
                    batchId: 'batchId',
                    initialOutcome: 'initialOutcome',
                    attendanceStatus: 'attendanceStatus',
                    comment: 'comment',
                    revisionRequirements: 'revisionRequirements',
                    revisionSubmissionId: 'revisionSubmissionId',
                    revisionApprovalStatus: 'revisionApprovalStatus',
                    revisionReviewedAt: 'revisionReviewedAt',
                    revisionReviewedById: 'revisionReviewedById',
                    revisionFeedback: 'revisionFeedback',
                })
            );
        });
    });

    describe('Live Database Connectivity & Additive Query Validation', () => {
        it('should query councilResultBatch findMany without error', async () => {
            const batches = await prisma.councilResultBatch.findMany({ take: 1 });
            expect(Array.isArray(batches)).toBe(true);
        });

        it('should select new Semester outline configuration columns without error', async () => {
            const semester = await prisma.semester.findFirst({
                select: {
                    id: true,
                    outlineSubmissionOpenAt: true,
                    outlineSubmissionDeadline: true,
                    outlineTemplateFileUrl: true,
                    outlineTemplateFileId: true,
                    outlineAllowedExtensions: true,
                    outlineMaxFileSizeBytes: true,
                },
            });
            if (semester) {
                expect(semester.outlineAllowedExtensions).toBeDefined();
                expect(typeof semester.outlineMaxFileSizeBytes).toBe('number');
            }
        });

        it('should select new Council meeting and audit columns without error', async () => {
            const council = await prisma.council.findFirst({
                select: {
                    id: true,
                    meetingMode: true,
                    meetingUrl: true,
                    schedulePublishedAt: true,
                    revisionSubmissionDeadline: true,
                    isActive: true,
                    deletedAt: true,
                    rowVersion: true,
                },
            });
            if (council) {
                expect(council.isActive).toBeDefined();
                expect(typeof council.rowVersion).toBe('number');
            }
        });

        it('should select new BM01Evaluation columns without error', async () => {
            const evaluation = await prisma.bM01Evaluation.findFirst({
                select: {
                    id: true,
                    councilId: true,
                    batchId: true,
                    initialOutcome: true,
                    attendanceStatus: true,
                    revisionApprovalStatus: true,
                },
            });
            if (evaluation) {
                expect(evaluation.id).toBeDefined();
            }
        });
    });
});
