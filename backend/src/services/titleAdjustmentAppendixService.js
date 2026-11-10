const prisma = require('../config/database');
const { BM02AWorkflowError } = require('./bm02aWorkflowService');

/**
 * Creates a TitleAdjustmentAppendix in DRAFT status with initial BM02-A requests.
 * Enforces:
 * 1. Requests must be in APPROVED_PENDING_APPENDIX.
 * 2. Requests must not already be in any active (DRAFT or ISSUED) appendix.
 * 3. Associated requests transition to ASSIGNED_TO_APPENDIX.
 */
async function createAppendixDraft({
    decisionId,
    appendixNumber,
    signedDate,
    fileUrl,
    fileName,
    bm02aRequestIds = [],
    issuedById,
    idempotencyKey,
}, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const decId = Number(decisionId);
    const issuerId = Number(issuedById);

    const decision = await db.topicAssignmentDecision.findUnique({
        where: { id: decId },
    });

    if (!decision) {
        throw new BM02AWorkflowError('Quyết định giao đề tài không tồn tại.', 'DECISION_NOT_FOUND', 404);
    }

    const cleanAppendixNumber = String(appendixNumber || '').trim();
    if (!cleanAppendixNumber) {
        throw new BM02AWorkflowError('Số phụ lục điều chỉnh không được để trống.', 'MISSING_APPENDIX_NUMBER', 400);
    }

    if (!Array.isArray(bm02aRequestIds) || bm02aRequestIds.length === 0) {
        throw new BM02AWorkflowError('Phải chọn ít nhất một yêu cầu BM02-A để lập phụ lục.', 'MISSING_BM02A_REQUESTS', 400);
    }

    const requestIds = bm02aRequestIds.map(Number);

    // Duplicate check: ensure none of these requests is already in an active (DRAFT or ISSUED) appendix
    const existingActiveItem = await db.titleAdjustmentAppendixItem.findFirst({
        where: {
            bm02aRequestId: { in: requestIds },
            appendix: {
                status: { in: ['DRAFT', 'ISSUED'] },
            },
        },
        include: { appendix: true },
    });

    if (existingActiveItem) {
        throw new BM02AWorkflowError(
            `Phiếu BM02-A #${existingActiveItem.bm02aRequestId} đã nằm trong phụ lục (${existingActiveItem.appendix?.appendixNumber}) đang soạn hoặc đã ban hành.`,
            'BM02A_ALREADY_IN_ACTIVE_APPENDIX',
            409,
        );
    }

    const requests = await db.bM02AAdjustmentRequest.findMany({
        where: { id: { in: requestIds } },
        include: { versions: true },
    });

    if (requests.length !== requestIds.length) {
        throw new BM02AWorkflowError('Một số yêu cầu BM02-A không tồn tại.', 'BM02A_REQUESTS_NOT_FOUND', 404);
    }

    for (const req of requests) {
        if (req.status !== 'APPROVED_PENDING_APPENDIX') {
            throw new BM02AWorkflowError(
                `Yêu cầu BM02-A #${req.id} chưa ở trạng thái sẵn sàng lập phụ lục (APPROVED_PENDING_APPENDIX).`,
                'BM02A_NOT_APPROVED_PENDING_APPENDIX',
                409,
            );
        }
    }

    const executeCreate = async (tx) => {
        const count = await tx.titleAdjustmentAppendix.count({
            where: { decisionId: decId },
        });
        const sequenceNo = count + 1;

        const appendix = await tx.titleAdjustmentAppendix.create({
            data: {
                decisionId: decId,
                appendixNumber: cleanAppendixNumber,
                sequenceNo,
                signedDate: signedDate ? new Date(signedDate) : new Date(),
                fileUrl: fileUrl || null,
                fileName: fileName || null,
                issuedById: issuerId,
                status: 'DRAFT',
                idempotencyKey: idempotencyKey || null,
            },
        });

        const createdItems = [];
        for (const req of requests) {
            const currentVersion = req.versions.find((v) => v.versionNumber === req.currentVersionNumber) || req.versions[0];
            const item = await tx.titleAdjustmentAppendixItem.create({
                data: {
                    appendixId: appendix.id,
                    bm02aRequestId: req.id,
                    registrationId: req.registrationId,
                    oldTitle: currentVersion?.registeredTitleSnapshot || '',
                    newTitle: currentVersion?.proposedTitle || '',
                },
            });
            createdItems.push(item);

            await tx.bM02AAdjustmentRequest.update({
                where: { id: req.id },
                data: { status: 'ASSIGNED_TO_APPENDIX' },
            });
        }

        return { ...appendix, items: createdItems };
    };

    if (options.tx) {
        return executeCreate(options.tx);
    }
    return prisma.$transaction(executeCreate);
}

