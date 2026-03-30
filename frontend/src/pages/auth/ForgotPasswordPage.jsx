import { useNavigate } from 'react-router-dom';

function ForgotPasswordPage() {
    const navigate = useNavigate();

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
            <main className="flex-grow flex items-center justify-center px-4 py-12 tech-pattern relative">
                {/* Abstract Decoration */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-3xl"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-3xl"></div>
                </div>
                
                <div className="max-w-[480px] w-full flex flex-col gap-8 bg-white dark:bg-slate-900 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 relative z-10">
                    {/* Logo and Title Section */}
                    <div className="flex flex-col items-center gap-6 text-center">
                        <div className="flex flex-col items-center gap-3 text-primary dark:text-slate-100">
                            <div className="size-12 flex items-center justify-center bg-primary rounded-lg text-white mb-2 shadow-lg shadow-primary/20">
                                <svg className="size-8" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                    <g clipPath="url(#clip0_6_330)">
                                        <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
                                    </g>
                                    <defs>
                                        <clipPath id="clip0_6_330"><rect fill="white" height="48" width="48"></rect></clipPath>
                                    </defs>
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold leading-tight tracking-tight text-primary">Viện Công nghệ Số</h1>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-slate-900 dark:text-slate-100 text-2xl font-bold">Quên mật khẩu</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                Nhập email để nhận hướng dẫn khôi phục mật khẩu
                            </p>
                        </div>
                    </div>
                    {/* Form Section */}
                    <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); alert('Chức năng gửi email khôi phục mật khẩu đang phát triển!'); }}>
                        <div className="flex flex-col gap-2">
                            <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">
                                Địa chỉ Email
                            </label>
                            <div className="relative flex items-center">
                                <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[20px]">
                                    mail
                                </span>
                                <input 
                                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none" 
                                    placeholder="example@email.com" 
                                    required 
                                    type="email"
                                />
                            </div>
                        </div>
                        <button className="w-full h-12 flex items-center justify-center rounded-lg bg-primary text-white text-base font-bold transition-colors hover:bg-primary/90 shadow-lg shadow-primary/20" type="submit">
                            Gửi mã xác nhận
                        </button>
                    </form>
                    {/* Back Link */}
                    <div className="text-center">
                        <a 
                            className="inline-flex items-center gap-2 text-primary dark:text-primary/80 text-sm font-semibold hover:underline cursor-pointer" 
                            onClick={(e) => { e.preventDefault(); navigate('/login'); }}
                        >
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                            Quay lại đăng nhập
                        </a>
                    </div>
                </div>
            </main>
            {/* Footer */}
            <footer className="py-8 px-4 text-center relative z-10">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-widest">
                    © 2026 Viện Công nghệ Số. All rights reserved.
                </p>
            </footer>
        </div>
    );
}

export default ForgotPasswordPage;
