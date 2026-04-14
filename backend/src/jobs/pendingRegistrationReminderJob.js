const prisma = require('../config/database');
const { PENDING_REMINDER_DAYS } = require('../constants/registrationLimits');
const { safeNotify } = require('../services/notificationService');

const DEFAULT_INTERVAL_MINUTES = 60;
const REFERENCE_PREFIX = 'pending-registration-reminder';

const toStartOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getPendingCutoffDate = () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PENDING_REMINDER_DAYS);
    return cutoff;
};

const getDayKey = (date = new Date()) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const buildReferenceUrl = (registrationId, dayKey) => `${REFERENCE_PREFIX}:${registrationId}:${dayKey}`;

const runPendingRegistrationReminderJob = async () => {
    const cutoffDate = getPendingCutoffDate();
    const dayStart = toStartOfDay(new Date());
    const dayKey = getDayKey();

    const stalePendingRegistrations = await prisma.topicRegistration.findMany({
        where: {
            status: 'PENDING',
            createdAt: { lte: cutoffDate },
        },
        include: {
            student: { select: { fullName: true, code: true } },
            topic: {
                select: {
                    id: true,
                    title: true,
                    mentorId: true,
                    semester: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: { createdAt: 'asc' },
    });

    if (!stalePendingRegistrations.length) {
        return { processed: 0, sent: 0, skipped: 0 };
    }

    let sent = 0;
    let skipped = 0;

    for (const registration of stalePendingRegistrations) {
        if (!registration.topic?.mentorId) {
            skipped += 1;
            continue;
        }

        const referenceUrl = buildReferenceUrl(registration.id, dayKey);
        const existingReminder = await prisma.notification.findFirst({
            where: {
                userId: registration.topic.mentorId,
                type: 'REGISTRATION',
                referenceUrl,
                createdAt: { gte: dayStart },
            },
            select: { id: true },
        });

        if (existingReminder) {
            skipped += 1;
            continue;
        }

        const pendingDays = Math.floor((Date.now() - new Date(registration.createdAt).getTime()) / (1000 * 60 * 60 * 24));

        await safeNotify(
            {
                userId: registration.topic.mentorId,
                title: 'Nhac xu ly dang ky de tai dang cho duyet',
                content: `Sinh vien ${registration.student?.fullName || 'N/A'} (${registration.student?.code || 'N/A'}) dang cho duyet de tai "${registration.topic.title}" trong ${pendingDays} ngay (hoc ky: ${registration.topic?.semester?.name || 'N/A'}).`,
                type: 'REGISTRATION',
                referenceUrl,
            },
            'pendingRegistrationReminderJob',
        );

        sent += 1;
    }

    return {
        processed: stalePendingRegistrations.length,
        sent,
        skipped,
    };
};

const startPendingRegistrationReminderScheduler = () => {
    const enabled = process.env.ENABLE_PENDING_REMINDER_JOB !== 'false';
    if (!enabled) {
        console.log('[jobs] Pending reminder job is disabled via ENABLE_PENDING_REMINDER_JOB=false');
        return () => {};
    }

    const intervalMinutes = Number.parseInt(process.env.PENDING_REMINDER_INTERVAL_MINUTES || `${DEFAULT_INTERVAL_MINUTES}`, 10);
    const intervalMs = Number.isInteger(intervalMinutes) && intervalMinutes > 0
        ? intervalMinutes * 60 * 1000
        : DEFAULT_INTERVAL_MINUTES * 60 * 1000;

    let isRunning = false;

    const tick = async () => {
        if (isRunning) return;
        isRunning = true;
        try {
            const result = await runPendingRegistrationReminderJob();
            if (result.sent > 0 || result.processed > 0) {
                console.log(`[jobs] Pending reminder tick: processed=${result.processed}, sent=${result.sent}, skipped=${result.skipped}`);
            }
        } catch (error) {
            console.error('[jobs] Pending reminder job failed:', error?.message || error);
        } finally {
            isRunning = false;
        }
    };

    setTimeout(tick, 10 * 1000);
    const timer = setInterval(tick, intervalMs);

    console.log(`[jobs] Pending reminder scheduler started (every ${Math.round(intervalMs / 60000)} minutes)`);

    return () => clearInterval(timer);
};

module.exports = {
    runPendingRegistrationReminderJob,
    startPendingRegistrationReminderScheduler,
};
