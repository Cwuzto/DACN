const prisma = require('../config/database');
const { auditLog } = require('../services/auditLogService');
const { grantablePermissionCodes } = require('../constants/permissions');

/**
 * GET /api/delegations
 * Lấy danh sách ủy quyền theo department của actor (hoặc lọc theo status/semesterId)
 */
const getDelegations = async (req, res, next) => {
    try {
        const { status, semesterId } = req.query;
        const where = {};

        if (req.user.department) {
            where.department = req.user.department;
        }

        if (status) {
            where.status = status;
        }

        if (semesterId) {
            where.semesterId = parseInt(semesterId, 10);
        }

        const delegations = await prisma.academicDelegation.findMany({
            where,
            include: {
                delegator: {
                    select: { id: true, fullName: true, code: true, email: true },
                },
                delegatee: {
                    select: { id: true, fullName: true, code: true, email: true, department: true },
                },
                semester: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            success: true,
            data: delegations,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/delegations
 * Tạo ủy quyền chuyên môn học thuật mới
 * Yêu cầu PERMISSION_ASSIGN_ACADEMIC
 */
const createDelegation = async (req, res, next) => {
    try {
        const idempotencyKey = req.headers['idempotency-key'];
        if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_IDEMPOTENCY_KEY',
                message: 'Header Idempotency-Key là bắt buộc khi tạo ủy quyền.',
            });
        }

        // Idempotency check: nếu đã tồn tại record với idempotencyKey này, trả về kết quả cũ
        const existing = await prisma.academicDelegation.findUnique({
            where: { idempotencyKey: idempotencyKey.trim() },
            include: {
                delegator: { select: { id: true, fullName: true, code: true } },
                delegatee: { select: { id: true, fullName: true, code: true, department: true } },
            },
        });
        if (existing) {
            return res.status(200).json({
                success: true,
                data: existing,
                message: 'Yêu cầu ủy quyền đã được xử lý trước đó.',
            });
        }

        const { delegateeId, capabilityCode, semesterId, effectiveFrom, effectiveTo, reason } = req.body;

        const targetDelegateeId = parseInt(delegateeId, 10);
        if (!targetDelegateeId || isNaN(targetDelegateeId)) {
            return res.status(400).json({
                success: false,
                message: 'Mã người được ủy quyền (delegateeId) không hợp lệ.',
            });
        }

        // Không cho phép tự ủy quyền
        if (targetDelegateeId === req.user.id) {
            return res.status(400).json({
                success: false,
                error: 'CANNOT_DELEGATE_TO_SELF',
                message: 'Không thể tự ủy quyền chuyên môn cho chính mình.',
            });
        }

        // Kiểm tra capabilityCode thuộc danh mục cho phép ủy quyền
        if (!grantablePermissionCodes.includes(capabilityCode)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_DELEGATION_CAPABILITY',
                message: `Quyền ủy quyền không hợp lệ. Chỉ cho phép ủy quyền các capability: ${grantablePermissionCodes.join(', ')}.`,
            });
        }

        // Kiểm tra thời hạn hiệu lực
        const fromDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
        const toDate = effectiveTo ? new Date(effectiveTo) : null;
        if (!toDate || isNaN(toDate.getTime()) || isNaN(fromDate.getTime()) || toDate <= fromDate) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_EFFECTIVE_PERIOD',
                message: 'Thời gian kết thúc ủy quyền (effectiveTo) phải sau thời gian bắt đầu (effectiveFrom).',
            });
        }

        // Kiểm tra lý do
        if (!reason || typeof reason !== 'string' || !reason.trim()) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_REASON',
                message: 'Lý do ủy quyền là bắt buộc.',
            });
        }

        // Kiểm tra delegator có cấu hình department
        if (!req.user.department) {
            return res.status(403).json({
                success: false,
                error: 'DEPARTMENT_REQUIRED',
                message: 'Tài khoản ủy quyền chưa được cấu hình đơn vị khoa/viện.',
            });
        }

        // Kiểm tra delegatee tồn tại và cùng đơn vị
        const delegatee = await prisma.user.findUnique({
            where: { id: targetDelegateeId },
            select: { id: true, department: true, isActive: true, fullName: true, code: true },
        });

        if (!delegatee || !delegatee.isActive) {
            return res.status(404).json({
                success: false,
                error: 'DELEGATEE_NOT_FOUND',
                message: 'Không tìm thấy người được ủy quyền hoặc tài khoản đã bị vô hiệu hóa.',
            });
        }

        if (delegatee.department !== req.user.department) {
            return res.status(403).json({
                success: false,
                error: 'DEPARTMENT_MISMATCH',
                message: 'Không thể ủy quyền cho nhân sự thuộc khoa/viện khác.',
            });
        }

        const delegationDepartment = req.user.department;

        const delegation = await prisma.$transaction(async (tx) => {
            const created = await tx.academicDelegation.create({
                data: {
                    delegatorId: req.user.id,
                    delegateeId: delegatee.id,
                    capabilityCode,
                    department: delegationDepartment,
                    semesterId: semesterId ? parseInt(semesterId, 10) : null,
                    effectiveFrom: fromDate,
                    effectiveTo: toDate,
                    reason: reason.trim(),
                    idempotencyKey: idempotencyKey.trim(),
                    status: 'ACTIVE',
                },
                include: {
                    delegator: { select: { id: true, fullName: true, code: true, email: true } },
                    delegatee: { select: { id: true, fullName: true, code: true, email: true, department: true } },
                    semester: { select: { id: true, name: true } },
                },
            });

            await tx.user.update({
                where: { id: delegatee.id },
                data: { permissionVersion: { increment: 1 } },
            });

            return created;
        });

        await auditLog(
            req.user.id,
            'CREATE_ACADEMIC_DELEGATION',
            'AcademicDelegation',
            delegation.id,
            {
                delegateeId: delegatee.id,
                capabilityCode,
                department: delegationDepartment,
                effectiveFrom: fromDate,
                effectiveTo: toDate,
                reason: reason.trim(),
            },
            req.ip
        );

        res.status(201).json({
            success: true,
            data: delegation,
            message: 'Ủy quyền chuyên môn thành công.',
        });
    } catch (error) {
        if (error.code === 'P2002' && (String(error.meta?.target).includes('idempotency') || String(error.message).includes('idempotency'))) {
            const idempotencyKey = req.headers['idempotency-key'];
            if (idempotencyKey) {
                const existing = await prisma.academicDelegation.findUnique({
                    where: { idempotencyKey: idempotencyKey.trim() },
                    include: {
                        delegator: { select: { id: true, fullName: true, code: true } },
                        delegatee: { select: { id: true, fullName: true, code: true, department: true } },
                    },
                });
                if (existing) {
                    return res.status(200).json({
                        success: true,
                        data: existing,
                        message: 'Yêu cầu ủy quyền đã được xử lý trước đó.',
                    });
                }
            }
        }
        next(error);
    }
};

