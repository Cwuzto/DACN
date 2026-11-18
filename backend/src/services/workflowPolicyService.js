const crypto = require('crypto');
const prisma = require('../config/database');

const DEFAULT_POLICY = Object.freeze({
    revisionWindowDays: 3,
    bm01MaxResubmissions: 1,
    bm02MaxResubmissions: 1,
    checkpointStudentSignatureDays: 3,
    archiveStudentSubmissionDays: 14,
    archiveReviewDays: 7,
    archiveMaxResubmissions: 2,
});

function checksum(policy) {
    return crypto.createHash('sha256').update(JSON.stringify(policy)).digest('hex');
}

async function getActivePolicyVersion(semesterId, db = prisma) {
    return db.periodWorkflowPolicyVersion.findFirst({
        where: { semesterId, isActive: true },
        orderBy: { version: 'desc' },
    });
}

async function requireActivePolicyVersion(semesterId, db = prisma) {
    const policy = await getActivePolicyVersion(semesterId, db);
    if (!policy) {
        const error = new Error('WORKFLOW_POLICY_REQUIRED');
        error.code = 'WORKFLOW_POLICY_REQUIRED';
        error.status = 409;
        throw error;
    }
    return policy;
}

async function createPolicyVersion({ semesterId, policy = DEFAULT_POLICY, createdById }, db = prisma) {
    const runInTx = async (tx) => {
        if (tx.periodWorkflowPolicyVersion?.updateMany) {
            await tx.periodWorkflowPolicyVersion.updateMany({
                where: { semesterId, isActive: true },
                data: { isActive: false },
            });
        }

        const latest = await tx.periodWorkflowPolicyVersion.findFirst({
            where: { semesterId },
            orderBy: { version: 'desc' },
            select: { version: true },
        });

        return tx.periodWorkflowPolicyVersion.create({
            data: {
                semesterId,
                version: (latest?.version || 0) + 1,
                policy,
                checksum: checksum(policy),
                isActive: true,
                createdById: createdById || null,
            },
        });
    };

    if (typeof db.$transaction === 'function') {
        return db.$transaction(runInTx);
    }
    return runInTx(db);
}

module.exports = {
    DEFAULT_POLICY,
    checksum,
    getActivePolicyVersion,
    requireActivePolicyVersion,
    createPolicyVersion,
};
