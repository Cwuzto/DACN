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

        it('persists valid internal referenceUrl and dedupeKey without passing link field', async () => {
            prisma.notification.create.mockResolvedValue({
                id: 10,
                userId: 101,
                referenceUrl: '/student/submissions',
                dedupeKey: 'bm01:before:17:2026-11-20T10:00:00.000Z',
            });

            const result = await safeNotify(
                {
                    userId: 101,
                    title: 'Nhắc nộp đề cương BM01',
                    content: 'Còn 48 giờ đến hạn nộp BM01.',
                    type: 'TASK_REMINDER',
                    referenceUrl: '/student/submissions',
                    dedupeKey: 'bm01:before:17:2026-11-20T10:00:00.000Z',
                    link: '/should-be-dropped',
                },
                'bm01Reminder',
            );

            expect(result.ok).toBe(true);
            expect(result.created).toMatchObject({ id: 10 });
            const createArg = prisma.notification.create.mock.calls[0][0];
            expect(createArg.data).toMatchObject({
                userId: 101,
                type: 'TASK_REMINDER',
                referenceUrl: '/student/submissions',
                dedupeKey: 'bm01:before:17:2026-11-20T10:00:00.000Z',
            });
            expect(createArg.data.link).toBeUndefined();
        });

        it('sanitizes non-internal referenceUrl to null', async () => {
            prisma.notification.create.mockResolvedValue({ id: 11 });

            for (const badUrl of ['https://evil.com/phish', '//evil.com/phish', 'task-deadline:upcoming:1:2026']) {
                await safeNotify(
                    {
                        userId: 101,
                        title: 'Test',
                        content: 'Test content',
                        referenceUrl: badUrl,
                    },
                    'test-url',
                );
            }

            expect(prisma.notification.create).toHaveBeenCalledTimes(3);
            for (const call of prisma.notification.create.mock.calls) {
                expect(call[0].data.referenceUrl).toBeNull();
            }
        });

        it('returns duplicate skip result on Prisma P2002 unique constraint error', async () => {
            const p2002Error = new Error('Unique constraint failed on the fields: (`dedupe_key`)');
            p2002Error.code = 'P2002';
            prisma.notification.create.mockRejectedValue(p2002Error);

            const duplicateResult = await safeNotify(
                {
                    userId: 101,
                    title: 'Nhắc nộp đề cương BM01',
                    content: 'Còn 48 giờ đến hạn nộp BM01.',
                    type: 'TASK_REMINDER',
                    referenceUrl: '/student/submissions',
                    dedupeKey: 'bm01:before:17:2026-11-20T10:00:00.000Z',
                },
                'bm01Reminder',
            );

            expect(duplicateResult).toEqual({
                ok: false,
                skipped: true,
                reason: 'duplicate',
            });
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

        it('preserves valid referenceUrl and dedupeKey and enables skipDuplicates when dedupeKey is present', async () => {
            prisma.notification.createMany.mockResolvedValue({ count: 2 });

            const rows = [
                {
                    userId: 101,
                    title: 'Thông báo 1',
                    content: 'Nội dung 1',
                    type: 'TASK_REMINDER',
                    referenceUrl: '/student/submissions',
                    dedupeKey: 'bm01:before:1:2026-11-20T10:00:00.000Z',
                    link: '/ignored',
                },
                {
                    userId: 102,
                    title: 'Thông báo 2',
                    content: 'Nội dung 2',
                    type: 'TASK_REMINDER',
                    referenceUrl: 'https://external.example.com',
                    dedupeKey: 'bm01:before:2:2026-11-20T10:00:00.000Z',
                },
            ];

            const result = await safeNotifyMany(rows, 'batch-dedupe');
            expect(result).toEqual({ ok: true, count: 2 });

            const callArg = prisma.notification.createMany.mock.calls[0][0];
            expect(callArg.skipDuplicates).toBe(true);
            expect(callArg.data[0]).toMatchObject({
                referenceUrl: '/student/submissions',
                dedupeKey: 'bm01:before:1:2026-11-20T10:00:00.000Z',
            });
            expect(callArg.data[0].link).toBeUndefined();
            expect(callArg.data[1]).toMatchObject({
                referenceUrl: null,
                dedupeKey: 'bm01:before:2:2026-11-20T10:00:00.000Z',
            });
        });
    });
});
