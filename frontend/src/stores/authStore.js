import { create } from 'zustand';
import api from '../services/api.js';

/**
 * Auth Store (Zustand)
 * Quản lý trạng thái đăng nhập toàn cục:
 * - user: thông tin user hiện tại
 * - token: JWT token
 * - isAuthenticated: đã đăng nhập hay chưa
 * Hỗ trợ phân tách lưu trữ linh hoạt:
 * - Ghi nhớ đăng nhập (remember = true): lưu tại localStorage (phiên dài hạn)
 * - Không ghi nhớ (remember = false): lưu tại sessionStorage (đóng tab/trình duyệt là kết thúc phiên)
 */
const getStoredUser = () => {
    try {
        if (typeof localStorage !== 'undefined') {
            const localUser = localStorage.getItem('user');
            if (localUser) return JSON.parse(localUser);
        }
        if (typeof sessionStorage !== 'undefined') {
            const sessionUser = sessionStorage.getItem('user');
            if (sessionUser) return JSON.parse(sessionUser);
        }
    } catch {
        return null;
    }
    return null;
};

const getStoredToken = () => {
    try {
        return (typeof localStorage !== 'undefined' && localStorage.getItem('token')) ||
               (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('token')) ||
               null;
    } catch {
        return null;
    }
};

const useAuthStore = create((set) => ({
    user: getStoredUser(),
    token: getStoredToken(),
    isAuthenticated: !!getStoredToken(),

    // Hành động: Đăng nhập thành công -> lưu token & user theo lựa chọn remember
    setAuth: (token, user, remember = false) => {
        if (remember) {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
            }
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
            }
        } else {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('token', token);
                sessionStorage.setItem('user', JSON.stringify(user));
            }
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        set({ token, user, isAuthenticated: true });
    },

    // Hành động: Đăng xuất -> xoá token & user khỏi cả 2 storage
    logout: () => {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
        }
        set({ token: null, user: null, isAuthenticated: false });
    },

    // Cập nhật thông tin user (sau khi edit profile)
    updateUser: (updatedUser) => {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('user')) {
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('user')) {
            sessionStorage.setItem('user', JSON.stringify(updatedUser));
        }
        set({ user: updatedUser });
    },

    // Làm mới session từ backend /auth/me
    refreshSession: async () => {
        try {
            const res = await api.get('/auth/me');
            const user = res?.data || (res?.id ? res : null);
            const token = res?.token;
            if (user) {
                const hasLocal = typeof localStorage !== 'undefined' && (localStorage.getItem('token') || localStorage.getItem('user'));
                const hasSession = typeof sessionStorage !== 'undefined' && (sessionStorage.getItem('token') || sessionStorage.getItem('user'));

                if (hasSession && !hasLocal) {
                    if (token && typeof sessionStorage !== 'undefined') sessionStorage.setItem('token', token);
                    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('user', JSON.stringify(user));
                } else {
                    if (token && typeof localStorage !== 'undefined') localStorage.setItem('token', token);
                    if (typeof localStorage !== 'undefined') localStorage.setItem('user', JSON.stringify(user));
                }

                set((state) => ({
                    user,
                    token: token || state.token,
                    isAuthenticated: true,
                }));
                return user;
            }
            return null;
        } catch {
            return null;
        }
    },
}));

export const hasPermission = (code) => {
    const user = useAuthStore.getState().user;
    if (!user || !Array.isArray(user.permissions)) return false;
    return user.permissions.includes(code);
};

export const hasRole = (...roles) => {
    const user = useAuthStore.getState().user;
    if (!user || !user.role) return false;
    return roles.includes(user.role);
};

export default useAuthStore;
