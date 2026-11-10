const prisma = require('../config/database');
const { computeCanonicalPayloadHash, recordSignatureEvent } = require('./electronicSignatureService');
const { generateImmutableAcademicPdf } = require('./academicPdfService');
const { validateAcademicScope } = require('./academicScopeService');

class BM02AWorkflowError extends Error {
    constructor(message, code, statusCode = 400) {
        super(message);
        this.name = 'BM02AWorkflowError';
        this.code = code;
        this.status = statusCode;
        this.statusCode = statusCode;
    }
}

/**
 * Builds canonical payload object for BM02A version signature and hash verification.
 */
function getFormVersionPayload(version, registrationId) {
    return {
        registrationId: Number(registrationId || version?.registrationId || version?.request?.registrationId || 0),
        versionNumber: Number(version?.versionNumber || 1),
        registeredTitleSnapshot: String(version?.registeredTitleSnapshot || '').trim(),
        proposedTitle: String(version?.proposedTitle || '').trim(),
        reason: String(version?.reason || '').trim(),
        studentSnapshot: version?.studentSnapshot || {},
    };
}

/**
 * Creates a BM02-A title adjustment request in STUDENT_PREPARING state with versionNumber = 1.
 * Validates 168h window from topicAssignmentDecision.decisionPublishedAt (or registration.titleAdjustmentDeadline).
 */
async function createBM02ARequest({ registrationId, studentId, proposedTitle, reason }, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const now = options.now ? new Date(options.now) : new Date();

    const regId = Number(registrationId);
    const stuId = Number(studentId);

    const registration = await db.topicRegistration.findUnique({
        where: { id: regId },
        include: {
            topic: {
                include: {
                    mentor: {
                        select: { id: true, fullName: true, department: true },
                    },
                },
            },
        },
    });

    if (!registration) {
        throw new BM02AWorkflowError('Hồ sơ đăng ký đề tài không tồn tại.', 'REGISTRATION_NOT_FOUND', 404);
    }

    if (registration.studentId !== stuId) {
        throw new BM02AWorkflowError('Sinh viên không phải chủ sở hữu hồ sơ này.', 'STUDENT_NOT_REGISTRATION_OWNER', 403);
    }

    // Must have a published topic assignment decision
    const decisionItem = await db.topicAssignmentDecisionItem.findFirst({
        where: {
            registrationId: regId,
            decision: { status: 'PUBLISHED' },
        },
        include: { decision: true },
    });

    if (!decisionItem || !decisionItem.decision) {
        throw new BM02AWorkflowError('Hồ sơ chưa có quyết định giao đề tài được công bố.', 'NO_PUBLISHED_DECISION_FOR_REGISTRATION', 409);
    }

    // Validate 168h window
    const publishedAt = decisionItem.decision.decisionPublishedAt || decisionItem.decision.decisionDate;
    const deadline = registration.titleAdjustmentDeadline || new Date(new Date(publishedAt).getTime() + 168 * 3600 * 1000);

    if (now.getTime() > deadline.getTime()) {
        throw new BM02AWorkflowError(
            'Thời hạn nộp đơn điều chỉnh tên đề tài BM02-A đã kết thúc (168 giờ kể từ khi công bố quyết định).',
            'TITLE_ADJUSTMENT_WINDOW_CLOSED',
            409,
        );
    }

    // Check if there is already an active BM02A request
    const existing = await db.bM02AAdjustmentRequest.findFirst({
        where: {
            registrationId: regId,
            status: { notIn: ['REJECTED_FINAL', 'EXPIRED'] },
        },
    });

    if (existing) {
        throw new BM02AWorkflowError('Đã tồn tại đơn điều chỉnh tên đề tài BM02-A đang xử lý cho hồ sơ này.', 'BM02A_REQUEST_ALREADY_EXISTS', 409);
    }

    // Snapshot student personal info
    const student = await db.user.findUnique({
        where: { id: stuId },
        include: { studentProfile: true },
    });

    const studentSnapshot = {
        fullName: student?.fullName || '',
        studentCode: student?.code || '',
        dateOfBirth: student?.studentProfile?.dateOfBirth || null,
        placeOfBirth: student?.studentProfile?.placeOfBirth || null,
        className: student?.studentProfile?.className || '',
        cohort: student?.studentProfile?.cohort || '',
        major: student?.studentProfile?.major || '',
        ...(options.studentSnapshot || {}),
    };

    const registeredTitleSnapshot = decisionItem.approvedTitleSnapshot || registration.topic?.title || '';
    const cleanProposedTitle = String(proposedTitle || '').trim();
    const cleanReason = String(reason || '').trim();

    if (!cleanProposedTitle || !cleanReason) {
        throw new BM02AWorkflowError('Tên đề tài đề xuất và lý do điều chỉnh không được để trống.', 'MISSING_PROPOSED_TITLE_OR_REASON', 400);
    }

    if (cleanProposedTitle.toLowerCase() === registeredTitleSnapshot.toLowerCase()) {
        throw new BM02AWorkflowError('Tên đề tài mới phải khác tên đề tài đã giao.', 'PROPOSED_TITLE_SAME_AS_CURRENT', 400);
    }

    const v1Payload = {
        registrationId: regId,
        versionNumber: 1,
        registeredTitleSnapshot,
        proposedTitle: cleanProposedTitle,
        reason: cleanReason,
        studentSnapshot,
    };
    const payloadHash = options.payloadHash || computeCanonicalPayloadHash(v1Payload);

    const executeCreate = async (tx) => {
        const createdRequest = await tx.bM02AAdjustmentRequest.create({
            data: {
                registrationId: regId,
                decisionId: decisionItem.decisionId,
                status: 'STUDENT_PREPARING',
                revisionCount: 0,
                currentVersionNumber: 1,
                titleAdjustmentDeadline: deadline,
                createdById: stuId,
            },
        });

        const createdVersion = await tx.bM02AFormVersion.create({
            data: {
                requestId: createdRequest.id,
                versionNumber: 1,
                studentSnapshot,
                registeredTitleSnapshot,
                proposedTitle: cleanProposedTitle,
                reason: cleanReason,
                payloadHash,
                isLocked: false,
            },
        });

        return { ...createdRequest, versions: [createdVersion] };
    };

    if (options.tx) {
        return executeCreate(options.tx);
    }
    return prisma.$transaction(executeCreate);
}

