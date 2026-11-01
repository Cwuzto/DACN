import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import { getRoleHomePath } from '../../utils/authRedirect';

function PublicOnlyRoute() {
    const { isAuthenticated, user } = useAuthStore();

    if (isAuthenticated && user) {
        return <Navigate to={getRoleHomePath(user)} replace />;
    }

    return <Outlet />;
}

export default PublicOnlyRoute;
