import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

/**
 * Component bảo vệ các Route cần đăng nhập và kiểm tra Role.
 * @param {Array} allowedRoles mảng các role được phép truy cập, VD: ['ADMIN', 'LECTURER']
 */
function ProtectedRoute({ allowedRoles }) {
    const { isAuthenticated, user } = useAuthStore();

    // 1. Nếu chưa đăng nhập -> chuyển về trang login
    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }

    // 2. Nếu đã đăng nhập nhưng không có quyền truy cập route này
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Tuỳ theo role thực tại để đẩy về đúng dashboard
        if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
        if (user.role === 'LECTURER') return <Navigate to="/lecturer/dashboard" replace />;
        return <Navigate to="/student/dashboard" replace />;
    }

    // 3. Hợp lệ -> cho phép render các route con
    return <Outlet />;
}

export default ProtectedRoute;
