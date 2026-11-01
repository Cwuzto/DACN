import { Navigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import { getRoleHomePath, PORTAL_PATH } from '../../utils/authRedirect';

function RoleDashboardRedirect() {
    const { isAuthenticated, user } = useAuthStore();

    if (!isAuthenticated || !user) {
        return <Navigate to={PORTAL_PATH} replace />;
    }

    return <Navigate to={getRoleHomePath(user)} replace />;
}

export default RoleDashboardRedirect;
