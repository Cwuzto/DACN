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
        const record = await getBM03Record(registrationId);
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
        const advisorId = req.user.id;
        const meeting = await createBM03Meeting({
            registrationId,
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
        const advisorId = req.user.id;
        const { signatureImageId } = req.body;
        const ipAddress = req.ip || req.connection?.remoteAddress || null;
        const userAgent = req.get('user-agent') || null;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-sign-meeting');

        const signed = await signBM03Meeting({
            meetingId: id,
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
        const advisorId = req.user.id;
        const { comments, decision } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-midterm-eval');

        const result = await submitStageEvaluation({
            registrationId,
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
        const advisorId = req.user.id;
        const { comments, decision } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-final-eval');

        const result = await submitStageEvaluation({
            registrationId,
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
        const reviewerId = req.user.id;
        const { note } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-stop-moreinfo');

        const result = await requestMoreInfoForStopReview({
            stopReviewId: id,
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
        const reviewerId = req.user.id;
        const { decision, reason } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-stop-decision');

        const result = await decideStopReview({
            stopReviewId: id,
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
        const advisorId = req.user.id;
        const { signatureImageId } = req.body;
        const ipAddress = req.ip || req.connection?.remoteAddress || null;
        const userAgent = req.get('user-agent') || null;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-advisor-whole-sign');

        const result = await advisorSignWholeBM03({
            bm03RecordId: id,
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
        const studentId = req.user.id;
        const { action = 'ACKNOWLEDGED', comment } = req.body;
        const ipAddress = req.ip || req.connection?.remoteAddress || null;
        const userAgent = req.get('user-agent') || null;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-student-ack');

        const result = await studentAcknowledgeBM03({
            bm03RecordId: id,
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
        const studentId = req.user.id;
        const { comment } = req.body;
        const ipAddress = req.ip || req.connection?.remoteAddress || null;
        const userAgent = req.get('user-agent') || null;
        const idempotencyKey = getIdempotencyKey(req, 'bm03-student-decline');

        const result = await studentAcknowledgeBM03({
            bm03RecordId: id,
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
};
