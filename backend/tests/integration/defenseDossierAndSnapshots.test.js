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
        updateMany: jest.fn(),
        count: jest.fn(),
    },
    defenseDocumentVersion: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
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
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
    },
    bM03ProgressRecord: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
    },
    bM04Evaluation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
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
    },
    auditLog: {
        create: jest.fn().mockResolvedValue({}),
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
const defenseDossierService = require('../../src/services/defenseDossierService');

const studentPerms = [{
    permissionGroup: {
        code: 'STUDENT_GROUP',
        permissions: [
            { permission: { code: 'VIEW_MY_ARCHIVE' } },
            { permission: { code: 'SUBMIT_PRE_DEFENSE_ARCHIVE' } },
            { permission: { code: 'SUBMIT_FINAL_ARCHIVE' } },
        ],
    },
}];

const adminPerms = [{
    permissionGroup: {
        code: 'ADMIN_GROUP',
        permissions: [
            { permission: { code: 'VIEW_MY_ARCHIVE' } },
            { permission: { code: 'FINAL_DOCUMENT_REVIEW' } },
            { permission: { code: 'DEFENSE_COUNCIL_MANAGE' } },
            { permission: { code: 'PROJECT_ASSIGNMENT_PUBLISH' } },
        ],
    },
}];

const councilMemberPerms = (permissionCode) => [{
    permissionGroup: {
        code: 'COUNCIL_GROUP',
        permissions: [
            { permission: { code: permissionCode } },
        ],
    },
}];

describe('Task 3: 6-Document Defense Dossier, Multi-Version Uploads, 00:00 Defense Snapshot & Day-15 Window Closure', () => {
    const defenseDate = new Date('2026-11-20T00:00:00.000Z'); // 2026-11-20 Vietnam Time
    const mockStudent = {
        id: 10,
        fullName: 'Nguyen Van Sinh Vien',
        code: 'SV202601',
        email: 'student@example.edu.vn',
        role: 'STUDENT',
        isActive: true,
        permissionGroups: studentPerms,
    };
    const mockAdmin = {
        id: 1,
        fullName: 'Admin Dao Tao',
        code: 'AD001',
        role: 'ADMIN',
        isActive: true,
        permissionGroups: adminPerms,
    };

    let sampleRegistration;
    let versionsStore = [];
    let snapshotsStore = [];
    let archiveStore = null;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
        versionsStore = [];
        snapshotsStore = [];
        archiveStore = null;

        prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'council-view-grading-token') return { userId: 20, role: 'LECTURER' };
            if (token === 'council-score-submit-token') return { userId: 21, role: 'LECTURER' };
            if (token === 'council-score-view-token') return { userId: 22, role: 'LECTURER' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 10) return mockStudent;
            if (where.id === 1) return mockAdmin;
            if (where.id === 20) return { id: 20, role: 'LECTURER', isActive: true, permissionGroups: councilMemberPerms('VIEW_DEFENSE_GRADING') };
            if (where.id === 21) return { id: 21, role: 'LECTURER', isActive: true, permissionGroups: councilMemberPerms('DEFENSE_SCORE_SUBMIT') };
            if (where.id === 22) return { id: 22, role: 'LECTURER', isActive: true, permissionGroups: councilMemberPerms('DEFENSE_SCORE_VIEW') };
            return null;
        });

        sampleRegistration = {
            id: 100,
            studentId: 10,
            status: 'DEFENSE_READY',
            stateVersion: 5,
            defenseSessionShift: 'MORNING',
            defenseOrderInShift: 3,
            defenseSequenceNo: 3,
            defenseCouncilId: 50,
            topic: {
                id: 200,
                title: 'Hệ thống Quản lý Đồ án và Lưu chiểu Số',
                mentorId: 2,
                mentor: { id: 2, fullName: 'TS. Giang Vien Huong Dan', email: 'gvhd@example.edu.vn' },
            },
            student: mockStudent,
            defenseCouncil: {
                id: 50,
                name: 'Hội đồng Khoa học 01',
                defenseDate: new Date('2026-11-20T00:00:00+07:00'),
                location: 'Phòng B.302',
            },
            archive: null,
            bm03Record: {
                id: 301,
                finalPdfFileUrl: 'https://storage.example.com/bm03/signed_record_100.pdf',
                advisorSignedAt: new Date('2026-11-10T10:00:00+07:00'),
            },
            bm04Evaluation: {
                id: 401,
                finalPdfFileUrl: 'https://storage.example.com/bm04/signed_eval_100.pdf',
                signedAt: new Date('2026-11-12T15:00:00+07:00'),
            },
        };

        prisma.topicRegistration.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 100) {
                return {
                    ...sampleRegistration,
                    archive: archiveStore,
                    documentVersions: versionsStore,
                    documentSnapshots: snapshotsStore,
                };
            }
            return null;
        });

        prisma.topicRegistration.update.mockImplementation(async ({ where, data }) => {
            if (where.id === 100) {
                Object.assign(sampleRegistration, data);
                return sampleRegistration;
            }
            return null;
        });

        prisma.topicRegistration.updateMany.mockImplementation(async ({ where, data }) => {
            if (where.id === 100) {
                Object.assign(sampleRegistration, data);
                if (data.stateVersion) {
                    sampleRegistration.stateVersion = data.stateVersion;
                } else if (data.stateVersion && data.stateVersion.increment) {
                    sampleRegistration.stateVersion += 1;
                }
                return { count: 1 };
            }
            return { count: 0 };
        });

        prisma.defenseDocumentVersion.create.mockImplementation(async ({ data }) => {
            const row = {
                id: versionsStore.length + 1,
                ...data,
                uploadedAt: data.uploadedAt || new Date(),
            };
            versionsStore.push(row);
            return row;
        });

        prisma.defenseDocumentVersion.findFirst.mockImplementation(async ({ where, orderBy }) => {
            const filtered = versionsStore.filter((v) => {
                if (where.registrationId && v.registrationId !== where.registrationId) return false;
                if (where.documentType && v.documentType !== where.documentType) return false;
                if (where.uploadedAt?.lte && new Date(v.uploadedAt) > new Date(where.uploadedAt.lte)) return false;
                return true;
            });
            if (filtered.length === 0) return null;
            if (orderBy?.versionNumber === 'desc') {
                return [...filtered].sort((a, b) => b.versionNumber - a.versionNumber)[0];
            }
            return filtered[0];
        });

        prisma.defenseDocumentVersion.findMany.mockImplementation(async ({ where }) => {
            return versionsStore.filter((v) => {
                if (where.registrationId && v.registrationId !== where.registrationId) return false;
                if (where.documentType && v.documentType !== where.documentType) return false;
                return true;
            });
        });

        prisma.defenseDocumentSnapshot.create.mockImplementation(async ({ data }) => {
            const row = {
                id: snapshotsStore.length + 1,
                ...data,
                createdAt: new Date(),
            };
            snapshotsStore.push(row);
            return row;
        });

        prisma.defenseDocumentSnapshot.findUnique.mockImplementation(async ({ where }) => {
            if (where.registrationId_snapshotType) {
                return snapshotsStore.find(
                    (s) => s.registrationId === where.registrationId_snapshotType.registrationId &&
                           s.snapshotType === where.registrationId_snapshotType.snapshotType,
                ) || null;
            }
            return null;
        });

        prisma.defenseDocumentSnapshot.findFirst.mockImplementation(async ({ where }) => {
            return snapshotsStore.find(
                (s) => s.registrationId === where.registrationId && s.snapshotType === where.snapshotType,
            ) || null;
        });

        prisma.projectArchive.upsert.mockImplementation(async ({ where, update, create }) => {
            if (!archiveStore) {
                archiveStore = {
                    id: 88,
                    registrationId: where.registrationId,
                    status: 'SUBMITTED',
                    ...create,
                };
            } else {
                archiveStore = {
                    ...archiveStore,
                    ...update,
                };
            }
            return archiveStore;
        });

        prisma.projectArchive.updateMany.mockImplementation(async ({ where, data }) => {
            if (archiveStore && archiveStore.registrationId === where.registrationId) {
                Object.assign(archiveStore, data);
                return { count: 1 };
            }
            return { count: 0 };
        });

        prisma.bM03ProgressRecord.findUnique.mockImplementation(async ({ where }) => {
            if (where.registrationId === 100) return sampleRegistration.bm03Record;
            return null;
        });

        prisma.bM04Evaluation.findUnique.mockImplementation(async ({ where }) => {
            if (where.registrationId === 100) return sampleRegistration.bm04Evaluation;
            return null;
        });
    });

    it('1. Student uploads REPORT_WORD, REPORT_PDF, DEMO_VIDEO, SLIDE_PPTX across multiple versions (v1, v2) with SHA-256 checksum and versionNumber without overwriting v1, and replacing one file type does not require re-uploading the other three', async () => {
        // Upload v1 for all 4 types
        const types = ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'];
        for (const docType of types) {
            const res = await request(app)
                .post('/api/archives/registration/100/files')
                .set('Authorization', 'Bearer student-token')
                .send({
                    documentType: docType,
                    fileUrl: `https://storage.example.com/files/${docType.toLowerCase()}_v1.bin`,
                    fileName: `${docType.toLowerCase()}_v1.bin`,
                });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.version.versionNumber).toBe(1);
            expect(res.body.data.version.documentType).toBe(docType);
            expect(res.body.data.version.checksum).toBeDefined();
            expect(res.body.data.version.checksum.length).toBe(64); // SHA-256 hex string
        }

        expect(versionsStore).toHaveLength(4);

        // Upload v2 ONLY for REPORT_PDF (replaces PDF only without re-uploading the other three)
        const pdfV2Res = await request(app)
            .post('/api/archives/registration/100/files')
            .set('Authorization', 'Bearer student-token')
            .send({
                documentType: 'REPORT_PDF',
                fileUrl: 'https://storage.example.com/files/report_pdf_v2.pdf',
                fileName: 'report_pdf_v2.pdf',
            });

        expect(pdfV2Res.status).toBe(200);
        expect(pdfV2Res.body.data.version.versionNumber).toBe(2);
        expect(pdfV2Res.body.data.version.documentType).toBe('REPORT_PDF');

        // Total 5 version records; v1 still exists
        expect(versionsStore).toHaveLength(5);
        const pdfVersions = versionsStore.filter((v) => v.documentType === 'REPORT_PDF');
        expect(pdfVersions).toHaveLength(2);
        expect(pdfVersions[0].versionNumber).toBe(1);
        expect(pdfVersions[1].versionNumber).toBe(2);

        // ProjectArchive stores the updated PDF v2 while preserving the other three files
        expect(archiveStore.reportPdfFileUrl).toBe('https://storage.example.com/files/report_pdf_v2.pdf');
        expect(archiveStore.reportWordFileUrl).toBe('https://storage.example.com/files/report_word_v1.bin');
        expect(archiveStore.demoVideoUrl).toBe('https://storage.example.com/files/demo_video_v1.bin');
        expect(archiveStore.slideFileUrl).toBe('https://storage.example.com/files/slide_pptx_v1.bin');
    });

    it('2. BM03 and BM04 are automatically linked from BM03ProgressRecord and BM04Evaluation, and students cannot upload BM03/BM04 or invalid document types', async () => {
        // Attempt to upload BM03 -> 400 INVALID_DOCUMENT_TYPE
        const bm03Upload = await request(app)
            .post('/api/archives/registration/100/files')
            .set('Authorization', 'Bearer student-token')
            .send({
                documentType: 'BM03',
                fileUrl: 'https://evil.com/fake_bm03.pdf',
                fileName: 'fake_bm03.pdf',
            });
        expect(bm03Upload.status).toBe(400);
        expect(bm03Upload.body.code).toBe('INVALID_DOCUMENT_TYPE');

        // Attempt to upload BM04 -> 400 INVALID_DOCUMENT_TYPE
        const bm04Upload = await request(app)
            .post('/api/archives/registration/100/files')
            .set('Authorization', 'Bearer student-token')
            .send({
                documentType: 'BM04',
                fileUrl: 'https://evil.com/fake_bm04.pdf',
                fileName: 'fake_bm04.pdf',
            });
        expect(bm04Upload.status).toBe(400);
        expect(bm04Upload.body.code).toBe('INVALID_DOCUMENT_TYPE');

        // Get defense dossier -> auto-linked BM03 & BM04
        const dossierRes = await request(app)
            .get('/api/archives/registration/100/dossier')
            .set('Authorization', 'Bearer student-token');

        expect(dossierRes.status).toBe(200);
        expect(dossierRes.body.data.linkedBm03).toBeDefined();
        expect(dossierRes.body.data.linkedBm03.finalPdfFileUrl).toBe(sampleRegistration.bm03Record.finalPdfFileUrl);
        expect(dossierRes.body.data.linkedBm04).toBeDefined();
        expect(dossierRes.body.data.linkedBm04.finalPdfFileUrl).toBe(sampleRegistration.bm04Evaluation.finalPdfFileUrl);
        expect(dossierRes.body.data.effectiveTitle).toBeDefined();
        expect(dossierRes.body.data.defenseSessionShift).toBe('MORNING');
        expect(dossierRes.body.data.defenseOrderInShift).toBe(3);
    });

    it('3. Uploading after the soft deadline (00:00 3 days before defense) sets isLatePreDefense = true and returns a warning, but does not block upload', async () => {
        // Defense date: 2026-11-20 00:00:00+07:00
        // Soft deadline: 2026-11-17 00:00:00+07:00
        // Simulated upload time: 2026-11-18 14:00:00+07:00 (after soft deadline, before defense date)
        const lateUploadTime = new Date('2026-11-18T14:00:00+07:00');

        const result = await defenseDossierService.uploadDefenseDocumentVersion({
            registrationId: 100,
            documentType: 'REPORT_PDF',
            fileUrl: 'https://storage.example.com/report_late.pdf',
            fileName: 'report_late.pdf',
            actorId: 10,
            now: lateUploadTime,
        });

        expect(result.version).toBeDefined();
        expect(result.version.isLatePreDefense).toBe(true);
        expect(result.version.phase).toBe('PRE_DEFENSE');
        expect(result.warnings).toContain('Tài liệu nộp sau hạn mềm chuẩn bị bảo vệ (00:00 trước ngày bảo vệ 3 ngày).');

        // Dossier endpoint reflects isSoftDeadlinePast = true
        const dossier = await defenseDossierService.getDefenseDossier(100, { now: lateUploadTime });
        expect(dossier.isSoftDeadlinePast).toBe(true);
        expect(dossier.isWindowClosed).toBe(false);
    });

    it('4. captureDefenseZeroHourSnapshot at 00:00 on the defense date freezes DEFENSE_SNAPSHOT pointing to versions at that timestamp; subsequent uploads leave DEFENSE_SNAPSHOT unchanged', async () => {
        // Pre-defense upload v1 of REPORT_PDF at 2026-11-16
        const v1 = await defenseDossierService.uploadDefenseDocumentVersion({
            registrationId: 100,
            documentType: 'REPORT_PDF',
            fileUrl: 'https://storage.example.com/report_v1.pdf',
            fileName: 'report_v1.pdf',
            actorId: 10,
            now: new Date('2026-11-16T10:00:00+07:00'),
        });
        expect(v1.version.versionNumber).toBe(1);

        // At 00:00 on defense date (2026-11-20T00:00:00+07:00), snapshot is captured
        const zeroHour = new Date('2026-11-20T00:00:00+07:00');
        const snapshot = await defenseDossierService.captureDefenseZeroHourSnapshot(100, { capturedAt: zeroHour });

        expect(snapshot).toBeDefined();
        expect(snapshot.snapshotType).toBe('DEFENSE_SNAPSHOT');
        expect(snapshot.reportPdfVersionId).toBe(v1.version.id);

        // Student uploads REPORT_PDF v2 after defense on 2026-11-22 for archival corrections
        const v2 = await defenseDossierService.uploadDefenseDocumentVersion({
            registrationId: 100,
            documentType: 'REPORT_PDF',
            fileUrl: 'https://storage.example.com/report_v2_postdefense.pdf',
            fileName: 'report_v2_postdefense.pdf',
            actorId: 10,
            now: new Date('2026-11-22T10:00:00+07:00'),
        });
        expect(v2.version.versionNumber).toBe(2);

        // Verify ProjectArchive has v2
        expect(archiveStore.reportPdfFileUrl).toBe('https://storage.example.com/report_v2_postdefense.pdf');

        // Verify DEFENSE_SNAPSHOT remains immutable and still points to v1
        const storedDefenseSnapshot = snapshotsStore.find((s) => s.snapshotType === 'DEFENSE_SNAPSHOT');
        expect(storedDefenseSnapshot.reportPdfVersionId).toBe(v1.version.id);
        expect(storedDefenseSnapshot.reportPdfVersionId).not.toBe(v2.version.id);
    });

    it('5. Post-defense uploads are allowed immediately after 00:00 on defense date without waiting for score publication; any upload at or after 00:00 Day 15 fails with 409 ARCHIVE_WINDOW_CLOSED even if REVISION_REQUIRED', async () => {
        // Defense date: 2026-11-20. Score has NOT been published. Status is still DEFENSE_READY.
        const postDefenseOpenTime = new Date('2026-11-21T09:00:00+07:00');
        const allowedUpload = await defenseDossierService.uploadDefenseDocumentVersion({
            registrationId: 100,
            documentType: 'DEMO_VIDEO',
            fileUrl: 'https://storage.example.com/demo_video.mp4',
            fileName: 'demo_video.mp4',
            actorId: 10,
            now: postDefenseOpenTime,
        });
        expect(allowedUpload.version).toBeDefined();
        expect(allowedUpload.version.phase).toBe('POST_DEFENSE');

        // Day 15 boundary: 2026-12-05 00:00:00+07:00
        const windowClosedTime = new Date('2026-12-05T00:00:00+07:00');

        // Set archive status to REVISION_REQUIRED
        archiveStore = { ...archiveStore, status: 'REVISION_REQUIRED' };

        // Upload attempt at Day-15 00:00 -> fails with 409 ARCHIVE_WINDOW_CLOSED
        await expect(defenseDossierService.uploadDefenseDocumentVersion({
            registrationId: 100,
            documentType: 'DEMO_VIDEO',
            fileUrl: 'https://storage.example.com/demo_video_too_late.mp4',
            fileName: 'demo_video_too_late.mp4',
            actorId: 10,
            now: windowClosedTime,
        })).rejects.toThrow(expect.objectContaining({
            code: 'ARCHIVE_WINDOW_CLOSED',
            status: 409,
        }));

        // Testing HTTP endpoint for 409
        const httpRes = await request(app)
            .post('/api/archives/registration/100/files')
            .set('Authorization', 'Bearer student-token')
            .send({
                documentType: 'DEMO_VIDEO',
                fileUrl: 'https://storage.example.com/demo_video_too_late.mp4',
                fileName: 'demo_video_too_late.mp4',
                now: windowClosedTime.toISOString(),
            });

        expect(httpRes.status).toBe(409);
        expect(httpRes.body.code).toBe('ARCHIVE_WINDOW_CLOSED');
    });

    it('6. closeArchiveWindowAtDay15 captures ARCHIVE_FINAL_SNAPSHOT; if any of 4 file types is missing and student is DEFENSE_PASSED, status transitions to ARCHIVE_INCOMPLETE', async () => {
        // Student passed defense
        sampleRegistration.status = 'DEFENSE_PASSED';

        // Student uploaded REPORT_WORD and REPORT_PDF, but forgot DEMO_VIDEO and SLIDE_PPTX
        await defenseDossierService.uploadDefenseDocumentVersion({
            registrationId: 100,
            documentType: 'REPORT_WORD',
            fileUrl: 'https://storage.example.com/report.docx',
            fileName: 'report.docx',
            actorId: 10,
            now: new Date('2026-11-25T10:00:00+07:00'),
        });
        await defenseDossierService.uploadDefenseDocumentVersion({
            registrationId: 100,
            documentType: 'REPORT_PDF',
            fileUrl: 'https://storage.example.com/report.pdf',
            fileName: 'report.pdf',
            actorId: 10,
            now: new Date('2026-11-25T10:05:00+07:00'),
        });

        const closeTime = new Date('2026-12-05T00:00:00+07:00');
        const closeResult = await defenseDossierService.closeArchiveWindowAtDay15(100, { closedAt: closeTime });

        expect(closeResult.snapshot).toBeDefined();
        expect(closeResult.snapshot.snapshotType).toBe('ARCHIVE_FINAL_SNAPSHOT');
        expect(closeResult.snapshot.missingDocumentTypes).toEqual(
            expect.arrayContaining(['DEMO_VIDEO', 'SLIDE_PPTX']),
        );
        expect(closeResult.transitionedStatus).toBe('ARCHIVE_INCOMPLETE');
        expect(sampleRegistration.status).toBe('ARCHIVE_INCOMPLETE');

        // Testing HTTP endpoint for close-window
        const adminCloseRes = await request(app)
            .post('/api/archives/registration/100/close-window')
            .set('Authorization', 'Bearer admin-token')
            .send({ closedAt: closeTime.toISOString() });

        expect(adminCloseRes.status).toBe(200);
        expect(adminCloseRes.body.success).toBe(true);
        expect(adminCloseRes.body.data.snapshot).toBeDefined();
    });

    it('7. allows council members with VIEW_DEFENSE_GRADING, DEFENSE_SCORE_SUBMIT, or DEFENSE_SCORE_VIEW to view dossier', async () => {
        for (const token of ['council-view-grading-token', 'council-score-submit-token', 'council-score-view-token']) {
            const res = await request(app)
                .get('/api/archives/registrations/100/dossier')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.linkedBm03).toBeDefined();
        }
    });
});
