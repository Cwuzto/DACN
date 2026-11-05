import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import { getRouteRedirect } from '../../utils/authRedirect';

/**
 * Component bảo vệ các Route cần đăng nhập và kiểm tra Capability/Role.
 * Hỗ trợ requiredPermission (quyền đơn) gộp vào requiredPermissions.
 */
function ProtectedRoute({
    allowedRoles = [],
    requiredPermissions = [],
    requiredAnyPermissions = [],
    allowedPermissionGroups = [],
    requiredPermission,
}) {
    const { isAuthenticated, user } = useAuthStore();

    const effectiveRequiredPermissions = requiredPermission
        ? (requiredPermissions.includes(requiredPermission)
            ? requiredPermissions
            : [...requiredPermissions, requiredPermission])
        : requiredPermissions;

    const redirectTo = getRouteRedirect({
        isAuthenticated,
        user,
        allowedRoles,
        requiredPermissions: effectiveRequiredPermissions,
        requiredAnyPermissions,
        allowedPermissionGroups,
    });

    if (redirectTo) return <Navigate to={redirectTo} replace />;

    return <Outlet />;
}

export default ProtectedRoute;
