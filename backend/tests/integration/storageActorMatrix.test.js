const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const request = require('supertest');
const jwt = jest.requireActual('jsonwebtoken');
const prisma = require('../../src/config/database');
const app = require('../../src/app');
const { storageAdapter } = require('../../src/storage/supabaseStorageAdapter');

jest.setTimeout(30000);

describe('Storage Actor Matrix Integration Tests (Task 12)', () => {
    let studentA, studentB, mentorA, mentorB, adminUser;
    let tokenStudentA, tokenStudentB, tokenMentorA, tokenMentorB, tokenAdmin;
    let semester, topicA, registrationA;
    let assetPrivateA, assetPublic;

    const createToken = (user) => {
        return jwt.sign(
            { userId: user.id, id: user.id, role: user.role, email: user.email },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );
    };

    beforeAll(async () => {
        const ts = Date.now();

        // 1. Create Users
        studentA = await prisma.user.create({
            data: {
                email: `student_mat_a_${ts}@test.edu.vn`,
                code: `SV_MAT_A_${ts}`,
                passwordHash: 'hash',
                fullName: 'Sinh Viên Matrix A',
                role: 'STUDENT',
            },
        });
        studentB = await prisma.user.create({
            data: {
                email: `student_mat_b_${ts}@test.edu.vn`,
                code: `SV_MAT_B_${ts}`,
                passwordHash: 'hash',
                fullName: 'Sinh Viên Matrix B',
                role: 'STUDENT',
            },
        });
        mentorA = await prisma.user.create({
            data: {
                email: `mentor_mat_a_${ts}@test.edu.vn`,
                code: `GV_MAT_A_${ts}`,
                passwordHash: 'hash',
                fullName: 'GVHD Matrix A',
                role: 'LECTURER',
            },
        });
        mentorB = await prisma.user.create({
            data: {
                email: `mentor_mat_b_${ts}@test.edu.vn`,
                code: `GV_MAT_B_${ts}`,
                passwordHash: 'hash',
                fullName: 'GVHD Matrix B',
                role: 'LECTURER',
            },
        });
        adminUser = await prisma.user.create({
            data: {
                email: `admin_mat_${ts}@test.edu.vn`,
                code: `AD_MAT_${ts}`,
                passwordHash: 'hash',
                fullName: 'Quản Trị Matrix',
                role: 'ADMIN',
            },
        });

        tokenStudentA = createToken(studentA);
        tokenStudentB = createToken(studentB);
        tokenMentorA = createToken(mentorA);
        tokenMentorB = createToken(mentorB);
        tokenAdmin = createToken(adminUser);

        // 2. Create Academic Topic & Registration
        semester = await prisma.semester.create({
            data: {
                code: `SEM_MAT_${ts}`,
                name: `Học kỳ Matrix ${ts}`,
                startDate: new Date('2026-09-01'),
                endDate: new Date('2027-01-31'),
                status: 'ONGOING',
            },
        });

        topicA = await prisma.topic.create({
            data: {
                title: `Đề tài Matrix A ${ts}`,
                description: 'Mô tả Matrix',
                status: 'APPROVED',
                maxStudents: 1,
                mentor: { connect: { id: mentorA.id } },
                proposedBy: { connect: { id: mentorA.id } },
                semester: { connect: { id: semester.id } },
            },
        });

        registrationA = await prisma.topicRegistration.create({
            data: {
                topicId: topicA.id,
                studentId: studentA.id,
                semesterId: semester.id,
                status: 'APPROVED',
            },
        });

        // 3. Upload dummy buffer to ca-nhan and hoc-vu to satisfy Supabase signed URL generation
        const dummyKeyPrivate = `hoc-vu/matrix/doc_a_${ts}.pdf`;
        try {
            await storageAdapter.upload({
                bucket: 'hoc-vu',
                objectKey: dummyKeyPrivate,
                data: Buffer.from('%PDF-1.4 matrix private document'),
                contentType: 'application/pdf',
            });
        } catch {}

        // 4. Create Private Asset for Student A
        assetPrivateA = await prisma.storedAsset.create({
            data: {
                bucket: 'HOC_VU',
                objectKey: dummyKeyPrivate,
                originalName: 'report_matrix_a.pdf',
                normalizedName: 'report_matrix_a.pdf',
                extension: 'pdf',
                declaredMime: 'application/pdf',
                detectedMime: 'application/pdf',
                sizeBytes: 1024n,
                sha256: 'a'.repeat(64),
                ownerUserId: studentA.id,
                uploadedById: studentA.id,
                registrationId: registrationA.id,
                documentType: 'REPORT_PDF',
                visibility: 'PRIVATE',
                status: 'ACTIVE',
            },
        });

        // 5. Create Public Asset
        assetPublic = await prisma.storedAsset.create({
            data: {
                bucket: 'CONG_KHAI',
                objectKey: `thuong-hieu/logo/logo_${ts}.png`,
                originalName: 'logo.png',
                normalizedName: 'logo.png',
                extension: 'png',
                declaredMime: 'image/png',
                detectedMime: 'image/png',
                sizeBytes: 2048n,
                sha256: 'b'.repeat(64),
                uploadedById: adminUser.id,
                documentType: 'PORTAL_IMAGE',
                visibility: 'PUBLIC',
                status: 'ACTIVE',
            },
        });
    });

    afterAll(async () => {
        try {
            if (assetPrivateA) {
                await prisma.storedAsset.deleteMany({ where: { id: assetPrivateA.id } });
                await storageAdapter.remove({ bucket: 'hoc-vu', objectKey: assetPrivateA.objectKey }).catch(() => {});
            }
            if (assetPublic) {
                await prisma.storedAsset.deleteMany({ where: { id: assetPublic.id } });
            }
            if (registrationA) {
                await prisma.topicRegistration.deleteMany({ where: { id: registrationA.id } });
            }
            if (topicA) {
                await prisma.topic.deleteMany({ where: { id: topicA.id } });
            }
            if (semester) {
                await prisma.semester.deleteMany({ where: { id: semester.id } });
            }
            const userIds = [studentA?.id, studentB?.id, mentorA?.id, mentorB?.id, adminUser?.id].filter(Boolean);
            if (userIds.length > 0) {
                await prisma.storedAssetUploadSession.deleteMany({ where: { actorId: { in: userIds } } });
                await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
                await prisma.user.deleteMany({ where: { id: { in: userIds } } });
            }
        } catch {}
    });

    describe('Actor Download Authorization Matrix', () => {
        it('allows Student A to download own registration asset', async () => {
            const res = await request(app)
                .get(`/api/assets/${assetPrivateA.id}/download`)
                .set('Authorization', `Bearer ${tokenStudentA}`);

            expect(res.status).toBe(200);
            expect(res.body.url || res.body.downloadUrl).toBeDefined();
            expect(res.body.visibility).toBe('PRIVATE');
        });

        it('forbids Student B from downloading Student A private asset (403)', async () => {
            const res = await request(app)
                .get(`/api/assets/${assetPrivateA.id}/download`)
                .set('Authorization', `Bearer ${tokenStudentB}`);

            expect([403, 404]).toContain(res.status);
        });

        it('allows assigned Mentor A to download mentored student asset', async () => {
            const res = await request(app)
                .get(`/api/assets/${assetPrivateA.id}/download`)
                .set('Authorization', `Bearer ${tokenMentorA}`);

            expect(res.status).toBe(200);
            expect(res.body.url || res.body.downloadUrl).toBeDefined();
        });

        it('forbids unassigned Mentor B from downloading unassigned student asset (403)', async () => {
            const res = await request(app)
                .get(`/api/assets/${assetPrivateA.id}/download`)
                .set('Authorization', `Bearer ${tokenMentorB}`);

            expect([403, 404]).toContain(res.status);
        });

        it('allows Admin to download academic private asset', async () => {
            const res = await request(app)
                .get(`/api/assets/${assetPrivateA.id}/download`)
                .set('Authorization', `Bearer ${tokenAdmin}`);

            expect(res.status).toBe(200);
            expect(res.body.url || res.body.downloadUrl).toBeDefined();
        });

        it('forbids anonymous public visitor from downloading private asset (401)', async () => {
            const res = await request(app).get(`/api/assets/${assetPrivateA.id}/download`);

            expect([401, 403]).toContain(res.status);
        });
    });

    describe('Upload Transport Negotiation Matrix', () => {
        it('supports direct multipart upload when file size is <= 6 MB (e.g. small PDF)', async () => {
            const res = await request(app)
                .post('/api/assets')
                .set('Authorization', `Bearer ${tokenStudentA}`)
                .field('documentType', 'REPORT_PDF')
                .field('resourceContext', JSON.stringify({ registrationId: registrationA.id }))
                .attach('file', Buffer.from('%PDF-1.4 matrix upload test'), 'report_matrix.pdf');

            expect(res.status).toBe(201);
            expect(res.body.id).toBeDefined();
            expect(res.body.status).toBe('ACTIVE');

            // Cleanup created asset
            await prisma.storedAsset.deleteMany({ where: { id: res.body.id } });
        });

        it('creates TUS session when file size is > 6 MB (e.g. 15 MB)', async () => {
            const res = await request(app)
                .post('/api/assets/upload-sessions')
                .set('Authorization', `Bearer ${tokenStudentA}`)
                .send({
                    documentType: 'SOURCE_ZIP',
                    originalName: 'source_large.zip',
                    sizeBytes: 15 * 1024 * 1024,
                    declaredMime: 'application/zip',
                    resourceContext: { registrationId: registrationA.id },
                });

            expect(res.status).toBe(201);
            expect(res.body.sessionId).toBeDefined();
            expect(res.body.tusEndpoint).toBeDefined();
            expect(res.body.chunkSizeBytes).toBe(6 * 1024 * 1024); // 6 MB chunk
        });

        it('rejects upload when file size exceeds maximum 50 MB boundary (e.g. 51 MB)', async () => {
            const res = await request(app)
                .post('/api/assets/upload-sessions')
                .set('Authorization', `Bearer ${tokenStudentA}`)
                .send({
                    documentType: 'SOURCE_ZIP',
                    originalName: 'oversized.zip',
                    sizeBytes: 51 * 1024 * 1024,
                    declaredMime: 'application/zip',
                    resourceContext: { registrationId: registrationA.id },
                });

            expect([400, 413, 422]).toContain(res.status);
            const errText = res.body.error || res.body.message || '';
            expect(errText).toMatch(/max|limit|exceed|50/i);
        });
    });
});
