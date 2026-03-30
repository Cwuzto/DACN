// src/pages/auth/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';
import { authService } from '../../services/authService';
import useAuthStore from '../../stores/authStore';

function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const setAuth = useAuthStore((state) => state.setAuth);

    const onFinish = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            message.error('Vui lòng nhập đầy đủ email và mật khẩu!');
            return;
        }

        setLoading(true);
        try {
            const response = await authService.login(email, password);
            const { token, user } = response.data;
            setAuth(token, user);
            message.success('Đăng nhập thành công!');

            if (user.role === 'ADMIN') {
                navigate('/admin/dashboard');
            } else if (user.role === 'LECTURER') {
                navigate('/lecturer/dashboard');
            } else {
                navigate('/student/dashboard');
            }

        } catch (error) {
            Modal.error({
                title: 'Đăng nhập thất bại',
                icon: <ExclamationCircleFilled />,
                content: error?.response?.data?.message || error?.message || 'Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại!',
                okText: 'Thử lại',
                centered: true,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex flex-col">
            <style>
                {`
                .tech-pattern {
                    background-image: radial-gradient(circle at 2px 2px, #00336615 1px, transparent 0);
                    background-size: 32px 32px;
                }
                `}
            </style>
            <div className="flex-grow flex items-center justify-center px-4 py-12 relative overflow-hidden tech-pattern">
                {/* Abstract Decoration */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-3xl"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-3xl"></div>
                </div>
                {/* Login Container */}
                <div className="relative z-10 w-full max-w-[480px]">
                    <div className="bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-primary/10 overflow-hidden">
                        {/* Brand Header */}
                        <div className="pt-10 pb-6 px-8 text-center border-b border-primary/5">
                            <div className="flex justify-center mb-4">
                                <div className="size-12 bg-primary rounded-lg flex items-center justify-center text-white">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                        <g clipPath="url(#clip0_6_330)">
                                            <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
                                        </g>
                                        <defs>
                                            <clipPath id="clip0_6_330"><rect fill="white" height="48" width="48"></rect></clipPath>
                                        </defs>
                                    </svg>
                                </div>
                            </div>
                            <h2 className="text-primary dark:text-slate-100 text-2xl font-bold tracking-tight">Viện Công nghệ Số</h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Hệ thống quản lý đào tạo & nghiên cứu</p>
                        </div>
                        {/* Form Section */}
                        <div className="p-8">
                            <h1 className="text-slate-900 dark:text-slate-100 text-xl font-bold mb-6">Đăng nhập hệ thống</h1>
                            <form className="space-y-5" onSubmit={onFinish}>
                                <div className="flex flex-col gap-2">
                                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Email công vụ</label>
                                    <div className="relative flex items-center">
                                        <span className="material-symbols-outlined absolute left-3 text-slate-400">mail</span>
                                        <input
                                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                            placeholder="account@vcs.edu.vn"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Mật khẩu</label>
                                        <a className="text-primary dark:text-primary/80 text-xs font-semibold hover:underline cursor-pointer" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}>Quên mật khẩu?</a>
                                    </div>
                                    <div className="relative flex items-center">
                                        <span className="material-symbols-outlined absolute left-3 text-slate-400">lock</span>
                                        <input
                                            className="w-full pl-10 pr-12 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                            placeholder="••••••••"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                        <button
                                            className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center"
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 py-1">
                                    <input
                                        className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                        id="remember"
                                        type="checkbox"
                                        checked={remember}
                                        onChange={(e) => setRemember(e.target.checked)}
                                    />
                                    <label className="text-slate-600 dark:text-slate-400 text-sm cursor-pointer select-none" htmlFor="remember">Ghi nhớ đăng nhập</label>
                                </div>
                                <button
                                    className="w-full bg-primary text-white py-3 px-4 rounded-lg font-bold text-base hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:bg-primary/50 disabled:cursor-not-allowed"
                                    type="submit"
                                    disabled={loading}
                                >
                                    <span>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
                                    {!loading && <span className="material-symbols-outlined text-[18px]">login</span>}
                                </button>
                            </form>
                            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                                <p className="text-slate-600 dark:text-slate-400 text-sm">
                                    Chưa có tài khoản?{' '}
                                    <a className="text-primary dark:text-primary/80 font-bold hover:underline cursor-pointer" onClick={() => message.info('Vui lòng liên hệ Quản trị viên của trường để được cấp tài khoản.')}>Liên hệ quản trị viên</a>
                                </p>
                            </div>
                        </div>
                    </div>
                    {/* Additional Help Info */}
                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <div className="bg-white/50 dark:bg-slate-900/50 p-3 rounded-lg flex items-center gap-3 border border-primary/5 cursor-pointer hover:bg-white transition-colors">
                            <span className="material-symbols-outlined text-primary text-[20px]">help</span>
                            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Hướng dẫn sử dụng</span>
                        </div>
                        <div className="bg-white/50 dark:bg-slate-900/50 p-3 rounded-lg flex items-center gap-3 border border-primary/5 cursor-pointer hover:bg-white transition-colors">
                            <span className="material-symbols-outlined text-primary text-[20px]">support_agent</span>
                            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Hỗ trợ kỹ thuật</span>
                        </div>
                    </div>
                </div>
            </div>
            {/* Footer */}
            <footer className="py-8 px-4 text-center">
                <div className="max-w-[960px] mx-auto">
                    <p className="text-slate-500 dark:text-slate-500 text-xs font-medium uppercase tracking-widest">
                        © 2026 Viện Công nghệ Số. Bảo lưu mọi quyền.
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default LoginPage;