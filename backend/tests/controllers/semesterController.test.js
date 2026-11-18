const mockSemester = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

const mockTopic = {
    count: jest.fn(),
};

const mockTopicRegistration = {
    count: jest.fn(),
};

const mockCouncil = {
    count: jest.fn(),
};

const mockPeriodWorkflowPolicyVersion = {
    deleteMany: jest.fn(),
};

const mockRubricVersion = {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
};

const mockRubricCategory = {
    deleteMany: jest.fn(),
};

const mockPrisma = {
    semester: mockSemester,
    topic: mockTopic,
    topicRegistration: mockTopicRegistration,
    council: mockCouncil,
    periodWorkflowPolicyVersion: mockPeriodWorkflowPolicyVersion,
    rubricVersion: mockRubricVersion,
    rubricCategory: mockRubricCategory,
    $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
            return cb(mockPrisma);
        }
        return Promise.all(cb);
    }),
};

jest.mock('../../src/config/database', () => mockPrisma);

const prisma = require('../../src/config/database');
const semesterController = require('../../src/controllers/semesterController');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

describe('semesterController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('createSemester stores midtermReportDate when provided', async () => {
        prisma.semester.create.mockImplementation(async ({ data }) => ({
            id: 1,
            ...data,
        }));

        const req = createMockReq({
            body: {
                name: 'HK1 2026',
                startDate: '2026-01-01T00:00:00.000Z',
                registrationDeadline: '2026-01-20T00:00:00.000Z',
                midtermReportDate: '2026-03-01T00:00:00.000Z',
                endDate: '2026-06-01T00:00:00.000Z',
                registrationOpen: true,
            },
        });
        const res = createMockRes();
        const next = createNext();

        await semesterController.createSemester(req, res, next);

        expect(prisma.semester.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    midtermReportDate: new Date('2026-03-01T00:00:00.000Z'),
                }),
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(next).not.toHaveBeenCalled();
    });

    test('updateSemester can clear midtermReportDate', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 2,
            name: 'HK2 2026',
            startDate: new Date('2026-07-01T00:00:00.000Z'),
            registrationDeadline: new Date('2026-07-20T00:00:00.000Z'),
            midtermReportDate: new Date('2026-09-01T00:00:00.000Z'),
            defenseDate: null,
            endDate: new Date('2026-12-20T00:00:00.000Z'),
            registrationOpen: true,
        });
        prisma.semester.update.mockImplementation(async ({ data }) => ({
            id: 2,
            ...data,
        }));

        const req = createMockReq({
            params: { id: '2' },
            body: {
                midtermReportDate: null,
            },
        });
        const res = createMockRes();
        const next = createNext();

        await semesterController.updateSemester(req, res, next);

        expect(prisma.semester.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 2 },
                data: expect.objectContaining({
                    midtermReportDate: null,
                }),
            })
        );
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        expect(next).not.toHaveBeenCalled();
    });

    test('toggleSemesterRegistration rejects non-boolean payload', async () => {
        const req = createMockReq({
            params: { id: '3' },
            body: { registrationOpen: 'true' },
        });
        const res = createMockRes();
        const next = createNext();

        await semesterController.toggleSemesterRegistration(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(prisma.semester.update).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('deleteSemester blocks delete when related data exists with 409 PERIOD_NOT_EMPTY', async () => {
        prisma.semester.findUnique.mockResolvedValue({ id: 4, name: 'HK4' });
        prisma.topic.count.mockResolvedValue(1);
        prisma.topicRegistration.count.mockResolvedValue(0);
        prisma.council.count.mockResolvedValue(0);

        const req = createMockReq({
            params: { id: '4' },
        });
        const res = createMockRes();
        const next = createNext();

        await semesterController.deleteSemester(req, res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            code: 'PERIOD_NOT_EMPTY',
        }));
        expect(prisma.semester.delete).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('deleteSemester cleans up policies and rubrics in transaction when empty', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 5,
            name: 'HK5',
            lockedPolicyVersionId: 10,
            lockedDefenseRubricVersionId: 20,
        });
        prisma.topic.count.mockResolvedValue(0);
        prisma.topicRegistration.count.mockResolvedValue(0);
        prisma.council.count.mockResolvedValue(0);
        prisma.rubricVersion.findMany.mockResolvedValue([{ id: 20 }]);

        const req = createMockReq({
            params: { id: '5' },
        });
        const res = createMockRes();
        const next = createNext();

        await semesterController.deleteSemester(req, res, next);

        expect(prisma.$transaction).toHaveBeenCalled();
        expect(prisma.semester.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 5 },
            data: expect.objectContaining({
                lockedPolicyVersionId: null,
                lockedDefenseRubricVersionId: null,
            }),
        }));
        expect(prisma.periodWorkflowPolicyVersion.deleteMany).toHaveBeenCalledWith({
            where: { semesterId: 5 },
        });
        expect(prisma.rubricCategory.deleteMany).toHaveBeenCalledWith({
            where: { rubricVersionId: { in: [20] } },
        });
        expect(prisma.rubricVersion.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: [20] } },
        });
        expect(prisma.semester.delete).toHaveBeenCalledWith({
            where: { id: 5 },
        });
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
        }));
        expect(next).not.toHaveBeenCalled();
    });
});
