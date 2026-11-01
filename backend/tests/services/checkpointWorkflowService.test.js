jest.mock('../../src/services/registrationTransitionService', () => ({
    WorkflowTransitionError: class WorkflowTransitionError extends Error {
        constructor(code, status = 409) { super(code); this.code = code; this.status = status; }
    },
    transitionRegistration: jest.fn().mockResolvedValue({ success: true }),
}));

const { transitionRegistration } = require('../../src/services/registrationTransitionService');
const {
    issueCheckpoint,
    signCheckpoint,
    handleSignatureOverdue,
    submitSignatureAppeal,
    reviewSignatureAppeal,
} = require('../../src/services/checkpointWorkflowService');
const { transferMentor } = require('../../src/services/mentorTransferService');

const baseRegistration = {
    id: 50,
    studentId: 10,
    semesterId: 1,
    topicId: 100,
    status: 'IN_PROGRESS_BM03',
    stateVersion: 5,
    periodPolicyVersionId: 7,
    topic: { id: 100, mentorId: 20, title: 'Hệ thống Quản lý Đồ án' },
    periodPolicyVersion: {
        id: 7,
        policy: { checkpointSignWindowDays: 3, appealWindowDays: 3 },
    },
};

function dbFor(registration = baseRegistration, overrides = {}) {
    const tx = {
        topicRegistration: {
            findUnique: jest.fn().mockResolvedValue(registration),
            count: jest.fn().mockResolvedValue(3),
        },
        periodWorkflowPolicyVersion: {
            findUnique: jest.fn().mockResolvedValue(registration.periodPolicyVersion),
        },
        checkpointEvaluation: {
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 501, ...data })),
            update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 501, ...data })),
        },
        checkpointSignatureAppeal: {
            findUnique: jest.fn().mockResolvedValue(null),
            upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 601, ...create })),
            update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 601, ...data })),
        },
        user: {
            findUnique: jest.fn().mockResolvedValue({ id: 25, fullName: 'TS. Tran Van C', role: 'LECTURER', isActive: true }),
        },
        topic: {
            update: jest.fn().mockResolvedValue({ id: 100, mentorId: 25 }),
        },
        mentorTransfer: {
            create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 701, ...data })),
        },
        idempotencyRecord: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
        },
        ...overrides,
    };
    return {
        tx,
        idempotencyRecord: tx.idempotencyRecord,
        $transaction: jest.fn((callback) => callback(tx)),
    };
}