/**
 * Student signs and submits BM02-A version.
 * Requires now <= titleAdjustmentDeadline and identical payloadHash.
 */
async function studentSignAndSubmitBM02A({
    requestId,
    studentId,
    payloadHash,
    signatureImageId,
    ipAddress,
    userAgent,
    idempotencyKey,
}, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const now = options.now ? new Date(options.now) : new Date();
    const reqId = Number(requestId);
    const stuId = Number(studentId);

    const request = await db.bM02AAdjustmentRequest.findUnique({
        where: { id: reqId },
        include: {
            registration: {
                include: {
                    topic: {
                        include: {
                            mentor: {
                                select: { id: true, fullName: true, department: true },
                            },
                        },
                    },
                },
            },
            versions: true,
        },
    });

    if (!request) {
        throw new BM02AWorkflowError('Không tìm thấy yêu cầu BM02-A.', 'BM02A_NOT_FOUND', 404);
    }

    if (request.registration?.studentId !== stuId && request.createdById !== stuId) {
        throw new BM02AWorkflowError('Chỉ sinh viên thực hiện mới được ký nộp BM02-A.', 'FORBIDDEN_NOT_STUDENT', 403);
    }

    if (now.getTime() > request.titleAdjustmentDeadline.getTime()) {
        throw new BM02AWorkflowError(
            'Đã quá thời hạn nộp/ký phiếu điều chỉnh tên đề tài (168 giờ).',
            'TITLE_ADJUSTMENT_WINDOW_CLOSED',
            409,
        );
    }

    if (!['STUDENT_PREPARING', 'RETURNED_FOR_CORRECTION'].includes(request.status)) {
        throw new BM02AWorkflowError('Trạng thái hồ sơ không hợp lệ để sinh viên ký nộp.', 'INVALID_STATUS_FOR_STUDENT_SIGN', 409);
    }

    const currentVersion = request.versions.find((v) => v.versionNumber === request.currentVersionNumber);
    if (!currentVersion) {
        throw new BM02AWorkflowError('Không tìm thấy phiên bản biểu mẫu BM02-A tương ứng.', 'FORM_VERSION_NOT_FOUND', 404);
    }

    if (payloadHash && payloadHash !== currentVersion.payloadHash) {
        throw new BM02AWorkflowError('Chữ ký không khớp với payload của biểu mẫu hiện tại.', 'PAYLOAD_HASH_MISMATCH', 409);
    }

    const executeSign = async (tx) => {
        const sigEvent = await recordSignatureEvent({
            registrationId: request.registrationId,
            entityType: 'BM02A_VERSION',
            entityId: currentVersion.id,
            versionNumber: currentVersion.versionNumber,
            signerId: stuId,
            signerRole: 'STUDENT',
            action: 'SIGN',
            expectedPayloadHash: currentVersion.payloadHash,
            actualPayload: getFormVersionPayload(currentVersion, request.registrationId),
            signatureImageId,
            ipAddress,
            userAgent,
        }, { tx });

        await tx.bM02AFormVersion.update({
            where: { id: currentVersion.id },
            data: { studentSignatureEventId: sigEvent.id },
        });

        const updated = await tx.bM02AAdjustmentRequest.update({
            where: { id: reqId },
            data: { status: 'PENDING_ADVISOR' },
            include: { versions: true },
        });

        return updated;
    };

    if (options.tx) {
        return executeSign(options.tx);
    }
    return prisma.$transaction(executeSign);
}

