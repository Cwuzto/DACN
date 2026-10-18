jest.mock('../../src/config/database', () => ({
    $transaction: jest.fn(),
    user: {
        findUnique: jest.fn(),
    },
    semester: {
        findFirst: jest.fn(),
    },
    rubricVersion: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
    },
    rubricCategory: {
        deleteMany: jest.fn(),
    },
    defenseMemberScore: {
        count: jest.fn(),
    },
    defenseResult: {
        count: jest.fn(),
    },
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Integration - Rubric Management Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'lecturer-token') return { userId: 2, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 1) return { id: 1, email: 'admin@dacn.edu.vn', role: 'ADMIN', isActive: true };
            if (where.id === 2) return { id: 2, email: 'lecturer@dacn.edu.vn', role: 'LECTURER', isActive: true };
            if (where.id === 10) return { id: 10, email: 'student@dacn.edu.vn', role: 'STUDENT', isActive: true };
            return null;
        });

        // Mặc định hệ thống chưa vào đợt (UPCOMING)
        prisma.semester.findFirst.mockResolvedValue(null);
    });

    test('GET /api/v1/rubrics/active trả về phiên bản active hiện tại', async () => {
        prisma.rubricVersion.findFirst.mockResolvedValue({
            id: 1,
            version: 'v1',
            title: 'Barem chuẩn v1',
            totalMaxScore: 10.0,
            status: 'ACTIVE',
            isActive: true,
            categories: [
                {
                    code: 'CAT1',
                    name: 'Mục 1',
                    maxScore: 10.0,
                    criteria: [{ code: 'CRI1', label: 'Tiêu chí 1', maxScore: 10.0 }],
                },
            ],
        });

        const res = await request(app)
            .get('/api/rubrics/active')
            .set('Authorization', 'Bearer lecturer-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.version).toBe('v1');
    });

    test('GET /api/rubrics/check-editable kiểm tra trạng thái khóa khi vào đợt', async () => {
        // Giả lập học kỳ đang ONGOING
        prisma.semester.findFirst.mockResolvedValueOnce({
            id: 5,
            name: 'HK2 2026',
            status: 'ONGOING',
        });

        const res = await request(app)
            .get('/api/rubrics/check-editable')
            .set('Authorization', 'Bearer admin-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.canEdit).toBe(false);
        expect(res.body.data.reason).toContain('đang trong giai đoạn thực hiện đồ án');
    });

    test('POST /api/rubrics chặn nếu tổng điểm các mục khác 10.0', async () => {
        prisma.rubricVersion.findUnique.mockResolvedValue(null);

        const invalidCategories = [
            {
                code: 'CAT1',
                name: 'Mục 1',
                maxScore: 5.0,
                criteria: [{ code: 'CRI1', label: 'Tiêu chí 1', maxScore: 5.0 }],
            },
            // Thiếu 5 điểm, tổng chỉ 5.0 != 10.0
        ];

        const res = await request(app)
            .post('/api/rubrics')
            .set('Authorization', 'Bearer admin-token')
            .send({
                version: 'v2',
                title: 'Barem v2 thiếu điểm',
                categories: invalidCategories,
            });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Bắt buộc phải bằng chính xác 10');
    });

    test('POST /api/rubrics từ chối quyền nếu không phải ADMIN', async () => {
        const res = await request(app)
            .post('/api/rubrics')
            .set('Authorization', 'Bearer lecturer-token')
            .send({ version: 'v3' });

        expect(res.status).toBe(403);
    });
});
