const prisma = require('../../src/config/database');
const { safeNotify } = require('../../src/services/notificationService');
const notificationTemplateService = require('../../src/services/notificationTemplateService');
const { processDeadlineNotifications } = require('../../src/jobs/taskDeadlineNotificationJob');

jest.mock('../../src/config/database', () => ({
    task: {
        findMany: jest.fn(),
    },
    notification: {
        findFirst: jest.fn(),
    },
}));

jest.mock('../../src/services/notificationService', () => ({
    safeNotify: jest.fn(),
}));

jest.mock('../../src/services/notificationTemplateService', () => ({
    getTemplateByKey: jest.fn(),
}));

describe('taskDeadlineNotificationJob', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        notificationTemplateService.getTemplateByKey.mockReturnValue(null);
        prisma.notification.findFirst.mockResolvedValue(null);
    });

    it('sends upcoming deadline notification using dedupeKey and internal referenceUrl', async () => {
        const dueSoon = new Date(Date.now() + 2 * 60 * 60 * 1000);
        prisma.task.findMany.mockResolvedValue([
            {
                id: 11,
                title: 'Nộp báo cáo tuần 3',
                dueDate: dueSoon,
                registrationId: 55,
                registration: {
                    studentId: 201,
                    topic: { mentorId: 301 },
                },
            },
        ]);
        safeNotify.mockResolvedValue({ ok: true, created: { id: 1 } });

        const result = await processDeadlineNotifications();

        expect(result).toEqual({
            scanned: 1,
            mentorUpcoming: 1,
            mentorOverdue: 0,
            studentOverdue: 0,
        });
        expect(prisma.notification.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    dedupeKey: `task-deadline:upcoming:11:${dueSoon.toISOString()}`,
                }),
            }),
        );
        expect(safeNotify).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 301,
                type: 'TASK_REMINDER',
                referenceUrl: '/lecturer/students/55',
                dedupeKey: `task-deadline:upcoming:11:${dueSoon.toISOString()}`,
            }),
            'taskDeadlineUpcomingMentor',
        );
    });

    it('does not increment sent counts when safeNotify fails or skips duplicate', async () => {
        const overdue = new Date(Date.now() - 3 * 60 * 60 * 1000);
        prisma.task.findMany.mockResolvedValue([
            {
                id: 22,
                title: 'Nộp chương 1',
                dueDate: overdue,
                registrationId: 77,
                registration: {
                    studentId: 202,
                    topic: { mentorId: 302 },
                },
            },
        ]);
        safeNotify
            .mockResolvedValueOnce({ ok: false, skipped: true, reason: 'duplicate' })
            .mockResolvedValueOnce({ ok: false, error: 'db_connection_lost' });

        const result = await processDeadlineNotifications();

        expect(result).toEqual({
            scanned: 1,
            mentorUpcoming: 0,
            mentorOverdue: 0,
            studentOverdue: 0,
        });
        expect(safeNotify).toHaveBeenCalledTimes(2);
        expect(safeNotify).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                userId: 302,
                referenceUrl: '/lecturer/students/77',
                dedupeKey: expect.stringMatching(/^task-deadline:overdue-mentor:22:/),
            }),
            'taskDeadlineOverdueMentor',
        );
        expect(safeNotify).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                userId: 202,
                referenceUrl: '/student/submissions',
                dedupeKey: expect.stringMatching(/^task-deadline:overdue-student:22:/),
            }),
            'taskDeadlineOverdueStudent',
        );
    });
});
