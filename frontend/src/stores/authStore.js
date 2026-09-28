import { create } from 'zustand';

/**
 * Auth Store (Zustand)
 * Quản lý trạng thái đăng nhập toàn cục:
 * - user: thông tin user hiện tại
 * - token: JWT token
 * - isAuthenticated: đã đăng nhập hay chưa
 */
const useAuthStore = create((set, get) => ({
    user: JSON.parse(localStorage.getItem('user')) || null,
    token: localStorage.getItem('token') || null,
    isAuthenticated: !!localStorage.getItem('token'),

    // Hành động: Đăng nhập thành công -> lưu token & user
    setAuth: (token, user) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ token, user, isAuthenticated: true });
    },

    // Hành động: Đăng xuất -> xoá token & user
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ token: null, user: null, isAuthenticated: false });
    },

    // Cập nhật thông tin user (sau khi edit profile)
    updateUser: (updatedUser) => {
        localStorage.setItem('user', JSON.stringify(updatedUser));
        set({ user: updatedUser });
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
