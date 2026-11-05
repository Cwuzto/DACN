import axios from 'axios';
import useAuthStore from '../stores/authStore.js';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:5000/api';

// BroadcastChannel for cross-tab session & permission synchronization
export const authSyncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('dacn_auth_sync') : null;
if (authSyncChannel?.unref) {
    try {
        authSyncChannel.unref();
    } catch {}
}
export const authChannel = authSyncChannel;

// Single-flight refresh token mutex
let refreshingPromise = null;

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
        const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) ||
                      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('token'));
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ============================
// RESPONSE INTERCEPTOR
// Xử lý lỗi chung (VD: token hết hạn -> đẩy ra login, 409 stale replay, 403 bảo toàn session)
// ============================
api.interceptors.response.use(
    (response) => response.data,
    async (error) => {
        const config = error.config;
        const isLoginRequest = config?.url?.includes('/auth/login');
        const currentPath = typeof window !== 'undefined' && window.location ? window.location.pathname : '';

        // Không bao giờ redirect cứng nếu người dùng đang ở trang chủ '/' hoặc các trang công khai
        const isPublicPath =
            currentPath === '/' ||
            currentPath === '/login' ||
            currentPath === '/forgot-password' ||
            !currentPath;

        // ============================================================
        // 409 Conflict: PERMISSION_VERSION_STALE
        // Single-flight token refresh + Safe Replay Check
        // ============================================================
        const isStaleVersion = error.response?.status === 409 && (
            error.response?.data?.error === 'PERMISSION_VERSION_STALE' ||
            error.response?.data?.message?.includes?.('PERMISSION_VERSION_STALE')
        );

        if (isStaleVersion && config) {
            if (config._retry) {
                return Promise.reject(error.response?.data || error);
            }
            config._retry = true;

            try {
                if (!refreshingPromise) {
                    const oldToken = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) ||
                                     (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('token'));

                    refreshingPromise = (async () => {
                        try {
                            const res = await axios.get(`${API_BASE_URL}/auth/me`, {
                                headers: oldToken ? { Authorization: `Bearer ${oldToken}` } : {},
                            });
                            const data = res?.data;
                            const newToken = data?.token;
                            const newUser = data?.data;

                            if (newToken) {
                                const hasLocal = typeof localStorage !== 'undefined' && (localStorage.getItem('token') || localStorage.getItem('user'));
                                const hasSession = typeof sessionStorage !== 'undefined' && (sessionStorage.getItem('token') || sessionStorage.getItem('user'));

                                if (hasSession && !hasLocal) {
                                    sessionStorage.setItem('token', newToken);
                                    if (newUser) sessionStorage.setItem('user', JSON.stringify(newUser));
                                } else {
                                    if (typeof localStorage !== 'undefined') {
                                        localStorage.setItem('token', newToken);
                                        if (newUser) localStorage.setItem('user', JSON.stringify(newUser));
                                    }
                                }
                            }

                            try {
                                if (useAuthStore?.getState) {
                                    const store = useAuthStore.getState();
                                    if (typeof store.updateUser === 'function' && newUser) {
                                        store.updateUser(newUser);
                                    }
                                    if (newToken) {
                                        useAuthStore.setState({ token: newToken });
                                    }
                                }
                            } catch {}

                            try {
                                authSyncChannel?.postMessage({ type: 'PERMISSION_VERSION_UPDATED' });
                            } catch {}

                            return newToken;
                        } finally {
                            refreshingPromise = null;
                        }
                    })();
                }

                const newToken = await refreshingPromise;

                // Safe Replay Check:
                // GET/HEAD or requests with Idempotency-Key are safely replayed.
                const method = (config.method || 'get').toUpperCase();
                const isSafeMethod = method === 'GET' || method === 'HEAD';

                let idempotencyKey = null;
                if (config.headers) {
                    if (typeof config.headers.get === 'function') {
                        idempotencyKey = config.headers.get('Idempotency-Key') || config.headers.get('idempotency-key');
                    }
                    if (!idempotencyKey) {
                        idempotencyKey = config.headers['Idempotency-Key'] || config.headers['idempotency-key'];
                    }
                }

                if (isSafeMethod || idempotencyKey) {
                    if (config.headers) {
                        if (typeof config.headers.set === 'function') {
                            config.headers.set('Authorization', `Bearer ${newToken}`);
                        } else {
                            config.headers.Authorization = `Bearer ${newToken}`;
                            config.headers['Authorization'] = `Bearer ${newToken}`;
                        }
                    } else {
                        config.headers = { Authorization: `Bearer ${newToken}` };
                    }
                    return api(config);
                }

                // Mutations WITHOUT Idempotency-Key: Block auto-replay to prevent duplicate writes
                return Promise.reject({
                    ...(error.response?.data || {}),
                    requiresUserConfirmation: true,
                    message: 'Quyền hạn vừa được cập nhật trên hệ thống. Vui lòng xác nhận để gửi lại thao tác.',
                });
            } catch (refreshErr) {
                return Promise.reject(refreshErr?.response?.data || refreshErr || error.response?.data || error);
            }
        }

        // ============================================================
        // 401 Unauthorized or ACCOUNT_DISABLED
        // Xóa sạch storage và điều hướng về trang chủ
        // ============================================================
        const isAccountDisabled = error.response?.data?.error === 'ACCOUNT_DISABLED';
        const isUnauthorized = error.response?.status === 401;

        if ((isUnauthorized || isAccountDisabled) && !isLoginRequest) {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
            }

            // Phiên không còn hợp lệ: rời phân hệ bảo vệ và trở về portal công khai.
            if (!isPublicPath && typeof window !== 'undefined' && window.location?.replace) {
                window.location.replace('/');
            }
        }

        // ============================================================
        // Invariant: 403 Forbidden strictly preserves session and tokens
        // Never logout on 403 (Forbidden, COI, out-of-scope domain guards)
        // ============================================================
        return Promise.reject(error.response?.data || error);
    }
);

export default api;
