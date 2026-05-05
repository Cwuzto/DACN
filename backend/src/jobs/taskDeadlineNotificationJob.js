const prisma = require('../config/database');
const { safeNotify } = require('../services/notificationService');
const notificationTemplateService = require('../services/notificationTemplateService');

const NOT_COMPLETED_STATUSES = ['OPEN', 'IN_PROGRESS', 'REVISION', 'OVERDUE'];

const readPositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isEnabled = () => String(process.env.ENABLE_TASK_DEADLINE_JOB || 'true').toLowerCase() !== 'false';

const upcomingHours = () => readPositiveInt(process.env.TASK_UPCOMING_NOTIFY_HOURS, 24);
const intervalMs = () => readPositiveInt(process.env.TASK_DEADLINE_JOB_INTERVAL_MS, 30 * 60 * 1000);

const buildSignature = (kind, taskId, seed) => `task-deadline:${kind}:${taskId}:${seed}`;

const renderTemplate = (text = '', vars = {}) => Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, value ?? ''),
    text,
);

const resolveTemplate = (templateKey, fallback, vars = {}) => {
    const stored = notificationTemplateService.getTemplateByKey(templateKey);
    if (!stored || stored.isActive === false) {
        return {
            title: renderTemplate(fallback.title, vars),
            content: renderTemplate(fallback.content, vars),
        };
    }

    return {
        title: renderTemplate(stored.title || fallback.title, vars),
        content: renderTemplate(stored.content || fallback.content, vars),
    };
};

const alreadyNotified = async (userId, signature) => {
    const existing = await prisma.notification.findFirst({
        where: {
            userId,
            referenceUrl: signature,
        },
        select: { id: true },
    });
    return Boolean(existing);
};

const notifyOnce = async ({ userId, title, content, type, signature }, context) => {
    if (!userId) return false;
    if (await alreadyNotified(userId, signature)) return false;
    await safeNotify(
        {
            userId,
            title,
            content,
            type,
            referenceUrl: signature,
        },
        context,
    );
    return true;
};

const processDeadlineNotifications = async () => {
    const now = new Date();
    const upcomingEnd = new Date(now.getTime() + upcomingHours() * 60 * 60 * 1000);
    const today = now.toISOString().slice(0, 10);

    const tasks = await prisma.task.findMany({
        where: {
            status: { in: NOT_COMPLETED_STATUSES },
            dueDate: { not: null },
            registration: {
                status: { in: ['APPROVED', 'IN_PROGRESS', 'SUBMITTED'] },
            },
        },
        include: {
            registration: {
                select: {
                    studentId: true,
                    topic: {
                        select: {
                            mentorId: true,
                        },
                    },
                },
            },
        },
    });

    let mentorUpcoming = 0;
    let mentorOverdue = 0;
    let studentOverdue = 0;

    for (const task of tasks) {
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        if (!dueDate) continue;
        const mentorId = task.registration?.topic?.mentorId;
        const studentId = task.registration?.studentId;

        if (dueDate > now && dueDate <= upcomingEnd) {
            const signature = buildSignature('upcoming', task.id, dueDate.toISOString());
            const vars = {
                TASK_TITLE: task.title || 'Nhiem vu',
                DUE_AT: dueDate.toLocaleString('vi-VN'),
            };
            const message = resolveTemplate(
                'TASK_UPCOMING_DEADLINE',
                {
                    title: 'Task sap qua han',
                    content: 'Nhiem vu "{TASK_TITLE}" sap den han vao {DUE_AT}.',
                },
                vars,
            );
            const sent = await notifyOnce(
                {
                    userId: mentorId,
                    title: message.title,
                    content: message.content,
                    type: 'TASK_REMINDER',
                    signature,
                },
                'taskDeadlineUpcomingMentor',
            );
            if (sent) mentorUpcoming += 1;
            continue;
        }

        if (dueDate <= now) {
            const vars = {
                TASK_TITLE: task.title || 'Nhiem vu',
                DUE_AT: dueDate.toLocaleString('vi-VN'),
            };
            const mentorMessage = resolveTemplate(
                'TASK_OVERDUE_LECTURER',
                {
                    title: 'Task da qua han',
                    content: 'Nhiem vu "{TASK_TITLE}" da qua han tu {DUE_AT}.',
                },
                vars,
            );
            const signatureMentor = buildSignature('overdue-mentor', task.id, today);
            const mentorSent = await notifyOnce(
                {
                    userId: mentorId,
                    title: mentorMessage.title,
                    content: mentorMessage.content,
                    type: 'TASK_REMINDER',
                    signature: signatureMentor,
                },
                'taskDeadlineOverdueMentor',
            );
            if (mentorSent) mentorOverdue += 1;

            const studentMessage = resolveTemplate(
                'TASK_OVERDUE_STUDENT',
                {
                    title: 'Nhiem vu da qua han',
                    content: 'Nhiem vu "{TASK_TITLE}" da qua han tu {DUE_AT}. Vui long nop bai som.',
                },
                vars,
            );
            const signatureStudent = buildSignature('overdue-student', task.id, today);
            const studentSent = await notifyOnce(
                {
                    userId: studentId,
                    title: studentMessage.title,
                    content: studentMessage.content,
                    type: 'TASK_REMINDER',
                    signature: signatureStudent,
                },
                'taskDeadlineOverdueStudent',
            );
            if (studentSent) studentOverdue += 1;
        }
    }

    return {
        scanned: tasks.length,
        mentorUpcoming,
        mentorOverdue,
        studentOverdue,
    };
};

const startTaskDeadlineNotificationScheduler = () => {
    if (!isEnabled()) {
        console.log('[jobs] Task deadline notification job is disabled via ENABLE_TASK_DEADLINE_JOB=false');
        return () => {};
    }

    const run = async () => {
        try {
            const result = await processDeadlineNotifications();
            const totalSent = result.mentorUpcoming + result.mentorOverdue + result.studentOverdue;
            if (totalSent > 0) {
                console.log(
                    `[jobs] Task deadline tick: scanned=${result.scanned}, mentorUpcoming=${result.mentorUpcoming}, mentorOverdue=${result.mentorOverdue}, studentOverdue=${result.studentOverdue}`,
                );
            }
        } catch (error) {
            console.error('[jobs] Task deadline scheduler failed:', error?.message || error);
        }
    };

    run();
    const timer = setInterval(run, intervalMs());
    if (typeof timer.unref === 'function') timer.unref();

    console.log(`[jobs] Task deadline scheduler started (every ${Math.round(intervalMs() / 60000)} minutes, upcoming=${upcomingHours()}h)`);
    return () => clearInterval(timer);
};

module.exports = {
    startTaskDeadlineNotificationScheduler,
};
