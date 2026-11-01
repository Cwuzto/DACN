jest.mock('../../src/services/registrationTransitionService', () => ({
    WorkflowTransitionError: class WorkflowTransitionError extends Error {
        constructor(code, status = 409) { super(code); this.code = code; this.status = status; }
    },
    transitionRegistration: jest.fn().mockResolvedValue({}),
}));

const { transitionRegistration } = require('../../src/services/registrationTransitionService');
const { reviewBM01, submitBM01Initial, submitBM01Revision } = require('../../src/services/bm01WorkflowService');

const baseRegistration = {
    id: 41,
    studentId: 10,
    status: 'BM01_SUBMITTED',
    stateVersion: 3,
    periodPolicyVersionId: 7,
};

function dbFor(registration = baseRegistration, overrides = {}) {
    const tx = {
        topicRegistration: { findUnique: jest.fn().mockResolvedValue(registration) },
        periodWorkflowPolicyVersion: {
            findUnique: jest.fn().mockResolvedValue({
                id: 7,
                policy: { revisionWindowDays: 3, bm01MaxResubmissions: 1 },
            }),
        },
        bM01Evaluation: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 201, attemptNo: 1 }),
            update: jest.fn().mockResolvedValue({ id: 202, attemptNo: 2 }),
        },
        task: {
            findFirst: jest.fn().mockResolvedValue({ id: 301 }),
            create: jest.fn().mockResolvedValue({ id: 301 }),
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        submission: { create: jest.fn().mockResolvedValue({ id: 401, registrationId: 41 }) },
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

describe('bm01WorkflowService review', () => {
    beforeEach(() => jest.clearAllMocks());

    test('records first-pass approval and transitions only from BM01_SUBMITTED', async () => {
        const db = dbFor();
        const result = await reviewBM01({
            registrationId: 41,
            reviewerId: 20,
            attemptNo: 1,
            outcome: 'PASSED',
            feedback: 'Đạt',
            idempotencyKey: 'bm01-review-0001',
        }, { db, now: new Date('2026-10-28T01:00:00.000Z') });

        expect(result).toMatchObject({ evaluation: { id: 201, attemptNo: 1 }, targetStatus: 'BM01_PASSED' });
        expect(db.tx.bM01Evaluation.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            registrationId: 41,
            attemptNo: 1,
            outcome: 'PASSED',
            policyVersionId: 7,
            reviewedById: 20,
        }) });
        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({
            expectedStatus: 'BM01_SUBMITTED',
            targetStatus: 'BM01_PASSED',
            changes: expect.objectContaining({ outlineReviewStatus: 'PASSED', outlineFeedback: 'Đạt' }),
        }), { tx: db.tx });
    });

    test('opens exactly one revision window after the first unsuccessful review', async () => {
        const db = dbFor();
        await reviewBM01({
            registrationId: 41,
            reviewerId: 20,
            attemptNo: 1,
            outcome: 'NEEDS_REVISION',
            feedback: 'Bổ sung phạm vi',
            idempotencyKey: 'bm01-review-0002',
        }, { db, now: new Date('2026-10-28T01:00:00.000Z') });

        expect(db.tx.bM01Evaluation.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            outcome: 'NEEDS_REVISION',
            notifiedAt: new Date('2026-10-28T01:00:00.000Z'),
            deadlineAt: new Date('2026-10-31T01:00:00.000Z'),
        }) });
        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({
            targetStatus: 'BM01_NEEDS_REVISION',
        }), { tx: db.tx });
    });

    test('terminates the registration when the second review is unsuccessful', async () => {
        const pendingSecondAttempt = { id: 202, attemptNo: 2, outcome: null, supersedesId: 201 };
        const db = dbFor(baseRegistration, {
            bM01Evaluation: {
                findFirst: jest.fn().mockResolvedValue(pendingSecondAttempt),
                create: jest.fn(),
                update: jest.fn().mockResolvedValue({ ...pendingSecondAttempt, outcome: 'TERMINATED' }),
            },
        });

        await reviewBM01({
            registrationId: 41,
            reviewerId: 30,
            attemptNo: 2,
            outcome: 'NEEDS_REVISION',
            feedback: 'Không đạt lần hai',
            idempotencyKey: 'bm01-review-0003',
        }, { db, now: new Date('2026-10-28T01:00:00.000Z') });

        expect(db.tx.bM01Evaluation.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 202 },
            data: expect.objectContaining({ outcome: 'TERMINATED' }),
        }));
        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({
            targetStatus: 'TERMINATED_BM01',
        }), { tx: db.tx });
    });

    test('fails closed without a pinned workflow policy', async () => {
        const db = dbFor({ ...baseRegistration, periodPolicyVersionId: null });
        await expect(reviewBM01({
            registrationId: 41,
            reviewerId: 20,
            attemptNo: 1,
            outcome: 'PASSED',
            idempotencyKey: 'bm01-review-0004',
        }, { db })).rejects.toMatchObject({ code: 'WORKFLOW_POLICY_REQUIRED' });
        expect(transitionRegistration).not.toHaveBeenCalled();
    });
});

