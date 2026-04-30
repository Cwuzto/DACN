const prisma = require('../config/database');
const {
    PENDING_REMINDER_DAYS,
    AUTO_REJECT_PENDING_DAYS,
    AUTO_REJECT_REASON_STALE,
    AUTO_REJECT_REASON_DEADLINE,
} = require('../constants/registrationLimits');
const { safeNotify } = require('../services/notificationService');
const { auditLog } = require('../services/auditLogService');

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

const getAutoRejectCutoffDate = () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - AUTO_REJECT_PENDING_DAYS);
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
                title: 'Nhắc xử lý đăng ký đề tài đang chờ duyệt',
                content: `Sinh viên ${registration.student?.fullName || 'N/A'} (${registration.student?.code || 'N/A'}) đang chờ duyệt đề tài "${registration.topic.title}" trong ${pendingDays} ngày (học kỳ: ${registration.topic?.semester?.name || 'N/A'}).`,
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

const runPendingRegistrationAutoRejectJob = async () => {
    const now = new Date();
    const staleCutoffDate = getAutoRejectCutoffDate();

    const pendingRegistrations = await prisma.topicRegistration.findMany({
        where: {
            status: 'PENDING',
            OR: [
                { createdAt: { lte: staleCutoffDate } },
                { topic: { semester: { registrationDeadline: { lt: now } } } },
            ],
        },
        include: {
            student: { select: { id: true, fullName: true, code: true } },
            topic: {
                select: {
                    title: true,
                    mentorId: true,
                    semester: { select: { name: true, registrationDeadline: true } },
                },
            },
        },
        orderBy: { createdAt: 'asc' },
    });

    if (!pendingRegistrations.length) {
        return { processed: 0, rejected: 0, notified: 0, auditLogged: 0 };
    }

    let rejected = 0;
    let notified = 0;
    let auditLogged = 0;

    for (const registration of pendingRegistrations) {
        const isOverDeadline = Boolean(
            registration.topic?.semester?.registrationDeadline
            && new Date(registration.topic.semester.registrationDeadline).getTime() < now.getTime(),
        );

        const rejectReason = isOverDeadline ? AUTO_REJECT_REASON_DEADLINE : AUTO_REJECT_REASON_STALE;

        const updated = await prisma.topicRegistration.updateMany({
            where: {
                id: registration.id,
                status: 'PENDING',
            },
            data: {
                status: 'REJECTED',
                rejectReason,
            },
        });

        if (!updated.count) {
            continue;
        }

        rejected += 1;

        const notifyResults = await Promise.all([
            safeNotify(
                {
                    userId: registration.studentId,
                    title: 'Đăng ký đề tài đã được tự động từ chối',
                    content: `Đăng ký đề tài "${registration.topic?.title || 'N/A'}" đã được hệ thống tự động từ chối. Lý do: ${rejectReason}`,
                    type: 'APPROVAL',
                },
                'pendingRegistrationAutoRejectJob_student',
            ),
            registration.topic?.mentorId
                ? safeNotify(
                    {
                        userId: registration.topic.mentorId,
                        title: 'Hệ thống đã tự động từ chối đăng ký chờ duyệt quá hạn',
                        content: `Đăng ký của sinh viên ${registration.student?.fullName || 'N/A'} (${registration.student?.code || 'N/A'}) cho đề tài "${registration.topic?.title || 'N/A'}" đã bị tự động từ chối. Lý do: ${rejectReason}`,
                        type: 'REGISTRATION',
                    },
                    'pendingRegistrationAutoRejectJob_mentor',
                )
                : Promise.resolve({ ok: false, skipped: true }),
        ]);

        notified += notifyResults.filter((r) => r?.ok).length;

        if (registration.topic?.mentorId) {
            await auditLog(
                registration.topic.mentorId,
                'AUTO_REJECT_REGISTRATION',
                'TopicRegistration',
                registration.id,
                {
                    reason: rejectReason,
                    source: 'pendingRegistrationAutoRejectJob',
                    semesterName: registration.topic?.semester?.name || null,
                },
                null,
            );
            auditLogged += 1;
        }
    }

    return {
        processed: pendingRegistrations.length,
        rejected,
        notified,
        auditLogged,
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
            const [reminderResult, autoRejectResult] = await Promise.all([
                runPendingRegistrationReminderJob(),
                runPendingRegistrationAutoRejectJob(),
            ]);

            if (reminderResult.sent > 0 || reminderResult.processed > 0) {
                console.log(`[jobs] Pending reminder tick: processed=${reminderResult.processed}, sent=${reminderResult.sent}, skipped=${reminderResult.skipped}`);
            }

            if (autoRejectResult.rejected > 0 || autoRejectResult.processed > 0) {
                console.log(`[jobs] Pending auto-reject tick: processed=${autoRejectResult.processed}, rejected=${autoRejectResult.rejected}, notified=${autoRejectResult.notified}, auditLogged=${autoRejectResult.auditLogged}`);
            }
        } catch (error) {
            console.error('[jobs] Pending registration scheduler failed:', error?.message || error);
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
    runPendingRegistrationAutoRejectJob,
    startPendingRegistrationReminderScheduler,
};
