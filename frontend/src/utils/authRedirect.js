export const PORTAL_PATH = '/';

const ROLE_HOME_PATHS = {
    ADMIN: '/admin/dashboard',
    LECTURER: '/lecturer/dashboard',
    STUDENT: '/student/dashboard',
};

const readRole = (userOrRole) => (
    typeof userOrRole === 'string' ? userOrRole : userOrRole?.role
);

const readGroupCodes = (user) => (user?.permissionGroups || [])
    .map((group) => (typeof group === 'string' ? group : group?.code))
    .filter(Boolean);

export function getRoleHomePath(userOrRole) {
    return ROLE_HOME_PATHS[readRole(userOrRole)] || PORTAL_PATH;
}

export function isInstituteDirector(user) {
    if (!user) return false;
    const groupCodes = readGroupCodes(user);
    return groupCodes.includes('VIEN_TRUONG');
}

export function getUserDisplayRole(userOrRole) {
    if (!userOrRole) return '';
    if (typeof userOrRole === 'object') {
        const groupCodes = readGroupCodes(userOrRole);
        if (groupCodes.includes('VIEN_TRUONG')) {
            return 'Viện trưởng';
        }
        if (groupCodes.includes('GIAO_VU')) {
            return 'Giáo vụ';
        }
    }
    const role = readRole(userOrRole);
    if (role === 'ADMIN') return 'Quản trị viên';
    if (role === 'LECTURER') return 'Giảng viên';
    if (role === 'STUDENT') return 'Sinh viên';
    return role || '';
}

export function hasPermissionOrGroup(user, permissions = [], permissionGroups = []) {
    if (permissions.length === 0 && permissionGroups.length === 0) return true;

    const userPermissions = user?.permissions || [];
    const userGroups = readGroupCodes(user);
    const hasPermissions = permissions.length > 0
        && permissions.every((permission) => userPermissions.includes(permission));
    const hasPermissionGroup = permissionGroups.length > 0
        && permissionGroups.some((group) => userGroups.includes(group));

    return hasPermissions || hasPermissionGroup;
}

export function getRouteRedirect({
    isAuthenticated,
    user,
    allowedRoles = [],
    requiredPermissions = [],
    requiredAnyPermissions = [],
    allowedPermissionGroups = [],
}) {
    if (!isAuthenticated || !user) return PORTAL_PATH;

    const hasAllowedRole = allowedRoles.length === 0 || allowedRoles.includes(user.role);
    const hasScopedAccess = hasPermissionOrGroup(
        user,
        requiredPermissions,
        allowedPermissionGroups,
    ) && (
        requiredAnyPermissions.length === 0
        || requiredAnyPermissions.some((permission) => (user.permissions || []).includes(permission))
    );

    return hasAllowedRole && hasScopedAccess ? null : getRoleHomePath(user);
}
