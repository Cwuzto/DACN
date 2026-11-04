const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('../services/registrationTransitionService');
const { calculatePolicyDeadline } = require('../services/checkpointWorkflowService');

const DEFAULT_BATCH_SIZE = 100;
const SYSTEM_ACTOR_ID = 0;
const ADVISORY_LOCK_ID = 108032601;

async function tryAcquireAdvisoryLock(db) {
    if (typeof db.$queryRawUnsafe !== 'function') {
        return true;
    }
    try {
        const rows = await db.$queryRawUnsafe(`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) as locked`);
        const locked = rows?.[0]?.locked;
        return Boolean(locked);
    } catch (err) {
        return true;
    }
}

async function releaseAdvisoryLock(db) {
    if (typeof db.$queryRawUnsafe !== 'function') {
        return;
    }
    try {
        await db.$queryRawUnsafe(`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`);
    } catch (err) {
        // ignore unlock error on fallback/unsupported DB
    }
}

/**
 * Xử lý từng hồ sơ quá hạn chữ ký hoặc appeal Checkpoint với CAS bảo vệ và Transaction nguyên tử
 */
async function processRegistrationOverdue(reg, { db, now, actorId }) {
    const runInTx = async (tx) => {
        const status = reg.status;

        // CASE 1: Đang chờ sinh viên ký xác nhận biên bản BM03
        if (status === 'BM03_SIGNATURE_PENDING') {
            const evaluation = reg.checkpointEvaluations?.[0];
            if (!evaluation || evaluation.studentSignedAt) {
                return { skipped: true, reason: 'ALREADY_SIGNED_OR_NO_EVALUATION' };
            }

            if (!evaluation.studentSignDeadlineAt || now <= evaluation.studentSignDeadlineAt) {
                return { skipped: true, reason: 'NOT_OVERDUE' };
            }

            const isAppealed = Boolean(evaluation.isAppealed || evaluation.appeal?.status === 'APPROVED');

            if (isAppealed) {
                // Sinh viên đã từng khiếu nại gia hạn 1 lần nhưng tiếp tục quá hạn ký -> Dừng đề tài (INV-10, INV-26)
                await transitionRegistration({
                    registrationId: reg.id,
                    expectedStatus: 'BM03_SIGNATURE_PENDING',
                    expectedStateVersion: reg.stateVersion,
                    targetStatus: 'TERMINATED_FAILED_PROGRESS',
                    actorId,
                    reason: `Quá hạn ký BM03 Checkpoint ${evaluation.checkpointNo} sau khi đã được gia hạn khiếu nại (INV-10, INV-26)`,
                    idempotencyKey: `cp-overdue-worker:terminate-second:${reg.id}:${evaluation.id}:${reg.stateVersion}`,
                }, { tx });

                return { processed: true, action: 'TERMINATED_SECOND_OVERDUE' };
            }

            // Quá hạn ký lần đầu -> Mở hạn nộp khiếu nại chữ ký (chạy atomic trong cùng tx)
            const policy = reg.periodPolicyVersion?.policy || {};
            const appealWindowDays = Number(policy.appealWindowDays ?? policy.checkpointAppealWindowDays ?? 3);
            const appealDeadlineAt = calculatePolicyDeadline(now, appealWindowDays, policy);

            await tx.checkpointSignatureAppeal.upsert({
                where: { checkpointEvaluationId: evaluation.id },
                create: {
                    checkpointEvaluationId: evaluation.id,
                    registrationId: reg.id,
                    studentId: reg.studentId,
                    appealDeadlineAt,
                    status: 'PENDING',
                },
                update: {
                    appealDeadlineAt,
                    status: 'PENDING',
                },
            });

            await transitionRegistration({
                registrationId: reg.id,
                expectedStatus: 'BM03_SIGNATURE_PENDING',
                expectedStateVersion: reg.stateVersion,
                targetStatus: 'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
                actorId,
                reason: `Quá hạn ký biên bản Checkpoint ${evaluation.checkpointNo}. Mở hạn nộp khiếu nại chữ ký ${appealWindowDays} ngày.`,
                idempotencyKey: `cp-overdue-worker:open-appeal:${reg.id}:${evaluation.id}:${reg.stateVersion}`,
            }, { tx });

            return { processed: true, action: 'OPENED_APPEAL' };
        }

        // CASE 2: Đang mở hạn nộp khiếu nại chữ ký Checkpoint
        if (status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN') {
            const appeal = reg.checkpointSignatureAppeals?.[0] || reg.checkpointEvaluations?.[0]?.appeal;
            if (!appeal || appeal.status !== 'PENDING') {
                return { skipped: true, reason: 'APPEAL_ALREADY_SUBMITTED_OR_NONE' };
            }

            if (!appeal.appealDeadlineAt || now <= appeal.appealDeadlineAt) {
                return { skipped: true, reason: 'APPEAL_NOT_OVERDUE' };
            }

            // Hết hạn mở khiếu nại mà SV không nộp đơn -> Dừng đề tài (INV-10, INV-26)
            await transitionRegistration({
                registrationId: reg.id,
                expectedStatus: 'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
                expectedStateVersion: reg.stateVersion,
                targetStatus: 'TERMINATED_FAILED_PROGRESS',
                actorId,
                reason: `Quá hạn nộp đơn khiếu nại chữ ký Checkpoint (INV-10, INV-26)`,
                idempotencyKey: `cp-overdue-worker:terminate-unsubmitted-appeal:${reg.id}:${appeal.id}:${reg.stateVersion}`,
            }, { tx });

            return { processed: true, action: 'TERMINATED_UNSUBMITTED_APPEAL' };
        }

        return { skipped: true, reason: 'UNHANDLED_STATUS' };
    };

    if (typeof db.$transaction === 'function') {
        return await db.$transaction(runInTx);
    }
    return await runInTx(db);
}

