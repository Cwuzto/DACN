/**
 * Policy Evaluator
 * Bộ đánh giá quyền hạn tập trung cho frontend DACN.
 * Đọc từ FEATURE_POLICIES, loại bỏ hoàn toàn bypass theo Role và synthetic permission injection.
 */

import { FEATURE_POLICIES, FEATURE_POLICY_LIST, NAVIGATION_GROUPS } from './featurePolicies.js';

/**
 * Trích xuất tập quyền hiệu lực có tính đến phạm vi ủy quyền (Scoped Delegation).
 *
 * @param {object|Array<string>|Set<string>} userOrPermissions
 * @param {object} [context={}] - Ngữ cảnh lọc UI ({ semesterId, department })
 * @returns {Set<string>}
 */
export function getEffectivePermissions(userOrPermissions, context = {}) {
    if (!userOrPermissions) return new Set();

    let allPermissions = new Set();
    let basePermissions = null;
    let delegations = [];

    if (Array.isArray(userOrPermissions)) {
        allPermissions = new Set(userOrPermissions);
    } else if (userOrPermissions instanceof Set) {
        allPermissions = new Set(userOrPermissions);
    } else if (typeof userOrPermissions === 'object') {
        if (Array.isArray(userOrPermissions.permissions)) {
            allPermissions = new Set(userOrPermissions.permissions);
        } else if (userOrPermissions.permissions instanceof Set) {
            allPermissions = new Set(userOrPermissions.permissions);
        }
        if (Array.isArray(userOrPermissions.basePermissions)) {
            basePermissions = new Set(userOrPermissions.basePermissions);
        }
        if (Array.isArray(userOrPermissions.activeDelegations)) {
            delegations = userOrPermissions.activeDelegations;
        }
    }

    if (!delegations.length) {
        return allPermissions;
    }

    const activeDelegationCodes = new Set();
    const inactiveDelegationCodes = new Set();

    for (const d of delegations) {
        const isSemesterMismatch = Boolean(d.semesterId && context.semesterId && d.semesterId !== context.semesterId);
        const isDeptMismatch = Boolean(d.department && context.department && d.department !== context.department);
        const isExpired = Boolean(d.expiresAt && new Date(d.expiresAt) <= new Date());
        const isRevoked = Boolean(d.status && d.status !== 'ACTIVE');

        if (isSemesterMismatch || isDeptMismatch || isExpired || isRevoked) {
            inactiveDelegationCodes.add(d.capabilityCode);
        } else {
            activeDelegationCodes.add(d.capabilityCode);
        }
    }

    if (basePermissions) {
        const effective = new Set(basePermissions);
        for (const code of activeDelegationCodes) {
            effective.add(code);
        }
        return effective;
    }

    const effective = new Set();
    for (const perm of allPermissions) {
        if (!inactiveDelegationCodes.has(perm) || activeDelegationCodes.has(perm)) {
            effective.add(perm);
        }
    }
    return effective;
}

/**
 * Kiểm tra điều kiện phân công (Hội đồng đề cương / Hội đồng bảo vệ).
 * Tuyệt đối không bypass theo role === 'ADMIN'.
 */
function checkAssignment(assignment, user, permSet, context = {}) {
    if (!assignment) return true;

    if (typeof assignment === 'function') {
        return assignment(user, context, permSet);
    }

    const type = typeof assignment === 'string' ? assignment : assignment.type;

    if (type === 'defenseCouncil' || assignment.requiresDefenseCouncil) {
        return Boolean(
            user?.hasDefenseCouncilAssignment ||
            context?.hasDefenseCouncilAssignment ||
            permSet.has('DEFENSE_COUNCIL_MANAGE') ||
            permSet.has('VIEW_COUNCIL_ASSIGNMENTS') ||
            permSet.has('VIEW_DEFENSE_ASSIGNMENTS')
        );
    }

    if (type === 'outlineCouncil' || assignment.requiresOutlineCouncil) {
        return Boolean(
            user?.hasOutlineCouncilAssignment ||
            context?.hasOutlineCouncilAssignment ||
            permSet.has('OUTLINE_COUNCIL_MANAGE') ||
            permSet.has('VIEW_COUNCIL_ASSIGNMENTS')
        );
    }

    return true;
}

/**
 * Kiểm tra quyền xem một tính năng (Feature).
 *
 * @param {object} user - User object hoặc context
 * @param {string} featureKey - Khóa tính năng trong FEATURE_POLICIES
 * @param {object} [context={}] - Ngữ cảnh lọc UI ({ semesterId, department })
 * @returns {boolean}
 */
export function canViewFeature(user, featureKey, context = {}) {
    if (!user) return false;

    const policy = FEATURE_POLICIES[featureKey];
    if (!policy) return false;

    // Phân tách không gian làm việc giữa Sinh viên và Giảng viên / Quản trị viên
    const role = user.role;
    if (role === 'STUDENT' && policy.workspace !== 'student') {
        return false;
    }
    if (role && role !== 'STUDENT' && policy.workspace === 'student') {
        return false;
    }
    if (role === 'ADMIN' && policy.workspace === 'lecturer') {
        return false;
    }

    // Role dashboards
    if (policy.key === 'admin-dashboard') {
        return role === 'ADMIN';
    }
    if (policy.key === 'lecturer-dashboard') {
        return role === 'LECTURER';
    }
    if (policy.key === 'student-dashboard') {
        return role === 'STUDENT';
    }

    const permSet = getEffectivePermissions(user, context);

    // Kiểm tra điều kiện gán vai trò / hội đồng
    if (!checkAssignment(policy.assignment, user, permSet, context)) {
        return false;
    }

    // Kiểm tra viewAnyOf
    if (Array.isArray(policy.viewAnyOf) && policy.viewAnyOf.length > 0) {
        const hasAny = policy.viewAnyOf.some((p) => permSet.has(p));
        if (!hasAny) return false;
    }

    // Kiểm tra viewAllOf
    if (Array.isArray(policy.viewAllOf) && policy.viewAllOf.length > 0) {
        const hasAll = policy.viewAllOf.every((p) => permSet.has(p));
        if (!hasAll) return false;
    }

    return true;
}

