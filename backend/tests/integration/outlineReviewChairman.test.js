const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/config/database', () => ({
    user: { findUnique: jest.fn() },
    topicRegistration: { findUnique: jest.fn(), findMany: jest.fn() },
    notification: { create: jest.fn() },
}));

jest.mock('../../src/services/bm01WorkflowService', () => ({
    reviewBM01: jest.fn(),
    submitBM01Initial: jest.fn(),
    submitBM01Revision: jest.fn(),
}));

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

const prisma = require('../../src/config/database');
const { reviewBM01 } = require('../../src/services/bm01WorkflowService');
const app = require('../../src/app');

function makeUser(id, role, permissions = []) {
    return {
        id,
        role,
        email: `${role.toLowerCase()}_${id}@example.test`,
        fullName: `${role} User ${id}`,
        code: `${role}-${id}`,
        isActive: true,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                code: 'GROUP_' + id,
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
    };
}

describe('Council Chairman Outline Review BM01 (Task 10)', () => {
    const chairmanUser = makeUser(201, 'LECTURER', ['OUTLINE_REVIEW']);
    const secretaryUser = makeUser(202, 'LECTURER', ['OUTLINE_REVIEW']);
    const memberUser = makeUser(203, 'LECTURER', ['OUTLINE_REVIEW']);
    const outsiderLecturer = makeUser(204, 'LECTURER', ['OUTLINE_REVIEW']);
    const deanUser = makeUser(205, 'LECTURER', ['OUTLINE_APPROVE', 'OUTLINE_REVIEW']);
    const adminUser = makeUser(1, 'ADMIN', []);

    const sampleRegistration = {
        id: 101,
        studentId: 10,
        status: 'BM01_SUBMITTED',
        topic: { id: 5, title: 'Hệ thống Quản lý Khóa luận' },
        outlineCouncilId: 1,
        outlineCouncil: {
            id: 1,
            name: 'Hội đồng thẩm định đề cương số 1',
            members: [
                { id: 11, councilId: 1, lecturerId: 201, roleInCouncil: 'CHAIRMAN' },
                { id: 12, councilId: 1, lecturerId: 202, roleInCouncil: 'SECRETARY' },
                { id: 13, councilId: 1, lecturerId: 203, roleInCouncil: 'MEMBER' },
            ],
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-jwt-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'chairman-token') return { userId: 201, role: 'LECTURER' };
            if (token === 'secretary-token') return { userId: 202, role: 'LECTURER' };
            if (token === 'member-token') return { userId: 203, role: 'LECTURER' };
            if (token === 'outsider-token') return { userId: 204, role: 'LECTURER' };
            if (token === 'dean-token') return { userId: 205, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 201) return chairmanUser;
            if (where.id === 202) return secretaryUser;
            if (where.id === 203) return memberUser;
            if (where.id === 204) return outsiderLecturer;
            if (where.id === 205) return deanUser;
            if (where.id === 1) return adminUser;
            return null;
        });

        prisma.topicRegistration.findUnique.mockResolvedValue(sampleRegistration);
    });

    it('should allow Council CHAIRMAN to update outline review', async () => {
        reviewBM01.mockResolvedValue({
            evaluation: { id: 501, attemptNo: 1, outcome: 'PASSED' },
            targetStatus: 'BM01_PASSED',
            idempotent: false,
        });

        const res = await request(app)
            .patch('/api/registrations/101/outline-review')
            .set('Authorization', 'Bearer chairman-token')
            .set('Idempotency-Key', 'chairman-review-passed-001')
            .send({ status: 'PASSED', feedback: 'Đề cương tốt, đạt yêu cầu.' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(reviewBM01).toHaveBeenCalledWith(expect.objectContaining({
            registrationId: 101,
            reviewerId: 201,
            attemptNo: 1,
            outcome: 'PASSED',
            feedback: 'Đề cương tốt, đạt yêu cầu.',
        }));
    });

    it('should allow Council CHAIRMAN to request outline revision via PUT endpoint', async () => {
        reviewBM01.mockResolvedValue({
            evaluation: { id: 502, attemptNo: 1, outcome: 'NEEDS_REVISION' },
            targetStatus: 'BM01_NEEDS_REVISION',
            idempotent: false,
        });

        const res = await request(app)
            .put('/api/registrations/101/outline-review')
            .set('Authorization', 'Bearer chairman-token')
            .set('Idempotency-Key', 'chairman-review-revision-001')
            .send({ status: 'REVISION_REQUIRED', feedback: 'Cần bổ sung sơ đồ kiến trúc hệ thống.' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(reviewBM01).toHaveBeenCalledWith(expect.objectContaining({
            registrationId: 101,
            reviewerId: 201,
            attemptNo: 1,
            outcome: 'NEEDS_REVISION',
            feedback: 'Cần bổ sung sơ đồ kiến trúc hệ thống.',
        }));
    });

    it('should forbid non-chairman council member from updating outline review with 403', async () => {
        const secretaryRes = await request(app)
            .patch('/api/registrations/101/outline-review')
            .set('Authorization', 'Bearer secretary-token')
            .set('Idempotency-Key', 'secretary-attempt-001')
            .send({ status: 'PASSED' });

        expect(secretaryRes.status).toBe(403);
        expect(secretaryRes.body.code).toBe('ONLY_CHAIRMAN_CAN_APPROVE_OUTLINE');
        expect(secretaryRes.body.message).toContain('Chỉ Chủ tịch Hội đồng thẩm định đề cương mới có quyền');

        const memberRes = await request(app)
            .patch('/api/registrations/101/outline-review')
            .set('Authorization', 'Bearer member-token')
            .set('Idempotency-Key', 'member-attempt-001')
            .send({ status: 'PASSED' });

        expect(memberRes.status).toBe(403);
        expect(memberRes.body.code).toBe('ONLY_CHAIRMAN_CAN_APPROVE_OUTLINE');
        expect(reviewBM01).not.toHaveBeenCalled();
    });

    it('should forbid lecturer not belonging to council with 403', async () => {
        const res = await request(app)
            .patch('/api/registrations/101/outline-review')
            .set('Authorization', 'Bearer outsider-token')
            .set('Idempotency-Key', 'outsider-attempt-001')
            .send({ status: 'PASSED' });

        expect(res.status).toBe(403);
        expect(reviewBM01).not.toHaveBeenCalled();
    });

    it('should forbid technical admin without council assignment or capability with 403', async () => {
        const res = await request(app)
            .patch('/api/registrations/101/outline-review')
            .set('Authorization', 'Bearer admin-token')
            .set('Idempotency-Key', 'admin-attempt-001')
            .send({ status: 'PASSED' });

        expect(res.status).toBe(403);
        expect(reviewBM01).not.toHaveBeenCalled();
    });

    it('should allow user with OUTLINE_APPROVE capability even if not in council', async () => {
        reviewBM01.mockResolvedValue({
            evaluation: { id: 503, attemptNo: 1, outcome: 'PASSED' },
            targetStatus: 'BM01_PASSED',
            idempotent: false,
        });

        const res = await request(app)
            .patch('/api/registrations/101/outline-review')
            .set('Authorization', 'Bearer dean-token')
            .set('Idempotency-Key', 'dean-review-001')
            .send({ status: 'PASSED' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(reviewBM01).toHaveBeenCalled();
    });
});
