const prisma = require('../config/database');
const { safeNotify } = require('../services/notificationService');

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;
const BM01_INITIAL_TASK_TYPES = ['BM01', 'BM01_INITIAL_SUBMISSION'];

const readPositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isEnabled = () => String(process.env.ENABLE_BM01_REMINDER_JOB || 'true').toLowerCase() !== 'false';
const intervalMs = () => readPositiveInt(process.env.BM01_REMINDER_JOB_INTERVAL_MS, DEFAULT_INTERVAL_MS);

const resolveMilestone = (now, deadline) => {
    const nowMs = now.getTime();
    const deadlineMs = deadline.getTime();
    if (nowMs >= deadlineMs) return 'OVERDUE';
    if (nowMs >= deadlineMs - FORTY_EIGHT_HOURS_MS) return 'BEFORE_48H';
    return null;
};

const isEligibleRegistration = (reg) => {
    if (!reg) return false;
    if (reg.status !== 'APPROVED') return false;
    if (reg.cancelledAt) return false;
    if (reg.assignmentStatus && reg.assignmentStatus !== 'ACTIVE') return false;
    if (!reg.studentId) return false;
    if (!reg.semester || reg.semester.status === 'COMPLETED') return false;
    if (!reg.semester.outlineSubmissionDeadline) return false;
    if (Array.isArray(reg.bm01Evaluations) && reg.bm01Evaluations.length > 0) return false;
    if (Array.isArray(reg.submissions) && reg.submissions.length > 0) return false;
    return true;
};

const buildReminderPayload = (reg, milestone, deadline) => {
    const topicTitle = reg.topic?.title || 'đề tài tốt nghiệp';
    const deadlineText = deadline.toLocaleString('vi-VN');
    const dedupeKey = `bm01:${milestone}:${reg.id}:${deadline.toISOString()}`;

    if (milestone === 'BEFORE_48H') {
        return {
            userId: reg.studentId,
            title: 'Nhắc nộp đề cương BM01 (còn dưới 48 giờ)',
            content: `Đề tài "${topicTitle}" có hạn nộp đề cương chi tiết (BM01) vào ${deadlineText}. Vui lòng hoàn tất và nộp bài đúng hạn.`,
            type: 'TASK_REMINDER',
            referenceUrl: '/student/submissions',
            dedupeKey,
        };
    }

    return {
        userId: reg.studentId,
        title: 'Quá hạn nộp đề cương BM01',
        content: `Đề tài "${topicTitle}" đã quá hạn nộp đề cương chi tiết (BM01) từ ${deadlineText}. Vui lòng nộp bài ngay hoặc liên hệ giảng viên hướng dẫn.`,
        type: 'TASK_REMINDER',
        referenceUrl: '/student/submissions',
        dedupeKey,
    };
};

const registrationSelect = {
    id: true,
    studentId: true,
    status: true,
    cancelledAt: true,
    assignmentStatus: true,
    topic: {
        select: {
            id: true,
            title: true,
        },
    },
    semester: {
        select: {
            id: true,
            name: true,
            status: true,
            outlineSubmissionDeadline: true,
        },
    },
    bm01Evaluations: {
        select: { id: true },
        take: 1,
    },
    submissions: {
        where: {
            task: {
                taskType: { in: BM01_INITIAL_TASK_TYPES },
            },
        },
        select: { id: true },
        take: 1,
    },
};

const processBm01SubmissionReminders = async ({
    db = prisma,
    now = new Date(),
    notify = safeNotify,
} = {}) => {
    const currentNow = now instanceof Date ? now : new Date(now);
    const registrations = await db.topicRegistration.findMany({
        where: {
            status: 'APPROVED',
            cancelledAt: null,
            assignmentStatus: 'ACTIVE',
            semester: {
                outlineSubmissionDeadline: { not: null },
                status: { not: 'COMPLETED' },
            },
            bm01Evaluations: { none: {} },
            submissions: {
                none: {
                    task: {
                        taskType: { in: BM01_INITIAL_TASK_TYPES },
                    },
                },
            },
        },
        select: registrationSelect,
    });

    let beforeSent = 0;
    let overdueSent = 0;
    let skipped = 0;

    for (const reg of registrations) {
        const latest = typeof db.topicRegistration.findUnique === 'function'
            ? await db.topicRegistration.findUnique({
                where: { id: reg.id },
                select: registrationSelect,
            })
            : reg;

        if (!isEligibleRegistration(latest)) {
            skipped += 1;
            continue;
        }

        const deadline = new Date(latest.semester.outlineSubmissionDeadline);
        if (Number.isNaN(deadline.getTime())) {
            skipped += 1;
            continue;
        }

        const milestone = resolveMilestone(currentNow, deadline);
        if (!milestone) {
            skipped += 1;
            continue;
        }

        const payload = buildReminderPayload(latest, milestone, deadline);
        const context = milestone === 'BEFORE_48H'
            ? 'bm01SubmissionReminderBefore48h'
            : 'bm01SubmissionReminderOverdue';
        const result = await notify(payload, context);

        if (result?.ok) {
            if (milestone === 'BEFORE_48H') {
                beforeSent += 1;
            } else {
                overdueSent += 1;
            }
        } else {
            skipped += 1;
        }
    }

    return {
        scanned: registrations.length,
        beforeSent,
        overdueSent,
        skipped,
    };
};

const startBm01SubmissionReminderScheduler = () => {
    if (!isEnabled()) {
        console.log('[jobs] BM01 submission reminder job is disabled via ENABLE_BM01_REMINDER_JOB=false');
        return () => {};
    }

    const run = async () => {
        try {
            const result = await processBm01SubmissionReminders();
            if (result.beforeSent > 0 || result.overdueSent > 0) {
                console.log(
                    `[jobs] BM01 reminder tick: scanned=${result.scanned}, beforeSent=${result.beforeSent}, overdueSent=${result.overdueSent}, skipped=${result.skipped}`,
                );
            }
        } catch (error) {
            console.error('[jobs] BM01 submission reminder scheduler failed:', error?.message || error);
        }
    };

    const initialTimer = setTimeout(run, 5000);
    const timer = setInterval(run, intervalMs());
    if (typeof initialTimer.unref === 'function') initialTimer.unref();
    if (typeof timer.unref === 'function') timer.unref();

    console.log(`[jobs] BM01 submission reminder scheduler started (every ${Math.round(intervalMs() / 60000)} minutes)`);
    return () => {
        clearTimeout(initialTimer);
        clearInterval(timer);
    };
};

module.exports = {
    processBm01SubmissionReminders,
    startBm01SubmissionReminderScheduler,
};
