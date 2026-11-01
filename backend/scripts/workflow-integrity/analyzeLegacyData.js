const prisma = require('../../src/config/database');

const SAFE_EARLY_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'DROPPED']);

function classifyRegistration(registration) {
    const reasons = [];
    const tasks = registration.tasks || [];
    if (tasks.some((task) => task.isBypassed || task.bypassReason || task.bypassedBy)) reasons.push('LEGACY_BYPASS_EVIDENCE');
    if (!SAFE_EARLY_STATUSES.has(registration.status)) reasons.push('STATUS_REQUIRES_EVIDENCE_REVIEW');
    if (['DECISION_ISSUED', 'IN_PROGRESS', 'IN_PROGRESS_BM03', 'BM03_PASSED', 'DEFENSE_READY', 'SUBMITTED', 'DEFENDED', 'COMPLETED'].includes(registration.status)
        && !registration.decisionNumber) reasons.push('MISSING_DECISION_EVIDENCE');
    if (['DEFENDED', 'COMPLETED'].includes(registration.status) && (registration.memberScores || []).length !== 3) reasons.push('INVALID_DEFENSE_SCORE_EVIDENCE');
    if (registration.status === 'COMPLETED' && registration.archive?.status !== 'APPROVED') reasons.push('ARCHIVE_EVIDENCE_CONFLICT');
    return reasons;
}

async function analyzeLegacyData(db = prisma) {
    // This analyzer must run before the new migrations. Raw, fixed SQL avoids
    // Prisma selecting columns from the newer client schema that do not exist
    // yet in a legacy database.
    const columnRows = await db.$queryRaw`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('topic_registrations', 'tasks', 'defense_member_scores', 'project_archives')
    `;
    const columnsByTable = new Map();
    for (const row of columnRows) {
        if (!columnsByTable.has(row.table_name)) columnsByTable.set(row.table_name, new Set());
        columnsByTable.get(row.table_name).add(row.column_name);
    }
    const registrationColumns = columnsByTable.get('topic_registrations') || new Set();
    if (!['id', 'semester_id', 'status'].every((column) => registrationColumns.has(column))) {
        throw new Error('LEGACY_SCHEMA_UNSUPPORTED: topic_registrations is missing required baseline columns.');
    }

    const registrationRows = registrationColumns.has('decision_number')
        ? await db.$queryRaw`
            SELECT id, semester_id, status::text AS status, decision_number
            FROM topic_registrations
            ORDER BY id ASC
        `
        : await db.$queryRaw`
            SELECT id, semester_id, status::text AS status, NULL::text AS decision_number
            FROM topic_registrations
            ORDER BY id ASC
        `;

    const tasksByRegistration = new Map();
    const taskColumns = columnsByTable.get('tasks') || new Set();
    if (['registration_id', 'is_bypassed', 'bypass_reason', 'bypassed_by'].every((column) => taskColumns.has(column))) {
        const taskRows = await db.$queryRaw`
            SELECT registration_id, is_bypassed, bypass_reason, bypassed_by
            FROM tasks
        `;
        for (const task of taskRows) {
            if (!tasksByRegistration.has(task.registration_id)) tasksByRegistration.set(task.registration_id, []);
            tasksByRegistration.get(task.registration_id).push({
                isBypassed: task.is_bypassed,
                bypassReason: task.bypass_reason,
                bypassedBy: task.bypassed_by,
            });
        }
    }

    const scoreCounts = new Map();
    const scoreColumns = columnsByTable.get('defense_member_scores') || new Set();
    if (scoreColumns.has('registration_id')) {
        const scoreRows = await db.$queryRaw`
            SELECT registration_id, COUNT(*)::integer AS score_count
            FROM defense_member_scores
            GROUP BY registration_id
        `;
        for (const row of scoreRows) scoreCounts.set(row.registration_id, row.score_count);
    }

    const archivesByRegistration = new Map();
    const archiveColumns = columnsByTable.get('project_archives') || new Set();
    if (archiveColumns.has('registration_id') && archiveColumns.has('status')) {
        const archiveRows = await db.$queryRaw`
            SELECT registration_id, status::text AS status
            FROM project_archives
        `;
        for (const row of archiveRows) archivesByRegistration.set(row.registration_id, { status: row.status });
    }

    const registrations = registrationRows.map((row) => ({
        id: row.id,
        semesterId: row.semester_id,
        status: row.status,
        decisionNumber: row.decision_number,
        tasks: tasksByRegistration.get(row.id) || [],
        memberScores: Array.from({ length: scoreCounts.get(row.id) || 0 }, (_, index) => ({ id: index + 1 })),
        archive: archivesByRegistration.get(row.id) || null,
    }));
    const cases = registrations.map((registration) => ({
        registrationId: registration.id,
        semesterId: registration.semesterId,
        status: registration.status,
        reasons: classifyRegistration(registration),
    }));
    return {
        total: cases.length,
        safeToPin: cases.filter((item) => item.reasons.length === 0),
        manualReview: cases.filter((item) => item.reasons.length > 0),
    };
}

if (require.main === module) {
    analyzeLegacyData()
        .then((report) => console.log(JSON.stringify(report, null, 2)))
        .catch((error) => { console.error(error.message); process.exitCode = 1; })
        .finally(async () => {
            await prisma.$disconnect();
            process.exit(process.exitCode || 0);
        });
}

module.exports = { SAFE_EARLY_STATUSES, classifyRegistration, analyzeLegacyData };
