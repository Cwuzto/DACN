const prisma = require('../config/database');
const { ensurePolicy } = require('../../scripts/workflow-integrity/backfillWorkflowFoundation');
const { transitionRegistration } = require('../services/registrationTransitionService');
const { auditLog } = require('../services/auditLogService');

const listManualReviewCases = async (req, res, next) => {
    try {
        const { status = 'OPEN', semesterId, page = 1, limit = 20 } = req.query;
        const pageInt = Math.max(1, parseInt(page, 10));
        const limitInt = Math.max(1, Math.min(100, parseInt(limit, 10)));
        const skip = (pageInt - 1) * limitInt;

        const where = {};
        if (status && status !== 'ALL') {
            where.status = status;
        }
        if (semesterId) {
            where.registration = { semesterId: parseInt(semesterId, 10) };
        }

        const [cases, total] = await Promise.all([
            prisma.manualReviewCase.findMany({
                where,
                skip,
                take: limitInt,
                orderBy: { createdAt: 'desc' },
                include: {
                    registration: {
                        select: {
                            id: true,
                            status: true,
                            decisionNumber: true,
                            stateVersion: true,
                            periodPolicyVersionId: true,
                            student: { select: { id: true, code: true, fullName: true, email: true } },
                            topic: {
                                select: {
                                    id: true,
                                    title: true,
                                    mentor: { select: { id: true, fullName: true, code: true } },
                                },
                            },
                            semester: { select: { id: true, name: true } },
                        },
                    },
                    openedBy: { select: { id: true, fullName: true } },
                    resolvedBy: { select: { id: true, fullName: true } },
                },
            }),
            prisma.manualReviewCase.count({ where }),
        ]);

        res.json({
            success: true,
            data: {
                cases,
                pagination: {
                    total,
                    page: pageInt,
                    limit: limitInt,
                    totalPages: Math.ceil(total / limitInt),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

const getManualReviewCaseDetail = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const reviewCase = await prisma.manualReviewCase.findUnique({
            where: { id },
            include: {
                registration: {
                    include: {
                        student: { select: { id: true, code: true, fullName: true, email: true } },
                        topic: {
                            include: {
                                mentor: { select: { id: true, fullName: true, code: true, email: true } },
                            },
                        },
                        semester: true,
                        tasks: {
                            select: { id: true, title: true, type: true, status: true, isBypassed: true, bypassReason: true },
                        },
                        defenseResult: true,
                        memberScores: {
                            include: {
                                lecturer: { select: { id: true, fullName: true } },
                            },
                        },
                        archive: true,
                        stateHistory: { orderBy: { createdAt: 'asc' } },
                    },
                },
                openedBy: { select: { id: true, fullName: true } },
                resolvedBy: { select: { id: true, fullName: true } },
            },
        });

        if (!reviewCase) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ thẩm định.' });
        }

        res.json({ success: true, data: reviewCase });
    } catch (error) {
        next(error);
    }
};

const resolveManualReviewCase = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { resolution, targetStatus } = req.body;

        if (!resolution || !resolution.trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp nội dung quyết định thẩm định (resolution).' });
        }

        const reviewCase = await prisma.manualReviewCase.findUnique({
            where: { id },
            include: { registration: true },
        });

        if (!reviewCase) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ thẩm định.' });
        }

        if (reviewCase.status === 'RESOLVED') {
            return res.status(400).json({ success: false, message: 'Hồ sơ này đã được giải quyết trước đó.' });
        }

        await prisma.$transaction(async (tx) => {
            // Đảm bảo policy cho semester
            const policy = await ensurePolicy(reviewCase.registration.semesterId, tx);

            // Gán policyVersionId nếu chưa có
            if (!reviewCase.registration.periodPolicyVersionId) {
                await tx.topicRegistration.update({
                    where: { id: reviewCase.registrationId },
                    data: { periodPolicyVersionId: policy.id },
                });
            }

            // Nếu Admin chỉ định targetStatus hợp lệ thì chuyển trạng thái
            if (targetStatus && targetStatus !== reviewCase.registration.status) {
                await transitionRegistration({
                    registrationId: reviewCase.registrationId,
                    expectedStatus: reviewCase.registration.status,
                    expectedStateVersion: reviewCase.registration.stateVersion,
                    targetStatus,
                    actorId: req.user.id,
                    reason: `Manual Review Resolution: ${resolution}`,
                    referenceType: 'MANUAL_REVIEW_CASE',
                    referenceId: id,
                    tx,
                });
            }

            // Đóng ManualReviewCase
            await tx.manualReviewCase.update({
                where: { id },
                data: {
                    status: 'RESOLVED',
                    resolution: resolution.trim(),
                    resolvedById: req.user.id,
                    resolvedAt: new Date(),
                },
            });

            await auditLog({
                userId: req.user.id,
                action: 'RESOLVE_MANUAL_REVIEW_CASE',
                resource: 'MANUAL_REVIEW_CASE',
                resourceId: id,
                details: {
                    registrationId: reviewCase.registrationId,
                    resolution: resolution.trim(),
                    targetStatus: targetStatus || reviewCase.registration.status,
                },
            });
        });

        res.json({
            success: true,
            message: 'Đã giải quyết hồ sơ thẩm định thành công.',
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listManualReviewCases,
    getManualReviewCaseDetail,
    resolveManualReviewCase,
};
