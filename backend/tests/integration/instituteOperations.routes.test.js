const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockUser = {
    findUnique: jest.fn(),
};
const mockSemester = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
};
const mockTopicRegistration = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
};
const mockBM02Submission = {
    findMany: jest.fn(),
};
const mockInstituteStopReview = {
    findMany: jest.fn(),
};
const mockInstituteDefenseReview = {
    findMany: jest.fn(),
};
const mockCheckpointSignatureAppeal = {
    findMany: jest.fn(),
};
const mockTopicAssignmentDecision = {
    findMany: jest.fn(),
};
const mockTitleAdjustmentAppendix = {
    findMany: jest.fn(),
};
const mockBM02AAdjustmentRequest = {
    findMany: jest.fn(),
};
const mockProjectArchive = {
    findMany: jest.fn(),
};
const mockDefenseResultApproval = {
    findMany: jest.fn(),
};
const mockAcademicDelegation = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
};
const mockCouncilMember = {
    findFirst: jest.fn(),
};

const mockPrisma = {
    user: mockUser,
    semester: mockSemester,
    topicRegistration: mockTopicRegistration,
    bM02Submission: mockBM02Submission,
    instituteStopReview: mockInstituteStopReview,
    instituteDefenseReview: mockInstituteDefenseReview,
    checkpointSignatureAppeal: mockCheckpointSignatureAppeal,
    topicAssignmentDecision: mockTopicAssignmentDecision,
    titleAdjustmentAppendix: mockTitleAdjustmentAppendix,
    bM02AAdjustmentRequest: mockBM02AAdjustmentRequest,
    projectArchive: mockProjectArchive,
    defenseResultApproval: mockDefenseResultApproval,
    academicDelegation: mockAcademicDelegation,
    councilMember: mockCouncilMember,
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-token'),
}));

const app = require('../../src/app');
const { clearAuthCache } = require('../../src/auth/capabilityResolver');

function buildDbUser({ id, role = 'LECTURER', department = 'CNTT', permissions = [] }) {
    return {
        id,
        email: `user${id}@test.edu.vn`,
        fullName: `User ${id}`,
        code: `U${id}`,
        role,
        department,
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [
            {
                permissionGroup: {
                    code: `GRP_${id}`,
                    name: `Group ${id}`,
                    isSystem: false,
                    permissions: permissions.map((code) => ({
                        permission: { code },
                    })),
                },
            },
        ],
    };
}

function makeReg({ id, semesterId = 1, department = 'CNTT', status = 'BM02_SUBMITTED', mentorId = 999 }) {
    return {
        id,
        semesterId,
        status,
        student: { id: 500 + id, fullName: `SV ${id}`, code: `SV00${id}` },
        topic: {
            id: 600 + id,
            title: `Đề tài ${id}`,
            mentorId,
            mentor: { id: mentorId, fullName: 'GVHD', department },
            proposedBy: { id: mentorId, department },
        },
    };
}

