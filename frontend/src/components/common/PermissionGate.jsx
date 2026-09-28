import useAuthStore, { hasPermission } from '../../stores/authStore';

/**
 * Component chỉ render children khi user có ít nhất một trong các permission.
 * @param {Array} permissions danh sách permission yêu cầu (OR)
 * @param {boolean} requireAll true nếu cần đủ tất cả permission
 */
function PermissionGate({ permissions = [], requireAll = false, children, fallback = null }) {
    const { user } = useAuthStore();
    const userPermissions = user?.permissions || [];

    if (permissions.length === 0) return children;

    const check = (code) => userPermissions.includes(code);
    const allowed = requireAll ? permissions.every(check) : permissions.some(check);

    return allowed ? children : fallback;
}

export default PermissionGate;
export { hasPermission };
