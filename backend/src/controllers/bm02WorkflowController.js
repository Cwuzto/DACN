const prisma = require('../config/database');
const {
    submitBM02,
    createTopicDecision,
    publishTopicDecision,
} = require('../services/academicDocumentService');
const { reviewBM02 } = require('../services/bm02ReviewService');
const { safeNotify } = require('../services/notificationService');
const { auditLog } = require('../services/auditLogService');

function getIdempotencyKey(req, prefix = 'bm02-cmd') {
    const headerKey = req.headers['idempotency-key'] || req.get('Idempotency-Key');
    if (headerKey && String(headerKey).trim().length >= 8) {
        return String(headerKey).trim();
    }
    if (req.body?.idempotencyKey && String(req.body.idempotencyKey).trim().length >= 8) {
        return String(req.body.idempotencyKey).trim();
    }
    return `${prefix}-${req.user?.id || 'anon'}-${Date.now()}`;
}

function handleWorkflowError(res, error) {
    if (error?.name === 'WorkflowTransitionError') {
        return res.status(error.status || 400).json({
            success: false,
            message: error.message || error.code,
            code: error.code,
        });
    }
    return false;
}

async function resolveRegistrationId(id) {
    const numId = parseInt(id, 10);
    if (!Number.isInteger(numId) || numId <= 0) return null;

    const reg = await prisma.topicRegistration.findUnique({
        where: { id: numId },
        select: { id: true },
    });
    if (reg) return reg.id;

    const sub = await prisma.bM02Submission.findUnique({
        where: { id: numId },
        select: { registrationId: true },
    });
    return sub ? sub.registrationId : null;
}

/**
 * POST /api/bm02/applications/:registrationId/submit
 */
const submitBM02Application = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.registrationId, 10);
        if (!Number.isInteger(registrationId) || registrationId <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const { bm02ProposedTitle, titleChangeReason, content, fileUrl, fileName } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'bm02-sub');

        const submission = await submitBM02({
            registrationId,
            studentId: req.user.id,
            bm02ProposedTitle,
            titleChangeReason,
            content,
            fileUrl,
            fileName,
            idempotencyKey,
        });

        if (!submission.idempotent) {
            await auditLog(
                req.user.id,
                'SUBMIT_BM02',
                'BM02Submission',
                submission.id,
                { registrationId, versionNo: submission.versionNo },
                req.ip || null,
            );
        }

        return res.status(201).json({
            success: true,
            message: 'Nộp đơn đăng ký BM02 thành công.',
            data: submission,
        });
    } catch (error) {
        if (handleWorkflowError(res, error)) return;
        next(error);
    }
};

/**
 * POST /api/bm02/applications/:id/request-revision
 */
const requestBM02Revision = async (req, res, next) => {
    try {
        const registrationId = await resolveRegistrationId(req.params.id);
        if (!registrationId) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ hoặc đơn đăng ký BM02.' });
        }

        const { issues } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'bm02-return');

        const result = await reviewBM02({
            registrationId,
            reviewerId: req.user.id,
            action: 'RETURN_FOR_REVISION',
            issues: issues || [],
            idempotencyKey,
        });

        if (!result.idempotent) {
            await auditLog(
                req.user.id,
                'RETURN_BM02_REVISION',
                'BM02Submission',
                result.submission.id,
                { registrationId, issues },
                req.ip || null,
            );
        }

        return res.json({
            success: true,
            message: 'Đã yêu cầu sinh viên chỉnh sửa đơn BM02.',
            data: result,
        });
    } catch (error) {
        if (handleWorkflowError(res, error)) return;
        next(error);
    }
};

/**
 * POST /api/bm02/applications/:id/resubmit
 */