/**
 * Advisor signs BM02-A version.
 * Verifies mentor ownership and payloadHash match. Allowed after 168h deadline if student submitted on time.
 */
async function advisorSignBM02A({
    requestId,
    advisorId,
    payloadHash,
    signatureImageId,
    ipAddress,
    userAgent,
    idempotencyKey,
}, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const reqId = Number(requestId);
    const advId = Number(advisorId);

    const request = await db.bM02AAdjustmentRequest.findUnique({
        where: { id: reqId },
        include: {
            registration: {
                include: {
                    topic: {
                        include: {
                            mentor: {
                                select: { id: true, fullName: true, department: true },
                            },
                        },
                    },
                },
            },
            versions: true,
        },
    });

    if (!request) {
        throw new BM02AWorkflowError('Không tìm thấy yêu cầu BM02-A.', 'BM02A_NOT_FOUND', 404);
    }

    if (request.status !== 'PENDING_ADVISOR') {
        throw new BM02AWorkflowError('Yêu cầu không ở trạng thái chờ GVHD ký xác nhận.', 'INVALID_STATUS_FOR_ADVISOR_SIGN', 409);
    }

    if (request.registration?.topic?.mentorId !== advId) {
        throw new BM02AWorkflowError('Chỉ giảng viên hướng dẫn của đề tài mới có quyền ký BM02-A.', 'FORBIDDEN_NOT_ADVISOR', 403);
    }

    const currentVersion = request.versions.find((v) => v.versionNumber === request.currentVersionNumber);
    if (!currentVersion) {
        throw new BM02AWorkflowError('Không tìm thấy phiên bản biểu mẫu BM02-A.', 'FORM_VERSION_NOT_FOUND', 404);
    }

    if (payloadHash && payloadHash !== currentVersion.payloadHash) {
        throw new BM02AWorkflowError('Chữ ký GVHD không khớp với payload của biểu mẫu.', 'PAYLOAD_HASH_MISMATCH', 409);
    }

    const executeSign = async (tx) => {
        const sigEvent = await recordSignatureEvent({
            registrationId: request.registrationId,
            entityType: 'BM02A_VERSION',
            entityId: currentVersion.id,
            versionNumber: currentVersion.versionNumber,
            signerId: advId,
            signerRole: 'ADVISOR',
            action: 'SIGN',
            expectedPayloadHash: currentVersion.payloadHash,
            actualPayload: getFormVersionPayload(currentVersion, request.registrationId),
            signatureImageId,
            ipAddress,
            userAgent,
        }, { tx });

        await tx.bM02AFormVersion.update({
            where: { id: currentVersion.id },
            data: { advisorSignatureEventId: sigEvent.id },
        });

        const updated = await tx.bM02AAdjustmentRequest.update({
            where: { id: reqId },
            data: { status: 'PENDING_DEPARTMENT_APPROVAL' },
            include: { versions: true },
        });

        return updated;
    };

    if (options.tx) {
        return executeSign(options.tx);
    }
    return prisma.$transaction(executeSign);
}

