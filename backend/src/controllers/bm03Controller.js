const prisma = require('../config/database');
const {
    getBM03Record,
    getOrCreateBM03Record,
    createBM03Meeting,
    signBM03Meeting,
    submitStageEvaluation,
    requestMoreInfoForStopReview,
    decideStopReview,
    advisorSignWholeBM03,
    studentAcknowledgeBM03,
    listStopReviews,
    BM03WorkflowError,
} = require('../services/bm03WorkflowService');

function getIdempotencyKey(req, prefix = 'bm03-cmd') {
    const headerKey = req.headers['idempotency-key'] || req.get('Idempotency-Key');
    if (headerKey && String(headerKey).trim().length >= 8) {
        return String(headerKey).trim();
    }
    if (req.body?.idempotencyKey && String(req.body.idempotencyKey).trim().length >= 8) {
        return String(req.body.idempotencyKey).trim();
    }
    return `${prefix}-${req.user?.id || 'anon'}-${Date.now()}`;
}

function parsePositiveInteger(value) {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) {
        return null;
    }
    return num;
}

function handleWorkflowError(res, error, next) {
    if (error instanceof BM03WorkflowError || error?.name === 'WorkflowTransitionError' || error?.code) {
        return res.status(error.statusCode || error.status || 400).json({
            success: false,
            message: error.message || error.code,
            code: error.code || 'WORKFLOW_ERROR',
        });
    }
    if (next) return next(error);
    return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
    });
}

/**
 * GET /api/bm03/:registrationId
 * Pure read-only endpoint (no DB mutation on GET).
 */
const getBM03RecordController = async (req, res, next) => {
    try {
        const { registrationId } = req.params;
        const regId = parsePositiveInteger(registrationId);
        if (!regId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'ID hồ sơ không hợp lệ.' });
        }
        const record = await getBM03Record(regId);

        // Check ownership & authorization
        const user = req.user;
        const registration = record.registration;
        const studentId = registration?.studentId || registration?.student?.id;
        const mentorId = registration?.topic?.mentorId || registration?.topic?.mentor?.id;
        const permissions = user?.permissions || [];

        const hasPrivilegedPermission = permissions.some((p) =>
            ['VIEW_PROJECT_OVERSIGHT', 'BM03_STOP_REVIEW', 'VIEW_ALL_TOPICS'].includes(p)
        );

        let isAuthorized = false;

        if (user?.role === 'ADMIN' || hasPrivilegedPermission) {
            isAuthorized = true;
        } else if (studentId && Number(studentId) === Number(user?.id)) {
            isAuthorized = true;
        } else if (mentorId && Number(mentorId) === Number(user?.id)) {
            isAuthorized = true;
        } else if (user?.id) {
            // Check defense council membership
            const councilIds = [registration?.defenseCouncilId, registration?.councilId].filter(Boolean);
            if (councilIds.length > 0) {
                const membership = await prisma.councilMember.findFirst({
                    where: {
                        councilId: { in: councilIds },
                        lecturerId: Number(user.id),
                        isActive: true,
                    },
                });
                if (membership) {
                    isAuthorized = true;
                }
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN_RESOURCE',
                message: 'Bạn không có quyền truy cập hồ sơ BM03 này.',
            });
        }

        return res.status(200).json({
            success: true,
            data: record,
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm03/:registrationId/meetings
 */
const createBM03MeetingController = async (req, res, next) => {
    try {
        const { registrationId } = req.params;
        const regId = parsePositiveInteger(registrationId);
        if (!regId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'ID hồ sơ không hợp lệ.' });
        }
        const advisorId = req.user.id;
        const meeting = await createBM03Meeting({
            registrationId: regId,
            advisorId,
            ...req.body,
        });
        return res.status(201).json({
            success: true,
            data: meeting,
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm03/meetings/:id/sign
 */
const signBM03MeetingController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const meetingId = parsePositiveInteger(id);
        if (!meetingId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'ID buổi họp không hợp lệ.' });
        }
        const advisorId = req.user.id;
        const { signatureImageId } = req.body;
        const ipAddress = req.ip || req.connection?.remoteAddress || null;
        const userAgent = req.get('user-agent') || null;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-sign-meeting');

        const signed = await signBM03Meeting({
            meetingId,
            advisorId,
            signatureImageId,
            ipAddress,
            userAgent,
            idempotencyKey,
        });

        return res.status(200).json({
            success: true,
            data: signed,
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm03/:registrationId/midterm-evaluation
 */
const submitMidtermEvaluationController = async (req, res, next) => {
    try {
        const { registrationId } = req.params;
        const regId = parsePositiveInteger(registrationId);
        if (!regId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'ID hồ sơ không hợp lệ.' });
        }
        const advisorId = req.user.id;
        const { comments, decision } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-midterm-eval');

        const result = await submitStageEvaluation({
            registrationId: regId,
            advisorId,
            stage: 'MIDTERM',
            comments,
            decision,
            idempotencyKey,
        });

        return res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm03/:registrationId/final-evaluation
 */
const submitFinalEvaluationController = async (req, res, next) => {
    try {
        const { registrationId } = req.params;
        const regId = parsePositiveInteger(registrationId);
        if (!regId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'ID hồ sơ không hợp lệ.' });
        }
        const advisorId = req.user.id;
        const { comments, decision } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-final-eval');

        const result = await submitStageEvaluation({
            registrationId: regId,
            advisorId,
            stage: 'FINAL',
            comments,
            decision,
            idempotencyKey,
        });

        return res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm03/stop-reviews/:id/request-more-info
 */
const requestMoreInfoForStopReviewController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const stopReviewId = parsePositiveInteger(id);
        if (!stopReviewId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'ID đề xuất dừng không hợp lệ.' });
        }
        const reviewerId = req.user.id;
        const { note } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-stop-moreinfo');

        const result = await requestMoreInfoForStopReview({
            stopReviewId,
            reviewerId,
            note,
            idempotencyKey,
        });

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm03/stop-reviews/:id/decision
 */
const decideStopReviewController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const stopReviewId = parsePositiveInteger(id);
        if (!stopReviewId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'ID đề xuất dừng không hợp lệ.' });
        }
        const reviewerId = req.user.id;
        const { decision, reason } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-stop-decision');

        const result = await decideStopReview({
            stopReviewId,
            reviewerId,
            decision,
            reason,
            idempotencyKey,
        });

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm03/:id/advisor-sign
 */
