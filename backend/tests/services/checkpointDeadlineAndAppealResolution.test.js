const {
    reviewSignatureAppeal,
    signCheckpoint,
    handleSignatureOverdue,
} = require('../../src/services/checkpointWorkflowService');
const {
    runCheckpointDeadlineOverdueJob,
} = require('../../src/jobs/checkpointDeadlineOverdueJob');
const { WorkflowTransitionError } = require('../../src/services/registrationTransitionService');

describe('Dynamic Policy Deadlines & Concurrent Overdue Worker', () => {
    let mockTx;
    let mockDb;

    beforeEach(() => {
        mockTx = {
            topicRegistration: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            checkpointEvaluation: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 501, ...data })),
            },
            checkpointSignatureAppeal: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 601, ...create })),
                update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 601, ...data })),
            },
            idempotencyRecord: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({}),
            },
            registrationStateHistory: {
                create: jest.fn().mockResolvedValue({}),
            },
        };
        mockDb = {
            topicRegistration: mockTx.topicRegistration,
            checkpointEvaluation: mockTx.checkpointEvaluation,
            checkpointSignatureAppeal: mockTx.checkpointSignatureAppeal,
            idempotencyRecord: mockTx.idempotencyRecord,
            registrationStateHistory: mockTx.registrationStateHistory,
            $transaction: jest.fn((callback) => callback(mockTx)),
        };
    });

    it('should calculate appeal extension deadline dynamically from pinned policy JSON in Asia/Ho_Chi_Minh', async () => {
        const now = new Date('2026-11-05T08:00:00.000Z'); // 15:00:00 +07:00
        const extensionDays = 5; // Pinned in policy: 5 days extension
        const expectedDeadline = new Date(now.getTime() + extensionDays * 24 * 60 * 60 * 1000);

        const appeal = {
            id: 601,
            checkpointEvaluationId: 501,
            status: 'PENDING',
            registration: {
                id: 100,
                status: 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
                stateVersion: 12,
                topic: { mentorId: 20 },
                periodPolicyVersion: {
                    id: 9,
                    policy: {
                        checkpointSignWindowDays: 3,
                        appealExtensionDays: 5,
                        timezone: 'Asia/Ho_Chi_Minh',
                    },
                },
            },
            checkpointEvaluation: {
                id: 501,
                checkpointNo: 1,
                attemptNo: 1,
                studentSignDeadlineAt: new Date('2026-11-01T08:00:00.000Z'),
                isAppealed: false,
            },
        };

        mockTx.checkpointSignatureAppeal.findUnique.mockResolvedValue(appeal);
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
            stateVersion: 12,
        });

        const result = await reviewSignatureAppeal({
            appealId: 601,
            decision: 'APPROVED',
            reviewNotes: 'Đồng ý gia hạn ký 5 ngày do lý do y tế hợp lệ',
            resolutionDecision: 'Gia hạn ký BM03 theo chính sách đợt',
            actorId: 99, // Viện trưởng/Admin, khác mentorId 20
            idempotencyKey: 'idem-key-review-appeal-dynamic-deadline',
        }, { db: mockDb, now });

        // 1. Hồ sơ phải được khơi thông về BM03_SIGNATURE_PENDING (không phải dead-end SIGNATURE_APPEAL_RESOLVED)
        expect(result.transitionResult.status).toBe('BM03_SIGNATURE_PENDING');

        // 2. studentSignDeadlineAt mới phải bằng đúng hạn động tính từ policy (5 ngày)
        expect(mockTx.checkpointEvaluation.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 501 },
                data: expect.objectContaining({
                    studentSignDeadlineAt: expectedDeadline,
                    isAppealed: true,
                }),
            }),
        );
        expect(result.studentSignDeadlineAt).toEqual(expectedDeadline);
        expect(result.isAppealed).toBe(true);
    });

    it('should not overwrite state if student signs checkpoint at the exact moment worker runs (CAS stateVersion guard)', async () => {
        const now = new Date('2026-11-06T10:00:00.000Z');

        // Worker quét thấy hồ sơ có trạng thái BM03_SIGNATURE_PENDING với stateVersion = 10
        const overdueRegistration = {
            id: 200,
            status: 'BM03_SIGNATURE_PENDING',
            stateVersion: 10,
            studentId: 55,
            periodPolicyVersion: {
                policy: { checkpointSignWindowDays: 3, appealWindowDays: 3 },
            },
            checkpointEvaluations: [
                {
                    id: 701,
                    checkpointNo: 1,
                    studentSignedAt: null,
                    studentSignDeadlineAt: new Date('2026-11-05T00:00:00.000Z'), // Quá hạn
                    isAppealed: true, // Đã từng appeal, nếu quá hạn sẽ bị terminate
                },
            ],
            checkpointSignatureAppeals: [],
        };

        mockDb.topicRegistration.findMany.mockResolvedValue([overdueRegistration]);

        // Giả lập race condition: Khi worker cố gắng transition với expectedStateVersion: 10,
        // trước đó sinh viên đã ký thành công và tăng stateVersion lên 11!
        // Do đó findUnique trong transitionRegistration trả về stateVersion: 11 (hoặc updateMany count = 0)
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 200,
            status: 'IN_PROGRESS_BM03', // Sinh viên đã ký xong chuyển sang IN_PROGRESS_BM03
            stateVersion: 11, // Đã tăng version
        });

        const workerResult = await runCheckpointDeadlineOverdueJob({
            db: mockDb,
            now,
            actorId: 0,
        });

        // Worker phải phát hiện CAS mismatch và bỏ qua (skip), không đè lên trạng thái của SV
        expect(workerResult.scanned).toBe(1);
        expect(workerResult.skippedCount).toBe(1);
        expect(workerResult.processedCount).toBe(0);
        expect(workerResult.skipped[0]).toMatchObject({
            registrationId: 200,
            reason: 'CAS_MISMATCH',
        });
    });

    it('should terminate registration when appeal window expires with no appeal per INV-10/INV-26', async () => {
        const now = new Date('2026-11-10T12:00:00.000Z');

        // Hồ sơ đang ở CHECKPOINT_SIGNATURE_APPEAL_OPEN nhưng quá hạn appeal mà không nộp đơn
        const registration = {
            id: 300,
            status: 'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
            stateVersion: 15,
            studentId: 77,
            periodPolicyVersion: {
                policy: { appealWindowDays: 3 },
            },
            checkpointEvaluations: [
                {
                    id: 801,
                    checkpointNo: 1,
                    studentSignedAt: null,
                    studentSignDeadlineAt: new Date('2026-11-05T00:00:00.000Z'),
                    isAppealed: false,
                },
            ],
            checkpointSignatureAppeals: [
                {
                    id: 901,
                    status: 'PENDING', // Không nộp đơn
                    appealDeadlineAt: new Date('2026-11-08T00:00:00.000Z'), // Đã quá hạn appeal 2 ngày
                },
            ],
        };

        mockDb.topicRegistration.findMany.mockResolvedValue([registration]);
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 300,
            status: 'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
            stateVersion: 15,
        });

        const workerResult = await runCheckpointDeadlineOverdueJob({
            db: mockDb,
            now,
            actorId: 0,
        });

        expect(workerResult.scanned).toBe(1);
        expect(workerResult.processedCount).toBe(1);
        expect(workerResult.skippedCount).toBe(0);

        // Phải transition sang TERMINATED_FAILED_PROGRESS
        expect(mockTx.topicRegistration.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: 300,
                    status: 'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
                    stateVersion: 15,
                },
                data: expect.objectContaining({
                    status: 'TERMINATED_FAILED_PROGRESS',
                    stateVersion: { increment: 1 },
                }),
            }),
        );
    });

    it('should terminate registration when second overdue occurs after appeal was already granted (isAppealed = true)', async () => {
        const now = new Date('2026-11-12T12:00:00.000Z');

        // Hồ sơ ở BM03_SIGNATURE_PENDING nhưng đã qua appeal 1 lần (isAppealed = true) và lại quá hạn tiếp
        const registration = {
            id: 400,
            status: 'BM03_SIGNATURE_PENDING',
            stateVersion: 20,
            studentId: 88,
            periodPolicyVersion: {
                policy: { checkpointSignWindowDays: 3 },
            },
            checkpointEvaluations: [
                {
                    id: 902,
                    checkpointNo: 2,
                    studentSignedAt: null,
                    studentSignDeadlineAt: new Date('2026-11-10T00:00:00.000Z'), // Đã quá hạn gia hạn
                    isAppealed: true, // Đã từng appeal
                },
            ],
            checkpointSignatureAppeals: [],
        };

        mockDb.topicRegistration.findMany.mockResolvedValue([registration]);
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 400,
            status: 'BM03_SIGNATURE_PENDING',
            stateVersion: 20,
        });

        const workerResult = await runCheckpointDeadlineOverdueJob({
            db: mockDb,
            now,
            actorId: 0,
        });

        expect(workerResult.processedCount).toBe(1);
        expect(mockTx.topicRegistration.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: 400,
                    status: 'BM03_SIGNATURE_PENDING',
                    stateVersion: 20,
                },
                data: expect.objectContaining({
                    status: 'TERMINATED_FAILED_PROGRESS',
                }),
            }),
        );
    });

    it('should open appeal window when first-time signature overdue occurs (isAppealed = false)', async () => {
        const now = new Date('2026-11-06T12:00:00.000Z');

        // Hồ sơ ở BM03_SIGNATURE_PENDING quá hạn lần đầu (chưa từng appeal)
        const registration = {
            id: 500,
            status: 'BM03_SIGNATURE_PENDING',
            stateVersion: 5,
            studentId: 99,
            periodPolicyVersion: {
                policy: { appealWindowDays: 4 },
            },
            checkpointEvaluations: [
                {
                    id: 950,
                    checkpointNo: 1,
                    studentSignedAt: null,
                    studentSignDeadlineAt: new Date('2026-11-05T00:00:00.000Z'),
                    isAppealed: false,
                },
            ],
            checkpointSignatureAppeals: [],
        };

        mockDb.topicRegistration.findMany.mockResolvedValue([registration]);
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 500,
            status: 'BM03_SIGNATURE_PENDING',
            stateVersion: 5,
        });

        const workerResult = await runCheckpointDeadlineOverdueJob({
            db: mockDb,
            now,
            actorId: 0,
        });

        expect(workerResult.processedCount).toBe(1);
        // Chuyển sang CHECKPOINT_SIGNATURE_APPEAL_OPEN
        expect(mockTx.topicRegistration.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: 500,
                    status: 'BM03_SIGNATURE_PENDING',
                    stateVersion: 5,
                },
                data: expect.objectContaining({
                    status: 'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
                }),
            }),
        );
        // Tạo CheckpointSignatureAppeal với hạn 4 ngày từ policy
        expect(mockTx.checkpointSignatureAppeal.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { checkpointEvaluationId: 950 },
                create: expect.objectContaining({
                    checkpointEvaluationId: 950,
                    registrationId: 500,
                    studentId: 99,
                    appealDeadlineAt: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
                }),
            }),
        );
    });
});
