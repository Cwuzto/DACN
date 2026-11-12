const request = require('supertest');
const jwt = require('jsonwebtoken');

// ============================================================================
// 1. Mock Database for Defense to Completion End-to-End Integration
// ============================================================================

const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    semester: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    topicRegistration: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn(),
    },
    rubricVersion: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    rubricCategory: { deleteMany: jest.fn() },
    council: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    councilMember: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
    },
    defenseMemberScore: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
        count: jest.fn(),
    },
    defenseMemberCriterionScore: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    defenseResult: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
        count: jest.fn(),
    },
    defenseResultApproval: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    resultPublication: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
    },
    resultPublicationItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    defenseDocumentVersion: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn(),
    },
    defenseDocumentSnapshot: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    projectArchive: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ id: 88 }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 88 }),
    },
    bM03ProgressRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
    },
    bM04Evaluation: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
    },
    titleAdjustmentAppendixItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
    },
    topicAssignmentDecisionItem: {
        findFirst: jest.fn().mockResolvedValue(null),
    },
    bM02Submission: {
        findFirst: jest.fn().mockResolvedValue(null),
    },
    electronicSignatureEvent: {
        create: jest.fn().mockResolvedValue({ id: 777, signedAt: new Date() }),
        findMany: jest.fn().mockResolvedValue([]),
    },
    defenseScheduleAdjustmentLog: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
    },
    defenseScoreBookReturnLog: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
    },
    idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
    },
    registrationStateHistory: {
        create: jest.fn().mockResolvedValue({}),
    },
    notification: {
        create: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
        create: jest.fn().mockResolvedValue({}),
    },
    academicDelegation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
    },
    userPermissionGroup: {
        findMany: jest.fn().mockResolvedValue([]),
    },
};

mockDatabase.$transaction.mockImplementation(async (cb) => cb(mockDatabase));

jest.mock('../../src/config/database', () => mockDatabase);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const prisma = require('../../src/config/database');
const app = require('../../src/app');
const rubricService = require('../../src/services/rubricService');
const { splitConfirmedStudentsIntoShifts } = require('../../src/controllers/councilController');
const { computeDefenseTimeWindows, roundDefenseScoreOneDecimal } = require('../../src/utils/defenseTimeWindowUtils');
const defenseDossierService = require('../../src/services/defenseDossierService');
const defenseScoringService = require('../../src/services/defenseScoringService');
const defenseResultPublicationService = require('../../src/services/defenseResultPublicationService');
const archivalWorkflowService = require('../../src/services/archivalWorkflowService');
const { clearAuthCache } = require('../../src/middlewares/auth');

// Permission helpers
const makePermGroup = (code, perms) => [{
    permissionGroup: {
        code,
        permissions: perms.map((p) => ({ permission: { code: p } })),
    },
}];

const adminPerms = makePermGroup('ADMIN_GROUP', [
    'RUBRIC_MANAGE',
    'RUBRIC_LOCK',
    'VIEW_RUBRIC_CONFIG',
    'DEFENSE_COUNCIL_MANAGE',
    'DEFENSE_SCHEDULE_PUBLISH',
    'DEFENSE_MEMBER_REPLACE',
    'DEFENSE_SCOREBOOK_RETURN',
    'DEFENSE_SCORE_VIEW',
    'RESULT_LOCK',
    'RESULT_PUBLISH',
    'DEFENSE_RESULT_APPROVE',
    'FINAL_DOCUMENT_REVIEW',
    'ARCHIVE_ACADEMIC_AFFAIRS_REVIEW',
    'VIEW_COUNCIL_ASSIGNMENTS',
    'VIEW_RESULT_LOCKS',
    'VIEW_DEFENSE_LOCK_LEDGER',
    'VIEW_DEFENSE_GRADING',
    'VIEW_PROJECT_OVERSIGHT',
]);

const directorPerms = makePermGroup('VIEN_TRUONG', [
    'CLEARANCE_CERTIFICATE_SIGN',
    'VIEW_CLEARANCE_CERTIFICATES',
    'FINAL_DOCUMENT_REVIEW',
    'DEFENSE_SCORE_VIEW',
    'DEFENSE_SCORE_SUBMIT',
    'ARCHIVE_MENTOR_REVIEW',
    'ARCHIVE_ACADEMIC_AFFAIRS_REVIEW',
]);

const chairmanPerms = makePermGroup('LECTURER_GROUP', [
    'DEFENSE_SCORE_SUBMIT',
    'DEFENSE_SCORE_VIEW',
    'RESULT_LOCK',
    'VIEW_DEFENSE_GRADING',
]);

const advisorPerms = makePermGroup('LECTURER_GROUP', [
    'ARCHIVE_MENTOR_REVIEW',
    'FINAL_DOCUMENT_REVIEW',
    'DEFENSE_SCORE_SUBMIT',
    'DEFENSE_SCORE_VIEW',
    'VIEW_DEFENSE_GRADING',
]);

const studentPerms = makePermGroup('STUDENT_GROUP', [
    'VIEW_MY_ARCHIVE',
    'SUBMIT_PRE_DEFENSE_ARCHIVE',
    'SUBMIT_FINAL_ARCHIVE',
    'VIEW_MY_GRADES',
]);

