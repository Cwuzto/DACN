const request = require('supertest');
const jwt = require('jsonwebtoken');

const {
    DEFAULT_GROUPS,
    STUDENT_BASE_PERMISSIONS,
    PERMISSIONS,
} = require('../../src/constants/permissions');

// Mock all Prisma database models accessed in authentication, authorization & controllers
const mockUser = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(10),
};

const mockTopicRegistration = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ id: 100 }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    count: jest.fn().mockResolvedValue(1),
};

const mockTopic = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(1),
};

const mockCouncil = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(1),
};

const mockCouncilMember = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
};

const mockAcademicDelegation = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1, status: 'ACTIVE' }),
    update: jest.fn().mockResolvedValue({ id: 1, status: 'REVOKED' }),
};

const mockBM02AAdjustmentRequest = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1 }),
};

const mockTitleAdjustmentAppendix = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1, status: 'ISSUED' }),
};

const mockTitleAdjustmentAppendixItem = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
};

const mockBM03ProgressRecord = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1 }),
};

const mockBM04Evaluation = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1 }),
};

const mockProjectArchive = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1 }),
    upsert: jest.fn().mockResolvedValue({ id: 1 }),
};

const mockDefenseDocumentVersion = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1 }),
};

const mockDefenseDocumentSnapshot = {
    findUnique: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1 }),
};

const mockPermissionGroup = {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 10, code: 'NEW_GRP', name: 'New Group' }),
    update: jest.fn().mockResolvedValue({ id: 10 }),
    delete: jest.fn().mockResolvedValue({ id: 10 }),
};

const mockPermission = {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
};

const mockPortalTemplate = {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1, name: 'Template' }),
};

const mockSemester = {
    findFirst: jest.fn().mockResolvedValue({ id: 1, name: 'HK1 2026-2027', status: 'ACTIVE' }),
    findUnique: jest.fn().mockResolvedValue({ id: 1, name: 'HK1 2026-2027', status: 'ACTIVE' }),
};

const mockPrisma = {
    user: mockUser,
    topicRegistration: mockTopicRegistration,
    topic: mockTopic,
    council: mockCouncil,
    councilMember: mockCouncilMember,
    academicDelegation: mockAcademicDelegation,
    bM02AAdjustmentRequest: mockBM02AAdjustmentRequest,
    titleAdjustmentAppendix: mockTitleAdjustmentAppendix,
    titleAdjustmentAppendixItem: mockTitleAdjustmentAppendixItem,
    bM03ProgressRecord: mockBM03ProgressRecord,
    bM04Evaluation: mockBM04Evaluation,
    projectArchive: mockProjectArchive,
    defenseDocumentVersion: mockDefenseDocumentVersion,
    defenseDocumentSnapshot: mockDefenseDocumentSnapshot,
    permissionGroup: mockPermissionGroup,
    permission: mockPermission,
    portalTemplate: mockPortalTemplate,
    semester: mockSemester,
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    notification: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    electronicSignatureEvent: { create: jest.fn().mockResolvedValue({}) },
    idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    registrationStateHistory: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((callback) => (typeof callback === 'function' ? callback(mockPrisma) : Promise.resolve(callback))),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/notificationService', () => ({
    safeNotify: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/academicPdfService', () => ({
    generateImmutableAcademicPdf: jest.fn().mockResolvedValue({
        fileUrl: 'https://storage.example.com/test.pdf',
        fileName: 'test.pdf',
        pdfHash: 'hash-12345',
        pdfBuffer: Buffer.from('pdf-data'),
    }),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-token'),
}));

// Mock workflow services to isolate authorization layer checks
jest.mock('../../src/services/bm02aWorkflowService', () => {
    class BM02AWorkflowError extends Error {}
    return {
        createBM02ARequest: jest.fn().mockResolvedValue({ id: 1, status: 'DRAFT' }),
        studentSignAndSubmitBM02A: jest.fn().mockResolvedValue({ id: 1, status: 'SUBMITTED' }),
        advisorSignBM02A: jest.fn().mockResolvedValue({ id: 1, status: 'ADVISOR_SIGNED' }),
        departmentSignBM02A: jest.fn().mockResolvedValue({ id: 1, status: 'APPROVED' }),
        returnBM02A: jest.fn().mockResolvedValue({ id: 1, status: 'RETURNED' }),
        reviseBM02A: jest.fn().mockResolvedValue({ id: 1, status: 'REVISED' }),
        getBM02ARequestById: jest.fn().mockResolvedValue({ id: 1, proposedTitle: 'Title' }),
        getBM02ARequestsByRegistration: jest.fn().mockResolvedValue([]),
        getPendingBM02AQueue: jest.fn().mockResolvedValue([]),
        BM02AWorkflowError,
    };
});

jest.mock('../../src/services/bm03WorkflowService', () => {
    class BM03WorkflowError extends Error {
        constructor(message, statusCode = 400, code = 'WORKFLOW_ERROR') {
            super(message);
            this.statusCode = statusCode;
            this.code = code;
        }
    }
    return {
        createBM03Meeting: jest.fn().mockImplementation(({ advisorId }) => {
            if (Number(advisorId) !== 201) {
                const err = new BM03WorkflowError('Bạn không phải là GVHD của đề tài này.', 403, 'FORBIDDEN_RESOURCE');
                throw err;
            }
            return Promise.resolve({ id: 1 });
        }),
        signBM03Meeting: jest.fn().mockResolvedValue({ id: 1 }),
        submitStageEvaluation: jest.fn().mockResolvedValue({ id: 1 }),
        requestMoreInfoForStopReview: jest.fn().mockResolvedValue({ id: 1 }),
        decideStopReview: jest.fn().mockResolvedValue({ id: 1, status: 'DECIDED' }),
        advisorSignWholeBM03: jest.fn().mockResolvedValue({ id: 1 }),
        studentAcknowledgeBM03: jest.fn().mockImplementation(({ studentId }) => {
            if (Number(studentId) !== 101) {
                const err = new BM03WorkflowError('Bạn không phải là sinh viên sở hữu hồ sơ này.', 403, 'FORBIDDEN_RESOURCE');
                throw err;
            }
            return Promise.resolve({ id: 1, acknowledged: true });
        }),
        listStopReviews: jest.fn().mockResolvedValue([]),
        getBM03Record: jest.fn().mockImplementation(() => Promise.resolve({
            id: 1,
            registrationId: 100,
            effectiveTitleSnapshot: 'Nghien cuu he thong AI',
            registration: {
                id: 100,
                studentId: 101,
                defenseCouncilId: 50,
                topic: { mentorId: 201 },
            },
        })),
        getOrCreateBM03Record: jest.fn().mockResolvedValue({ id: 1 }),
        BM03WorkflowError,
    };
});

