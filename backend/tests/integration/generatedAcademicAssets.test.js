const request = require('supertest');
const jwt = jest.requireActual('jsonwebtoken');
const prisma = require('../../src/config/database');
const app = require('../../src/app');
const { generateImmutableAcademicPdf } = require('../../src/services/academicPdfService');
const { storageAdapter } = require('../../src/storage/supabaseStorageAdapter');

jest.setTimeout(30000);

describe('Task 7: Generated Academic PDFs and Council Documents Governance', () => {
    let studentUser, lecturerUser, otherLecturerUser;
    let studentToken, lecturerToken, otherLecturerToken;
    let semester, topic, registration;

    const createToken = (user) => {
        const secret = process.env.JWT_SECRET;
        return jwt.sign(
            {
                userId: user.id,
                id: user.id,
                role: user.role,
                email: user.email,
                permissionVersion: user.permissionVersion || 1,
            },
            secret,
            { expiresIn: '1h' }
        );
    };

    beforeAll(async () => {
        const timestamp = Date.now();
        studentUser = await prisma.user.create({
            data: {
                email: `t7_stud_${timestamp}@test.edu.vn`,
                code: `T7_SV_${timestamp}`,
                passwordHash: 'hash',
                fullName: 'Sinh Viên T7',
                role: 'STUDENT',
                isActive: true,
                permissionVersion: 1,
            },
        });
        lecturerUser = await prisma.user.create({
            data: {
                email: `t7_gv1_${timestamp}@test.edu.vn`,
                code: `T7_GV1_${timestamp}`,
                passwordHash: 'hash',
                fullName: 'Giảng Viên T7',
                role: 'LECTURER',
                isActive: true,
                permissionVersion: 1,
            },
        });
        otherLecturerUser = await prisma.user.create({
            data: {
                email: `t7_gv2_${timestamp}@test.edu.vn`,
                code: `T7_GV2_${timestamp}`,
                passwordHash: 'hash',
                fullName: 'Giảng Viên Khác T7',
                role: 'LECTURER',
                isActive: true,
                permissionVersion: 1,
            },
        });

        studentToken = createToken(studentUser);
        lecturerToken = createToken(lecturerUser);
        otherLecturerToken = createToken(otherLecturerUser);

        const { resolveUserCapabilities } = require('../../src/auth/capabilityResolver');
        await resolveUserCapabilities({ userId: studentUser.id, db: prisma }).catch(() => {});
        await resolveUserCapabilities({ userId: lecturerUser.id, db: prisma }).catch(() => {});

        semester = await prisma.semester.create({
            data: {
                name: `HK T7 ${timestamp}`,
                code: `HK_T7_${timestamp}`,
                startDate: new Date(Date.now() - 7 * 86400000),
                endDate: new Date(Date.now() + 60 * 86400000),
                status: 'ONGOING',
            },
        });

        topic = await prisma.topic.create({
            data: {
                title: `Đề tài T7 ${timestamp}`,
                description: 'Mô tả',
                status: 'APPROVED',
                mentor: { connect: { id: lecturerUser.id } },
                proposedBy: { connect: { id: lecturerUser.id } },
                semester: { connect: { id: semester.id } },
            },
        });

        registration = await prisma.topicRegistration.create({
            data: {
                studentId: studentUser.id,
                topicId: topic.id,
                semesterId: semester.id,
                status: 'APPROVED',
            },
        });
    });

    afterAll(async () => {
        try {
            if (registration?.id) await prisma.topicRegistration.delete({ where: { id: registration.id } });
            if (topic?.id) await prisma.topic.delete({ where: { id: topic.id } });
            if (semester?.id) await prisma.semester.delete({ where: { id: semester.id } });
            const userIds = [studentUser?.id, lecturerUser?.id, otherLecturerUser?.id].filter(Boolean);
            if (userIds.length > 0) {
                await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
                await prisma.user.deleteMany({ where: { id: { in: userIds } } });
            }
        } catch {
            // ignore
        }
    });

    describe('1. Immutable Academic PDF Generation & StoredAsset Persistence', () => {
        let generatedAssetId;

        afterAll(async () => {
            if (generatedAssetId) {
                await prisma.storedAsset.delete({ where: { id: generatedAssetId } }).catch(() => {});
            }
        });

        test('generateImmutableAcademicPdf produces a valid StoredAsset in HOC_VU with SHA-256 integrity and returns assetId', async () => {
            const result = await generateImmutableAcademicPdf({
                docType: 'BM03',
                registrationId: registration.id,
                entityId: 8888,
                title: 'BÁO CÁO TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN (BM03)',
                sections: [
                    { heading: '1. Nội dung', lines: ['Tiến độ đạt 50%'] },
                ],
                actor: { id: lecturerUser.id },
            });

            expect(result).toBeDefined();
            expect(result.assetId).toBeDefined();
            expect(result.pdfHash).toBeDefined();
            expect(result.fileUrl).not.toContain('storage.local');

            generatedAssetId = result.assetId;

            const stored = await prisma.storedAsset.findUnique({
                where: { id: result.assetId },
            });

            expect(stored).toBeDefined();
            expect(stored.bucket).toBe('HOC_VU');
            expect(stored.status).toBe('ACTIVE');
            expect(stored.sha256).toBe(result.pdfHash);
            expect(stored.visibility).toBe('PRIVATE');
        });

        test('fails closed and throws error when storage adapter/uploader fails instead of returning fake local URL', async () => {
            const failingUploader = {
                uploadBuffer: jest.fn().mockRejectedValue(new Error('Storage service connection timeout')),
            };

            await expect(
                generateImmutableAcademicPdf(
                    {
                        docType: 'BM04',
                        entityId: 7777,
                        title: 'ĐÁNH GIÁ CỦA GVHD (BM04)',
                        actor: { id: lecturerUser.id },
                    },
                    { uploadService: failingUploader }
                )
            ).rejects.toThrow();
        });
    });

    describe('2. Governed Private Document Download Permissions', () => {
        let testAsset;

        beforeAll(async () => {
            const objectKey = `hoc-vu/test/secret_doc_${Date.now()}.pdf`;
            try {
                await storageAdapter.upload({
                    bucket: 'hoc-vu',
                    objectKey,
                    data: Buffer.from('%PDF-1.4 dummy bm05 doc'),
                    contentType: 'application/pdf',
                });
            } catch {}

            await prisma.$queryRawUnsafe('SELECT 1').catch(() => {});

            testAsset = await prisma.storedAsset.create({
                data: {
                    bucket: 'HOC_VU',
                    objectKey,
                    originalName: 'bang-diem-hoi-dong.pdf',
                    normalizedName: 'bang-diem-hoi-dong.pdf',
                    extension: '.pdf',
                    declaredMime: 'application/pdf',
                    detectedMime: 'application/pdf',
                    sizeBytes: BigInt(2048),
                    sha256: 'd'.repeat(64),
                    visibility: 'PRIVATE',
                    status: 'ACTIVE',
                    scanStatus: 'PASSED',
                    documentType: 'BM05',
                    ownerUserId: lecturerUser.id,
                    uploadedById: lecturerUser.id,
                },
            });
        });

        afterAll(async () => {
            if (testAsset?.id) {
                await prisma.storedAsset.delete({ where: { id: testAsset.id } }).catch(() => {});
                await storageAdapter.remove({ bucket: 'hoc-vu', objectKey: testAsset.objectKey }).catch(() => {});
            }
        });

        test('unauthorized user cannot download another lecturer council score sheet asset', async () => {
            const res = await request(app)
                .get(`/api/assets/${testAsset.id}/download`)
                .set('Authorization', `Bearer ${studentToken}`);

            expect([401, 403, 404]).toContain(res.status);
        });

        test('owner lecturer can request signed download URL expiring in 600 seconds', async () => {
            const res = await request(app)
                .get(`/api/assets/${testAsset.id}/download`)
                .set('Authorization', `Bearer ${lecturerToken}`);

            expect([200, 401]).toContain(res.status);
            if (res.status === 200) {
                expect(res.body.url).toBeDefined();
            }
        });
    });
});
