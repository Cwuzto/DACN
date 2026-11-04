const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
    topicRegistration: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    projectArchive: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), upsert: jest.fn(), count: jest.fn() },
    manualReviewCase: { findMany: jest.fn(), createMany: jest.fn(), update: jest.fn(), upsert: jest.fn(), create: jest.fn() },
    notification: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    resultPublicationItem: { findFirst: jest.fn() },
};

mockDatabase.$transaction.mockImplementation(async (cb) => cb(mockDatabase));

jest.mock('../../src/config/database', () => mockDatabase);

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/notificationService', () => ({
    safeNotify: jest.fn().mockResolvedValue({ ok: true }),
    safeNotifyMany: jest.fn().mockResolvedValue({ ok: true, count: 0 }),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const prisma = require('../../src/config/database');
const { auditLog } = require('../../src/services/auditLogService');
const { safeNotify } = require('../../src/services/notificationService');
const app = require('../../src/app');

// Require the backfill script (to be implemented)
let backfillArchivePhases;
let classifyArchiveRecord;
try {
    const backfillModule = require('../../scripts/migrations/backfillArchivePhases');
    backfillArchivePhases = backfillModule.backfillArchivePhases;
    classifyArchiveRecord = backfillModule.classifyArchiveRecord;
} catch (e) {
    // Expected before file creation in TDD
    backfillArchivePhases = null;
    classifyArchiveRecord = null;
}

const permissionGroups = (...codes) => [{
    permissionGroup: {
        code: 'TEST_GROUP',
        permissions: codes.map((code) => ({ permission: { code } })),
    },
}];

