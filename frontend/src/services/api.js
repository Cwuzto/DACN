import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Tạo instance Axios với cấu hình mặc định
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ============================
// REQUEST INTERCEPTOR
// Tự động gắn JWT Token vào mỗi request
// ============================
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ============================
// RESPONSE INTERCEPTOR
// Xử lý lỗi chung (VD: token hết hạn -> đẩy ra login)
// ============================
api.interceptors.response.use(
    (response) => response.data,
    (error) => {
        const isLoginRequest = error.config?.url?.includes('/auth/login');
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

        // Không bao giờ redirect cứng nếu người dùng đang ở trang chủ '/' hoặc các trang công khai
        const isPublicPath =
            currentPath === '/' ||
            currentPath === '/login' ||
            currentPath === '/forgot-password' ||
            !currentPath;

        if (error.response?.status === 401 && !isLoginRequest) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');

            // Phiên không còn hợp lệ: rời phân hệ bảo vệ và trở về portal công khai.
            if (!isPublicPath) {
                window.location.replace('/');
            }
        }
        return Promise.reject(error.response?.data || error);
    }
);

export default api;
