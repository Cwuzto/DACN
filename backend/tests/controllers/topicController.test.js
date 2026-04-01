jest.mock('../../src/config/database', () => ({
    semester: {
        findUnique: jest.fn(),
    },
    user: {
        findUnique: jest.fn(),
    },
    topic: {
        create: jest.fn(),
    },
}));

const prisma = require('../../src/config/database');
const topicController = require('../../src/controllers/topicController');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

describe('topicController.createTopic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.semester.findUnique.mockResolvedValue({ id: 9 });
    });

    test('auto-assigns mentorId to lecturer user id', async () => {
        prisma.topic.create.mockImplementation(async ({ data }) => ({
            id: 101,
            ...data,
            proposedBy: { id: data.proposedById, fullName: 'Lecturer', code: 'GV001' },
            mentor: { id: data.mentorId, fullName: 'Lecturer', code: 'GV001' },
            semester: { id: data.semesterId, name: 'HK Active' },
        }));

        const req = createMockReq({
            user: { id: 77, role: 'LECTURER' },
            body: {
                title: 'Do an lecturer tao',
                semesterId: 9,
                mentorId: 9999,
                status: 'APPROVED',
            },
        });
        const res = createMockRes();
        const next = createNext();

        await topicController.createTopic(req, res, next);

        expect(prisma.topic.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    proposedById: 77,
                    mentorId: 77,
                    status: 'APPROVED',
                }),
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(next).not.toHaveBeenCalled();
    });

    test('rejects admin create when mentorId is missing', async () => {
        const req = createMockReq({
            user: { id: 1, role: 'ADMIN' },
            body: {
                title: 'Do an admin tao',
                semesterId: 9,
                status: 'APPROVED',
            },
        });
        const res = createMockRes();
        const next = createNext();

        await topicController.createTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(prisma.topic.create).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('rejects admin create when mentor is not active lecturer', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 999,
            role: 'LECTURER',
            isActive: false,
        });

        const req = createMockReq({
            user: { id: 1, role: 'ADMIN' },
            body: {
                title: 'Do an admin tao',
                semesterId: 9,
                mentorId: 999,
                status: 'APPROVED',
            },
        });
        const res = createMockRes();
        const next = createNext();

        await topicController.createTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(prisma.topic.create).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });
});