/**
 * Department Head signs 3rd signature on BM02-A version.
 * Verifies departmental authority via validateAcademicScope, generates immutable PDF, locks version, and transitions to APPROVED_PENDING_APPENDIX.
 */
async function departmentSignBM02A({
    requestId,
    departmentHeadId,
    payloadHash,
    signatureImageId,
    ipAddress,
    userAgent,
    idempotencyKey,
}, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const now = options.now ? new Date(options.now) : new Date();
    const reqId = Number(requestId);
    const deptHeadId = Number(departmentHeadId);

    const request = await db.bM02AAdjustmentRequest.findUnique({
        where: { id: reqId },
        include: {
            registration: {
                include: {
                    topic: {
                        include: {
                            mentor: {
                                select: { id: true, fullName: true, department: true },
                            },
                        },
                    },
                },
            },
            versions: true,
        },
    });

    if (!request) {
        throw new BM02AWorkflowError('Không tìm thấy yêu cầu BM02-A.', 'BM02A_NOT_FOUND', 404);
    }

    if (request.status !== 'PENDING_DEPARTMENT_APPROVAL') {
        throw new BM02AWorkflowError('Yêu cầu không ở trạng thái chờ Phụ trách bộ môn phê duyệt.', 'INVALID_STATUS_FOR_DEPARTMENT_SIGN', 409);
    }

    await validateAcademicScope(db, {
        actorId: deptHeadId,
        registrationId: request.registrationId,
        capabilityCode: 'BM02A_FINAL_APPROVE',
        now,
    });

    const currentVersion = request.versions.find((v) => v.versionNumber === request.currentVersionNumber);
    if (!currentVersion) {
        throw new BM02AWorkflowError('Không tìm thấy phiên bản biểu mẫu BM02-A.', 'FORM_VERSION_NOT_FOUND', 404);
    }

    if (payloadHash && payloadHash !== currentVersion.payloadHash) {
        throw new BM02AWorkflowError('Chữ ký Phụ trách bộ môn không khớp với payload của biểu mẫu.', 'PAYLOAD_HASH_MISMATCH', 409);
    }

    const executeSign = async (tx) => {
        const sigEvent = await recordSignatureEvent({
            registrationId: request.registrationId,
            entityType: 'BM02A_VERSION',
            entityId: currentVersion.id,
            versionNumber: currentVersion.versionNumber,
            signerId: deptHeadId,
            signerRole: 'DEPARTMENT_HEAD',
            action: 'SIGN',
            expectedPayloadHash: currentVersion.payloadHash,
            actualPayload: getFormVersionPayload(currentVersion, request.registrationId),
            signatureImageId,
            ipAddress,
            userAgent,
        }, { tx });

        const pdfResult = await generateImmutableAcademicPdf({
            docType: 'BM02A',
            registrationId: request.registrationId,
            entityId: currentVersion.id,
            versionNumber: currentVersion.versionNumber,
            title: 'ĐƠN XIN ĐIỀU CHỈNH TÊN ĐỀ TÀI (BM02-A)',
            sections: [
                {
                    heading: '1. Thông tin sinh viên',
                    lines: [
                        `Họ và tên: ${currentVersion.studentSnapshot?.fullName || ''}`,
                        `Mã số sinh viên: ${currentVersion.studentSnapshot?.studentCode || ''}`,
                        `Lớp: ${currentVersion.studentSnapshot?.className || ''}`,
                        `Chuyên ngành: ${currentVersion.studentSnapshot?.major || ''}`,
                    ],
                },
                {
                    heading: '2. Nội dung điều chỉnh đề tài',
                    lines: [
                        `Tên đề tài đã giao: ${currentVersion.registeredTitleSnapshot}`,
                        `Tên đề tài đề nghị điều chỉnh: ${currentVersion.proposedTitle}`,
                        `Lý do điều chỉnh: ${currentVersion.reason}`,
                    ],
                },
            ],
            signatures: [
                {
                    roleLabel: 'Sinh viên đề nghị',
                    signerName: currentVersion.studentSnapshot?.fullName || 'Sinh viên',
                    signedAt: new Date(),
                    payloadHash: currentVersion.payloadHash,
                },
                {
                    roleLabel: 'Giảng viên hướng dẫn',
                    signerName: request.registration?.topic?.mentor?.fullName || 'GVHD',
                    signedAt: new Date(),
                    payloadHash: currentVersion.payloadHash,
                },
                {
                    roleLabel: 'Phụ trách bộ môn',
                    signerName: options.departmentHeadName || 'Phụ trách bộ môn',
                    signedAt: new Date(),
                    payloadHash: currentVersion.payloadHash,
                },
            ],
        }, { tx });

        await tx.bM02AFormVersion.update({
            where: { id: currentVersion.id },
            data: {
                departmentSignatureEventId: sigEvent.id,
                isLocked: true,
            },
        });

        const updated = await tx.bM02AAdjustmentRequest.update({
            where: { id: reqId },
            data: {
                status: 'APPROVED_PENDING_APPENDIX',
                finalPayloadHash: currentVersion.payloadHash,
                finalPdfFileUrl: pdfResult.fileUrl,
            },
            include: { versions: true },
        });

        return { ...updated, pdfResult };
    };

    if (options.tx) {
        return executeSign(options.tx);
    }
    return prisma.$transaction(executeSign);
}

