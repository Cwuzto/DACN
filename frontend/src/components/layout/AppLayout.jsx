import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Dropdown, Drawer, Badge, Button } from 'antd';
import {
    LogoutOutlined,
    UserOutlined,
    SettingOutlined,
    MenuOutlined,
    BellOutlined,
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';

// Mapping role -> nav items + role label
const NAV_CONFIG = {
    STUDENT: {
        label: 'Cổng Sinh viên',
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
        label: 'Cổng Giảng viên',
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
                    { path: '/lecturer/progress', icon: 'trending_up', label: 'Theo dõi tiến độ BM' },
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
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

    const config = NAV_CONFIG[role] || NAV_CONFIG.STUDENT;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

    const roleLabel = role === 'ADMIN' ? 'Quản trị viên' : role === 'LECTURER' ? 'Giảng viên' : 'Sinh viên';

    const handleNavigate = (path) => {
        navigate(path);
        setMobileDrawerOpen(false);
    };

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

    // Navigation Menu Content Component (shared by desktop sidebar & mobile drawer)
    const NavContent = () => (
        <div className="flex flex-col h-full bg-white select-none">
            {/* Institutional Brand Header */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#0F766E] text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                    <span className="material-symbols-outlined text-[20px]">school</span>
                </div>
                <div className="min-w-0">
                    <h2 className="font-bold text-sm text-slate-900 leading-tight truncate">
                        Viện Công nghệ Số
                    </h2>
                    <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider truncate">
                        TDMU THESIS PORTAL
                    </p>
                </div>
            </div>

            {/* Menu Links */}
            <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
                {config.sections ? (
                    config.sections.map((section, sIdx) => (
                        <div key={sIdx} className="space-y-1">
                            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                {section.title}
                            </p>
                            <div className="space-y-0.5">
                                {section.items.map((item) => {
                                    const active = isActive(item.path);
                                    return (
                                        <button
                                            key={item.path}
                                            onClick={() => handleNavigate(item.path)}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all text-left ${
                                                active
                                                    ? 'bg-[#F0FDFA] text-[#0F766E] font-semibold border-r-2 border-[#0F766E]'
                                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                        >
                                            <span className={`material-symbols-outlined text-[18px] ${active ? 'text-[#0F766E]' : 'text-slate-400'}`}>
                                                {item.icon}
                                            </span>
                                            <span className="truncate">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="space-y-1">
                        {config.items?.map((item) => {
                            const active = isActive(item.path);
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => handleNavigate(item.path)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all text-left ${
                                        active
                                            ? 'bg-[#F0FDFA] text-[#0F766E] font-semibold border-r-2 border-[#0F766E]'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                >
                                    <span className={`material-symbols-outlined text-[18px] ${active ? 'text-[#0F766E]' : 'text-slate-400'}`}>
                                        {item.icon}
                                    </span>
                                    <span className="truncate">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Institute Extra Items */}
                {config.instituteItems && user?.permissionGroups?.includes('VIEN_TRUONG') && (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                        <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Quản lý Viện
                        </p>
                        {config.instituteItems.map((item) => {
                            const active = isActive(item.path);
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => handleNavigate(item.path)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all text-left ${
                                        active
                                            ? 'bg-[#F0FDFA] text-[#0F766E] font-semibold border-r-2 border-[#0F766E]'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                                    <span className="truncate">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Bottom Items */}
                {config.bottomItems && config.bottomItems.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                        {config.bottomItems.map((item) => {
                            const active = isActive(item.path);
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => handleNavigate(item.path)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all text-left ${
                                        active
                                            ? 'bg-[#F0FDFA] text-[#0F766E] font-semibold'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[18px] text-slate-400">
                                        {item.icon}
                                    </span>
                                    <span className="truncate">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </nav>

            {/* Sidebar Bottom Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2 px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-md text-xs font-medium hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-all"
                >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Đăng xuất</span>
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen bg-[#F4F6F8]">
            {/* Desktop Fixed Sidebar (width 256px) */}
            <aside className="hidden lg:flex w-64 flex-col border-r border-slate-200/80 bg-white shrink-0 fixed inset-y-0 left-0 z-20 shadow-[1px_0_3px_rgba(0,0,0,0.02)]">
                <NavContent />
            </aside>

            {/* Mobile / Tablet Ant Design Drawer (solves the 5-item cutoff bug) */}
            <Drawer
                placement="left"
                onClose={() => setMobileDrawerOpen(false)}
                open={mobileDrawerOpen}
                styles={{ body: { padding: 0 } }}
                width={280}
            >
                <NavContent />
            </Drawer>

            {/* Main Workspace Layout */}
            <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
                {/* Clean Nordic Header (height 56px) */}
                <header className="h-14 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    {/* Left: Mobile Toggle & Institutional breadcrumb indicator */}
                    <div className="flex items-center gap-3">
                        <Button
                            type="text"
                            icon={<MenuOutlined />}
                            onClick={() => setMobileDrawerOpen(true)}
                            className="lg:hidden text-slate-600 hover:text-[#0F766E]"
                            title="Mở menu điều hướng"
                        />
                        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-600">
                            <span className="text-slate-400">ĐH Thủ Dầu Một</span>
                            <span className="text-slate-300">/</span>
                            <span className="font-semibold text-slate-800">{roleLabel}</span>
                        </div>
                    </div>

                    {/* Right: Notification Bell & Profile dropdown */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(`${config.basePath}/notifications`)}
                            className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                            title="Thông báo hệ thống"
                        >
                            <BellOutlined className="text-[17px]" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#BE123C] rounded-full ring-2 ring-white"></span>
                        </button>

                        <div className="h-4 w-px bg-slate-200"></div>

                        {/* User Profile Dropdown */}
                        <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
                            <div className="flex items-center gap-2.5 cursor-pointer py-1 px-1.5 rounded-md hover:bg-slate-50 transition-colors">
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs font-semibold text-slate-800 leading-tight">
                                        {user?.fullName || user?.name || roleLabel}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        {user?.code ? `Mã: ${user.code}` : roleLabel}
                                    </p>
                                </div>
                                <div className="w-8 h-8 rounded-md bg-[#0F766E] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                    {(user?.fullName || user?.name || roleLabel)?.[0]?.toUpperCase() || 'U'}
                                </div>
                            </div>
                        </Dropdown>
                    </div>
                </header>

                {/* Page Content Container with Clean Nordic Spacing */}
                <main className="p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

export default AppLayout;
