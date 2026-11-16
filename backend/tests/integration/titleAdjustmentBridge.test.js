const request = require('supertest');

const mockTopicRegistration = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
};

const mockTopic = {
    findUnique: jest.fn(),
    update: jest.fn(),
};

const mockTopicTitleAdjustment = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockBM02AAdjustmentRequest = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockBM02AFormVersion = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockBM03ProgressRecord = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
};

const mockTitleAdjustmentAppendix = {
    findUnique: jest.fn(),
    update: jest.fn(),
};

const mockTitleAdjustmentAppendixItem = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
};

const mockUser = {
    findUnique: jest.fn(),
};

const mockAuditLog = {
    create: jest.fn(),
};

const mockElectronicSignatureEvent = {
    create: jest.fn(),
};

const mockPrisma = {
    topicRegistration: mockTopicRegistration,
    topic: mockTopic,
    topicTitleAdjustment: mockTopicTitleAdjustment,
    bM02AAdjustmentRequest: mockBM02AAdjustmentRequest,
    bM02AFormVersion: mockBM02AFormVersion,
    bM03ProgressRecord: mockBM03ProgressRecord,
    titleAdjustmentAppendix: mockTitleAdjustmentAppendix,
    titleAdjustmentAppendixItem: mockTitleAdjustmentAppendixItem,
    user: mockUser,
    auditLog: mockAuditLog,
    electronicSignatureEvent: mockElectronicSignatureEvent,
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/notificationService', () => ({
    safeNotify: jest.fn().mockResolvedValue(undefined),
    safeNotifyMany: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-token'),
}));

const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { issueAppendix } = require('../../src/services/titleAdjustmentAppendixService');
const { computeCanonicalPayloadHash } = require('../../src/services/electronicSignatureService');