const resubmitBM02Application = async (req, res, next) => {
    try {
        const registrationId = await resolveRegistrationId(req.params.id);
        if (!registrationId) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ hoặc đơn đăng ký BM02.' });
        }

        const { bm02ProposedTitle, titleChangeReason, content, fileUrl, fileName } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'bm02-resub');

        const submission = await submitBM02({
            registrationId,
            studentId: req.user.id,
            bm02ProposedTitle,
            titleChangeReason,
            content,
            fileUrl,
            fileName,
            idempotencyKey,
        });

        if (!submission.idempotent) {
            await auditLog(
                req.user.id,
                'RESUBMIT_BM02',
                'BM02Submission',
                submission.id,
                { registrationId, versionNo: submission.versionNo },
                req.ip || null,
            );
        }

        return res.status(201).json({
            success: true,
            message: 'Nộp lại đơn đăng ký BM02 thành công.',
            data: submission,
        });
    } catch (error) {
        if (handleWorkflowError(res, error)) return;
        next(error);
    }
};

/**
 * POST /api/bm02/applications/:id/approve
 */
const approveBM02Application = async (req, res, next) => {
    try {
        const registrationId = await resolveRegistrationId(req.params.id);
        if (!registrationId) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ hoặc đơn đăng ký BM02.' });
        }

        const idempotencyKey = getIdempotencyKey(req, 'bm02-approve');

        const result = await reviewBM02({
            registrationId,
            reviewerId: req.user.id,
            action: 'APPROVE',
            targetStatus: 'BM02_APPROVED',
            issues: [],
            idempotencyKey,
        });

        if (!result.idempotent) {
            await auditLog(
                req.user.id,
                'APPROVE_BM02',
                'BM02Submission',
                result.submission.id,
                { registrationId },
                req.ip || null,
            );
        }

        return res.json({
            success: true,
            message: 'Đã phê duyệt đơn đăng ký đề tài BM02.',
            data: result,
        });
    } catch (error) {
        if (handleWorkflowError(res, error)) return;
        next(error);
    }
};

/**
 * POST /api/topic-decisions
 */
const createTopicDecisionController = async (req, res, next) => {
    try {
        const { semesterId, decisionNumber, decisionDate, fileUrl, fileName, registrationIds } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'topic-dec-create');

        const decision = await createTopicDecision({
            semesterId,
            decisionNumber,
            decisionDate: decisionDate ? new Date(decisionDate) : new Date(),
            fileUrl,
            fileName,
            registrationIds,
            issuedById: req.user.id,
            idempotencyKey,
        });

        if (!decision.idempotent) {
            await auditLog(
                req.user.id,
                'CREATE_TOPIC_DECISION',
                'TopicAssignmentDecision',
                decision.id,
                { semesterId, decisionNumber, registrationIds },
                req.ip || null,
            );
        }

        return res.status(201).json({
            success: true,
            message: 'Tạo dự thảo Quyết định giao đề tài thành công.',
            data: decision,
        });
    } catch (error) {
        if (handleWorkflowError(res, error)) return;
        next(error);
    }
};

/**
 * POST /api/topic-decisions/:id/publish
 */
const publishTopicDecisionController = async (req, res, next) => {
    try {
        const decisionId = parseInt(req.params.id, 10);
        if (!Number.isInteger(decisionId) || decisionId <= 0) {
            return res.status(400).json({ success: false, message: 'decisionId không hợp lệ.' });
        }

        const { publishedAt } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'topic-dec-publish');

        const result = await publishTopicDecision({
            decisionId,
            publishedById: req.user.id,
            publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
            idempotencyKey,
        });

        if (!result.idempotent) {
            await auditLog(
                req.user.id,
                'PUBLISH_TOPIC_DECISION',
                'TopicAssignmentDecision',
                result.id,
                { decisionId, publishedAt: result.decisionPublishedAt },
                req.ip || null,
            );
        }

        return res.json({
            success: true,
            message: 'Ban hành Quyết định giao đề tài thành công.',
            data: result,
        });
    } catch (error) {
        if (handleWorkflowError(res, error)) return;
        next(error);
    }
};

module.exports = {
    submitBM02Application,
    requestBM02Revision,
    resubmitBM02Application,
    approveBM02Application,
    createTopicDecisionController,
    publishTopicDecisionController,
};
