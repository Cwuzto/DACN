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
            if (where.id === 1) {
                return {
                    id: 1,
                    email: 'admin@dacn.edu.vn',
                    role: 'ADMIN',
                    isActive: true,
                    permissionGroups: [{
                        permissionGroup: {
                            code: 'QUAN_TRI_VIEN',
                            permissions: [{ permission: { code: 'RUBRIC_MANAGE' } }],
                        },
                    }],
                };
            }
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

    test('GET /api/rubrics và GET /api/rubrics/:id trả về scoreLevelPolicy đã chuẩn hóa kể cả bản ghi cũ null', async () => {
        prisma.rubricVersion.findMany.mockResolvedValue([
            {
                id: 1,
                version: 'v1',
                title: 'Barem v1',
                description: null,
                totalMaxScore: 10.0,
                scoreLevelPolicy: null,
                status: 'ACTIVE',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdByUser: null,
                categories: [
                    { id: 1, code: 'CAT1', name: 'Mục 1', maxScore: 10.0, _count: { criteria: 1 } },
                ],
            },
        ]);
        prisma.rubricVersion.findUnique.mockResolvedValue({
            id: 1,
            version: 'v1',
            title: 'Barem v1',
            totalMaxScore: 10.0,
            scoreLevelPolicy: null,
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
        prisma.defenseMemberScore.count.mockResolvedValue(0);
        prisma.defenseResult.count.mockResolvedValue(0);

        const listRes = await request(app)
            .get('/api/rubrics')
            .set('Authorization', 'Bearer admin-token');

        expect(listRes.status).toBe(200);
        expect(listRes.body.data.versions[0].scoreLevelPolicy).toEqual({
            good: { minPercent: 85, maxPercent: 100, suggestedPercent: 90 },
            fair: { minPercent: 70, maxPercent: 85, suggestedPercent: 75 },
            average: { minPercent: 50, maxPercent: 70, suggestedPercent: 60 },
            poor: { minPercent: 0, maxPercent: 50, suggestedPercent: 30 },
        });

        const detailRes = await request(app)
            .get('/api/rubrics/1')
            .set('Authorization', 'Bearer admin-token');

        expect(detailRes.status).toBe(200);
        expect(detailRes.body.data.scoreLevelPolicy).toEqual(listRes.body.data.versions[0].scoreLevelPolicy);
    });

    test('POST /api/rubrics dùng policy mặc định nếu không truyền và nhận policy hợp lệ nếu truyền, từ chối policy lỗi', async () => {
        const validCategories = [
            {
                code: 'CAT1',
                name: 'Mục 1',
                maxScore: 10.0,
                criteria: [{ code: 'CRI1', label: 'Tiêu chí 1', maxScore: 10.0 }],
            },
        ];

        prisma.rubricVersion.findUnique.mockResolvedValue(null);
        prisma.rubricVersion.create.mockImplementation(async ({ data }) => ({
            id: 20,
            ...data,
            categories: validCategories,
        }));

        const resDefault = await request(app)
            .post('/api/rubrics')
            .set('Authorization', 'Bearer admin-token')
            .send({
                version: 'v_default_policy',
                title: 'Barem mặc định',
                categories: validCategories,
            });

        expect(resDefault.status).toBe(201);
        expect(prisma.rubricVersion.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    scoreLevelPolicy: {
                        good: { minPercent: 85, maxPercent: 100, suggestedPercent: 90 },
                        fair: { minPercent: 70, maxPercent: 85, suggestedPercent: 75 },
                        average: { minPercent: 50, maxPercent: 70, suggestedPercent: 60 },
                        poor: { minPercent: 0, maxPercent: 50, suggestedPercent: 30 },
                    },
                }),
            })
        );
        expect(resDefault.body.data.scoreLevelPolicy.good.suggestedPercent).toBe(90);

        const customPolicy = {
            good: { minPercent: 80, maxPercent: 100, suggestedPercent: 92 },
            fair: { minPercent: 65, maxPercent: 80, suggestedPercent: 72 },
            average: { minPercent: 45, maxPercent: 65, suggestedPercent: 55 },
            poor: { minPercent: 0, maxPercent: 45, suggestedPercent: 25 },
        };

        const resCustom = await request(app)
            .post('/api/rubrics')
            .set('Authorization', 'Bearer admin-token')
            .send({
                version: 'v_custom_policy',
                title: 'Barem tùy chỉnh',
                categories: validCategories,
                scoreLevelPolicy: customPolicy,
            });

        expect(resCustom.status).toBe(201);
        expect(resCustom.body.data.scoreLevelPolicy).toEqual(customPolicy);

        const resInvalidPolicy = await request(app)
            .post('/api/rubrics')
            .set('Authorization', 'Bearer admin-token')
            .send({
                version: 'v_bad_policy',
                title: 'Barem policy lỗi',
                categories: validCategories,
                scoreLevelPolicy: {
                    good: { minPercent: 85, maxPercent: 100, suggestedPercent: 80 },
                    fair: { minPercent: 70, maxPercent: 85, suggestedPercent: 75 },
                    average: { minPercent: 50, maxPercent: 70, suggestedPercent: 60 },
                    poor: { minPercent: 0, maxPercent: 50, suggestedPercent: 30 },
                },
            });

        expect(resInvalidPolicy.status).toBe(400);
        expect(resInvalidPolicy.body.success).toBe(false);
    });

    test('POST /api/rubrics nhân bản (cloneFromId) sao chép policy từ nguồn trừ khi caller truyền policy mới', async () => {
        const sourcePolicy = {
            good: { minPercent: 88, maxPercent: 100, suggestedPercent: 94 },
            fair: { minPercent: 72, maxPercent: 88, suggestedPercent: 78 },
            average: { minPercent: 52, maxPercent: 72, suggestedPercent: 62 },
            poor: { minPercent: 0, maxPercent: 52, suggestedPercent: 32 },
        };
        const sourceRubric = {
            id: 5,
            version: 'v_source',
            title: 'Barem nguồn',
            scoreLevelPolicy: sourcePolicy,
            categories: [
                {
                    code: 'CAT1',
                    name: 'Mục 1',
                    maxScore: 10.0,
                    orderIndex: 1,
                    criteria: [{ code: 'CRI1', label: 'Tiêu chí 1', maxScore: 10.0, orderIndex: 1 }],
                },
            ],
        };

        prisma.rubricVersion.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 5) return sourceRubric;
            return null;
        });
        prisma.defenseMemberScore.count.mockResolvedValue(0);
        prisma.defenseResult.count.mockResolvedValue(0);
        prisma.rubricVersion.create.mockImplementation(async ({ data }) => ({
            id: 21,
            ...data,
            categories: sourceRubric.categories,
        }));

        const resCloneInherit = await request(app)
            .post('/api/rubrics')
            .set('Authorization', 'Bearer admin-token')
            .send({
                version: 'v_clone_inherit',
                cloneFromId: 5,
            });

        expect(resCloneInherit.status).toBe(201);
        expect(resCloneInherit.body.data.scoreLevelPolicy).toEqual(sourcePolicy);

        const overridePolicy = {
            good: { minPercent: 85, maxPercent: 100, suggestedPercent: 95 },
            fair: { minPercent: 70, maxPercent: 85, suggestedPercent: 75 },
            average: { minPercent: 50, maxPercent: 70, suggestedPercent: 60 },
            poor: { minPercent: 0, maxPercent: 50, suggestedPercent: 30 },
        };

        const resCloneOverride = await request(app)
            .post('/api/rubrics')
            .set('Authorization', 'Bearer admin-token')
            .send({
                version: 'v_clone_override',
                cloneFromId: 5,
                scoreLevelPolicy: overridePolicy,
            });

        expect(resCloneOverride.status).toBe(201);
        expect(resCloneOverride.body.data.scoreLevelPolicy).toEqual(overridePolicy);
    });

    test('PUT /api/rubrics/:id cho phép cập nhật policy trên bản nháp chưa dùng, từ chối nếu đã chấm điểm hoặc đã khóa', async () => {
        const categories = [
            {
                code: 'CAT1',
                name: 'Mục 1',
                maxScore: 10.0,
                criteria: [{ code: 'CRI1', label: 'Tiêu chí 1', maxScore: 10.0 }],
            },
        ];
        const newPolicy = {
            good: { minPercent: 86, maxPercent: 100, suggestedPercent: 91 },
            fair: { minPercent: 71, maxPercent: 86, suggestedPercent: 76 },
            average: { minPercent: 51, maxPercent: 71, suggestedPercent: 61 },
            poor: { minPercent: 0, maxPercent: 51, suggestedPercent: 31 },
        };

        // Case 1: Unused DRAFT -> allowed
        prisma.rubricVersion.findUnique.mockResolvedValue({
            id: 30,
            version: 'v_draft',
            title: 'Barem nháp',
            status: 'DRAFT',
            isActive: false,
            lockedAt: null,
            scoreLevelPolicy: null,
            categories,
        });
        prisma.defenseMemberScore.count.mockResolvedValue(0);
        prisma.defenseResult.count.mockResolvedValue(0);
        prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
        prisma.rubricCategory.deleteMany.mockResolvedValue({ count: 1 });
        prisma.rubricVersion.update.mockImplementation(async ({ data }) => ({
            id: 30,
            version: 'v_draft',
            title: data.title,
            scoreLevelPolicy: data.scoreLevelPolicy,
            status: 'DRAFT',
            isActive: false,
            categories,
        }));

        const resDraft = await request(app)
            .put('/api/rubrics/30')
            .set('Authorization', 'Bearer admin-token')
            .send({
                title: 'Barem nháp v2',
                categories,
                scoreLevelPolicy: newPolicy,
            });

        expect(resDraft.status).toBe(200);
        expect(resDraft.body.data.scoreLevelPolicy).toEqual(newPolicy);

        // Case 2: Used in grading -> rejected 400
        prisma.defenseMemberScore.count.mockResolvedValue(2);
        const resUsed = await request(app)
            .put('/api/rubrics/30')
            .set('Authorization', 'Bearer admin-token')
            .send({ title: 'Sửa khi đã chấm', categories, scoreLevelPolicy: newPolicy });

        expect(resUsed.status).toBe(400);
        expect(resUsed.body.success).toBe(false);

        // Case 3: Locked rubric (even with 0 scores) -> rejected 400
        prisma.defenseMemberScore.count.mockResolvedValue(0);
        prisma.rubricVersion.findUnique.mockResolvedValue({
            id: 31,
            version: 'v_locked',
            title: 'Barem đã khóa',
            status: 'ACTIVE',
            isActive: true,
            lockedAt: new Date('2026-11-18T00:00:00Z'),
            categories,
        });

        const resLocked = await request(app)
            .put('/api/rubrics/31')
            .set('Authorization', 'Bearer admin-token')
            .send({ title: 'Sửa bản đã khóa', categories, scoreLevelPolicy: newPolicy });

        expect(resLocked.status).toBe(400);
        expect(resLocked.body.success).toBe(false);
    });

    test('POST /api/rubrics/:id/lock và /activate từ chối 400 nếu tiêu chí không biểu diễn được điểm gợi ý ở độ phân giải 0.01', async () => {
        const unrepresentableRubric = {
            id: 40,
            version: 'v_tiny_criterion',
            title: 'Barem tiêu chí siêu nhỏ',
            status: 'DRAFT',
            isActive: false,
            lockedAt: null,
            scoreLevelPolicy: {
                good: { minPercent: 85, maxPercent: 100, suggestedPercent: 90 },
                fair: { minPercent: 70, maxPercent: 85, suggestedPercent: 75 },
                average: { minPercent: 50, maxPercent: 70, suggestedPercent: 60 },
                poor: { minPercent: 0, maxPercent: 50, suggestedPercent: 30 },
            },
            categories: [
                {
                    code: 'CAT1',
                    name: 'Mục 1',
                    maxScore: 10.0,
                    criteria: [
                        { code: 'TINY', label: 'Tiêu chí 0.02đ', maxScore: 0.02 },
                        { code: 'MAIN', label: 'Tiêu chí chính', maxScore: 9.98 },
                    ],
                },
            ],
        };

        prisma.rubricVersion.findUnique.mockResolvedValue(unrepresentableRubric);
        prisma.defenseMemberScore.count.mockResolvedValue(0);
        prisma.defenseResult.count.mockResolvedValue(0);

        const lockRes = await request(app)
            .post('/api/rubrics/40/lock')
            .set('Authorization', 'Bearer admin-token')
            .send({});

        expect(lockRes.status).toBe(400);
        expect(lockRes.body.success).toBe(false);
        expect(lockRes.body.message).toMatch(/0\.01|TINY/i);

        const activateRes = await request(app)
            .post('/api/rubrics/40/activate')
            .set('Authorization', 'Bearer admin-token')
            .send({});

        expect(activateRes.status).toBe(400);
        expect(activateRes.body.success).toBe(false);
    });
});
