const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { PERMISSION_CATALOG, DEFAULT_GROUPS } = require('../constants/permissions');

const studentBaseGroup = DEFAULT_GROUPS.find((group) => group.code === 'SYSTEM_STUDENT_BASE');
const studentBasePermissions = studentBaseGroup ? studentBaseGroup.permissions : [];

const knownPermissionCodes = new Set(PERMISSION_CATALOG.map(({ code }) => code));

const validatePermissionCodes = (permissionCodes) => {
    if (permissionCodes.length === 0) {
        throw new Error('Capability guard phải khai báo ít nhất một permission.');
    }
    const unknownCodes = permissionCodes.filter((code) => !knownPermissionCodes.has(code));
    if (unknownCodes.length > 0) {
        throw new Error(`Permission không tồn tại trong catalog: ${unknownCodes.join(', ')}.`);
    }
};

/**
 * Middleware xác thực JWT Token
 * Kiểm tra token trong header Authorization: Bearer <token>
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Không tìm thấy token xác thực. Vui lòng đăng nhập.',
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Tìm user trong DB để đảm bảo tài khoản vẫn tồn tại và active
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                fullName: true,
                code: true,
                role: true,
                department: true,
                isActive: true,
                permissionVersion: true,
                permissionGroups: {
                    include: {
                        permissionGroup: {
                            include: { permissions: { include: { permission: true } } },
                        },
                    },
                },
                councilMembers: {
                    where: { council: { councilType: 'DEFENSE_COUNCIL' } },
                    select: { id: true },
                },
            },
        });

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hoá.',
            });
        }

        const isGetMe = req.method === 'GET' && Boolean((req.originalUrl && req.originalUrl.includes('/api/auth/me')) || req.path === '/me');
        const tokenVersion = decoded.permissionVersion;
        const userVersion = user.permissionVersion;

        if (
            !isGetMe &&
            typeof tokenVersion === 'number' &&
            typeof userVersion === 'number' &&
            tokenVersion < userVersion
        ) {
            return res.status(409).json({
                success: false,
                error: 'PERMISSION_VERSION_STALE',
                message: 'Phiên bản quyền đã được cập nhật.',
            });
        }

        const now = new Date();
            let activeDelegations = [];
        if (prisma.academicDelegation?.findMany) {
            activeDelegations = await prisma.academicDelegation.findMany({
                where: {
                    delegateeId: user.id,
                    status: 'ACTIVE',
                    effectiveFrom: { lte: now },
                    effectiveTo: { gte: now },
                },
                select: { capabilityCode: true },
            });
        }

        const permissionSet = new Set();
        (user.permissionGroups || []).forEach(({ permissionGroup }) => {
            (permissionGroup?.permissions || []).forEach(({ permission }) => {
                if (permission?.code) permissionSet.add(permission.code);
            });
        });
        (activeDelegations || []).forEach(({ capabilityCode }) => {
            if (capabilityCode) permissionSet.add(capabilityCode);
        });
        if (user.role === 'STUDENT' && permissionSet.size === 0) {
            studentBasePermissions.forEach((code) => permissionSet.add(code));
        } else if (user.permissionGroups === undefined && permissionSet.size === 0) {
            const defaultGroupCode = user.role === 'LECTURER' ? 'GVHD'
                : user.role === 'ADMIN' ? 'QUAN_TRI_VIEN'
                : null;
            if (defaultGroupCode) {
                const group = DEFAULT_GROUPS.find((g) => g.code === defaultGroupCode);
                if (group) {
                    group.permissions.forEach((code) => permissionSet.add(code));
                }
            }
        }
        req.user = {
            ...user,
            permissionVersion: user.permissionVersion,
            permissionGroups: (user.permissionGroups || [])
                .map(({ permissionGroup }) => permissionGroup?.code)
                .filter(Boolean),
            permissions: [...permissionSet],
            hasDefenseCouncilAssignment: Boolean(user.councilMembers?.length),
        };
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token đã hết hạn. Vui lòng đăng nhập lại.',
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Token không hợp lệ.',
        });
    }
};

/**
 * Middleware phân quyền - kiểm tra xem user có đúng role được phép không
 * Sử dụng: authorize('ADMIN', 'LECTURER')
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Chưa xác thực.',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền truy cập chức năng này.',
            });
        }

        next();
    };
};

const authorizePermission = (...permissionCodes) => {
    validatePermissionCodes(permissionCodes);
    const middleware = (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
        }
        const permissions = req.user.permissions || [];
        if (!permissionCodes.some((code) => permissions.includes(code))) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
        }
        next();
    };
    middleware.authorizationPolicy = { mode: 'ANY', permissions: [...permissionCodes] };
    return middleware;
};

const authorizeAllPermissions = (...permissionCodes) => {
    validatePermissionCodes(permissionCodes);
    const middleware = (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
        }
        const permissions = req.user.permissions || [];
        if (!permissionCodes.every((code) => permissions.includes(code))) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
        }
        next();
    };
    middleware.authorizationPolicy = { mode: 'ALL', permissions: [...permissionCodes] };
    return middleware;
};

const assertPermission = (user, permissionCode) => {
    validatePermissionCodes([permissionCode]);
    if (!user) {
        const error = new Error('Chưa xác thực.');
        error.statusCode = 401;
        throw error;
    }
    if (!(user.permissions || []).includes(permissionCode)) {
        const error = new Error('Bạn không có quyền thực hiện thao tác này.');
        error.statusCode = 403;
        throw error;
    }
};

const authorizeResolvedPermissions = (candidatePermissionCodes, resolvePermissionCodes) => {
    validatePermissionCodes(candidatePermissionCodes);
    const candidateSet = new Set(candidatePermissionCodes);
    const middleware = async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
            }

            const resolved = await resolvePermissionCodes(req);
            const requiredPermissionCodes = Array.isArray(resolved) ? resolved : [resolved];
            if (
                requiredPermissionCodes.length === 0
                || requiredPermissionCodes.some((code) => !candidateSet.has(code))
            ) {
                throw new Error('Capability resolver trả về permission không hợp lệ.');
            }

            requiredPermissionCodes.forEach((code) => assertPermission(req.user, code));
            next();
        } catch (error) {
            if (error.statusCode) {
                return res.status(error.statusCode).json({ success: false, message: error.message });
            }
            next(error);
        }
    };
    middleware.authorizationPolicy = {
        mode: 'RESOLVED_ALL',
        permissions: [...candidatePermissionCodes],
    };
    return middleware;
};

const optionalAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                fullName: true,
                code: true,
                role: true,
                department: true,
                isActive: true,
                permissionVersion: true,
                permissionGroups: {
                    include: {
                        permissionGroup: {
                            include: { permissions: { include: { permission: true } } },
                        },
                    },
                },
            },
        });
        if (user && user.isActive) {
            const now = new Date();
            let activeDelegations = [];
        if (prisma.academicDelegation?.findMany) {
            activeDelegations = await prisma.academicDelegation.findMany({
                where: {
                    delegateeId: user.id,
                    status: 'ACTIVE',
                    effectiveFrom: { lte: now },
                    effectiveTo: { gte: now },
                },
                select: { capabilityCode: true },
            });
        }

        const permissionSet = new Set();
            (user.permissionGroups || []).forEach(({ permissionGroup }) => {
                (permissionGroup?.permissions || []).forEach(({ permission }) => {
                    if (permission?.code) permissionSet.add(permission.code);
                });
            });
            (activeDelegations || []).forEach(({ capabilityCode }) => {
            if (capabilityCode) permissionSet.add(capabilityCode);
        });
        if (user.role === 'STUDENT' && permissionSet.size === 0) {
            studentBasePermissions.forEach((code) => permissionSet.add(code));
        } else if (user.permissionGroups === undefined && permissionSet.size === 0) {
            const defaultGroupCode = user.role === 'LECTURER' ? 'GVHD'
                : user.role === 'ADMIN' ? 'QUAN_TRI_VIEN'
                : null;
            if (defaultGroupCode) {
                const group = DEFAULT_GROUPS.find((g) => g.code === defaultGroupCode);
                if (group) {
                    group.permissions.forEach((code) => permissionSet.add(code));
                }
            }
        }
        req.user = {
                ...user,
                permissionGroups: user.permissionGroups.map(({ permissionGroup }) => permissionGroup.code),
                permissions: [...permissionSet],
            };
        }
        next();
    } catch {
        next();
    }
};

const authorizeRoleOrPermission = (roles = [], permissionCodes = []) => {
    if (permissionCodes.length > 0) validatePermissionCodes(permissionCodes);
    const middleware = (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
        }
        if (roles.includes(req.user.role)) {
            return next();
        }
        const permissions = req.user.permissions || [];
        if (permissionCodes.some((code) => permissions.includes(code))) {
            return next();
        }
        return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
    };
    middleware.authorizationPolicy = {
        mode: 'ROLE_OR_ANY',
        roles: [...roles],
        permissions: [...permissionCodes],
    };
    return middleware;
};

module.exports = {
    authenticate,
    optionalAuthenticate,
    authorize,
    authorizePermission,
    authorizeAllPermissions,
    assertPermission,
    authorizeResolvedPermissions,
    authorizeRoleOrPermission,
};