describe('GET /api/institute/operations', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearAuthCache();

        mockAcademicDelegation.findMany.mockResolvedValue([]);
        mockAcademicDelegation.findFirst.mockResolvedValue(null);
        mockCouncilMember.findFirst.mockResolvedValue(null);

        mockSemester.findUnique.mockResolvedValue({
            id: 1,
            code: 'HK1-2026',
            name: 'Học kỳ 1 2026',
            status: 'ACTIVE',
            defenseEligibleListPublishedAt: null,
            lockedDefenseRubricVersion: {
                id: 10,
                lockedAt: new Date('2026-11-01T00:00:00Z'),
                totalMaxScore: 10.0,
            },
        });
        mockSemester.findFirst.mockResolvedValue({
            id: 1,
            code: 'HK1-2026',
            name: 'Học kỳ 1 2026',
            status: 'ACTIVE',
            defenseEligibleListPublishedAt: null,
            lockedDefenseRubricVersion: {
                id: 10,
                lockedAt: new Date('2026-11-01T00:00:00Z'),
                totalMaxScore: 10.0,
            },
        });

        mockBM02Submission.findMany.mockResolvedValue([]);
        mockInstituteStopReview.findMany.mockResolvedValue([]);
        mockInstituteDefenseReview.findMany.mockResolvedValue([]);
        mockCheckpointSignatureAppeal.findMany.mockResolvedValue([]);
        mockTopicAssignmentDecision.findMany.mockResolvedValue([]);
        mockTopicRegistration.findMany.mockResolvedValue([]);
        mockTopicRegistration.count.mockResolvedValue(0);
        mockTitleAdjustmentAppendix.findMany.mockResolvedValue([]);
        mockBM02AAdjustmentRequest.findMany.mockResolvedValue([]);
        mockProjectArchive.findMany.mockResolvedValue([]);
        mockDefenseResultApproval.findMany.mockResolvedValue([]);
    });

    test('returns 401 when unauthenticated', async () => {
        const res = await request(app).get('/api/institute/operations?tab=review');
        expect(res.status).toBe(401);
    });

    test('returns 400 for invalid tab, page, or semesterId', async () => {
        const user = buildDbUser({ id: 10, permissions: ['BM02_REVIEW'] });
        jwt.verify.mockReturnValue({ userId: 10, permissionVersion: 1 });
        mockUser.findUnique.mockResolvedValue(user);

        const badTab = await request(app)
            .get('/api/institute/operations?tab=badtab&semesterId=1')
            .set('Authorization', 'Bearer token');
        expect(badTab.status).toBe(400);

        const badPage = await request(app)
            .get('/api/institute/operations?tab=review&semesterId=1&page=0')
            .set('Authorization', 'Bearer token');
        expect(badPage.status).toBe(400);

        const badSemester = await request(app)
            .get('/api/institute/operations?tab=review&semesterId=abc')
            .set('Authorization', 'Bearer token');
        expect(badSemester.status).toBe(400);
    });

    test('returns 403 when user lacks tab capability (even ADMIN with VIEW_PROJECT_OVERSIGHT)', async () => {
        const user = buildDbUser({
            id: 11,
            role: 'ADMIN',
            permissions: ['VIEW_PROJECT_OVERSIGHT', 'PROJECT_OVERSIGHT_MANAGE'],
        });
        jwt.verify.mockReturnValue({ userId: 11, permissionVersion: 1 });
        mockUser.findUnique.mockResolvedValue(user);

        const res = await request(app)
            .get('/api/institute/operations?tab=review&semesterId=1')
            .set('Authorization', 'Bearer token');
        expect(res.status).toBe(403);
    });

    test('returns scoped review items with counts and view-only empty allowedActions', async () => {
        const regCNTT = makeReg({ id: 1, department: 'CNTT', status: 'BM02_SUBMITTED' });
        const regATTT = makeReg({ id: 2, department: 'ATTT', status: 'BM02_SUBMITTED' });

        mockTopicRegistration.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 1) return regCNTT;
            if (where.id === 2) return regATTT;
            return null;
        });

        mockBM02Submission.findMany.mockResolvedValue([
            {
                id: 100,
                registrationId: 1,
                attemptNo: 1,
                outcome: 'PENDING_REVIEW',
                revisionDeadlineAt: null,
                submittedAt: new Date('2026-11-10T00:00:00Z'),
                registration: regCNTT,
            },
            {
                id: 101,
                registrationId: 2,
                attemptNo: 1,
                outcome: 'PENDING_REVIEW',
                revisionDeadlineAt: null,
                submittedAt: new Date('2026-11-10T00:00:00Z'),
                registration: regATTT,
            },
        ]);

        // View-only user in CNTT
        const viewUser = buildDbUser({ id: 20, department: 'CNTT', permissions: ['VIEW_BM02_REVIEWS'] });
        jwt.verify.mockReturnValue({ userId: 20, permissionVersion: 1 });
        mockUser.findUnique.mockResolvedValue(viewUser);

        const viewRes = await request(app)
            .get('/api/institute/operations?tab=review&semesterId=1')
            .set('Authorization', 'Bearer token');

        expect(viewRes.status).toBe(200);
        expect(viewRes.body.success).toBe(true);
        expect(viewRes.body.data.counts.review).toBe(1);
        expect(viewRes.body.data.items).toHaveLength(1);
        expect(viewRes.body.data.items[0].registrationId).toBe(1);
        expect(viewRes.body.data.items[0].allowedActions).toEqual([]);

        // Action user in CNTT
        clearAuthCache();
        const actionUser = buildDbUser({ id: 21, department: 'CNTT', permissions: ['BM02_REVIEW'] });
        jwt.verify.mockReturnValue({ userId: 21, permissionVersion: 1 });
        mockUser.findUnique.mockResolvedValue(actionUser);

        const actionRes = await request(app)
            .get('/api/institute/operations?tab=review&semesterId=1')
            .set('Authorization', 'Bearer token');

        expect(actionRes.status).toBe(200);
        expect(actionRes.body.data.items[0].allowedActions).toEqual([
            'APPROVE_BM02',
            'REQUEST_BM02_REVISION',
            'MARK_BM02_EXCEPTION',
        ]);
    });

    test('returns decisions and publish tabs with proper scoping and no BM05 score leak', async () => {
        const reg = makeReg({ id: 30, department: 'CNTT', status: 'BM02_APPROVED' });
        mockTopicRegistration.findUnique.mockResolvedValue(reg);
        mockTopicRegistration.findMany.mockImplementation(async ({ where }) => {
            if (where.status === 'BM02_APPROVED') {
                return [{ ...reg, topicAssignmentDecisionItem: null }];
            }
            return [];
        });
        mockTopicRegistration.count.mockResolvedValue(3);

        const director = buildDbUser({
            id: 30,
            department: 'CNTT',
            permissions: ['PROJECT_ASSIGNMENT_PUBLISH', 'DEFENSE_COUNCIL_MANAGE', 'RESULT_PUBLICATION_PUBLISH'],
        });
        jwt.verify.mockReturnValue({ userId: 30, permissionVersion: 1 });
        mockUser.findUnique.mockResolvedValue(director);

        const decisionsRes = await request(app)
            .get('/api/institute/operations?tab=decisions&semesterId=1')
            .set('Authorization', 'Bearer token');
        expect(decisionsRes.status).toBe(200);
        expect(decisionsRes.body.data.items).toHaveLength(1);
        expect(decisionsRes.body.data.items[0].allowedActions).toEqual(['ISSUE_TOPIC_DECISION']);

        const publishRes = await request(app)
            .get('/api/institute/operations?tab=publish&semesterId=1')
            .set('Authorization', 'Bearer token');
        expect(publishRes.status).toBe(200);
        expect(publishRes.body.data.items).toHaveLength(1);
        expect(publishRes.body.data.items[0].kind).toBe('DEFENSE_ELIGIBLE_LIST_PUBLICATION');
        expect(publishRes.body.data.items[0].allowedActions).toEqual(['PUBLISH_DEFENSE_ELIGIBLE_LIST']);
    });
});
