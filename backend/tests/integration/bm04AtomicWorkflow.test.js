const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockPrisma = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
    topicRegistration: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    bM04Evaluation: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
    },
    task: {
        updateMany: jest.fn(),
    },
    registrationStateHistory: {
        create: jest.fn(),
    },
    idempotencyRecord: {
        findUnique: jest.fn(),
        create: jest.fn(),
    },
    auditLog: {
        create: jest.fn(),
    },
    notification: {
        create: jest.fn(),
    },
};

mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));

jest.mock('../../src/config/database', () => mockPrisma);

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/notificationService', () => ({
    safeNotify: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const prisma = require('../../src/config/database');
const app = require('../../src/app');

describe('Task 7: BM04 Atomic Workflow Service & Pre-Defense Gate (H04)', () => {
    const mentorId = 20;
    const nonMentorId = 30;
    const studentId = 10;
    const registrationId = 100;

    const baseRegistration = {
        id: registrationId,
        semesterId: 1,
        studentId,
        status: 'BM03_PASSED',
        stateVersion: 3,
        periodPolicyVersionId: 5,
        topic: {
            id: 200,
            title: 'Hệ thống Quản lý Khóa luận Tốt nghiệp',
            mentorId,
        },
        student: {
            id: studentId,
            fullName: 'Sinh Vien A',
            code: 'SV001',
        },
        bm04Evaluation: null,
        archive: {
            id: 50,
            registrationId,
            phase: 'PRE_DEFENSE',
            status: 'SUBMITTED',
            reportFileUrl: 'https://storage.example.com/draft-report.pdf',
            reportFileName: 'draft-report.pdf',
            slideFileUrl: 'https://storage.example.com/draft-slide.pptx',
            slideFileName: 'draft-slide.pptx',
            sourceCodeUrl: 'https://github.com/example/dacn-repo',
            demoVideoUrl: 'https://youtube.com/watch?v=123',
        },
    };

    const validPayload = {
        registrationId,
        thesisFormatScore: 'Hình thức đúng quy chuẩn mẫu khóa luận của Khoa.',
        researchContentScore: 'Nội dung nghiên cứu chuyên sâu, giải quyết tốt bài toán đặt ra.',
        applicabilityScore: 'Khả năng ứng dụng thực tế cao, triển khai được ngay.',
        attitudeScore: 'Thái độ nghiêm túc, tham gia đầy đủ các buổi hướng dẫn.',
        conclusion: 'AGREED_FOR_DEFENSE',
        generalNotes: 'Đồng ý cho sinh viên bảo vệ trước Hội đồng.',
        lecturerSignature: 'TS. Tran Huong Dan',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
        prisma.topicRegistration.updateMany.mockResolvedValue({ count: 1 });
        prisma.registrationStateHistory.create.mockResolvedValue({});
        prisma.idempotencyRecord.findUnique.mockResolvedValue(null);
        prisma.idempotencyRecord.create.mockResolvedValue({});
        prisma.task.updateMany.mockResolvedValue({ count: 1 });

        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'mentor-token') return { userId: mentorId, role: 'LECTURER' };
            if (token === 'other-mentor-token') return { userId: nonMentorId, role: 'LECTURER' };
            if (token === 'student-token') return { userId: studentId, role: 'STUDENT' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === mentorId) {
                return {
                    id: mentorId,
                    email: 'mentor@test.com',
                    fullName: 'TS. Tran Huong Dan',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: [
                        {
                            permissionGroup: {
                                code: 'GVHD',
                                permissions: [{ permission: { code: 'BM04_SUBMIT' } }],
                            },
                        },
                    ],
                };
            }
            if (where?.id === nonMentorId) {
                return {
                    id: nonMentorId,
                    email: 'other@test.com',
                    fullName: 'ThS. Le Van Other',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: [
                        {
                            permissionGroup: {
                                code: 'GVHD',
                                permissions: [{ permission: { code: 'BM04_SUBMIT' } }],
                            },
                        },
                    ],
                };
            }
            return null;
        });
    });

    it('should increment registration stateVersion by 1 when BM04 is signed', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({ ...baseRegistration });
        prisma.bM04Evaluation.upsert.mockResolvedValue({
            id: 88,
            registrationId,
            semesterId: 1,
            studentId,
            lecturerId: mentorId,
            conclusion: 'AGREED_FOR_DEFENSE',
            isLocked: true,
            signedAt: new Date(),
        });

        const res = await request(app)
            .post('/api/evaluations/bm04-submit')
            .set('Authorization', 'Bearer mentor-token')
            .set('Idempotency-Key', 'bm04-atomic-test-valid-001')
            .send(validPayload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify transitionRegistration atomic CAS was invoked via updateMany
        expect(prisma.topicRegistration.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: registrationId,
                    status: 'BM03_PASSED',
                    stateVersion: 3,
                },
                data: expect.objectContaining({
                    status: 'DEFENSE_READY',
                    stateVersion: { increment: 1 },
                }),
            }),
        );

        // Verify state history created with exact stateVersion progression (3 -> 4)
        expect(prisma.registrationStateHistory.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    registrationId,
                    fromStatus: 'BM03_PASSED',
                    toStatus: 'DEFENSE_READY',
                    fromStateVersion: 3,
                    toStateVersion: 4,
                    actorId: mentorId,
                }),
            }),
        );

        // Verify direct controller update was NOT called
        expect(prisma.topicRegistration.update).not.toHaveBeenCalled();
    });

    it('should reject BM04 if pre-defense archive is missing', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            ...baseRegistration,
            archive: null,
        });

        const res = await request(app)
            .post('/api/evaluations/bm04-submit')
            .set('Authorization', 'Bearer mentor-token')
            .send(validPayload);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('PRE_DEFENSE_ARCHIVE_REQUIRED');
        expect(res.body.message).toContain('Sinh viên chưa nộp tài liệu lưu chiểu sơ bộ trước bảo vệ');

        expect(prisma.topicRegistration.updateMany).not.toHaveBeenCalled();
        expect(prisma.bM04Evaluation.upsert).not.toHaveBeenCalled();
    });

    it('should reject BM04 if pre-defense archive is in wrong phase or not submitted', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            ...baseRegistration,
            archive: {
                id: 51,
                registrationId,
                phase: 'POST_DEFENSE',
                status: 'SUBMITTED',
            },
        });

        const res = await request(app)
            .post('/api/evaluations/bm04-submit')
            .set('Authorization', 'Bearer mentor-token')
            .send(validPayload);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('PRE_DEFENSE_ARCHIVE_REQUIRED');
        expect(prisma.topicRegistration.updateMany).not.toHaveBeenCalled();
    });

    it('should allow NOT_AGREED_FOR_DEFENSE even if pre-defense archive is missing, and transition to TERMINATED_BM04', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            ...baseRegistration,
            archive: null,
        });
        prisma.bM04Evaluation.upsert.mockResolvedValue({
            id: 89,
            registrationId,
            conclusion: 'NOT_AGREED_FOR_DEFENSE',
            isLocked: true,
        });

        const res = await request(app)
            .post('/api/evaluations/bm04-submit')
            .set('Authorization', 'Bearer mentor-token')
            .send({
                ...validPayload,
                conclusion: 'NOT_AGREED_FOR_DEFENSE',
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        expect(prisma.topicRegistration.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: registrationId,
                    status: 'BM03_PASSED',
                    stateVersion: 3,
                },
                data: expect.objectContaining({
                    status: 'TERMINATED_BM04',
                    stateVersion: { increment: 1 },
                }),
            }),
        );

        expect(prisma.registrationStateHistory.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    fromStatus: 'BM03_PASSED',
                    toStatus: 'TERMINATED_BM04',
                    fromStateVersion: 3,
                    toStateVersion: 4,
                }),
            }),
        );
    });

    it('should reject BM04 if caller is not the topic mentor', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({ ...baseRegistration });

        const res = await request(app)
            .post('/api/evaluations/bm04-submit')
            .set('Authorization', 'Bearer other-mentor-token')
            .send(validPayload);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(prisma.topicRegistration.updateMany).not.toHaveBeenCalled();
    });

    it('should reject BM04 if registration status is not BM03_PASSED', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            ...baseRegistration,
            status: 'IN_PROGRESS_BM03',
        });

        const res = await request(app)
            .post('/api/evaluations/bm04-submit')
            .set('Authorization', 'Bearer mentor-token')
            .send(validPayload);

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('INVALID_TRANSITION');
        expect(prisma.topicRegistration.updateMany).not.toHaveBeenCalled();
    });

    it('should reject BM04 if already locked', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            ...baseRegistration,
            bm04Evaluation: {
                id: 88,
                isLocked: true,
                conclusion: 'AGREED_FOR_DEFENSE',
            },
        });

        const res = await request(app)
            .post('/api/evaluations/bm04-submit')
            .set('Authorization', 'Bearer mentor-token')
            .send(validPayload);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('BM04_ALREADY_LOCKED');
        expect(prisma.topicRegistration.updateMany).not.toHaveBeenCalled();
    });
});