/**
 * Returns or rejects BM02-A.
 * If versionNumber === 1 and now <= titleAdjustmentDeadline -> RETURNED_FOR_CORRECTION.
 * If versionNumber >= 2 or now > titleAdjustmentDeadline -> REJECTED_FINAL.
 */
async function returnBM02A({
    requestId,
    actorId,
    actorRole, // 'ADVISOR' | 'DEPARTMENT_HEAD'
    reason,
    idempotencyKey,
}, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const now = options.now ? new Date(options.now) : new Date();
    const reqId = Number(requestId);
    const actId = Number(actorId);

    const request = await db.bM02AAdjustmentRequest.findUnique({
        where: { id: reqId },
        include: {
            registration: {
                include: {
                    topic: {
                        include: {
                            mentor: {
                                select: { id: true, fullName: true, department: true },
                            },
                        },
                    },
                },
            },
            versions: true,
        },
    });

    if (!request) {
        throw new BM02AWorkflowError('Không tìm thấy yêu cầu BM02-A.', 'BM02A_NOT_FOUND', 404);
    }

    if (actorRole === 'ADVISOR') {
        if (request.status !== 'PENDING_ADVISOR') {
            throw new BM02AWorkflowError('Yêu cầu không ở trạng thái chờ GVHD xét duyệt.', 'INVALID_STATUS_FOR_ADVISOR_RETURN', 409);
        }
        if (request.registration?.topic?.mentorId !== actId) {
            throw new BM02AWorkflowError('Chỉ GVHD phụ trách mới có quyền trả lại phiếu BM02-A.', 'FORBIDDEN_NOT_ADVISOR', 403);
        }
    } else if (actorRole === 'DEPARTMENT_HEAD') {
        if (request.status !== 'PENDING_DEPARTMENT_APPROVAL') {
            throw new BM02AWorkflowError('Yêu cầu không ở trạng thái chờ Bộ môn xét duyệt.', 'INVALID_STATUS_FOR_DEPARTMENT_RETURN', 409);
        }
        await validateAcademicScope(db, {
            actorId: actId,
            registrationId: request.registrationId,
            capabilityCode: 'BM02A_FINAL_APPROVE',
            now,
        });
    } else {
        throw new BM02AWorkflowError('Vai trò người trả lại không hợp lệ.', 'INVALID_ACTOR_ROLE', 400);
    }

    const currentVersion = request.versions.find((v) => v.versionNumber === request.currentVersionNumber);
    if (!currentVersion) {
        throw new BM02AWorkflowError('Không tìm thấy phiên bản biểu mẫu BM02-A.', 'FORM_VERSION_NOT_FOUND', 404);
    }

    const isFirstVersion = currentVersion.versionNumber === 1;
    const isWithinDeadline = now.getTime() <= request.titleAdjustmentDeadline.getTime();
    const targetStatus = (isFirstVersion && isWithinDeadline) ? 'RETURNED_FOR_CORRECTION' : 'REJECTED_FINAL';

    const executeReturn = async (tx) => {
        await recordSignatureEvent({
            registrationId: request.registrationId,
            entityType: 'BM02A_VERSION',
            entityId: currentVersion.id,
            versionNumber: currentVersion.versionNumber,
            signerId: actId,
            signerRole: actorRole,
            action: targetStatus === 'RETURNED_FOR_CORRECTION' ? 'RETURN' : 'REJECT',
            expectedPayloadHash: currentVersion.payloadHash,
            rejectionOrReturnReason: reason,
        }, { tx });

        await tx.bM02AFormVersion.update({
            where: { id: currentVersion.id },
            data: {
                returnedByRole: actorRole,
                returnReason: reason,
                returnedAt: now,
            },
        });

        const updated = await tx.bM02AAdjustmentRequest.update({
            where: { id: reqId },
            data: { status: targetStatus },
            include: { versions: true },
        });

        return updated;
    };

    if (options.tx) {
        return executeReturn(options.tx);
    }
    return prisma.$transaction(executeReturn);
}