/**
 * Updates items in a DRAFT TitleAdjustmentAppendix.
 * Reverts removed requests back to APPROVED_PENDING_APPENDIX and checks duplicate on newly added requests.
 */
async function updateAppendixItems({ appendixId, bm02aRequestIds = [], actorId }, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const appxId = Number(appendixId);

    const appendix = await db.titleAdjustmentAppendix.findUnique({
        where: { id: appxId },
        include: { items: true },
    });

    if (!appendix) {
        throw new BM02AWorkflowError('Phụ lục điều chỉnh không tồn tại.', 'APPENDIX_NOT_FOUND', 404);
    }

    if (appendix.status !== 'DRAFT') {
        throw new BM02AWorkflowError('Chỉ phụ lục ở trạng thái DRAFT mới có thể cập nhật danh sách đề tài.', 'CANNOT_MODIFY_NON_DRAFT_APPENDIX', 409);
    }

    const newRequestIds = bm02aRequestIds.map(Number);
    const currentItemRequestIds = appendix.items.map((it) => it.bm02aRequestId);

    const removedRequestIds = currentItemRequestIds.filter((id) => !newRequestIds.includes(id));
    const addedRequestIds = newRequestIds.filter((id) => !currentItemRequestIds.includes(id));

    if (addedRequestIds.length > 0) {
        // Duplicate check on newly added
        const duplicateItem = await db.titleAdjustmentAppendixItem.findFirst({
            where: {
                bm02aRequestId: { in: addedRequestIds },
                appendixId: { not: appxId },
                appendix: { status: { in: ['DRAFT', 'ISSUED'] } },
            },
            include: { appendix: true },
        });

        if (duplicateItem) {
            throw new BM02AWorkflowError(
                `Phiếu BM02-A #${duplicateItem.bm02aRequestId} đã nằm trong phụ lục (${duplicateItem.appendix?.appendixNumber}).`,
                'BM02A_ALREADY_IN_ACTIVE_APPENDIX',
                409,
            );
        }

        const addedRequests = await db.bM02AAdjustmentRequest.findMany({
            where: { id: { in: addedRequestIds } },
            include: { versions: true },
        });

        for (const req of addedRequests) {
            if (req.status !== 'APPROVED_PENDING_APPENDIX') {
                throw new BM02AWorkflowError(
                    `Yêu cầu BM02-A #${req.id} chưa ở trạng thái sẵn sàng lập phụ lục (APPROVED_PENDING_APPENDIX).`,
                    'BM02A_NOT_APPROVED_PENDING_APPENDIX',
                    409,
                );
            }
        }
    }

    const executeUpdate = async (tx) => {
        // Revert removed requests
        if (removedRequestIds.length > 0) {
            await tx.titleAdjustmentAppendixItem.deleteMany({
                where: {
                    appendixId: appxId,
                    bm02aRequestId: { in: removedRequestIds },
                },
            });

            for (const remId of removedRequestIds) {
                await tx.bM02AAdjustmentRequest.update({
                    where: { id: remId },
                    data: { status: 'APPROVED_PENDING_APPENDIX' },
                });
            }
        }

        // Add new items
        if (addedRequestIds.length > 0) {
            const addedRequests = await tx.bM02AAdjustmentRequest.findMany({
                where: { id: { in: addedRequestIds } },
                include: { versions: true },
            });

            for (const req of addedRequests) {
                const currentVersion = req.versions.find((v) => v.versionNumber === req.currentVersionNumber) || req.versions[0];
                await tx.titleAdjustmentAppendixItem.create({
                    data: {
                        appendixId: appxId,
                        bm02aRequestId: req.id,
                        registrationId: req.registrationId,
                        oldTitle: currentVersion?.registeredTitleSnapshot || '',
                        newTitle: currentVersion?.proposedTitle || '',
                    },
                });

                await tx.bM02AAdjustmentRequest.update({
                    where: { id: req.id },
                    data: { status: 'ASSIGNED_TO_APPENDIX' },
                });
            }
        }

        return tx.titleAdjustmentAppendix.findUnique({
            where: { id: appxId },
            include: { items: true },
        });
    };

    if (options.tx) {
        return executeUpdate(options.tx);
    }
    return prisma.$transaction(executeUpdate);
}