/**
 * DELETE /api/delegations/:id hoặc POST /api/delegations/:id/revoke
 * Thu hồi ủy quyền chuyên môn học thuật
 * Yêu cầu PERMISSION_ASSIGN_ACADEMIC
 */
const revokeDelegation = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Mã ủy quyền không hợp lệ.',
            });
        }

        const delegation = await prisma.academicDelegation.findUnique({
            where: { id },
        });

        if (!delegation) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy bản ghi ủy quyền.',
            });
        }

        if (req.user.department && delegation.department !== req.user.department) {
            return res.status(403).json({
                success: false,
                error: 'DEPARTMENT_MISMATCH',
                message: 'Bạn không có quyền thu hồi ủy quyền của khoa/viện khác.',
            });
        }

        if (delegation.status === 'REVOKED') {
            return res.status(400).json({
                success: false,
                message: 'Ủy quyền này đã bị thu hồi trước đó.',
            });
        }

        const updated = await prisma.$transaction(async (tx) => {
            const rev = await tx.academicDelegation.update({
                where: { id },
                data: { status: 'REVOKED' },
            });

            await tx.user.update({
                where: { id: delegation.delegateeId },
                data: { permissionVersion: { increment: 1 } },
            });

            return rev;
        });

        await auditLog(
            req.user.id,
            'REVOKE_ACADEMIC_DELEGATION',
            'AcademicDelegation',
            delegation.id,
            {
                delegateeId: delegation.delegateeId,
                capabilityCode: delegation.capabilityCode,
                department: delegation.department,
            },
            req.ip
        );

        res.json({
            success: true,
            data: updated,
            message: 'Thu hồi ủy quyền thành công.',
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getDelegations,
    createDelegation,
    revokeDelegation,
};
