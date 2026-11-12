import useAuthStore from '../stores/authStore';

/**
 * useAuth Hook
 * Wraps useAuthStore to provide user and auth state to components
 */
export const useAuth = () => {
    const user = useAuthStore((state) => state.user);
    const token = useAuthStore((state) => state.token);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const setAuth = useAuthStore((state) => state.setAuth);
    const logout = useAuthStore((state) => state.logout);
    const updateUser = useAuthStore((state) => state.updateUser);
    const refreshSession = useAuthStore((state) => state.refreshSession);

    return {
        user,
        token,
        isAuthenticated,
        setAuth,
        logout,
        updateUser,
        refreshSession,
    };
};

export default useAuth;
