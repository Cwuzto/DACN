jest.mock('../../src/services/registrationTransitionService', () => ({
    WorkflowTransitionError: class WorkflowTransitionError extends Error {
        constructor(code, status = 409) { super(code); this.code = code; this.status = status; }
    },
    transitionRegistration: jest.fn().mockResolvedValue({}),
}));

const { transitionRegistration } = require('../../src/services/registrationTransitionService');
const { reviewBM02 } = require('../../src/services/bm02ReviewService');

const baseRegistration = {
    id: 51,
    status: 'BM02_SUBMITTED',
    stateVersion: 4,
    periodPolicyVersionId: 7,
    currentBM02SubmissionId: 301,
};

const baseSubmission = {
    id: 301,
    registrationId: 51,
    attemptNo: 1,
    versionNo: 1,
    outcome: 'PENDING_REVIEW',
    policyVersionId: 7,
};

function dbFor(registration = baseRegistration, submission = baseSubmission) {
    const tx = {
        topicRegistration: { findUnique: jest.fn().mockResolvedValue(registration) },
        bM02Submission: {
            findUnique: jest.fn().mockResolvedValue(submission),
            update: jest.fn().mockImplementation(async ({ data }) => ({ ...submission, ...data })),
        },
        periodWorkflowPolicyVersion: {
            findUnique: jest.fn().mockResolvedValue({
                id: 7,
                policy: { revisionWindowDays: 3, bm02MaxResubmissions: 1 },
            }),
        },
        idempotencyRecord: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
        },
    };
    return {
        tx,
        idempotencyRecord: tx.idempotencyRecord,
        $transaction: jest.fn((callback) => callback(tx)),
    };
}

const baseCommand = {
    registrationId: 51,
    reviewerId: 20,
    action: 'APPROVE',
    idempotencyKey: 'bm02-review-0001',
};

describe('bm02ReviewService', () => {
    beforeEach(() => jest.clearAllMocks());

    test('approves only the current pending BM02 without changing registration state', async () => {
        const db = dbFor();
        const result = await reviewBM02(baseCommand, { db, now: new Date('2026-10-28T02:00:00.000Z') });

        expect(result.submission).toMatchObject({ id: 301, outcome: 'APPROVED' });
        expect(db.tx.bM02Submission.update).toHaveBeenCalledWith({
            where: { id: 301 },
            data: expect.objectContaining({ outcome: 'APPROVED', reviewedById: 20 }),
        });
        expect(transitionRegistration).not.toHaveBeenCalled();
    });

    test('returns the first version once with issues and a pinned revision deadline', async () => {
        const db = dbFor();
        await reviewBM02({
            ...baseCommand,
            action: 'RETURN_FOR_REVISION',
            issues: ['Thiếu chữ ký'],
            idempotencyKey: 'bm02-review-0002',
        }, { db, now: new Date('2026-10-28T02:00:00.000Z') });

        expect(db.tx.bM02Submission.update).toHaveBeenCalledWith({
            where: { id: 301 },
            data: expect.objectContaining({
                outcome: 'REVISION_REQUIRED',
                issues: ['Thiếu chữ ký'],
                notifiedAt: new Date('2026-10-28T02:00:00.000Z'),
                revisionDeadlineAt: new Date('2026-10-31T02:00:00.000Z'),
            }),
        });
        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({
            targetStatus: 'BM02_NEEDS_REVISION',
        }), { tx: db.tx });
    });

    test('terminates instead of granting another revision after attempt two', async () => {
        const registration = { ...baseRegistration, status: 'BM02_RESUBMITTED' };
        const submission = { ...baseSubmission, id: 302, attemptNo: 2, versionNo: 2 };
        registration.currentBM02SubmissionId = 302;
        const db = dbFor(registration, submission);

        await reviewBM02({
            ...baseCommand,
            action: 'RETURN_FOR_REVISION',
            issues: ['Vẫn thiếu chữ ký'],
            idempotencyKey: 'bm02-review-0003',
        }, { db });

        expect(db.tx.bM02Submission.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ outcome: 'REJECTED_TERMINAL' }),
        }));
        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({
            targetStatus: 'TERMINATED_BM02',
        }), { tx: db.tx });
    });

    test('moves a submission into exception review without increasing the revision quota', async () => {
        const db = dbFor();
        await reviewBM02({
            ...baseCommand,
            action: 'EXCEPTION_REVIEW',
            issues: ['Cần xác minh biểu mẫu'],
            idempotencyKey: 'bm02-review-0004',
        }, { db });

        expect(db.tx.bM02Submission.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ outcome: 'EXCEPTION_REVIEW' }),
        }));
        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({
            targetStatus: 'BM02_EXCEPTION_REVIEW',
        }), { tx: db.tx });
    });

    test('resolves exception review back to the correct attempt state', async () => {
        const registration = { ...baseRegistration, status: 'BM02_EXCEPTION_REVIEW' };
        const submission = { ...baseSubmission, outcome: 'EXCEPTION_REVIEW' };
        const db = dbFor(registration, submission);

        await reviewBM02({
            ...baseCommand,
            action: 'APPROVE',
            idempotencyKey: 'bm02-review-0005',
        }, { db });

        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({
            expectedStatus: 'BM02_EXCEPTION_REVIEW',
            targetStatus: 'BM02_SUBMITTED',
        }), { tx: db.tx });
    });

    test('rejects a stale submission pointer and requires issues for non-approval actions', async () => {
        const staleDb = dbFor({ ...baseRegistration, currentBM02SubmissionId: 999 });
        await expect(reviewBM02(baseCommand, { db: staleDb }))
            .rejects.toMatchObject({ code: 'BM02_CURRENT_SUBMISSION_REQUIRED' });

        const db = dbFor();
        await expect(reviewBM02({
            ...baseCommand,
            action: 'RETURN_FOR_REVISION',
            idempotencyKey: 'bm02-review-0006',
        }, { db })).rejects.toMatchObject({ code: 'BM02_ISSUES_REQUIRED' });
    });
});
