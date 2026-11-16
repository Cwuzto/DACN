const { normalizePermissionCode } = require('../auth/permissionCatalog');
const { getEffectivePermissions } = require('../auth/capabilityResolver');
const { resolveResourceScope } = require('../auth/resourceScopeResolver');

/**
 * Middleware phân quyền dựa trên capability và resource scope có thẩm quyền từ CSDL.
 *
 * @param {Object} options
 * @param {string|string[]} options.anyOf - Danh sách mã quyền (canonical hoặc alias) yêu cầu (ít nhất 1)
 * @param {string} [options.resourceType] - Loại tài nguyên ('TOPIC', 'REGISTRATION', 'COUNCIL', 'DELEGATION', 'SUBMISSION', 'ARCHIVE')
 * @param {Function} [options.idFromRequest] - Hàm trích xuất ID tài nguyên từ req: (req) => resourceId
 * @returns {Function} Express middleware
 */
const authorizeScopedPermission = ({
    anyOf,
    resourceType,
    idFromRequest,
} = {}) => {
    const rawCodes = Array.isArray(anyOf) ? anyOf : [anyOf];
    const requiredCaps = rawCodes
        .map((code) => normalizePermissionCode(code) || code)
        .filter(Boolean);

    if (requiredCaps.length === 0) {
        throw new Error('authorizeScopedPermission yêu cầu ít nhất một capability code hợp lệ.');
    }

    const middleware = async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'AUTHENTICATION_REQUIRED',
                    message: 'Chưa xác thực.',
                });
            }

            // Tập hợp tất cả các quyền user sở hữu (base permissions + delegated permissions)
            const allUserCaps = new Set([
                ...(req.user.basePermissions || []),
                ...(req.user.permissions || []),
            ]);

            const hasAnyGlobalCap = requiredCaps.some((cap) => allUserCaps.has(cap));
            if (!hasAnyGlobalCap) {
                return res.status(403).json({
                    success: false,
                    error: 'CAPABILITY_REQUIRED',
                    message: 'Bạn không có quyền thực hiện thao tác này.',
                });
            }

            // Trích xuất resourceId nếu có
            let resourceId = null;
            if (typeof idFromRequest === 'function') {
                resourceId = idFromRequest(req);
            } else if (req.params?.id) {
                resourceId = req.params.id;
            } else if (req.params?.resourceId) {
                resourceId = req.params.resourceId;
            } else if (req.body?.id) {
                resourceId = req.body.id;
            }

            if (resourceType && resourceId !== null && resourceId !== undefined) {
                const scope = await resolveResourceScope({
                    resourceType,
                    resourceId,
                });

                if (!scope) {
                    return res.status(404).json({
                        success: false,
                        error: 'RESOURCE_NOT_FOUND',
                        message: 'Không tìm thấy tài nguyên.',
                    });
                }

                req.resourceScope = scope;

                // Tính effective permissions theo scope tài nguyên có thẩm quyền từ DB
                const effectivePermissions = getEffectivePermissions(req.user, {
                    semesterId: scope.semesterId,
                    department: scope.department,
                });

                const hasScopedCap = requiredCaps.some((cap) => effectivePermissions.has(cap));

                if (!hasScopedCap) {
                    // Phân biệt nếu user có capability qua delegation nhưng lệch scope
                    const hasDelegatedCap = (req.user.activeDelegations || []).some((d) => {
                        const canonical = normalizePermissionCode(d.capabilityCode) || d.capabilityCode;
                        return requiredCaps.includes(canonical);
                    });

                    if (hasDelegatedCap) {
                        return res.status(403).json({
                            success: false,
                            error: 'DELEGATION_SCOPE_FORBIDDEN',
                            message: 'Phạm vi ủy quyền không bao gồm tài nguyên này.',
                        });
                    }

                    return res.status(403).json({
                        success: false,
                        error: 'RESOURCE_SCOPE_FORBIDDEN',
                        message: 'Bạn không có quyền thao tác trên tài nguyên này.',
                    });
                }
            } else if (resourceType === 'DELEGATION') {
                // Thao tác delegation không có resourceId cụ thể (ví dụ list hoặc create)
                if (!req.user.department) {
                    return res.status(403).json({
                        success: false,
                        error: 'DEPARTMENT_REQUIRED',
                        message: 'Tài khoản chưa được cấu hình đơn vị khoa/viện.',
                    });
                }
            }

            next();
        } catch (error) {
            next(error);
        }
    };

    middleware.authorizationPolicy = {
        mode: 'SCOPED_ANY',
        permissions: [...requiredCaps],
        resourceType,
    };

    return middleware;
};

module.exports = {
    authorizeScopedPermission,
};