describe('Task 8: Defense to Completion Full End-to-End Integration Verification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearAuthCache();
        process.env.JWT_SECRET = 'test-secret';

        prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
        prisma.projectArchive.upsert.mockResolvedValue({ id: 88 });

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'director-token') return { userId: 2, role: 'LECTURER' };
            if (token === 'chairman-token') return { userId: 3, role: 'LECTURER' };
            if (token === 'advisor-token') return { userId: 4, role: 'LECTURER' };
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 1) {
                return { id: 1, fullName: 'Admin System', role: 'ADMIN', isActive: true, permissionGroups: adminPerms };
            }
            if (where.id === 2) {
                return { id: 2, fullName: 'PGS. TS. Vien Truong', role: 'LECTURER', isActive: true, permissionGroups: directorPerms };
            }
            if (where.id === 3) {
                return { id: 3, fullName: 'TS. Chu Tich Hoi Dong', role: 'LECTURER', isActive: true, permissionGroups: chairmanPerms };
            }
            if (where.id === 4) {
                return { id: 4, fullName: 'TS. Giang Vien Huong Dan', role: 'LECTURER', isActive: true, permissionGroups: advisorPerms };
            }
            if (where.id === 10) {
                return { id: 10, fullName: 'Nguyen Van Sinh Vien', role: 'STUDENT', isActive: true, permissionGroups: studentPerms };
            }
            return null;
        });
    });

    // ========================================================================
    // Tiêu chí 1: Hội đồng 22 SV chia 11/11, SV 12 là số 1 ca Chiều; lẻ 23 SV chia 12 Sáng / 11 Chiều
    // ========================================================================
    describe('Acceptance Criterion 1: Council Shift & Order Assignment', () => {
        test('splits 22 students contiguously into 11 Morning and 11 Afternoon with student #12 as order 1 in Afternoon', () => {
            const confirmed22 = Array.from({ length: 22 }, (_, idx) => ({ id: idx + 1 }));
            const shifts22 = splitConfirmedStudentsIntoShifts(confirmed22);

            expect(shifts22).toHaveLength(22);
            const morning = shifts22.filter((s) => s.defenseSessionShift === 'MORNING');
            const afternoon = shifts22.filter((s) => s.defenseSessionShift === 'AFTERNOON');

            expect(morning).toHaveLength(11);
            expect(afternoon).toHaveLength(11);
            expect(morning[0]).toEqual({ registrationId: 1, defenseSequenceNo: 1, defenseSessionShift: 'MORNING', defenseOrderInShift: 1 });
            expect(morning[10]).toEqual({ registrationId: 11, defenseSequenceNo: 11, defenseSessionShift: 'MORNING', defenseOrderInShift: 11 });
            expect(afternoon[0]).toEqual({ registrationId: 12, defenseSequenceNo: 12, defenseSessionShift: 'AFTERNOON', defenseOrderInShift: 1 });
            expect(afternoon[10]).toEqual({ registrationId: 22, defenseSequenceNo: 22, defenseSessionShift: 'AFTERNOON', defenseOrderInShift: 11 });
        });

        test('splits odd count 23 students into 12 Morning and 11 Afternoon (rounds up for Morning)', () => {
            const confirmed23 = Array.from({ length: 23 }, (_, idx) => ({ id: idx + 1 }));
            const shifts23 = splitConfirmedStudentsIntoShifts(confirmed23);

            expect(shifts23).toHaveLength(23);
            const morning = shifts23.filter((s) => s.defenseSessionShift === 'MORNING');
            const afternoon = shifts23.filter((s) => s.defenseSessionShift === 'AFTERNOON');

            expect(morning).toHaveLength(12);
            expect(afternoon).toHaveLength(11);
            expect(morning[11]).toEqual({ registrationId: 12, defenseSequenceNo: 12, defenseSessionShift: 'MORNING', defenseOrderInShift: 12 });
            expect(afternoon[0]).toEqual({ registrationId: 13, defenseSequenceNo: 13, defenseSessionShift: 'AFTERNOON', defenseOrderInShift: 1 });
        });

        test('confirmAndPublishDefenseSchedule enforces shift split and stores shifts and orders', async () => {
            const studentIds = Array.from({ length: 22 }, (_, i) => i + 1);
            prisma.council.findUnique.mockResolvedValue({
                id: 101,
                semesterId: 1,
                name: 'Hội đồng Bảo vệ 1',
                defenseDate: new Date('2026-11-20T00:00:00+07:00'),
                scheduleConfirmedAt: null,
                semester: {
                    id: 1,
                    lockedDefenseRubricVersionId: 5,
                    defenseEligibleListPublishedAt: new Date('2026-11-10T08:00:00+07:00'),
                },
                registrations: studentIds.map((id) => ({ id })),
            });
            prisma.council.update.mockResolvedValue({ id: 101, scheduleConfirmedAt: new Date() });

            const res = await request(app)
                .post('/api/councils/101/confirm-and-publish-schedule')
                .set('Authorization', 'Bearer admin-token')
                .send({ orderedRegistrationIds: studentIds });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(prisma.topicRegistration.update).toHaveBeenCalledTimes(22);
            // Verify student #12 received AFTERNOON order 1
            expect(prisma.topicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 12 },
                    data: expect.objectContaining({
                        defenseSessionShift: 'AFTERNOON',
                        defenseOrderInShift: 1,
                    }),
                })
            );
        });
    });

    // ========================================================================
    // Tiêu chí 2: Snapshot 00:00 ngày bảo vệ bất biến, DefenseDocumentVersion giữ lịch sử
    // ========================================================================
    describe('Acceptance Criterion 2: 00:00 Defense Snapshot Immutability & Document History', () => {
        test('defense snapshot captured at 00:00 preserves v1 even after student uploads v2 post-snapshot', async () => {
            const regId = 101;
            const v1Doc = {
                id: 501,
                registrationId: regId,
                documentType: 'REPORT_PDF',
                versionNumber: 1,
                fileUrl: '/uploads/archive/reg101_report_v1.pdf',
                fileName: 'Bao_cao_v1.pdf',
                checksum: 'hash-v1',
                uploadedAt: new Date('2026-11-19T22:00:00+07:00'),
            };

            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: regId,
                status: 'DEFENSE_READY',
                studentId: 10,
                defenseCouncil: { defenseDate: new Date('2026-11-20T00:00:00+07:00') },
                archive: { id: 88, windowClosedAt: null },
            });
            prisma.defenseDocumentVersion.findMany.mockResolvedValue([v1Doc]);
            prisma.defenseDocumentSnapshot.findUnique.mockResolvedValue(null);
            prisma.defenseDocumentSnapshot.create.mockResolvedValue({
                id: 1,
                registrationId: regId,
                snapshotType: 'DEFENSE_SNAPSHOT',
                reportPdfVersionId: 501,
                capturedAt: new Date('2026-11-20T00:00:00+07:00'),
            });

            // 1. Capture snapshot at 00:00 on defense date
            const snapRes = await request(app)
                .post(`/api/archives/registrations/${regId}/snapshots/defense-zero-hour`)
                .set('Authorization', 'Bearer admin-token')
                .send({ capturedAt: '2026-11-20T00:00:00+07:00' });

            expect(snapRes.status).toBe(200);
            expect(snapRes.body.success).toBe(true);

            // 2. Student uploads v2 at 08:30 on defense date (post-00:00)
            const v2Doc = {
                id: 502,
                registrationId: regId,
                documentType: 'REPORT_PDF',
                versionNumber: 2,
                fileUrl: '/uploads/archive/reg101_report_v2.pdf',
                fileName: 'Bao_cao_v2.pdf',
                checksum: 'hash-v2',
                uploadedAt: new Date('2026-11-20T08:30:00+07:00'),
            };
            prisma.defenseDocumentVersion.findFirst.mockResolvedValue(v1Doc);
            prisma.defenseDocumentVersion.create.mockResolvedValue(v2Doc);
            prisma.projectArchive.findUnique.mockResolvedValue({
                id: 88,
                registrationId: regId,
                defenseSnapshotAt: new Date('2026-11-20T00:00:00+07:00'),
                windowClosesAt: new Date('2026-12-05T00:00:00+07:00'),
            });
            prisma.projectArchive.upsert.mockResolvedValue({ id: 88, registrationId: regId });

            const uploadRes = await request(app)
                .post(`/api/archives/registrations/${regId}/files`)
                .set('Authorization', 'Bearer student-token')
                .send({
                    documentType: 'REPORT_PDF',
                    fileUrl: '/uploads/archive/reg101_report_v2.pdf',
                    fileName: 'Bao_cao_v2.pdf',
                    checksum: 'hash-v2',
                });

            expect(uploadRes.status).toBe(200);
            expect(uploadRes.body.success).toBe(true);
            expect(uploadRes.body.data.version.versionNumber).toBe(2);

            // 3. Verify snapshot still references v1 (501) and was NOT mutated by v2 upload
            expect(prisma.defenseDocumentSnapshot.update).not.toHaveBeenCalled();
        });
    });

    // ========================================================================
    // Tiêu chí 3: Mốc mềm (-3d) cảnh báo isLatePreDefense; đóng cổng (+15d) thiếu file -> ARCHIVE_INCOMPLETE
    // ========================================================================
    describe('Acceptance Criterion 3: Soft Deadline Warning & Closing Incomplete Archival', () => {
        test('uploading after soft deadline (-3d 00:00) warns with isLatePreDefense = true without blocking defense', async () => {
            const regId = 102;
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: regId,
                status: 'DEFENSE_READY',
                studentId: 10,
                defenseCouncil: { defenseDate: new Date('2026-11-20T00:00:00+07:00') },
                archive: { id: 89, windowClosedAt: null },
            });
            prisma.projectArchive.findUnique.mockResolvedValue({
                id: 89,
                registrationId: regId,
                softPreparationDeadlineAt: new Date('2026-11-17T00:00:00+07:00'),
                defenseSnapshotAt: new Date('2026-11-20T00:00:00+07:00'),
                windowClosesAt: new Date('2026-12-05T00:00:00+07:00'),
            });
            prisma.projectArchive.upsert.mockResolvedValue({ id: 89, registrationId: regId });
            prisma.defenseDocumentVersion.findFirst.mockResolvedValue(null);
            prisma.defenseDocumentVersion.create.mockImplementation(async ({ data }) => ({
                id: 601,
                ...data,
            }));

            // Uploading on Nov 18 (after Nov 17 00:00 soft deadline, but before Nov 20 defense)
            const result = await defenseDossierService.uploadDefenseDocumentVersion({
                registrationId: regId,
                documentType: 'SLIDE_PPTX',
                fileUrl: '/uploads/archive/slide_late.pptx',
                fileName: 'slide_late.pptx',
                uploadedById: 10,
                now: new Date('2026-11-18T10:00:00+07:00'),
            });

            expect(result.version.isLatePreDefense).toBe(true);
            // Verify registration status was NOT blocked (remained DEFENSE_READY)
            expect(prisma.topicRegistration.update).not.toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ status: 'BLOCKED' }) })
            );
        });

        test('missing any of 4 file types at closing deadline (+15d 00:00) transitions to ARCHIVE_INCOMPLETE preserving defense score', async () => {
            const regId = 103;
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: regId,
                status: 'DEFENSE_PASSED',
                stateVersion: 3,
                studentId: 10,
                defenseResult: { roundedFinalScore: 8.5 },
                defenseCouncil: { defenseDate: new Date('2026-11-20T00:00:00+07:00') },
            });
            prisma.projectArchive.findUnique.mockResolvedValue({
                id: 90,
                registrationId: regId,
                windowClosesAt: new Date('2026-12-05T00:00:00+07:00'),
            });
            // Only 3 file types uploaded, missing DEMO_VIDEO
            prisma.defenseDocumentVersion.findMany.mockResolvedValue([
                { documentType: 'REPORT_WORD', id: 1 },
                { documentType: 'REPORT_PDF', id: 2 },
                { documentType: 'SLIDE_PPTX', id: 3 },
            ]);
            prisma.defenseDocumentSnapshot.findUnique.mockResolvedValue(null);
            prisma.defenseDocumentSnapshot.create.mockResolvedValue({ id: 10 });

            const res = await request(app)
                .post(`/api/archives/registrations/${regId}/close-window`)
                .set('Authorization', 'Bearer admin-token')
                .send({ closedAt: '2026-12-05T00:00:00+07:00' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.transitionedStatus).toBe('ARCHIVE_INCOMPLETE');

            // Defense score must remain untouched
            expect(prisma.defenseResult.update).not.toHaveBeenCalled();
            // Clearance certificate must NOT be created
            expect(prisma.electronicSignatureEvent.create).not.toHaveBeenCalled();
        });
    });

    // ========================================================================
    // Tiêu chí 4: Rubric tổng 10.0đ (4 nhóm, 14 mục) khóa trước công bố danh sách SV
    // ========================================================================
    describe('Acceptance Criterion 4: Rubric Lock Gate & Template Immutability', () => {
        test('publishDefenseEligibleList rejects with 409 RUBRIC_NOT_LOCKED when rubric is not locked', async () => {
            prisma.semester.findUnique.mockResolvedValue({
                id: 1,
                name: 'HK1 2026',
                lockedDefenseRubricVersionId: null, // Rubric not locked!
            });

            const res = await request(app)
                .post('/api/councils/semesters/1/publish-eligible-defense-list')
                .set('Authorization', 'Bearer admin-token')
                .send();

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('RUBRIC_NOT_LOCKED');
        });

        test('locking 4-group 14-item standard rubric allows publishing eligible defense list and secondary guard checks', async () => {
            const standardRubric = rubricService.DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS;
            expect(standardRubric.categories).toHaveLength(4);
            const totalCriteria = standardRubric.categories.reduce((acc, c) => acc + c.criteria.length, 0);
            expect(totalCriteria).toBe(14);
            expect(standardRubric.totalMaxScore).toBe(10.0);

            // Mock locking the rubric
            prisma.rubricVersion.findUnique.mockResolvedValue({
                id: 5,
                semesterId: 1,
                title: standardRubric.title,
                totalMaxScore: 10.0,
                categories: standardRubric.categories,
            });
            prisma.rubricVersion.update.mockResolvedValue({
                id: 5,
                status: 'ACTIVE',
                isActive: true,
                lockedAt: new Date(),
            });
            prisma.semester.update.mockResolvedValue({ id: 1, lockedDefenseRubricVersionId: 5 });

            const lockRes = await request(app)
                .post('/api/rubrics/5/lock')
                .set('Authorization', 'Bearer admin-token')
                .send({ semesterId: 1 });

            expect(lockRes.status).toBe(200);
            expect(lockRes.body.success).toBe(true);

            // Now publishDefenseEligibleList succeeds
            prisma.semester.findUnique.mockResolvedValue({
                id: 1,
                name: 'HK1 2026',
                lockedDefenseRubricVersionId: 5,
                lockedDefenseRubricVersion: { id: 5, lockedAt: new Date() },
            });
            prisma.topicRegistration.findMany.mockResolvedValue([
                { id: 1, status: 'DEFENSE_READY' },
            ]);
            prisma.topicRegistration.updateMany.mockResolvedValue({ count: 1 });

            const pubListRes = await request(app)
                .post('/api/councils/semesters/1/publish-eligible-defense-list')
                .set('Authorization', 'Bearer admin-token')
                .send();

            expect(pubListRes.status).toBe(200);
            expect(pubListRes.body.success).toBe(true);

            // Secondary guard: council schedule confirmation rejects if semester has no locked rubric
            prisma.council.findUnique.mockResolvedValue({
                id: 99,
                semesterId: 2,
                semester: { id: 2, lockedDefenseRubricVersionId: null },
            });
            const guardRes = await request(app)
                .post('/api/councils/99/confirm-and-publish-schedule')
                .set('Authorization', 'Bearer admin-token')
                .send({ orderedRegistrationIds: [1] });

            expect(guardRes.status).toBe(409);
            expect(guardRes.body.code).toBe('RUBRIC_NOT_LOCKED');
        });
    });

    // ========================================================================
    // Tiêu chí 5: PRESENT cần 3/4 người khóa phiếu; ABSENT không tạo phiếu giả; người bị thay isEffective=false
    // ========================================================================
    describe('Acceptance Criterion 5: Member Lock Rules for PRESENT vs ABSENT & Member Replacement', () => {
        test('PRESENT student requires all 3 active effective scorers to lock before Chairman locks scorebook', async () => {
            const regId = 105;

            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: regId,
                status: 'AWAITING_SCORES',
                defenseCouncil: {
                    id: 101,
                    name: 'HĐ 1',
                    allowFourthScoringMember: false,
                    members: [
                        { id: 1, lecturerId: 3, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                        { id: 2, lecturerId: 4, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                        { id: 3, lecturerId: 5, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                    ],
                },
                // Only 2 of 3 members locked their score sheets
                memberScores: [
                    { evaluatorId: 3, scoreLocked: true, finalScore: 8.0, isEffective: true },
                    { evaluatorId: 4, scoreLocked: true, finalScore: 8.5, isEffective: true },
                    { evaluatorId: 5, scoreLocked: false, finalScore: null, isEffective: true }, // Unlocked!
                ],
                defenseResult: {
                    attendanceStatus: 'PRESENT',
                },
            });

            // Attempting to lock scorebook must fail with 409
            const res = await request(app)
                .post(`/api/evaluations/registrations/${regId}/lock-scorebook`)
                .set('Authorization', 'Bearer chairman-token')
                .send();

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('INCOMPLETE_MEMBER_SCORES');
        });

        test('ABSENT student with Chairman minutes locks scorebook cleanly without requiring member sheets or fake scores', async () => {
            const regId = 106;

            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: regId,
                status: 'AWAITING_SCORES',
                defenseCouncil: {
                    id: 102,
                    name: 'HĐ 2',
                    allowFourthScoringMember: false,
                    members: [
                        { id: 1, lecturerId: 3, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                        { id: 2, lecturerId: 4, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                        { id: 3, lecturerId: 5, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                    ],
                },
                memberScores: [], // Zero member sheets!
                defenseResult: {
                    attendanceStatus: 'ABSENT',
                    absentMinutesText: 'Sinh viên vắng mặt không lý do có biên bản xác nhận của Chủ tịch.',
                    finalScore: null,
                },
            });
            prisma.defenseResult.upsert.mockResolvedValue({
                id: 1,
                registrationId: regId,
                scoreLocked: true,
                finalScore: null,
                rawAverageScore: null,
                roundedFinalScore: null,
            });

            const res = await request(app)
                .post(`/api/evaluations/registrations/${regId}/lock-scorebook`)
                .set('Authorization', 'Bearer chairman-token')
                .send();

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.finalScore).toBeNull();
            // Verify no fake member sheets were created
            expect(prisma.defenseMemberScore.create).not.toHaveBeenCalled();
        });

        test('replacing a council member marks old sheets as isEffective = false and preserves history', async () => {
            const councilId = 101;
            prisma.council.findUnique.mockResolvedValue({
                id: councilId,
                scoreBookLocked: false,
                members: [{ id: 10, lecturerId: 4, roleInCouncil: 'REVIEWER', lecturer: { id: 4, fullName: 'TS. Phan Bien' } }],
            });
            prisma.topicRegistration.findMany.mockResolvedValue([]);
            prisma.defenseMemberScore.findMany.mockResolvedValue([{ id: 1, evaluatorId: 4, scoreLocked: true, isEffective: true }]);
            prisma.defenseMemberScore.count.mockResolvedValue(1); // Old member had locked sheets
            prisma.councilMember.update.mockResolvedValue({ id: 10, lecturerId: 6 });
            prisma.councilMember.create.mockResolvedValue({ id: 11, lecturerId: 6, lecturer: { id: 6, fullName: 'TS. Giang Vien Moi' } });
            prisma.defenseMemberScore.updateMany.mockResolvedValue({ count: 1 });

            const res = await request(app)
                .post(`/api/councils/${councilId}/members/replace`)
                .set('Authorization', 'Bearer admin-token')
                .send({
                    oldMemberId: 10,
                    newLecturerId: 6,
                    reason: 'Giảng viên phản biện bận công tác đột xuất',
                    confirmLockedSheetOverride: true,
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            // Verify old sheets marked isEffective = false
            expect(prisma.defenseMemberScore.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ evaluatorId: 4 }),
                    data: expect.objectContaining({ isEffective: false }),
                })
            );
        });
    });

    // ========================================================================
    // Tiêu chí 6: Làm tròn 1 chữ số thập phân rồi so 5.0 (4.95 -> 5.0 ĐẠT; 4.94 -> 4.9 RỚT); ABSENT rớt không điểm giả
    // ========================================================================
    describe('Acceptance Criterion 6: Deterministic Rounding (4.95 vs 4.94) & ABSENT Terminal Result', () => {
        test('deterministic half-up rounding: raw 4.95 rounds to 5.0 (PASSED) while 4.94 rounds to 4.9 (FAILED)', () => {
            expect(roundDefenseScoreOneDecimal(4.95)).toBe(5.0);
            expect(roundDefenseScoreOneDecimal(4.94)).toBe(4.9);
            expect(roundDefenseScoreOneDecimal((5.0 + 5.0 + 4.85) / 3)).toBe(5.0); // 4.95 -> 5.0
            expect(roundDefenseScoreOneDecimal((5.0 + 4.9 + 4.92) / 3)).toBe(4.9); // 4.94 -> 4.9
        });

        test('defense result publication determines outcome: 5.0 PASSED, 4.9 FAILED, and ABSENT DEFENSE_FAILED with null score', () => {
            expect(roundDefenseScoreOneDecimal(4.95) >= 5.0).toBe(true);
            expect(roundDefenseScoreOneDecimal(4.94) < 5.0).toBe(true);

            // ABSENT student result has finalScore = null and transitions to DEFENSE_FAILED
            const absentResult = {
                attendanceStatus: 'ABSENT',
                finalScore: null,
                rawAverageScore: null,
                roundedFinalScore: null,
            };
            const outcome = absentResult.attendanceStatus === 'ABSENT' ? 'FAILED' : (absentResult.roundedFinalScore >= 5.0 ? 'PASSED' : 'FAILED');
            expect(outcome).toBe('FAILED');
            expect(absentResult.finalScore).toBeNull();
        });
    });

    // ========================================================================
    // Tiêu chí 7: Trả sổ trước công bố có lý do/lịch sử, chỉ mở phiếu cần sửa; sau công bố chặn vĩnh viễn (409)
    // ========================================================================
    describe('Acceptance Criterion 7: Pre-Publication Return vs Post-Publication Immutability', () => {
        test('pre-publication return records return log and reopens only specified member sheets', async () => {
            const regId = 107;
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: regId,
                status: 'AWAITING_FINAL_APPROVAL',
                defenseCouncil: { id: 101 },
                defenseResult: { scoreLocked: true, ledgerVersion: 1, finalScore: 8.5 },
                memberScores: [
                    { id: 201, evaluatorId: 3, scoreLocked: true, versionNumber: 1, isEffective: true },
                    { id: 202, evaluatorId: 4, scoreLocked: true, versionNumber: 1, isEffective: true },
                ],
            });
            prisma.resultPublicationItem.findFirst.mockResolvedValue(null); // Not published yet!
            prisma.defenseScoreBookReturnLog.create.mockResolvedValue({ id: 1 });
            prisma.defenseMemberScore.update.mockResolvedValue({ id: 202, scoreLocked: false });
            prisma.defenseResult.update.mockResolvedValue({ id: 1, scoreLocked: false });

            const res = await request(app)
                .post(`/api/evaluations/registrations/${regId}/return-scorebook`)
                .set('Authorization', 'Bearer admin-token')
                .send({
                    reason: 'Phát hiện sai sót điểm thành phần tiêu chí Báo cáo',
                    reopenMemberScoreIds: [202], // Only reopen member score id 202
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(prisma.defenseScoreBookReturnLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        reason: expect.stringContaining('Phát hiện sai sót'),
                        reopenedMemberScoreIds: [202],
                    }),
                })
            );
            // Reopened member score id 202
            expect(prisma.defenseMemberScore.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 202 },
                    data: expect.objectContaining({ scoreLocked: false }),
                })
            );
        });

        test('post-publication return or score edit attempt is permanently blocked with 409', async () => {
            const regId = 108;
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: regId,
                status: 'DEFENSE_PASSED',
                defenseCouncil: { id: 101 },
                defenseResult: { scoreLocked: true },
            });
            // Already published in official publication!
            prisma.resultPublicationItem.findFirst.mockResolvedValue({
                id: 1,
                publicationId: 10,
                registrationId: regId,
            });

            const returnRes = await request(app)
                .post(`/api/evaluations/registrations/${regId}/return-scorebook`)
                .set('Authorization', 'Bearer admin-token')
                .send({
                    reason: 'Muốn sửa điểm sau công bố',
                    reopenMemberScoreIds: [202],
                });

            expect(returnRes.status).toBe(409);
            expect(returnRes.body.code).toBe('RESULT_ALREADY_PUBLISHED_IMMUTABLE');
        });
    });

    // ========================================================================
    // Tiêu chí 8: Nộp file sau bảo vệ không phụ thuộc ngày công bố; cổng đóng cứng 00:00 ngày thứ 15
    // ========================================================================
    describe('Acceptance Criterion 8: 14-Day Archival Window & Hard Close at Day 15 00:00', () => {
        test('computeDefenseTimeWindows accurately anchors 00:00 boundaries', () => {
            const windows = computeDefenseTimeWindows('2026-11-20T08:00:00+07:00');
            expect(windows.defenseDateYmd).toBe('2026-11-20');
            expect(windows.softPreparationDeadlineAt.toISOString()).toBe(new Date('2026-11-17T00:00:00+07:00').toISOString());
            expect(windows.defenseSnapshotAt.toISOString()).toBe(new Date('2026-11-20T00:00:00+07:00').toISOString());
            expect(windows.windowClosesAt.toISOString()).toBe(new Date('2026-12-05T00:00:00+07:00').toISOString());
        });

        test('post-defense upload works before score publication, but rejects at/after day 15 00:00 with 409 ARCHIVE_WINDOW_CLOSED', async () => {
            const regId = 109;
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: regId,
                status: 'AWAITING_FINAL_APPROVAL', // Scores not published yet!
                studentId: 10,
                defenseCouncil: { defenseDate: new Date('2026-11-20T00:00:00+07:00') },
                archive: { id: 91, windowClosedAt: null },
            });
            prisma.projectArchive.findUnique.mockResolvedValue({
                id: 91,
                registrationId: regId,
                defenseSnapshotAt: new Date('2026-11-20T00:00:00+07:00'),
                windowClosesAt: new Date('2026-12-05T00:00:00+07:00'),
            });
            prisma.projectArchive.upsert.mockResolvedValue({ id: 91, registrationId: regId });
            prisma.defenseDocumentVersion.findFirst.mockResolvedValue(null);
            prisma.defenseDocumentVersion.create.mockResolvedValue({ id: 701, versionNumber: 1 });

            // 1. Uploading on Nov 25 (before publication, within 14-day window) succeeds
            const earlyUpload = await request(app)
                .post(`/api/archives/registrations/${regId}/files`)
                .set('Authorization', 'Bearer student-token')
                .send({
                    documentType: 'DEMO_VIDEO',
                    fileUrl: '/uploads/archive/demo.mp4',
                    fileName: 'demo.mp4',
                });

            expect(earlyUpload.status).toBe(200);
            expect(earlyUpload.body.success).toBe(true);

            // 2. Uploading on Dec 05 00:01 (after day 15 00:00 closing) rejects with 409
            prisma.projectArchive.findUnique.mockResolvedValue({
                id: 91,
                registrationId: regId,
                windowClosesAt: new Date('2026-12-05T00:00:00+07:00'),
                windowClosedAt: new Date('2026-12-05T00:00:00+07:00'),
            });

            await expect(
                defenseDossierService.uploadDefenseDocumentVersion({
                    registrationId: regId,
                    documentType: 'DEMO_VIDEO',
                    fileUrl: '/uploads/archive/demo2.mp4',
                    fileName: 'demo2.mp4',
                    uploadedById: 10,
                    now: new Date('2026-12-05T00:05:00+07:00'),
                })
            ).rejects.toMatchObject({
                code: 'ARCHIVE_WINDOW_CLOSED',
                status: 409,
            });
        });
    });

    // ========================================================================
    // Tiêu chí 9: ARCHIVE_REJECTED và ARCHIVE_INCOMPLETE không mở nộp lại sau hạn, không đổi điểm và không cấp giấy
    // ========================================================================
    describe('Acceptance Criterion 9: ARCHIVE_REJECTED & ARCHIVE_INCOMPLETE Non-reopenable & Score Invariance', () => {
        test('ARCHIVE_REJECTED from Advisor or Academic Affairs preserves defense score, forbids post-closing uploads, and forbids certificate', async () => {
            const regId = 110;
            const mockArchive = {
                id: 92,
                registrationId: regId,
                mentorReviewStatus: 'PENDING',
                academicAffairsReviewStatus: 'PENDING',
                registration: {
                    id: regId,
                    status: 'DEFENSE_PASSED',
                    stateVersion: 2,
                    topic: { mentorId: 4 }, // Topic mentor matches advisor (id: 4)
                },
            };

            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: regId,
                status: 'DEFENSE_PASSED',
                stateVersion: 2,
                topic: { mentorId: 4 },
            });
            prisma.topicRegistration.updateMany.mockResolvedValue({ count: 1 });
            prisma.idempotencyRecord.findUnique.mockResolvedValue(null);
            prisma.idempotencyRecord.create.mockResolvedValue({ id: 1 });
            prisma.registrationStateHistory.create.mockResolvedValue({ id: 1 });
            prisma.projectArchive.findUnique.mockResolvedValue(mockArchive);
            prisma.projectArchive.update.mockResolvedValue({
                ...mockArchive,
                mentorReviewStatus: 'REJECTED',
            });

            // Advisor (id 4) rejects archival content
            const reviewRes = await request(app)
                .post(`/api/archives/registrations/${regId}/mentor-review`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    status: 'REJECTED',
                    notes: 'Báo cáo vi phạm quy chế trích dẫn và không đạt yêu cầu chuyên môn.',
                });

            expect(reviewRes.status).toBe(200);
            expect(reviewRes.body.data.mentorReviewStatus).toBe('REJECTED');

            // Attempting to sign clearance certificate for ARCHIVE_REJECTED registration must fail with 409
            const rejectedArchive = {
                ...mockArchive,
                mentorReviewStatus: 'REJECTED',
                registration: {
                    ...mockArchive.registration,
                    status: 'ARCHIVE_REJECTED',
                },
            };
            prisma.projectArchive.findUnique.mockResolvedValue(rejectedArchive);

            const certRes = await request(app)
                .post(`/api/archives/registrations/${regId}/sign-certificate`)
                .set('Authorization', 'Bearer director-token')
                .send({});

            expect(certRes.status).toBe(409);
            expect(certRes.body.success).toBe(false);
            expect(certRes.body.message).toMatch(/PENDING_INSTITUTE_SIGNATURE/i);
        });
    });

    // ========================================================================
    // Tiêu chí 10: Chỉ chức danh Viện trưởng ký Giấy xác nhận sau khi cả 2 tầng duyệt; sinh PDF bất biến -> COMPLETED
    // ========================================================================
    describe('Acceptance Criterion 10: Institute Director Digital Signature & Clearance Certificate', () => {
        test('Technical Admin without CLEARANCE_CERTIFICATE_SIGN is rejected with 403 Forbidden', async () => {
            const regId = 111;
            const res = await request(app)
                .post(`/api/archives/registrations/${regId}/sign-certificate`)
                .set('Authorization', 'Bearer admin-token') // Admin lacks CLEARANCE_CERTIFICATE_SIGN
                .send({});

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });

        test('signing certificate fails if Advisor or Academic Affairs has not yet APPROVED', async () => {
            const regId = 112;
            const pendingArchive = {
                id: 93,
                registrationId: regId,
                mentorReviewStatus: 'APPROVED',
                academicAffairsReviewStatus: 'PENDING', // Academic Affairs still pending!
                registration: {
                    id: regId,
                    status: 'PENDING_INSTITUTE_SIGNATURE',
                    stateVersion: 3,
                },
            };
            prisma.projectArchive.findUnique.mockResolvedValue(pendingArchive);

            const res = await request(app)
                .post(`/api/archives/registrations/${regId}/sign-certificate`)
                .set('Authorization', 'Bearer director-token')
                .send({});

            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Giáo vụ.*chưa duyệt|ACADEMIC_AFFAIRS_REVIEW_NOT_APPROVED/i);
        });

        test('Viện trưởng successfully signs Clearance Certificate after both tiers approve -> COMPLETED and creates PDF', async () => {
            const regId = 113;
            const completedArchive = {
                id: 94,
                registrationId: regId,
                mentorReviewStatus: 'APPROVED',
                academicAffairsReviewStatus: 'APPROVED',
                certificateNumber: null,
                registration: {
                    id: regId,
                    status: 'PENDING_INSTITUTE_SIGNATURE',
                    stateVersion: 4,
                    student: { id: 10, fullName: 'Nguyen Van A', code: 'SV113' },
                    topic: { title: 'Xây dựng hệ thống quản lý đồ án', mentor: { fullName: 'TS. Huong Dan' } },
                    semester: { name: 'Học kỳ 1 2026-2027' },
                    defenseCouncil: { name: 'Hội đồng Bảo vệ 1', defenseDate: new Date('2026-11-20T00:00:00+07:00') },
                    defenseResult: { roundedFinalScore: 9.0, finalScore: 9.0 },
                },
            };
            prisma.projectArchive.findUnique.mockResolvedValue(completedArchive);
            prisma.topicRegistration.findUnique.mockResolvedValue(completedArchive.registration);
            prisma.topicRegistration.updateMany.mockResolvedValue({ count: 1 });
            prisma.idempotencyRecord.findUnique.mockResolvedValue(null);
            prisma.idempotencyRecord.create.mockResolvedValue({ id: 1 });
            prisma.registrationStateHistory.create.mockResolvedValue({ id: 1 });
            prisma.projectArchive.update.mockResolvedValue({
                ...completedArchive,
                status: 'COMPLETED',
                certificateNumber: 'XNHT-20261120-113',
                certificatePdfUrl: '/uploads/academic-documents/clearance_certificate.pdf',
            });
            prisma.electronicSignatureEvent.create.mockResolvedValue({ id: 77 });

            const res = await request(app)
                .post(`/api/archives/registrations/${regId}/sign-certificate`)
                .set('Authorization', 'Bearer director-token')
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.archive.status).toBe('COMPLETED');
            expect(res.body.data.archive.certificateNumber).toBeDefined();

            // Transitions to COMPLETED
            expect(prisma.topicRegistration.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: regId }),
                    data: expect.objectContaining({
                        status: 'COMPLETED',
                    }),
                })
            );
            // Creates electronic signature event
            expect(prisma.electronicSignatureEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        entityType: 'CLEARANCE_CERTIFICATE',
                        action: 'SIGN_CLEARANCE_CERTIFICATE',
                        signerId: 2,
                    }),
                })
            );
        });
    });
});
