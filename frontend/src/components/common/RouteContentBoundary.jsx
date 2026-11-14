import { useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';

export default function RouteContentBoundary({ children }) {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <ErrorBoundary resetKeys={[location.key, location.pathname, location.search]} onBack={() => navigate(-1)}>
            {children}
        </ErrorBoundary>
    );
}
