const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('../services/registrationTransitionService');
const { calculatePolicyDeadline } = require('../services/checkpointWorkflowService');

const DEFAULT_BATCH_SIZE = 100;
const SYSTEM_ACTOR_ID = 0;

/**
 * Xử lý từng hồ sơ quá hạn chữ ký hoặc appeal Checkpoint với CAS bảo vệ
 */
async function processRegistrationOverdue(reg, { db, now, actorId }) {
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
            }, { db });

            return { processed: true, action: 'TERMINATED_SECOND_OVERDUE' };
        }

        // Quá hạn ký lần đầu -> Mở hạn nộp khiếu nại chữ ký
        const policy = reg.periodPolicyVersion?.policy || {};
        const appealWindowDays = Number(policy.appealWindowDays ?? policy.checkpointAppealWindowDays ?? 3);
        const appealDeadlineAt = calculatePolicyDeadline(now, appealWindowDays, policy);

        await db.checkpointSignatureAppeal.upsert({
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
        }, { db });

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
        }, { db });

        return { processed: true, action: 'TERMINATED_UNSUBMITTED_APPEAL' };
    }

    return { skipped: true, reason: 'UNHANDLED_STATUS' };
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

    const registrations = await db.topicRegistration.findMany({
        where: {
            status: { in: ['BM03_SIGNATURE_PENDING', 'CHECKPOINT_SIGNATURE_APPEAL_OPEN'] },
        },
        include: {
            checkpointEvaluations: {
                orderBy: { attemptNo: 'desc' },
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
}

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
        try {
            await runCheckpointDeadlineOverdueJob();
        } catch (err) {
            console.error('Error running checkpoint deadline overdue job:', err);
        }
    }, intervalMs());

    return () => clearInterval(timer);
}

module.exports = {
    runCheckpointDeadlineOverdueJob,
    startCheckpointDeadlineOverdueScheduler,
};
