const prisma = require('../config/database');
const { computeDefenseTimeWindows } = require('../utils/defenseTimeWindowUtils');
const {
    captureDefenseZeroHourSnapshot,
    closeArchiveWindowAtDay15,
} = require('./defenseDossierService');

const REQUIRED_DOCUMENT_TYPES = ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'];

/**
 * Sweeps automated scheduled tasks for Defense to Completion:
 * 1. Soft deadline pre-defense reminder (-3d 00:00) for registrations missing any of 4 files.
 * 2. Automatic capture of DEFENSE_SNAPSHOT at 00:00 on defense day.
 * 3. In-window archival reminders (+8d/7d left, +12d/3d left, +14d/24h left).
 * 4. Automatic Day 15 (00:00) ARCHIVE_FINAL_SNAPSHOT capture, window closure, and transition to ARCHIVE_INCOMPLETE if missing files.
 *
 * Strictly idempotent: multiple sweeps at the same moment produce 0 duplicate records/reminders.
 *
 * @param {object} [input]
 * @param {Date | string} [input.now]
 * @param {object} [options]
 * @param {object} [options.db]
 * @returns {Promise<{ softRemindersSent: number, defenseSnapshotsCaptured: number, windowRemindersSent: number, windowsClosed: number, markedIncomplete: number }>}
 */
