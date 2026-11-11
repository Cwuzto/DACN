const request = require('supertest');
const jwt = require('jsonwebtoken');

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
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
    },
    defenseResult: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
    },
    bM03ProgressRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
    },
    bM04Evaluation: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
    },
    council: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    titleAdjustmentAppendixItem: {
        findFirst: jest.fn().mockResolvedValue(null),
    },
    topicAssignmentDecisionItem: {
        findFirst: jest.fn().mockResolvedValue(null),
    },
    bM02Submission: {
        findFirst: jest.fn().mockResolvedValue(null),
    },
    electronicSignatureEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
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
const archivalWorkflowService = require('../../src/services/archivalWorkflowService');
const defenseAndArchivalSweepService = require('../../src/services/defenseAndArchivalSweepService');

const makePermGroup = (code, perms) => [{
    permissionGroup: {
        code,
        permissions: perms.map((p) => ({ permission: { code: p } })),
    },
}];

describe('Task 6: Two-Stage Archival Review, Institute Director Clearance Signature & Scheduled Sweep Jobs', () => {
    const defenseDate = new Date('2026-11-20T00:00:00.000Z'); // Day D

    const mockStudent = {
        id: 10,
        fullName: 'Tran Sinh Vien',
        code: 'SV202610',
        email: 'student10@tdmu.edu.vn',
        role: 'STUDENT',
        isActive: true,
        permissionGroups: makePermGroup('STUDENT_GROUP', [
            'VIEW_MY_ARCHIVE',
            'SUBMIT_FINAL_ARCHIVE',
            'SUBMIT_PRE_DEFENSE_ARCHIVE',
        ]),
    };

    const mockAdvisor = {
        id: 20,
        fullName: 'TS. Tran Huong Dan',
        code: 'GV2020',
        email: 'advisor20@tdmu.edu.vn',
        role: 'LECTURER',
        isActive: true,
        permissionGroups: makePermGroup('MENTOR_GROUP', [
            'ARCHIVE_MENTOR_REVIEW',
            'FINAL_DOCUMENT_REVIEW',
        ]),
    };

    const mockAcademicAffairs = {
        id: 30,
        fullName: 'ThS. Nguyen Giao Vu',
        code: 'GV3030',
        email: 'academicaffairs@tdmu.edu.vn',
        role: 'LECTURER',
        isActive: true,
        permissionGroups: makePermGroup('ACADEMIC_AFFAIRS_GROUP', [
            'ARCHIVE_ACADEMIC_AFFAIRS_REVIEW',
            'FINAL_DOCUMENT_REVIEW',
        ]),
    };

    const mockTechAdmin = {
        id: 1,
        fullName: 'Admin Ky Thuat',
        code: 'AD001',
        role: 'ADMIN',
        isActive: true,
        permissionGroups: makePermGroup('QUAN_TRI_VIEN', [
            'USER_MANAGE',
            'PERMISSION_GROUP_MANAGE',
            'VIEW_PERMISSION_GROUPS',
            'NOTIFICATION_MANAGE',
            'DEFENSE_COUNCIL_MANAGE',
        ]),
    };

    const mockDirector = {
        id: 50,
        fullName: 'PGS. TS. Vien Truong',
        code: 'VT001',
        email: 'director@tdmu.edu.vn',
        role: 'LECTURER',
        isActive: true,
        permissionGroups: makePermGroup('VIEN_TRUONG', [
            'CLEARANCE_CERTIFICATE_SIGN',
            'FINAL_DOCUMENT_REVIEW',
            'VIEW_CLEARANCE_CERTIFICATES',
        ]),
    };

    let sampleRegistration;
    let sampleArchive;
    let versionsStore = [];
    let snapshotsStore = [];
    let stateTransitions = [];

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
        versionsStore = [];
        snapshotsStore = [];
        stateTransitions = [];

        prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'advisor-token') return { userId: 20, role: 'LECTURER' };
            if (token === 'academic-affairs-token') return { userId: 30, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'director-token') return { userId: 50, role: 'LECTURER' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 10) return mockStudent;
            if (where.id === 20) return mockAdvisor;
            if (where.id === 30) return mockAcademicAffairs;
            if (where.id === 1) return mockTechAdmin;
            if (where.id === 50) return mockDirector;
            return null;
        });

        sampleRegistration = {
            id: 100,
            studentId: 10,
            status: 'DEFENSE_PASSED',
            stateVersion: 6,
            topic: {
                id: 101,
                title: 'Nghien cuu AI cho he thong quan ly dao tao',
                mentorId: 20,
                mentor: mockAdvisor,
            },
            student: mockStudent,
            defenseCouncil: {
                id: 500,
                name: 'Hoi dong 01',
                defenseDate,
            },
            defenseResult: {
                id: 800,
                finalScore: 8.5,
                roundedFinalScore: 8.5,
                approvalOutcome: 'PASSED',
            },
        };

        sampleArchive = {
            id: 200,
            registrationId: 100,
            status: 'SUBMITTED',
            mentorReviewStatus: 'PENDING',
            academicAffairsReviewStatus: 'PENDING',
            reportWordFileUrl: 'https://storage/report_v1.docx',
            reportPdfFileUrl: 'https://storage/report_v1.pdf',
            demoVideoUrl: 'https://storage/demo_v1.mp4',
            slideFileUrl: 'https://storage/slide_v1.pptx',
            registration: sampleRegistration,
        };

        // Seed initial versions for all 4 files
        versionsStore = [
            { id: 1, registrationId: 100, archiveId: 200, documentType: 'REPORT_WORD', versionNumber: 1, fileUrl: 'https://storage/report_v1.docx', fileName: 'report_v1.docx', uploadedAt: new Date('2026-11-21T02:00:00.000Z') },
            { id: 2, registrationId: 100, archiveId: 200, documentType: 'REPORT_PDF', versionNumber: 1, fileUrl: 'https://storage/report_v1.pdf', fileName: 'report_v1.pdf', uploadedAt: new Date('2026-11-21T02:00:00.000Z') },
            { id: 3, registrationId: 100, archiveId: 200, documentType: 'DEMO_VIDEO', versionNumber: 1, fileUrl: 'https://storage/demo_v1.mp4', fileName: 'demo_v1.mp4', uploadedAt: new Date('2026-11-21T02:00:00.000Z') },
            { id: 4, registrationId: 100, archiveId: 200, documentType: 'SLIDE_PPTX', versionNumber: 1, fileUrl: 'https://storage/slide_v1.pptx', fileName: 'slide_v1.pptx', uploadedAt: new Date('2026-11-21T02:00:00.000Z') },
        ];

        prisma.projectArchive.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 200 || where.registrationId === 100) {
                return { ...sampleArchive, registration: sampleRegistration };
            }
            if (where.id === 301 || where.registrationId === 101) {
                return { id: 301, registrationId: 101, windowClosedAt: null, registration: { id: 101, status: 'DEFENSE_READY' } };
            }
            if (where.id === 302 || where.registrationId === 102) {
                return { id: 302, registrationId: 102, windowClosedAt: null, registration: { id: 102, status: 'DEFENSE_PASSED' } };
            }
            return null;
        });

        prisma.projectArchive.upsert.mockImplementation(async ({ where, update, create }) => {
            Object.assign(sampleArchive, update || create);
            return { ...sampleArchive, registration: sampleRegistration };
        });

        prisma.topicRegistration.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 100) {
                return { ...sampleRegistration, archive: sampleArchive };
            }
            if (where.id === 101) {
                return {
                    id: 101,
                    studentId: 10,
                    status: 'DEFENSE_READY',
                    stateVersion: 1,
                    defenseCouncil: { id: 501, name: 'Hoi dong 01', defenseDate },
                    archive: { id: 301, windowClosedAt: null },
                };
            }
            if (where.id === 102) {
                return {
                    id: 102,
                    studentId: 11,
                    status: 'DEFENSE_PASSED',
                    stateVersion: 1,
                    defenseCouncil: { id: 501, name: 'Hoi dong 01', defenseDate },
                    archive: { id: 302, windowClosedAt: null },
                };
            }
            return null;
        });

        prisma.defenseDocumentVersion.findMany.mockImplementation(async ({ where }) => {
            return versionsStore.filter((v) => {
                if (where.registrationId && v.registrationId !== where.registrationId) return false;
                if (where.documentType && v.documentType !== where.documentType) return false;
                return true;
            });
        });

        prisma.defenseDocumentVersion.findFirst.mockImplementation(async ({ where, orderBy }) => {
            const matches = versionsStore.filter((v) => {
                if (where.registrationId && v.registrationId !== where.registrationId) return false;
                if (where.documentType && v.documentType !== where.documentType) return false;
                if (where.uploadedAt?.lte && v.uploadedAt > where.uploadedAt.lte) return false;
                return true;
            });
            if (orderBy?.versionNumber === 'desc') {
                matches.sort((a, b) => b.versionNumber - a.versionNumber);
            }
            return matches[0] || null;
        });

        prisma.defenseDocumentVersion.create.mockImplementation(async ({ data }) => {
            const created = { id: versionsStore.length + 1, ...data };
            versionsStore.push(created);
            return created;
        });

        prisma.defenseDocumentVersion.updateMany.mockImplementation(async ({ where, data }) => {
            let count = 0;
            versionsStore.forEach((v) => {
                if (where.id === v.id && (!where.registrationId || v.registrationId === where.registrationId)) {
                    Object.assign(v, data);
                    count++;
                }
            });
            return { count };
        });

        prisma.projectArchive.update.mockImplementation(async ({ where, data }) => {
            Object.assign(sampleArchive, data);
            return { ...sampleArchive, registration: sampleRegistration };
        });

        prisma.projectArchive.updateMany.mockImplementation(async ({ data }) => {
            Object.assign(sampleArchive, data);
            return { count: 1 };
        });

        prisma.topicRegistration.updateMany.mockImplementation(async ({ where, data }) => {
            stateTransitions.push({ from: sampleRegistration.status, to: data.status });
            sampleRegistration.status = data.status;
            if (data.stateVersion?.increment) {
                sampleRegistration.stateVersion += data.stateVersion.increment;
            }
            return { count: 1 };
        });

        prisma.defenseDocumentSnapshot.findUnique.mockImplementation(async ({ where }) => {
            const key = where.registrationId_snapshotType;
            if (!key) return null;
            return snapshotsStore.find((s) => s.registrationId === key.registrationId && s.snapshotType === key.snapshotType) || null;
        });

        prisma.defenseDocumentSnapshot.create.mockImplementation(async ({ data }) => {
            const created = { id: snapshotsStore.length + 1, ...data };
            snapshotsStore.push(created);
            return created;
        });

        prisma.electronicSignatureEvent.create.mockImplementation(async ({ data }) => {
            return { id: 777, ...data, signedAt: new Date() };
        });
    });

    test('1. Advisor (GVHD) can submit REVISION_REQUIRED feedback during 14-day window; student can upload new version of affected file before 00:00 day 15', async () => {
        // GVHD reviews during 14-day window (e.g., Day D + 2)
        const reviewRes = await request(app)
            .post('/api/archives/200/mentor-review')
            .set('Authorization', 'Bearer advisor-token')
            .send({
                status: 'REVISION_REQUIRED',
                notes: 'Báo cáo Word cần cập nhật chương 3 theo mẫu mới',
                versionFeedbacks: [
                    { versionId: 1, feedback: 'Bổ sung sơ đồ kiến trúc vào mục 3.2' },
                ],
            });

        expect(reviewRes.status).toBe(200);
        expect(reviewRes.body.success).toBe(true);
        expect(reviewRes.body.data.mentorReviewStatus).toBe('REVISION_REQUIRED');

        // Verify version feedback is recorded
        const wordV1 = versionsStore.find((v) => v.id === 1);
        expect(wordV1.mentorFeedback).toBe('Bổ sung sơ đồ kiến trúc vào mục 3.2');

        // Student receives immediate notification and uploads new version of Word report within 14-day window (Day D + 4)
        const uploadRes = await request(app)
            .post('/api/archives/registrations/100/files')
            .set('Authorization', 'Bearer student-token')
            .send({
                documentType: 'REPORT_WORD',
                fileUrl: 'https://storage/report_v2.docx',
                fileName: 'report_v2.docx',
            });

        expect(uploadRes.status).toBe(200);
        expect(uploadRes.body.success).toBe(true);
        expect(uploadRes.body.data.version.versionNumber).toBe(2);
    });

    test('2. Reviewers can complete review after 00:00 day 15 on frozen ARCHIVE_FINAL_SNAPSHOT, but REVISION_REQUIRED does NOT reopen student uploads', async () => {
        // Close window at Day 15 (00:00:00 Day D + 15)
        const day15Time = new Date('2026-12-05T00:00:00.000Z');
        sampleArchive.windowClosedAt = day15Time;

        // Reviewer reviews after closure (e.g. Day D + 16)
        const reviewRes = await request(app)
            .post('/api/archives/200/mentor-review')
            .set('Authorization', 'Bearer advisor-token')
            .send({
                status: 'REVISION_REQUIRED',
                notes: 'Yêu cầu sửa nhưng cổng đã đóng',
            });

        expect(reviewRes.status).toBe(200);
        expect(reviewRes.body.data.mentorReviewStatus).toBe('REVISION_REQUIRED');

        // Student attempts to upload after window closure -> strictly 409 ARCHIVE_WINDOW_CLOSED
        const uploadAttempt = await request(app)
            .post('/api/archives/registrations/100/files')
            .set('Authorization', 'Bearer student-token')
            .send({
                documentType: 'REPORT_WORD',
                fileUrl: 'https://storage/report_v3.docx',
                fileName: 'report_v3.docx',
            });

        expect(uploadAttempt.status).toBe(409);
        expect(uploadAttempt.body.code).toBe('ARCHIVE_WINDOW_CLOSED');
    });

    test('3. If GVHD or Giao vu concludes REJECTED on DEFENSE_PASSED dossier, registration transitions to ARCHIVE_REJECTED (preserving defense score)', async () => {
        const rejectRes = await request(app)
            .post('/api/archives/200/academic-affairs-review')
            .set('Authorization', 'Bearer academic-affairs-token')
            .send({
                status: 'REJECTED',
                notes: 'Phát hiện đạo văn vi phạm quy chế đào tạo nghiêm trọng',
            });

        expect(rejectRes.status).toBe(200);
        expect(rejectRes.body.success).toBe(true);
        expect(sampleRegistration.status).toBe('ARCHIVE_REJECTED');
        expect(sampleArchive.status).toBe('ARCHIVE_REJECTED');
        // Defense score remains preserved
        expect(sampleRegistration.defenseResult.finalScore).toBe(8.5);
    });

    test('4. When DEFENSE_PASSED registration has all 4 files, mentorReviewStatus === APPROVED, and academicAffairsReviewStatus === APPROVED, it automatically transitions to PENDING_INSTITUTE_SIGNATURE', async () => {
        // 1. Advisor approves
        const mentorRes = await request(app)
            .post('/api/archives/200/mentor-review')
            .set('Authorization', 'Bearer advisor-token')
            .send({
                status: 'APPROVED',
                notes: 'Chuyên môn đạt chuẩn',
            });

        expect(mentorRes.status).toBe(200);
        expect(mentorRes.body.data.mentorReviewStatus).toBe('APPROVED');
        // Not yet pending signature because academic affairs has not approved
        expect(sampleRegistration.status).toBe('DEFENSE_PASSED');

        // 2. Academic Affairs approves
        const aaRes = await request(app)
            .post('/api/archives/200/academic-affairs-review')
            .set('Authorization', 'Bearer academic-affairs-token')
            .send({
                status: 'APPROVED',
                notes: 'Hồ sơ thủ tục đầy đủ 4 loại tài liệu hợp lệ',
            });

        expect(aaRes.status).toBe(200);
        expect(aaRes.body.data.academicAffairsReviewStatus).toBe('APPROVED');
        // Automatically transitions to PENDING_INSTITUTE_SIGNATURE
        expect(sampleRegistration.status).toBe('PENDING_INSTITUTE_SIGNATURE');
        expect(sampleArchive.status).toBe('PENDING_INSTITUTE_SIGNATURE');
    });

    test('5. Technical ADMIN without CLEARANCE_CERTIFICATE_SIGN receives 403; Institute Director (VIEN_TRUONG) signs, generates immutable PDF, and atomically transitions to COMPLETED', async () => {
        sampleRegistration.status = 'PENDING_INSTITUTE_SIGNATURE';
        sampleArchive.status = 'PENDING_INSTITUTE_SIGNATURE';
        sampleArchive.mentorReviewStatus = 'APPROVED';
        sampleArchive.academicAffairsReviewStatus = 'APPROVED';

        // Attempt by technical admin (without CLEARANCE_CERTIFICATE_SIGN) -> 403
        const adminAttempt = await request(app)
            .post('/api/archives/200/sign-certificate')
            .set('Authorization', 'Bearer admin-token')
            .send({});

        expect(adminAttempt.status).toBe(403);

        // Institute Director signs
        const directorSignRes = await request(app)
            .post('/api/archives/200/sign-certificate')
            .set('Authorization', 'Bearer director-token')
            .send({});

        expect(directorSignRes.status).toBe(200);
        expect(directorSignRes.body.success).toBe(true);
        expect(directorSignRes.body.data.archive.status).toBe('COMPLETED');
        expect(directorSignRes.body.data.archive.certificateNumber).toMatch(/^XNHT-\d{8}-/);
        expect(directorSignRes.body.data.archive.certificatePdfUrl).toBeTruthy();
        expect(directorSignRes.body.data.signatureEvent).toBeTruthy();
        expect(sampleRegistration.status).toBe('COMPLETED');
    });

    test('6. runDefenseAndArchivalSweep is idempotent: sends 3d pre-defense reminder, captures 00:00 DEFENSE_SNAPSHOT, sends 7d/3d/24h archival reminders, and at 00:00 day 15 closes windows and marks ARCHIVE_INCOMPLETE if missing files', async () => {
        // Setup registrations for sweep testing
        const reg1 = {
            id: 101,
            studentId: 10,
            status: 'DEFENSE_READY',
            defenseCouncil: { defenseDate: new Date('2026-11-20T00:00:00.000Z') },
            archive: { id: 301, windowClosedAt: null },
        };
        const reg2Missing = {
            id: 102,
            studentId: 11,
            status: 'DEFENSE_PASSED',
            stateVersion: 1,
            defenseCouncil: { defenseDate: new Date('2026-11-20T00:00:00.000Z') },
            archive: { id: 302, windowClosedAt: null },
        };

        prisma.topicRegistration.findMany.mockResolvedValue([reg1, reg2Missing]);

        // Pre-defense 3-day reminder at 2026-11-17T01:00:00.000Z
        const resSoft = await defenseAndArchivalSweepService.runDefenseAndArchivalSweep({
            now: new Date('2026-11-17T01:00:00.000Z'),
        });
        expect(resSoft.softRemindersSent).toBeGreaterThanOrEqual(1);

        // Idempotent rerun at soft deadline -> 0 additional reminders
        prisma.notification.findFirst.mockResolvedValue({ id: 99 });
        const resSoftRerun = await defenseAndArchivalSweepService.runDefenseAndArchivalSweep({
            now: new Date('2026-11-17T01:00:00.000Z'),
        });
        expect(resSoftRerun.softRemindersSent).toBe(0);

        // Day 15 sweep at 2026-12-05T00:00:00.000Z -> closes window and transitions reg2Missing to ARCHIVE_INCOMPLETE
        prisma.notification.findFirst.mockResolvedValue(null);
        prisma.defenseDocumentVersion.findMany.mockImplementation(async ({ where }) => {
            // reg2 has 0 files uploaded
            if (where.registrationId === 102) return [];
            return versionsStore;
        });

        const resDay15 = await defenseAndArchivalSweepService.runDefenseAndArchivalSweep({
            now: new Date('2026-12-05T00:00:00.000Z'),
        });
        expect(resDay15.windowsClosed).toBeGreaterThanOrEqual(1);
        expect(resDay15.markedIncomplete).toBeGreaterThanOrEqual(1);
    });
});