jest.mock('../../src/services/bm04WorkflowService', () => {
    class BM04WorkflowError extends Error {
        constructor(message, statusCode = 400, code = 'WORKFLOW_ERROR') {
            super(message);
            this.statusCode = statusCode;
            this.code = code;
        }
    }
    return {
        getBM04Record: jest.fn().mockImplementation(() => Promise.resolve({
            id: 1,
            registrationId: 100,
            status: 'DRAFT',
            isLocked: false,
            effectiveTitleSnapshot: 'Nghien cuu he thong AI',
            registration: {
                id: 100,
                studentId: 101,
                defenseCouncilId: 50,
                topic: { mentorId: 201 },
            },
        })),
        saveBM04Draft: jest.fn().mockImplementation(({ advisorId }) => {
            if (advisorId && Number(advisorId) !== 201) {
                const err = new BM04WorkflowError('Bạn không phải là GVHD của đề tài này.', 403, 'FORBIDDEN_RESOURCE');
                throw err;
            }
            return Promise.resolve({ id: 1, status: 'DRAFT' });
        }),
        signAndSubmitBM04: jest.fn().mockImplementation(({ advisorId }) => {
            if (advisorId && Number(advisorId) !== 201) {
                const err = new BM04WorkflowError('Bạn không phải là GVHD của đề tài này.', 403, 'FORBIDDEN_RESOURCE');
                throw err;
            }
            return Promise.resolve({ id: 1, status: 'SUBMITTED' });
        }),
        requestMoreInfoForDefenseReview: jest.fn().mockResolvedValue({ id: 1 }),
        decideDefenseReview: jest.fn().mockResolvedValue({ id: 1, status: 'APPROVED' }),
        listDefenseReviews: jest.fn().mockResolvedValue([]),
        BM04WorkflowError,
    };
});

jest.mock('../../src/services/titleAdjustmentAppendixService', () => ({
    createAppendixDraft: jest.fn().mockResolvedValue({ id: 1, status: 'DRAFT' }),
    updateAppendixItems: jest.fn().mockResolvedValue({ id: 1, items: [] }),
    issueAppendix: jest.fn().mockResolvedValue({ id: 1, status: 'ISSUED' }),
    getAppendixById: jest.fn().mockResolvedValue({ id: 1 }),
    getAppendicesByDecision: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/services/outlineReviewService', () => ({
    publishCouncilSchedule: jest.fn().mockResolvedValue({ id: 50, status: 'SCHEDULED' }),
    saveDraftResults: jest.fn().mockResolvedValue({ id: 50, draftSaved: true }),
    completeSecretaryReview: jest.fn().mockResolvedValue({ id: 50, completed: true }),
    returnResultsToSecretary: jest.fn().mockResolvedValue({ id: 50, returned: true }),
    publishCouncilResults: jest.fn().mockResolvedValue({ id: 50, published: true }),
}));

jest.mock('../../src/services/defenseScoringService', () => ({
    lockMemberScoreSheet: jest.fn().mockImplementation(({ evaluatorId }) => {
        if (![211, 212, 213].includes(evaluatorId)) {
            const err = new Error('Người chấm không thuộc hội đồng bảo vệ của đề tài này.');
            err.code = 'EVALUATOR_NOT_IN_COUNCIL';
            err.statusCode = 403;
            err.status = 403;
            throw err;
        }
        return Promise.resolve({ memberScoreId: 1, finalScore: 8.5, idempotent: false });
    }),
    lockDefenseScores: jest.fn().mockResolvedValue({ id: 1, isLocked: true }),
    lockDefenseScoreBookByChairman: jest.fn().mockResolvedValue({ id: 1, isLocked: true }),
    returnScoreBookBeforePublication: jest.fn().mockResolvedValue({ id: 1, isReturned: true }),
    markStudentAbsentByChairman: jest.fn().mockResolvedValue({ id: 1 }),
}));

jest.mock('../../src/services/defenseResultPublicationService', () => ({
    approveDefenseResult: jest.fn().mockResolvedValue({ id: 1, isApproved: true }),
    createResultPublication: jest.fn().mockResolvedValue({ id: 1, isPublished: true }),
    getEligibleApprovals: jest.fn().mockResolvedValue([]),
    listResultPublications: jest.fn().mockResolvedValue([]),
    getDefenseResultApproval: jest.fn().mockResolvedValue({ id: 1, outcome: 'PASSED' }),
    getStudentPublishedResult: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../src/services/archivalWorkflowService', () => ({
    reviewArchiveByMentor: jest.fn().mockImplementation(({ mentorId }) => {
        if (mentorId !== 201) {
            const err = new Error('Chỉ GVHD phụ trách mới có quyền đánh giá chuyên môn lưu chiểu.');
            err.code = 'FORBIDDEN_RESOURCE';
            err.status = 403;
            throw err;
        }
        return Promise.resolve({ id: 1, status: 'APPROVED', mentorReviewStatus: 'APPROVED' });
    }),
    reviewArchiveByAcademicAffairs: jest.fn().mockResolvedValue({ id: 1, status: 'APPROVED', academicAffairsReviewStatus: 'APPROVED' }),
    signClearanceCertificateByInstituteDirector: jest.fn().mockResolvedValue({
        id: 1,
        archive: { id: 1, certificateNumber: 'CERT-001' },
        registration: { id: 100 },
        signatureEvent: { id: 1 },
    }),
    mentorReviewArchive: jest.fn().mockResolvedValue({ id: 1, status: 'APPROVED' }),
    academicAffairsReviewArchive: jest.fn().mockResolvedValue({ id: 1, status: 'APPROVED' }),
    signClearanceCertificate: jest.fn().mockResolvedValue({ id: 1, certificateIssued: true }),
    getDefenseDossier: jest.fn().mockResolvedValue({ registrationId: 100, documents: [] }),
    submitPreDefenseArchive: jest.fn().mockResolvedValue({ id: 1, isPreDefense: true }),
    submitFinalArchive: jest.fn().mockResolvedValue({ id: 1, isFinal: true }),
    uploadDocumentVersion: jest.fn().mockResolvedValue({ id: 1 }),
    getAllArchives: jest.fn().mockResolvedValue([]),
    getHealthRadarStats: jest.fn().mockResolvedValue({}),
    getArchiveByRegistration: jest.fn().mockResolvedValue({ id: 1 }),
    getClearanceCertificate: jest.fn().mockResolvedValue({ id: 1 }),
    captureZeroHourSnapshot: jest.fn().mockResolvedValue({ id: 1 }),
    closeArchiveWindow: jest.fn().mockResolvedValue({ id: 1 }),
    runScheduledSweepJobs: jest.fn().mockResolvedValue({ success: true }),
}));

