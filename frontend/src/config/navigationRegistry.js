/**
 * Navigation Registry Projection
 * Dẫn xuất trực tiếp từ FEATURE_POLICY_LIST (Single Source of Truth).
 * Không duy trì danh sách menu viết tay thứ hai.
 */

import { FEATURE_POLICY_LIST, NAVIGATION_GROUPS } from '../auth/featurePolicies.js';
export { NAVIGATION_GROUPS };
export { getVisibleNavigation } from '../auth/policyEvaluator.js';

export const NAVIGATION_REGISTRY = Object.freeze(
    FEATURE_POLICY_LIST
        .filter((policy) => Boolean(policy.menu))
        .map((policy) => ({
            key: policy.key,
            label: policy.menu.label,
            icon: policy.menu.icon,
            group: policy.menu.group,
            order: policy.menu.order ?? 999,
            requiredPermission: policy.menu.requiredPermission || policy.viewAnyOf?.[0],
            requiredAnyPermissions: policy.viewAnyOf,
            requiresDefenseCouncil:
                policy.assignment === 'defenseCouncil' || Boolean(policy.assignment?.requiresDefenseCouncil),
            requiresOutlineCouncil:
                policy.assignment === 'outlineCouncil' || Boolean(policy.assignment?.requiresOutlineCouncil),
            route: policy.route,
        }))
        .sort((a, b) => {
            const groupDiff = NAVIGATION_GROUPS.indexOf(a.group) - NAVIGATION_GROUPS.indexOf(b.group);
            if (groupDiff !== 0) return groupDiff;
            return a.order - b.order;
        })
);
