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

/**
 * Nộp đề cương đợt 1 (v1)
 * POST /api/outline/submissions
 */
const submitOutline = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.body.registrationId, 10);
        const { fileData } = req.body;
        const userId = req.user.id;

        const result = await outlineReviewService.submitInitialOutline(registrationId, fileData, userId);

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
        const { fileData } = req.body;
        const userId = req.user.id;

        const result = await outlineReviewService.submitResubmissionOutline(registrationId, fileData, userId);

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

module.exports = {
    submitOutline,
    submitResubmission,
    getMyOutline,
};