const app = require('../../src/app');
const express = require('express');
const { authenticate } = require('../../src/middlewares/auth');
const { authorizeScopedPermission } = require('../../src/middlewares/authorizeScopedPermission');

// Dedicated scope testing app for authoritative delegation verification
const testScopeApp = express();
testScopeApp.use(express.json());
testScopeApp.use(authenticate);
testScopeApp.get(
    '/api/test-scoped-topic/:id',
    authorizeScopedPermission({
        anyOf: ['TOPIC_REVIEW'],
        resourceType: 'TOPIC',
        idFromRequest: (req) => req.params.id,
    }),
    (req, res) => res.json({ success: true, resourceScope: req.resourceScope })
);

// =========================================================================
// PERSONA FACTORY & FIXTURES
// =========================================================================

function getGroupPermissions(groupCode) {
    if (groupCode === 'SYSTEM_STUDENT_BASE') {
        return [...STUDENT_BASE_PERMISSIONS];
    }
    const group = DEFAULT_GROUPS.find((g) => g.code === groupCode);
    return group ? [...group.permissions] : [];
}

function makePersonaUser({ id, role, groupCode, department = 'CNTT', councilMembers = [] }) {
    const permissions = getGroupPermissions(groupCode);
    return {
        id,
        role,
        department,
        email: `${groupCode.toLowerCase()}_${id}@university.edu.vn`,
        fullName: `User ${groupCode} ${id}`,
        code: `${role}-${id}`,
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [{
            permissionGroup: {
                code: groupCode,
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
        councilMembers,
    };
}

// 5 Standard Personas
const PERSONA_STUDENT = makePersonaUser({ id: 101, role: 'STUDENT', groupCode: 'SYSTEM_STUDENT_BASE' });
const PERSONA_OTHER_STUDENT = makePersonaUser({ id: 102, role: 'STUDENT', groupCode: 'SYSTEM_STUDENT_BASE' });
const PERSONA_GVHD = makePersonaUser({ id: 201, role: 'LECTURER', groupCode: 'GVHD' });
const PERSONA_UNASSIGNED_GVHD = makePersonaUser({ id: 202, role: 'LECTURER', groupCode: 'GVHD' });
const PERSONA_GIAO_VU = makePersonaUser({ id: 301, role: 'LECTURER', groupCode: 'GIAO_VU' });
const PERSONA_VIEN_TRUONG = makePersonaUser({ id: 401, role: 'LECTURER', groupCode: 'VIEN_TRUONG' });
const PERSONA_QUAN_TRI_VIEN = makePersonaUser({ id: 501, role: 'ADMIN', groupCode: 'QUAN_TRI_VIEN' });

// Council Persona Members for Council 50
const COUNCIL_CHAIRMAN = makePersonaUser({
    id: 211,
    role: 'LECTURER',
    groupCode: 'GVHD',
    councilMembers: [{ id: 51, councilId: 50, lecturerId: 211, roleInCouncil: 'CHAIRMAN', isActive: true }],
});
const COUNCIL_SECRETARY = makePersonaUser({
    id: 212,
    role: 'LECTURER',
    groupCode: 'GVHD',
    councilMembers: [{ id: 52, councilId: 50, lecturerId: 212, roleInCouncil: 'SECRETARY', isActive: true }],
});
const COUNCIL_MEMBER = makePersonaUser({
    id: 213,
    role: 'LECTURER',
    groupCode: 'GVHD',
    councilMembers: [{ id: 53, councilId: 50, lecturerId: 213, roleInCouncil: 'MEMBER', isActive: true }],
});
const COUNCIL_OUTSIDER = makePersonaUser({
    id: 214,
    role: 'LECTURER',
    groupCode: 'GVHD',
    councilMembers: [],
});

const ALL_PERSONAS = [
    PERSONA_STUDENT,
    PERSONA_OTHER_STUDENT,
    PERSONA_GVHD,
    PERSONA_UNASSIGNED_GVHD,
    PERSONA_GIAO_VU,
    PERSONA_VIEN_TRUONG,
    PERSONA_QUAN_TRI_VIEN,
    COUNCIL_CHAIRMAN,
    COUNCIL_SECRETARY,
    COUNCIL_MEMBER,
    COUNCIL_OUTSIDER,
];

// Standard Registration 100 owned by Student 101, mentored by GVHD 201, defense council 50
const SAMPLE_REGISTRATION_100 = {
    id: 100,
    studentId: 101,
    semesterId: 1,
    defenseCouncilId: 50,
    councilId: null,
    status: 'DEFENSE_READY',
    student: { id: 101, fullName: 'Sinh Vien 101', code: 'SV101' },
    topic: {
        id: 1,
        title: 'Nghien cuu he thong AI',
        mentorId: 201,
        mentor: { id: 201, fullName: 'GVHD 201', department: 'CNTT' },
        proposedById: 201,
        proposedBy: { id: 201, department: 'CNTT' },
        semesterId: 1,
    },
    defenseCouncil: {
        id: 50,
        councilType: 'DEFENSE_COUNCIL',
        members: [
            { id: 51, lecturerId: 211, roleInCouncil: 'CHAIRMAN', isActive: true },
            { id: 52, lecturerId: 212, roleInCouncil: 'SECRETARY', isActive: true },
            { id: 53, lecturerId: 213, roleInCouncil: 'MEMBER', isActive: true },
        ],
    },
};

const SAMPLE_COUNCIL_50 = {
    id: 50,
    name: 'Hoi dong Bao ve CNTT 01',
    councilType: 'DEFENSE_COUNCIL',
    members: [
        { id: 51, lecturerId: 211, roleInCouncil: 'CHAIRMAN', isActive: true },
        { id: 52, lecturerId: 212, roleInCouncil: 'SECRETARY', isActive: true },
        { id: 53, lecturerId: 213, roleInCouncil: 'MEMBER', isActive: true },
    ],
};

const SAMPLE_BM03_RECORD_100 = {
    id: 1,
    registrationId: 100,
    effectiveTitleSnapshot: 'Nghien cuu he thong AI',
    registration: SAMPLE_REGISTRATION_100,
    meetings: [],
    stageEvaluations: [],
    stopReviews: [],
};

const SAMPLE_BM04_RECORD_100 = {
    id: 1,
    registrationId: 100,
    status: 'DRAFT',
    isLocked: false,
    effectiveTitleSnapshot: 'Nghien cuu he thong AI',
    registration: SAMPLE_REGISTRATION_100,
    instituteDefenseReview: null,
};

describe('Five-Persona Authorization Matrix (Task 10)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'matrix-test-secret';

        jwt.verify.mockImplementation((token) => {
            const user = ALL_PERSONAS.find((p) => token === `token-${p.id}`);
            if (user) {
                return { userId: user.id, role: user.role, permissionVersion: user.permissionVersion };
            }
            throw new Error('Invalid token');
        });

        mockUser.findUnique.mockImplementation(({ where }) => {
            const user = ALL_PERSONAS.find((p) => p.id === where.id);
            return Promise.resolve(user || null);
        });

        mockTopicRegistration.findUnique.mockResolvedValue(SAMPLE_REGISTRATION_100);
        mockTopicRegistration.findFirst.mockResolvedValue(SAMPLE_REGISTRATION_100);
        mockCouncil.findUnique.mockResolvedValue(SAMPLE_COUNCIL_50);
        mockBM03ProgressRecord.findUnique.mockResolvedValue(SAMPLE_BM03_RECORD_100);
        mockBM03ProgressRecord.findFirst.mockResolvedValue(SAMPLE_BM03_RECORD_100);
        mockBM04Evaluation.findUnique.mockResolvedValue(SAMPLE_BM04_RECORD_100);
        mockBM04Evaluation.findFirst.mockResolvedValue(SAMPLE_BM04_RECORD_100);

        mockCouncilMember.findFirst.mockImplementation(({ where }) => {
            const { councilId, lecturerId } = where;
            const council = SAMPLE_COUNCIL_50;
            if (council.id === councilId) {
                const member = council.members.find((m) => m.lecturerId === lecturerId);
                return Promise.resolve(member || null);
            }
            return Promise.resolve(null);
        });
    });

    const bearer = (persona) => `Bearer token-${persona.id}`;

    // =========================================================================
    // SECTION 1: BASE CAPABILITIES & DIRECT API ACCESS MATRIX
    // =========================================================================
    describe('1. Base Capabilities & Direct API Access across 5 Personas', () => {
        it('GET /api/dashboard/stats: allowed for all personas with REPORT_VIEW, denied for STUDENT', async () => {
            const studentRes = await request(app).get('/api/dashboard/stats').set('Authorization', bearer(PERSONA_STUDENT));
            expect(studentRes.status).toBe(403);

            const gvhdRes = await request(app).get('/api/dashboard/stats').set('Authorization', bearer(PERSONA_GVHD));
            expect(gvhdRes.status).toBe(200);

            const giaoVuRes = await request(app).get('/api/dashboard/stats').set('Authorization', bearer(PERSONA_GIAO_VU));
            expect(giaoVuRes.status).toBe(200);

            const vienTruongRes = await request(app).get('/api/dashboard/stats').set('Authorization', bearer(PERSONA_VIEN_TRUONG));
            expect(vienTruongRes.status).toBe(200);

            const adminRes = await request(app).get('/api/dashboard/stats').set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN));
            expect(adminRes.status).toBe(200);
        });

        it('GET /api/dashboard/student: allowed ONLY for STUDENT, denied for all other personas', async () => {
            const studentRes = await request(app).get('/api/dashboard/student').set('Authorization', bearer(PERSONA_STUDENT));
            expect(studentRes.status).toBe(200);

            const gvhdRes = await request(app).get('/api/dashboard/student').set('Authorization', bearer(PERSONA_GVHD));
            expect(gvhdRes.status).toBe(403);

            const giaoVuRes = await request(app).get('/api/dashboard/student').set('Authorization', bearer(PERSONA_GIAO_VU));
            expect(giaoVuRes.status).toBe(403);

            const vienTruongRes = await request(app).get('/api/dashboard/student').set('Authorization', bearer(PERSONA_VIEN_TRUONG));
            expect(vienTruongRes.status).toBe(403);

            const adminRes = await request(app).get('/api/dashboard/student').set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN));
            expect(adminRes.status).toBe(403);
        });

        it('User Management (POST /api/users): allowed ONLY for QUAN_TRI_VIEN, denied for others', async () => {
            mockUser.create.mockResolvedValueOnce({ id: 999, email: 'newuser@tdmu.edu.vn' });

            const adminRes = await request(app)
                .post('/api/users')
                .set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN))
                .send({ email: 'newuser@tdmu.edu.vn', role: 'LECTURER', fullName: 'New Lecturer' });
            expect(adminRes.status).toBe(201);

            const studentRes = await request(app).post('/api/users').set('Authorization', bearer(PERSONA_STUDENT)).send({});
            expect(studentRes.status).toBe(403);

            const gvhdRes = await request(app).post('/api/users').set('Authorization', bearer(PERSONA_GVHD)).send({});
            expect(gvhdRes.status).toBe(403);

            const giaoVuRes = await request(app).post('/api/users').set('Authorization', bearer(PERSONA_GIAO_VU)).send({});
            expect(giaoVuRes.status).toBe(403);

            const vienTruongRes = await request(app).post('/api/users').set('Authorization', bearer(PERSONA_VIEN_TRUONG)).send({});
            expect(vienTruongRes.status).toBe(403);
        });

        it('Permission Group Management (POST /api/permissions/permission-groups): allowed ONLY for QUAN_TRI_VIEN', async () => {
            const adminRes = await request(app)
                .post('/api/permissions/permission-groups')
                .set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN))
                .send({ name: 'Special Group', code: 'SPEC_GRP', permissionCodes: ['VIEW_USERS'] });
            expect(adminRes.status).toBe(201);

            const vienTruongRes = await request(app)
                .post('/api/permissions/permission-groups')
                .set('Authorization', bearer(PERSONA_VIEN_TRUONG))
                .send({ name: 'Group', code: 'G' });
            expect(vienTruongRes.status).toBe(403);

            const giaoVuRes = await request(app)
                .post('/api/permissions/permission-groups')
                .set('Authorization', bearer(PERSONA_GIAO_VU))
                .send({});
            expect(giaoVuRes.status).toBe(403);

            const gvhdRes = await request(app)
                .post('/api/permissions/permission-groups')
                .set('Authorization', bearer(PERSONA_GVHD))
                .send({});
            expect(gvhdRes.status).toBe(403);
        });

        it('Academic Delegation Management (POST /api/delegations): allowed for VIEN_TRUONG, denied for QUAN_TRI_VIEN (no technical admin bypass)', async () => {
            const vienTruongRes = await request(app)
                .post('/api/delegations')
                .set('Authorization', bearer(PERSONA_VIEN_TRUONG))
                .set('Idempotency-Key', 'idemp-del-01')
                .send({
                    delegateeId: PERSONA_GVHD.id,
                    capabilityCode: 'OUTLINE_REVIEW',
                    department: 'CNTT',
                    semesterId: 1,
                    effectiveFrom: new Date().toISOString(),
                    effectiveTo: new Date(Date.now() + 86400000).toISOString(),
                    reason: 'Uy quyen chuyen mon tham dinh de cuong',
                });
            expect(vienTruongRes.status).toBe(201);

            // Technical admin must NOT have academic assignment authority
            const adminRes = await request(app)
                .post('/api/delegations')
                .set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN))
                .set('Idempotency-Key', 'idemp-del-02')
                .send({
                    delegateeId: PERSONA_GVHD.id,
                    capabilityCode: 'OUTLINE_REVIEW',
                    reason: 'Admin can thiep hoc thuat',
                });
            expect(adminRes.status).toBe(403);

            const giaoVuRes = await request(app)
                .post('/api/delegations')
                .set('Authorization', bearer(PERSONA_GIAO_VU))
                .set('Idempotency-Key', 'idemp-del-03')
                .send({
                    delegateeId: PERSONA_GVHD.id,
                    capabilityCode: 'OUTLINE_REVIEW',
                    reason: 'Giao vu uy quyen',
                });
            expect(giaoVuRes.status).toBe(403);
        });
    });

    // =========================================================================
    // SECTION 2: STUDENT OWNERSHIP SCOPING
    // =========================================================================
    describe('2. Student Ownership Scoping (Owner Student vs Other Student)', () => {
        it('GET /api/bm03/:registrationId: allows owner student (101), denies other student (102)', async () => {
            const ownerRes = await request(app)
                .get('/api/bm03/100')
                .set('Authorization', bearer(PERSONA_STUDENT));
            expect(ownerRes.status).toBe(200);

            const otherStudentRes = await request(app)
                .get('/api/bm03/100')
                .set('Authorization', bearer(PERSONA_OTHER_STUDENT));
            expect(otherStudentRes.status).toBe(403);
            expect(otherStudentRes.body.code).toBe('FORBIDDEN_RESOURCE');
        });

        it('GET /api/bm04/:registrationId: allows owner student (101), denies other student (102)', async () => {
            const ownerRes = await request(app)
                .get('/api/bm04/100')
                .set('Authorization', bearer(PERSONA_STUDENT));
            expect(ownerRes.status).toBe(200);

            const otherStudentRes = await request(app)
                .get('/api/bm04/100')
                .set('Authorization', bearer(PERSONA_OTHER_STUDENT));
            expect(otherStudentRes.status).toBe(403);
            expect(otherStudentRes.body.code).toBe('FORBIDDEN_RESOURCE');
        });

        it('GET /api/archives/registrations/:registrationId/dossier: allows owner student, denies other student', async () => {
            const ownerRes = await request(app)
                .get('/api/archives/registrations/100/dossier')
                .set('Authorization', bearer(PERSONA_STUDENT));
            expect(ownerRes.status).toBe(200);

            const otherStudentRes = await request(app)
                .get('/api/archives/registrations/100/dossier')
                .set('Authorization', bearer(PERSONA_OTHER_STUDENT));
            expect(otherStudentRes.status).toBe(403);
            expect(['FORBIDDEN_RESOURCE', 'FORBIDDEN_DOSSIER_ACCESS']).toContain(otherStudentRes.body.code);
        });
    });

    // =========================================================================
    // SECTION 3: MENTOR ASSIGNMENT SCOPING
    // =========================================================================
    describe('3. Mentor Assignment Scoping (Assigned GVHD vs Unassigned GVHD)', () => {
        it('GET /api/bm03/:registrationId: allows assigned mentor (201), denies unassigned lecturer (202)', async () => {
            const assignedRes = await request(app)
                .get('/api/bm03/100')
                .set('Authorization', bearer(PERSONA_GVHD));
            expect(assignedRes.status).toBe(200);

            const unassignedRes = await request(app)
                .get('/api/bm03/100')
                .set('Authorization', bearer(PERSONA_UNASSIGNED_GVHD));
            expect(unassignedRes.status).toBe(403);
            expect(unassignedRes.body.code).toBe('FORBIDDEN_RESOURCE');
        });

        it('GET /api/bm04/:registrationId: allows assigned mentor (201), denies unassigned lecturer (202)', async () => {
            const assignedRes = await request(app)
                .get('/api/bm04/100')
                .set('Authorization', bearer(PERSONA_GVHD));
            expect(assignedRes.status).toBe(200);

            const unassignedRes = await request(app)
                .get('/api/bm04/100')
                .set('Authorization', bearer(PERSONA_UNASSIGNED_GVHD));
            expect(unassignedRes.status).toBe(403);
            expect(unassignedRes.body.code).toBe('FORBIDDEN_RESOURCE');
        });

        it('POST /api/archives/registrations/:registrationId/mentor-review: allows assigned mentor, denies unassigned mentor', async () => {
            const assignedRes = await request(app)
                .post('/api/archives/registrations/100/mentor-review')
                .set('Authorization', bearer(PERSONA_GVHD))
                .send({ status: 'APPROVED', notes: 'Dat yeu cau' });
            expect(assignedRes.status).toBe(200);

            const unassignedRes = await request(app)
                .post('/api/archives/registrations/100/mentor-review')
                .set('Authorization', bearer(PERSONA_UNASSIGNED_GVHD))
                .send({ status: 'APPROVED' });
            expect(unassignedRes.status).toBe(403);
            expect(unassignedRes.body.code).toBe('FORBIDDEN_RESOURCE');
        });
    });

    // =========================================================================
    // SECTION 4: COUNCIL HIERARCHY & ROLES
    // =========================================================================
    describe('4. Council Hierarchy & Roles (CHAIRMAN vs SECRETARY vs MEMBER vs Outside Council)', () => {
        it('PUT /api/councils/:id/schedule: requires CHAIRMAN role; denies SECRETARY, MEMBER and Outside lecturer', async () => {
            const chairmanRes = await request(app)
                .put('/api/councils/50/schedule')
                .set('Authorization', bearer(COUNCIL_CHAIRMAN))
                .send({ defenseDate: '2026-12-01T08:00:00.000Z', meetingMode: 'OFFLINE' });
            expect(chairmanRes.status).toBe(200);

            const secretaryRes = await request(app)
                .put('/api/councils/50/schedule')
                .set('Authorization', bearer(COUNCIL_SECRETARY))
                .send({ defenseDate: '2026-12-01T08:00:00.000Z' });
            expect(secretaryRes.status).toBe(403);

            const memberRes = await request(app)
                .put('/api/councils/50/schedule')
                .set('Authorization', bearer(COUNCIL_MEMBER))
                .send({ defenseDate: '2026-12-01T08:00:00.000Z' });
            expect(memberRes.status).toBe(403);

            const outsiderRes = await request(app)
                .put('/api/councils/50/schedule')
                .set('Authorization', bearer(COUNCIL_OUTSIDER))
                .send({ defenseDate: '2026-12-01T08:00:00.000Z' });
            expect(outsiderRes.status).toBe(403);
        });

        it('PUT /api/councils/:id/results/:registrationId: allows SECRETARY and CHAIRMAN; denies MEMBER and Outside lecturer', async () => {
            const secretaryRes = await request(app)
                .put('/api/councils/50/results/100')
                .set('Authorization', bearer(COUNCIL_SECRETARY))
                .send({ initialOutcome: 'PASS', attendanceStatus: 'PRESENT' });
            expect(secretaryRes.status).toBe(200);

            const chairmanRes = await request(app)
                .put('/api/councils/50/results/100')
                .set('Authorization', bearer(COUNCIL_CHAIRMAN))
                .send({ initialOutcome: 'PASS', attendanceStatus: 'PRESENT' });
            expect(chairmanRes.status).toBe(200);

            const memberRes = await request(app)
                .put('/api/councils/50/results/100')
                .set('Authorization', bearer(COUNCIL_MEMBER))
                .send({ initialOutcome: 'PASS', attendanceStatus: 'PRESENT' });
            expect(memberRes.status).toBe(403);

            const outsiderRes = await request(app)
                .put('/api/councils/50/results/100')
                .set('Authorization', bearer(COUNCIL_OUTSIDER))
                .send({ initialOutcome: 'PASS', attendanceStatus: 'PRESENT' });
            expect(outsiderRes.status).toBe(403);
        });

        it('POST /api/evaluations/member-score/lock (BM05 scoring): allows council member, denies outside lecturer and QUAN_TRI_VIEN without role bypass', async () => {
            const memberRes = await request(app)
                .post('/api/evaluations/member-score/lock')
                .set('Authorization', bearer(COUNCIL_MEMBER))
                .set('Idempotency-Key', 'idemp-member-01')
                .send({ registrationId: 100, scores: [{ criterionCode: 'C1', score: 8.5 }] });
            expect(memberRes.status).toBe(200);

            const outsiderRes = await request(app)
                .post('/api/evaluations/member-score/lock')
                .set('Authorization', bearer(COUNCIL_OUTSIDER))
                .set('Idempotency-Key', 'idemp-outsider-01')
                .send({ registrationId: 100 });
            expect(outsiderRes.status).toBe(403);

            // Technical admin cannot submit scores without being in the council
            const adminRes = await request(app)
                .post('/api/evaluations/member-score/lock')
                .set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN))
                .set('Idempotency-Key', 'idemp-admin-01')
                .send({ registrationId: 100 });
            expect(adminRes.status).toBe(403);
        });
    });

    // =========================================================================
    // SECTION 5: DEPARTMENT & SEMESTER DELEGATION SCOPING
    // =========================================================================
    describe('5. Department & Semester Delegation Scoping', () => {
        it('honors scoped delegation when department and semester match; denies when mismatched', async () => {
            const delegatedLecturer = makePersonaUser({
                id: 299,
                role: 'LECTURER',
                groupCode: 'GVHD',
                department: 'CNTT',
            });
            ALL_PERSONAS.push(delegatedLecturer);

            // Active delegation for TOPIC_REVIEW in CNTT, Semester 1
            mockAcademicDelegation.findMany.mockResolvedValue([
                {
                    id: 99,
                    assigneeId: 299,
                    capabilityCode: 'TOPIC_REVIEW',
                    department: 'CNTT',
                    semesterId: 1,
                    status: 'ACTIVE',
                    expiresAt: new Date(Date.now() + 86400000),
                },
            ]);

            // 1. Matching CNTT and Semester 1: topic 1
            // 2. Mismatched Department (KTPM): topic 2
            // 3. Mismatched Semester 2: topic 3
            mockTopic.findUnique.mockImplementation(({ where }) => {
                if (where.id === 2) {
                    return Promise.resolve({
                        id: 2,
                        semesterId: 1,
                        mentorId: 205,
                        proposedById: 205,
                        mentor: { id: 205, department: 'KTPM' },
                        proposedBy: { id: 205, department: 'KTPM' },
                    });
                }
                if (where.id === 3) {
                    return Promise.resolve({
                        id: 3,
                        semesterId: 2, // Mismatched semester
                        mentorId: 201,
                        proposedById: 201,
                        mentor: { id: 201, department: 'CNTT' },
                        proposedBy: { id: 201, department: 'CNTT' },
                    });
                }
                return Promise.resolve({
                    id: 1,
                    semesterId: 1,
                    mentorId: 201,
                    proposedById: 201,
                    mentor: { id: 201, department: 'CNTT' },
                    proposedBy: { id: 201, department: 'CNTT' },
                });
            });

            // Scoped check via testScopeApp using authorizeScopedPermission
            const matchingRes = await request(testScopeApp)
                .get('/api/test-scoped-topic/1')
                .set('Authorization', bearer(delegatedLecturer));
            expect(matchingRes.status).toBe(200);
            expect(matchingRes.body.resourceScope.semesterId).toBe(1);
            expect(matchingRes.body.resourceScope.department).toBe('CNTT');

            // Mismatched department KTPM must fail with 403
            const wrongDeptRes = await request(testScopeApp)
                .get('/api/test-scoped-topic/2')
                .set('Authorization', bearer(delegatedLecturer));
            expect(wrongDeptRes.status).toBe(403);
            expect(wrongDeptRes.body.error).toBe('DELEGATION_SCOPE_FORBIDDEN');

            // Mismatched semester 2 must fail with 403
            const wrongSemesterRes = await request(testScopeApp)
                .get('/api/test-scoped-topic/3')
                .set('Authorization', bearer(delegatedLecturer));
            expect(wrongSemesterRes.status).toBe(403);
            expect(wrongSemesterRes.body.error).toBe('DELEGATION_SCOPE_FORBIDDEN');
        });
    });

    // =========================================================================
    // SECTION 6: ACADEMIC FORMS WORKFLOWS (BM02-A, BM03, BM04, BM05)
    // =========================================================================
    describe('6. Academic Forms Workflows (BM02-A, BM03, BM04, BM05)', () => {
        describe('BM02-A: Adjustment and Appendix Issuance', () => {
            it('POST /api/bm02a/requests/:id/student-sign-submit: allowed for STUDENT, denied for GVHD and ADMIN', async () => {
                const studentRes = await request(app)
                    .post('/api/bm02a/requests/1/student-sign-submit')
                    .set('Authorization', bearer(PERSONA_STUDENT))
                    .send({ payloadHash: 'hash-1', signatureImageId: 1 });
                expect(studentRes.status).toBe(200);

                const gvhdRes = await request(app)
                    .post('/api/bm02a/requests/1/student-sign-submit')
                    .set('Authorization', bearer(PERSONA_GVHD))
                    .send({ payloadHash: 'hash-1', signatureImageId: 1 });
                expect(gvhdRes.status).toBe(403);

                const adminRes = await request(app)
                    .post('/api/bm02a/requests/1/student-sign-submit')
                    .set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN))
                    .send({ payloadHash: 'hash-1', signatureImageId: 1 });
                expect(adminRes.status).toBe(403);
            });

            it('POST /api/bm02a/requests/:id/advisor-sign: allowed for GVHD, denied for STUDENT and ADMIN', async () => {
                const gvhdRes = await request(app)
                    .post('/api/bm02a/requests/1/advisor-sign')
                    .set('Authorization', bearer(PERSONA_GVHD))
                    .send({ payloadHash: 'hash-2', signatureImageId: 2 });
                expect(gvhdRes.status).toBe(200);

                const studentRes = await request(app)
                    .post('/api/bm02a/requests/1/advisor-sign')
                    .set('Authorization', bearer(PERSONA_STUDENT))
                    .send({ payloadHash: 'hash-2', signatureImageId: 2 });
                expect(studentRes.status).toBe(403);

                const adminRes = await request(app)
                    .post('/api/bm02a/requests/1/advisor-sign')
                    .set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN))
                    .send({ payloadHash: 'hash-2', signatureImageId: 2 });
                expect(adminRes.status).toBe(403);
            });

            it('POST /api/bm02a/requests/:id/department-sign: allowed for VIEN_TRUONG, denied for GVHD, GIAO_VU and QUAN_TRI_VIEN', async () => {
                const vienTruongRes = await request(app)
                    .post('/api/bm02a/requests/1/department-sign')
                    .set('Authorization', bearer(PERSONA_VIEN_TRUONG))
                    .send({ payloadHash: 'hash-3', signatureImageId: 3 });
                expect(vienTruongRes.status).toBe(200);

                const gvhdRes = await request(app)
                    .post('/api/bm02a/requests/1/department-sign')
                    .set('Authorization', bearer(PERSONA_GVHD))
                    .send({ payloadHash: 'hash-3', signatureImageId: 3 });
                expect(gvhdRes.status).toBe(403);

                const giaoVuRes = await request(app)
                    .post('/api/bm02a/requests/1/department-sign')
                    .set('Authorization', bearer(PERSONA_GIAO_VU))
                    .send({ payloadHash: 'hash-3', signatureImageId: 3 });
                expect(giaoVuRes.status).toBe(403);

                const adminRes = await request(app)
                    .post('/api/bm02a/requests/1/department-sign')
                    .set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN))
                    .send({ payloadHash: 'hash-3', signatureImageId: 3 });
                expect(adminRes.status).toBe(403);
            });

            it('POST /api/title-adjustment-appendices: allowed for GIAO_VU and VIEN_TRUONG, denied for normal GVHD and QUAN_TRI_VIEN', async () => {
                const giaoVuRes = await request(app)
                    .post('/api/title-adjustment-appendices')
                    .set('Authorization', bearer(PERSONA_GIAO_VU))
                    .send({ decisionId: 1, bm02aRequestIds: [1] });
                expect(giaoVuRes.status).toBe(201);

                const vienTruongRes = await request(app)
                    .post('/api/title-adjustment-appendices')
                    .set('Authorization', bearer(PERSONA_VIEN_TRUONG))
                    .send({ decisionId: 1, bm02aRequestIds: [1] });
                expect(vienTruongRes.status).toBe(201);

                const gvhdRes = await request(app)
                    .post('/api/title-adjustment-appendices')
                    .set('Authorization', bearer(PERSONA_GVHD))
                    .send({ decisionId: 1, bm02aRequestIds: [1] });
                expect(gvhdRes.status).toBe(403);

                const adminRes = await request(app)
                    .post('/api/title-adjustment-appendices')
                    .set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN))
                    .send({ decisionId: 1, bm02aRequestIds: [1] });
                expect(adminRes.status).toBe(403);
            });
        });

        describe('BM03 & BM04 Workflows', () => {
            it('BM03 meeting creation: allowed for assigned GVHD, denied for unassigned GVHD and STUDENT', async () => {
                const gvhdRes = await request(app)
                    .post('/api/bm03/100/meetings')
                    .set('Authorization', bearer(PERSONA_GVHD))
                    .send({ meetingDate: '2026-11-20', content: 'Thao luan tien do' });
                expect(gvhdRes.status).toBe(201);

                const unassignedRes = await request(app)
                    .post('/api/bm03/100/meetings')
                    .set('Authorization', bearer(PERSONA_UNASSIGNED_GVHD))
                    .send({ meetingDate: '2026-11-20' });
                expect(unassignedRes.status).toBe(403);

                const studentRes = await request(app)
                    .post('/api/bm03/100/meetings')
                    .set('Authorization', bearer(PERSONA_STUDENT))
                    .send({ meetingDate: '2026-11-20' });
                expect(studentRes.status).toBe(403);
            });

            it('BM03 student acknowledgement: allowed for owner STUDENT, denied for other student and GVHD', async () => {
                const studentRes = await request(app)
                    .post('/api/bm03/100/student-acknowledge')
                    .set('Authorization', bearer(PERSONA_STUDENT))
                    .send({ action: 'ACKNOWLEDGED' });
                expect(studentRes.status).toBe(200);

                const otherStudentRes = await request(app)
                    .post('/api/bm03/100/student-acknowledge')
                    .set('Authorization', bearer(PERSONA_OTHER_STUDENT))
                    .send({ action: 'ACKNOWLEDGED' });
                expect(otherStudentRes.status).toBe(403);

                const gvhdRes = await request(app)
                    .post('/api/bm03/100/student-acknowledge')
                    .set('Authorization', bearer(PERSONA_GVHD))
                    .send({ action: 'ACKNOWLEDGED' });
                expect(gvhdRes.status).toBe(403);
            });

            it('BM04 sign and submit: allowed for assigned GVHD, denied for STUDENT and QUAN_TRI_VIEN', async () => {
                const gvhdRes = await request(app)
                    .post('/api/bm04/100/sign-submit')
                    .set('Authorization', bearer(PERSONA_GVHD));
                expect(gvhdRes.status).toBe(200);

                const studentRes = await request(app)
                    .post('/api/bm04/100/sign-submit')
                    .set('Authorization', bearer(PERSONA_STUDENT));
                expect(studentRes.status).toBe(403);

                const adminRes = await request(app)
                    .post('/api/bm04/100/sign-submit')
                    .set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN));
                expect(adminRes.status).toBe(403);
            });

            it('BM04 defense rejection review decision: allowed for GIAO_VU and VIEN_TRUONG, denied for normal GVHD', async () => {
                const giaoVuRes = await request(app)
                    .post('/api/bm04/defense-reviews/1/decision')
                    .set('Authorization', bearer(PERSONA_GIAO_VU))
                    .send({ decision: 'ALLOW_DEFENSE', notes: 'Giai trinh hop ly' });
                expect(giaoVuRes.status).toBe(200);

                const vienTruongRes = await request(app)
                    .post('/api/bm04/defense-reviews/1/decision')
                    .set('Authorization', bearer(PERSONA_VIEN_TRUONG))
                    .send({ decision: 'ALLOW_DEFENSE' });
                expect(vienTruongRes.status).toBe(200);

                const gvhdRes = await request(app)
                    .post('/api/bm04/defense-reviews/1/decision')
                    .set('Authorization', bearer(PERSONA_GVHD))
                    .send({ decision: 'ALLOW_DEFENSE' });
                expect(gvhdRes.status).toBe(403);
            });
        });

        describe('Scorebook Return (DEFENSE_SCOREBOOK_RETURN)', () => {
            it('POST /api/evaluations/:registrationId/return-scorebook: allowed for GIAO_VU and VIEN_TRUONG, denied for GVHD and QUAN_TRI_VIEN', async () => {
                const giaoVuRes = await request(app)
                    .post('/api/evaluations/100/return-scorebook')
                    .set('Authorization', bearer(PERSONA_GIAO_VU))
                    .send({ reason: 'Sua diem thanh phan', reopenMemberScoreIds: [1] });
                expect(giaoVuRes.status).toBe(200);

                const vienTruongRes = await request(app)
                    .post('/api/evaluations/100/return-scorebook')
                    .set('Authorization', bearer(PERSONA_VIEN_TRUONG))
                    .send({ reason: 'Sua diem thanh phan', reopenMemberScoreIds: [1] });
                expect(vienTruongRes.status).toBe(200);

                const gvhdRes = await request(app)
                    .post('/api/evaluations/100/return-scorebook')
                    .set('Authorization', bearer(PERSONA_GVHD))
                    .send({ reason: 'Sua diem', reopenMemberScoreIds: [1] });
                expect(gvhdRes.status).toBe(403);

                const adminRes = await request(app)
                    .post('/api/evaluations/100/return-scorebook')
                    .set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN))
                    .send({ reason: 'Sua diem', reopenMemberScoreIds: [1] });
                expect(adminRes.status).toBe(403);
            });
        });
    });

    // =========================================================================
    // SECTION 7: DEFENSE RESULT PUBLICATION & TWO-STAGE ARCHIVAL
    // =========================================================================
    describe('7. Defense Result Publication & Two-Stage Archival', () => {
        it('Defense Result Approval (POST /api/evaluations/:id/approve-result): allowed ONLY for VIEN_TRUONG, denied for GIAO_VU, GVHD and QUAN_TRI_VIEN', async () => {
            const vienTruongRes = await request(app)
                .post('/api/evaluations/1/approve-result')
                .set('Authorization', bearer(PERSONA_VIEN_TRUONG))
                .send({ outcome: 'PASSED' });
            expect([200, 201]).toContain(vienTruongRes.status);

            const giaoVuRes = await request(app)
                .post('/api/evaluations/1/approve-result')
                .set('Authorization', bearer(PERSONA_GIAO_VU))
                .send({ outcome: 'PASSED' });
            expect(giaoVuRes.status).toBe(403);

            const gvhdRes = await request(app)
                .post('/api/evaluations/1/approve-result')
                .set('Authorization', bearer(PERSONA_GVHD))
                .send({ outcome: 'PASSED' });
            expect(gvhdRes.status).toBe(403);

            const adminRes = await request(app)
                .post('/api/evaluations/1/approve-result')
                .set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN))
                .send({ outcome: 'PASSED' });
            expect(adminRes.status).toBe(403);
        });

        it('Defense Result Publication (POST /api/evaluations/semesters/:semesterId/results/publish): allowed ONLY for VIEN_TRUONG', async () => {
            const vienTruongRes = await request(app)
                .post('/api/evaluations/semesters/1/results/publish')
                .set('Authorization', bearer(PERSONA_VIEN_TRUONG))
                .send({ type: 'INITIAL' });
            expect([200, 201]).toContain(vienTruongRes.status);

            const giaoVuRes = await request(app)
                .post('/api/evaluations/semesters/1/results/publish')
                .set('Authorization', bearer(PERSONA_GIAO_VU))
                .send({ type: 'INITIAL' });
            expect(giaoVuRes.status).toBe(403);

            const adminRes = await request(app)
                .post('/api/evaluations/semesters/1/results/publish')
                .set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN))
                .send({ type: 'INITIAL' });
            expect(adminRes.status).toBe(403);
        });

        it('Two-Stage Archival Review: Stage 1 (Mentor) vs Stage 2 (Academic Affairs) vs Clearance Signature', async () => {
            // Stage 1: Mentor Review - allowed for GVHD, denied for GIAO_VU
            const mentorReviewRes = await request(app)
                .post('/api/archives/registrations/100/mentor-review')
                .set('Authorization', bearer(PERSONA_GVHD))
                .send({ status: 'APPROVED', notes: 'Noi dung tot' });
            expect([200, 201]).toContain(mentorReviewRes.status);

            const giaoVuStage1Res = await request(app)
                .post('/api/archives/registrations/100/mentor-review')
                .set('Authorization', bearer(PERSONA_GIAO_VU))
                .send({ status: 'APPROVED' });
            expect(giaoVuStage1Res.status).toBe(403);

            // Stage 2: Academic Affairs Review - allowed for GIAO_VU, denied for GVHD
            const academicAffairsRes = await request(app)
                .post('/api/archives/registrations/100/academic-affairs-review')
                .set('Authorization', bearer(PERSONA_GIAO_VU))
                .send({ status: 'APPROVED', notes: 'Du thanh phan ho so' });
            expect([200, 201]).toContain(academicAffairsRes.status);

            const gvhdStage2Res = await request(app)
                .post('/api/archives/registrations/100/academic-affairs-review')
                .set('Authorization', bearer(PERSONA_GVHD))
                .send({ status: 'APPROVED' });
            expect(gvhdStage2Res.status).toBe(403);

            // Final Clearance Certificate Signature - allowed ONLY for VIEN_TRUONG
            const directorSignRes = await request(app)
                .post('/api/archives/registrations/100/sign-certificate')
                .set('Authorization', bearer(PERSONA_VIEN_TRUONG))
                .send({});
            expect([200, 201]).toContain(directorSignRes.status);

            const giaoVuSignRes = await request(app)
                .post('/api/archives/registrations/100/sign-certificate')
                .set('Authorization', bearer(PERSONA_GIAO_VU))
                .send({});
            expect(giaoVuSignRes.status).toBe(403);

            const adminSignRes = await request(app)
                .post('/api/archives/registrations/100/sign-certificate')
                .set('Authorization', bearer(PERSONA_QUAN_TRI_VIEN))
                .send({});
            expect(adminSignRes.status).toBe(403);
        });
    });
});
