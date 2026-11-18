const prisma = require('../config/database');
const outlineReviewService = require('../services/outlineReviewService');
const outlineSweepService = require('../services/outlineSweepService');

const handleControllerError = (error, res, next) => {
    if (error.statusCode) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && typeof error.details === 'object' ? error.details : {}),
        });
    }
    next(error);
};

const buildOutlineSubmissionOptions = (req) => {
    const options = {};
    if (req.body.content !== undefined) {
        options.content = req.body.content;
    }
    const idempotencyKey = req.get?.('Idempotency-Key') || req.headers?.['idempotency-key'] || req.body?.idempotencyKey;
    if (idempotencyKey) {
        options.idempotencyKey = String(idempotencyKey).trim();
    }
    return options;
};

/**
 * Nộp đề cương đợt 1 (v1)
 * POST /api/outline/submissions
 */
const submitOutline = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.body.registrationId, 10);
        const { fileData, assetId } = req.body;
        const userId = req.user.id;
        const normalizedFileData = {
            ...(fileData || {}),
            assetId: assetId || fileData?.assetId || null,
        };
        const serviceOptions = buildOutlineSubmissionOptions(req);

        const result = Object.keys(serviceOptions).length > 0
            ? await outlineReviewService.submitInitialOutline(registrationId, normalizedFileData, userId, serviceOptions)
            : await outlineReviewService.submitInitialOutline(registrationId, normalizedFileData, userId);

        res.status(200).json({
            success: true,
            message: 'Nộp đề cương thành công.',
            data: result,
        });
    } catch (error) {
        handleControllerError(error, res, next);
    }
};

/**
 * Nộp lại đề cương v2
 * POST /api/outline/resubmissions
 */
const submitResubmission = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.body.registrationId, 10);
        const { fileData, assetId } = req.body;
        const userId = req.user.id;
        const normalizedFileData = {
            ...(fileData || {}),
            assetId: assetId || fileData?.assetId || null,
        };
        const serviceOptions = buildOutlineSubmissionOptions(req);

        const result = Object.keys(serviceOptions).length > 0
            ? await outlineReviewService.submitResubmissionOutline(registrationId, normalizedFileData, userId, serviceOptions)
            : await outlineReviewService.submitResubmissionOutline(registrationId, normalizedFileData, userId);

        res.status(200).json({
            success: true,
            message: 'Nộp lại đề cương thành công.',
            data: result,
        });
    } catch (error) {
        handleControllerError(error, res, next);
    }
};

/**
 * Lấy thông tin đề cương của sinh viên hiện tại theo đợt
 * GET /api/outline/my-outline
 */
const getMyOutline = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const semesterId = req.query.semesterId ? parseInt(req.query.semesterId, 10) : null;

        const registration = await prisma.topicRegistration.findFirst({
            where: {
                studentId,
                ...(semesterId ? { semesterId } : {}),
            },
            include: {
                topic: true,
                outlineCouncil: {
                    include: {
                        members: {
                            include: {
                                lecturer: {
                                    select: { id: true, fullName: true, email: true, code: true },
                                },
                            },
                        },
                    },
                },
                bm01Evaluations: {
                    orderBy: { attemptNo: 'desc' },
                },
                tasks: {
                    where: {
                        taskType: { in: ['BM01_INITIAL_SUBMISSION', 'BM01_RESUBMISSION'] },
                    },
                },
                submissions: {
                    orderBy: { submittedAt: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const isOverdue = registration?.outlineCouncil
            ? outlineSweepService.isResubmissionOverdue(registration.outlineCouncil)
            : false;

        res.status(200).json({
            success: true,
            data: registration ? { ...registration, isOverdue } : null,
            isOverdue,
        });
    } catch (error) {
        handleControllerError(error, res, next);
    }
};

/**
 * Thẩm định đề cương (v1 hoặc v2)
 * POST /api/outline/reviews
 * POST /api/outline/reviews/:registrationId
 */
const reviewOutline = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.registrationId || req.body.registrationId, 10);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }
        const status = req.body.status || req.body.decision || req.body.outcome;
        const feedback = req.body.feedback || req.body.reviewComment || req.body.revisionFeedback;
        const validStatuses = ['PASSED', 'REVISION_REQUIRED', 'NEEDS_REVISION', 'FAIL', 'FAILED', 'REJECT', 'APPROVE'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái xét duyệt đề cương không hợp lệ.' });
        }

        const idempotencyKey = req.get?.('Idempotency-Key') || req.headers?.['idempotency-key'] || req.body?.idempotencyKey;

        const result = await outlineReviewService.reviewOutlineRegistration({
            registrationId,
            reviewerId: req.user.id,
            decision: status,
            feedback,
            idempotencyKey,
        });

        res.status(200).json({
            success: true,
            message: 'Đã cập nhật kết quả thẩm định đề cương.',
            data: result,
        });
    } catch (error) {
        handleControllerError(error, res, next);
    }
};

module.exports = {
    submitOutline,
    submitResubmission,
    getMyOutline,
    reviewOutline,
};
