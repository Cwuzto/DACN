const prisma = require('../../src/config/database');
const { auditLog } = require('../../src/services/auditLogService');

const POST_DEFENSE_STATUSES = new Set(['DEFENSE_PASSED', 'DEFENDED', 'COMPLETED']);

/**
 * Classifies an archive record based on its registration status.
 * - If registration status is DEFENSE_PASSED, DEFENDED, or COMPLETED -> POST_DEFENSE.
 * - If registration is missing or in any other pre-defense / unverified status -> flags for manual review.
 */
function classifyArchiveRecord(archive, registration) {
    if (!registration) {
        return {
            requiresManualReview: true,
            phase: null,
            reasons: ['MISSING_REGISTRATION_FOR_ARCHIVE'],
        };
    }

    if (POST_DEFENSE_STATUSES.has(registration.status)) {
        return {
            requiresManualReview: false,
            phase: 'POST_DEFENSE',
            reasons: [],
        };
    }

    return {
        requiresManualReview: true,
        phase: null,
        reasons: ['UNVERIFIED_LEGACY_ARCHIVE_PHASE'],
    };
}

/**
 * Backfills archive phase for legacy records.
 * Supports both dry-run and apply mode.
 */
async function backfillArchivePhases({ dryRun = true, db = prisma, actorId = null } = {}) {
    if (!actorId) {
        if (typeof db?.user?.findFirst === 'function') {
            const adminUser = await db.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } }).catch(() => null);
            actorId = adminUser?.id || 1;
        } else {
            actorId = 1;
        }
    }

    const archives = await db.projectArchive.findMany({
        include: {
            registration: true,
        },
        orderBy: { id: 'asc' },
    });

    const safeToPostDefense = [];
    const manualReviewRecords = [];

    for (const archive of archives) {
        const registration = archive.registration;
        const classification = classifyArchiveRecord(archive, registration);

        if (classification.requiresManualReview) {
            manualReviewRecords.push({
                archiveId: archive.id,
                registrationId: archive.registrationId,
                reasons: classification.reasons,
                archiveStatus: archive.status,
                registrationStatus: registration?.status || 'UNKNOWN',
                submittedAt: archive.submittedAt,
            });
        } else if (classification.phase === 'POST_DEFENSE') {
            safeToPostDefense.push({
                archiveId: archive.id,
                registrationId: archive.registrationId,
                phase: 'POST_DEFENSE',
            });
        }
    }

    if (dryRun) {
        return {
            mode: 'dry-run',
            totalArchives: archives.length,
            postDefenseCount: safeToPostDefense.length,
            manualReviewCount: manualReviewRecords.length,
            safeToPostDefense,
            manualReviewRecords,
        };
    }

    await db.$transaction(async (tx) => {
        // 1. Update archives safe for POST_DEFENSE
        for (const item of safeToPostDefense) {
            await tx.projectArchive.update({
                where: { id: item.archiveId },
                data: { phase: 'POST_DEFENSE' },
            });
        }

        // 2. Open ManualReviewCases for unverified records
        const registrationIds = [...new Set(manualReviewRecords.map((r) => r.registrationId).filter(Boolean))];
        const existingCases = registrationIds.length > 0
            ? await tx.manualReviewCase.findMany({
                where: { registrationId: { in: registrationIds }, status: 'OPEN' },
                select: { id: true, registrationId: true, reasonCodes: true, evidence: true },
            })
            : [];
        const existingMap = new Map(existingCases.map((c) => [c.registrationId, c]));

        const newCases = [];
        for (const item of manualReviewRecords) {
            if (!item.registrationId) continue;
            const existing = existingMap.get(item.registrationId);
            if (!existing) {
                newCases.push({
                    registrationId: item.registrationId,
                    reasonCodes: item.reasons,
                    evidence: {
                        archiveId: item.archiveId,
                        registrationStatus: item.registrationStatus,
                        archiveStatus: item.archiveStatus,
                        submittedAt: item.submittedAt,
                        flaggedAt: new Date().toISOString(),
                        migration: '20261105020000_add_pre_defense_archive_phase',
                    },
                    status: 'OPEN',
                });
            } else {
                const currentCodes = Array.isArray(existing.reasonCodes) ? existing.reasonCodes : [];
                const mergedCodes = [...new Set([...currentCodes, ...item.reasons])];
                if (JSON.stringify(currentCodes) !== JSON.stringify(mergedCodes)) {
                    await tx.manualReviewCase.update({
                        where: { id: existing.id },
                        data: {
                            reasonCodes: mergedCodes,
                            evidence: {
                                ...(existing.evidence || {}),
                                archivePhaseReview: {
                                    archiveId: item.archiveId,
                                    reasons: item.reasons,
                                    flaggedAt: new Date().toISOString(),
                                },
                            },
                        },
                    });
                }
            }
        }

        if (newCases.length > 0) {
            await tx.manualReviewCase.createMany({
                data: newCases,
                skipDuplicates: true,
            });
        }
    });

    // 3. Record audit log
    try {
        await auditLog(
            actorId || 1,
            'BACKFILL_ARCHIVE_PHASES',
            'PROJECT_ARCHIVE',
            null,
            {
                postDefenseCount: safeToPostDefense.length,
                manualReviewCount: manualReviewRecords.length,
                timestamp: new Date().toISOString(),
            }
        );
    } catch (_) {}

    return {
        mode: 'apply',
        totalArchives: archives.length,
        postDefenseCount: safeToPostDefense.length,
        manualReviewCount: manualReviewRecords.length,
        safeToPostDefense,
        manualReviewRecords,
    };
}

if (require.main === module) {
    const apply = process.argv.includes('--apply') || process.argv.includes('--dry-run=false');
    const dryRunArg = process.argv.includes('--dry-run') && !process.argv.includes('--dry-run=false');
    const dryRun = dryRunArg ? true : !apply;
    const actorArg = process.argv.find((a) => a.startsWith('--actor-id='));
    const actorId = actorArg ? parseInt(actorArg.split('=')[1], 10) : null;

    console.log(`[backfillArchivePhases] Running in ${dryRun ? 'DRY-RUN' : 'APPLY'} mode...`);
    backfillArchivePhases({ dryRun, actorId })
        .then((summary) => {
            console.log('[backfillArchivePhases] Summary:', JSON.stringify(summary, null, 2));
            process.exit(0);
        })
        .catch((err) => {
            console.error('[backfillArchivePhases] Error:', err);
            process.exit(1);
        });
}

module.exports = {
    POST_DEFENSE_STATUSES,
    classifyArchiveRecord,
    backfillArchivePhases,
};
