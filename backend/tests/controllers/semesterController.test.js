jest.mock('../../src/config/database', () => ({
    semester: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    topic: {
        count: jest.fn(),
    },
    topicRegistration: {
        count: jest.fn(),
    },
    council: {
        count: jest.fn(),
    },
}));

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

    test('deleteSemester blocks delete when related data exists', async () => {
        prisma.topic.count.mockResolvedValue(1);
        prisma.topicRegistration.count.mockResolvedValue(0);
        prisma.council.count.mockResolvedValue(0);

        const req = createMockReq({
            params: { id: '4' },
        });
        const res = createMockRes();
        const next = createNext();

        await semesterController.deleteSemester(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(prisma.semester.delete).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });
});
