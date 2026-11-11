const crypto = require('crypto');
const prisma = require('../config/database');
const { computeDefenseTimeWindows } = require('../utils/defenseTimeWindowUtils');
const { resolveEffectiveTopicTitle } = require('./topicTitleResolverService');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');

const ALLOWED_DOCUMENT_TYPES = ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'];

async function runWithTx(customTx, callback) {
    if (customTx) {
        return callback(customTx);
    }
    return prisma.$transaction(callback);
}

/**
 * Upload một phiên bản tài liệu bảo vệ / lưu chiểu số (REPORT_WORD, REPORT_PDF, DEMO_VIDEO, SLIDE_PPTX).
 *
 * @param {object} params
 * @param {number} params.registrationId
 * @param {string} params.documentType
 * @param {string} params.fileUrl
 * @param {string} params.fileName
 * @param {number} [params.fileSizeBytes]
 * @param {string} [params.checksum]
 * @param {number} params.actorId
 * @param {Date | string} [params.now]
 * @param {object} [params.tx]
 * @returns {Promise<{ version: object, archive: object, warnings: string[] }>}
 */
async function uploadDefenseDocumentVersion(params) {
    const {
        registrationId,
        documentType,
        fileUrl,
        fileName,
        fileSizeBytes,
        checksum,
        actorId,
        now = new Date(),
        tx: customTx,
    } = params;

    const parsedRegId = parseInt(registrationId, 10);
    if (!Number.isInteger(parsedRegId) || parsedRegId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }

    if (!documentType || !ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
        throw new WorkflowTransitionError(
            'INVALID_DOCUMENT_TYPE',
            400,
            'Loại tài liệu không hợp lệ. Chỉ chấp nhận REPORT_WORD, REPORT_PDF, DEMO_VIDEO, SLIDE_PPTX.',
        );
    }

    if (!fileUrl || typeof fileUrl !== 'string' || !fileUrl.trim()) {
        throw new WorkflowTransitionError('FILE_URL_REQUIRED', 400, 'Đường dẫn tệp không được để trống.');
    }

    const currentTime = now instanceof Date ? now : new Date(now);

    return runWithTx(customTx, async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: parsedRegId },
            include: {
                defenseCouncil: true,
                topic: true,
                student: true,
                archive: true,
            },
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy hồ sơ đăng ký.');
        }

        let windows = null;
        let isLatePreDefense = false;
        const warnings = [];
        let phase = 'POST_DEFENSE';

        if (registration.defenseCouncil?.defenseDate) {
            windows = computeDefenseTimeWindows(registration.defenseCouncil.defenseDate);

            // Mốc đóng cổng: 00:00 ngày thứ 15 sau ngày bảo vệ
            if (currentTime >= windows.windowClosesAt) {
                throw new WorkflowTransitionError(
                    'ARCHIVE_WINDOW_CLOSED',
                    409,
                    'Cổng nộp tài liệu lưu chiểu đã đóng lúc 00:00 ngày thứ 15 sau ngày bảo vệ.',
                );
            }

            // Hạn mềm: 00:00 trước ngày bảo vệ 3 ngày
            if (currentTime >= windows.softPreparationDeadlineAt && currentTime < windows.defenseSnapshotAt) {
                isLatePreDefense = true;
                warnings.push('Tài liệu nộp sau hạn mềm chuẩn bị bảo vệ (00:00 trước ngày bảo vệ 3 ngày).');
            }

            if (currentTime < windows.defenseSnapshotAt) {
                phase = 'PRE_DEFENSE';
            } else {
                phase = 'POST_DEFENSE';
            }
        }

        // Tự động tính hoặc dùng checksum SHA-256
        let finalChecksum = checksum;
        if (!finalChecksum || typeof finalChecksum !== 'string' || finalChecksum.length !== 64) {
            finalChecksum = crypto.createHash('sha256')
                .update(`${fileUrl}:${fileName || ''}:${currentTime.getTime()}`)
                .digest('hex');
        }

        // Tìm version mới nhất
        const latestVersion = await tx.defenseDocumentVersion.findFirst({
            where: {
                registrationId: parsedRegId,
                documentType,
            },
            orderBy: { versionNumber: 'desc' },
        });
        const versionNumber = (latestVersion?.versionNumber || 0) + 1;

        // Cập nhật trường tương ứng trong ProjectArchive mà không bắt nộp lại các file khác
        const archiveFieldUpdates = {
            phase,
            submittedAt: currentTime,
        };

        if (windows) {
            archiveFieldUpdates.softPreparationDeadlineAt = windows.softPreparationDeadlineAt;
            archiveFieldUpdates.defenseSnapshotAt = windows.defenseSnapshotAt;
            archiveFieldUpdates.windowClosesAt = windows.windowClosesAt;
        }

        if (documentType === 'REPORT_WORD') {
            archiveFieldUpdates.reportWordFileUrl = fileUrl;
            archiveFieldUpdates.reportWordFileName = fileName || 'Bao_cao_toan_van.docx';
        } else if (documentType === 'REPORT_PDF') {
            archiveFieldUpdates.reportPdfFileUrl = fileUrl;
            archiveFieldUpdates.reportPdfFileName = fileName || 'Bao_cao_toan_van.pdf';
            archiveFieldUpdates.reportFileUrl = fileUrl;
            archiveFieldUpdates.reportFileName = fileName || 'Bao_cao_toan_van.pdf';
        } else if (documentType === 'DEMO_VIDEO') {
            archiveFieldUpdates.demoVideoUrl = fileUrl;
        } else if (documentType === 'SLIDE_PPTX') {
            archiveFieldUpdates.slideFileUrl = fileUrl;
            archiveFieldUpdates.slideFileName = fileName || 'Slide_bao_ve.pptx';
        }

        const archive = await tx.projectArchive.upsert({
            where: { registrationId: parsedRegId },
            update: archiveFieldUpdates,
            create: {
                registrationId: parsedRegId,
                status: 'SUBMITTED',
                ...archiveFieldUpdates,
            },
        });

        // Tạo bản ghi DefenseDocumentVersion
        const version = await tx.defenseDocumentVersion.create({
            data: {
                registrationId: parsedRegId,
                archiveId: archive.id,
                documentType,
                versionNumber,
                phase,
                fileUrl,
                fileName: fileName || `${documentType}_v${versionNumber}`,
                fileSizeBytes: fileSizeBytes || null,
                checksum: finalChecksum,
                isLatePreDefense,
                uploadedById: actorId,
                uploadedAt: currentTime,
            },
        });

        return { version, archive, warnings };
    });
}