describe('Pre-defense Archive & Backfill Verification (H03)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token-1') return { userId: 10, role: 'STUDENT' };
            if (token === 'student-token-2') return { userId: 11, role: 'STUDENT' };
            if (token === 'lecturer-token') return { userId: 20, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 10) {
                return {
                    id: 10,
                    fullName: 'Sinh Vien Chu So Huu',
                    code: 'SV001',
                    role: 'STUDENT',
                    isActive: true,
                };
            }
            if (where.id === 11) {
                return {
                    id: 11,
                    fullName: 'Sinh Vien Khac',
                    code: 'SV002',
                    role: 'STUDENT',
                    isActive: true,
                };
            }
            if (where.id === 20) {
                return {
                    id: 20,
                    fullName: 'GVHD Nguyen Van A',
                    code: 'GV001',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: permissionGroups('FINAL_DOCUMENT_REVIEW'),
                };
            }
            if (where.id === 1) {
                return {
                    id: 1,
                    fullName: 'Quan Tri Vien',
                    code: 'AD001',
                    role: 'ADMIN',
                    isActive: true,
                    permissionGroups: permissionGroups('FINAL_DOCUMENT_REVIEW', 'PROJECT_ASSIGNMENT_PUBLISH'),
                };
            }
            return null;
        });
    });

    describe('1. Backfill Archive Phases Unit/Integration Classification', () => {
        it('should correctly classify legacy records with DEFENSE_PASSED as POST_DEFENSE', async () => {
            expect(typeof backfillArchivePhases).toBe('function');
            expect(typeof classifyArchiveRecord).toBe('function');

            const legacyRecordDefensePassed = {
                id: 1,
                registrationId: 101,
                status: 'APPROVED',
            };
            const registrationDefensePassed = {
                id: 101,
                status: 'DEFENSE_PASSED',
            };

            const result1 = classifyArchiveRecord(legacyRecordDefensePassed, registrationDefensePassed);
            expect(result1.phase).toBe('POST_DEFENSE');
            expect(result1.requiresManualReview).toBe(false);

            const resultDefended = classifyArchiveRecord(
                { id: 2, registrationId: 102 },
                { id: 102, status: 'DEFENDED' }
            );
            expect(resultDefended.phase).toBe('POST_DEFENSE');
            expect(resultDefended.requiresManualReview).toBe(false);

            const resultCompleted = classifyArchiveRecord(
                { id: 3, registrationId: 103 },
                { id: 103, status: 'COMPLETED' }
            );
            expect(resultCompleted.phase).toBe('POST_DEFENSE');
            expect(resultCompleted.requiresManualReview).toBe(false);
        });

        it('should flag unverified legacy archive records for ManualReviewCase instead of blind defaulting', async () => {
            expect(typeof backfillArchivePhases).toBe('function');

            // Record whose registration is not defended (e.g. IN_PROGRESS or BM03_PASSED or DEFENSE_FAILED)
            const legacyRecordUnverified = {
                id: 4,
                registrationId: 104,
                status: 'SUBMITTED',
            };
            const registrationInProgress = {
                id: 104,
                status: 'IN_PROGRESS',
            };

            const result = classifyArchiveRecord(legacyRecordUnverified, registrationInProgress);
            expect(result.requiresManualReview).toBe(true);
            expect(result.phase).toBeNull();
            expect(result.reasons).toContain('UNVERIFIED_LEGACY_ARCHIVE_PHASE');

            // Running backfill in apply mode on unverified records creates ManualReviewCase
            prisma.projectArchive.findMany.mockResolvedValue([
                {
                    id: 4,
                    registrationId: 104,
                    status: 'SUBMITTED',
                    registration: { id: 104, status: 'IN_PROGRESS' },
                },
                {
                    id: 5,
                    registrationId: 105,
                    status: 'APPROVED',
                    registration: { id: 105, status: 'DEFENSE_PASSED' },
                },
            ]);
            prisma.manualReviewCase.findMany.mockResolvedValue([]);
            prisma.projectArchive.update.mockResolvedValue({ id: 5, phase: 'POST_DEFENSE' });
            prisma.manualReviewCase.createMany.mockResolvedValue({ count: 1 });

            const summary = await backfillArchivePhases({ dryRun: false, db: prisma });
            expect(summary.postDefenseCount).toBe(1);
            expect(summary.manualReviewCount).toBe(1);
            expect(prisma.manualReviewCase.createMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.arrayContaining([
                        expect.objectContaining({
                            registrationId: 104,
                            reasonCodes: expect.arrayContaining(['UNVERIFIED_LEGACY_ARCHIVE_PHASE']),
                        }),
                    ]),
                })
            );
        });

        it('should support dry-run mode without modifying database records', async () => {
            expect(typeof backfillArchivePhases).toBe('function');

            prisma.projectArchive.findMany.mockResolvedValue([
                {
                    id: 10,
                    registrationId: 200,
                    status: 'APPROVED',
                    registration: { id: 200, status: 'COMPLETED' },
                },
            ]);

            const summary = await backfillArchivePhases({ dryRun: true, db: prisma });
            expect(summary.mode).toBe('dry-run');
            expect(summary.postDefenseCount).toBe(1);
            expect(prisma.projectArchive.update).not.toHaveBeenCalled();
            expect(prisma.manualReviewCase.createMany).not.toHaveBeenCalled();
        });
    });

    describe('2. Endpoint POST /api/archives/pre-defense', () => {
        it('should allow student in BM03_PASSED to submit pre-defense archive', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'BM03_PASSED',
                topic: {
                    id: 50,
                    mentorId: 20,
                    title: 'Xây dựng hệ thống IoT thông minh',
                },
            });

            prisma.projectArchive.upsert.mockResolvedValue({
                id: 99,
                registrationId: 101,
                phase: 'PRE_DEFENSE',
                status: 'SUBMITTED',
                reportFileUrl: 'https://example.com/draft-report.pdf',
                reportFileName: 'draft-report.pdf',
                slideFileUrl: 'https://example.com/draft-slide.pptx',
                slideFileName: 'draft-slide.pptx',
                sourceCodeUrl: 'https://github.com/student/iot-project',
                summary: 'Bản thảo báo cáo và slide nộp sơ bộ để thẩm định BM04',
            });

            const res = await request(app)
                .post('/api/archives/pre-defense')
                .set('Authorization', 'Bearer student-token-1')
                .send({
                    registrationId: 101,
                    reportFileUrl: 'https://example.com/draft-report.pdf',
                    reportFileName: 'draft-report.pdf',
                    slideFileUrl: 'https://example.com/draft-slide.pptx',
                    slideFileName: 'draft-slide.pptx',
                    sourceCodeUrl: 'https://github.com/student/iot-project',
                    notes: 'Bản thảo báo cáo và slide nộp sơ bộ để thẩm định BM04',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.phase).toBe('PRE_DEFENSE');
            expect(res.body.data.status).toBe('SUBMITTED');

            // Verify upsert was called with phase: 'PRE_DEFENSE'
            expect(prisma.projectArchive.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { registrationId: 101 },
                    create: expect.objectContaining({
                        registrationId: 101,
                        phase: 'PRE_DEFENSE',
                        status: 'SUBMITTED',
                    }),
                    update: expect.objectContaining({
                        phase: 'PRE_DEFENSE',
                        status: 'SUBMITTED',
                    }),
                })
            );

            // Verify safeNotify was sent to mentor
            expect(safeNotify).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 20,
                    type: 'SUBMISSION',
                }),
                expect.any(String)
            );

            // Verify auditLog was recorded
            expect(auditLog).toHaveBeenCalledWith(
                10,
                'SUBMIT_PRE_DEFENSE_ARCHIVE',
                'PROJECT_ARCHIVE',
                expect.anything(),
                expect.anything(),
                expect.anything()
            );
        });

        it('should reject pre-defense archive if student is not owner of the registration', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10, // Owner is 10
                status: 'BM03_PASSED',
                topic: { mentorId: 20 },
            });

            const res = await request(app)
                .post('/api/archives/pre-defense')
                .set('Authorization', 'Bearer student-token-2') // Caller is 11
                .send({
                    registrationId: 101,
                    reportFileUrl: 'https://example.com/draft.pdf',
                });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });

        it('should reject pre-defense archive if registration is not in BM03_PASSED status', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'IN_PROGRESS', // Not BM03_PASSED
                topic: { mentorId: 20 },
            });

            const res = await request(app)
                .post('/api/archives/pre-defense')
                .set('Authorization', 'Bearer student-token-1')
                .send({
                    registrationId: 101,
                    reportFileUrl: 'https://example.com/draft.pdf',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/BM03_PASSED/);
        });

        it('should reject pre-defense archive if no files or urls are provided', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'BM03_PASSED',
                topic: { mentorId: 20 },
            });

            const res = await request(app)
                .post('/api/archives/pre-defense')
                .set('Authorization', 'Bearer student-token-1')
                .send({
                    registrationId: 101,
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe('3. Query GET /api/archives/registrations/:registrationId with phase info', () => {
        it('should return phase information and categorized documents', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'BM03_PASSED',
                topic: { mentorId: 20, title: 'IoT' },
                archive: {
                    id: 99,
                    registrationId: 101,
                    phase: 'PRE_DEFENSE',
                    status: 'SUBMITTED',
                    reportFileUrl: 'https://example.com/draft.pdf',
                    reportFileName: 'draft.pdf',
                    slideFileUrl: 'https://example.com/slide.pdf',
                    sourceCodeUrl: 'https://github.com/repo',
                    summary: 'Ghi chú sơ bộ',
                },
                resultPublicationItems: [],
            });

            const res = await request(app)
                .get('/api/archives/registrations/101')
                .set('Authorization', 'Bearer student-token-1');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.archive.phase).toBe('PRE_DEFENSE');
            expect(res.body.data.phase).toBe('PRE_DEFENSE');
            expect(res.body.data.preDefenseDocuments).toBeDefined();
            expect(res.body.data.preDefenseDocuments.reportFileUrl).toBe('https://example.com/draft.pdf');
        });
    });
});
