const request = require('supertest');
const jwt = jest.requireActual('jsonwebtoken');
const prisma = require('../../src/config/database');
const app = require('../../src/app');

jest.setTimeout(30000);

describe('Archive Asset Binding Integration Tests (Task 8)', () => {
    let studentUser, otherStudentUser, mentorUser;
    let studentToken, otherStudentToken, mentorToken;
    let semester, topic, registrationA, registrationB;
    let assetWordA, assetWordB, assetPdfA, assetSlideA, assetZipA;

    const createTestToken = (user) => {
        return jwt.sign(
            { userId: user.id, id: user.id, role: user.role, email: user.email },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );
    };

    beforeAll(async () => {
        const timestamp = Date.now();

        // 1. Create users
        studentUser = await prisma.user.create({
            data: {
                email: `stud_arch_a_${timestamp}@test.edu.vn`,
                code: `SV_ARCH_A_${timestamp}`,
                passwordHash: 'password_hash_placeholder',
                fullName: 'Sinh Viên A Lưu Chiểu',
                role: 'STUDENT',
                isActive: true,
            },
        });
        otherStudentUser = await prisma.user.create({
            data: {
                email: `stud_arch_b_${timestamp}@test.edu.vn`,
                code: `SV_ARCH_B_${timestamp}`,
                passwordHash: 'password_hash_placeholder',
                fullName: 'Sinh Viên B Lưu Chiểu',
                role: 'STUDENT',
                isActive: true,
            },
        });
        mentorUser = await prisma.user.create({
            data: {
                email: `mentor_arch_${timestamp}@test.edu.vn`,
                code: `GV_ARCH_${timestamp}`,
                passwordHash: 'password_hash_placeholder',
                fullName: 'Giảng Viên Hướng Dẫn Lưu Chiểu',
                role: 'LECTURER',
                isActive: true,
            },
        });

        studentToken = createTestToken(studentUser);
        otherStudentToken = createTestToken(otherStudentUser);
        mentorToken = createTestToken(mentorUser);

        // 2. Create semester & topics & registrations
        semester = await prisma.semester.create({
            data: {
                name: `HK Arch Test ${timestamp}`,
                code: `HK_ARCH_${timestamp}`,
                startDate: new Date(Date.now() - 30 * 86400000),
                endDate: new Date(Date.now() + 60 * 86400000),
                status: 'ONGOING',
            },
        });

        topic = await prisma.topic.create({
            data: {
                title: `Đề tài Lưu chiểu A ${timestamp}`,
                description: 'Mô tả đề tài',
                status: 'APPROVED',
                mentor: { connect: { id: mentorUser.id } },
                proposedBy: { connect: { id: mentorUser.id } },
                semester: { connect: { id: semester.id } },
            },
        });

        registrationA = await prisma.topicRegistration.create({
            data: {
                studentId: studentUser.id,
                topicId: topic.id,
                semesterId: semester.id,
                status: 'DEFENSE_PASSED',
            },
        });

        registrationB = await prisma.topicRegistration.create({
            data: {
                studentId: otherStudentUser.id,
                topicId: topic.id,
                semesterId: semester.id,
                status: 'DEFENSE_PASSED',
            },
        });

        // 3. Create active stored assets
        assetWordA = await prisma.storedAsset.create({
            data: {
                bucket: 'HOC_VU',
                objectKey: `hoc-vu/test/word_a_${timestamp}.docx`,
                originalName: 'report_a.docx',
                normalizedName: 'report_a.docx',
                extension: '.docx',
                declaredMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                detectedMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                sizeBytes: BigInt(2 * 1024 * 1024),
                sha256: '1'.repeat(64),
                visibility: 'PRIVATE',
                status: 'ACTIVE',
                scanStatus: 'PASSED',
                documentType: 'REPORT_WORD',
                ownerUserId: studentUser.id,
                uploadedById: studentUser.id,
            },
        });

        assetWordB = await prisma.storedAsset.create({
            data: {
                bucket: 'HOC_VU',
                objectKey: `hoc-vu/test/word_b_${timestamp}.docx`,
                originalName: 'report_b.docx',
                normalizedName: 'report_b.docx',
                extension: '.docx',
                declaredMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                detectedMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                sizeBytes: BigInt(2 * 1024 * 1024),
                sha256: '2'.repeat(64),
                visibility: 'PRIVATE',
                status: 'ACTIVE',
                scanStatus: 'PASSED',
                documentType: 'REPORT_WORD',
                ownerUserId: otherStudentUser.id,
                uploadedById: otherStudentUser.id,
            },
        });

        assetPdfA = await prisma.storedAsset.create({
            data: {
                bucket: 'HOC_VU',
                objectKey: `hoc-vu/test/pdf_a_${timestamp}.pdf`,
                originalName: 'report_a.pdf',
                normalizedName: 'report_a.pdf',
                extension: '.pdf',
                declaredMime: 'application/pdf',
                detectedMime: 'application/pdf',
                sizeBytes: BigInt(3 * 1024 * 1024),
                sha256: '3'.repeat(64),
                visibility: 'PRIVATE',
                status: 'ACTIVE',
                scanStatus: 'PASSED',
                documentType: 'REPORT_PDF',
                ownerUserId: studentUser.id,
                uploadedById: studentUser.id,
            },
        });

        assetSlideA = await prisma.storedAsset.create({
            data: {
                bucket: 'HOC_VU',
                objectKey: `hoc-vu/test/slide_a_${timestamp}.pptx`,
                originalName: 'slide_a.pptx',
                normalizedName: 'slide_a.pptx',
                extension: '.pptx',
                declaredMime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                detectedMime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                sizeBytes: BigInt(4 * 1024 * 1024),
                sha256: '4'.repeat(64),
                visibility: 'PRIVATE',
                status: 'ACTIVE',
                scanStatus: 'PASSED',
                documentType: 'SLIDE_PPTX',
                ownerUserId: studentUser.id,
                uploadedById: studentUser.id,
            },
        });

        assetZipA = await prisma.storedAsset.create({
            data: {
                bucket: 'HOC_VU',
                objectKey: `hoc-vu/test/source_a_${timestamp}.zip`,
                originalName: 'source_a.zip',
                normalizedName: 'source_a.zip',
                extension: '.zip',
                declaredMime: 'application/zip',
                detectedMime: 'application/zip',
                sizeBytes: BigInt(5 * 1024 * 1024),
                sha256: '5'.repeat(64),
                visibility: 'PRIVATE',
                status: 'ACTIVE',
                scanStatus: 'PASSED',
                documentType: 'SOURCE_ZIP',
                ownerUserId: studentUser.id,
                uploadedById: studentUser.id,
            },
        });
    });

    afterAll(async () => {
        try {
            await prisma.defenseDocumentVersion.deleteMany({
                where: { registrationId: { in: [registrationA?.id, registrationB?.id].filter(Boolean) } },
            });
            await prisma.projectArchive.deleteMany({
                where: { registrationId: { in: [registrationA?.id, registrationB?.id].filter(Boolean) } },
            });
            await prisma.storedAsset.deleteMany({
                where: { ownerUserId: { in: [studentUser?.id, otherStudentUser?.id, mentorUser?.id].filter(Boolean) } },
            });
            await prisma.topicRegistration.deleteMany({
                where: { id: { in: [registrationA?.id, registrationB?.id].filter(Boolean) } },
            });
            await prisma.topic.deleteMany({
                where: { id: topic?.id },
            });
            await prisma.semester.deleteMany({
                where: { id: semester?.id },
            });
            await prisma.auditLog.deleteMany({
                where: { userId: { in: [studentUser?.id, otherStudentUser?.id, mentorUser?.id].filter(Boolean) } },
            });
            await prisma.user.deleteMany({
                where: { id: { in: [studentUser?.id, otherStudentUser?.id, mentorUser?.id].filter(Boolean) } },
            });
        } catch (e) {
            // cleanup best-effort
        }
    });

    describe('1. Dossier IDOR & Scope Protection', () => {
        it('rejects student B attempting to upload a document version for student A registration', async () => {
            const res = await request(app)
                .post(`/api/archives/registrations/${registrationA.id}/files`)
                .set('Authorization', `Bearer ${otherStudentToken}`)
                .send({
                    documentType: 'REPORT_WORD',
                    assetId: assetWordB.id,
                });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });

        it('rejects student A attempting to bind an asset owned by student B', async () => {
            const res = await request(app)
                .post(`/api/archives/registrations/${registrationA.id}/files`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    documentType: 'REPORT_WORD',
                    assetId: assetWordB.id,
                });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });
    });

    describe('2. Document Type, Format, and Video Policy Enforcement', () => {
        it('rejects direct file upload for DEMO_VIDEO', async () => {
            const res = await request(app)
                .post(`/api/archives/registrations/${registrationA.id}/files`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    documentType: 'DEMO_VIDEO',
                    fileUrl: 'https://example.com/demo.mp4',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            const errStr = JSON.stringify(res.body);
            expect(errStr).toMatch(/video.*URL|không cho phép tải trực tiếp tệp video/i);
        });

        it('rejects non-HTTPS demo video URL in dossier update', async () => {
            const res = await request(app)
                .post(`/api/archives/registrations/${registrationA.id}/files`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    documentType: 'DEMO_VIDEO',
                    demoVideoExternalUrl: 'http://insecure-video.com/demo',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('accepts valid HTTPS external demo video URL', async () => {
            const res = await request(app)
                .post(`/api/archives/registrations/${registrationA.id}/files`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    documentType: 'DEMO_VIDEO',
                    demoVideoExternalUrl: 'https://youtube.com/watch?v=valid123',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.version.demoVideoExternalUrl).toBe('https://youtube.com/watch?v=valid123');
        });
    });

    describe('3. Governed Asset Binding & Immutability', () => {
        it('successfully binds REPORT_WORD asset to registration with exact metadata and checksum', async () => {
            const res = await request(app)
                .post(`/api/archives/registrations/${registrationA.id}/files`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    documentType: 'REPORT_WORD',
                    assetId: assetWordA.id,
                });

            if (res.status !== 200) {
                console.log('RES 6 ERROR BODY:', JSON.stringify(res.body));
            }

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.version).toBeDefined();
            expect(res.body.data.version.versionNumber).toBe(1);
            expect(res.body.data.version.assetId).toBe(assetWordA.id);
            expect(res.body.data.version.checksum).toBe(assetWordA.sha256);
            expect(res.body.data.version.fileName).toBe(assetWordA.originalName);
        });

        it('creates a new immutable version on subsequent upload without modifying prior version', async () => {
            const timestamp = Date.now();
            const assetWordA2 = await prisma.storedAsset.create({
                data: {
                    bucket: 'HOC_VU',
                    objectKey: `hoc-vu/test/word_a2_${timestamp}.docx`,
                    originalName: 'report_a_v2.docx',
                    normalizedName: 'report_a_v2.docx',
                    extension: '.docx',
                    declaredMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    detectedMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    sizeBytes: BigInt(2 * 1024 * 1024),
                    sha256: '9'.repeat(64),
                    visibility: 'PRIVATE',
                    status: 'ACTIVE',
                    scanStatus: 'PASSED',
                    documentType: 'REPORT_WORD',
                    ownerUserId: studentUser.id,
                    uploadedById: studentUser.id,
                },
            });

            const res = await request(app)
                .post(`/api/archives/registrations/${registrationA.id}/files`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    documentType: 'REPORT_WORD',
                    assetId: assetWordA2.id,
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.version.versionNumber).toBe(2);
            expect(res.body.data.version.assetId).toBe(assetWordA2.id);

            // Verify version 1 row in database remains unchanged
            const v1 = await prisma.defenseDocumentVersion.findFirst({
                where: {
                    registrationId: registrationA.id,
                    documentType: 'REPORT_WORD',
                    versionNumber: 1,
                },
            });
            expect(v1).toBeDefined();
            expect(v1.assetId).toBe(assetWordA.id);
            expect(v1.checksum).toBe(assetWordA.sha256);

            await prisma.storedAsset.delete({ where: { id: assetWordA2.id } });
        });
    });
});
