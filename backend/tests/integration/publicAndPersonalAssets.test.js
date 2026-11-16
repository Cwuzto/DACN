const prisma = require('../../src/config/database');
const { storedAssetService } = require('../../src/services/storedAssetService');
const {
    createDraftRevision,
    publishRevision,
    getPublicPortalContent,
    createPortalResource,
} = require('../../src/services/portalContentService');
const {
    createAnnouncement,
    updateAnnouncement,
    getAnnouncements,
} = require('../../src/controllers/announcementController');
const { updateProfile, getMe } = require('../../src/controllers/authController');
const { storageAdapter } = require('../../src/storage/supabaseStorageAdapter');

describe('Task 9: Public and Personal Assets Governance Integration Tests', () => {
    let adminUser;
    beforeAll(async () => {
        adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
        if (!adminUser) {
            adminUser = await prisma.user.create({
                data: {
                    email: `admin_asset_${Date.now()}@tdmu.edu.vn`,
                    code: `ADMIN_${Date.now()}`,
                    fullName: 'Admin Test',
                    role: 'ADMIN',
                    passwordHash: 'dummy',
                },
            });
        }
    });

    beforeEach(async () => {
        // Pre-clean any leftover IDs from previous test runs
        await prisma.storedAsset.deleteMany({
            where: {
                id: {
                    in: [
                        'draft-portal-asset-1',
                        'announcement-asset-1',
                        'old-avatar-asset-1',
                        'new-avatar-asset-2',
                    ],
                },
            },
        }).catch(() => {});
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('1. Portal Draft vs Publish Asset Promotion', () => {
        test('draft portal asset remains private/staged and is not exposed in public content until published', async () => {
            // Mock or create draft asset
            const draftAsset = await prisma.storedAsset.create({
                data: {
                    id: 'draft-portal-asset-1',
                    bucket: 'TAM',
                    objectKey: 'cho-kiem-tra/ngay-2026-11-17/phien-test/draft-template.docx',
                    originalName: 'Bieu_mau_BM01_draft.docx',
                    normalizedName: 'draft-template.docx',
                    extension: 'docx',
                    declaredMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    detectedMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    sizeBytes: 10240,
                    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                    documentType: 'PORTAL_TEMPLATE',
                    visibility: 'PRIVATE',
                    status: 'STAGED',
                    uploadedById: adminUser.id,
                },
            });

            // Create a portal resource for template
            const resource = await createPortalResource({ resourceType: 'TEMPLATE' });

            // Create draft revision referencing the draft asset
            const draftRevision = await createDraftRevision({
                resourceType: 'TEMPLATE',
                resourceId: resource.id,
                payload: {
                    title: 'Biểu mẫu BM01 Đề cương',
                    code: 'BM01',
                    assetId: draftAsset.id,
                    fileName: draftAsset.originalName,
                },
                actorId: null,
            });

            expect(draftRevision.status).toBe('DRAFT');

            // Public portal content must NOT include this draft
            const publicContentBefore = await getPublicPortalContent();
            const foundInPublicBefore = (publicContentBefore.templates || []).find(
                (t) => t.id === resource.id
            );
            expect(foundInPublicBefore).toBeUndefined();

            // Publish revision -> should promote asset to CONG_KHAI and make visibility PUBLIC
            await publishRevision({
                resourceType: 'TEMPLATE',
                resourceId: resource.id,
                revisionId: draftRevision.id,
                actorId: null,
            });

            // Verify asset was promoted in DB
            const promotedAsset = await prisma.storedAsset.findUnique({
                where: { id: draftAsset.id },
            });
            expect(promotedAsset.bucket).toBe('CONG_KHAI');
            expect(promotedAsset.visibility).toBe('PUBLIC');
            expect(promotedAsset.status).toBe('ACTIVE');

            // Public portal content now includes the published template with public URL
            const publicContentAfter = await getPublicPortalContent();
            const foundInPublicAfter = (publicContentAfter.templates || []).find(
                (t) => t.id === resource.id
            );
            expect(foundInPublicAfter).toBeDefined();
            expect(foundInPublicAfter.assetId).toBe(draftAsset.id);

            // Clean up
            await prisma.portalContentRevisionAsset.deleteMany({
                where: { assetId: draftAsset.id },
            }).catch(() => {});
            await prisma.portalContentRevision.deleteMany({
                where: { resourceId: resource.id },
            }).catch(() => {});
            await prisma.portalTemplate.delete({
                where: { id: resource.id },
            }).catch(() => {});
            await prisma.storedAsset.delete({
                where: { id: draftAsset.id },
            }).catch(() => {});
        });
    });

    describe('2. Announcement File Asset Binding & Promotion', () => {
        test('announcement file attachment links via fileAssetId and promotes on publish', async () => {
            // Create staged announcement document asset
            const announcementAsset = await prisma.storedAsset.create({
                data: {
                    id: 'announcement-asset-1',
                    bucket: 'TAM',
                    objectKey: 'cho-kiem-tra/ngay-2026-11-17/phien-test/thong-bao-bao-ve.pdf',
                    originalName: 'Ke_hoach_bao_ve_2026.pdf',
                    normalizedName: 'thong-bao-bao-ve.pdf',
                    extension: 'pdf',
                    declaredMime: 'application/pdf',
                    detectedMime: 'application/pdf',
                    sizeBytes: 20480,
                    sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
                    documentType: 'PORTAL_DOCUMENT',
                    visibility: 'PRIVATE',
                    status: 'STAGED',
                    uploadedById: adminUser.id,
                },
            });

            // Create unpublished announcement with fileAssetId
            const draftReq = {
                body: {
                    title: 'Thông báo kế hoạch bảo vệ đợt 1',
                    content: 'Nội dung chi tiết thông báo kế hoạch',
                    category: 'ANNOUNCEMENT',
                    fileAssetId: announcementAsset.id,
                    isPublished: false,
                    isPinned: false,
                },
                user: { id: 1, role: 'ADMIN' },
            };

            let createdData = null;
            const draftRes = {
                status: (code) => ({
                    json: (data) => {
                        createdData = data.data;
                    },
                }),
                json: (data) => {
                    createdData = data.data;
                },
            };

            await createAnnouncement(draftReq, draftRes, (err) => {
                if (err) throw err;
            });

            expect(createdData).toBeDefined();
            expect(createdData.fileAssetId).toBe(announcementAsset.id);
            expect(createdData.isPublished).toBe(false);

            // Publish the announcement via updateAnnouncement
            const updateReq = {
                params: { id: String(createdData.id) },
                body: { isPublished: true },
                user: { id: 1, role: 'ADMIN' },
            };

            let updatedData = null;
            const updateRes = {
                json: (data) => {
                    updatedData = data.data;
                },
            };

            await updateAnnouncement(updateReq, updateRes, (err) => {
                if (err) throw err;
            });

            expect(updatedData.isPublished).toBe(true);

            // Asset should now be promoted to CONG_KHAI and PUBLIC
            const promoted = await prisma.storedAsset.findUnique({
                where: { id: announcementAsset.id },
            });
            expect(promoted.bucket).toBe('CONG_KHAI');
            expect(promoted.visibility).toBe('PUBLIC');
            expect(promoted.status).toBe('ACTIVE');

            // Clean up
            await prisma.publicAnnouncement.delete({
                where: { id: createdData.id },
            }).catch(() => {});
            await prisma.storedAsset.delete({
                where: { id: announcementAsset.id },
            }).catch(() => {});
        });
    });

    describe('3. User Avatar Governance & 7-Day Retention', () => {
        test('replacing user avatar retains old avatar for 7 days in bucket ca-nhan', async () => {
            // Find a test user or create one
            const testUser = await prisma.user.upsert({
                where: { email: 'avatar-test-user@tdmu.edu.vn' },
                update: {},
                create: {
                    email: 'avatar-test-user@tdmu.edu.vn',
                    code: 'AVATAR_TEST_01',
                    fullName: 'Nguyễn Văn Avatar',
                    passwordHash: 'dummy-hash',
                    role: 'STUDENT',
                },
            });

            // Create initial avatar asset
            const oldAvatar = await prisma.storedAsset.create({
                data: {
                    id: 'old-avatar-asset-1',
                    bucket: 'CA_NHAN',
                    objectKey: `nguoi-dung-${testUser.id}/anh-dai-dien/hien-tai/old-avatar.webp`,
                    originalName: 'avatar_cu.png',
                    normalizedName: 'old-avatar.webp',
                    extension: 'webp',
                    declaredMime: 'image/webp',
                    detectedMime: 'image/webp',
                    sizeBytes: 15000,
                    sha256: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
                    documentType: 'USER_AVATAR',
                    visibility: 'PRIVATE',
                    ownerUserId: testUser.id,
                    uploadedById: testUser.id,
                    status: 'ACTIVE',
                },
            });

            // Assign old avatar to user
            await prisma.user.update({
                where: { id: testUser.id },
                data: { avatarAssetId: oldAvatar.id },
            });

            // Create new avatar asset
            const avatarTimestamp = Date.now();
            const newAvatar = await prisma.storedAsset.create({
                data: {
                    id: `new-avatar-asset-${avatarTimestamp}`,
                    bucket: 'CA_NHAN',
                    objectKey: `nguoi-dung-${testUser.id}/anh-dai-dien/hien-tai/new-avatar-${avatarTimestamp}.webp`,
                    originalName: 'avatar_moi.png',
                    normalizedName: `new-avatar-${avatarTimestamp}.webp`,
                    extension: 'webp',
                    declaredMime: 'image/webp',
                    detectedMime: 'image/webp',
                    sizeBytes: 18000,
                    sha256: '2222333344445555666677778888999900001111bbbbccccddddeeeeffffaaaa',
                    documentType: 'USER_AVATAR',
                    visibility: 'PRIVATE',
                    ownerUserId: testUser.id,
                    uploadedById: testUser.id,
                    status: 'ACTIVE',
                },
            });

            // Call updateProfile to update avatar
            const req = {
                user: { id: testUser.id, role: 'STUDENT' },
                body: { avatarAssetId: newAvatar.id },
            };

            let updatedUser = null;
            const res = {
                json: (data) => {
                    updatedUser = data.data;
                },
            };

            await updateProfile(req, res, (err) => {
                if (err) throw err;
            });

            // Verify user now has new avatar
            const reloadedUser = await prisma.user.findUnique({
                where: { id: testUser.id },
            });
            expect(reloadedUser.avatarAssetId).toBe(newAvatar.id);

            // Verify old avatar was marked REPLACED and retention is ~7 days
            const reloadedOldAvatar = await prisma.storedAsset.findUnique({
                where: { id: oldAvatar.id },
            });
            expect(reloadedOldAvatar.status).toBe('REPLACED');
            expect(reloadedOldAvatar.replacedById).toBe(newAvatar.id);
            expect(reloadedOldAvatar.retentionUntil).toBeDefined();

            const retentionDiffMs = new Date(reloadedOldAvatar.retentionUntil).getTime() - Date.now();
            const retentionDays = retentionDiffMs / (1000 * 60 * 60 * 24);
            expect(retentionDays).toBeGreaterThan(6.5);
            expect(retentionDays).toBeLessThanOrEqual(7.1);

            // Avatar is in bucket ca-nhan (PRIVATE) -> download via getAssetDownload requires auth
            await storageAdapter.upload({
                bucket: 'ca-nhan',
                objectKey: newAvatar.objectKey,
                data: Buffer.from('dummy-avatar-image-data'),
                contentType: 'image/webp',
                upsert: true,
            });

            const downloadResult = await storedAssetService.getAssetDownload({
                assetId: newAvatar.id,
                actor: { id: testUser.id, role: 'STUDENT' },
            });
            expect(downloadResult.visibility).toBe('PRIVATE');
            expect(downloadResult.url).toBeDefined();
            expect(downloadResult.expiresAt).toBeDefined();

            await storageAdapter.remove({
                bucket: 'ca-nhan',
                objectKey: newAvatar.objectKey,
            }).catch(() => {});

            // Clean up
            await prisma.user.update({
                where: { id: testUser.id },
                data: { avatarAssetId: null },
            }).catch(() => {});
            await prisma.storedAsset.delete({
                where: { id: oldAvatar.id },
            }).catch(() => {});
            await prisma.storedAsset.delete({
                where: { id: newAvatar.id },
            }).catch(() => {});
            await prisma.auditLog.deleteMany({
                where: { userId: testUser.id },
            }).catch(() => {});
            await prisma.user.delete({
                where: { id: testUser.id },
            }).catch(() => {});
        });
    });
});
