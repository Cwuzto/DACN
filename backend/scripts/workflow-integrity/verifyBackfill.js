const prisma = require('../../src/config/database');
const { analyzeLegacyData } = require('./analyzeLegacyData');

async function verifyBackfill(db = prisma) {
    const [report, registrations, openCases] = await Promise.all([
        analyzeLegacyData(db),
        db.topicRegistration.findMany({ select: { id: true, periodPolicyVersionId: true } }),
        db.manualReviewCase.findMany({ where: { status: 'OPEN' }, select: { registrationId: true } }),
    ]);
    const pinnedRegistrationIds = new Set(registrations.filter((item) => item.periodPolicyVersionId !== null).map((item) => item.id));
    const reviewRegistrationIds = new Set(openCases.map((item) => item.registrationId));
    const accountedRegistrationIds = new Set([...pinnedRegistrationIds, ...reviewRegistrationIds]);
    const unaccountedRegistrationIds = registrations
        .filter((item) => !accountedRegistrationIds.has(item.id))
        .map((item) => item.id);
    return {
        totalRegistrations: report.total,
        pinnedPolicies: pinnedRegistrationIds.size,
        openManualReviewCases: reviewRegistrationIds.size,
        accountedFor: accountedRegistrationIds.size,
        unaccountedRegistrationIds,
        valid: unaccountedRegistrationIds.length === 0,
    };
}

if (require.main === module) {
    verifyBackfill()
        .then((report) => { console.log(JSON.stringify(report, null, 2)); process.exitCode = report.valid ? 0 : 1; })
        .catch((error) => { console.error(error.message); process.exitCode = 1; })
        .finally(async () => {
            await prisma.$disconnect();
            process.exit(process.exitCode || 0);
        });
}

module.exports = { verifyBackfill };
