const mockTopicRegistration = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockBM02Submission = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockElectronicSignatureEvent = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
};

const mockIdempotencyRecord = {
    findUnique: jest.fn(),
    create: jest.fn(),
};

const mockUser = {
    findUnique: jest.fn(),
};

const mockAcademicDelegation = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
};

const mockTask = {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockRegistrationStateHistory = {
    create: jest.fn(),
};

const mockPeriodWorkflowPolicyVersion = {
    findUnique: jest.fn(),
};

const mockPrisma = {
    topicRegistration: mockTopicRegistration,
    bM02Submission: mockBM02Submission,
    electronicSignatureEvent: mockElectronicSignatureEvent,
    idempotencyRecord: mockIdempotencyRecord,
    user: mockUser,
    academicDelegation: mockAcademicDelegation,
    task: mockTask,
    registrationStateHistory: mockRegistrationStateHistory,
    periodWorkflowPolicyVersion: mockPeriodWorkflowPolicyVersion,
    $transaction: jest.fn((cb) => cb(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);

const {
    computeBM02PayloadHash,
    signBM02Advisor,
    signBM02Department,
    getBM02Verification,
} = require('../../src/services/bm02SignatureService');
const { submitBM02 } = require('../../src/services/academicDocumentService');
const { reviewBM02 } = require('../../src/services/bm02ReviewService');

function buildResolvedUser({ id, role, department = 'SE', permissions = [], delegations = [] }) {
    return {
        id,
        role,
        department,
        fullName: `${role} ${id}`,
        code: `${role}-${id}`,
        email: `${role.toLowerCase()}${id}@test.vn`,
        isActive: true,
        permissionVersion: 1,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                code: `GRP_${role}_${id}`,
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
        councilMembers: [],
    };
}

describe('bm02SignatureService', () => {
    const registrationId = 50;
    const semesterId = 3;
    const studentId = 10;
    const advisorId = 20;
    const otherLecturerId = 21;
    const deptHeadId = 30;
    const otherDeptHeadId = 31;
    const reviewerId = 40;

    const baseSubmission = {
        id: 301,
        registrationId,
        versionNo: 1,
        attemptNo: 1,
        outcome: 'PENDING_REVIEW',
        bm01ApprovedTitle: 'Tên BM01',
        bm02ProposedTitle: 'Tên BM02',
        titleChangeReason: 'Lý do chỉnh sửa',
        content: 'Nội dung nhiệm vụ chi tiết',
        policyVersionId: 12,
        submittedById: studentId,
        studentSignatureEventId: 1001,
        advisorSignatureEventId: null,
        departmentSignatureEventId: null,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockIdempotencyRecord.findUnique.mockResolvedValue(null);
        mockIdempotencyRecord.create.mockResolvedValue({});
        mockAcademicDelegation.findMany.mockResolvedValue([]);
        mockAcademicDelegation.findFirst.mockResolvedValue(null);
        mockRegistrationStateHistory.create.mockResolvedValue({});
        mockTopicRegistration.findUnique.mockResolvedValue({
            id: registrationId,
            semesterId,
            studentId,
            topic: { id: 8, mentorId: advisorId, mentor: { id: advisorId, department: 'SE' } },
        });
    });

    test('computeBM02PayloadHash ignores mutable status fields', () => {
        const h1 = computeBM02PayloadHash({
            ...baseSubmission,
            outcome: 'PENDING_REVIEW',
            advisorSignatureEventId: null,
        });
        const h2 = computeBM02PayloadHash({
            ...baseSubmission,
            outcome: 'APPROVED',
            advisorSignatureEventId: 999,
        });
        expect(h1).toBe(h2);
        expect(h1).toMatch(/^[a-f0-9]{64}$/);
    });

    test('submitBM02 creates studentSignatureEvent in transaction and stores payloadHash + studentSignatureEventId', async () => {
        mockTopicRegistration.findUnique.mockResolvedValue({
            id: registrationId,
            studentId,
            status: 'BM01_PASSED',
            stateVersion: 1,
            periodPolicyVersionId: 12,
            bm01ApprovedTitleSnapshot: 'Tên BM01',
            topic: { id: 8, title: 'Tên BM01', mentorId: advisorId, mentor: { id: advisorId, fullName: 'GVHD', email: 'gvhd@test.vn' } },
            student: { id: studentId, fullName: 'Sinh viên', code: 'SV01', email: 'sv@test.vn' },
        });
        mockBM02Submission.findFirst.mockResolvedValue(null);
        mockBM02Submission.create.mockImplementation(async ({ data }) => ({ id: 301, ...data }));
        mockElectronicSignatureEvent.create.mockImplementation(async ({ data }) => ({ id: 1001, ...data }));
        mockBM02Submission.update.mockImplementation(async ({ data }) => ({ ...baseSubmission, ...data }));
        mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
        mockTask.findFirst.mockResolvedValue(null);
        mockTask.create.mockResolvedValue({ id: 99 });

        const result = await submitBM02({
            registrationId,
            studentId,
            bm02ProposedTitle: 'Tên BM02',
            titleChangeReason: 'Lý do chỉnh sửa',
            content: 'Nội dung nhiệm vụ chi tiết',
            idempotencyKey: 'submit-bm02-sig-001',
        });

        expect(mockElectronicSignatureEvent.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                registrationId,
                entityType: 'BM02_SUBMISSION',
                entityId: 301,
                versionNumber: 1,
                signerId: studentId,
                signerRole: 'STUDENT',
                action: 'SIGN',
            }),
        }));
        expect(result.payloadHash).toBe(computeBM02PayloadHash(baseSubmission));
        expect(result.studentSignatureEventId).toBe(1001);
    });

    test('signBM02Advisor succeeds for topic mentor with BM02_ADVISOR_SIGN and is idempotent', async () => {
        const hash = computeBM02PayloadHash(baseSubmission);
        const sub = {
            ...baseSubmission,
            payloadHash: hash,
            registration: {
                id: registrationId,
                semesterId,
                studentId,
                currentBM02SubmissionId: 301,
                topic: { id: 8, mentorId: advisorId, mentor: { id: advisorId, department: 'SE' } },
            },
        };
        mockBM02Submission.findUnique.mockResolvedValue(sub);
        mockUser.findUnique.mockResolvedValue(buildResolvedUser({
            id: advisorId,
            role: 'LECTURER',
            department: 'SE',
            permissions: ['BM02_ADVISOR_SIGN'],
        }));
        mockElectronicSignatureEvent.findMany.mockResolvedValue([
            {
                id: 1001,
                registrationId,
                entityType: 'BM02_SUBMISSION',
                entityId: 301,
                versionNumber: 1,
                signerId: studentId,
                signerRole: 'STUDENT',
                action: 'SIGN',
                payloadHash: hash,
            },
        ]);
        mockElectronicSignatureEvent.create.mockResolvedValue({
            id: 1002,
            registrationId,
            entityType: 'BM02_SUBMISSION',
            entityId: 301,
            versionNumber: 1,
            signerId: advisorId,
            signerRole: 'ADVISOR',
            action: 'SIGN',
            payloadHash: hash,
            signedAt: new Date('2026-11-18T01:00:00Z'),
        });
        mockBM02Submission.update.mockResolvedValue({ ...sub, advisorSignatureEventId: 1002 });

        const res = await signBM02Advisor({
            submissionId: 301,
            actorId: advisorId,
            expectedPayloadHash: hash,
            idempotencyKey: 'advisor-sign-001',
        });

        expect(res.idempotent).toBe(false);
        expect(res.signatureEvent.id).toBe(1002);
        expect(mockBM02Submission.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 301 },
            data: { advisorSignatureEventId: 1002 },
        }));

        // Idempotent replay
        const savedReceipt = mockIdempotencyRecord.create.mock.calls[0][0].data;
        mockIdempotencyRecord.findUnique.mockResolvedValue(savedReceipt);
        const replay = await signBM02Advisor({
            submissionId: 301,
            actorId: advisorId,
            expectedPayloadHash: hash,
            idempotencyKey: 'advisor-sign-001',
        });
        expect(replay.idempotent).toBe(true);
        expect(mockElectronicSignatureEvent.create).toHaveBeenCalledTimes(1);
    });

    test('signBM02Advisor rejects non-mentor lecturer with 403', async () => {
        const hash = computeBM02PayloadHash(baseSubmission);
        mockBM02Submission.findUnique.mockResolvedValue({
            ...baseSubmission,
            payloadHash: hash,
            registration: {
                id: registrationId,
                semesterId,
                studentId,
                currentBM02SubmissionId: 301,
                topic: { id: 8, mentorId: advisorId, mentor: { id: advisorId, department: 'SE' } },
            },
        });
        mockUser.findUnique.mockResolvedValue(buildResolvedUser({
            id: otherLecturerId,
            role: 'LECTURER',
            department: 'SE',
            permissions: ['BM02_ADVISOR_SIGN'],
        }));

        await expect(signBM02Advisor({
            submissionId: 301,
            actorId: otherLecturerId,
            expectedPayloadHash: hash,
            idempotencyKey: 'advisor-sign-wrong-mentor',
        })).rejects.toMatchObject({ status: 403 });
        expect(mockElectronicSignatureEvent.create).not.toHaveBeenCalled();
    });

    test('signBM02Advisor rejects stale expectedPayloadHash with 409', async () => {
        const hash = computeBM02PayloadHash(baseSubmission);
        mockBM02Submission.findUnique.mockResolvedValue({
            ...baseSubmission,
            payloadHash: hash,
            registration: {
                id: registrationId,
                semesterId,
                studentId,
                currentBM02SubmissionId: 301,
                topic: { id: 8, mentorId: advisorId, mentor: { id: advisorId, department: 'SE' } },
            },
        });
        mockUser.findUnique.mockResolvedValue(buildResolvedUser({
            id: advisorId,
            role: 'LECTURER',
            department: 'SE',
            permissions: ['BM02_ADVISOR_SIGN'],
        }));
        mockElectronicSignatureEvent.findMany.mockResolvedValue([
            {
                id: 1001,
                registrationId,
                entityType: 'BM02_SUBMISSION',
                entityId: 301,
                versionNumber: 1,
                signerId: studentId,
                signerRole: 'STUDENT',
                action: 'SIGN',
                payloadHash: hash,
            },
        ]);

        await expect(signBM02Advisor({
            submissionId: 301,
            actorId: advisorId,
            expectedPayloadHash: 'stale-hash-000',
            idempotencyKey: 'advisor-sign-stale-hash',
        })).rejects.toMatchObject({ status: 409, code: 'PAYLOAD_HASH_MISMATCH' });
        expect(mockElectronicSignatureEvent.create).not.toHaveBeenCalled();
    });

    test('signBM02Department rejects signing before advisor (409) and out-of-scope actor (403)', async () => {
        const hash = computeBM02PayloadHash(baseSubmission);
        const subWithoutAdvisor = {
            ...baseSubmission,
            payloadHash: hash,
            advisorSignatureEventId: null,
            registration: {
                id: registrationId,
                semesterId,
                studentId,
                currentBM02SubmissionId: 301,
                topic: { id: 8, mentorId: advisorId, mentor: { id: advisorId, department: 'SE' } },
            },
        };

        // Out-of-scope department head (different department, no delegation)
        mockBM02Submission.findUnique.mockResolvedValue(subWithoutAdvisor);
        mockUser.findUnique.mockResolvedValue(buildResolvedUser({
            id: otherDeptHeadId,
            role: 'LECTURER',
            department: 'AI',
            permissions: ['BM02_DEPARTMENT_SIGN'],
        }));
        await expect(signBM02Department({
            submissionId: 301,
            actorId: otherDeptHeadId,
            expectedPayloadHash: hash,
            idempotencyKey: 'dept-sign-wrong-scope',
        })).rejects.toMatchObject({ status: 403 });

        // In-scope department head, but advisor has NOT signed yet -> 409
        mockUser.findUnique.mockResolvedValue(buildResolvedUser({
            id: deptHeadId,
            role: 'LECTURER',
            department: 'SE',
            permissions: ['BM02_DEPARTMENT_SIGN'],
        }));
        mockElectronicSignatureEvent.findMany.mockResolvedValue([
            {
                id: 1001,
                registrationId,
                entityType: 'BM02_SUBMISSION',
                entityId: 301,
                versionNumber: 1,
                signerId: studentId,
                signerRole: 'STUDENT',
                action: 'SIGN',
                payloadHash: hash,
            },
        ]);
        await expect(signBM02Department({
            submissionId: 301,
            actorId: deptHeadId,
            expectedPayloadHash: hash,
            idempotencyKey: 'dept-sign-before-advisor',
        })).rejects.toMatchObject({ status: 409 });
        expect(mockElectronicSignatureEvent.create).not.toHaveBeenCalled();
    });

    test('signBM02Department succeeds with scoped delegation and reviewBM02 APPROVE passes after 3 valid events', async () => {
        const hash = computeBM02PayloadHash(baseSubmission);
        const subAfterAdvisor = {
            ...baseSubmission,
            payloadHash: hash,
            advisorSignatureEventId: 1002,
            registration: {
                id: registrationId,
                semesterId,
                studentId,
                currentBM02SubmissionId: 301,
                topic: { id: 8, mentorId: advisorId, mentor: { id: advisorId, department: 'SE' } },
            },
        };
        mockBM02Submission.findUnique.mockResolvedValue(subAfterAdvisor);
        mockUser.findUnique.mockResolvedValue(buildResolvedUser({
            id: deptHeadId,
            role: 'LECTURER',
            department: 'SE',
            permissions: [],
        }));
        mockAcademicDelegation.findMany.mockResolvedValue([
            {
                id: 77,
                capabilityCode: 'BM02_DEPARTMENT_SIGN',
                department: 'SE',
                semesterId,
                status: 'ACTIVE',
            },
        ]);
        mockAcademicDelegation.findFirst.mockResolvedValue({
            id: 77,
            capabilityCode: 'BM02_DEPARTMENT_SIGN',
            department: 'SE',
            status: 'ACTIVE',
        });
        mockElectronicSignatureEvent.findMany.mockResolvedValue([
            { id: 1001, registrationId, entityType: 'BM02_SUBMISSION', entityId: 301, versionNumber: 1, signerId: studentId, signerRole: 'STUDENT', action: 'SIGN', payloadHash: hash },
            { id: 1002, registrationId, entityType: 'BM02_SUBMISSION', entityId: 301, versionNumber: 1, signerId: advisorId, signerRole: 'ADVISOR', action: 'SIGN', payloadHash: hash },
        ]);
        mockElectronicSignatureEvent.create.mockResolvedValue({
            id: 1003,
            registrationId,
            entityType: 'BM02_SUBMISSION',
            entityId: 301,
            versionNumber: 1,
            signerId: deptHeadId,
            signerRole: 'DEPARTMENT_HEAD',
            action: 'SIGN',
            payloadHash: hash,
            signedAt: new Date('2026-11-18T02:00:00Z'),
        });
        mockBM02Submission.update.mockResolvedValue({ ...subAfterAdvisor, departmentSignatureEventId: 1003 });

        const signRes = await signBM02Department({
            submissionId: 301,
            actorId: deptHeadId,
            expectedPayloadHash: hash,
            idempotencyKey: 'dept-sign-ok-001',
        });
        expect(signRes.signatureEvent.id).toBe(1003);

        // Now test reviewBM02 APPROVE blocked before 3rd event, allowed after 3rd event
        mockTopicRegistration.findUnique.mockResolvedValue({
            id: registrationId,
            status: 'BM02_SUBMITTED',
            stateVersion: 2,
            periodPolicyVersionId: 12,
            currentBM02SubmissionId: 301,
            studentId,
            topic: { mentorId: advisorId, mentor: { department: 'SE' } },
        });
        mockPeriodWorkflowPolicyVersion.findUnique.mockResolvedValue({
            id: 12,
            policy: { revisionWindowDays: 5, bm02MaxResubmissions: 1 },
        });

        // Missing departmentSignatureEventId -> 409
        mockBM02Submission.findUnique.mockResolvedValue(subAfterAdvisor);
        await expect(reviewBM02({
            registrationId,
            reviewerId,
            action: 'APPROVE',
            targetStatus: 'BM02_APPROVED',
            idempotencyKey: 'review-before-3-sigs',
        })).rejects.toMatchObject({ status: 409, code: 'BM02_SIGNATURES_INCOMPLETE' });

        // With all 3 valid events -> succeeds
        mockBM02Submission.findUnique.mockResolvedValue({
            ...subAfterAdvisor,
            departmentSignatureEventId: 1003,
        });
        mockElectronicSignatureEvent.findMany.mockResolvedValue([
            { id: 1001, registrationId, entityType: 'BM02_SUBMISSION', entityId: 301, versionNumber: 1, signerId: studentId, signerRole: 'STUDENT', action: 'SIGN', payloadHash: hash },
            { id: 1002, registrationId, entityType: 'BM02_SUBMISSION', entityId: 301, versionNumber: 1, signerId: advisorId, signerRole: 'ADVISOR', action: 'SIGN', payloadHash: hash },
            { id: 1003, registrationId, entityType: 'BM02_SUBMISSION', entityId: 301, versionNumber: 1, signerId: deptHeadId, signerRole: 'DEPARTMENT_HEAD', action: 'SIGN', payloadHash: hash },
        ]);
        mockBM02Submission.update.mockResolvedValue({ ...subAfterAdvisor, departmentSignatureEventId: 1003, outcome: 'APPROVED' });
        mockTopicRegistration.updateMany.mockResolvedValue({ count: 1 });
        mockTask.findFirst.mockResolvedValue(null);

        const reviewRes = await reviewBM02({
            registrationId,
            reviewerId,
            action: 'APPROVE',
            targetStatus: 'BM02_APPROVED',
            idempotencyKey: 'review-after-3-sigs',
        });
        expect(reviewRes.targetStatus).toBe('BM02_APPROVED');
    });

    test('getBM02Verification validates hash/version and blocks outsiders with 403', async () => {
        const hash = computeBM02PayloadHash(baseSubmission);
        mockBM02Submission.findUnique.mockResolvedValue({
            ...baseSubmission,
            payloadHash: hash,
            advisorSignatureEventId: 1002,
            registration: {
                id: registrationId,
                semesterId,
                studentId,
                currentBM02SubmissionId: 301,
                topic: { id: 8, mentorId: advisorId, mentor: { id: advisorId, department: 'SE' } },
            },
        });
        mockElectronicSignatureEvent.findMany.mockResolvedValue([
            {
                id: 1001,
                registrationId,
                entityType: 'BM02_SUBMISSION',
                entityId: 301,
                versionNumber: 1,
                signerId: studentId,
                signerRole: 'STUDENT',
                action: 'SIGN',
                payloadHash: hash,
                signedAt: new Date('2026-11-18T00:00:00Z'),
                signer: { id: studentId, fullName: 'Sinh viên A', code: 'SV01' },
            },
            {
                id: 1002,
                registrationId,
                entityType: 'BM02_SUBMISSION',
                entityId: 301,
                versionNumber: 1,
                signerId: advisorId,
                signerRole: 'ADVISOR',
                action: 'SIGN',
                payloadHash: 'tampered-hash', // mismatch!
                signedAt: new Date('2026-11-18T01:00:00Z'),
                signer: { id: advisorId, fullName: 'GVHD B', code: 'GV01' },
            },
        ]);

        // Student owner can view
        const verif = await getBM02Verification({ submissionId: 301, actorId: studentId });
        expect(verif.versionNo).toBe(1);
        expect(verif.payloadHash).toBe(hash);
        expect(verif.student.valid).toBe(true);
        expect(verif.advisor.valid).toBe(false);
        expect(verif.department.valid).toBe(false);

        // Outsider lecturer cannot view -> 403
        mockUser.findUnique.mockResolvedValue(buildResolvedUser({
            id: otherLecturerId,
            role: 'LECTURER',
            department: 'SE',
            permissions: ['BM02_ADVISOR_SIGN'],
        }));
        await expect(getBM02Verification({ submissionId: 301, actorId: otherLecturerId }))
            .rejects.toMatchObject({ status: 403 });
    });

    test('v2 submission resets signature chain and does not inherit v1 signatures', async () => {
        const v2Sub = {
            ...baseSubmission,
            id: 302,
            versionNo: 2,
            attemptNo: 2,
            supersedesId: 301,
            studentSignatureEventId: 2001,
            advisorSignatureEventId: null,
            departmentSignatureEventId: null,
        };
        const v2Hash = computeBM02PayloadHash(v2Sub);
        mockBM02Submission.findUnique.mockResolvedValue({
            ...v2Sub,
            payloadHash: v2Hash,
            registration: {
                id: registrationId,
                semesterId,
                studentId,
                currentBM02SubmissionId: 302,
                topic: { id: 8, mentorId: advisorId, mentor: { id: advisorId, department: 'SE' } },
            },
        });
        mockElectronicSignatureEvent.findMany.mockResolvedValue([
            {
                id: 2001,
                registrationId,
                entityType: 'BM02_SUBMISSION',
                entityId: 302,
                versionNumber: 2,
                signerId: studentId,
                signerRole: 'STUDENT',
                action: 'SIGN',
                payloadHash: v2Hash,
                signedAt: new Date('2026-11-18T03:00:00Z'),
                signer: { id: studentId, fullName: 'Sinh viên A', code: 'SV01' },
            },
        ]);

        const verif = await getBM02Verification({ submissionId: 302, actorId: studentId });
        expect(verif.versionNo).toBe(2);
        expect(verif.student.valid).toBe(true);
        expect(verif.advisor.valid).toBe(false);
        expect(verif.department.valid).toBe(false);
        expect(verif.allValid).toBe(false);
    });
});
