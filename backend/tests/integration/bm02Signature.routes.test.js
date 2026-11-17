const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockTopicRegistration = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
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

const mockAuditLog = {
    create: jest.fn(),
};

const mockPrisma = {
    topicRegistration: mockTopicRegistration,
    bM02Submission: mockBM02Submission,
    electronicSignatureEvent: mockElectronicSignatureEvent,
    idempotencyRecord: mockIdempotencyRecord,
    user: mockUser,
    academicDelegation: mockAcademicDelegation,
    auditLog: mockAuditLog,
    $transaction: jest.fn((cb) => cb(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-token'),
}));

const app = require('../../src/app');
const { computeBM02PayloadHash } = require('../../src/services/bm02SignatureService');

function buildUser({ id, role, department = 'SE', permissions = [] }) {
    return {
        id,
        role,
        department,
        fullName: `${role} ${id}`,
        email: `${role.toLowerCase()}${id}@test.vn`,
        code: `${role}-${id}`,
        isActive: true,
        permissionVersion: 1,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                code: `GROUP_${role}_${id}`,
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
        councilMembers: [],
    };
}

describe('BM02 Signature & Verification HTTP Routes', () => {
    const registrationId = 50;
    const semesterId = 3;
    const studentId = 10;
    const advisorId = 20;
    const otherLecturerId = 21;
    const deptHeadId = 30;
    const otherDeptHeadId = 31;

    const baseSub = {
        id: 301,
        registrationId,
        versionNo: 1,
        attemptNo: 1,
        outcome: 'PENDING_REVIEW',
        bm01ApprovedTitle: 'Đề tài BM01',
        bm02ProposedTitle: 'Đề tài BM02',
        titleChangeReason: 'Làm rõ phạm vi',
        content: 'Kế hoạch chi tiết',
        policyVersionId: 12,
        submittedById: studentId,
        studentSignatureEventId: 1001,
        advisorSignatureEventId: null,
        departmentSignatureEventId: null,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-jwt-secret';
        mockIdempotencyRecord.findUnique.mockResolvedValue(null);
        mockIdempotencyRecord.create.mockResolvedValue({});
        mockAcademicDelegation.findMany.mockResolvedValue([]);
        mockAcademicDelegation.findFirst.mockResolvedValue(null);
        mockTopicRegistration.findUnique.mockResolvedValue({
            id: registrationId,
            semesterId,
            studentId,
            topic: { id: 8, mentorId: advisorId, mentor: { id: advisorId, department: 'SE' } },
        });

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: studentId, role: 'STUDENT' };
            if (token === 'advisor-token') return { userId: advisorId, role: 'LECTURER' };
            if (token === 'other-lecturer-token') return { userId: otherLecturerId, role: 'LECTURER' };
            if (token === 'dept-token') return { userId: deptHeadId, role: 'LECTURER' };
            if (token === 'other-dept-token') return { userId: otherDeptHeadId, role: 'LECTURER' };
            throw new Error('invalid token');
        });

        mockUser.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === studentId) return buildUser({ id: studentId, role: 'STUDENT', permissions: ['SUBMIT_BM02'] });
            if (where.id === advisorId) return buildUser({ id: advisorId, role: 'LECTURER', department: 'SE', permissions: ['BM02_ADVISOR_SIGN'] });
            if (where.id === otherLecturerId) return buildUser({ id: otherLecturerId, role: 'LECTURER', department: 'SE', permissions: ['BM02_ADVISOR_SIGN'] });
            if (where.id === deptHeadId) return buildUser({ id: deptHeadId, role: 'LECTURER', department: 'SE', permissions: ['BM02_DEPARTMENT_SIGN'] });
            if (where.id === otherDeptHeadId) return buildUser({ id: otherDeptHeadId, role: 'LECTURER', department: 'AI', permissions: ['BM02_DEPARTMENT_SIGN'] });
            return null;
        });
    });

    test('POST /api/bm02/applications/:id/advisor-sign signs for mentor and rejects other lecturer (403)', async () => {
        const hash = computeBM02PayloadHash(baseSub);
        mockBM02Submission.findUnique.mockResolvedValue({
            ...baseSub,
            payloadHash: hash,
            registration: {
                id: registrationId,
                semesterId,
                studentId,
                currentBM02SubmissionId: 301,
                topic: { id: 8, mentorId: advisorId, mentor: { id: advisorId, department: 'SE' } },
            },
        });
        mockElectronicSignatureEvent.findMany.mockResolvedValue([
            { id: 1001, registrationId, entityType: 'BM02_SUBMISSION', entityId: 301, versionNumber: 1, signerId: studentId, signerRole: 'STUDENT', action: 'SIGN', payloadHash: hash },
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
        });
        mockBM02Submission.update.mockResolvedValue({ ...baseSub, payloadHash: hash, advisorSignatureEventId: 1002 });

        const forbiddenRes = await request(app)
            .post('/api/bm02/applications/301/advisor-sign')
            .set('Authorization', 'Bearer other-lecturer-token')
            .set('Idempotency-Key', 'http-adv-sign-forbidden')
            .send({ expectedPayloadHash: hash });
        expect(forbiddenRes.status).toBe(403);

        const okRes = await request(app)
            .post('/api/bm02/applications/301/advisor-sign')
            .set('Authorization', 'Bearer advisor-token')
            .set('Idempotency-Key', 'http-adv-sign-ok')
            .send({ expectedPayloadHash: hash });
        expect(okRes.status).toBe(200);
        expect(okRes.body.success).toBe(true);
        expect(okRes.body.data.signatureEvent.id).toBe(1002);
    });

    test('POST /api/bm02/applications/:id/department-sign enforces scope and sequence', async () => {
        const hash = computeBM02PayloadHash(baseSub);
        mockBM02Submission.findUnique.mockResolvedValue({
            ...baseSub,
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
        });
        mockBM02Submission.update.mockResolvedValue({ ...baseSub, payloadHash: hash, advisorSignatureEventId: 1002, departmentSignatureEventId: 1003 });

        const wrongScopeRes = await request(app)
            .post('/api/bm02/applications/301/department-sign')
            .set('Authorization', 'Bearer other-dept-token')
            .set('Idempotency-Key', 'http-dept-sign-wrong-scope')
            .send({ expectedPayloadHash: hash });
        expect(wrongScopeRes.status).toBe(403);

        const okRes = await request(app)
            .post('/api/bm02/applications/301/department-sign')
            .set('Authorization', 'Bearer dept-token')
            .set('Idempotency-Key', 'http-dept-sign-ok')
            .send({ expectedPayloadHash: hash });
        expect(okRes.status).toBe(200);
        expect(okRes.body.success).toBe(true);
        expect(okRes.body.data.signatureEvent.id).toBe(1003);
    });

    test('GET /api/bm02/applications/:id/verification returns verification DTO for authorized actor and 403 for outsider', async () => {
        const hash = computeBM02PayloadHash(baseSub);
        mockBM02Submission.findUnique.mockResolvedValue({
            ...baseSub,
            payloadHash: hash,
            advisorSignatureEventId: 1002,
            departmentSignatureEventId: 1003,
            registration: {
                id: registrationId,
                semesterId,
                studentId,
                currentBM02SubmissionId: 301,
                topic: { id: 8, mentorId: advisorId, mentor: { id: advisorId, department: 'SE' } },
            },
        });
        mockElectronicSignatureEvent.findMany.mockResolvedValue([
            { id: 1001, registrationId, entityType: 'BM02_SUBMISSION', entityId: 301, versionNumber: 1, signerId: studentId, signerRole: 'STUDENT', action: 'SIGN', payloadHash: hash, signedAt: new Date(), signer: { id: studentId, fullName: 'SV', code: 'SV1' } },
            { id: 1002, registrationId, entityType: 'BM02_SUBMISSION', entityId: 301, versionNumber: 1, signerId: advisorId, signerRole: 'ADVISOR', action: 'SIGN', payloadHash: hash, signedAt: new Date(), signer: { id: advisorId, fullName: 'GVHD', code: 'GV1' } },
            { id: 1003, registrationId, entityType: 'BM02_SUBMISSION', entityId: 301, versionNumber: 1, signerId: deptHeadId, signerRole: 'DEPARTMENT_HEAD', action: 'SIGN', payloadHash: hash, signedAt: new Date(), signer: { id: deptHeadId, fullName: 'BM', code: 'BM1' } },
        ]);

        const outsiderRes = await request(app)
            .get('/api/bm02/applications/301/verification')
            .set('Authorization', 'Bearer other-lecturer-token');
        expect(outsiderRes.status).toBe(403);

        const okRes = await request(app)
            .get('/api/bm02/applications/301/verification')
            .set('Authorization', 'Bearer advisor-token');
        expect(okRes.status).toBe(200);
        expect(okRes.body.data.allValid).toBe(true);
        expect(okRes.body.data.student.valid).toBe(true);
        expect(okRes.body.data.advisor.valid).toBe(true);
        expect(okRes.body.data.department.valid).toBe(true);
    });
});
