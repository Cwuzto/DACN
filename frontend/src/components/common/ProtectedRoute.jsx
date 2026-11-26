import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { message } from 'antd';
import useAuthStore from '../../stores/authStore';
import { getRouteRedirect, getRoleHomePath } from '../../utils/authRedirect';
import { canViewFeature, getEffectivePermissions } from '../../auth/policyEvaluator';

/**
 * Component bảo vệ các Route cần đăng nhập và kiểm tra Capability/Role.
 * Kết hợp canonical featureKey với các ràng buộc route có chủ đích (allowedRoles, requiredAnyPermissions, ...).
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

    const isAuthed = Boolean(isAuthenticated && user);

    const effectiveRequiredPermissions = requiredPermission
        ? (requiredPermissions.includes(requiredPermission)
            ? requiredPermissions
            : [...requiredPermissions, requiredPermission])
        : requiredPermissions;

    let redirectTo = null;
    if (isAuthed) {
        const effectivePermissions = Array.from(getEffectivePermissions(user, context));
        const effectiveUser = {
            ...user,
            permissions: effectivePermissions,
        };

        redirectTo = getRouteRedirect({
            isAuthenticated,
            user: effectiveUser,
            allowedRoles,
            requiredPermissions: effectiveRequiredPermissions,
            requiredAnyPermissions,
            allowedPermissionGroups,
        });

        if (!redirectTo && featureKey && !canViewFeature(user, featureKey, context)) {
            redirectTo = getRoleHomePath(user);
        }
    }

    useEffect(() => {
        if (isAuthed && redirectTo) {
            message.warning({
                content: 'Bạn không có quyền truy cập trang này.',
                key: 'rbac-access-denied',
            });
        }
    }, [isAuthed, redirectTo]);

    if (!isAuthed) {
        return <Navigate to="/" replace />;
    }

    if (redirectTo) return <Navigate to={redirectTo} replace />;

    return <Outlet />;
}

export default ProtectedRoute;
