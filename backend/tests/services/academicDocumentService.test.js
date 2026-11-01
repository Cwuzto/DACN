jest.mock('../../src/services/registrationTransitionService', () => ({
    WorkflowTransitionError: class WorkflowTransitionError extends Error {
        constructor(code, status = 409) { super(code); this.code = code; this.status = status; }
    },
    transitionRegistration: jest.fn().mockResolvedValue({}),
}));

const { transitionRegistration } = require('../../src/services/registrationTransitionService');
const { submitBM02, issueAssignmentDecision, createDecisionAmendment } = require('../../src/services/academicDocumentService');

function dbFor(registration, overrides = {}) {
    const tx = {
        topicRegistration: { findUnique: jest.fn().mockResolvedValue(registration) },
        bM02Submission: {
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn(),
            create: jest.fn().mockResolvedValue({ id: 101, versionNo: 1 }),
            update: jest.fn().mockResolvedValue({}),
        },
        assignmentDecision: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 401, registrationId: registration?.id, decisionNumber: 'QD-01' }),
        },
        decisionAmendment: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 501, assignmentDecisionId: 401, amendmentNumber: 'DC-01' }),
        },
        idempotencyRecord: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
        },
        ...overrides,
    };
    return {
        tx,
        assignmentDecision: tx.assignmentDecision,
        decisionAmendment: tx.decisionAmendment,
        $transaction: jest.fn((callback) => callback(tx)),
    };
}

const baseRegistration = {
    id: 1, studentId: 10, status: 'BM01_PASSED', stateVersion: 3,
    periodPolicyVersionId: 7, currentBM02SubmissionId: null,
};
const submissionCommand = {
    registrationId: 1, studentId: 10, content: 'BM02 content', fileUrl: 'https://example.test/bm02.pdf',
    fileName: 'bm02.pdf', idempotencyKey: 'bm02-key-0001',
};

describe('academicDocumentService BM02', () => {
    beforeEach(() => jest.clearAllMocks());

    test('creates the initial version only from BM01_PASSED and pins policy', async () => {
        const db = dbFor(baseRegistration);
        const result = await submitBM02(submissionCommand, { db });

        expect(result.id).toBe(101);
        expect(db.tx.bM02Submission.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            versionNo: 1, attemptNo: 1, policyVersionId: 7, submittedById: 10,
        }) });
        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({
            targetStatus: 'BM02_SUBMITTED', changes: { currentBM02SubmissionId: 101 },
        }), { tx: db.tx });
    });

    test('rejects initial submission without pinned policy', async () => {
        const db = dbFor({ ...baseRegistration, periodPolicyVersionId: null });
        await expect(submitBM02(submissionCommand, { db })).rejects.toMatchObject({ code: 'WORKFLOW_POLICY_REQUIRED' });
        expect(db.tx.bM02Submission.create).not.toHaveBeenCalled();
    });

    test('returns the prior BM02 result when the same command key is retried', async () => {
        const db = dbFor(baseRegistration);
        const priorResponse = { id: 101, registrationId: 1, versionNo: 1, attemptNo: 1 };
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(JSON.stringify({
            registrationId: 1, studentId: 10, content: 'BM02 content',
            fileUrl: 'https://example.test/bm02.pdf', fileName: 'bm02.pdf',
        })).digest('hex');
        db.tx.idempotencyRecord.findUnique.mockResolvedValue({ commandHash: hash, response: priorResponse });

        await expect(submitBM02(submissionCommand, { db })).resolves.toEqual({ ...priorResponse, idempotent: true });
        expect(db.tx.bM02Submission.create).not.toHaveBeenCalled();
        expect(transitionRegistration).not.toHaveBeenCalled();
    });

    test('creates one revision by superseding the returned current version', async () => {
        const prior = { id: 100, registrationId: 1, versionNo: 1, attemptNo: 1, outcome: 'REVISION_REQUIRED', revisionDeadlineAt: new Date('2099-01-01') };
        const db = dbFor({ ...baseRegistration, status: 'BM02_NEEDS_REVISION', currentBM02SubmissionId: 100 }, {
            bM02Submission: {
                findFirst: jest.fn(), findUnique: jest.fn().mockResolvedValue(prior),
                create: jest.fn().mockResolvedValue({ id: 101, versionNo: 2 }), update: jest.fn().mockResolvedValue({}),
            },
        });
        await submitBM02(submissionCommand, { db });
        expect(db.tx.bM02Submission.create).toHaveBeenCalledWith({ data: expect.objectContaining({ versionNo: 2, attemptNo: 2, supersedesId: 100 }) });
        expect(db.tx.bM02Submission.update).toHaveBeenCalledWith({ where: { id: 100 }, data: { outcome: 'SUPERSEDED' } });
        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({ targetStatus: 'BM02_RESUBMITTED' }), { tx: db.tx });
    });

    test('rejects a revision after deadline or when quota is exhausted', async () => {
        const expired = { id: 100, registrationId: 1, versionNo: 1, attemptNo: 1, outcome: 'REVISION_REQUIRED', revisionDeadlineAt: new Date('2000-01-01') };
        const db = dbFor({ ...baseRegistration, status: 'BM02_NEEDS_REVISION', currentBM02SubmissionId: 100 }, {
            bM02Submission: {
                findFirst: jest.fn(),
                findUnique: jest.fn().mockResolvedValue(expired),
                update: jest.fn().mockResolvedValue({ ...expired, outcome: 'REJECTED_TERMINAL' }),
            },
        });
        await expect(submitBM02(submissionCommand, { db, now: new Date('2026-10-30T00:00:00.000Z') }))
            .rejects.toMatchObject({ code: 'BM02_REVISION_DEADLINE_EXPIRED' });
        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({ targetStatus: 'TERMINATED_BM02' }), { tx: db.tx });

        const exhausted = { ...expired, attemptNo: 2, revisionDeadlineAt: new Date('2099-01-01') };
        db.tx.bM02Submission.findUnique.mockResolvedValue(exhausted);
        await expect(submitBM02(submissionCommand, { db })).rejects.toMatchObject({ code: 'BM02_REVISION_QUOTA_EXHAUSTED' });
    });
});

