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
 * In-memory capability cache and single-flight lookup map
 */
const userAuthCache = new Map();
const inFlightUserLookups = new Map();
let cacheHits = 0;
let cacheMisses = 0;

const getAuthCacheTtl = () => {
    const val = Number(process.env.AUTH_CACHE_TTL_MS);
    return Number.isFinite(val) && val > 0 ? val : 15000;
};

const clearAuthCache = (userId) => {
    if (userId !== undefined && userId !== null) {
        const id = Number(userId);
        userAuthCache.delete(id);
        inFlightUserLookups.delete(id);
        userAuthCache.delete(userId);
        inFlightUserLookups.delete(userId);
    } else {
        userAuthCache.clear();
        inFlightUserLookups.clear();
    }
};

const getAuthCacheStats = () => ({
    size: userAuthCache.size,
    hits: cacheHits,
    misses: cacheMisses,
});

if (process.env.NODE_ENV === 'test' && typeof afterEach === 'function') {
    afterEach(() => {
        clearAuthCache();
    });
}

const fetchUserAndCapabilities = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            fullName: true,
            code: true,
            role: true,
            department: true,
            phone: true,
            avatarUrl: true,
            isActive: true,
            permissionVersion: true,
            studentProfile: {
                select: {
                    studentId: true,
                    gender: true,
                    dateOfBirth: true,
                    className: true,
                    major: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
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
        return null;
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
    } else if (user.role === 'LECTURER' && permissionSet.size === 0) {
        const gvhdGroup = DEFAULT_GROUPS.find((group) => group.code === 'GVHD');
        if (gvhdGroup) {
            gvhdGroup.permissions.forEach((code) => permissionSet.add(code));
        }
    }

    const resolvedUser = {
        ...user,
        permissionVersion: user.permissionVersion,
        permissionGroups: (user.permissionGroups || [])
            .map(({ permissionGroup }) => permissionGroup?.code)
            .filter(Boolean),
        permissions: [...permissionSet],
        hasDefenseCouncilAssignment: Boolean(user.councilMembers?.length),
    };

    userAuthCache.set(userId, {
        user: resolvedUser,
        data: resolvedUser,
        cachedAt: Date.now(),
        permissionVersion: resolvedUser.permissionVersion,
    });

    return resolvedUser;
};

const getUserLookedUp = async (userId) => {
    let inFlight = inFlightUserLookups.get(userId);
    if (!inFlight) {
        inFlight = fetchUserAndCapabilities(userId).finally(() => {
            inFlightUserLookups.delete(userId);
        });
        inFlightUserLookups.set(userId, inFlight);
    }
    return inFlight;
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
        const userId = decoded.userId;

        const isGetMe = req.method === 'GET' && Boolean((req.originalUrl && req.originalUrl.includes('/api/auth/me')) || req.path === '/me');
        const tokenVersion = decoded.permissionVersion;
        const nowMs = Date.now();
        const ttl = getAuthCacheTtl();

        const cachedEntry = userAuthCache.get(userId);
        if (cachedEntry && (nowMs - cachedEntry.cachedAt < ttl)) {
            if (
                typeof tokenVersion === 'number' &&
                typeof cachedEntry.permissionVersion === 'number' &&
                tokenVersion > cachedEntry.permissionVersion
            ) {
                // Token has newer version than cached DB user -> evict from cache and fall through to fresh DB query
                userAuthCache.delete(userId);
            } else {
                cacheHits++;
                if (
                    !isGetMe &&
                    typeof tokenVersion === 'number' &&
                    typeof cachedEntry.permissionVersion === 'number' &&
                    tokenVersion < cachedEntry.permissionVersion
                ) {
                    return res.status(409).json({
                        success: false,
                        error: 'PERMISSION_VERSION_STALE',
                        message: 'Phiên bản quyền đã được cập nhật.',
                    });
                }
                req.user = {
                    ...cachedEntry.user,
                    permissions: [...(cachedEntry.user.permissions || [])],
                    permissionGroups: [...(cachedEntry.user.permissionGroups || [])],
                };
                return next();
            }
        }

        cacheMisses++;
        const resolvedUser = await getUserLookedUp(userId);

        if (!resolvedUser) {
            return res.status(401).json({
                success: false,
                message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hoá.',
            });
        }

        const userVersion = resolvedUser.permissionVersion;

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

        req.user = {
            ...resolvedUser,
            permissions: [...(resolvedUser.permissions || [])],
            permissionGroups: [...(resolvedUser.permissionGroups || [])],
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
        } else if (user.role === 'LECTURER' && permissionSet.size === 0) {
            const gvhdGroup = DEFAULT_GROUPS.find((group) => group.code === 'GVHD');
            if (gvhdGroup) {
                gvhdGroup.permissions.forEach((code) => permissionSet.add(code));
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
    clearAuthCache,
    getAuthCacheStats,
};

