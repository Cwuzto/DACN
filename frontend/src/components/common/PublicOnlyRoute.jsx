import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

function PublicOnlyRoute() {
    const { isAuthenticated, user } = useAuthStore();

    if (isAuthenticated && user) {
        if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
        if (user.role === 'LECTURER') return <Navigate to="/lecturer/dashboard" replace />;
        return <Navigate to="/student/dashboard" replace />;
    }

    return <Outlet />;
}

export default PublicOnlyRoute;
