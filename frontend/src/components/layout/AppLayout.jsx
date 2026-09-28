import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Dropdown } from 'antd';
import { LogoutOutlined, UserOutlined, SettingOutlined } from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';

// Mapping role -> nav items + role label
const NAV_CONFIG = {
    STUDENT: {
        label: 'Hệ thống Sinh viên',
        basePath: '/student',
        sections: [
            {
                title: 'TỔNG QUAN',
                items: [
                    { path: '/student/dashboard', icon: 'dashboard', label: 'Tổng quan cá nhân' },
                ],
            },
            {
                title: 'KHÓA LUẬN & ĐỒ ÁN',
                items: [
                    { path: '/student/topics', icon: 'list_alt', label: 'Danh sách đề tài' },
                    { path: '/student/submissions', icon: 'cloud_upload', label: 'Tiến độ & Nộp bài' },
                    { path: '/student/grades', icon: 'workspace_premium', label: 'Kết quả bảo vệ' },
                ],
            },
        ],
        bottomItems: [
            { path: '/student/notifications', icon: 'notifications', label: 'Thông báo' },
            { path: '/student/profile', icon: 'settings', label: 'Cài đặt tài khoản' },
        ],
    },
    LECTURER: {
        label: 'Hệ thống Giảng viên',
        basePath: '/lecturer',
        sections: [
            {
                title: 'TỔNG QUAN',
                items: [
                    { path: '/lecturer/dashboard', icon: 'dashboard', label: 'Bảng điều khiển' },
                ],
            },
            {
                title: 'HƯỚNG DẪN & ĐỀ TÀI',
                items: [
                    { path: '/lecturer/topics', icon: 'folder_open', label: 'Đề tài của tôi' },
                    { path: '/lecturer/approvals', icon: 'fact_check', label: 'Phê duyệt sinh viên' },
                    { path: '/lecturer/progress', icon: 'trending_up', label: 'Theo dõi tiến độ' },
                ],
            },
            {
                title: 'HỘI ĐỒNG & CHẤM ĐIỂM',
                items: [
                    { path: '/lecturer/grading', icon: 'rate_review', label: 'Hội đồng chấm điểm' },
                ],
            },
        ],
        bottomItems: [
            { path: '/lecturer/notifications', icon: 'notifications', label: 'Thông báo' },
            { path: '/lecturer/profile', icon: 'settings', label: 'Cài đặt tài khoản' },
        ],
        instituteItems: [
            { path: '/lecturer/institute', icon: 'account_balance', label: 'Quản lý Viện' },
        ],
    },
    ADMIN: {
        label: 'Quản trị Hệ thống',
        basePath: '/admin',
        sections: [
            {
                title: 'TỔNG QUAN',
                items: [
                    { path: '/admin/dashboard', icon: 'dashboard', label: 'Tổng quan hệ thống' },
                ],
            },
            {
                title: 'ĐÀO TẠO & ĐỀ TÀI',
                items: [
                    { path: '/admin/project-periods', icon: 'calendar_month', label: 'Đợt làm đồ án' },
                    { path: '/admin/project-enrollments', icon: 'playlist_add_check', label: 'Gán môn đồ án' },
                    { path: '/admin/topics', icon: 'description', label: 'Quản lý đề tài' },
                    { path: '/admin/oversight', icon: 'policy', label: 'Giám sát tiến độ & BM' },
                ],
            },
            {
                title: 'HỘI ĐỒNG & ĐÁNH GIÁ',
                items: [
                    { path: '/admin/councils', icon: 'groups', label: 'Phân công Hội đồng' },
                    { path: '/admin/grading', icon: 'rate_review', label: 'Trung tâm Chấm bảo vệ' },
                ],
            },
            {
                title: 'QUẢN TRỊ HỆ THỐNG',
                items: [
                    { path: '/admin/users', icon: 'group', label: 'Quản lý người dùng' },
                    { path: '/admin/permissions', icon: 'shield_lock', label: 'Quản lý phân quyền' },
                    { path: '/admin/announcements', icon: 'campaign', label: 'Quản lý thông báo' },
                    { path: '/admin/notifications', icon: 'send', label: 'Trung tâm Gửi tin' },
                ],
            },
        ],
        bottomItems: [
            { path: '/admin/profile', icon: 'settings', label: 'Cài đặt tài khoản' },
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

    // Flatten all items for mobile nav
    const allNavItems = config.sections
        ? config.sections.flatMap((sec) => sec.items)
        : (config.items || []);

    const userMenuItems = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'Thông tin cá nhân',
            onClick: () => navigate(`${config.basePath}/profile`),
        },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Cài đặt tài khoản',
            onClick: () => navigate(`${config.basePath}/profile`),
        },
        {
            type: 'divider',
        },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            danger: true,
            label: 'Đăng xuất',
            onClick: handleLogout,
        },
    ];

    return (
        <div className="flex min-h-screen bg-[#F8FAFC]">
            {/* Sidebar */}
            <aside className="hidden md:flex w-64 flex-col border-r border-slate-200/80 bg-white shrink-0 fixed inset-y-0 left-0 z-20 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
                {/* Logo & Institution Brand */}
                <div className="p-5 flex items-center gap-3 border-b border-slate-100 bg-white">
                    <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
                        <span className="material-symbols-outlined text-[22px]">school</span>
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-bold text-sm text-[#1E3A5F] leading-tight truncate">
                            Viện Công nghệ Số
                        </h1>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                            TDMU Thesis Portal
                        </p>
                    </div>
                </div>

                {/* Main Nav */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                    {config.sections ? (
                        config.sections.map((section, sIdx) => (
                            <div key={sIdx} className="mb-4">
                                <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                    {section.title}
                                </p>
                                <div className="space-y-0.5">
                                    {section.items.map((item) => {
                                        const active = isActive(item.path);
                                        return (
                                            <a
                                                key={item.path}
                                                onClick={() => navigate(item.path)}
                                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 cursor-pointer ${
                                                    active
                                                        ? 'bg-[#1E3A5F]/10 text-[#1E3A5F] font-bold border-l-4 border-[#1E3A5F] pl-2'
                                                        : 'text-slate-600 hover:bg-slate-50 hover:text-[#1E3A5F] font-medium'
                                                }`}
                                            >
                                                <span className={`material-symbols-outlined text-[19px] ${active ? 'text-[#1E3A5F]' : 'text-slate-400'}`}>
                                                    {item.icon}
                                                </span>
                                                <span className="truncate">{item.label}</span>
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    ) : (
                        <>
                            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                                {config.label}
                            </p>
                            <div className="space-y-0.5">
                                {config.items.map((item) => {
                                    const active = isActive(item.path);
                                    return (
                                        <a
                                            key={item.path}
                                            onClick={() => navigate(item.path)}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer ${
                                                active
                                                    ? 'bg-primary/10 text-primary font-bold border-l-4 border-primary pl-2'
                                                    : 'text-slate-600 hover:bg-slate-50 hover:text-primary font-medium'
                                            }`}
                                        >
                                            <span className={`material-symbols-outlined text-[20px] ${active ? 'text-primary' : 'text-slate-400'}`}>
                                                {item.icon}
                                            </span>
                                            <span className="truncate">{item.label}</span>
                                        </a>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {config.instituteItems && user?.permissionGroups?.includes('VIEN_TRUONG') && (
                        <div className="mt-4 pt-3 border-t border-slate-100">
                            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                Quản lý Viện
                            </p>
                            <div className="space-y-0.5">
                                {config.instituteItems.map((item) => {
                                    const active = isActive(item.path);
                                    return (
                                        <a
                                            key={item.path}
                                            onClick={() => navigate(item.path)}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 cursor-pointer ${
                                                active
                                                    ? 'bg-primary/10 text-primary font-bold border-l-4 border-primary pl-2'
                                                    : 'text-slate-600 hover:bg-slate-50 hover:text-primary font-medium'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-[19px]">{item.icon}</span>
                                            <span className="truncate">{item.label}</span>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Bottom Settings Items */}
                    {config.bottomItems && config.bottomItems.length > 0 && (
                        <div className="pt-3 mt-4 border-t border-slate-100">
                            {config.bottomItems.map((item) => {
                                const active = isActive(item.path);
                                return (
                                    <a
                                        key={item.path}
                                        onClick={() => navigate(item.path)}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 cursor-pointer ${
                                            active
                                                ? 'bg-primary/10 text-primary font-bold'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-primary font-medium'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-[19px] text-slate-400">
                                            {item.icon}
                                        </span>
                                        <span className="truncate">{item.label}</span>
                                    </a>
                                );
                            })}
                        </div>
                    )}
                </nav>

                {/* Sidebar Footer Logout */}
                <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center justify-center gap-2 px-3 py-2 bg-white text-slate-700 border border-slate-200/80 rounded-lg text-xs font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all duration-150"
                    >
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                {/* Top Navbar Header */}
                <header className="h-16 border-b border-slate-200/80 bg-white/95 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/80 text-xs font-medium text-slate-600">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">account_balance</span>
                            <span>Trường Đại học Thủ Dầu Một</span>
                            <span className="text-slate-300">•</span>
                            <span className="font-semibold text-slate-800">{roleLabel}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                            onClick={() => navigate(`${config.basePath}/notifications`)}
                            title="Thông báo hệ thống"
                        >
                            <span className="material-symbols-outlined text-[20px]">notifications</span>
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
                        </button>

                        <div className="h-5 w-px bg-slate-200"></div>

                        {/* User Profile Dropdown */}
                        <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
                            <div className="flex items-center gap-3 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs font-bold text-slate-800 leading-tight">
                                        {user?.fullName || user?.name || roleLabel}
                                    </p>
                                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                                        {user?.code ? `Mã: ${user.code}` : roleLabel}
                                    </p>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                    {(user?.fullName || user?.name || roleLabel)?.[0]?.toUpperCase() || 'U'}
                                </div>
                            </div>
                        </Dropdown>
                    </div>
                </header>

                {/* Page Content */}
                <main className="p-4 lg:p-8 overflow-y-auto flex-1">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex items-center justify-around px-2 py-2 z-30 shadow-lg">
                {allNavItems.slice(0, 5).map((item) => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors ${
                            isActive(item.path) ? 'text-[#1E3A5F] font-bold' : 'text-slate-400'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                        <span className="text-[10px] truncate max-w-[64px]">{item.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
}

export default AppLayout;
