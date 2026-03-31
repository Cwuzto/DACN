import { Navigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

function RoleDashboardRedirect() {
    const { isAuthenticated, user } = useAuthStore();

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }

    if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'LECTURER') return <Navigate to="/lecturer/dashboard" replace />;
    return <Navigate to="/student/dashboard" replace />;
}

export default RoleDashboardRedirect;
