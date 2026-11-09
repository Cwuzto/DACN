jest.mock('../../src/config/database', () => ({
    semester: {
        findUnique: jest.fn(),
    },
    user: {
        findUnique: jest.fn(),
    },
    topic: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
    },
    topicRegistration: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
    },
    projectCatalog: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
    },
}));

const prisma = require('../../src/config/database');
const topicController = require('../../src/controllers/topicController');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

describe('topicController.createTopic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.semester.findUnique.mockResolvedValue({ id: 9 });
        prisma.projectCatalog.findFirst.mockResolvedValue({ id: 1 });
        prisma.projectCatalog.findUnique.mockResolvedValue({ id: 1, isActive: true });
        prisma.topicRegistration.findFirst.mockResolvedValue(null);
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
                projectCatalogId: 1,
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
                    projectCatalogId: 1,
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
                projectCatalogId: 1,
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
                projectCatalogId: 1,
            },
        });
        const res = createMockRes();
        const next = createNext();

        await topicController.createTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(prisma.topic.create).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('rejects student create when account is restricted after completion', async () => {
        prisma.topicRegistration.findFirst.mockResolvedValueOnce({ id: 1000 });

        const req = createMockReq({
            user: { id: 20, role: 'STUDENT' },
            body: {
                title: 'De xuat moi',
                semesterId: 9,
                mentorId: 999,
                projectCatalogId: 1,
            },
        });
        const res = createMockRes();
        const next = createNext();

        await topicController.createTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(prisma.topic.create).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('rejects student create when student already has active registration in semester', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValueOnce({ id: 10, status: 'PENDING' });

        const req = createMockReq({
            user: { id: 20, role: 'STUDENT' },
            body: {
                title: 'De xuat moi',
                semesterId: 9,
                mentorId: 999,
                projectCatalogId: 1,
            },
        });
        const res = createMockRes();
        const next = createNext();

        await topicController.createTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: expect.stringContaining('Bạn đã đăng ký một đề tài trong học kỳ này'),
            })
        );
        expect(prisma.topic.create).not.toHaveBeenCalled();
    });

    test('rejects student create when student already has pending proposal in semester', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValueOnce(null);
        prisma.topic.findFirst.mockResolvedValueOnce({ id: 101, status: 'PENDING' });

        const req = createMockReq({
            user: { id: 20, role: 'STUDENT' },
            body: {
                title: 'De xuat thu hai',
                semesterId: 9,
                mentorId: 999,
                projectCatalogId: 1,
            },
        });
        const res = createMockRes();
        const next = createNext();

        await topicController.createTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: expect.stringContaining('Bạn đã có một đề tài tự đề xuất đang chờ giảng viên duyệt'),
            })
        );
        expect(prisma.topic.create).not.toHaveBeenCalled();
    });
});

describe('topicController.deleteTopic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('allows student to delete own PENDING proposal', async () => {
        prisma.topic.findUnique.mockResolvedValueOnce({
            id: 55,
            proposedById: 20,
            status: 'PENDING',
            _count: { registrations: 0 },
        });
        prisma.topic.delete.mockResolvedValueOnce({ id: 55 });

        const req = createMockReq({
            user: { id: 20, role: 'STUDENT' },
            params: { id: '55' },
        });
        const res = createMockRes();
        const next = createNext();

        await topicController.deleteTopic(req, res, next);

        expect(prisma.topic.delete).toHaveBeenCalledWith({ where: { id: 55 } });
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: 'Xóa đề tài thành công.',
            })
        );
    });

    test('rejects student deleting someone else proposal', async () => {
        prisma.topic.findUnique.mockResolvedValueOnce({
            id: 55,
            proposedById: 99,
            status: 'PENDING',
            _count: { registrations: 0 },
        });

        const req = createMockReq({
            user: { id: 20, role: 'STUDENT' },
            params: { id: '55' },
        });
        const res = createMockRes();
        const next = createNext();

        await topicController.deleteTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(prisma.topic.delete).not.toHaveBeenCalled();
    });

    test('rejects student deleting non-PENDING topic', async () => {
        prisma.topic.findUnique.mockResolvedValueOnce({
            id: 55,
            proposedById: 20,
            status: 'APPROVED',
            _count: { registrations: 0 },
        });

        const req = createMockReq({
            user: { id: 20, role: 'STUDENT' },
            params: { id: '55' },
        });
        const res = createMockRes();
        const next = createNext();

        await topicController.deleteTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: expect.stringContaining('Sinh viên chỉ có thể hủy đề tài khi đang ở trạng thái chờ duyệt'),
            })
        );
        expect(prisma.topic.delete).not.toHaveBeenCalled();
    });
});
