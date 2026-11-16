const prismaDefault = require('../config/database');
const {
    normalizePermissionCode,
} = require('./permissionCatalog');
const {
    STUDENT_BASE_PERMISSIONS,
    DEFAULT_GROUPS,
} = require('../constants/permissions');

const studentBaseGroup = DEFAULT_GROUPS.find((group) => group.code === 'SYSTEM_STUDENT_BASE');
const studentBasePermissions = (studentBaseGroup ? studentBaseGroup.permissions : STUDENT_BASE_PERMISSIONS)
    .map((code) => normalizePermissionCode(code) || code);

const gvhdGroup = DEFAULT_GROUPS.find((group) => group.code === 'GVHD');
const gvhdPermissions = (gvhdGroup ? gvhdGroup.permissions : [])
    .map((code) => normalizePermissionCode(code) || code);

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
        for (const key of userAuthCache.keys()) {
            if (typeof key === 'string' && (key.startsWith(`${id}:`) || key.startsWith(`${userId}:`))) {
                userAuthCache.delete(key);
            }
        }
        for (const key of inFlightUserLookups.keys()) {
            if (typeof key === 'string' && (key.startsWith(`${id}:`) || key.startsWith(`${userId}:`))) {
                inFlightUserLookups.delete(key);
            }
        }
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

/**
 * Phân giải toàn bộ identity và capabilities có thẩm quyền của một user.
 * @param {Object} options
 * @param {number|string} options.userId - ID của user
 * @param {Date} [options.at] - Thời điểm đánh giá delegation (mặc định now)
 * @param {Object} [options.db] - Prisma client instance
 * @param {boolean} [options.bypassCache] - Không dùng cache nếu true
 * @returns {Promise<Object|null>} ResolvedIdentity hoặc null
 */