/**
 * Lấy hồ sơ 6 tài liệu bảo vệ và trạng thái các cửa sổ thời gian.
 *
 * @param {number} registrationId
 * @param {object} [options]
 * @param {Date | string} [options.now]
 * @param {object} [options.tx]
 * @returns {Promise<object>}
 */
async function getDefenseDossier(registrationId, options = {}) {
    const parsedRegId = parseInt(registrationId, 10);
    if (!Number.isInteger(parsedRegId) || parsedRegId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }

    const currentTime = options.now instanceof Date ? options.now : (options.now ? new Date(options.now) : new Date());

    return runWithTx(options.tx, async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: parsedRegId },
            include: {
                topic: {
                    include: {
                        mentor: { select: { id: true, fullName: true, email: true, academicTitle: true } },
                        projectCatalog: { select: { id: true, name: true } },
                        semester: { select: { id: true, name: true } },
                    },
                },
                student: { select: { id: true, fullName: true, code: true, email: true, department: true } },
                defenseCouncil: { select: { id: true, name: true, defenseDate: true, location: true } },
                archive: true,
                bm03Record: true,
                bm04Evaluation: true,
                documentVersions: { orderBy: [{ documentType: 'asc' }, { versionNumber: 'desc' }] },
                documentSnapshots: true,
            },
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy hồ sơ đăng ký.');
        }

        // Lấy tên đề tài chuẩn qua resolveEffectiveTopicTitle
        let effectiveTitle = registration.adjustedTitle || registration.bm01ApprovedTitleSnapshot || registration.topic?.title || 'Chưa xác định';
        try {
            const titleRes = await resolveEffectiveTopicTitle(parsedRegId, currentTime, { tx });
            if (titleRes?.title) {
                effectiveTitle = titleRes.title;
            }
        } catch (_) {
            // Giữ fallback nếu resolver lỗi
        }

        // Cửa sổ thời gian
        let windows = null;
        let isSoftDeadlinePast = false;
        let isWindowClosed = false;

        if (registration.defenseCouncil?.defenseDate) {
            windows = computeDefenseTimeWindows(registration.defenseCouncil.defenseDate);
            isSoftDeadlinePast = currentTime >= windows.softPreparationDeadlineAt;
            isWindowClosed = currentTime >= windows.windowClosesAt;
        }

        // Lấy lịch sử phiên bản
        const versionHistory = registration.documentVersions || await tx.defenseDocumentVersion.findMany({
            where: { registrationId: parsedRegId },
            orderBy: [{ documentType: 'asc' }, { versionNumber: 'desc' }],
        });

        // 4 loại file hiện hành (bản mới nhất của từng loại)
        const currentFiles = {
            REPORT_WORD: null,
            REPORT_PDF: null,
            DEMO_VIDEO: null,
            SLIDE_PPTX: null,
        };

        for (const docType of ALLOWED_DOCUMENT_TYPES) {
            const latest = versionHistory.find((v) => v.documentType === docType);
            currentFiles[docType] = latest || null;
        }

        const missingTypes = ALLOWED_DOCUMENT_TYPES.filter((t) => !currentFiles[t]);

        // Tự động liên kết BM03 và BM04 (read-only)
        const bm03Record = registration.bm03Record || (tx.bM03ProgressRecord?.findUnique ? await tx.bM03ProgressRecord.findUnique({ where: { registrationId: parsedRegId } }) : null);
        const bm04Evaluation = registration.bm04Evaluation || (tx.bM04Evaluation?.findUnique ? await tx.bM04Evaluation.findUnique({ where: { registrationId: parsedRegId } }) : null);

        const linkedBm03 = bm03Record ? {
            id: bm03Record.id,
            finalPdfFileUrl: bm03Record.finalPdfFileUrl || null,
            advisorSignedAt: bm03Record.advisorSignedAt || null,
        } : null;

        const linkedBm04 = bm04Evaluation ? {
            id: bm04Evaluation.id,
            finalPdfFileUrl: bm04Evaluation.finalPdfFileUrl || null,
            signedAt: bm04Evaluation.signedAt || null,
        } : null;

        // Snapshots
        const snapshots = registration.documentSnapshots || await tx.defenseDocumentSnapshot.findMany({
            where: { registrationId: parsedRegId },
        });

        const defenseSnapshot = snapshots.find((s) => s.snapshotType === 'DEFENSE_SNAPSHOT') || null;
        const finalArchiveSnapshot = snapshots.find((s) => s.snapshotType === 'ARCHIVE_FINAL_SNAPSHOT') || null;

        return {
            registrationId: parsedRegId,
            effectiveTitle,
            topic: registration.topic,
            student: registration.student,
            defenseCouncil: registration.defenseCouncil,
            defenseSessionShift: registration.defenseSessionShift || null,
            defenseOrderInShift: registration.defenseOrderInShift || null,
            windows,
            currentFiles,
            versionHistory,
            linkedBm03,
            linkedBm04,
            defenseSnapshot,
            finalArchiveSnapshot,
            missingTypes,
            isSoftDeadlinePast,
            isWindowClosed,
        };
    });
}