describe('bm01WorkflowService revision submission', () => {
    beforeEach(() => jest.clearAllMocks());

    const command = {
        registrationId: 41,
        studentId: 10,
        content: 'Đề cương đã sửa',
        fileUrl: 'https://example.test/bm01-v2.pdf',
        fileName: 'bm01-v2.pdf',
        idempotencyKey: 'bm01-resubmit-0001',
    };

    const revisionRegistration = { ...baseRegistration, status: 'BM01_NEEDS_REVISION' };
    const firstEvaluation = {
        id: 201,
        attemptNo: 1,
        outcome: 'NEEDS_REVISION',
        deadlineAt: new Date('2026-11-01T00:00:00.000Z'),
    };

    test('creates one linked second attempt within the deadline', async () => {
        const db = dbFor(revisionRegistration);
        db.tx.bM01Evaluation.findFirst.mockResolvedValue(firstEvaluation);
        db.tx.bM01Evaluation.create.mockResolvedValue({ id: 202, attemptNo: 2, submissionId: 401 });

        const result = await submitBM01Revision(command, {
            db,
            now: new Date('2026-10-30T00:00:00.000Z'),
        });

        expect(result).toMatchObject({ submission: { id: 401 }, evaluation: { id: 202, attemptNo: 2 } });
        expect(db.tx.bM01Evaluation.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            attemptNo: 2,
            supersedesId: 201,
            submissionId: 401,
            submittedById: 10,
            policyVersionId: 7,
        }) });
        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({
            expectedStatus: 'BM01_NEEDS_REVISION',
            targetStatus: 'BM01_SUBMITTED',
        }), { tx: db.tx });
    });

    test('rejects a second revision attempt and an expired revision', async () => {
        const exhaustedDb = dbFor(revisionRegistration);
        exhaustedDb.tx.bM01Evaluation.findFirst.mockResolvedValue({ ...firstEvaluation, id: 202, attemptNo: 2 });
        await expect(submitBM01Revision(command, { db: exhaustedDb }))
            .rejects.toMatchObject({ code: 'BM01_REVISION_QUOTA_EXHAUSTED' });

        const expiredDb = dbFor(revisionRegistration);
        expiredDb.tx.bM01Evaluation.findFirst.mockResolvedValue({
            ...firstEvaluation,
            deadlineAt: new Date('2026-10-20T00:00:00.000Z'),
        });
        await expect(submitBM01Revision(command, {
            db: expiredDb,
            now: new Date('2026-10-30T00:00:00.000Z'),
        })).rejects.toMatchObject({ code: 'BM01_REVISION_DEADLINE_EXPIRED' });
        expect(expiredDb.tx.submission.create).not.toHaveBeenCalled();
        expect(expiredDb.tx.bM01Evaluation.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 201 },
            data: expect.objectContaining({ outcome: 'TERMINATED' }),
        }));
        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({
            targetStatus: 'TERMINATED_BM01',
        }), { tx: expiredDb.tx });
    });

    test('returns the same result for an idempotent retry', async () => {
        const db = dbFor(revisionRegistration);
        const prior = { submission: { id: 401 }, evaluation: { id: 202, attemptNo: 2 } };
        const crypto = require('crypto');
        const commandHash = crypto.createHash('sha256').update(JSON.stringify({
            registrationId: 41,
            studentId: 10,
            content: 'Đề cương đã sửa',
            fileUrl: 'https://example.test/bm01-v2.pdf',
            fileName: 'bm01-v2.pdf',
        })).digest('hex');
        db.tx.idempotencyRecord.findUnique.mockResolvedValue({ commandHash, response: prior });

        await expect(submitBM01Revision(command, { db })).resolves.toEqual({ ...prior, idempotent: true });
        expect(db.tx.submission.create).not.toHaveBeenCalled();
        expect(transitionRegistration).not.toHaveBeenCalled();
    });
});

describe('bm01WorkflowService initial submission', () => {
    beforeEach(() => jest.clearAllMocks());

    const command = {
        registrationId: 41,
        studentId: 10,
        content: 'Đề cương lần đầu',
        fileUrl: 'https://example.test/bm01-v1.pdf',
        fileName: 'bm01-v1.pdf',
        idempotencyKey: 'bm01-submit-0001',
    };

    test('creates the initial evidence and transitions an accepted registration to BM01_SUBMITTED', async () => {
        const db = dbFor({ ...baseRegistration, status: 'APPROVED' });
        const result = await submitBM01Initial(command, {
            db,
            now: new Date('2026-10-28T00:00:00.000Z'),
        });

        expect(result.submission).toMatchObject({ id: 401 });
        expect(db.tx.submission.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            registrationId: 41,
            submittedBy: 10,
            submittedAt: new Date('2026-10-28T00:00:00.000Z'),
        }) });
        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({
            expectedStatus: 'APPROVED',
            targetStatus: 'BM01_SUBMITTED',
        }), { tx: db.tx });
    });

    test('rejects initial submission from a later or terminal state', async () => {
        const db = dbFor({ ...baseRegistration, status: 'BM01_PASSED' });
        await expect(submitBM01Initial(command, { db }))
            .rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
        expect(db.tx.submission.create).not.toHaveBeenCalled();
    });
});
