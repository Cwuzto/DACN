const prismaDefault = require('../config/database');
const { normalizePermissionCode } = require('./permissionCatalog');

const GLOBAL_REPORT_GROUP_CODES = new Set([
    'QUAN_TRI_VIEN',
    'GIAO_VU',
    'VIEN_TRUONG',
]);

const normalizeDepartment = (dept) => {
    if (typeof dept !== 'string') return '';
    return dept.trim();
};

const hasPermissionCode = (list, targetCode) => {
    if (!Array.isArray(list)) return false;
    return list.some((code) => (normalizePermissionCode(code) || code) === targetCode);
};

/**
 * Phân giải phạm vi đọc báo cáo (REPORT_VIEW) hiệu lực cho actor.
 * Trả về { global: boolean, departments: string[] } hoặc null nếu thiếu scope hợp lệ (fail-closed).
 *
 * @param {Object} options
 * @param {Object} options.actor - req.user đã được resolve từ capabilityResolver
 * @param {Object} [options.db] - Prisma client instance
 * @returns {Promise<{ global: boolean, departments: string[] } | null>}
 */
const resolveReportReadScope = async ({ actor, db = prismaDefault } = {}) => {
    if (!actor) return null;

    const now = new Date();
    const hasBaseReportView = hasPermissionCode(actor.basePermissions, 'REPORT_VIEW');
    const hasPermissionsReportView = hasPermissionCode(actor.permissions, 'REPORT_VIEW');

    let activeDelegations = Array.isArray(actor.activeDelegations)
        ? actor.activeDelegations
        : null;

    if (activeDelegations === null && actor.id && db?.academicDelegation?.findMany) {
        activeDelegations = await db.academicDelegation.findMany({
            where: {
                delegateeId: actor.id,
                status: 'ACTIVE',
                effectiveFrom: { lte: now },
                effectiveTo: { gte: now },
            },
            select: {
                id: true,
                capabilityCode: true,
                department: true,
                semesterId: true,
                effectiveFrom: true,
                effectiveTo: true,
            },
        });
    }

    const reportDelegations = (activeDelegations || []).filter((d) => {
        const canonical = normalizePermissionCode(d?.capabilityCode) || d?.capabilityCode;
        if (canonical !== 'REPORT_VIEW') return false;
        if (d.status && d.status !== 'ACTIVE') return false;
        if (d.effectiveFrom && new Date(d.effectiveFrom) > now) return false;
        if (d.effectiveTo && new Date(d.effectiveTo) < now) return false;
        return true;
    });

    if (!hasBaseReportView && !hasPermissionsReportView && reportDelegations.length === 0) {
        return null;
    }

    let global = false;
    const departmentSet = new Set();

    if (hasBaseReportView) {
        const groupCodes = Array.isArray(actor.permissionGroups) ? actor.permissionGroups : [];
        const hasGlobalGroup = groupCodes.some((code) => GLOBAL_REPORT_GROUP_CODES.has(code));
        if (hasGlobalGroup) {
            global = true;
        } else {
            const actorDept = normalizeDepartment(actor.department);
            if (actorDept) {
                departmentSet.add(actorDept);
            }
        }
    }

    for (const delegation of reportDelegations) {
        const dept = normalizeDepartment(delegation.department);
        if (dept) {
            departmentSet.add(dept);
        }
    }

    if (global) {
        return {
            global: true,
            departments: Array.from(departmentSet),
        };
    }

    if (departmentSet.size > 0) {
        return {
            global: false,
            departments: Array.from(departmentSet),
        };
    }

    return null;
};

const buildTopicDepartmentWhere = (departments = []) => ({
    OR: [
        { mentor: { department: { in: departments } } },
        { proposedBy: { department: { in: departments } } },
    ],
});

const buildRegistrationDepartmentWhere = (departments = []) => ({
    OR: [
        { topic: { mentor: { department: { in: departments } } } },
        { topic: { proposedBy: { department: { in: departments } } } },
        { student: { department: { in: departments } } },
    ],
});

const matchesReportDepartment = (reg, departments = []) => {
    if (!Array.isArray(departments) || departments.length === 0) return false;
    const allowed = new Set(departments.map((d) => normalizeDepartment(d).toUpperCase()).filter(Boolean));
    const regDept = normalizeDepartment(
        reg?.topic?.mentor?.department || reg?.topic?.proposedBy?.department || reg?.student?.department
    ).toUpperCase();
    return Boolean(regDept && allowed.has(regDept));
};

module.exports = {
    resolveReportReadScope,
    GLOBAL_REPORT_GROUP_CODES,
    buildTopicDepartmentWhere,
    buildRegistrationDepartmentWhere,
    matchesReportDepartment,
};