async function runDefenseAndArchivalSweep(input = {}, options = {}) {
    const db = options.db || options.tx || prisma;
    const now = input.now ? new Date(input.now) : (options.now ? new Date(options.now) : new Date());

    let softRemindersSent = 0;
    let defenseSnapshotsCaptured = 0;
    let windowRemindersSent = 0;
    let windowsClosed = 0;
    let markedIncomplete = 0;

    // Fetch candidate registrations having a defense council with a defenseDate
    const registrations = await db.topicRegistration.findMany({
        where: {
            defenseCouncil: {
                defenseDate: { not: null },
            },
            status: {
                in: [
                    'DEFENSE_READY',
                    'AWAITING_SCORES',
                    'AWAITING_FINAL_APPROVAL',
                    'DEFENSE_PASSED',
                    'PENDING_INSTITUTE_SIGNATURE',
                    'SUBMITTED',
                    'DEFENDED',
                ],
            },
        },
        include: {
            defenseCouncil: true,
            archive: true,
            student: true,
            topic: true,
        },
    });

    for (const reg of registrations) {
        const defenseDate = reg.defenseCouncil?.defenseDate;
        if (!defenseDate) continue;

        const windows = computeDefenseTimeWindows(defenseDate);

        // Fetch uploaded versions up to now
        const uploadedVersions = await db.defenseDocumentVersion.findMany({
            where: {
                registrationId: reg.id,
                uploadedAt: { lte: now },
            },
            select: { documentType: true },
        });
        const uploadedTypes = new Set(uploadedVersions.map((v) => v.documentType));
        const missingTypes = REQUIRED_DOCUMENT_TYPES.filter((t) => !uploadedTypes.has(t));

        // -------------------------------------------------------------
        // Task 1: Pre-defense 3-Day Soft Deadline Reminder (-3d 00:00)
        // -------------------------------------------------------------
        if (now >= windows.softPreparationDeadlineAt && now < windows.defenseSnapshotAt) {
            if (missingTypes.length > 0) {
                const milestoneRef = `/student/defense/dossier?reg=${reg.id}&milestone=SOFT_DEADLINE`;
                const existingNotif = await db.notification.findFirst({
                    where: {
                        userId: reg.studentId,
                        referenceUrl: { contains: 'milestone=SOFT_DEADLINE' },
                    },
                });

                if (!existingNotif) {
                    await db.notification.create({
                        data: {
                            userId: reg.studentId,
                            type: 'TASK_REMINDER',
                            title: 'Nhắc nhở nộp tài liệu chuẩn bị bảo vệ (Hạn mềm)',
                            content: `Đã qua mốc 00:00 trước ngày bảo vệ 3 ngày. Bạn còn thiếu các tài liệu: ${missingTypes.join(', ')}. Vui lòng bổ sung sớm trước 00:00 ngày bảo vệ.`,
                            referenceUrl: milestoneRef,
                        },
                    });
                    softRemindersSent++;
                }
            }
        }

        // -------------------------------------------------------------
        // Task 2: Capture DEFENSE_SNAPSHOT at 00:00 Defense Day
        // -------------------------------------------------------------
        if (now >= windows.defenseSnapshotAt) {
            const existingSnapshot = await db.defenseDocumentSnapshot.findUnique({
                where: {
                    registrationId_snapshotType: {
                        registrationId: reg.id,
                        snapshotType: 'DEFENSE_SNAPSHOT',
                    },
                },
            });

            if (!existingSnapshot) {
                await captureDefenseZeroHourSnapshot(reg.id, {
                    capturedAt: windows.defenseSnapshotAt,
                    tx: db,
                });
                defenseSnapshotsCaptured++;
            }
        }

        // -------------------------------------------------------------
        // Task 3: In-window Reminders (7 days, 3 days, 24 hours before closure)
        // -------------------------------------------------------------
        if (now >= windows.defenseSnapshotAt && now < windows.windowClosesAt) {
            const isRevisionRequired = reg.archive?.mentorReviewStatus === 'REVISION_REQUIRED' ||
                reg.archive?.academicAffairsReviewStatus === 'REVISION_REQUIRED';
            const hasPendingUploads = missingTypes.length > 0 || isRevisionRequired;

            if (hasPendingUploads) {
                let milestoneKey = null;
                let milestoneLabel = null;

                if (now >= windows.reminder24hAt) {
                    milestoneKey = 'REMINDER_24H';
                    milestoneLabel = '24 giờ';
                } else if (now >= windows.reminder3dAt) {
                    milestoneKey = 'REMINDER_3D';
                    milestoneLabel = '3 ngày';
                } else if (now >= windows.reminder7dAt) {
                    milestoneKey = 'REMINDER_7D';
                    milestoneLabel = '7 ngày';
                }

                if (milestoneKey) {
                    const milestoneRef = `/student/defense/dossier?reg=${reg.id}&milestone=${milestoneKey}`;
                    const existingNotif = await db.notification.findFirst({
                        where: {
                            userId: reg.studentId,
                            referenceUrl: { contains: `milestone=${milestoneKey}` },
                        },
                    });

                    if (!existingNotif) {
                        const reasonText = isRevisionRequired
                            ? 'Người duyệt yêu cầu chỉnh sửa tài liệu lưu chiểu.'
                            : `Hồ sơ còn thiếu các tài liệu: ${missingTypes.join(', ')}.`;

                        await db.notification.create({
                            data: {
                                userId: reg.studentId,
                                type: 'TASK_REMINDER',
                                title: `Nhắc nhở nộp hồ sơ lưu chiểu (Còn ${milestoneLabel})`,
                                content: `Cổng nộp lưu chiểu sẽ đóng vĩnh viễn lúc 00:00 ngày thứ 15 sau ngày bảo vệ. ${reasonText}`,
                                referenceUrl: milestoneRef,
                            },
                        });
                        windowRemindersSent++;
                    }
                }
            }
        }

        // -------------------------------------------------------------
        // Task 4: Window Closure at Day 15 (00:00) & ARCHIVE_INCOMPLETE
        // -------------------------------------------------------------
        if (now >= windows.windowClosesAt) {
            const isWindowAlreadyClosed = reg.archive?.windowClosedAt != null;
            const existingFinalSnapshot = await db.defenseDocumentSnapshot.findUnique({
                where: {
                    registrationId_snapshotType: {
                        registrationId: reg.id,
                        snapshotType: 'ARCHIVE_FINAL_SNAPSHOT',
                    },
                },
            });

            if (!isWindowAlreadyClosed || !existingFinalSnapshot) {
                const closeResult = await closeArchiveWindowAtDay15(reg.id, {
                    closedAt: windows.windowClosesAt,
                    tx: db,
                });
                windowsClosed++;
                if (closeResult.transitionedStatus === 'ARCHIVE_INCOMPLETE') {
                    markedIncomplete++;
                }
            }
        }
    }

    return {
        softRemindersSent,
        defenseSnapshotsCaptured,
        windowRemindersSent,
        windowsClosed,
        markedIncomplete,
    };
}

module.exports = {
    runDefenseAndArchivalSweep,
};
