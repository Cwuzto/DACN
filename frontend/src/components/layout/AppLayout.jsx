import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import authService from '../../services/authService';
import { semesterService } from '../../services/semesterService';
import { getClosestSemester } from '../../utils/semesterDisplay';
import registrationService from '../../services/registrationService';
import NavIcon from './NavIcon';
import OpenDrawer from '../common/OpenDrawer';
import QuotaMeter from '../common/QuotaMeter';

// Mapping role -> nav items + role label
const NAV_CONFIG = {
    STUDENT: {
        label: 'Cổng Sinh viên',
        portalTitle: 'Cổng Sinh viên',
        basePath: '/student',
        sections: [
            {
                title: 'TỔNG QUAN',
                items: [
                    { path: '/student/dashboard', icon: 'dashboard', label: 'Bàn làm việc sinh viên' },
                ],
            },
            {
                title: 'KHÓA LUẬN & ĐỒ ÁN',
                items: [
                    { path: '/student/topics', icon: 'list_alt', label: 'Danh mục đề tài' },
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
        portalTitle: 'Cổng Giảng viên',
        basePath: '/lecturer',
        sections: [
            {
                title: 'TỔNG QUAN',
                items: [
                    { path: '/lecturer/dashboard', icon: 'dashboard', label: 'Bàn làm việc giảng viên', permissions: ['BM03_REVIEW'] },
                ],
            },
            {
                title: 'HƯỚNG DẪN & ĐỀ TÀI',
                items: [
                    { path: '/lecturer/topics', icon: 'folder_open', label: 'Đề tài của tôi', permissions: ['TOPIC_CREATE', 'TOPIC_UPDATE_OWN'] },
                    { path: '/lecturer/approvals', icon: 'fact_check', label: 'Phê duyệt sinh viên', permissions: ['MENTOR_REQUEST_REVIEW', 'OUTLINE_REVIEW'] },
                    { path: '/lecturer/progress', icon: 'trending_up', label: 'Theo dõi tiến độ BM', permissions: ['BM03_REVIEW'] },
                ],
            },
            {
                title: 'HỘI ĐỒNG & CHẤM ĐIỂM',
                items: [
                    { path: '/lecturer/grading', icon: 'rate_review', label: 'Hội đồng chấm điểm', permissions: ['DEFENSE_SCORE_VIEW'] },
                ],
            },
        ],
        bottomItems: [
            { path: '/lecturer/notifications', icon: 'notifications', label: 'Thông báo' },
            { path: '/lecturer/profile', icon: 'settings', label: 'Cài đặt tài khoản' },
        ],
        instituteItems: [
            { path: '/lecturer/institute', icon: 'account_balance', label: 'Quản lý Viện & Ban hành QĐ' },
        ],
    },
    ADMIN: {
        label: 'Quản trị Hệ thống',
        portalTitle: 'Quản trị Hệ thống',
        basePath: '/admin',
        sections: [
            {
                title: 'TỔNG QUAN',
                items: [
                    { path: '/admin/dashboard', icon: 'dashboard', label: 'Tổng quan hệ thống', permissions: ['REPORT_VIEW'] },
                ],
            },
            {
                title: 'ĐÀO TẠO & ĐỀ TÀI',
                items: [
                    { path: '/admin/project-periods', icon: 'calendar_month', label: 'Đợt đồ án', permissions: ['SEMESTER_MANAGE'] },
                    { path: '/admin/project-enrollments', icon: 'playlist_add_check', label: 'Gán môn đồ án', permissions: ['ENROLLMENT_MANAGE', 'PROJECT_CATALOG_MANAGE'] },
                    { path: '/admin/topics', icon: 'description', label: 'Quản lý đề tài' },
                    { path: '/admin/oversight', icon: 'policy', label: 'Giám sát tiến độ & BM', permissions: ['REPORT_VIEW', 'LEGACY_REVIEW_MANAGE'] },
                ],
            },
            {
                title: 'HỘI ĐỒNG & ĐÁNH GIÁ',
                items: [
                    { path: '/admin/councils', icon: 'groups', label: 'Phân công Hội đồng', permissions: ['OUTLINE_COUNCIL_MANAGE', 'DEFENSE_COUNCIL_MANAGE'], permissionMode: 'any' },
                    { path: '/admin/grading', icon: 'rate_review', label: 'Trung tâm Chấm bảo vệ', permissions: ['DEFENSE_SCORE_VIEW'] },
                    { path: '/admin/rubric-management', icon: 'rule', label: 'Tiêu chí chấm (Rubric)', permissions: ['RUBRIC_MANAGE'] },
                ],
            },
            {
                title: 'QUẢN TRỊ HỆ THỐNG',
                items: [
                    { path: '/admin/users', icon: 'group', label: 'Quản lý người dùng', permissions: ['USER_MANAGE', 'PERMISSION_GROUP_MANAGE'] },
                    { path: '/admin/permissions', icon: 'shield_lock', label: 'Quản lý phân quyền', permissions: ['PERMISSION_GROUP_MANAGE'] },
                    { path: '/admin/announcements', icon: 'campaign', label: 'Quản lý thông báo', permissions: ['PUBLIC_ANNOUNCEMENT_MANAGE'] },
                    { path: '/admin/notifications', icon: 'send', label: 'Trung tâm Gửi tin', permissions: ['NOTIFICATION_MANAGE'] },
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
    const { user, logout, updateUser } = useAuthStore();
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem('sidebar_collapsed') === 'true';
        } catch {
            return false;
        }
    });

    const [currentSemester, setCurrentSemester] = useState(null);
    const [lecturerStudentCount, setLecturerStudentCount] = useState(0);

    const toggleCollapse = () => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('sidebar_collapsed', String(next));
            } catch {}
            return next;
        });
    };

    useEffect(() => {
        let isMounted = true;
        authService
            .getMe()
            .then((res) => {
                if (isMounted && res?.success && res?.data) {
                    updateUser(res.data);
                }
            })
            .catch(() => {});
        return () => {
            isMounted = false;
        };
    }, [updateUser]);

    useEffect(() => {
        let isMounted = true;
        semesterService
            .getAll()
            .then((res) => {
                if (isMounted && res?.success && Array.isArray(res.data)) {
                    const active = res.data.find((s) => s.isActive || s.status === 'ACTIVE');
                    const chosen = active || getClosestSemester(res.data) || res.data[0];
                    setCurrentSemester(chosen);
                }
            })
            .catch(() => {});

        if (role === 'LECTURER') {
            registrationService
                .getAllRegistrations()
                .then((res) => {
                    if (isMounted && res?.success && Array.isArray(res.data)) {
                        const myCount = res.data.filter(
                            (r) =>
                                (r.topic?.lecturerId === user?.id || r.topic?.lecturer?.id === user?.id) &&
                                !['REJECTED', 'DROPPED', 'WITHDRAWN'].includes(r.status)
                        ).length;
                        setLecturerStudentCount(myCount);
                    }
                })
                .catch(() => {});
        }

        return () => {
            isMounted = false;
        };
    }, [role, user?.id]);

    const config = NAV_CONFIG[role] || NAV_CONFIG.STUDENT;
    const permissionSet = useMemo(() => new Set(user?.permissions || []), [user?.permissions]);
    const visibleSections = useMemo(() => config.sections
        .map((section) => ({
            ...section,
            items: section.items.filter((item) => (
                !item.permissions || (
                    item.permissionMode === 'any'
                        ? item.permissions.some((permission) => permissionSet.has(permission))
                        : item.permissions.every((permission) => permissionSet.has(permission))
                )
            )),
        }))
        .filter((section) => section.items.length > 0), [config, permissionSet]);
    const isVienTruong = permissionSet.has('PROJECT_ASSIGNMENT_PUBLISH');

    const handleLogout = () => {
        logout();
        navigate('/', { replace: true });
    };

    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

    const roleLabel = role === 'ADMIN' ? 'Quản trị viên' : role === 'LECTURER' ? 'Giảng viên' : 'Sinh viên';
    const initials = (user?.fullName || user?.name || roleLabel)?.[0]?.toUpperCase() || 'U';

    const handleNavigate = (path) => {
        navigate(path);
        setMobileDrawerOpen(false);
    };

    // Shared Navigation Content
    const NavContent = ({ isSidebarCollapsed = false }) => (
        <div className="flex flex-col h-full bg-white select-none">
            {/* Brand Header: Only Logo */}
            <div className="brand-header flex items-center justify-between px-4 py-3">
                <div className="flex items-center overflow-hidden">
                    <img
                        src="https://aanqmscxckeejuhvaezm.supabase.co/storage/v1/object/public/dacn/branding/tdmu-logo.svg"
                        alt="Đại học Thủ Dầu Một"
                        className={isSidebarCollapsed ? "w-9 h-9 object-contain" : "h-9 w-auto object-contain max-w-[140px]"}
                        onError={(e) => {
                            e.currentTarget.src = '/assets/tdmu-logo.svg';
                        }}
                    />
                </div>
                <button
                    className="sidebar-toggle"
                    type="button"
                    onClick={toggleCollapse}
                    aria-label={isSidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
                    title={isSidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>
            </div>

            {/* Profile Chip */}
            {!isSidebarCollapsed && (
                <div className={role === 'LECTURER' ? 'lecturer-chip' : 'user-chip'}>
                    <div className={role === 'LECTURER' ? 'lecturer-avatar' : 'user-avatar'}>
                        {initials}
                    </div>
                    <div className={role === 'LECTURER' ? 'lecturer-info' : 'user-info'}>
                        <div className={role === 'LECTURER' ? 'lecturer-name' : 'user-name'}>
                            {user?.fullName || user?.name || roleLabel}
                        </div>
                        <div className={role === 'LECTURER' ? 'lecturer-dept' : 'user-dept'}>
                            {user?.code ? `Mã: ${user.code}` : (role === 'ADMIN' ? 'Ban Quản trị Viện' : 'Khoa Công nghệ Phần mềm')}
                        </div>
                    </div>
                </div>
            )}

            {/* Quota Widget (Lecturer quota meter) */}
            {role === 'LECTURER' && !isSidebarCollapsed && (
                <div className="px-4 py-2">
                    <QuotaMeter
                        current={lecturerStudentCount}
                        max={10}
                        label="Chỉ tiêu hướng dẫn"
                        showPercentage={true}
                    />
                </div>
            )}

            {/* Navigation List */}
            <ul className="nav-list">
                {visibleSections.map((section) => (
                    <li key={section.title} className="space-y-1">
                        {!isSidebarCollapsed && (
                            <div className="nav-section-title">{section.title}</div>
                        )}
                        <div className="space-y-0.5">
                            {section.items.map((item) => {
                                const active = isActive(item.path);
                                return (
                                    <button
                                        key={item.path}
                                        type="button"
                                        onClick={() => handleNavigate(item.path)}
                                        className={`nav-item ${active ? 'active' : ''}`}
                                        title={isSidebarCollapsed ? item.label : undefined}
                                    >
                                        <span className="nav-left">
                                            <NavIcon name={item.icon} />
                                            {!isSidebarCollapsed && <span>{item.label}</span>}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </li>
                ))}

                {/* Institute Extra Section */}
                {config.instituteItems && isVienTruong && (
                    <li className="space-y-1 pt-2 border-t border-slate-100">
                        {!isSidebarCollapsed && (
                            <div className="nav-section-title">QUẢN LÝ VIỆN</div>
                        )}
                        {config.instituteItems.map((item) => {
                            const active = isActive(item.path);
                            return (
                                <button
                                    key={item.path}
                                    type="button"
                                    onClick={() => handleNavigate(item.path)}
                                    className={`nav-item ${active ? 'active' : ''}`}
                                    title={isSidebarCollapsed ? item.label : undefined}
                                >
                                    <span className="nav-left">
                                        <NavIcon name={item.icon} />
                                        {!isSidebarCollapsed && <span>{item.label}</span>}
                                    </span>
                                </button>
                            );
                        })}
                    </li>
                )}

                {/* Bottom Items */}
                {config.bottomItems && config.bottomItems.length > 0 && (
                    <li className="space-y-1 pt-2 border-t border-slate-100">
                        {config.bottomItems.map((item) => {
                            const active = isActive(item.path);
                            return (
                                <button
                                    key={item.path}
                                    type="button"
                                    onClick={() => handleNavigate(item.path)}
                                    className={`nav-item ${active ? 'active' : ''}`}
                                    title={isSidebarCollapsed ? item.label : undefined}
                                >
                                    <span className="nav-left">
                                        <NavIcon name={item.icon} />
                                        {!isSidebarCollapsed && <span>{item.label}</span>}
                                    </span>
                                </button>
                            );
                        })}
                    </li>
                )}
            </ul>

            {/* Sidebar Footer with Only Logout */}
            <div className="sidebar-footer">
                <button
                    type="button"
                    onClick={handleLogout}
                    className="switch-link danger"
                    title="Đăng xuất khỏi hệ thống"
                >
                    <NavIcon name="logout" size={14} />
                    {!isSidebarCollapsed && <span>Đăng xuất</span>}
                </button>
            </div>
        </div>
    );

    return (
        <div className="app-layout">
            {/* Desktop Fixed OpenDesign Sidebar */}
            <aside className={`sidebar hidden lg:flex ${collapsed ? 'is-collapsed' : ''}`}>
                <NavContent isSidebarCollapsed={collapsed} />
            </aside>

            {/* Mobile Sliding OpenDrawer */}
            <OpenDrawer
                open={mobileDrawerOpen}
                onClose={() => setMobileDrawerOpen(false)}
                placement="left"
                width="280px"
                ariaLabel="Menu điều hướng"
            >
                <NavContent isSidebarCollapsed={false} />
            </OpenDrawer>

            {/* Main Application Area */}
            <div className="main-wrapper">
                {/* Topbar Header */}
                <header className="topbar">
                    <div className="topbar-left">
                        {/* Institutional Period Badge */}
                        <div className="period-badge">
                            <span className="period-dot"></span>
                            <span>{currentSemester?.name || 'Học kỳ 1 (2026 - 2027)'} · Đang diễn ra</span>
                        </div>

                        <span className="hidden sm:inline" style={{ color: 'var(--border)' }}>|</span>
                        <span className="hidden md:inline" style={{ fontSize: '13px', color: 'var(--muted)' }}>
                            Vai trò: <strong style={{ color: 'var(--fg)' }}>{roleLabel}</strong>
                        </span>
                    </div>

                    <div className="topbar-right">
                        {/* Quick Actions depending on role */}
                        {role === 'LECTURER' && (
                            <button
                                type="button"
                                className="btn btn-primary btn-sm hidden sm:inline-flex"
                                onClick={() => navigate('/lecturer/topics')}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                <span>Đề xuất Đề tài</span>
                            </button>
                        )}

                        {role === 'ADMIN' && (
                            <button
                                type="button"
                                className="btn btn-primary btn-sm hidden sm:inline-flex"
                                onClick={() => navigate('/admin/project-periods')}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                <span>Đợt Đồ án</span>
                            </button>
                        )}

                        {/* Notifications Quick Link */}
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(`${config.basePath}/notifications`)}
                            title="Thông báo hệ thống"
                        >
                            <NavIcon name="notifications" size={16} />
                            <span className="hidden md:inline">Thông báo</span>
                        </button>

                        {/* User Profile Quick Trigger */}
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(`${config.basePath}/profile`)}
                            title="Thông tin tài khoản"
                        >
                            <div className="w-5 h-5 rounded bg-[#0F766E] text-white flex items-center justify-center font-bold text-[10px]">
                                {initials}
                            </div>
                            <span className="hidden md:inline font-semibold">
                                {user?.fullName || user?.name || roleLabel}
                            </span>
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="main-area">
                    <div className="content-container">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

export default AppLayout;