/**
 * Issues a TitleAdjustmentAppendix.
 * Transitions appendix status from DRAFT to ISSUED.
 * Transitions all associated BM02-A requests to ADJUSTMENT_ISSUED.
 * Makes newTitle effective from signedDate.
 */
async function issueAppendix({ appendixId, issuedById, signedDate, idempotencyKey }, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const appxId = Number(appendixId);
    const issuerId = Number(issuedById);

    const appendix = await db.titleAdjustmentAppendix.findUnique({
        where: { id: appxId },
        include: { items: true },
    });

    if (!appendix) {
        throw new BM02AWorkflowError('Phụ lục điều chỉnh không tồn tại.', 'APPENDIX_NOT_FOUND', 404);
    }

    if (appendix.status !== 'DRAFT') {
        throw new BM02AWorkflowError('Phụ lục không ở trạng thái DRAFT hoặc đã được ban hành.', 'INVALID_APPENDIX_STATUS', 409);
    }

    if (!appendix.items || appendix.items.length === 0) {
        throw new BM02AWorkflowError('Phụ lục chưa có danh mục đề tài điều chỉnh nào.', 'EMPTY_APPENDIX_ITEMS', 400);
    }

    const effectiveSignedDate = signedDate ? new Date(signedDate) : new Date();

    const executeIssue = async (tx) => {
        const updated = await tx.titleAdjustmentAppendix.update({
            where: { id: appxId },
            data: {
                status: 'ISSUED',
                issuedById: issuerId,
                signedDate: effectiveSignedDate,
                recordedAt: new Date(),
                idempotencyKey: idempotencyKey || appendix.idempotencyKey || null,
            },
            include: { items: true },
        });

        // Transition each item's BM02A request to ADJUSTMENT_ISSUED
        for (const item of appendix.items) {
            await tx.bM02AAdjustmentRequest.update({
                where: { id: item.bm02aRequestId },
                data: { status: 'ADJUSTMENT_ISSUED' },
            });
        }

        return updated;
    };

    if (options.tx) {
        return executeIssue(options.tx);
    }
    return prisma.$transaction(executeIssue);
}

/**
 * Gets appendix by ID.
 */
async function getAppendixById(appendixId, options = {}) {
    const db = options.tx || options.prisma || prisma;
    return db.titleAdjustmentAppendix.findUnique({
        where: { id: Number(appendixId) },
        include: {
            decision: true,
            issuedBy: { select: { id: true, fullName: true, code: true, email: true } },
            items: {
                include: {
                    registration: {
                        include: {
                            student: { select: { id: true, fullName: true, code: true } },
                            topic: {
                                include: {
                                    mentor: { select: { id: true, fullName: true, department: true } },
                                },
                            },
                        },
                    },
                    bm02aRequest: {
                        include: {
                            versions: true,
                        },
                    },
                },
            },
        },
    });
}

/**
 * Gets appendices by decision ID.
 */
async function getAppendicesByDecision(decisionId, options = {}) {
    const db = options.tx || options.prisma || prisma;
    return db.titleAdjustmentAppendix.findMany({
        where: { decisionId: Number(decisionId) },
        include: {
            items: true,
            issuedBy: { select: { id: true, fullName: true, code: true } },
        },
        orderBy: [{ sequenceNo: 'asc' }, { id: 'asc' }],
    });
}

module.exports = {
    createAppendixDraft,
    updateAppendixItems,
    issueAppendix,
    getAppendixById,
    getAppendicesByDecision,
};
