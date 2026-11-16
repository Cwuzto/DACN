const request = require('supertest');
const jwt = jest.requireActual('jsonwebtoken');
const prisma = require('../../src/config/database');
const app = require('../../src/app');

jest.setTimeout(30000);

describe('Submission Asset Binding Integration Tests (Task 6)', () => {
    let studentUser, otherStudentUser, mentorUser;
    let studentToken, otherStudentToken, mentorToken;
    let semester, topic, registration;
    let activeAssetStudent, activeAssetOther;

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
                email: `stud_${timestamp}@test.edu.vn`,
                code: `SV_${timestamp}`,
                passwordHash: 'password_hash_placeholder',
                fullName: 'Sinh Viên Nộp Bài',
                role: 'STUDENT',
                isActive: true,
            },
        });
        otherStudentUser = await prisma.user.create({
            data: {
                email: `other_${timestamp}@test.edu.vn`,
                code: `SV2_${timestamp}`,
                passwordHash: 'password_hash_placeholder',
                fullName: 'Sinh Viên Khác',
                role: 'STUDENT',
                isActive: true,
            },
        });
        mentorUser = await prisma.user.create({
            data: {
                email: `mentor_${timestamp}@test.edu.vn`,
                code: `GV_${timestamp}`,
                passwordHash: 'password_hash_placeholder',
                fullName: 'Giảng Viên Hướng Dẫn',
                role: 'LECTURER',
                isActive: true,
            },
        });

        studentToken = createTestToken(studentUser);
        otherStudentToken = createTestToken(otherStudentUser);
        mentorToken = createTestToken(mentorUser);

        // 2. Create semester & topic & registration
        semester = await prisma.semester.create({
            data: {
                name: `HK Test ${timestamp}`,
                code: `HK_${timestamp}`,
                startDate: new Date(Date.now() - 7 * 86400000),
                endDate: new Date(Date.now() + 60 * 86400000),
                outlineSubmissionOpenAt: new Date(Date.now() - 3 * 86400000),
                outlineSubmissionDeadline: new Date(Date.now() + 10 * 86400000),
                status: 'ONGOING',
            },
        });

        topic = await prisma.topic.create({
            data: {
                title: `Đề tài kiểm thử ${timestamp}`,
                description: 'Mô tả đề tài',
                status: 'APPROVED',
                mentor: { connect: { id: mentorUser.id } },
                proposedBy: { connect: { id: mentorUser.id } },
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

        // 3. Create active assets
        activeAssetStudent = await prisma.storedAsset.create({
            data: {
                bucket: 'HOC_VU',
                objectKey: `hoc-vu/test/student_${timestamp}.pdf`,
                originalName: 'de-cuong-bm01.pdf',
                normalizedName: 'de-cuong-bm01.pdf',
                extension: '.pdf',
                declaredMime: 'application/pdf',
                detectedMime: 'application/pdf',
                sizeBytes: BigInt(1024 * 1024),
                sha256: 'a'.repeat(64),
                visibility: 'PRIVATE',
                status: 'ACTIVE',
                scanStatus: 'PASSED',
                documentType: 'BM01',
                ownerUserId: studentUser.id,
                uploadedById: studentUser.id,
            },
        });

        activeAssetOther = await prisma.storedAsset.create({
            data: {
                bucket: 'HOC_VU',
                objectKey: `hoc-vu/test/other_${timestamp}.pdf`,
                originalName: 'de-cuong-other.pdf',
                normalizedName: 'de-cuong-other.pdf',
                extension: '.pdf',
                declaredMime: 'application/pdf',
                detectedMime: 'application/pdf',
                sizeBytes: BigInt(1024 * 1024),
                sha256: 'b'.repeat(64),
                visibility: 'PRIVATE',
                status: 'ACTIVE',
                scanStatus: 'PASSED',
                documentType: 'BM01',
                ownerUserId: otherStudentUser.id,
                uploadedById: otherStudentUser.id,
            },
        });
    });

    afterAll(async () => {
        try {
            const userIds = [studentUser?.id, otherStudentUser?.id, mentorUser?.id].filter(Boolean);
            await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
            await prisma.bM01Evaluation.deleteMany({ where: { registrationId: registration?.id } });
            await prisma.submission.deleteMany({ where: { registrationId: registration?.id } });
            await prisma.task.deleteMany({ where: { registrationId: registration?.id } });
            if (registration?.id) {
                await prisma.topicRegistration.update({
                    where: { id: registration.id },
                    data: { currentBM02SubmissionId: null },
                });
                await prisma.bM02Submission.deleteMany({ where: { registrationId: registration.id } });
                await prisma.topicRegistration.delete({ where: { id: registration.id } });
            }
            await prisma.storedAsset.deleteMany({ where: { id: { in: [activeAssetStudent?.id, activeAssetOther?.id].filter(Boolean) } } });
            if (topic?.id) await prisma.topic.delete({ where: { id: topic.id } });
            if (semester?.id) await prisma.semester.delete({ where: { id: semester.id } });
            await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        } catch {
            // cleanup safely
        }
    });

    describe('BM01 Outline Submission Asset Validation', () => {
        test('rejects submission when assetId belongs to another student', async () => {
            const res = await request(app)
                .post('/api/outline/submissions')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    registrationId: registration.id,
                    assetId: activeAssetOther.id,
                    fileData: {
                        fileName: 'de-cuong-other.pdf',
                    },
                });

            expect([400, 403]).toContain(res.status);
            expect(res.body.success).toBe(false);
        });

        test('accepts submission with valid student assetId and links asset to Submission', async () => {
            const res = await request(app)
                .post('/api/outline/submissions')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    registrationId: registration.id,
                    assetId: activeAssetStudent.id,
                    fileData: {
                        fileName: 'de-cuong-bm01.pdf',
                        fileUrl: 'https://storage.local/hoc-vu/de-cuong-bm01.pdf',
                    },
                });

            if (res.status !== 200) {
                console.error('submitOutline failed with body:', res.body);
            }
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify database binding
            const sub = await prisma.submission.findFirst({
                where: { registrationId: registration.id },
                orderBy: { submittedAt: 'desc' },
            });
            expect(sub).toBeDefined();
            expect(sub.assetId).toBe(activeAssetStudent.id);
        });
    });

    describe('Task Submission Asset Validation', () => {
        let generalTask;
        let taskAsset;

        beforeAll(async () => {
            generalTask = await prisma.task.create({
                data: {
                    registrationId: registration.id,
                    title: 'Nhiệm vụ tuần 1',
                    taskType: 'GENERIC',
                    status: 'IN_PROGRESS',
                },
            });

            taskAsset = await prisma.storedAsset.create({
                data: {
                    bucket: 'HOC_VU',
                    objectKey: `hoc-vu/test/task_asset_${Date.now()}.pdf`,
                    originalName: 'bao-cao-tuan-1.pdf',
                    normalizedName: 'bao-cao-tuan-1.pdf',
                    extension: '.pdf',
                    declaredMime: 'application/pdf',
                    detectedMime: 'application/pdf',
                    sizeBytes: BigInt(500 * 1024),
                    sha256: 'c'.repeat(64),
                    visibility: 'PRIVATE',
                    status: 'ACTIVE',
                    scanStatus: 'PASSED',
                    documentType: 'REPORT_PDF',
                    ownerUserId: studentUser.id,
                    uploadedById: studentUser.id,
                },
            });
        });

        afterAll(async () => {
            try {
                if (generalTask?.id) {
                    await prisma.submission.deleteMany({ where: { taskId: generalTask.id } });
                    await prisma.task.delete({ where: { id: generalTask.id } });
                }
                if (taskAsset?.id) {
                    await prisma.storedAsset.delete({ where: { id: taskAsset.id } });
                }
            } catch {
                // ignore
            }
        });

        test('binds assetId to task Submission when submitting task', async () => {
            const res = await request(app)
                .post(`/api/tasks/${generalTask.id}/submit`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    content: 'Nội dung nộp bài',
                    assetId: taskAsset.id,
                    fileName: 'bao-cao-tuan-1.pdf',
                });

            expect([200, 201]).toContain(res.status);
            expect(res.body.success).toBe(true);

            const sub = await prisma.submission.findFirst({
                where: { taskId: generalTask.id },
                orderBy: { submittedAt: 'desc' },
            });
            expect(sub.assetId).toBe(taskAsset.id);
        });

        test('rejects task submission with unauthorized assetId', async () => {
            const res = await request(app)
                .post(`/api/tasks/${generalTask.id}/submit`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    content: 'Nội dung nộp bài',
                    assetId: activeAssetOther.id,
                });

            expect([400, 403]).toContain(res.status);
            expect(res.body.success).toBe(false);
        });
    });
});