/**
 * Student revises BM02-A creating versionNumber = 2.
 * Uses atomic conditional update WHERE id = requestId AND revisionCount = 0 AND status = 'RETURNED_FOR_CORRECTION' AND titleAdjustmentDeadline >= now.
 */
async function reviseBM02A({
    requestId,
    studentId,
    proposedTitle,
    reason,
    idempotencyKey,
}, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const now = options.now ? new Date(options.now) : new Date();
    const reqId = Number(requestId);
    const stuId = Number(studentId);

    const request = await db.bM02AAdjustmentRequest.findUnique({
        where: { id: reqId },
        include: {
            registration: true,
            versions: true,
        },
    });

    if (!request) {
        throw new BM02AWorkflowError('Không tìm thấy yêu cầu BM02-A.', 'BM02A_NOT_FOUND', 404);
    }

    if (request.registration?.studentId !== stuId && request.createdById !== stuId) {
        throw new BM02AWorkflowError('Chỉ sinh viên thực hiện mới được sửa phiếu BM02-A.', 'FORBIDDEN_NOT_STUDENT', 403);
    }

    if (now.getTime() > request.titleAdjustmentDeadline.getTime()) {
        throw new BM02AWorkflowError('Đã quá thời hạn sửa phiếu điều chỉnh tên đề tài (168 giờ).', 'TITLE_ADJUSTMENT_WINDOW_CLOSED', 409);
    }

    const cleanProposedTitle = String(proposedTitle || '').trim();
    const cleanReason = String(reason || '').trim();

    if (!cleanProposedTitle || !cleanReason) {
        throw new BM02AWorkflowError('Tên đề tài đề xuất và lý do điều chỉnh không được để trống.', 'MISSING_PROPOSED_TITLE_OR_REASON', 400);
    }

    const executeRevise = async (tx) => {
        // Atomic conditional check on revisionCount = 0, status, and deadline
        const updateResult = await tx.bM02AAdjustmentRequest.updateMany({
            where: {
                id: reqId,
                revisionCount: 0,
                status: 'RETURNED_FOR_CORRECTION',
                titleAdjustmentDeadline: { gte: now },
            },
            data: {
                revisionCount: 1,
                currentVersionNumber: 2,
                status: 'STUDENT_PREPARING',
            },
        });

        if (!updateResult || updateResult.count === 0) {
            throw new BM02AWorkflowError(
                'Không thể sửa phiếu BM02-A: Đã hết số lần sửa đổi cho phép (tối đa 1 lần) hoặc quá thời hạn quy định.',
                'REVISION_LIMIT_EXCEEDED',
                409,
            );
        }

        const v1 = request.versions.find((v) => v.versionNumber === 1);
        const registeredTitleSnapshot = v1?.registeredTitleSnapshot || '';

        const v2Payload = {
            registrationId: request.registrationId,
            versionNumber: 2,
            registeredTitleSnapshot,
            proposedTitle: cleanProposedTitle,
            reason: cleanReason,
            studentSnapshot: v1?.studentSnapshot || {},
        };
        const newPayloadHash = options.payloadHash || computeCanonicalPayloadHash(v2Payload);

        const v2Version = await tx.bM02AFormVersion.create({
            data: {
                requestId: reqId,
                versionNumber: 2,
                studentSnapshot: v1?.studentSnapshot || {},
                registeredTitleSnapshot,
                proposedTitle: cleanProposedTitle,
                reason: cleanReason,
                payloadHash: newPayloadHash,
                isLocked: false,
            },
        });

        const updated = await tx.bM02AAdjustmentRequest.findUnique({
            where: { id: reqId },
            include: { versions: true },
        });

        return { ...updated, newVersion: v2Version };
    };

    if (options.tx) {
        return executeRevise(options.tx);
    }
    return prisma.$transaction(executeRevise);
}

