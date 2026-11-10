const {
    createBM02ARequest,
    studentSignAndSubmitBM02A,
    advisorSignBM02A,
    departmentSignBM02A,
    returnBM02A,
    reviseBM02A,
    getBM02ARequestById,
    getBM02ARequestsByRegistration,
    BM02AWorkflowError,
} = require('../services/bm02aWorkflowService');

const {
    createAppendixDraft,
    updateAppendixItems,
    issueAppendix,
    getAppendixById,
    getAppendicesByDecision,
} = require('../services/titleAdjustmentAppendixService');

function getIdempotencyKey(req, prefix = 'bm02a-cmd') {
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
    if (error instanceof BM02AWorkflowError || error?.name === 'WorkflowTransitionError' || error?.code) {
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
 * POST /api/bm02a/requests
 */
const createBM02ARequestController = async (req, res, next) => {
    try {
        const { registrationId, proposedTitle, reason } = req.body;
        const studentId = req.user.id;

        const result = await createBM02ARequest({
            registrationId,
            studentId,
            proposedTitle,
            reason,
        });

        return res.status(201).json({
            success: true,
            data: result,
            message: 'Tạo đơn điều chỉnh tên đề tài BM02-A thành công.',
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm02a/requests/:id/student-sign-submit
 */
const studentSignAndSubmitBM02AController = async (req, res, next) => {
    try {
        const requestId = parseInt(req.params.id, 10);
        const studentId = req.user.id;
        const { payloadHash, signatureImageId } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'];
        const userAgent = req.headers['user-agent'];
        const idempotencyKey = getIdempotencyKey(req, 'bm02a-stu-sign');

        const result = await studentSignAndSubmitBM02A({
            requestId,
            studentId,
            payloadHash,
            signatureImageId,
            ipAddress,
            userAgent,
            idempotencyKey,
        });

        return res.status(200).json({
            success: true,
            data: result,
            message: 'Ký nộp đơn điều chỉnh tên đề tài BM02-A thành công.',
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm02a/requests/:id/advisor-sign
 */
const advisorSignBM02AController = async (req, res, next) => {
    try {
        const requestId = parseInt(req.params.id, 10);
        const advisorId = req.user.id;
        const { payloadHash, signatureImageId } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'];
        const userAgent = req.headers['user-agent'];
        const idempotencyKey = getIdempotencyKey(req, 'bm02a-adv-sign');

        const result = await advisorSignBM02A({
            requestId,
            advisorId,
            payloadHash,
            signatureImageId,
            ipAddress,
            userAgent,
            idempotencyKey,
        });

        return res.status(200).json({
            success: true,
            data: result,
            message: 'GVHD ký xác nhận đơn điều chỉnh tên đề tài BM02-A thành công.',
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm02a/requests/:id/department-sign
 */
const departmentSignBM02AController = async (req, res, next) => {
    try {
        const requestId = parseInt(req.params.id, 10);
        const departmentHeadId = req.user.id;
        const { payloadHash, signatureImageId } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'];
        const userAgent = req.headers['user-agent'];
        const idempotencyKey = getIdempotencyKey(req, 'bm02a-dept-sign');

        const result = await departmentSignBM02A({
            requestId,
            departmentHeadId,
            payloadHash,
            signatureImageId,
            ipAddress,
            userAgent,
            idempotencyKey,
        }, {
            departmentHeadName: req.user.fullName,
        });

        return res.status(200).json({
            success: true,
            data: result,
            message: 'Phụ trách bộ môn phê duyệt và ký số hoàn tất đơn BM02-A.',
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm02a/requests/:id/return
 */
const returnBM02AController = async (req, res, next) => {
    try {
        const requestId = parseInt(req.params.id, 10);
        const actorId = req.user.id;
        const { reason, actorRole } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'bm02a-return');

        const resolvedRole = actorRole || (req.user.role === 'ADMIN' ? 'DEPARTMENT_HEAD' : 'ADVISOR');

        const result = await returnBM02A({
            requestId,
            actorId,
            actorRole: resolvedRole,
            reason,
            idempotencyKey,
        });

        return res.status(200).json({
            success: true,
            data: result,
            message: 'Đã trả lại/từ chối đơn điều chỉnh tên đề tài BM02-A.',
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/bm02a/requests/:id/revise
 */
const reviseBM02AController = async (req, res, next) => {
    try {
        const requestId = parseInt(req.params.id, 10);
        const studentId = req.user.id;
        const { proposedTitle, reason } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'bm02a-revise');

        const result = await reviseBM02A({
            requestId,
            studentId,
            proposedTitle,
            reason,
            idempotencyKey,
        });

        return res.status(200).json({
            success: true,
            data: result,
            message: 'Sửa đổi đơn BM02-A và khởi tạo phiên bản v2 thành công.',
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * GET /api/bm02a/requests/:id
 */
const getBM02ARequestController = async (req, res, next) => {
    try {
        const requestId = parseInt(req.params.id, 10);
        const result = await getBM02ARequestById(requestId);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu BM02-A.' });
        }
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * GET /api/bm02a/registrations/:registrationId
 */
const getBM02ARequestsByRegistrationController = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.registrationId, 10);
        const result = await getBM02ARequestsByRegistration(registrationId);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/title-adjustment-appendices
 */
const createAppendixDraftController = async (req, res, next) => {
    try {
        const { decisionId, appendixNumber, signedDate, fileUrl, fileName, bm02aRequestIds } = req.body;
        const issuedById = req.user.id;
        const idempotencyKey = getIdempotencyKey(req, 'appendix-create');

        const result = await createAppendixDraft({
            decisionId,
            appendixNumber,
            signedDate,
            fileUrl,
            fileName,
            bm02aRequestIds,
            issuedById,
            idempotencyKey,
        });

        return res.status(201).json({
            success: true,
            data: result,
            message: 'Tạo dự thảo phụ lục điều chỉnh tên đề tài thành công.',
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * PUT /api/title-adjustment-appendices/:id/items
 */
const updateAppendixItemsController = async (req, res, next) => {
    try {
        const appendixId = parseInt(req.params.id, 10);
        const { bm02aRequestIds } = req.body;
        const actorId = req.user.id;

        const result = await updateAppendixItems({
            appendixId,
            bm02aRequestIds,
            actorId,
        });

        return res.status(200).json({
            success: true,
            data: result,
            message: 'Cập nhật danh sách đề tài trong phụ lục thành công.',
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * POST /api/title-adjustment-appendices/:id/issue
 */
const issueAppendixController = async (req, res, next) => {
    try {
        const appendixId = parseInt(req.params.id, 10);
        const issuedById = req.user.id;
        const { signedDate } = req.body;
        const idempotencyKey = getIdempotencyKey(req, 'appendix-issue');

        const result = await issueAppendix({
            appendixId,
            issuedById,
            signedDate,
            idempotencyKey,
        });

        return res.status(200).json({
            success: true,
            data: result,
            message: 'Ban hành phụ lục điều chỉnh tên đề tài thành công.',
        });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * GET /api/title-adjustment-appendices/:id
 */
const getAppendixController = async (req, res, next) => {
    try {
        const appendixId = parseInt(req.params.id, 10);
        const result = await getAppendixById(appendixId);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phụ lục.' });
        }
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

/**
 * GET /api/title-adjustment-appendices/decisions/:decisionId
 */
const getAppendicesByDecisionController = async (req, res, next) => {
    try {
        const decisionId = parseInt(req.params.decisionId, 10);
        const result = await getAppendicesByDecision(decisionId);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleWorkflowError(res, error, next);
    }
};

module.exports = {
    createBM02ARequestController,
    studentSignAndSubmitBM02AController,
    advisorSignBM02AController,
    departmentSignBM02AController,
    returnBM02AController,
    reviseBM02AController,
    getBM02ARequestController,
    getBM02ARequestsByRegistrationController,
    createAppendixDraftController,
    updateAppendixItemsController,
    issueAppendixController,
    getAppendixController,
    getAppendicesByDecisionController,
};