/**
 * Kiểm tra quyền thực hiện một hành động (Action) trong tính năng.
 *
 * @param {object} user - User object hoặc context
 * @param {string} featureKey - Khóa tính năng
 * @param {string} actionKey - Khóa hành động (ví dụ: 'create', 'edit', 'delete', 'import')
 * @param {object} [context={}] - Ngữ cảnh lọc UI ({ semesterId, department })
 * @returns {boolean}
 */
export function canPerformFeatureAction(user, featureKey, actionKey, context = {}) {
    if (!user) return false;

    const policy = FEATURE_POLICIES[featureKey];
    if (!policy) return false;

    // Phải có quyền xem feature trước
    if (!canViewFeature(user, featureKey, context)) {
        return false;
    }

    const requiredActionPerm = policy.actions?.[actionKey];
    if (!requiredActionPerm) {
        return false;
    }

    const permSet = getEffectivePermissions(user, context);

    if (typeof requiredActionPerm === 'function') {
        return requiredActionPerm(user, context, permSet);
    }

    if (Array.isArray(requiredActionPerm)) {
        return requiredActionPerm.some((p) => permSet.has(p));
    }

    if (typeof requiredActionPerm === 'string') {
        return permSet.has(requiredActionPerm);
    }

    return false;
}

/**
 * Lấy danh sách menu điều hướng khả dụng dựa trên FEATURE_POLICIES.
 * Thay thế logic cũ trong navigationRegistry, loại bỏ inject quyền ảo cho GIAO_VU và bypass Admin.
 *
 * @param {Array<string>|Set<string>|object} permissionsInput
 * @param {object} [context={}]
 * @returns {Array<{ group: string, title: string, items: Array<object> }>}
 */
export function getVisibleNavigation(permissionsInput, context = {}) {
    if (!permissionsInput) return [];

    let userObject = {};
    if (Array.isArray(permissionsInput) || permissionsInput instanceof Set) {
        userObject = { permissions: permissionsInput };
    } else if (typeof permissionsInput === 'object') {
        userObject = { ...permissionsInput };
    }

    if (context && typeof context === 'object') {
        const extra = context.user || context;
        userObject = { ...userObject, ...extra };
    }

    const policies = Object.values(FEATURE_POLICIES);
    const visibleItems = [];

    for (const policy of policies) {
        if (!policy.menu) continue;

        if (canViewFeature(userObject, policy.key, context)) {
            visibleItems.push({
                key: policy.key,
                label: policy.menu.label,
                icon: policy.menu.icon,
                group: policy.menu.group,
                order: policy.menu.order ?? 999,
                route: policy.route,
                requiredPermission: policy.menu.requiredPermission || policy.viewAnyOf?.[0],
                requiredAnyPermissions: policy.viewAnyOf,
                requiresDefenseCouncil: policy.assignment === 'defenseCouncil' || policy.assignment?.requiresDefenseCouncil || false,
                requiresOutlineCouncil: policy.assignment === 'outlineCouncil' || policy.assignment?.requiresOutlineCouncil || false,
            });
        }
    }

    const groups = [];
    for (const groupName of NAVIGATION_GROUPS) {
        const items = visibleItems
            .filter((item) => item.group === groupName)
            .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        if (items.length > 0) {
            groups.push({
                group: groupName,
                title: groupName,
                items,
            });
        }
    }

    return groups;
}

function normalizeTabParam(rawSearch = '') {
    const search = rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
    const params = new URLSearchParams(search);
    const tab = params.get('tab');
    return tab ? tab.trim().toLowerCase() : null;
}

/**
 * Tính trạng thái active của mục menu dựa trên pathname + normalized tab,
 * bỏ qua các tham số không liên quan (như semesterId, page, ...) và thứ tự tham số.
 * Dùng FEATURE_POLICY_LIST làm nguồn tìm sibling tab.
 *
 * @param {string} targetRoute
 * @param {string} currentPathname
 * @param {string} [currentSearch='']
 * @param {Array<object>} [policies=FEATURE_POLICY_LIST]
 * @returns {boolean}
 */
export function isNavigationItemActive(
    targetRoute,
    currentPathname,
    currentSearch = '',
    policies = FEATURE_POLICY_LIST
) {
    if (!targetRoute || !currentPathname) return false;

    const [targetPath, targetQuery = ''] = targetRoute.split('?');
    const targetTab = normalizeTabParam(targetQuery);
    const currentTab = normalizeTabParam(currentSearch);

    if (targetTab) {
        if (currentPathname !== targetPath) return false;
        if (currentTab === targetTab) return true;
        // Default tab for /lecturer/approvals is mentor when ?tab= is omitted
        if (targetPath === '/lecturer/approvals' && targetTab === 'mentor' && !currentTab) {
            return true;
        }
        return false;
    }

    if (currentPathname === targetPath && currentTab) {
        const hasMatchingTabSibling = policies.some((policy) => {
            if (!policy?.menu || !policy?.route) return false;
            const [pPath, pQuery = ''] = policy.route.split('?');
            if (pPath !== targetPath || !pQuery) return false;
            const pTab = normalizeTabParam(pQuery);
            return Boolean(pTab && pTab === currentTab);
        });
        if (hasMatchingTabSibling) {
            return false;
        }
    }

    return currentPathname === targetPath || currentPathname.startsWith(`${targetPath}/`);
}
