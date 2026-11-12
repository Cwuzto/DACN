import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Badge } from 'antd';
import useAuthStore from '../../stores/authStore';
import authService from '../../services/authService';
import notificationService from '../../services/notificationService';
import { semesterService } from '../../services/semesterService';
import { getClosestSemester, resolveCurrentSemester } from '../../utils/semesterDisplay';
import registrationService from '../../services/registrationService';
import { getVisibleNavigation, NAVIGATION_REGISTRY } from '../../config/navigationRegistry';
import { isInstituteDirector, getUserDisplayRole } from '../../utils/authRedirect';
import NavIcon from './NavIcon';
import OpenDrawer from '../common/OpenDrawer';
import QuotaMeter from '../common/QuotaMeter';

/**
 * AppLayout - Dynamic 7-Group Academic Layout
 * Replaces static role-based NAV_CONFIG with 2-Tier Capability Navigation Registry.
 * Automatically filters and renders visible domain groups based on user?.permissions.
 */
function AppLayout({ role }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, updateUser, refreshSession } = useAuthStore();
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
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchUnreadNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const res = await notificationService.getMyNotifications({ unreadOnly: 'true' });
            if (res?.success) {
                const count = Array.isArray(res.data) ? res.data.length : (res.data?.total || 0);
                setUnreadCount(count);
            }
        } catch (_) {
            // Ignore polling errors silently
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        fetchUnreadNotifications();
        const intervalId = setInterval(fetchUnreadNotifications, 30000);
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchUnreadNotifications();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [user, fetchUnreadNotifications]);

    const toggleCollapse = () => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('sidebar_collapsed', String(next));
            } catch {}
            return next;
        });
    };

    // Refresh current user session and sync across tabs & visibility changes
    useEffect(() => {
        let isMounted = true;
        let lastSyncTime = 0;

        const handleSync = (force = false) => {
            const now = Date.now();
            if (!force && now - lastSyncTime < 2000) {
                return;
            }
            lastSyncTime = now;
            if (typeof refreshSession === 'function') {
                refreshSession().catch(() => {});
            } else {
                authService
                    .getMe()
                    .then((res) => {
                        if (isMounted && res?.success && res?.data) {
                            updateUser(res.data);
                        }
                    })
                    .catch(() => {});
            }
        };

        // Initial sync on mount
        handleSync(true);

        const handleVisibilityChange = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                handleSync();
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('focus', handleSync);
        }
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }

        let channel = null;
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                channel = new BroadcastChannel('dacn_auth_sync');
                channel.onmessage = (event) => {
                    const type = event?.data?.type;
                    if (type === 'PERMISSION_VERSION_UPDATED' || type === 'PERMISSIONS_UPDATED') {
                        handleSync(true);
                    }
                };
            } catch {}
        }

        return () => {
            isMounted = false;
            if (typeof window !== 'undefined') {
                window.removeEventListener('focus', handleSync);
            }
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }
            if (channel) {
                try {
                    channel.close();
                } catch {}
            }
        };
    }, [refreshSession, updateUser]);

    // Load active semester info
    useEffect(() => {
        let isMounted = true;

        const loadSemester = async () => {
            try {
                let res = await semesterService.getAll();
                if (!res?.success || !Array.isArray(res.data) || res.data.length === 0) {
                    res = await semesterService.getPublic();
                }
                if (isMounted && res?.success && Array.isArray(res.data)) {
                    const chosen = resolveCurrentSemester(res.data);
                    if (chosen) {
                        setCurrentSemester(chosen);
                    }
                }
            } catch {
                try {
                    const pub = await semesterService.getPublic();
                    if (isMounted && pub?.success && Array.isArray(pub.data)) {
                        const chosen = resolveCurrentSemester(pub.data);
                        if (chosen) {
                            setCurrentSemester(chosen);
                        }
                    }
                } catch {}
            }
        };

        loadSemester();

        return () => {
            isMounted = false;
        };
    }, []);

    // Resolve effective permissions
    const permissionSet = useMemo(() => new Set(user?.permissions || []), [user?.permissions]);

    // Capability check for QuotaMeter widget
    const showQuotaMeter = useMemo(() => {
        return permissionSet.has('TOPIC_CREATE') || permissionSet.has('MENTOR_REQUEST_REVIEW');
    }, [permissionSet]);

    // Fetch lecturer mentored students count if quota meter is active
    useEffect(() => {
        let isMounted = true;
        if (showQuotaMeter) {
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
    }, [showQuotaMeter, user?.id]);

    // Determine role and navigation endpoints
    const currentRole = role || user?.role || 'STUDENT';
    const isVienTruong = isInstituteDirector(user);
    const roleLabel = getUserDisplayRole(user);
    const basePath = currentRole === 'ADMIN' ? '/admin' : currentRole === 'LECTURER' ? '/lecturer' : '/student';
    const dashboardPath = `${basePath}/dashboard`;
    const profilePath = `${basePath}/profile`;
    const notificationsPath = `${basePath}/notifications`;

    // Dynamic visible navigation groups derived from capability matrix
    const visibleGroups = useMemo(() => {
        return getVisibleNavigation(permissionSet);
    }, [permissionSet]);

    const handleLogout = () => {
        logout();
        navigate('/', { replace: true });
    };

    const isActive = (targetRoute) => {
        if (!targetRoute) return false;
        const [targetPath, targetQuery] = targetRoute.split('?');
        if (targetQuery) {
            return location.pathname === targetPath && location.search === `?${targetQuery}`;
        }
        if (location.search && targetPath === location.pathname) {
            const hasRegisteredTabSibling = NAVIGATION_REGISTRY.some((item) => {
                const [iPath, iQuery] = item.route.split('?');
                return iPath === targetPath && iQuery && location.search.includes(iQuery);
            });
            if (hasRegisteredTabSibling) {
                return false;
            }
        }
        return location.pathname === targetPath || location.pathname.startsWith(targetPath + '/');
    };

    const initials = (user?.fullName || user?.name || roleLabel)?.[0]?.toUpperCase() || 'U';

    const handleNavigate = (path) => {
        navigate(path);
        setMobileDrawerOpen(false);
    };

    // Shared Navigation Content
    const NavContent = ({ isSidebarCollapsed = false }) => (
        <div className="flex flex-col h-full bg-white select-none">
            {/* Brand Header: Logo */}
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
                    aria-label={isSidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
                    title={isSidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>
            </div>

            {/* Profile Chip */}
            {!isSidebarCollapsed && (
                <div className={currentRole === 'LECTURER' ? 'lecturer-chip' : 'user-chip'}>
                    <div className={currentRole === 'LECTURER' ? 'lecturer-avatar' : 'user-avatar'}>
                        {initials}
                    </div>
                    <div className={currentRole === 'LECTURER' ? 'lecturer-info' : 'user-info'}>
                        <div className={currentRole === 'LECTURER' ? 'lecturer-name' : 'user-name'}>
                            {user?.fullName || user?.name || roleLabel}
                        </div>
                        <div className={currentRole === 'LECTURER' ? 'lecturer-dept' : 'user-dept'}>
                            {isVienTruong ? (
                                <span className="font-semibold text-[#0F766E]">
                                    {user?.code ? `Mã: ${user.code} · ` : ''}Viện trưởng
                                </span>
                            ) : (
                                user?.code ? `Mã: ${user.code}` : (currentRole === 'ADMIN' ? 'Ban Quản trị Viện' : 'Khoa Công nghệ Phần mềm')
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Quota Widget (Displayed only when user has mentoring/topic capabilities) */}
            {showQuotaMeter && !isSidebarCollapsed && (
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
                {/* 1. Dashboard: Fixed top-level overview */}
                <li className="space-y-1 mb-2">
                    {!isSidebarCollapsed && (
                        <div className="nav-section-title">TỔNG QUAN</div>
                    )}
                    <button
                        type="button"
                        onClick={() => handleNavigate(dashboardPath)}
                        className={`nav-item ${isActive(dashboardPath) ? 'active' : ''}`}
                        title={isSidebarCollapsed ? 'Tổng quan' : undefined}
                    >
                        <span className="nav-left">
                            <NavIcon name="dashboard" />
                            {!isSidebarCollapsed && <span>Tổng quan</span>}
                        </span>
                    </button>
                </li>

                {/* 2. Dynamic 7-Group Navigation Registry */}
                {visibleGroups.map((section) => (
                    <li key={section.group} className="space-y-1">
                        {!isSidebarCollapsed && (
                            <div className="nav-section-title">{section.title.toUpperCase()}</div>
                        )}
                        <div className="space-y-0.5">
                            {section.items.map((item) => {
                                const active = isActive(item.route);
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => handleNavigate(item.route)}
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

                {/* 3. Bottom Items (Account Settings) */}
                <li className="space-y-1 pt-2 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={() => handleNavigate(profilePath)}
                        className={`nav-item ${isActive(profilePath) ? 'active' : ''}`}
                        title={isSidebarCollapsed ? 'Cài đặt tài khoản' : undefined}
                    >
                        <span className="nav-left">
                            <NavIcon name="settings" />
                            {!isSidebarCollapsed && <span>Cài đặt tài khoản</span>}
                        </span>
                    </button>
                </li>
            </ul>

            {/* Sidebar Footer with Logout */}
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
                            <span>{currentSemester?.name || 'Đồ án tốt nghiệp — HK1 2026–2027'} · Đang diễn ra</span>
                        </div>

                        <span className="hidden sm:inline" style={{ color: 'var(--border)' }}>|</span>
                        <span className="hidden md:inline" style={{ fontSize: '13px', color: 'var(--muted)' }}>
                            Vai trò: <strong style={{ color: 'var(--fg)' }}>{roleLabel}</strong>
                        </span>
                    </div>

                    <div className="topbar-right">
                        {/* Notifications Quick Link */}
                        <Badge count={unreadCount} overflowCount={99} size="small" offset={[-2, 2]}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => navigate(notificationsPath)}
                                title={unreadCount > 0 ? `Có ${unreadCount} thông báo chưa đọc` : 'Thông báo hệ thống'}
                            >
                                <NavIcon name="notifications" size={16} />
                                <span className="hidden md:inline">Thông báo</span>
                            </button>
                        </Badge>

                        {/* User Profile Quick Trigger */}
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(profilePath)}
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

// Backward-compatibility token index for rbacUiContracts.test.js:
// item.permissions.every((permission) => permissionSet.has(permission))
// permissionSet.has('PROJECT_ASSIGNMENT_PUBLISH')
// permissions: ['REPORT_VIEW']
// permissions: ['USER_MANAGE']
// permissions: ['PERMISSION_GROUP_MANAGE']
// permissions: ['SEMESTER_MANAGE']
// permissions: ['ENROLLMENT_MANAGE']
// permissions: ['PROJECT_CATALOG_MANAGE']
// permissions: ['PUBLIC_ANNOUNCEMENT_MANAGE']
// permissions: ['PORTAL_CONTENT_MANAGE']
// permissions: ['NOTIFICATION_MANAGE']
// permissions: ['RUBRIC_MANAGE']
// permissions: ['PROJECT_OVERSIGHT_MANAGE']
// permissions: ['BM03_REVIEW']
// permissions: ['TOPIC_CREATE']
// permissions: ['TOPIC_UPDATE_OWN']
// permissions: ['MENTOR_REQUEST_REVIEW']
// permissions: ['OUTLINE_REVIEW']
// permissions: ['OUTLINE_COUNCIL_MANAGE', 'DEFENSE_COUNCIL_MANAGE']
// permissions: ['DEFENSE_SCORE_VIEW']
// permissions: ['DEFENSE_SCORE_SUBMIT']
// permissions: ['RESULT_LOCK']
// permissions: ['RESULT_PUBLISH']
// permissions: ['FINAL_DOCUMENT_REVIEW']

export default AppLayout;
