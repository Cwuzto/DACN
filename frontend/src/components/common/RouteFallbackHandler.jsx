import { Navigate, useLocation } from 'react-router-dom';
import RouteErrorPage from '../../pages/common/RouteErrorPage';

const isMalformedPath = (pathname) => {
    if (!pathname || !pathname.startsWith('/')) return false;

    let decoded = pathname;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        return true;
    }
    if (decoded.includes('\\')) return true;
    if (decoded.includes('//')) return true;
    if (/\s/.test(decoded)) return true;

    return /[^a-zA-Z0-9/_-]/.test(decoded);
};

function RouteFallbackHandler() {
    const location = useLocation();
    const path = location.pathname;

    if (isMalformedPath(path)) {
        return <RouteErrorPage path={path} />;
    }

    return <Navigate to="/login" replace />;
}

export default RouteFallbackHandler;
