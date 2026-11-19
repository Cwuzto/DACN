const { safeNotify, safeNotifyMany } = require('../../src/services/notificationService');
const prisma = require('../../src/config/database');

jest.mock('../../src/config/database', () => ({
    user: {
        findUnique: jest.fn(),
    },
    notification: {
        create: jest.fn(),
        createMany: jest.fn(),
    },
}));

describe('notificationService (Task 3 / Fix P2.2)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('safeNotify', () => {
        it('strips internal field isPromulgated and extra fields before calling prisma.notification.create', async () => {
            prisma.notification.create.mockResolvedValue({ id: 1 });

            const payload = {
                userId: 101,
                title: 'Công bố điểm chính thức',
                content: 'Điểm bảo vệ của bạn: 8.5',
                type: 'DEFENSE',
                isPromulgated: true,
                extraInternalMetadata: 'some_value',
                isStudent: true,
            };

            const result = await safeNotify(payload, 'test-context');
            expect(result.ok).toBe(true);

            expect(prisma.notification.create).toHaveBeenCalledTimes(1);
            const callArg = prisma.notification.create.mock.calls[0][0];

            expect(callArg.data).toEqual({
                userId: 101,
                title: 'Công bố điểm chính thức',
                content: 'Điểm bảo vệ của bạn: 8.5',
                type: 'DEFENSE',
            });
            expect(callArg.data.isPromulgated).toBeUndefined();
            expect(callArg.data.extraInternalMetadata).toBeUndefined();
            expect(callArg.data.isStudent).toBeUndefined();
        });

        it('blocks unpromulgated defense score notifications to students (SEC-12)', async () => {
            prisma.user.findUnique.mockResolvedValue({ id: 101, role: 'STUDENT' });

            const payload = {
                userId: 101,
                title: 'Kết quả bảo vệ',
                content: 'Điểm tổng kết: 9.0',
                type: 'DEFENSE',
                isPromulgated: false,
            };

            const result = await safeNotify(payload, 'test-context');
            expect(result.ok).toBe(false);
            expect(result.reason).toBe('UNPROMULGATED_DEFENSE_SCORE_BLOCKED');
            expect(prisma.notification.create).not.toHaveBeenCalled();
        });
    });

    describe('safeNotifyMany', () => {
        it('strips internal field isPromulgated and extra fields before calling prisma.notification.createMany', async () => {
            prisma.notification.createMany.mockResolvedValue({ count: 2 });

            const rows = [
                {
                    userId: 101,
                    title: 'Thông báo 1',
                    content: 'Kết quả: Đạt. Điểm: 8.0',
                    type: 'DEFENSE',
                    isPromulgated: true,
                    extraField: 123,
                },
                {
                    userId: 102,
                    title: 'Thông báo 2',
                    content: 'Kết quả: Đạt. Điểm: 9.0',
                    type: 'DEFENSE',
                    isPromulgated: true,
                    foo: 'bar',
                },
            ];

            const result = await safeNotifyMany(rows, 'test-batch');
            expect(result.ok).toBe(true);
            expect(result.count).toBe(2);

            expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
            const callArg = prisma.notification.createMany.mock.calls[0][0];

            expect(callArg.data).toHaveLength(2);
            for (const item of callArg.data) {
                expect(item.isPromulgated).toBeUndefined();
                expect(item.extraField).toBeUndefined();
                expect(item.foo).toBeUndefined();
                expect(item).toHaveProperty('userId');
                expect(item).toHaveProperty('title');
                expect(item).toHaveProperty('content');
                expect(item).toHaveProperty('type');
            }
        });
    });
});
