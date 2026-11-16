const EventEmitter = require('events');
const prismaDefault = require('../config/database');
const {
    ACADEMIC_PROTECTED_PERMISSIONS,
    TECHNICAL_PERMISSIONS,
} = require('../constants/permissions');
const { normalizePermissionCode } = require('../auth/permissionCatalog');
const { clearAuthCache } = require('../auth/capabilityResolver');

const permissionEventEmitter = new EventEmitter();

/**
 * Kiểm tra thẩm quyền chỉnh sửa ma trận quyền / nhóm quyền.
 * Admin kỹ thuật chỉ sửa quyền kỹ thuật, không tự ý sửa quyền học thuật.
 *
 * @param {Object} options
 * @param {Object} options.actor - User thực hiện thao tác
 * @param {string[]} [options.addedCodes] - Danh sách quyền thêm mới
 * @param {string[]} [options.removedCodes] - Danh sách quyền bị gỡ
 * @param {Array<Object|string>} [options.targetGroups] - Danh sách nhóm quyền bị tác động
 */
const assertPermissionMutationAuthority = ({
    actor,
    addedCodes = [],
    removedCodes = [],
    targetGroups = [],
} = {}) => {
    const rawDelta = [...new Set([...(addedCodes || []), ...(removedCodes || [])])];
    const delta = rawDelta
        .map((code) => normalizePermissionCode(code) || code)
        .filter(Boolean);

    const actorPermissions = actor?.permissions || [];
    const hasAcademicAuthority = actorPermissions.includes('PERMISSION_ASSIGN_ACADEMIC');
    const hasTechnicalAuthority = actorPermissions.includes('PERMISSION_GROUP_MANAGE');

    // Kiểm tra quyền học thuật được bảo vệ
    const protectedDelta = delta.filter((code) => ACADEMIC_PROTECTED_PERMISSIONS.includes(code));
    if (protectedDelta.length > 0 && !hasAcademicAuthority) {
        const error = new Error(`Quản trị viên kỹ thuật không được phép chỉnh sửa quyền học thuật/nghiệp vụ được bảo vệ: ${protectedDelta.join(', ')}.`);
        error.statusCode = 403;
        error.code = 'FORBIDDEN_ACADEMIC_PERMISSION_MODIFICATION';
        error.errorCode = 'PROTECTED_PERMISSION_MODIFICATION_FORBIDDEN';
        throw error;
    }

    // Kiểm tra quyền kỹ thuật
    const technicalDelta = delta.filter((code) => TECHNICAL_PERMISSIONS.includes(code));
    if (technicalDelta.length > 0 && !hasTechnicalAuthority) {
        const error = new Error('Không có quyền quản lý nhóm quyền kỹ thuật.');
        error.statusCode = 403;
        error.code = 'PROTECTED_PERMISSION_MODIFICATION_FORBIDDEN';
        error.errorCode = 'PROTECTED_PERMISSION_MODIFICATION_FORBIDDEN';
        throw error;
    }

    // Kiểm tra nhóm học thuật được bảo vệ
    if (Array.isArray(targetGroups) && targetGroups.length > 0) {
        const touchesAcademicGroup = targetGroups.some((group) => {
            const code = typeof group === 'string' ? group : group?.code;
            return ['VIEN_TRUONG', 'GVHD', 'GIAO_VU'].includes(code);
        });

        if (touchesAcademicGroup && !hasAcademicAuthority) {
            const error = new Error('Quản trị viên kỹ thuật không được phép thao tác trên nhóm quyền học thuật được bảo vệ.');
            error.statusCode = 403;
            error.code = 'FORBIDDEN_ACADEMIC_GROUP_ASSIGNMENT';
            error.errorCode = 'PROTECTED_PERMISSION_MODIFICATION_FORBIDDEN';
            throw error;
        }
    }
};

/**
 * Tăng permissionVersion của các user bị ảnh hưởng trong cùng transaction,
 * đồng thời xóa cache và phát sự kiện PERMISSIONS_UPDATED sau khi cập nhật.
 *
 * @param {Object} options
 * @param {number|number[]} options.userIds - Danh sách user ID bị ảnh hưởng
 * @param {Object} [options.actor] - User thực hiện
 * @param {string} [options.reason] - Lý do cập nhật
 * @param {Object} [options.tx] - Transaction client (hoặc prisma instance)
 * @returns {Promise<void>}
 */
const invalidatePermissions = async ({
    userIds,
    actor,
    reason,
    tx = prismaDefault,
} = {}) => {
    const rawIds = Array.isArray(userIds) ? userIds : [userIds];
    const uniqueUserIds = [...new Set(rawIds
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0))];

    if (uniqueUserIds.length === 0) {
        return;
    }

    // Tăng permissionVersion cho tất cả user bị ảnh hưởng trong transaction
    if (uniqueUserIds.length === 1 && tx.user?.update && !tx.user?.updateMany) {
        await tx.user.update({
            where: { id: uniqueUserIds[0] },
            data: { permissionVersion: { increment: 1 } },
        });
    } else if (tx.user?.updateMany) {
        await tx.user.updateMany({
            where: { id: { in: uniqueUserIds } },
            data: { permissionVersion: { increment: 1 } },
        });
    } else if (tx.user?.update) {
        for (const uid of uniqueUserIds) {
            await tx.user.update({
                where: { id: uid },
                data: { permissionVersion: { increment: 1 } },
            });
        }
    }

    // Xóa cache và broadcast sự kiện
    uniqueUserIds.forEach((uid) => {
        clearAuthCache(uid);
    });

    permissionEventEmitter.emit('PERMISSIONS_UPDATED', {
        type: 'PERMISSIONS_UPDATED',
        userIds: uniqueUserIds,
        actorId: actor?.id,
        reason,
    });
};

module.exports = {
    assertPermissionMutationAuthority,
    invalidatePermissions,
    permissionEventEmitter,
};