describe('checkpointWorkflowService', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('issueCheckpoint', () => {
        test('GVHD phát hành CP1 thành công và chuyển trạng thái sang BM03_SIGNATURE_PENDING', async () => {
            const db = dbFor();
            const result = await issueCheckpoint({
                registrationId: 50,
                checkpointNo: 1,
                conclusion: 'ALLOWED_TO_CONTINUE',
                comments: 'Tiến độ tốt, hoàn thành 50% khối lượng',
                mentorSignature: 'TS. Nguyen Van B',
                actorId: 20,
                idempotencyKey: 'idem-key-issue-cp1-valid',
            }, { db });

            expect(result.evaluationId).toBe(501);
            expect(result.checkpointNo).toBe(1);
            expect(result.conclusion).toBe('ALLOWED_TO_CONTINUE');
            expect(transitionRegistration).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetStatus: 'BM03_SIGNATURE_PENDING',
                }),
                expect.anything(),
            );
        });

        test('từ chối người không phải GVHD hiện hành phát hành checkpoint (403)', async () => {
            const db = dbFor();
            await expect(issueCheckpoint({
                registrationId: 50,
                checkpointNo: 1,
                conclusion: 'ALLOWED_TO_CONTINUE',
                mentorSignature: 'GV Khac',
                actorId: 99, // Không phải mentorId 20
                idempotencyKey: 'idem-key-issue-cp1-wrong-actor',
            }, { db })).rejects.toMatchObject({ code: 'ONLY_CURRENT_MENTOR_ALLOWED', status: 403 });
        });

        test('từ chối phát hành CP2 nếu CP1 chưa đạt và chưa có đủ 2 chữ ký (409)', async () => {
            const db = dbFor(baseRegistration, {
                checkpointEvaluation: {
                    findFirst: jest.fn().mockResolvedValue(null), // Chưa có CP1 hợp lệ
                },
            });

            await expect(issueCheckpoint({
                registrationId: 50,
                checkpointNo: 2,
                conclusion: 'ALLOWED_TO_CONTINUE',
                mentorSignature: 'TS. Nguyen Van B',
                actorId: 20,
                idempotencyKey: 'idem-key-issue-cp2-premature',
            }, { db })).rejects.toMatchObject({ code: 'PREVIOUS_CHECKPOINT_NOT_PASSED', status: 409 });
        });
    });

    describe('signCheckpoint', () => {
        test('Sinh viên ký CP1 ĐẠT -> chuyển trạng thái tiếp tục IN_PROGRESS_BM03', async () => {
            const evaluation = {
                id: 501,
                checkpointNo: 1,
                conclusion: 'ALLOWED_TO_CONTINUE',
                studentSignedAt: null,
                studentSignDeadlineAt: new Date(Date.now() + 86400000), // Còn hạn
                registration: {
                    id: 50,
                    studentId: 10,
                    status: 'BM03_SIGNATURE_PENDING',
                    stateVersion: 6,
                },
            };

            const db = dbFor(baseRegistration, {
                checkpointEvaluation: {
                    findUnique: jest.fn().mockResolvedValue(evaluation),
                    update: jest.fn().mockResolvedValue({ ...evaluation, studentSignedAt: new Date() }),
                },
            });

            const result = await signCheckpoint({
                checkpointEvaluationId: 501,
                studentSignature: 'Sinh Vien A',
                actorId: 10,
                idempotencyKey: 'idem-key-sign-cp1-valid',
            }, { db });

            expect(result.evaluationId).toBe(501);
            expect(transitionRegistration).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetStatus: 'IN_PROGRESS_BM03',
                }),
                expect.anything(),
            );
        });

        test('Sinh viên ký CP2 ĐẠT -> chuyển trạng thái BM03_PASSED', async () => {
            const evaluation = {
                id: 502,
                checkpointNo: 2,
                conclusion: 'ALLOWED_TO_CONTINUE',
                studentSignedAt: null,
                studentSignDeadlineAt: new Date(Date.now() + 86400000),
                registration: {
                    id: 50,
                    studentId: 10,
                    status: 'BM03_SIGNATURE_PENDING',
                    stateVersion: 7,
                },
            };

            const db = dbFor(baseRegistration, {
                checkpointEvaluation: {
                    findUnique: jest.fn().mockResolvedValue(evaluation),
                    update: jest.fn().mockResolvedValue({ ...evaluation, studentSignedAt: new Date() }),
                },
            });

            const result = await signCheckpoint({
                checkpointEvaluationId: 502,
                studentSignature: 'Sinh Vien A',
                actorId: 10,
                idempotencyKey: 'idem-key-sign-cp2-valid',
            }, { db });

            expect(transitionRegistration).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetStatus: 'BM03_PASSED',
                }),
                expect.anything(),
            );
        });

        test('Sinh viên ký Checkpoint KHÔNG ĐẠT -> dừng đề tài TERMINATED_FAILED_PROGRESS', async () => {
            const evaluation = {
                id: 501,
                checkpointNo: 1,
                conclusion: 'NOT_ALLOWED_TO_CONTINUE',
                studentSignedAt: null,
                studentSignDeadlineAt: new Date(Date.now() + 86400000),
                registration: {
                    id: 50,
                    studentId: 10,
                    status: 'BM03_SIGNATURE_PENDING',
                    stateVersion: 6,
                },
            };

            const db = dbFor(baseRegistration, {
                checkpointEvaluation: {
                    findUnique: jest.fn().mockResolvedValue(evaluation),
                    update: jest.fn().mockResolvedValue({ ...evaluation, studentSignedAt: new Date() }),
                },
            });

            await signCheckpoint({
                checkpointEvaluationId: 501,
                studentSignature: 'Sinh Vien A',
                actorId: 10,
                idempotencyKey: 'idem-key-sign-failed-progress',
            }, { db });

            expect(transitionRegistration).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetStatus: 'TERMINATED_FAILED_PROGRESS',
                }),
                expect.anything(),
            );
        });

        test('từ chối sinh viên ký khi đã quá hạn 3 ngày (409)', async () => {
            const evaluation = {
                id: 501,
                checkpointNo: 1,
                conclusion: 'ALLOWED_TO_CONTINUE',
                studentSignedAt: null,
                studentSignDeadlineAt: new Date(Date.now() - 10000), // Đã hết hạn
                registration: {
                    id: 50,
                    studentId: 10,
                    status: 'BM03_SIGNATURE_PENDING',
                    stateVersion: 6,
                },
            };

            const db = dbFor(baseRegistration, {
                checkpointEvaluation: {
                    findUnique: jest.fn().mockResolvedValue(evaluation),
                },
            });

            await expect(signCheckpoint({
                checkpointEvaluationId: 501,
                studentSignature: 'Sinh Vien A',
                actorId: 10,
                idempotencyKey: 'idem-key-sign-expired',
            }, { db })).rejects.toMatchObject({ code: 'SIGNATURE_WINDOW_EXPIRED', status: 409 });
        });
    });

    describe('handleSignatureOverdue & Appeals', () => {
        test('quá hạn ký mở hạn khiếu nại chữ ký 3 ngày -> CHECKPOINT_SIGNATURE_APPEAL_OPEN', async () => {
            const evaluation = {
                id: 501,
                checkpointNo: 1,
                studentSignedAt: null,
                studentSignDeadlineAt: new Date(Date.now() - 10000),
                registration: {
                    id: 50,
                    studentId: 10,
                    status: 'BM03_SIGNATURE_PENDING',
                    stateVersion: 6,
                    periodPolicyVersion: { policy: { appealWindowDays: 3 } },
                },
            };

            const db = dbFor(baseRegistration, {
                checkpointEvaluation: {
                    findUnique: jest.fn().mockResolvedValue(evaluation),
                },
            });

            const result = await handleSignatureOverdue({
                checkpointEvaluationId: 501,
                actorId: 20,
                idempotencyKey: 'idem-key-handle-overdue',
            }, { db });

            expect(result.appealId).toBe(601);
            expect(transitionRegistration).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetStatus: 'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
                }),
                expect.anything(),
            );
        });

        test('GVHD không được tự thẩm định khiếu nại chữ ký của SV mình (403)', async () => {
            const appeal = {
                id: 601,
                checkpointEvaluationId: 501,
                registration: {
                    id: 50,
                    status: 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
                    stateVersion: 8,
                    topic: { mentorId: 20 }, // GVHD là 20
                },
            };

            const db = dbFor(baseRegistration, {
                checkpointSignatureAppeal: {
                    findUnique: jest.fn().mockResolvedValue(appeal),
                },
            });

            await expect(reviewSignatureAppeal({
                appealId: 601,
                decision: 'REJECTED',
                actorId: 20, // GVHD cố tình thẩm định đơn
                idempotencyKey: 'idem-key-mentor-review-appeal',
            }, { db })).rejects.toMatchObject({ code: 'MENTOR_CANNOT_REVIEW_APPEAL', status: 403 });
        });

        test('Admin bác đơn khiếu nại chữ ký -> dừng đồ án TERMINATED_FAILED_PROGRESS (INV-26)', async () => {
            const appeal = {
                id: 601,
                checkpointEvaluationId: 501,
                registration: {
                    id: 50,
                    status: 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
                    stateVersion: 8,
                    topic: { mentorId: 20 },
                },
            };

            const db = dbFor(baseRegistration, {
                checkpointSignatureAppeal: {
                    findUnique: jest.fn().mockResolvedValue(appeal),
                    update: jest.fn().mockResolvedValue({ id: 601, status: 'REJECTED' }),
                },
            });

            await reviewSignatureAppeal({
                appealId: 601,
                decision: 'REJECTED',
                reviewNotes: 'Lý do vắng mặt không chính đáng',
                actorId: 1, // Admin
                idempotencyKey: 'idem-key-admin-reject-appeal',
            }, { db });

            expect(transitionRegistration).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetStatus: 'TERMINATED_FAILED_PROGRESS',
                }),
                expect.anything(),
            );
        });
    });

    describe('mentorTransferService', () => {
        test('Admin điều chuyển GVHD thành công khi thỏa mãn quota và hồ sơ hợp lệ', async () => {
            const db = dbFor();
            const result = await transferMentor({
                registrationId: 50,
                newMentorId: 25,
                reason: 'GVHD cũ đi công tác dài hạn',
                actorId: 1,
                idempotencyKey: 'idem-key-transfer-mentor-valid',
            }, { db });

            expect(result.transferId).toBe(701);
            expect(result.previousMentorId).toBe(20);
            expect(result.newMentorId).toBe(25);
            expect(db.tx.topic.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { mentorId: 25 },
                }),
            );
        });

        test('chặn điều chuyển khi BM04 đã bị khóa isLocked = true (409)', async () => {
            const db = dbFor({
                ...baseRegistration,
                bm04Evaluation: { id: 801, isLocked: true },
            });

            await expect(transferMentor({
                registrationId: 50,
                newMentorId: 25,
                reason: 'Chuyển sau khi đã chấm BM04',
                actorId: 1,
                idempotencyKey: 'idem-key-transfer-after-bm04',
            }, { db })).rejects.toMatchObject({ code: 'BM04_ALREADY_LOCKED_CANNOT_TRANSFER', status: 409 });
        });

        test('chặn điều chuyển nếu GVHD mới đã đạt quota 10 sinh viên (409)', async () => {
            const db = dbFor(baseRegistration, {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue(baseRegistration),
                    count: jest.fn().mockResolvedValue(10), // Đã đủ 10 SV
                },
            });

            await expect(transferMentor({
                registrationId: 50,
                newMentorId: 25,
                reason: 'Chuyển sang GVHD đã full quota',
                actorId: 1,
                idempotencyKey: 'idem-key-transfer-full-quota',
            }, { db })).rejects.toMatchObject({ code: 'NEW_MENTOR_QUOTA_EXCEEDED', status: 409 });
        });
    });
});
