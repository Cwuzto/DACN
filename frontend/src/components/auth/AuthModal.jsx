import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import useAuthStore from '../../stores/authStore';
import { getRoleHomePath, hasPermissionOrGroup } from '../../utils/authRedirect';

/**
 * AuthModal - Popup Đăng nhập Cổng Học vụ
 * Chuẩn màu sắc: Academic Pine Teal (#0F766E) theo Hệ thống Design Tokens của dự án DACN
 * Loại bỏ: Tài khoản thử nghiệm nhanh, thông báo liên hệ đăng ký
 */
export default function AuthModal({ open, onClose }) {
    const navigate = useNavigate();
    const setAuth = useAuthStore((state) => state.setAuth);

    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Khôi phục email đã ghi nhớ
    useEffect(() => {
        if (open) {
            const savedEmail = localStorage.getItem('remembered_email');
            if (savedEmail) {
                setEmail(savedEmail);
                setRemember(true);
            }
            setErrorMessage('');
        }
    }, [open]);

    // Lắng nghe phím Escape để đóng popup
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !loading) {
                onClose?.();
            }
        };
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, onClose, loading]);

    if (!open) return null;

    const handleLoginSubmit = async (e) => {
        e?.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
            setErrorMessage('Vui lòng nhập đầy đủ email và mật khẩu!');
            return;
        }

        setLoading(true);
        setErrorMessage('');

        try {
            const response = await authService.login(trimmedEmail, password, remember);
            const { token, user } = response.data;

            if (remember) {
                localStorage.setItem('remembered_email', trimmedEmail);
            } else {
                localStorage.removeItem('remembered_email');
            }

            setAuth(token, user, remember);
            onClose?.();
            navigate(getRoleHomePath(user));
        } catch (error) {
            setErrorMessage(
                error?.response?.data?.message ||
                error?.message ||
                'Email hoặc mật khẩu không chính xác. Vui lòng thử lại!'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-[4px] transition-all"
            onClick={(e) => {
                if (e.target === e.currentTarget && !loading) {
                    onClose?.();
                }
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Đăng nhập Cổng Học vụ"
        >
            <div
                className="w-full max-w-[440px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header: Tone Pine Teal chuẩn học thuật */}
                <div className="relative px-6 py-6 text-center text-white bg-gradient-to-br from-[#0F766E] to-[#115E59]">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Đóng hộp thoại"
                        title="Đóng (Esc)"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>

                    {/* Emblem Icon */}
                    <div className="w-11 h-11 mx-auto mb-2.5 rounded-xl bg-white/15 flex items-center justify-center shadow-inner text-white">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                            <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                        </svg>
                    </div>

                    <h2 className="text-lg font-bold text-white tracking-tight">
                        Đăng nhập Cổng Học vụ
                    </h2>
                    <p className="text-xs text-teal-100/85 mt-1 font-medium">
                        Hệ thống Quản lý Đào tạo & Nghiên cứu Khoa học
                    </p>
                </div>

                {/* Modal Body */}
                <div className="p-6">
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                            {/* Error Alert */}
                            {errorMessage && (
                                <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-2.5 animate-in fade-in">
                                    <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
                                </div>
                            )}

                            {/* Email Input */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                                    Email tài khoản công vụ
                                </label>
                                <div className="relative flex items-center">
                                    <div className="absolute left-3 text-slate-400 pointer-events-none">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                                        </svg>
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        autoFocus
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="account@university.edu.vn"
                                        className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-50/60 text-slate-900 focus:bg-white focus:outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                                    Mật khẩu
                                </label>
                                <div className="relative flex items-center">
                                    <div className="absolute left-3 text-slate-400 pointer-events-none">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                        </svg>
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-50/60 text-slate-900 focus:bg-white focus:outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
                                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    >
                                        {showPassword ? (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        ) : (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Remember Checkbox & Forgot Password */}
                            <div className="flex items-center justify-between pt-1 text-xs">
                                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 hover:text-slate-900">
                                    <input
                                        type="checkbox"
                                        checked={remember}
                                        onChange={(e) => setRemember(e.target.checked)}
                                        className="w-4 h-4 rounded text-[#0F766E] border-slate-300 focus:ring-[#0F766E] accent-[#0F766E] cursor-pointer"
                                    />
                                    <span>Ghi nhớ phiên làm việc</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose?.();
                                        navigate('/forgot-password');
                                    }}
                                    className="text-xs text-[#0F766E] hover:text-[#115E59] font-medium hover:underline transition-colors"
                                >
                                    Quên mật khẩu?
                                </button>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-[#0F766E] hover:bg-[#115E59] active:bg-[#0D5D57] text-white text-sm font-semibold shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Đang xác thực...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Xác thực & Tiếp tục</span>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                            <polyline points="12 5 19 12 12 19"></polyline>
                                        </svg>
                                    </>
                                )}
                            </button>
                        </form>
                </div>
            </div>
        </div>
    );
}
