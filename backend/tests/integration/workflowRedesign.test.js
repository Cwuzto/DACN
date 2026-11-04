jest.mock('../../src/config/database', () => ({
    $transaction: jest.fn(),
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    semester: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
    },
    topicRegistration: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    bM02Submission: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    idempotencyRecord: { findUnique: jest.fn(), create: jest.fn() },
    registrationStateHistory: { create: jest.fn() },
    topic: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    task: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        createMany: jest.fn(),
        groupBy: jest.fn(),
    },
    submission: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
    },
    bm04Evaluation: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    bM04Evaluation: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    topicTitleAdjustment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    notification: {
        create: jest.fn(),
    },
}));

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Integration - Thesis Workflow Redesign Core Rules', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
        prisma.idempotencyRecord.findUnique.mockResolvedValue(null);
        prisma.idempotencyRecord.create.mockResolvedValue({});
        prisma.registrationStateHistory.create.mockResolvedValue({});
        prisma.topicRegistration.updateMany.mockResolvedValue({ count: 1 });
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'lecturer-token') return { userId: 20, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === 10) return { id: 10, email: 'student@test.com', fullName: 'Sinh Vien A', role: 'STUDENT', isActive: true, permissionGroups: [] };
            if (where?.id === 20) return { id: 20, email: 'lecturer@test.com', fullName: 'GVHD B', role: 'LECTURER', isActive: true, permissionGroups: [{ permissionGroup: { code: 'GVHD', permissions: ['TOPIC_UPDATE_OWN', 'BM03_CHECKPOINT_DECIDE', 'BM04_SUBMIT'].map((code) => ({ permission: { code } })) } }] };
            if (where?.id === 1) return { id: 1, email: 'admin@test.com', fullName: 'Admin C', role: 'ADMIN', isActive: true, permissionGroups: [{ permissionGroup: { code: 'QUAN_TRI_VIEN', permissions: [{ permission: { code: 'BM04_REVIEW' } }] } }] };
            return null;
        });
    });

    describe('1. BM02 Submission Guard', () => {
        it('nên từ chối nộp BM02 khi BM01 chưa ĐẠT', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 100,
                studentId: 10,
                status: 'BM01_SUBMITTED',
                outlineReviewStatus: 'PENDING',
                topic: { title: 'Đề tài mẫu' },
            });

            const res = await request(app)
                .post('/api/registrations/bm02-submit')
                .set('Authorization', 'Bearer student-token')
                .set('Idempotency-Key', 'workflow-bm02-invalid-0001')
                .send({
                    registrationId: 100,
                    finalTitle: 'Đề tài chính thức',
                    reason: 'Chỉnh sửa sau thẩm định',
                });

            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('WORKFLOW_POLICY_REQUIRED');
        });

        it('nên cho phép nộp BM02 khi BM01 đã ĐẠT', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 100,
                studentId: 10,
                status: 'BM01_PASSED',
                outlineReviewStatus: 'PASSED',
                stateVersion: 0,
                periodPolicyVersionId: 7,
                topic: { id: 50, title: 'Đề tài mẫu' },
            });
            prisma.task.findFirst.mockResolvedValue({ id: 201 });
            prisma.bM02Submission.findFirst.mockResolvedValue(null);
            prisma.bM02Submission.create.mockResolvedValue({ id: 99, versionNo: 1 });
            prisma.task.update.mockResolvedValue({ id: 201, status: 'COMPLETED' });
            prisma.submission.create.mockResolvedValue({ id: 99 });
            prisma.topicRegistration.update.mockResolvedValue({
                id: 100,
                status: 'BM02_SUBMITTED',
            });

            const res = await request(app)
                .post('/api/registrations/bm02-submit')
                .set('Authorization', 'Bearer student-token')
                .set('Idempotency-Key', 'workflow-bm02-0001')
                .send({
                    registrationId: 100,
                    finalTitle: 'Đề tài chính thức đã hoàn thiện',
                    reason: 'Thống nhất với GVHD',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.versionNo).toBe(1);
        });
    });

    describe('2. Title Adjustment 7-Day Window', () => {
        it('nên từ chối đổi tên đề tài khi đã quá hạn 7 ngày sau Quyết định', async () => {
            const nineDaysAgo = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 100,
                studentId: 10,
                status: 'IN_PROGRESS',
                decisionDate: nineDaysAgo,
                decisionNumber: 'QD-2026-001',
                topic: { title: 'Đề tài gốc', mentorId: 20 },
            });

            const res = await request(app)
                .post('/api/registrations/adjust-title')
                .set('Authorization', 'Bearer student-token')
                .send({
                    registrationId: 100,
                    newTitle: 'Tên đề tài mới muốn đổi',
                    reason: 'Lý do đổi tên',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('Đã quá thời hạn 7 ngày');
        });

        it('nên cho phép nộp đơn xin đổi tên đề tài trong vòng 7 ngày', async () => {
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 100,
                studentId: 10,
                status: 'IN_PROGRESS',
                decisionDate: threeDaysAgo,
                decisionNumber: 'QD-2026-001',
                topic: { title: 'Đề tài gốc', mentorId: 20 },
            });
            prisma.topicTitleAdjustment.findFirst.mockResolvedValue(null);
            prisma.topicTitleAdjustment.create.mockResolvedValue({
                id: 1,
                registrationId: 100,
                oldTitle: 'Đề tài gốc',
                newTitle: 'Tên đề tài mới',
                status: 'PENDING',
            });

            const res = await request(app)
                .post('/api/registrations/adjust-title')
                .set('Authorization', 'Bearer student-token')
                .send({
                    registrationId: 100,
                    newTitle: 'Tên đề tài mới',
                    reason: 'Cần mở rộng phạm vi',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('điều chỉnh tên đề tài thành công');
        });

        it('GVHD duyệt đơn đổi tên đề tài -> cập nhật adjustedTitle', async () => {
            prisma.topicTitleAdjustment.findUnique.mockResolvedValue({
                id: 1,
                status: 'PENDING',
                registrationId: 100,
                newTitle: 'Tên đề tài đã đổi',
                registration: {
                    id: 100,
                    studentId: 10,
                    topic: { mentorId: 20, title: 'Đề tài cũ' },
                },
            });
            prisma.topicTitleAdjustment.update.mockResolvedValue({});
            prisma.topicRegistration.update.mockResolvedValue({});

            const res = await request(app)
                .put('/api/registrations/adjust-title/1/review')
                .set('Authorization', 'Bearer lecturer-token')
                .send({
                    action: 'APPROVE',
                    reviewComment: 'Đồng ý cho đổi tên',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(prisma.topicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 100 },
                    data: { adjustedTitle: 'Tên đề tài đã đổi' },
                }),
            );
        });
    });

    describe('3. BM03 Strict Checkpoint Termination', () => {
        it('chặn chấm Checkpoint qua endpoint generic gradeSubmission và yêu cầu dùng command chuyên biệt', async () => {
            prisma.submission.findUnique.mockResolvedValue({
                id: 501,
                registrationId: 100,
                studentId: 10,
                task: {
                    id: 301,
                    taskType: 'BM03_CHECKPOINT_1',
                    title: 'Báo cáo tiến độ Đợt 1',
                    registration: {
                        id: 100,
                        topic: { mentorId: 20 },
                    },
                },
                student: { fullName: 'Sinh Vien A' },
            });
            prisma.submission.update.mockResolvedValue({});
            prisma.topicRegistration.update.mockResolvedValue({});

            const res = await request(app)
                .post('/api/tasks/submission/501/grade')
                .set('Authorization', 'Bearer lecturer-token')
                .send({
                    decision: 'FAILED',
                    feedback: 'Không đáp ứng khối lượng tối thiểu Checkpoint 1',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('USE_DEDICATED_WORKFLOW_COMMAND');
            expect(prisma.topicRegistration.update).not.toHaveBeenCalled();
        });
    });

    describe('4. BM04 Permanent Locking & DEFENSE_READY', () => {
        it('cho phép sinh viên xem phiếu BM04 của chính mình', async () => {
            prisma.bM04Evaluation.findUnique.mockResolvedValue({
                id: 10,
                registrationId: 100,
                studentId: 10,
                lecturerId: 20,
                conclusion: 'AGREED_FOR_DEFENSE',
                isLocked: true,
                registration: { studentId: 10, topic: { mentorId: 20 } },
            });

            const res = await request(app)
                .get('/api/evaluations/bm04/100')
                .set('Authorization', 'Bearer student-token');

            expect(res.status).toBe(200);
            expect(res.body.data.registrationId).toBe(100);
        });

        it('chặn sinh viên xem phiếu BM04 của người khác', async () => {
            prisma.bM04Evaluation.findUnique.mockResolvedValue({
                id: 11,
                registrationId: 101,
                studentId: 999,
                lecturerId: 20,
                conclusion: 'AGREED_FOR_DEFENSE',
                isLocked: true,
                registration: { studentId: 999, topic: { mentorId: 20 } },
            });

            const res = await request(app)
                .get('/api/evaluations/bm04/101')
                .set('Authorization', 'Bearer student-token');

            expect(res.status).toBe(403);
        });

        it('cho phép Admin xem phiếu BM04 để giám sát học vụ', async () => {
            prisma.bM04Evaluation.findUnique.mockResolvedValue({
                id: 12,
                registrationId: 102,
                studentId: 999,
                lecturerId: 888,
                conclusion: 'AGREED_FOR_DEFENSE',
                isLocked: true,
                registration: { studentId: 999, topic: { mentorId: 888 } },
            });

            const res = await request(app)
                .get('/api/evaluations/bm04/102')
                .set('Authorization', 'Bearer admin-token');

            expect(res.status).toBe(200);
        });

        it('GVHD nộp BM04 ĐỒNG Ý -> isLocked = true và status chuyển DEFENSE_READY', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 100,
                semesterId: 1,
                studentId: 10,
                status: 'BM03_PASSED',
                topic: { mentorId: 20, title: 'Đề tài hoàn tất' },
                student: { fullName: 'Sinh Vien A' },
                bm04Evaluation: null,
                archive: {
                    reportFileUrl: 'https://storage/report.pdf',
                    sourceCodeUrl: 'https://github.com/example/project',
                    slideFileUrl: 'https://storage/slides.pptx',
                },
            });
            prisma.bM04Evaluation.upsert.mockResolvedValue({
                id: 10,
                registrationId: 100,
                semesterId: 1,
                conclusion: 'AGREED_FOR_DEFENSE',
                isLocked: true,
            });
            prisma.topicRegistration.update.mockResolvedValue({});

            const res = await request(app)
                .post('/api/evaluations/bm04-submit')
                .set('Authorization', 'Bearer lecturer-token')
                .send({
                    registrationId: 100,
                    thesisFormatScore: 'Hình thức chuẩn chỉ',
                    researchContentScore: 'Nội dung đạt đầy đủ',
                    applicabilityScore: 'Khả năng ứng dụng tốt',
                    attitudeScore: 'Thái độ làm việc chăm chỉ',
                    conclusion: 'AGREED_FOR_DEFENSE',
                    lecturerSignature: 'TS. Nguyen Van B',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(prisma.topicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 100 },
                    data: { status: 'DEFENSE_READY' },
                }),
            );
        });

        it('từ chối BM04 khi hồ sơ chưa BM03_PASSED', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 100,
                semesterId: 1,
                studentId: 10,
                status: 'IN_PROGRESS_BM03',
                topic: { mentorId: 20, title: 'Đề tài chưa đạt BM03' },
                student: { fullName: 'Sinh Vien A' },
                bm04Evaluation: null,
                archive: null,
            });

            const res = await request(app)
                .post('/api/evaluations/bm04-submit')
                .set('Authorization', 'Bearer lecturer-token')
                .send({
                    registrationId: 100,
                    thesisFormatScore: 'Đạt',
                    researchContentScore: 'Đạt',
                    applicabilityScore: 'Đạt',
                    attitudeScore: 'Đạt',
                    conclusion: 'AGREED_FOR_DEFENSE',
                    lecturerSignature: 'TS. Nguyen Van B',
                });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('INVALID_TRANSITION');
            expect(prisma.bM04Evaluation.upsert).not.toHaveBeenCalled();
        });

        it('từ chối Admin kỹ thuật ký BM04 thay GVHD', async () => {
            const res = await request(app)
                .post('/api/evaluations/bm04-submit')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    registrationId: 100,
                    thesisFormatScore: 'Đạt',
                    researchContentScore: 'Đạt',
                    applicabilityScore: 'Đạt',
                    attitudeScore: 'Đạt',
                    conclusion: 'AGREED_FOR_DEFENSE',
                    lecturerSignature: 'Admin',
                });

            expect(res.status).toBe(403);
            expect(prisma.topicRegistration.findUnique).not.toHaveBeenCalled();
        });

        it('nên chặn không cho sửa BM04 một khi đã bị khóa isLocked = true', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 100,
                semesterId: 1,
                status: 'DEFENSE_READY',
                topic: { mentorId: 20, title: 'Đề tài hoàn tất' },
                student: { fullName: 'Sinh Vien A' },
                bm04Evaluation: {
                    id: 10,
                    registrationId: 100,
                    isLocked: true,
                    conclusion: 'AGREED_FOR_DEFENSE',
                },
            });

            const res = await request(app)
                .post('/api/evaluations/bm04-submit')
                .set('Authorization', 'Bearer lecturer-token')
                .send({
                    registrationId: 100,
                    thesisFormatScore: 'Sửa lại',
                    researchContentScore: 'Sửa lại',
                    applicabilityScore: 'Sửa lại',
                    attitudeScore: 'Sửa lại',
                    conclusion: 'AGREED_FOR_DEFENSE',
                    lecturerSignature: 'TS. Nguyen Van B',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('Phiếu nhận xét BM04 này đã được ký xác nhận và khóa vĩnh viễn');
        });
    });
});
