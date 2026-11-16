import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import { getRouteRedirect, getRoleHomePath } from '../../utils/authRedirect';
import { canViewFeature } from '../../auth/policyEvaluator';

/**
 * Component bảo vệ các Route cần đăng nhập và kiểm tra Capability/Role.
 * Hỗ trợ canonical featureKey cũng như legacy permissions/roles props.
 */
function ProtectedRoute({
    featureKey,
    allowedRoles = [],
    requiredPermissions = [],
    requiredAnyPermissions = [],
    allowedPermissionGroups = [],
    requiredPermission,
    context = {},
}) {
    const { isAuthenticated, user } = useAuthStore();

    if (!isAuthenticated || !user) {
        return <Navigate to="/" replace />;
    }

    let redirectTo = null;

    if (featureKey) {
        const hasRole = allowedRoles.length === 0 || allowedRoles.includes(user.role);
        const allowed = hasRole && canViewFeature(user, featureKey, context);
        if (!allowed) {
            redirectTo = getRoleHomePath(user);
        }
    } else {
        const effectiveRequiredPermissions = requiredPermission
            ? (requiredPermissions.includes(requiredPermission)
                ? requiredPermissions
                : [...requiredPermissions, requiredPermission])
            : requiredPermissions;

        redirectTo = getRouteRedirect({
            isAuthenticated,
            user,
            allowedRoles,
            requiredPermissions: effectiveRequiredPermissions,
            requiredAnyPermissions,
            allowedPermissionGroups,
        });
    }

    if (redirectTo) return <Navigate to={redirectTo} replace />;

    return <Outlet />;
}

export default ProtectedRoute;
