const prisma = require('../../src/config/database');
const { DEFAULT_POLICY, checksum } = require('../../src/services/workflowPolicyService');
const { analyzeLegacyData } = require('./analyzeLegacyData');

const apply = process.argv.includes('--apply');
const cloneConfirmed = process.env.WORKFLOW_BACKFILL_DATABASE_CLONE === 'true';

async function ensurePolicy(semesterId, db) {
    const current = await db.periodWorkflowPolicyVersion.findFirst({
        where: { semesterId, isActive: true }, orderBy: { version: 'desc' },
    });
    if (current) return current;
    return db.periodWorkflowPolicyVersion.create({
        data: { semesterId, version: 1, policy: DEFAULT_POLICY, checksum: checksum(DEFAULT_POLICY) },
    });
}

async function backfillWorkflowFoundation(db = prisma) {
    const report = await analyzeLegacyData(db);
    if (!apply) return { mode: 'dry-run', ...report };
    if (!cloneConfirmed) throw new Error('Refusing apply: set WORKFLOW_BACKFILL_DATABASE_CLONE=true for a verified clone.');

    await db.$transaction(async (tx) => {
        const semesterIds = [...new Set([...report.safeToPin, ...report.manualReview].map((item) => item.semesterId))];
        const policies = new Map();
        for (const semesterId of semesterIds) policies.set(semesterId, await ensurePolicy(semesterId, tx));

        for (const semesterId of semesterIds) {
            const safeIds = report.safeToPin
                .filter((item) => item.semesterId === semesterId)
                .map((item) => item.registrationId);
            if (safeIds.length === 0) continue;
            await tx.topicRegistration.updateMany({
                where: { id: { in: safeIds }, periodPolicyVersionId: null },
                data: { periodPolicyVersionId: policies.get(semesterId).id },
            });
        }

        const manualIds = report.manualReview.map((item) => item.registrationId);
        const existingCases = manualIds.length > 0
            ? await tx.manualReviewCase.findMany({
                where: { registrationId: { in: manualIds }, status: 'OPEN' },
                select: { id: true, registrationId: true, reasonCodes: true },
            })
            : [];
        const existingByRegistration = new Map(existingCases.map((item) => [item.registrationId, item]));
        const newCases = report.manualReview
            .filter((item) => !existingByRegistration.has(item.registrationId))
            .map((item) => ({ registrationId: item.registrationId, reasonCodes: item.reasons }));
        if (newCases.length > 0) {
            await tx.manualReviewCase.createMany({ data: newCases, skipDuplicates: true });
        }
        for (const item of report.manualReview) {
            const existing = existingByRegistration.get(item.registrationId);
            if (existing && JSON.stringify(existing.reasonCodes) !== JSON.stringify(item.reasons)) {
                await tx.manualReviewCase.update({
                    where: { id: existing.id },
                    data: { reasonCodes: item.reasons },
                });
            }
        }
    }, { timeout: 30000 });
    return { mode: 'apply', ...report };
}

if (require.main === module) {
    backfillWorkflowFoundation()
        .then((report) => console.log(JSON.stringify(report, null, 2)))
        .catch((error) => { console.error(error.message); process.exitCode = 1; })
        .finally(async () => {
            await prisma.$disconnect();
            process.exit(process.exitCode || 0);
        });
}

module.exports = { backfillWorkflowFoundation, ensurePolicy };