describe('academicDocumentService assignment decision', () => {
    const command = { registrationId: 1, issuedById: 2, decisionNumber: 'QD-01', idempotencyKey: 'decision-key-0001' };

    beforeEach(() => jest.clearAllMocks());

    test('requires the current BM02 to be approved', async () => {
        const db = dbFor({ ...baseRegistration, status: 'BM02_SUBMITTED', currentBM02SubmissionId: 101 }, {
            bM02Submission: { findUnique: jest.fn().mockResolvedValue({ id: 101, outcome: 'REVISION_REQUIRED' }) },
        });
        await expect(issueAssignmentDecision(command, { db })).rejects.toMatchObject({ code: 'BM02_CURRENT_APPROVAL_REQUIRED' });
        expect(db.tx.assignmentDecision.create).not.toHaveBeenCalled();
    });

    test('creates exactly one immutable decision and transition for approved current BM02', async () => {
        const db = dbFor({ ...baseRegistration, status: 'BM02_RESUBMITTED', currentBM02SubmissionId: 101 }, {
            bM02Submission: { findUnique: jest.fn().mockResolvedValue({ id: 101, outcome: 'APPROVED' }) },
        });
        const result = await issueAssignmentDecision(command, { db });
        expect(result).toMatchObject({ id: 401, idempotent: false });
        expect(db.tx.assignmentDecision.create).toHaveBeenCalledTimes(1);
        expect(transitionRegistration).toHaveBeenCalledWith(expect.objectContaining({ targetStatus: 'DECISION_ISSUED' }), { tx: db.tx });
    });

    test('returns an existing decision for the same idempotency key', async () => {
        const db = dbFor(baseRegistration, {
            assignmentDecision: { findUnique: jest.fn().mockResolvedValue({ id: 401, registrationId: 1, issuedById: 2, decisionNumber: 'QD-01' }), create: jest.fn() },
        });
        await expect(issueAssignmentDecision(command, { db })).resolves.toEqual(expect.objectContaining({ id: 401, idempotent: true }));
        expect(db.tx.assignmentDecision.create).not.toHaveBeenCalled();
    });

    test('returns the winning decision when an identical concurrent request hits the unique constraint', async () => {
        const existing = { id: 401, registrationId: 1, issuedById: 2, decisionNumber: 'QD-01' };
        const db = dbFor({ ...baseRegistration, status: 'BM02_SUBMITTED', currentBM02SubmissionId: 101 }, {
            bM02Submission: { findUnique: jest.fn().mockResolvedValue({ id: 101, outcome: 'APPROVED' }) },
            assignmentDecision: {
                findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existing),
                create: jest.fn().mockRejectedValue({ code: 'P2002' }),
            },
        });

        await expect(issueAssignmentDecision(command, { db })).resolves.toEqual({ ...existing, idempotent: true });
        expect(transitionRegistration).not.toHaveBeenCalled();
    });
});

describe('academicDocumentService decision amendments', () => {
    const command = {
        assignmentDecisionId: 401,
        signedById: 2,
        amendmentNumber: 'DC-01',
        reason: 'Sửa lỗi chính tả tên đề tài',
        changes: { title: { from: 'Tên cũ', to: 'Tên mới' } },
        effectiveAt: new Date('2026-10-29T00:00:00.000Z'),
        idempotencyKey: 'amendment-key-0001',
    };

    test('creates an append-only amendment without updating the original decision', async () => {
        const db = dbFor(baseRegistration);
        db.tx.assignmentDecision.findUnique.mockResolvedValue({ id: 401, registrationId: 1 });

        const result = await createDecisionAmendment(command, { db });

        expect(result).toMatchObject({ id: 501, assignmentDecisionId: 401, idempotent: false });
        expect(db.tx.decisionAmendment.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            assignmentDecisionId: 401,
            amendmentNumber: 'DC-01',
            signedById: 2,
            idempotencyKey: 'decision-amendment:amendment-key-0001',
        }) });
        expect(db.tx.assignmentDecision.update).toBeUndefined();
    });

    test('returns the same amendment for an idempotent retry and rejects changed payload', async () => {
        const existing = {
            id: 501,
            assignmentDecisionId: 401,
            amendmentNumber: 'DC-01',
            signedById: 2,
            reason: command.reason,
            changes: command.changes,
            effectiveAt: command.effectiveAt,
            idempotencyKey: 'decision-amendment:amendment-key-0001',
        };
        const db = dbFor(baseRegistration, {
            decisionAmendment: { findUnique: jest.fn().mockResolvedValue(existing), create: jest.fn() },
        });

        await expect(createDecisionAmendment(command, { db })).resolves.toEqual({ ...existing, idempotent: true });
        await expect(createDecisionAmendment({ ...command, reason: 'Lý do khác' }, { db }))
            .rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
        expect(db.tx.decisionAmendment.create).not.toHaveBeenCalled();
    });
});