describe('Title Adjustment Bridge (Legacy + BM02-A Harmonization)', () => {
    const lecturerUser = {
        id: 20,
        role: 'LECTURER',
        permissions: ['TOPIC_MANAGE'],
        permissionGroups: ['GIANG_VIEN'],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'lecturer-token') return { userId: 20, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        mockUser.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === 20) {
                return {
                    id: 20,
                    email: 'lecturer@test.com',
                    fullName: 'GVHD B',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: [
                        {
                            permissionGroup: {
                                code: 'GVHD',
                                permissions: ['TOPIC_UPDATE_OWN', 'BM03_CHECKPOINT_DECIDE', 'BM04_SUBMIT', 'TOPIC_MANAGE'].map((code) => ({ permission: { code } })),
                            },
                        },
                    ],
                };
            }
            if (where?.id === 1) {
                return {
                    id: 1,
                    email: 'admin@test.com',
                    fullName: 'Admin C',
                    role: 'ADMIN',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            return null;
        });
    });

    describe('1. GET /api/registrations/adjust-title/pending', () => {
        test('returns both legacy TopicTitleAdjustment and pending BM02-A requests', async () => {
            mockTopicTitleAdjustment.findMany.mockResolvedValue([
                {
                    id: 1,
                    originalTitle: 'Đề tài 1 cũ',
                    newTitle: 'Đề tài 1 mới',
                    reason: 'Lý do 1',
                    status: 'PENDING',
                    requestedAt: new Date('2026-11-01T08:00:00Z'),
                    registration: {
                        student: { id: 10, fullName: 'Sinh viên 1', code: 'SV001', email: 'sv1@test.com' },
                        topic: { id: 101, title: 'Đề tài 1 cũ' },
                    },
                },
            ]);

            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([
                {
                    id: 42,
                    registrationId: 200,
                    titleAdjustmentDeadline: new Date('2026-11-20T00:00:00Z'),
                    createdAt: new Date('2026-11-02T09:00:00Z'),
                    status: 'PENDING_ADVISOR',
                    registration: {
                        student: { id: 11, fullName: 'Sinh viên 2', code: 'SV002', email: 'sv2@test.com' },
                        topic: { id: 102, title: 'Đề tài 2 cũ' },
                    },
                    versions: [
                        {
                            versionNumber: 1,
                            registeredTitleSnapshot: 'Đề tài 2 cũ',
                            proposedTitle: 'Đề tài 2 mới từ BM02-A',
                            reason: 'Lý do BM02-A',
                            payloadHash: 'hash-bm02a-42',
                        },
                    ],
                },
            ]);

            const res = await request(app)
                .get('/api/registrations/adjust-title/pending')
                .set('Authorization', 'Bearer lecturer-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);

            const legacyItem = res.body.data.find((item) => item.id === 1);
            expect(legacyItem).toBeDefined();
            expect(legacyItem.newTitle).toBe('Đề tài 1 mới');

            const bm02aItem = res.body.data.find((item) => item.id === 42);
            expect(bm02aItem).toBeDefined();
            expect(bm02aItem.isBm02a).toBe(true);
            expect(bm02aItem.newTitle).toBe('Đề tài 2 mới từ BM02-A');
            expect(bm02aItem.reason).toBe('Lý do BM02-A');
        });
    });

    describe('2. PUT /api/registrations/adjust-title/:id/review with BM02-A', () => {
        test('approves BM02-A request via advisor sign', async () => {
            mockTopicTitleAdjustment.findUnique.mockResolvedValue(null);

            const v1Payload = {
                registrationId: 200,
                versionNumber: 1,
                registeredTitleSnapshot: 'Đề tài 2 cũ',
                proposedTitle: 'Đề tài 2 mới từ BM02-A',
                reason: 'Lý do BM02-A',
                studentSnapshot: {},
            };
            const validHash = computeCanonicalPayloadHash(v1Payload);

            const mockReq = {
                id: 42,
                registrationId: 200,
                status: 'PENDING_ADVISOR',
                currentVersionNumber: 1,
                titleAdjustmentDeadline: new Date(Date.now() + 86400000),
                registration: {
                    id: 200,
                    studentId: 11,
                    topic: { mentorId: 20, title: 'Đề tài 2 cũ' },
                },
                versions: [
                    {
                        id: 501,
                        versionNumber: 1,
                        registeredTitleSnapshot: 'Đề tài 2 cũ',
                        proposedTitle: 'Đề tài 2 mới từ BM02-A',
                        reason: 'Lý do BM02-A',
                        studentSnapshot: {},
                        payloadHash: validHash,
                    },
                ],
            };
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue(mockReq);
            mockBM02AFormVersion.findUnique.mockResolvedValue(mockReq.versions[0]);
            mockBM02AAdjustmentRequest.update.mockResolvedValue({
                ...mockReq,
                status: 'PENDING_DEPARTMENT_APPROVAL',
            });
            mockBM02AFormVersion.update.mockResolvedValue({});
            mockElectronicSignatureEvent.create.mockResolvedValue({ id: 999 });

            const res = await request(app)
                .put('/api/registrations/adjust-title/42/review')
                .set('Authorization', 'Bearer lecturer-token')
                .send({ action: 'APPROVE' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('ký xác nhận đơn BM02-A');
            expect(mockBM02AAdjustmentRequest.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 42 },
                data: expect.objectContaining({ status: 'PENDING_DEPARTMENT_APPROVAL' }),
            }));
        });

        test('rejects (returns for correction) BM02-A request', async () => {
            mockTopicTitleAdjustment.findUnique.mockResolvedValue(null);

            const mockReq = {
                id: 42,
                registrationId: 200,
                status: 'PENDING_ADVISOR',
                currentVersionNumber: 1,
                revisionCount: 0,
                titleAdjustmentDeadline: new Date(Date.now() + 86400000),
                registration: {
                    id: 200,
                    studentId: 11,
                    topic: { mentorId: 20, title: 'Đề tài 2 cũ' },
                },
                versions: [
                    {
                        id: 501,
                        versionNumber: 1,
                        proposedTitle: 'Đề tài 2 mới từ BM02-A',
                        payloadHash: 'hash-bm02a-42',
                    },
                ],
            };
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue(mockReq);
            mockBM02AFormVersion.findUnique.mockResolvedValue(mockReq.versions[0]);
            mockBM02AAdjustmentRequest.update.mockResolvedValue({
                ...mockReq,
                status: 'RETURNED_FOR_CORRECTION',
            });
            mockBM02AFormVersion.update.mockResolvedValue({});

            const res = await request(app)
                .put('/api/registrations/adjust-title/42/review')
                .set('Authorization', 'Bearer lecturer-token')
                .send({ action: 'REJECT', rejectionReason: 'Phạm vi đề tài quá rộng' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('trả lại đơn BM02-A');
            expect(mockBM02AAdjustmentRequest.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 42 },
                data: expect.objectContaining({ status: 'RETURNED_FOR_CORRECTION' }),
            }));
        });
    });

    describe('3. issueAppendix Synchronization', () => {
        test('updates TopicRegistration.adjustedTitle, Topic.title and BM03ProgressRecord upon issuing appendix', async () => {
            mockTitleAdjustmentAppendix.findUnique.mockResolvedValue({
                id: 10,
                status: 'DRAFT',
                items: [
                    {
                        id: 100,
                        bm02aRequestId: 42,
                        registrationId: 200,
                        newTitle: 'Tên Đề Tài Đã Điều Chỉnh Chính Thức',
                    },
                ],
            });

            mockTitleAdjustmentAppendix.update.mockResolvedValue({
                id: 10,
                status: 'ISSUED',
                items: [
                    {
                        id: 100,
                        bm02aRequestId: 42,
                        registrationId: 200,
                        newTitle: 'Tên Đề Tài Đã Điều Chỉnh Chính Thức',
                    },
                ],
            });

            mockTopicRegistration.findUnique.mockResolvedValue({
                id: 200,
                topicId: 102,
            });

            const issued = await issueAppendix({
                appendixId: 10,
                issuedById: 1,
            });

            expect(issued.status).toBe('ISSUED');
            expect(mockBM02AAdjustmentRequest.update).toHaveBeenCalledWith({
                where: { id: 42 },
                data: { status: 'ADJUSTMENT_ISSUED' },
            });
            expect(mockTopicRegistration.update).toHaveBeenCalledWith({
                where: { id: 200 },
                data: { adjustedTitle: 'Tên Đề Tài Đã Điều Chỉnh Chính Thức' },
            });
            expect(mockTopic.update).toHaveBeenCalledWith({
                where: { id: 102 },
                data: { title: 'Tên Đề Tài Đã Điều Chỉnh Chính Thức' },
            });
            expect(mockBM03ProgressRecord.updateMany).toHaveBeenCalledWith({
                where: { registrationId: 200 },
                data: { effectiveTitleSnapshot: 'Tên Đề Tài Đã Điều Chỉnh Chính Thức' },
            });
        });
    });
});
