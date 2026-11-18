jest.mock('../../src/config/database', () => ({
    user: {
        findUnique: jest.fn(),
    },
    semester: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    periodWorkflowPolicyVersion: {
        create: jest.fn(),
        findFirst: jest.fn(),
    },
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Integration - Defense Council Target Size per Semester', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'target-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'lecturer-token') return { userId: 2, role: 'LECTURER' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === 1) {
                return {
                    id: 1,
                    email: 'admin@example.com',
                    fullName: 'Admin User',
                    code: 'AD001',
                    role: 'ADMIN',
                    department: 'PDT',
                    isActive: true,
                    permissionGroups: [{
                        permissionGroup: {
                            code: 'QUAN_TRI_VIEN',
                            permissions: [
                                { permission: { code: 'SEMESTER_MANAGE' } },
                                { permission: { code: 'PROJECT_ASSIGNMENT_PUBLISH' } },
                            ],
                        },
                    }],
                };
            }
            return null;
        });
    });

    describe('POST /api/semesters - create semester with defenseCouncilTargetSize', () => {
        test('defaults defenseCouncilTargetSize to 22 when omitted', async () => {
            prisma.semester.create.mockImplementation(async ({ data }) => ({
                id: 10,
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

            const res = await request(app)
                .post('/api/semesters')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    name: 'Đợt 1 Học kỳ 1 2026-2027',
                    startDate: '2026-09-01T00:00:00.000Z',
                    endDate: '2027-01-15T00:00:00.000Z',
                    registrationDeadline: '2026-09-20T00:00:00.000Z',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(prisma.semester.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        defenseCouncilTargetSize: 22,
                    }),
                })
            );
            expect(res.body.data.defenseCouncilTargetSize).toBe(22);
        });

        test('accepts boundary value 1', async () => {
            prisma.semester.create.mockImplementation(async ({ data }) => ({
                id: 11,
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

            const res = await request(app)
                .post('/api/semesters')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    name: 'Đợt 1 Học kỳ 1 2026-2027',
                    startDate: '2026-09-01T00:00:00.000Z',
                    endDate: '2027-01-15T00:00:00.000Z',
                    registrationDeadline: '2026-09-20T00:00:00.000Z',
                    defenseCouncilTargetSize: 1,
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(prisma.semester.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        defenseCouncilTargetSize: 1,
                    }),
                })
            );
            expect(res.body.data.defenseCouncilTargetSize).toBe(1);
        });

        test('accepts boundary value 30', async () => {
            prisma.semester.create.mockImplementation(async ({ data }) => ({
                id: 12,
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

            const res = await request(app)
                .post('/api/semesters')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    name: 'Đợt 1 Học kỳ 1 2026-2027',
                    startDate: '2026-09-01T00:00:00.000Z',
                    endDate: '2027-01-15T00:00:00.000Z',
                    registrationDeadline: '2026-09-20T00:00:00.000Z',
                    defenseCouncilTargetSize: 30,
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(prisma.semester.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        defenseCouncilTargetSize: 30,
                    }),
                })
            );
            expect(res.body.data.defenseCouncilTargetSize).toBe(30);
        });

        test('rejects 0 with status 400', async () => {
            const res = await request(app)
                .post('/api/semesters')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    name: 'Đợt 1 Học kỳ 1 2026-2027',
                    startDate: '2026-09-01T00:00:00.000Z',
                    endDate: '2027-01-15T00:00:00.000Z',
                    registrationDeadline: '2026-09-20T00:00:00.000Z',
                    defenseCouncilTargetSize: 0,
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(prisma.semester.create).not.toHaveBeenCalled();
        });

        test('rejects 31 with status 400', async () => {
            const res = await request(app)
                .post('/api/semesters')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    name: 'Đợt 1 Học kỳ 1 2026-2027',
                    startDate: '2026-09-01T00:00:00.000Z',
                    endDate: '2027-01-15T00:00:00.000Z',
                    registrationDeadline: '2026-09-20T00:00:00.000Z',
                    defenseCouncilTargetSize: 31,
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(prisma.semester.create).not.toHaveBeenCalled();
        });

        test('rejects negative numbers with status 400', async () => {
            const res = await request(app)
                .post('/api/semesters')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    name: 'Đợt 1 Học kỳ 1 2026-2027',
                    startDate: '2026-09-01T00:00:00.000Z',
                    endDate: '2027-01-15T00:00:00.000Z',
                    registrationDeadline: '2026-09-20T00:00:00.000Z',
                    defenseCouncilTargetSize: -5,
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(prisma.semester.create).not.toHaveBeenCalled();
        });

        test('rejects decimals with status 400', async () => {
            const res = await request(app)
                .post('/api/semesters')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    name: 'Đợt 1 Học kỳ 1 2026-2027',
                    startDate: '2026-09-01T00:00:00.000Z',
                    endDate: '2027-01-15T00:00:00.000Z',
                    registrationDeadline: '2026-09-20T00:00:00.000Z',
                    defenseCouncilTargetSize: 22.5,
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(prisma.semester.create).not.toHaveBeenCalled();
        });

        test('rejects non-integer strings with status 400', async () => {
            const res = await request(app)
                .post('/api/semesters')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    name: 'Đợt 1 Học kỳ 1 2026-2027',
                    startDate: '2026-09-01T00:00:00.000Z',
                    endDate: '2027-01-15T00:00:00.000Z',
                    registrationDeadline: '2026-09-20T00:00:00.000Z',
                    defenseCouncilTargetSize: 'twenty-two',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(prisma.semester.create).not.toHaveBeenCalled();
        });
    });

    describe('PUT /api/semesters/:id - update semester defenseCouncilTargetSize', () => {
        const existingSemester = {
            id: 1,
            name: 'Đợt 1 Học kỳ 1 2026-2027',
            code: 'DATN-HK1-2026-27',
            startDate: new Date('2026-09-01T00:00:00.000Z'),
            endDate: new Date('2027-01-15T00:00:00.000Z'),
            registrationDeadline: new Date('2026-09-20T00:00:00.000Z'),
            midtermReportDate: null,
            defenseDate: null,
            defenseCouncilTargetSize: 22,
            registrationOpen: true,
            status: 'ONGOING',
        };

        test('retains existing defenseCouncilTargetSize when omitted in update', async () => {
            prisma.semester.findUnique.mockResolvedValue({ ...existingSemester });
            prisma.semester.update.mockImplementation(async ({ data }) => ({
                ...existingSemester,
                ...data,
            }));

            const res = await request(app)
                .put('/api/semesters/1')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    name: 'Đợt 1 Học kỳ 1 2026-2027 (Đã đổi tên)',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(prisma.semester.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                    data: expect.objectContaining({
                        defenseCouncilTargetSize: 22,
                    }),
                })
            );
            expect(res.body.data.defenseCouncilTargetSize).toBe(22);
        });

        test('updates defenseCouncilTargetSize to valid value', async () => {
            prisma.semester.findUnique.mockResolvedValue({ ...existingSemester });
            prisma.semester.update.mockImplementation(async ({ data }) => ({
                ...existingSemester,
                ...data,
            }));

            const res = await request(app)
                .put('/api/semesters/1')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    defenseCouncilTargetSize: 25,
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(prisma.semester.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                    data: expect.objectContaining({
                        defenseCouncilTargetSize: 25,
                    }),
                })
            );
            expect(res.body.data.defenseCouncilTargetSize).toBe(25);
        });

        test('rejects invalid target size on update (e.g. 0)', async () => {
            prisma.semester.findUnique.mockResolvedValue({ ...existingSemester });

            const res = await request(app)
                .put('/api/semesters/1')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    defenseCouncilTargetSize: 0,
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(prisma.semester.update).not.toHaveBeenCalled();
        });

        test('rejects invalid target size on update (e.g. 31)', async () => {
            prisma.semester.findUnique.mockResolvedValue({ ...existingSemester });

            const res = await request(app)
                .put('/api/semesters/1')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    defenseCouncilTargetSize: 31,
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(prisma.semester.update).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/semesters and GET /api/semesters/:id', () => {
        test('returns defenseCouncilTargetSize in semester detail', async () => {
            prisma.semester.findUnique.mockResolvedValue({
                id: 1,
                name: 'Đợt 1',
                code: 'DATN-HK1-2026-27',
                startDate: new Date('2026-09-01T00:00:00.000Z'),
                endDate: new Date('2027-01-15T00:00:00.000Z'),
                registrationDeadline: new Date('2026-09-20T00:00:00.000Z'),
                defenseCouncilTargetSize: 22,
                registrationOpen: true,
                status: 'ONGOING',
            });

            const res = await request(app)
                .get('/api/semesters/1')
                .set('Authorization', 'Bearer admin-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.defenseCouncilTargetSize).toBe(22);
        });

        test('returns defenseCouncilTargetSize in semester list', async () => {
            prisma.semester.findMany.mockResolvedValue([
                {
                    id: 1,
                    name: 'Đợt 1',
                    code: 'DATN-HK1-2026-27',
                    startDate: new Date('2026-09-01T00:00:00.000Z'),
                    endDate: new Date('2027-01-15T00:00:00.000Z'),
                    registrationDeadline: new Date('2026-09-20T00:00:00.000Z'),
                    defenseCouncilTargetSize: 25,
                    registrationOpen: true,
                    status: 'ONGOING',
                },
            ]);

            const res = await request(app)
                .get('/api/semesters')
                .set('Authorization', 'Bearer admin-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data[0].defenseCouncilTargetSize).toBe(25);
        });
    });
});
