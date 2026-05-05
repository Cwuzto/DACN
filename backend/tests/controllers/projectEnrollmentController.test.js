jest.mock('../../src/config/database', () => ({
    projectCatalog: {
        findMany: jest.fn(),
    },
    studentProjectEnrollment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
    },
    $transaction: jest.fn(),
}));

const prisma = require('../../src/config/database');
const {
    listStudentProjectEnrollments,
    bulkUpsertStudentProjectEnrollments,
} = require('../../src/controllers/projectEnrollmentController');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

describe('projectEnrollmentController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('listStudentProjectEnrollments supports source/importBatchId filters', async () => {
        prisma.studentProjectEnrollment.findMany.mockResolvedValue([]);
        const req = createMockReq({
            query: {
                semesterId: '10',
                source: 'EXCEL',
                importBatchId: 'batch-2026-05-04',
            },
        });
        const res = createMockRes();
        const next = createNext();

        await listStudentProjectEnrollments(req, res, next);

        expect(prisma.studentProjectEnrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    semesterId: 10,
                    source: 'EXCEL',
                    importBatchId: 'batch-2026-05-04',
                }),
            })
        );
        expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
        expect(next).not.toHaveBeenCalled();
    });

    test('bulkUpsert keeps source=SEED and importBatchId when provided', async () => {
        const createMock = jest.fn().mockResolvedValue({ id: 1 });
        prisma.$transaction.mockImplementation(async (cb) =>
            cb({
                studentProjectEnrollment: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    update: jest.fn(),
                    create: createMock,
                },
            })
        );

        const req = createMockReq({
            body: {
                items: [
                    {
                        studentId: 1,
                        semesterId: 2,
                        projectCatalogId: 3,
                        status: 'ACTIVE',
                        source: 'SEED',
                        importBatchId: 'seed-batch-v2',
                    },
                ],
            },
        });
        const res = createMockRes();
        const next = createNext();

        await bulkUpsertStudentProjectEnrollments(req, res, next);

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(createMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    source: 'SEED',
                    importBatchId: 'seed-batch-v2',
                }),
            })
        );
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: { created: 1, updated: 0 },
            })
        );
        expect(next).not.toHaveBeenCalled();
    });
});