/**
 * Gets BM02-A request by ID.
 */
async function getBM02ARequestById(requestId, options = {}) {
    const db = options.tx || options.prisma || prisma;
    return db.bM02AAdjustmentRequest.findUnique({
        where: { id: Number(requestId) },
        include: {
            registration: {
                include: {
                    student: { select: { id: true, fullName: true, code: true, email: true } },
                    topic: {
                        include: {
                            mentor: { select: { id: true, fullName: true, code: true, email: true, department: true } },
                        },
                    },
                },
            },
            versions: {
                orderBy: { versionNumber: 'asc' },
            },
            appendixItems: {
                include: { appendix: true },
            },
        },
    });
}

/**
 * Gets all BM02-A requests for a registration.
 */
async function getBM02ARequestsByRegistration(registrationId, options = {}) {
    const db = options.tx || options.prisma || prisma;
    return db.bM02AAdjustmentRequest.findMany({
        where: { registrationId: Number(registrationId) },
        include: {
            versions: {
                orderBy: { versionNumber: 'asc' },
            },
            appendixItems: {
                include: { appendix: true },
            },
        },
        orderBy: { id: 'desc' },
    });
}

/**
 * Gets pending BM02-A queue for lecturer or department head / admin.
 */
async function getPendingBM02AQueue(user = {}, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const where = {};
    if (user.role === 'LECTURER') {
        where.registration = {
            topic: {
                mentorId: user.id,
            },
        };
    }
    return db.bM02AAdjustmentRequest.findMany({
        where,
        include: {
            registration: {
                include: {
                    student: { select: { id: true, fullName: true, code: true, email: true } },
                    topic: {
                        include: {
                            mentor: { select: { id: true, fullName: true, code: true, email: true, department: true } },
                        },
                    },
                },
            },
            versions: {
                orderBy: { versionNumber: 'desc' },
            },
            appendixItems: {
                include: { appendix: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
}

module.exports = {
    BM02AWorkflowError,
    createBM02ARequest,
    studentSignAndSubmitBM02A,
    advisorSignBM02A,
    departmentSignBM02A,
    returnBM02A,
    reviseBM02A,
    getBM02ARequestById,
    getBM02ARequestsByRegistration,
    getPendingBM02AQueue,
};