/**
 * Runner chạy quét quá hạn Checkpoint
 * Hỗ trợ options: { db, now, batchSize, actorId } để testable 100%.
 */
async function runCheckpointDeadlineOverdueJob(options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
    const actorId = Number.isInteger(options.actorId) ? options.actorId : SYSTEM_ACTOR_ID;

    const hasLock = await tryAcquireAdvisoryLock(db);
    if (!hasLock) {
        return {
            skipped: true,
            reason: 'LOCKED_BY_ANOTHER_INSTANCE',
            scanned: 0,
            processedCount: 0,
            skippedCount: 0,
            errorCount: 0,
            processed: [],
            errors: [],
        };
    }

    try {
        const registrations = await db.topicRegistration.findMany({
            where: {
                status: { in: ['BM03_SIGNATURE_PENDING', 'CHECKPOINT_SIGNATURE_APPEAL_OPEN'] },
            },
            include: {
                checkpointEvaluations: {
                    orderBy: [
                        { checkpointNo: 'desc' },
                        { attemptNo: 'desc' },
                        { id: 'desc' },
                    ],
                    take: 1,
                    include: { appeal: true },
                },
                checkpointSignatureAppeals: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                periodPolicyVersion: {
                    select: { id: true, policy: true },
                },
            },
            take: batchSize,
        });

        const processed = [];
        const skipped = [];
        const errors = [];

        for (const reg of registrations) {
            try {
                const res = await processRegistrationOverdue(reg, { db, now, actorId });
                if (res.processed) {
                    processed.push(reg.id);
                } else if (res.skipped) {
                    skipped.push({ registrationId: reg.id, reason: res.reason || 'SKIPPED' });
                }
            } catch (error) {
                if (error?.code === 'STATE_VERSION_CONFLICT' || error?.message === 'STATE_VERSION_CONFLICT') {
                    // CAS Mismatch: Sinh viên ký hoặc trạng thái thay đổi đồng thời -> bỏ qua an toàn
                    skipped.push({ registrationId: reg.id, reason: 'CAS_MISMATCH' });
                } else {
                    errors.push({ registrationId: reg.id, error: error?.message || String(error) });
                }
            }
        }

        return {
            scanned: registrations.length,
            processedCount: processed.length,
            skippedCount: skipped.length,
            errorCount: errors.length,
            processed,
            skipped,
            errors,
        };
    } finally {
        await releaseAdvisoryLock(db);
    }
}

let isRunning = false;

const intervalMs = () => {
    const val = Number.parseInt(process.env.CHECKPOINT_DEADLINE_JOB_INTERVAL_MS, 10);
    return Number.isFinite(val) && val > 0 ? val : 15 * 60 * 1000;
};

const isEnabled = () => String(process.env.ENABLE_CHECKPOINT_DEADLINE_JOB || 'true').toLowerCase() !== 'false';

function startCheckpointDeadlineOverdueScheduler() {
    if (!isEnabled()) {
        return () => {};
    }
    const timer = setInterval(async () => {
        if (isRunning) {
            return;
        }
        isRunning = true;
        try {
            await runCheckpointDeadlineOverdueJob();
        } catch (err) {
            console.error('Error running checkpoint deadline overdue job:', err);
        } finally {
            isRunning = false;
        }
    }, intervalMs());

    return () => clearInterval(timer);
}

module.exports = {
    ADVISORY_LOCK_ID,
    runCheckpointDeadlineOverdueJob,
    startCheckpointDeadlineOverdueScheduler,
};
