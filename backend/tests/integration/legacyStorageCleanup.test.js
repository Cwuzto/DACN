const prisma = require('../../src/config/database');
const { storageAdapter } = require('../../src/storage/supabaseStorageAdapter');
const {
    buildLegacyManifest,
    applyLegacyManifest,
    CLASSIFICATIONS,
} = require('../../src/services/legacyStorageMigrationService');

describe('legacyStorageCleanup Integration', () => {
    let testUser;
    let testAnnouncement;

    beforeAll(async () => {
        // Create test user with legacy avatarUrl
        testUser = await prisma.user.create({
            data: {
                email: `legacy_user_${Date.now()}@tdmu.edu.vn`,
                passwordHash: 'dummyhash',
                fullName: 'Test Legacy User',
                code: `LEGACY_${Date.now()}`,
                role: 'STUDENT',
                avatarUrl: 'https://aanqmscxckeejuhvaezm.supabase.co/storage/v1/object/public/ca-nhan/test-legacy-avatar.jpg',
            },
        });

        // Create test announcement with external GitHub link or legacy fileUrl
        testAnnouncement = await prisma.publicAnnouncement.create({
            data: {
                title: `Legacy Announcement ${Date.now()}`,
                content: 'Test legacy cleanup announcement',
                isPublished: true,
                announcementType: 'RICH_TEXT',
                fileUrl: 'https://github.com/tdmu/sample-guideline',
            },
        });
    });

    afterAll(async () => {
        if (testAnnouncement) {
            await prisma.publicAnnouncement.deleteMany({ where: { id: testAnnouncement.id } });
        }
        if (testUser) {
            await prisma.user.deleteMany({ where: { id: testUser.id } });
        }
    });

    it('builds a manifest containing the test legacy items with correct classification', async () => {
        const manifest = await buildLegacyManifest({ db: prisma, storage: storageAdapter });

        expect(manifest.summary.total).toBeGreaterThanOrEqual(2);

        // testUser's avatarUrl should be classified as NULL_AND_DELETE
        const userItem = manifest.items.find(
            (i) => i.table === 'user' && i.recordId === testUser.id && i.field === 'avatarUrl'
        );
        expect(userItem).toBeDefined();
        expect(userItem.classification).toBe(CLASSIFICATIONS.NULL_AND_DELETE);

        // testAnnouncement's fileUrl should be classified as KEEP_EXTERNAL
        const announcementItem = manifest.items.find(
            (i) => i.table === 'publicAnnouncement' && i.recordId === testAnnouncement.id
        );
        expect(announcementItem).toBeDefined();
        expect(announcementItem.classification).toBe(CLASSIFICATIONS.KEEP_EXTERNAL);
    });

    it('preserves database values in dry-run mode', async () => {
        const manifest = {
            summary: { total: 1, keepBranding: 0, keepExternal: 0, nullAndDelete: 1, unresolved: 0 },
            items: [
                {
                    id: 'int-test-dry',
                    classification: CLASSIFICATIONS.NULL_AND_DELETE,
                    table: 'user',
                    recordId: testUser.id,
                    field: 'avatarUrl',
                    url: testUser.avatarUrl,
                    status: 'PENDING',
                },
            ],
        };

        const report = await applyLegacyManifest({
            manifest,
            db: prisma,
            storage: storageAdapter,
            dryRun: true,
            snapshotConfirmed: true,
        });

        expect(report.dryRun).toBe(true);

        const checkUser = await prisma.user.findUnique({ where: { id: testUser.id } });
        expect(checkUser.avatarUrl).toBe(testUser.avatarUrl); // Unchanged!
    });

    it('nulls database field in apply mode with snapshot confirmed', async () => {
        const manifest = {
            summary: { total: 1, keepBranding: 0, keepExternal: 0, nullAndDelete: 1, unresolved: 0 },
            items: [
                {
                    id: 'int-test-apply',
                    classification: CLASSIFICATIONS.NULL_AND_DELETE,
                    table: 'user',
                    recordId: testUser.id,
                    field: 'avatarUrl',
                    url: testUser.avatarUrl,
                    status: 'PENDING',
                },
            ],
        };

        const report = await applyLegacyManifest({
            manifest,
            db: prisma,
            storage: storageAdapter,
            dryRun: false,
            snapshotConfirmed: true,
        });

        expect(report.dryRun).toBe(false);
        expect(report.summary.succeeded).toBe(1);

        const checkUser = await prisma.user.findUnique({ where: { id: testUser.id } });
        expect(checkUser.avatarUrl).toBeNull(); // Nulled!
    });
});