const resolveUserCapabilities = async ({
    userId,
    at = new Date(),
    db = prismaDefault,
    bypassCache = false,
} = {}) => {
    if (userId === undefined || userId === null) {
        return null;
    }
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
        return null;
    }

    const ttl = getAuthCacheTtl();
    const nowMs = Date.now();

    if (!bypassCache) {
        const cached = userAuthCache.get(numericUserId);
        if (cached && nowMs - cached.cachedAt < ttl) {
            cacheHits++;
            return {
                ...cached.user,
                basePermissions: [...(cached.user.basePermissions || [])],
                permissions: [...(cached.user.permissions || [])],
                permissionGroups: [...(cached.user.permissionGroups || [])],
                activeDelegations: [...(cached.user.activeDelegations || [])],
            };
        }

        const existingFlight = inFlightUserLookups.get(numericUserId);
        if (existingFlight) {
            return existingFlight;
        }
    }

    cacheMisses++;

    const lookupPromise = (async () => {
        const user = await db.user.findUnique({
            where: { id: numericUserId },
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
                            include: {
                                permissions: {
                                    include: { permission: true },
                                },
                            },
                        },
                    },
                },
                councilMembers: {
                    select: {
                        id: true,
                        council: {
                            select: { councilType: true },
                        },
                    },
                },
            },
        });

        if (!user || !user.isActive) {
            return null;
        }

        let activeDelegations = [];
        if (db.academicDelegation?.findMany) {
            activeDelegations = await db.academicDelegation.findMany({
                where: {
                    delegateeId: user.id,
                    status: 'ACTIVE',
                    effectiveFrom: { lte: at },
                    effectiveTo: { gte: at },
                },
                select: {
                    id: true,
                    capabilityCode: true,
                    department: true,
                    semesterId: true,
                    effectiveFrom: true,
                    effectiveTo: true,
                    delegatorId: true,
                },
            });
        }

        const basePermissionSet = new Set();
        (user.permissionGroups || []).forEach(({ permissionGroup }) => {
            (permissionGroup?.permissions || []).forEach(({ permission, code }) => {
                const rawCode = permission?.code || code;
                const canonical = normalizePermissionCode(rawCode);
                if (canonical) {
                    basePermissionSet.add(canonical);
                }
            });
        });

        if (user.role === 'STUDENT' && basePermissionSet.size === 0) {
            studentBasePermissions.forEach((code) => {
                const canonical = normalizePermissionCode(code);
                if (canonical) basePermissionSet.add(canonical);
            });
        } else if (user.role === 'LECTURER' && basePermissionSet.size === 0) {
            gvhdPermissions.forEach((code) => {
                const canonical = normalizePermissionCode(code);
                if (canonical) basePermissionSet.add(canonical);
            });
        }

        const compatibilityPermissionSet = new Set(basePermissionSet);
        (activeDelegations || []).forEach(({ capabilityCode }) => {
            const canonical = normalizePermissionCode(capabilityCode);
            if (canonical) compatibilityPermissionSet.add(canonical);
        });

        const permissionGroups = (user.permissionGroups || [])
            .map(({ permissionGroup }) => permissionGroup?.code)
            .filter(Boolean);

        const hasDefenseCouncilAssignment = (user.councilMembers || []).some(
            (m) => m.council?.councilType === 'DEFENSE_COUNCIL'
        );
        const hasOutlineCouncilAssignment = (user.councilMembers || []).some(
            (m) => m.council?.councilType === 'OUTLINE_REVIEW'
        );

        const resolvedUser = {
            ...user,
            permissionVersion: typeof user.permissionVersion === 'number' ? user.permissionVersion : undefined,
            permissionGroups,
            basePermissions: [...basePermissionSet],
            permissions: [...compatibilityPermissionSet],
            activeDelegations: activeDelegations || [],
            hasDefenseCouncilAssignment,
            hasOutlineCouncilAssignment,
        };

        if (!bypassCache) {
            userAuthCache.set(numericUserId, {
                user: resolvedUser,
                permissionVersion: resolvedUser.permissionVersion,
                cachedAt: Date.now(),
            });
        }

        return resolvedUser;
    })();

    if (!bypassCache) {
        inFlightUserLookups.set(numericUserId, lookupPromise);
        lookupPromise.finally(() => {
            inFlightUserLookups.delete(numericUserId);
        });
    }

    return lookupPromise;
};

/**
 * Tính tập permission có hiệu lực (effective) theo scope tài nguyên / yêu cầu.
 * @param {Object} identity - ResolvedIdentity từ resolveUserCapabilities
 * @param {Object} [scope]
 * @param {number|null} [scope.semesterId]
 * @param {string|null} [scope.department]
 * @returns {Set<string>} Tập mã quyền canonical có hiệu lực
 */
const getEffectivePermissions = (identity, { semesterId, department } = {}) => {
    const effective = new Set(identity?.basePermissions || []);

    if (identity?.activeDelegations && Array.isArray(identity.activeDelegations)) {
        for (const delegation of identity.activeDelegations) {
            // Kiểm tra semesterId
            if (delegation.semesterId !== null && delegation.semesterId !== undefined) {
                if (
                    semesterId === undefined ||
                    semesterId === null ||
                    Number(delegation.semesterId) !== Number(semesterId)
                ) {
                    continue;
                }
            }

            // Kiểm tra department
            if (delegation.department !== null && delegation.department !== undefined && delegation.department !== '') {
                if (
                    department === undefined ||
                    department === null ||
                    String(delegation.department).trim().toUpperCase() !== String(department).trim().toUpperCase()
                ) {
                    continue;
                }
            }

            const canonical = normalizePermissionCode(delegation.capabilityCode);
            if (canonical) {
                effective.add(canonical);
            }
        }
    }

    return effective;
};

module.exports = {
    resolveUserCapabilities,
    getEffectivePermissions,
    clearAuthCache,
    getAuthCacheStats,
    getAuthCacheTtl,
    userAuthCache,
    inFlightUserLookups,
};