const advisorSignWholeBM03Controller = async (req, res, next) => {
    try {
        const { id } = req.params;
        const bm03RecordId = parsePositiveInteger(id);
        if (!bm03RecordId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'ID hồ sơ BM03 không hợp lệ.' });
        }
        const advisorId = req.user.id;
        const { signatureImageId } = req.body;
        const ipAddress = req.ip || req.connection?.remoteAddress || null;
        const userAgent = req.get('user-agent') || null;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-advisor-whole-sign');

        const result = await advisorSignWholeBM03({
            bm03RecordId,
            advisorId,
            signatureImageId,
            ipAddress,
            userAgent,
            idempotencyKey,
        });

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm03/:id/student-acknowledge
 */
const studentAcknowledgeBM03Controller = async (req, res, next) => {
    try {
        const { id } = req.params;
        const bm03RecordId = parsePositiveInteger(id);
        if (!bm03RecordId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'ID hồ sơ BM03 không hợp lệ.' });
        }
        const studentId = req.user.id;
        const { action = 'ACKNOWLEDGED', comment } = req.body;
        const ipAddress = req.ip || req.connection?.remoteAddress || null;
        const userAgent = req.get('user-agent') || null;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-student-ack');

        const result = await studentAcknowledgeBM03({
            bm03RecordId,
            studentId,
            action,
            comment,
            ipAddress,
            userAgent,
            idempotencyKey,
        });

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm03/:id/student-decline
 */
const studentDeclineBM03Controller = async (req, res, next) => {
    try {
        const { id } = req.params;
        const bm03RecordId = parsePositiveInteger(id);
        if (!bm03RecordId) {
            return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'ID hồ sơ BM03 không hợp lệ.' });
        }
        const studentId = req.user.id;
        const { comment } = req.body;
        const ipAddress = req.ip || req.connection?.remoteAddress || null;
        const userAgent = req.get('user-agent') || null;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-student-decline');

        const result = await studentAcknowledgeBM03({
            bm03RecordId,
            studentId,
            action: 'DECLINED_TO_ACKNOWLEDGE',
            comment,
            ipAddress,
            userAgent,
            idempotencyKey,
        });

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * GET /api/bm03/stop-reviews
 */
const listStopReviewsController = async (req, res, next) => {
    try {
        const { status } = req.query;
        const result = await listStopReviews({ status });
        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

module.exports = {
    getBM03RecordController,
    createBM03MeetingController,
    signBM03MeetingController,
    submitMidtermEvaluationController,
    submitFinalEvaluationController,
    requestMoreInfoForStopReviewController,
    decideStopReviewController,
    advisorSignWholeBM03Controller,
    studentAcknowledgeBM03Controller,
    studentDeclineBM03Controller,
    listStopReviewsController,
};
