import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import { getRouteRedirect } from '../../utils/authRedirect';

/**
 * Component bảo vệ các Route cần đăng nhập và kiểm tra Role.
 * @param {Array} allowedRoles mảng các role được phép truy cập, VD: ['ADMIN', 'LECTURER']
 */
function ProtectedRoute({
    allowedRoles = [],
    requiredPermissions = [],
    requiredAnyPermissions = [],
    allowedPermissionGroups = [],
}) {
    const { isAuthenticated, user } = useAuthStore();

    const redirectTo = getRouteRedirect({
        isAuthenticated,
        user,
        allowedRoles,
        requiredPermissions,
        requiredAnyPermissions,
        allowedPermissionGroups,
    });

    if (redirectTo) return <Navigate to={redirectTo} replace />;

    return <Outlet />;
}

export default ProtectedRoute;
