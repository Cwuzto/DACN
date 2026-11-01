jest.mock('../../src/config/database', () => ({
    user: { findUnique: jest.fn() },
    topicRegistration: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
}));

jest.mock('../../src/services/bm01WorkflowService', () => ({
    reviewBM01: jest.fn(),
    submitBM01Initial: jest.fn(),
    submitBM01Revision: jest.fn(),
}));

jest.mock('../../src/services/bm02ReviewService', () => ({
    reviewBM02: jest.fn(),
}));

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const { reviewBM01, submitBM01Revision } = require('../../src/services/bm01WorkflowService');
const { reviewBM02 } = require('../../src/services/bm02ReviewService');
const app = require('../../src/app');

function user(id, role) {
    const permissions = role === 'LECTURER' ? ['OUTLINE_REVIEW'] : [];
    return {
        id,
        role,
        email: `${role.toLowerCase()}@example.test`,
        fullName: role,
        code: `${role}-${id}`,
        isActive: true,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                code: 'GVHD',
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
    };
}

describe('Integration - BM01 workflow routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'bm01-routes-secret';
        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'mentor-token') return { userId: 20, role: 'LECTURER' };
            if (token === 'lecturer-token') return { userId: 21, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });
        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 10) return user(10, 'STUDENT');
            if (where.id === 20) return user(20, 'LECTURER');
            if (where.id === 21) return user(21, 'LECTURER');
            if (where.id === 1) return user(1, 'ADMIN');
            return null;
        });
    });

    test('technical admin cannot perform the second academic review', async () => {
        const response = await request(app)
            .post('/api/evaluations/bm01-gvhd-approve/41')
            .set('Authorization', 'Bearer admin-token')
            .set('Idempotency-Key', 'bm01-admin-denied-0001')
            .send({ outcome: 'PASSED' });

        expect(response.status).toBe(403);
        expect(reviewBM01).not.toHaveBeenCalled();
    });

    test('only the current mentor can perform the second academic review', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 41,
            studentId: 10,
            topic: { id: 5, title: 'Đề tài', mentorId: 20 },
            student: { id: 10, fullName: 'Sinh viên' },
        });

        const denied = await request(app)
            .post('/api/evaluations/bm01-gvhd-approve/41')
            .set('Authorization', 'Bearer lecturer-token')
            .set('Idempotency-Key', 'bm01-wrong-mentor-0001')
            .send({ outcome: 'PASSED' });
        expect(denied.status).toBe(403);

        reviewBM01.mockResolvedValue({
            evaluation: { id: 202, attemptNo: 2 },
            targetStatus: 'TERMINATED_BM01',
            idempotent: true,
        });
        const allowed = await request(app)
            .post('/api/evaluations/bm01-gvhd-approve/41')
            .set('Authorization', 'Bearer mentor-token')
            .set('Idempotency-Key', 'bm01-current-mentor-0001')
            .send({ outcome: 'NEEDS_REVISION', feedback: 'Không đạt lần hai' });

        expect(allowed.status).toBe(200);
        expect(reviewBM01).toHaveBeenCalledWith(expect.objectContaining({
            reviewerId: 20,
            attemptNo: 2,
            outcome: 'NEEDS_REVISION',
            idempotencyKey: 'bm01-current-mentor-0001',
        }));
    });

    test('student revision forwards the idempotency key to the domain command', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 41,
            studentId: 10,
            topic: { id: 5, title: 'Đề tài', mentorId: 20 },
            student: { id: 10, fullName: 'Sinh viên' },
        });
        submitBM01Revision.mockResolvedValue({
            submission: { id: 401 },
            evaluation: { id: 202, attemptNo: 2 },
            idempotent: true,
        });

        const response = await request(app)
            .post('/api/evaluations/bm01-resubmit/41')
            .set('Authorization', 'Bearer student-token')
            .set('Idempotency-Key', 'bm01-student-submit-0001')
            .send({ content: 'Bản chỉnh sửa' });

        expect(response.status).toBe(200);
        expect(submitBM01Revision).toHaveBeenCalledWith(expect.objectContaining({
            registrationId: 41,
            studentId: 10,
            idempotencyKey: 'bm01-student-submit-0001',
        }));
    });

    test('technical admin cannot submit the first council review', async () => {
        const response = await request(app)
            .patch('/api/registrations/41/outline-review')
            .set('Authorization', 'Bearer admin-token')
            .set('Idempotency-Key', 'bm01-admin-outline-0001')
            .send({ status: 'PASSED' });

        expect(response.status).toBe(403);
        expect(reviewBM01).not.toHaveBeenCalled();
    });

    test('BM02 review requires the dedicated institute capability', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 51,
            studentId: 10,
            topic: { title: 'Đề tài' },
        });

        const denied = await request(app)
            .post('/api/registrations/bm02/51/review')
            .set('Authorization', 'Bearer admin-token')
            .set('Idempotency-Key', 'bm02-admin-denied-0001')
            .send({ action: 'APPROVE' });
        expect(denied.status).toBe(403);

        const instituteUser = user(21, 'LECTURER');
        instituteUser.permissionGroups = [{
            permissionGroup: {
                code: 'VIEN_TRUONG',
                permissions: [{ permission: { code: 'BM02_REVIEW' } }],
            },
        }];
        prisma.user.findUnique.mockResolvedValue(instituteUser);
        reviewBM02.mockResolvedValue({
            submission: { id: 301, outcome: 'APPROVED' },
            targetStatus: 'BM02_SUBMITTED',
            idempotent: true,
        });

        const allowed = await request(app)
            .post('/api/registrations/bm02/51/review')
            .set('Authorization', 'Bearer lecturer-token')
            .set('Idempotency-Key', 'bm02-institute-review-0001')
            .send({ action: 'APPROVE' });
        expect(allowed.status).toBe(200);
        expect(reviewBM02).toHaveBeenCalledWith(expect.objectContaining({
            registrationId: 51,
            reviewerId: 21,
            action: 'APPROVE',
        }));
    });
});
