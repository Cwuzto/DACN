import { create } from 'zustand';

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
        const localUser = localStorage.getItem('user');
        if (localUser) return JSON.parse(localUser);
        const sessionUser = sessionStorage.getItem('user');
        if (sessionUser) return JSON.parse(sessionUser);
    } catch {
        return null;
    }
    return null;
};

const getStoredToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
};

const useAuthStore = create((set) => ({
    user: getStoredUser(),
    token: getStoredToken(),
    isAuthenticated: !!getStoredToken(),

    // Hành động: Đăng nhập thành công -> lưu token & user theo lựa chọn remember
    setAuth: (token, user, remember = false) => {
        if (remember) {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
        } else {
            sessionStorage.setItem('token', token);
            sessionStorage.setItem('user', JSON.stringify(user));
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
        set({ token, user, isAuthenticated: true });
    },

    // Hành động: Đăng xuất -> xoá token & user khỏi cả 2 storage
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        set({ token: null, user: null, isAuthenticated: false });
    },

    // Cập nhật thông tin user (sau khi edit profile)
    updateUser: (updatedUser) => {
        if (localStorage.getItem('user')) {
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        if (sessionStorage.getItem('user')) {
            sessionStorage.setItem('user', JSON.stringify(updatedUser));
        }
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
