const {
    PERMISSION_CATALOG,
    PERMISSIONS,
    DEFAULT_GROUPS,
    STUDENT_BASE_PERMISSIONS,
    CANONICAL_ALIAS_MAP,
    TECHNICAL_PERMISSIONS,
    ACADEMIC_PROTECTED_PERMISSIONS,
    grantablePermissionCodes,
    GRANTABLE_PERMISSION_CODES,
} = require('../constants/permissions');

/**
 * @typedef {Object} PermissionDefinition
 * @property {string} code
 * @property {string} label
 * @property {string} module
 * @property {'VIEW' | 'ACTION'} kind
 * @property {'TECHNICAL' | 'ACADEMIC' | 'STUDENT_BASE'} protectedDomain
 * @property {Array<'ADMIN' | 'LECTURER' | 'STUDENT'>} eligibleRoles
 * @property {Array<'GLOBAL' | 'DEPARTMENT' | 'SEMESTER' | 'RESOURCE'>} scopeTypes
 */

/**
 * Danh sách canonical definitions (chỉ bao gồm các mã quyền canonical, không chứa alias)
 * @type {ReadonlyArray<PermissionDefinition>}
 */
const PERMISSION_DEFINITIONS = Object.freeze(
    PERMISSION_CATALOG
        .filter((item) => !CANONICAL_ALIAS_MAP[item.code])
        .map((item) => Object.freeze({ ...item }))
);

const DEFINITIONS_BY_CODE = new Map(
    PERMISSION_DEFINITIONS.map((def) => [def.code, def])
);

/**
 * Kiểm tra xem mã quyền có phải là mã canonical không (không phải alias, không phải chuỗi lạ)
 * @param {string} code
 * @returns {boolean}
 */
const isCanonicalPermissionCode = (code) => {
    if (!code || typeof code !== 'string') return false;
    return DEFINITIONS_BY_CODE.has(code);
};

/**
 * Chuẩn hóa mã quyền về canonical code.
 * Nếu đã là canonical -> trả về chính nó.
 * Nếu là alias -> trả về mã canonical tương ứng.
 * Nếu không thuộc catalog -> trả về null.
 * @param {string} code
 * @returns {string | null}
 */
const normalizePermissionCode = (code) => {
    if (!code || typeof code !== 'string') return null;
    if (DEFINITIONS_BY_CODE.has(code)) {
        return code;
    }
    const aliasTarget = CANONICAL_ALIAS_MAP[code];
    if (aliasTarget && DEFINITIONS_BY_CODE.has(aliasTarget)) {
        return aliasTarget;
    }
    return null;
};

/**
 * Lấy metadata definition của quyền (hỗ trợ cả canonical code lẫn alias)
 * @param {string} code
 * @returns {PermissionDefinition | undefined}
 */
const getPermissionDefinition = (code) => {
    const canonical = normalizePermissionCode(code);
    if (!canonical) return undefined;
    return DEFINITIONS_BY_CODE.get(canonical);
};

module.exports = {
    PERMISSION_DEFINITIONS,
    normalizePermissionCode,
    isCanonicalPermissionCode,
    getPermissionDefinition,

    // Re-exports for migration compatibility
    PERMISSIONS,
    DEFAULT_GROUPS,
    STUDENT_BASE_PERMISSIONS,
    CANONICAL_ALIAS_MAP,
    TECHNICAL_PERMISSIONS,
    ACADEMIC_PROTECTED_PERMISSIONS,
    grantablePermissionCodes,
    GRANTABLE_PERMISSION_CODES,
    PERMISSION_CATALOG,
};

