import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

// Mapping role -> nav items + role label
const NAV_CONFIG = {
    STUDENT: {
        label: 'Hệ thống Sinh viên',
        basePath: '/student',
        items: [
            { path: '/student/dashboard', icon: 'dashboard', label: 'Tổng quan' },
            { path: '/student/topics', icon: 'list_alt', label: 'Danh sách đề tài' },
            { path: '/student/submissions', icon: 'cloud_upload', label: 'Nộp báo cáo' },
            { path: '/student/grades', icon: 'workspace_premium', label: 'Xem điểm' },
        ],
        bottomItems: [
            { path: '/student/notifications', icon: 'notifications', label: 'Thông báo' },
            { path: '/student/profile', icon: 'settings', label: 'Cài đặt tài khoản' },
        ],
    },
    LECTURER: {
        label: 'Hệ thống Giảng viên',
        basePath: '/lecturer',
        items: [
            { path: '/lecturer/dashboard', icon: 'dashboard', label: 'Tổng quan' },
            { path: '/lecturer/topics', icon: 'folder_open', label: 'Đề tài của tôi' },
            { path: '/lecturer/approvals', icon: 'fact_check', label: 'Duyệt đề tài' },
            { path: '/lecturer/progress', icon: 'trending_up', label: 'Theo dõi tiến độ' },
            { path: '/lecturer/grading', icon: 'rate_review', label: 'Chấm điểm' },
        ],
        bottomItems: [
            { path: '/lecturer/notifications', icon: 'notifications', label: 'Thông báo' },
            { path: '/lecturer/profile', icon: 'settings', label: 'Cài đặt tài khoản' },
        ],
    },
    ADMIN: {
        label: 'Quản trị Hệ thống',
        basePath: '/admin',
        items: [
            { path: '/admin/dashboard', icon: 'dashboard', label: 'Tổng quan' },
            { path: '/admin/users', icon: 'group', label: 'Người dùng' },
            { path: '/admin/project-periods', icon: 'calendar_month', label: 'Đợt đồ án' },
            { path: '/admin/topics', icon: 'description', label: 'Đề tài' },
            { path: '/admin/oversight', icon: 'policy', label: 'Giám sát Đề tài' },
            { path: '/admin/grading', icon: 'workspace_premium', label: 'Điểm & Bảo vệ' },
        ],
        bottomItems: [
            { path: '/admin/notifications', icon: 'campaign', label: 'Trung tâm Thông báo' },
            { path: '/admin/profile', icon: 'settings', label: 'Cài đặt' },
        ],
    },
};

function AppLayout({ role }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();

    const config = NAV_CONFIG[role] || NAV_CONFIG.STUDENT;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

    const roleLabel = role === 'ADMIN' ? 'Quản trị viên' : role === 'LECTURER' ? 'Giảng viên' : 'Sinh viên';

    return (
        <div className="flex min-h-screen bg-[#f5f7f8]">
            {/* ───── Sidebar ───── */}
            <aside className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-white shrink-0 fixed inset-y-0 left-0 z-20">
                {/* Logo */}
                <div className="p-6 flex items-center gap-3 border-b border-slate-100">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white shrink-0">
                        <span className="material-symbols-outlined">school</span>
                    </div>
                    <div>
                        <h1 className="font-bold text-sm text-primary leading-tight">Viện Công nghệ Số</h1>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Hệ thống quản lý</p>
                    </div>
                </div>

                {/* Main Nav */}
                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                    <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">{config.label}</p>
                    {config.items.map((item) => (
                        <a
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                                isActive(item.path)
                                    ? 'bg-primary/10 text-primary font-semibold'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-primary'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                            <span className="text-sm">{item.label}</span>
                        </a>
                    ))}

                    {/* Bottom items separated */}
                    <div className="pt-4 mt-6 border-t border-slate-100">
                        {config.bottomItems.map((item) => (
                            <a
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                                    isActive(item.path)
                                        ? 'bg-primary/10 text-primary font-semibold'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-primary'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                <span className="text-sm">{item.label}</span>
                            </a>
                        ))}
                    </div>
                </nav>

                {/* Logout Button */}
                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-red-50 hover:text-red-600 transition-all"
                    >
                        <span className="material-symbols-outlined text-[18px]">logout</span>
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            {/* ───── Main Content Area ───── */}
            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                {/* Header */}
                <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">search</span>
                        <input
                            className="border-none bg-transparent focus:ring-0 text-sm w-48 lg:w-64 outline-none"
                            placeholder="Tìm kiếm đồ án, sinh viên..."
                            type="text"
                        />
                    </div>
                    <div className="flex items-center gap-6">
                        <button
                            className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                            onClick={() => navigate(`${config.basePath}/notifications`)}
                        >
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
                        </button>
                        <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold leading-none">{user?.fullName || user?.name || roleLabel}</p>
                                <p className="text-[11px] text-slate-500 mt-1">{roleLabel}</p>
                            </div>
                            <div
                                className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-colors"
                                onClick={() => navigate(`${config.basePath}/profile`)}
                            >
                                <span className="text-primary font-bold text-sm">
                                    {(user?.fullName || user?.name || roleLabel)?.[0]?.toUpperCase() || 'U'}
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="p-4 lg:p-8 overflow-y-auto flex-1">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* ───── Mobile Bottom Nav ───── */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex items-center justify-around px-2 py-2 z-30">
                {config.items.slice(0, 5).map((item) => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors ${
                            isActive(item.path) ? 'text-primary' : 'text-slate-400'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                        <span className="text-[10px] font-medium">{item.label.split(' ').slice(0, 2).join(' ')}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
}

export default AppLayout;
