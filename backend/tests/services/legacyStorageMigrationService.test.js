const crypto = require('crypto');
const {
    buildLegacyManifest,
    applyLegacyManifest,
    CLASSIFICATIONS,
} = require('../../src/services/legacyStorageMigrationService');

describe('legacyStorageMigrationService', () => {
    let mockDb;
    let mockStorage;

    beforeEach(() => {
        mockDb = {
            user: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            semester: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            submission: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            meetingLog: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            defenseResult: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            defenseMemberScore: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            bM01Evaluation: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            publicAnnouncement: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            assignmentDecision: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            decisionAmendment: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            topicAssignmentDecision: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            bM02AAdjustmentRequest: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            titleAdjustmentAppendix: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            instituteStopReview: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            instituteDefenseReview: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            projectArchive: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            defenseDocumentVersion: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
            portalContentRevision: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
        };

        mockStorage = {
            download: jest.fn(),
            upload: jest.fn(),
            remove: jest.fn(),
            stat: jest.fn(),
            exists: jest.fn(),
        };
    });

    describe('buildLegacyManifest', () => {
        it('classifies branding URLs as KEEP_BRANDING and redacts tokens', async () => {
            mockDb.portalContentRevision.findMany.mockResolvedValue([
                {
                    id: 1,
                    resourceType: 'CONFIGURATION',
                    payload: {
                        logoUrl: 'https://aanqmscxckeejuhvaezm.supabase.co/storage/v1/object/public/cong-khai/tdmu-logo.png?token=secret123',
                        backgroundUrl: 'https://aanqmscxckeejuhvaezm.supabase.co/storage/v1/object/public/cong-khai/tdmu-campus-hero.png',
                    },
                },
            ]);

            const manifest = await buildLegacyManifest({ db: mockDb, storage: mockStorage });

            expect(manifest.summary.keepBranding).toBe(2);
            const logoItem = manifest.items.find((i) => i.targetObjectKey.includes('logo'));
            expect(logoItem).toBeDefined();
            expect(logoItem.classification).toBe(CLASSIFICATIONS.KEEP_BRANDING);
            expect(logoItem.targetBucket).toBe('cong-khai');
            expect(logoItem.url).not.toContain('secret123'); // Redacted token
        });

        it('classifies GitHub and YouTube URLs as KEEP_EXTERNAL', async () => {
            mockDb.submission.findMany.mockResolvedValue([
                { id: 101, sourceCodeUrl: 'https://github.com/tdmu-edu/project-demo', demoVideoUrl: 'https://youtu.be/dQw4w9WgXcQ' },
            ]);
            mockDb.projectArchive.findMany.mockResolvedValue([
                { id: 201, demoVideoExternalUrl: 'https://www.youtube.com/watch?v=123456' },
            ]);

            const manifest = await buildLegacyManifest({ db: mockDb, storage: mockStorage });

            expect(manifest.summary.keepExternal).toBe(3);
            manifest.items
                .filter((i) => i.classification === CLASSIFICATIONS.KEEP_EXTERNAL)
                .forEach((i) => {
                    expect(['https://github.com/tdmu-edu/project-demo', 'https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=123456']).toContain(i.url);
                });
        });

        it('classifies legacy Supabase storage and /uploads/ URLs as NULL_AND_DELETE', async () => {
            mockDb.user.findMany.mockResolvedValue([
                { id: 1, avatarUrl: 'https://legacy-proj.supabase.co/storage/v1/object/public/avatars/user-1.jpg' },
            ]);
            mockDb.submission.findMany.mockResolvedValue([
                { id: 102, reportFileUrl: '/uploads/reports/2026/report-old.pdf' },
            ]);

            const manifest = await buildLegacyManifest({ db: mockDb, storage: mockStorage });

            expect(manifest.summary.nullAndDelete).toBe(2);
            const userAvatar = manifest.items.find((i) => i.table === 'user' && i.field === 'avatarUrl');
            expect(userAvatar.classification).toBe(CLASSIFICATIONS.NULL_AND_DELETE);
            const submissionReport = manifest.items.find((i) => i.table === 'submission' && i.field === 'reportFileUrl');
            expect(submissionReport.classification).toBe(CLASSIFICATIONS.NULL_AND_DELETE);
        });

        it('classifies unrecognized or malformed URLs as UNRESOLVED', async () => {
            mockDb.submission.findMany.mockResolvedValue([
                { id: 103, reportFileUrl: 'ftp://insecure-server.local/file.bin' },
            ]);

            const manifest = await buildLegacyManifest({ db: mockDb, storage: mockStorage });

            expect(manifest.summary.unresolved).toBe(1);
            const unresolvedItem = manifest.items.find((i) => i.classification === CLASSIFICATIONS.UNRESOLVED);
            expect(unresolvedItem).toBeDefined();
            expect(unresolvedItem.url).toBe('ftp://insecure-server.local/file.bin');
        });
    });

    describe('applyLegacyManifest safety and execution', () => {
        it('performs zero writes to DB or Storage when dryRun is true', async () => {
            const manifest = {
                summary: { total: 2, keepBranding: 1, keepExternal: 0, nullAndDelete: 1, unresolved: 0 },
                items: [
                    {
                        id: 'item-1',
                        classification: CLASSIFICATIONS.KEEP_BRANDING,
                        table: 'portalContentRevision',
                        recordId: 1,
                        field: 'logoUrl',
                        url: 'https://aanqmscxckeejuhvaezm.supabase.co/storage/v1/object/public/cong-khai/tdmu-logo.png',
                        targetBucket: 'cong-khai',
                        targetObjectKey: 'thuong-hieu/logo/logo-vien-cong-nghe-so.png',
                        status: 'PENDING',
                    },
                    {
                        id: 'item-2',
                        classification: CLASSIFICATIONS.NULL_AND_DELETE,
                        table: 'user',
                        recordId: 1,
                        field: 'avatarUrl',
                        url: 'https://legacy-proj.supabase.co/storage/v1/object/public/ca-nhan/avatars/user-1.jpg',
                        bucket: 'ca-nhan',
                        objectKey: 'avatars/user-1.jpg',
                        status: 'PENDING',
                    },
                ],
            };

            const report = await applyLegacyManifest({
                manifest,
                db: mockDb,
                storage: mockStorage,
                dryRun: true,
                snapshotConfirmed: true,
            });

            expect(report.dryRun).toBe(true);
            expect(mockDb.user.update).not.toHaveBeenCalled();
            expect(mockStorage.upload).not.toHaveBeenCalled();
            expect(mockStorage.remove).not.toHaveBeenCalled();
        });

        it('aborts apply immediately if manifest contains UNRESOLVED items', async () => {
            const manifest = {
                summary: { total: 1, keepBranding: 0, keepExternal: 0, nullAndDelete: 0, unresolved: 1 },
                items: [
                    {
                        id: 'item-bad',
                        classification: CLASSIFICATIONS.UNRESOLVED,
                        url: 'unknown-protocol://path',
                        status: 'PENDING',
                    },
                ],
            };

            await expect(
                applyLegacyManifest({
                    manifest,
                    db: mockDb,
                    storage: mockStorage,
                    dryRun: false,
                    snapshotConfirmed: true,
                })
            ).rejects.toThrow(/UNRESOLVED_ITEMS_ABORT/);

            expect(mockStorage.remove).not.toHaveBeenCalled();
        });

        it('requires database snapshot confirmation before apply', async () => {
            const manifest = {
                summary: { total: 1, keepBranding: 0, keepExternal: 0, nullAndDelete: 1, unresolved: 0 },
                items: [
                    {
                        id: 'item-1',
                        classification: CLASSIFICATIONS.NULL_AND_DELETE,
                        table: 'user',
                        recordId: 1,
                        field: 'avatarUrl',
                        url: 'https://legacy-proj.supabase.co/storage/v1/object/public/ca-nhan/avatars/user-1.jpg',
                        status: 'PENDING',
                    },
                ],
            };

            await expect(
                applyLegacyManifest({
                    manifest,
                    db: mockDb,
                    storage: mockStorage,
                    dryRun: false,
                    snapshotConfirmed: false,
                })
            ).rejects.toThrow(/SNAPSHOT_NOT_CONFIRMED/);
        });

        it('copies branding, computes hash, verifies target before deleting old source', async () => {
            const dummyBuffer = Buffer.from('logo-image-content-data');
            const expectedHash = crypto.createHash('sha256').update(dummyBuffer).digest('hex');

            mockStorage.download.mockResolvedValue(dummyBuffer);
            mockStorage.upload.mockResolvedValue({ path: 'thuong-hieu/logo/logo-vien-cong-nghe-so.png' });
            mockStorage.stat.mockResolvedValue({
                size: dummyBuffer.length,
                etag: 'etag123',
                metadata: { sha256: expectedHash },
            });
            mockStorage.remove.mockResolvedValue({ data: [] });

            const manifest = {
                summary: { total: 1, keepBranding: 1, keepExternal: 0, nullAndDelete: 0, unresolved: 0 },
                items: [
                    {
                        id: 'item-branding',
                        classification: CLASSIFICATIONS.KEEP_BRANDING,
                        table: 'portalContentRevision',
                        recordId: 1,
                        field: 'logoUrl',
                        url: 'https://aanqmscxckeejuhvaezm.supabase.co/storage/v1/object/public/cong-khai/tdmu-logo.png',
                        sourceBucket: 'cong-khai',
                        sourceObjectKey: 'tdmu-logo.png',
                        targetBucket: 'cong-khai',
                        targetObjectKey: 'thuong-hieu/logo/logo-vien-cong-nghe-so.png',
                        status: 'PENDING',
                    },
                ],
            };

            const report = await applyLegacyManifest({
                manifest,
                db: mockDb,
                storage: mockStorage,
                dryRun: false,
                snapshotConfirmed: true,
            });

            expect(report.summary.succeeded).toBe(1);
            expect(mockStorage.download).toHaveBeenCalledWith({ bucket: 'cong-khai', objectKey: 'tdmu-logo.png' });
            expect(mockStorage.upload).toHaveBeenCalledWith(
                expect.objectContaining({
                    bucket: 'cong-khai',
                    objectKey: 'thuong-hieu/logo/logo-vien-cong-nghe-so.png',
                })
            );
            // Verified target before removing old
            expect(mockStorage.stat).toHaveBeenCalledWith({
                bucket: 'cong-khai',
                objectKey: 'thuong-hieu/logo/logo-vien-cong-nghe-so.png',
            });
            expect(mockStorage.remove).toHaveBeenCalledWith({
                bucket: 'cong-khai',
                objectKey: 'tdmu-logo.png',
            });
        });

        it('does not delete kept object when target and source have duplicate checksum', async () => {
            const dummyBuffer = Buffer.from('same-file-content');
            mockStorage.download.mockResolvedValue(dummyBuffer);
            mockStorage.upload.mockResolvedValue({ path: 'thuong-hieu/logo/logo.png' });
            mockStorage.stat.mockResolvedValue({ size: dummyBuffer.length });

            const manifest = {
                summary: { total: 1, keepBranding: 1, keepExternal: 0, nullAndDelete: 0, unresolved: 0 },
                items: [
                    {
                        id: 'item-branding-same',
                        classification: CLASSIFICATIONS.KEEP_BRANDING,
                        sourceBucket: 'cong-khai',
                        sourceObjectKey: 'thuong-hieu/logo/logo.png', // Source and target identical
                        targetBucket: 'cong-khai',
                        targetObjectKey: 'thuong-hieu/logo/logo.png',
                        status: 'PENDING',
                    },
                ],
            };

            await applyLegacyManifest({
                manifest,
                db: mockDb,
                storage: mockStorage,
                dryRun: false,
                snapshotConfirmed: true,
            });

            // Must NOT delete the kept object because source == target
            expect(mockStorage.remove).not.toHaveBeenCalled();
        });

        it('nulls database fields and deletes legacy storage objects for NULL_AND_DELETE', async () => {
            mockStorage.remove.mockResolvedValue({ data: [] });

            const manifest = {
                summary: { total: 1, keepBranding: 0, keepExternal: 0, nullAndDelete: 1, unresolved: 0 },
                items: [
                    {
                        id: 'item-null',
                        classification: CLASSIFICATIONS.NULL_AND_DELETE,
                        table: 'user',
                        recordId: 5,
                        field: 'avatarUrl',
                        sourceBucket: 'ca-nhan',
                        sourceObjectKey: 'old-avatar.jpg',
                        status: 'PENDING',
                    },
                ],
            };

            const report = await applyLegacyManifest({
                manifest,
                db: mockDb,
                storage: mockStorage,
                dryRun: false,
                snapshotConfirmed: true,
            });

            expect(report.summary.succeeded).toBe(1);
            expect(mockDb.user.update).toHaveBeenCalledWith({
                where: { id: 5 },
                data: { avatarUrl: null },
            });
            expect(mockStorage.remove).toHaveBeenCalledWith({
                bucket: 'ca-nhan',
                objectKey: 'old-avatar.jpg',
            });
        });

        it('resumes idempotently skipping already COMPLETED items', async () => {
            const manifest = {
                summary: { total: 2, keepBranding: 0, keepExternal: 0, nullAndDelete: 2, unresolved: 0 },
                items: [
                    {
                        id: 'item-done',
                        classification: CLASSIFICATIONS.NULL_AND_DELETE,
                        table: 'user',
                        recordId: 1,
                        field: 'avatarUrl',
                        status: 'COMPLETED', // Already done
                    },
                    {
                        id: 'item-pending',
                        classification: CLASSIFICATIONS.NULL_AND_DELETE,
                        table: 'user',
                        recordId: 2,
                        field: 'avatarUrl',
                        sourceBucket: 'ca-nhan',
                        sourceObjectKey: 'user-2.jpg',
                        status: 'PENDING',
                    },
                ],
            };

            const report = await applyLegacyManifest({
                manifest,
                db: mockDb,
                storage: mockStorage,
                dryRun: false,
                snapshotConfirmed: true,
            });

            expect(report.summary.skipped).toBe(1);
            expect(report.summary.succeeded).toBe(1);
            expect(mockDb.user.update).toHaveBeenCalledTimes(1);
            expect(mockDb.user.update).toHaveBeenCalledWith({
                where: { id: 2 },
                data: { avatarUrl: null },
            });
        });

        it('never removes any object outside the manifest', async () => {
            const manifest = {
                summary: { total: 1, keepBranding: 0, keepExternal: 1, nullAndDelete: 0, unresolved: 0 },
                items: [
                    {
                        id: 'item-external',
                        classification: CLASSIFICATIONS.KEEP_EXTERNAL,
                        table: 'submission',
                        recordId: 1,
                        field: 'sourceCodeUrl',
                        url: 'https://github.com/my-repo/tdmu',
                        status: 'PENDING',
                    },
                ],
            };

            await applyLegacyManifest({
                manifest,
                db: mockDb,
                storage: mockStorage,
                dryRun: false,
                snapshotConfirmed: true,
            });

            expect(mockStorage.remove).not.toHaveBeenCalled();
            expect(mockDb.submission.update).not.toHaveBeenCalled();
        });
    });
});
