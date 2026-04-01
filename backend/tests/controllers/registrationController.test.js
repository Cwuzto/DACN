jest.mock('../../src/config/database', () => ({
    topicRegistration: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
    },
    topic: {
        findUnique: jest.fn(),
    },
    semester: {
        findUnique: jest.fn(),
    },
    notification: {
        create: jest.fn(),
    },
}));

jest.mock('../../src/constants/mentorCapacity', () => ({
    getMentorMaxSlots: jest.fn(),
}));

const prisma = require('../../src/config/database');
const { getMentorMaxSlots } = require('../../src/constants/mentorCapacity');
const {
    registerTopic,
    handleRegistration,
} = require('../../src/controllers/registrationController');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

describe('registrationController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('registerTopic creates registration successfully', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 9,
            startDate: new Date('2026-01-01T00:00:00.000Z'),
            registrationDeadline: new Date('2099-12-31T23:59:59.000Z'),
            registrationOpen: true,
        });
        prisma.topicRegistration.findUnique.mockResolvedValue(null);
        prisma.topic.findUnique.mockResolvedValue({
            id: 100,
            title: 'Đồ án AI',
            semesterId: 9,
            mentorId: 77,
            status: 'APPROVED',
            maxStudents: 2,
            mentor: { id: 77, academicTitle: 'TIEN_SI' },
            _count: { registrations: 1 },
        });
        getMentorMaxSlots.mockReturnValue(15);
        prisma.topicRegistration.count.mockResolvedValue(3);
        prisma.topicRegistration.create.mockResolvedValue({
            id: 501,
            topicId: 100,
            studentId: 5,
            semesterId: 9,
            status: 'PENDING',
        });

        const req = createMockReq({
            user: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
            body: { topicId: 100, semesterId: 9 },
        });
        const res = createMockRes();
        const next = createNext();

        await registerTopic(req, res, next);

        expect(prisma.topicRegistration.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    topicId: 100,
                    studentId: 5,
                    semesterId: 9,
                    status: 'PENDING',
                }),
            })
        );
        expect(prisma.notification.create).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(next).not.toHaveBeenCalled();
    });

    test('registerTopic rejects when semester registration is closed', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 9,
            startDate: new Date('2026-01-01T00:00:00.000Z'),
            registrationDeadline: new Date('2099-12-31T23:59:59.000Z'),
            registrationOpen: false,
        });

        const req = createMockReq({
            user: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
            body: { topicId: 100, semesterId: 9 },
        });
        const res = createMockRes();
        const next = createNext();

        await registerTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(prisma.topicRegistration.create).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('handleRegistration approves a pending registration', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 88,
            studentId: 5,
            semesterId: 9,
            status: 'PENDING',
            topic: {
                id: 100,
                title: 'Đồ án AI',
                mentorId: 77,
                mentor: { id: 77, academicTitle: 'TIEN_SI' },
            },
            student: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
        });
        getMentorMaxSlots.mockReturnValue(15);
        prisma.topicRegistration.count.mockResolvedValue(2);
        prisma.topicRegistration.update.mockResolvedValue({
            id: 88,
            status: 'APPROVED',
        });

        const req = createMockReq({
            params: { id: '88' },
            body: { action: 'APPROVE' },
            user: { id: 77, role: 'LECTURER' },
        });
        const res = createMockRes();
        const next = createNext();

        await handleRegistration(req, res, next);

        expect(prisma.topicRegistration.update).toHaveBeenCalledWith({
            where: { id: 88 },
            data: { status: 'APPROVED' },
        });
        expect(prisma.notification.create).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
        expect(next).not.toHaveBeenCalled();
    });

    test('handleRegistration rejects when reason is missing', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 90,
            studentId: 5,
            semesterId: 9,
            status: 'PENDING',
            topic: {
                id: 101,
                title: 'Đồ án Web',
                mentorId: 77,
                mentor: { id: 77, academicTitle: 'THAC_SI' },
            },
            student: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
        });

        const req = createMockReq({
            params: { id: '90' },
            body: { action: 'REJECT' },
            user: { id: 1, role: 'ADMIN' },
        });
        const res = createMockRes();
        const next = createNext();

        await handleRegistration(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(prisma.topicRegistration.update).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('handleRegistration rejects with reason successfully', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 91,
            studentId: 5,
            semesterId: 9,
            status: 'PENDING',
            topic: {
                id: 102,
                title: 'Đồ án Cloud',
                mentorId: 77,
                mentor: { id: 77, academicTitle: 'THAC_SI' },
            },
            student: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
        });
        prisma.topicRegistration.update.mockResolvedValue({
            id: 91,
            status: 'REJECTED',
        });

        const req = createMockReq({
            params: { id: '91' },
            body: { action: 'REJECT', rejectReason: 'Đề tài không phù hợp' },
            user: { id: 1, role: 'ADMIN' },
        });
        const res = createMockRes();
        const next = createNext();

        await handleRegistration(req, res, next);

        expect(prisma.topicRegistration.update).toHaveBeenCalledWith({
            where: { id: 91 },
            data: { status: 'REJECTED', rejectReason: 'Đề tài không phù hợp' },
        });
        expect(prisma.notification.create).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
        expect(next).not.toHaveBeenCalled();
    });
});
