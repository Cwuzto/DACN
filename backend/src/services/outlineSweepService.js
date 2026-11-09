const prisma = require('../config/database');

/**
 * Check if a council's resubmission deadline has passed.
 * Read-only helper without side-effects (safe for GET queries).
 *
 * @param {object} council
 * @param {Date} [now]
 * @returns {boolean}
 */
function isResubmissionOverdue(council, now = new Date()) {
    if (!council?.revisionSubmissionDeadline) return false;
    return new Date(council.revisionSubmissionDeadline) < new Date(now);
}

/**
 * Idempotent sweep job that sweeps all councils with expired resubmission deadlines
 * and terminates students who failed to resubmit their outlines.
 *
 * @param {object} [options]
 * @returns {Promise<{ terminatedCount: number, affectedRegistrationIds: number[] }>}
 */
async function runOutlineOverdueSweep(options = {}) {
    const db = options.db || prisma;
    const now = options.now ? new Date(options.now) : new Date();

    return db.$transaction(async (tx) => {
        const candidates = await tx.topicRegistration.findMany({
            where: {
                status: 'BM01_NEEDS_REVISION',
                outlineCouncil: {
                    revisionSubmissionDeadline: {
                        lt: now,
                    },
                },
            },
            include: {
                outlineCouncil: true,
                bm01Evaluations: {
                    orderBy: { attemptNo: 'desc' },
                    take: 1,
                },
                tasks: {
                    where: {
                        taskType: 'BM01_RESUBMISSION',
                        status: 'OPEN',
                    },
                },
            },
        });

        const overdueRegistrations = candidates.filter((reg) => {
            const latestEval = reg.bm01Evaluations?.[0];
            return !latestEval?.revisionSubmissionId;
        });

        if (overdueRegistrations.length === 0) {
            return { terminatedCount: 0, affectedRegistrationIds: [] };
        }

        const regIds = overdueRegistrations.map((r) => r.id);
        const evalIds = overdueRegistrations
            .map((r) => r.bm01Evaluations?.[0]?.id)
            .filter(Boolean);
        const taskIds = overdueRegistrations
            .flatMap((r) => r.tasks?.map((t) => t.id) || [])
            .filter(Boolean);

        await tx.topicRegistration.updateMany({
            where: { id: { in: regIds } },
            data: { status: 'TERMINATED_BM01' },
        });

        if (taskIds.length > 0) {
            await tx.task.updateMany({
                where: { id: { in: taskIds } },
                data: { status: 'OVERDUE' },
            });
        }

        if (evalIds.length > 0) {
            await tx.bM01Evaluation.updateMany({
                where: { id: { in: evalIds } },
                data: {
                    outcome: 'TERMINATED',
                    revisionApprovalStatus: 'REJECTED',
                },
            });
        }

        return {
            terminatedCount: regIds.length,
            affectedRegistrationIds: regIds,
        };
    });
}

module.exports = {
    isResubmissionOverdue,
    runOutlineOverdueSweep,
};
