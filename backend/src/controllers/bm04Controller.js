const {
    getBM04Record,
    saveBM04Draft,
    signAndSubmitBM04,
    requestMoreInfoForDefenseReview,
    decideDefenseReview,
    BM04WorkflowError,
} = require('../services/bm04WorkflowService');

const {
    runBm02ToBm04SweepJobs,
} = require('../services/bm02ToBm04SweepService');

function getIdempotencyKey(req, prefix = 'bm04-cmd') {
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
    if (error instanceof BM04WorkflowError || error?.name === 'WorkflowTransitionError' || error?.code) {
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
 * GET /api/bm04/:registrationId
 * Pure read-only endpoint (no DB mutation on GET).
 */
const getBM04RecordController = async (req, res, next) => {
    try {
        const { registrationId } = req.params;
        const record = await getBM04Record(registrationId);
        return res.status(200).json({
            success: true,
            data: record,
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm04/:registrationId/save-draft
 */
const saveBM04DraftController = async (req, res, next) => {
    try {
        const { registrationId } = req.params;
        const advisorId = req.user?.id;
        const {
            thesisFormatScore,
            researchContentScore,
            applicabilityScore,
            attitudeScore,
            programOutcome,
            defenseRecommendation,
            mismatchReason,
            generalNotes,
        } = req.body || {};

        const result = await saveBM04Draft({
            registrationId,
            advisorId,
            thesisFormatScore,
            researchContentScore,
            applicabilityScore,
            attitudeScore,
            programOutcome,
            defenseRecommendation,
            mismatchReason,
            generalNotes,
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
 * POST /api/bm04/:registrationId/sign-submit
 */
const signAndSubmitBM04Controller = async (req, res, next) => {
    try {
        const { registrationId } = req.params;
        const advisorId = req.user?.id;
        const idempotencyKey = getIdempotencyKey(req, 'bm04-sign');
        const {
            thesisFormatScore,
            researchContentScore,
            applicabilityScore,
            attitudeScore,
            programOutcome,
            defenseRecommendation,
            mismatchReason,
            generalNotes,
            lecturerSignature,
            signatureImageId,
        } = req.body || {};

        const result = await signAndSubmitBM04({
            registrationId,
            advisorId,
            thesisFormatScore,
            researchContentScore,
            applicabilityScore,
            attitudeScore,
            programOutcome,
            defenseRecommendation,
            mismatchReason,
            generalNotes,
            lecturerSignature,
            signatureImageId,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('user-agent'),
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
 * POST /api/bm04/defense-reviews/:id/request-more-info
 */
const requestMoreInfoForDefenseReviewController = async (req, res, next) => {
    try {
        const reviewId = req.params.id;
        const reviewerId = req.user?.id;
        const { note } = req.body || {};
        const idempotencyKey = getIdempotencyKey(req, 'bm04-def-more-info');

        const result = await requestMoreInfoForDefenseReview({
            reviewId,
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
 * POST /api/bm04/defense-reviews/:id/decision
 */
const decideDefenseReviewController = async (req, res, next) => {
    try {
        const reviewId = req.params.id;
        const reviewerId = req.user?.id;
        const { decision, reason } = req.body || {};
        const idempotencyKey = getIdempotencyKey(req, 'bm04-def-decide');

        const result = await decideDefenseReview({
            reviewId,
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
 * POST /api/bm04/sweep-overdue
 */
const runSweepJobsController = async (req, res, next) => {
    try {
        const report = await runBm02ToBm04SweepJobs({
            now: req.body?.now ? new Date(req.body.now) : new Date(),
        });

        return res.status(200).json({
            success: true,
            data: report,
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

module.exports = {
    getBM04RecordController,
    saveBM04DraftController,
    signAndSubmitBM04Controller,
    requestMoreInfoForDefenseReviewController,
    decideDefenseReviewController,
    runSweepJobsController,
};