/**
 * Chụp snapshot bất biến lúc 00:00 ngày bảo vệ (DEFENSE_SNAPSHOT).
 * Gắn các phiên bản mới nhất tại mốc 00:00 ngày bảo vệ.
 *
 * @param {number} registrationId
 * @param {object} [options]
 * @param {Date | string} [options.capturedAt]
 * @param {object} [options.tx]
 * @returns {Promise<object>}
 */
async function captureDefenseZeroHourSnapshot(registrationId, options = {}) {
    const parsedRegId = parseInt(registrationId, 10);
    if (!Number.isInteger(parsedRegId) || parsedRegId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }

    return runWithTx(options.tx, async (tx) => {
        // Nếu snapshot DEFENSE_SNAPSHOT đã tồn tại -> trả về snapshot hiện có (bất biến)
        const existing = await tx.defenseDocumentSnapshot.findUnique({
            where: {
                registrationId_snapshotType: {
                    registrationId: parsedRegId,
                    snapshotType: 'DEFENSE_SNAPSHOT',
                },
            },
        });
        if (existing) {
            return existing;
        }

        const registration = await tx.topicRegistration.findUnique({
            where: { id: parsedRegId },
            include: { defenseCouncil: true },
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy hồ sơ đăng ký.');
        }

        let zeroHourTime;
        if (options.capturedAt) {
            zeroHourTime = options.capturedAt instanceof Date ? options.capturedAt : new Date(options.capturedAt);
        } else if (registration.defenseCouncil?.defenseDate) {
            const windows = computeDefenseTimeWindows(registration.defenseCouncil.defenseDate);
            zeroHourTime = windows.defenseSnapshotAt;
        } else {
            zeroHourTime = new Date();
        }

        // Lấy các phiên bản mới nhất tại hoặc trước mốc zeroHourTime
        const [wordV, pdfV, videoV, slideV] = await Promise.all([
            tx.defenseDocumentVersion.findFirst({
                where: { registrationId: parsedRegId, documentType: 'REPORT_WORD', uploadedAt: { lte: zeroHourTime } },
                orderBy: { versionNumber: 'desc' },
            }),
            tx.defenseDocumentVersion.findFirst({
                where: { registrationId: parsedRegId, documentType: 'REPORT_PDF', uploadedAt: { lte: zeroHourTime } },
                orderBy: { versionNumber: 'desc' },
            }),
            tx.defenseDocumentVersion.findFirst({
                where: { registrationId: parsedRegId, documentType: 'DEMO_VIDEO', uploadedAt: { lte: zeroHourTime } },
                orderBy: { versionNumber: 'desc' },
            }),
            tx.defenseDocumentVersion.findFirst({
                where: { registrationId: parsedRegId, documentType: 'SLIDE_PPTX', uploadedAt: { lte: zeroHourTime } },
                orderBy: { versionNumber: 'desc' },
            }),
        ]);

        const missingDocumentTypes = [];
        if (!wordV) missingDocumentTypes.push('REPORT_WORD');
        if (!pdfV) missingDocumentTypes.push('REPORT_PDF');
        if (!videoV) missingDocumentTypes.push('DEMO_VIDEO');
        if (!slideV) missingDocumentTypes.push('SLIDE_PPTX');

        const bm03 = tx.bM03ProgressRecord?.findUnique
            ? await tx.bM03ProgressRecord.findUnique({ where: { registrationId: parsedRegId } })
            : null;
        const bm04 = tx.bM04Evaluation?.findUnique
            ? await tx.bM04Evaluation.findUnique({ where: { registrationId: parsedRegId } })
            : null;

        const payload = {
            registrationId: parsedRegId,
            snapshotType: 'DEFENSE_SNAPSHOT',
            capturedAt: zeroHourTime.toISOString(),
            reportWordVersionId: wordV?.id || null,
            reportPdfVersionId: pdfV?.id || null,
            demoVideoVersionId: videoV?.id || null,
            slidePptxVersionId: slideV?.id || null,
            bm03RecordId: bm03?.id || null,
            bm04EvaluationId: bm04?.id || null,
            missingDocumentTypes,
        };
        const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

        const snapshot = await tx.defenseDocumentSnapshot.create({
            data: {
                registrationId: parsedRegId,
                snapshotType: 'DEFENSE_SNAPSHOT',
                capturedAt: zeroHourTime,
                reportWordVersionId: wordV?.id || null,
                reportPdfVersionId: pdfV?.id || null,
                demoVideoVersionId: videoV?.id || null,
                slidePptxVersionId: slideV?.id || null,
                bm03RecordId: bm03?.id || null,
                bm03PdfUrl: bm03?.finalPdfFileUrl || null,
                bm04EvaluationId: bm04?.id || null,
                bm04PdfUrl: bm04?.finalPdfFileUrl || null,
                missingDocumentTypes,
                payloadHash,
            },
        });

        await tx.projectArchive.updateMany({
            where: { registrationId: parsedRegId },
            data: { defenseSnapshotAt: zeroHourTime },
        });

        return snapshot;
    });
}

/**
 * Đóng cửa sổ nộp lưu chiểu lúc 00:00 ngày thứ 15 sau ngày bảo vệ.
 * Chụp ARCHIVE_FINAL_SNAPSHOT và chuyển trạng thái sang ARCHIVE_INCOMPLETE nếu thiếu file và đã DEFENSE_PASSED.
 *
 * @param {number} registrationId
 * @param {object} [options]
 * @param {Date | string} [options.closedAt]
 * @param {object} [options.tx]
 * @returns {Promise<{ snapshot: object, transitionedStatus: string | null }>}
 */
async function closeArchiveWindowAtDay15(registrationId, options = {}) {
    const parsedRegId = parseInt(registrationId, 10);
    if (!Number.isInteger(parsedRegId) || parsedRegId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }

    return runWithTx(options.tx, async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: parsedRegId },
            include: { defenseCouncil: true },
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy hồ sơ đăng ký.');
        }

        let closureTime;
        if (options.closedAt) {
            closureTime = options.closedAt instanceof Date ? options.closedAt : new Date(options.closedAt);
        } else if (registration.defenseCouncil?.defenseDate) {
            const windows = computeDefenseTimeWindows(registration.defenseCouncil.defenseDate);
            closureTime = windows.windowClosesAt;
        } else {
            closureTime = new Date();
        }

        const [wordV, pdfV, videoV, slideV] = await Promise.all([
            tx.defenseDocumentVersion.findFirst({
                where: { registrationId: parsedRegId, documentType: 'REPORT_WORD', uploadedAt: { lte: closureTime } },
                orderBy: { versionNumber: 'desc' },
            }),
            tx.defenseDocumentVersion.findFirst({
                where: { registrationId: parsedRegId, documentType: 'REPORT_PDF', uploadedAt: { lte: closureTime } },
                orderBy: { versionNumber: 'desc' },
            }),
            tx.defenseDocumentVersion.findFirst({
                where: { registrationId: parsedRegId, documentType: 'DEMO_VIDEO', uploadedAt: { lte: closureTime } },
                orderBy: { versionNumber: 'desc' },
            }),
            tx.defenseDocumentVersion.findFirst({
                where: { registrationId: parsedRegId, documentType: 'SLIDE_PPTX', uploadedAt: { lte: closureTime } },
                orderBy: { versionNumber: 'desc' },
            }),
        ]);

        const missingDocumentTypes = [];
        if (!wordV) missingDocumentTypes.push('REPORT_WORD');
        if (!pdfV) missingDocumentTypes.push('REPORT_PDF');
        if (!videoV) missingDocumentTypes.push('DEMO_VIDEO');
        if (!slideV) missingDocumentTypes.push('SLIDE_PPTX');

        const bm03 = tx.bM03ProgressRecord?.findUnique
            ? await tx.bM03ProgressRecord.findUnique({ where: { registrationId: parsedRegId } })
            : null;
        const bm04 = tx.bM04Evaluation?.findUnique
            ? await tx.bM04Evaluation.findUnique({ where: { registrationId: parsedRegId } })
            : null;

        let snapshot = await tx.defenseDocumentSnapshot.findUnique({
            where: {
                registrationId_snapshotType: {
                    registrationId: parsedRegId,
                    snapshotType: 'ARCHIVE_FINAL_SNAPSHOT',
                },
            },
        });

        if (!snapshot) {
            const payload = {
                registrationId: parsedRegId,
                snapshotType: 'ARCHIVE_FINAL_SNAPSHOT',
                capturedAt: closureTime.toISOString(),
                reportWordVersionId: wordV?.id || null,
                reportPdfVersionId: pdfV?.id || null,
                demoVideoVersionId: videoV?.id || null,
                slidePptxVersionId: slideV?.id || null,
                bm03RecordId: bm03?.id || null,
                bm04EvaluationId: bm04?.id || null,
                missingDocumentTypes,
            };
            const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

            snapshot = await tx.defenseDocumentSnapshot.create({
                data: {
                    registrationId: parsedRegId,
                    snapshotType: 'ARCHIVE_FINAL_SNAPSHOT',
                    capturedAt: closureTime,
                    reportWordVersionId: wordV?.id || null,
                    reportPdfVersionId: pdfV?.id || null,
                    demoVideoVersionId: videoV?.id || null,
                    slidePptxVersionId: slideV?.id || null,
                    bm03RecordId: bm03?.id || null,
                    bm03PdfUrl: bm03?.finalPdfFileUrl || null,
                    bm04EvaluationId: bm04?.id || null,
                    bm04PdfUrl: bm04?.finalPdfFileUrl || null,
                    missingDocumentTypes,
                    payloadHash,
                },
            });
        }

        let transitionedStatus = null;
        if (missingDocumentTypes.length > 0 && registration.status === 'DEFENSE_PASSED') {
            await transitionRegistration({
                registrationId: parsedRegId,
                expectedStatus: 'DEFENSE_PASSED',
                expectedStateVersion: registration.stateVersion || 0,
                targetStatus: 'ARCHIVE_INCOMPLETE',
                actorId: 1, // system actor
                reason: `Hồ sơ lưu chiểu không đầy đủ khi đóng cổng tại ngày thứ 15 (thiếu: ${missingDocumentTypes.join(', ')}).`,
                idempotencyKey: `archive-window-close-${parsedRegId}-${registration.stateVersion || 0}`,
            }, { tx });
            transitionedStatus = 'ARCHIVE_INCOMPLETE';
        }

        await tx.projectArchive.updateMany({
            where: { registrationId: parsedRegId },
            data: {
                windowClosedAt: closureTime,
                status: transitionedStatus === 'ARCHIVE_INCOMPLETE' ? 'ARCHIVE_INCOMPLETE' : undefined,
            },
        });

        return { snapshot, transitionedStatus };
    });
}

module.exports = {
    ALLOWED_DOCUMENT_TYPES,
    uploadDefenseDocumentVersion,
    getDefenseDossier,
    captureDefenseZeroHourSnapshot,
    closeArchiveWindowAtDay15,
};
