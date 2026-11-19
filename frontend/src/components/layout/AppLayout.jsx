import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Badge } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import authService from '../../services/authService';
import notificationService from '../../services/notificationService';
import { semesterService } from '../../services/semesterService';
import { getClosestSemester, resolveCurrentSemester } from '../../utils/semesterDisplay';
import registrationService from '../../services/registrationService';
import { getVisibleNavigation, isNavigationItemActive } from '../../auth/policyEvaluator';
import { isInstituteDirector, getUserDisplayRole } from '../../utils/authRedirect';
import NavIcon from './NavIcon';
import OpenDrawer from '../common/OpenDrawer';
import QuotaMeter from '../common/QuotaMeter';
import AcademicChatWidget from '../common/AcademicChatWidget';
import RouteContentBoundary from '../common/RouteContentBoundary';
import ContentSkeleton from '../common/ContentSkeleton';
import { queryKeys } from '../../query/queryKeys';
import { useMyNotifications } from '../../queries/notificationQueries';
import { useSemesters, usePublicSemesters } from '../../queries/semesterQueries';
import { useRegistrations } from '../../queries/registrationQueries';

/**
 * NavContent - Shared Sidebar Navigation Component
 * Module-level component to ensure DOM preservation and stable scroll position across route changes.
 */
function NavContent({
    isSidebarCollapsed = false,
    toggleCollapse,
    user,
    currentRole,
    initials,
    roleLabel,
    isVienTruong,
    showQuotaMeter,
    lecturerStudentCount,
    dashboardPath,
    profilePath,
    visibleGroups,
    isActive,
    handleNavigate,
    handleLogout,
}) {
    return (
        <div className="flex flex-col h-full bg-white select-none">
            {/* Brand Header: Logo */}
            <div className="brand-header flex items-center justify-between px-4 py-3">
                <div className="flex items-center overflow-hidden">
                    <img
                        src="/assets/tdmu-logo.svg"
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
                    aria-expanded={!isSidebarCollapsed}
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
                            ) : roleLabel === 'Giáo vụ' ? (
                                <span className="font-semibold text-[#0369A1]">
                                    {user?.code ? `Mã: ${user.code} · ` : ''}Giáo vụ
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
            <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto">
                <ul className="nav-list">
                    {/* 1. Dashboard: Fixed top-level overview */}
                    <li className="space-y-1 mb-2" role="group" aria-labelledby="nav-group-overview">
                        {!isSidebarCollapsed && (
                            <div id="nav-group-overview" className="nav-section-title uppercase">Tổng quan</div>
                        )}
                        <button
                            type="button"
                            onClick={() => handleNavigate(dashboardPath)}
                            className={`nav-item ${isActive(dashboardPath) ? 'active' : ''}`}
                            aria-current={isActive(dashboardPath) ? 'page' : undefined}
                            aria-label={isSidebarCollapsed ? 'Tổng quan' : undefined}
                            title={isSidebarCollapsed ? 'Tổng quan' : undefined}
                        >
                            <span className="nav-left">
                                <NavIcon name="dashboard" />
                                {!isSidebarCollapsed && <span>Tổng quan</span>}
                            </span>
                        </button>
                    </li>

                    {/* 2. Dynamic Navigation Groups */}
                    {visibleGroups.map((section, groupIndex) => {
                        const groupTitleId = `nav-group-${groupIndex}`;
                        return (
                            <li key={section.group} className="space-y-1" role="group" aria-labelledby={groupTitleId}>
                                {!isSidebarCollapsed ? (
                                    <div id={groupTitleId} className="nav-section-title uppercase">{section.title}</div>
                                ) : (
                                    <span id={groupTitleId} className="sr-only">{section.title}</span>
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
                                                aria-current={active ? 'page' : undefined}
                                                aria-label={isSidebarCollapsed ? item.label : undefined}
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
                        );
                    })}

                    {/* 3. Bottom Items (Account Settings) */}
                    <li className="space-y-1 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => handleNavigate(profilePath)}
                            className={`nav-item ${isActive(profilePath) ? 'active' : ''}`}
                            aria-current={isActive(profilePath) ? 'page' : undefined}
                            aria-label={isSidebarCollapsed ? 'Cài đặt tài khoản' : undefined}
                            title={isSidebarCollapsed ? 'Cài đặt tài khoản' : undefined}
                        >
                            <span className="nav-left">
                                <NavIcon name="settings" />
                                {!isSidebarCollapsed && <span>Cài đặt tài khoản</span>}
                            </span>
                        </button>
                    </li>
                </ul>
            </nav>

            {/* Sidebar Footer with Logout */}
            <div className="sidebar-footer">
                <button
                    type="button"
                    onClick={handleLogout}
                    className="switch-link danger"
                    aria-label={isSidebarCollapsed ? 'Đăng xuất' : undefined}
                    title="Đăng xuất khỏi hệ thống"
                >
                    <NavIcon name="logout" size={14} />
                    {!isSidebarCollapsed && <span>Đăng xuất</span>}
                </button>
            </div>
        </div>
    );
}

/**
 * AppLayout - Dynamic 7-Group Academic Layout
 * Replaces static role-based NAV_CONFIG with 2-Tier Capability Navigation Registry.
 * Automatically filters and renders visible domain groups based on user?.permissions.
 */
function AppLayout({ role }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, updateUser, refreshSession, refreshPermissions } = useAuthStore();
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const mobileMenuButtonRef = useRef(null);
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem('sidebar_collapsed') === 'true';
        } catch {
            return false;
        }
    });

    const scope = queryKeys.scope(user);
    const unreadQuery = useMyNotifications(scope, { unreadOnly: 'true' }, Boolean(user));
    const unreadCount = unreadQuery.data?.length ?? 0;

    const fetchUnreadNotifications = useCallback(async () => {
        if (!user) return;
        try {
            await unreadQuery.refetch();
        } catch (_) {
            // Ignore polling errors silently
        }
    }, [user, unreadQuery]);

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

        const handleSync = (force = false, { reason = 'layout_sync', expectedVersion } = {}) => {
            const now = Date.now();
            if (!force && now - lastSyncTime < 2000) {
                return;
            }
            lastSyncTime = now;
            if (typeof refreshPermissions === 'function') {
                refreshPermissions({ reason, expectedVersion }).catch(() => {});
            } else if (typeof refreshSession === 'function') {
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
        handleSync(true, { reason: 'mount_sync' });

        const handleVisibilityChange = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                handleSync(false, { reason: 'visibility_change' });
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('focus', () => handleSync(false, { reason: 'window_focus' }));
        }
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }

        let channel = null;
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                channel = new BroadcastChannel('dacn_auth_sync');
                channel.onmessage = (event) => {
                    const data = event?.data;
                    const type = data?.type;
                    if (type === 'PERMISSION_VERSION_UPDATED' || type === 'PERMISSIONS_UPDATED') {
                        const currentUserId = useAuthStore.getState().user?.id;
                        if (!data?.userId || data.userId === currentUserId) {
                            if (typeof refreshPermissions === 'function') {
                                refreshPermissions({
                                    reason: data?.reason || 'broadcast_sync',
                                    expectedVersion: data?.permissionVersion,
                                }).catch(() => {});
                            } else {
                                handleSync(true, {
                                    reason: data?.reason || 'broadcast_sync',
                                    expectedVersion: data?.permissionVersion,
                                });
                            }
                        }
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
    }, [refreshSession, refreshPermissions, updateUser]);

    const semestersQuery = useSemesters(scope);
    const publicSemestersQuery = usePublicSemesters(scope);

    const currentSemester = useMemo(() => {
        const list = (semestersQuery.data && semestersQuery.data.length > 0)
            ? semestersQuery.data
            : publicSemestersQuery.data;
        if (Array.isArray(list) && list.length > 0) {
            return resolveCurrentSemester(list);
        }
        return null;
    }, [semestersQuery.data, publicSemestersQuery.data]);

    // Resolve effective permissions
    const permissionSet = useMemo(() => new Set(user?.permissions || []), [user?.permissions]);

    // Capability check for QuotaMeter widget
    const showQuotaMeter = useMemo(() => {
        return permissionSet.has('TOPIC_CREATE') || permissionSet.has('MENTOR_REQUEST_REVIEW');
    }, [permissionSet]);

    const registrationsQuery = useRegistrations(scope, {}, showQuotaMeter);
    const lecturerStudentCount = useMemo(() => {
        if (!showQuotaMeter || !Array.isArray(registrationsQuery.data)) return 0;
        return registrationsQuery.data.filter(
            (r) =>
                (r.topic?.lecturerId === user?.id || r.topic?.lecturer?.id === user?.id) &&
                !['REJECTED', 'DROPPED', 'WITHDRAWN'].includes(r.status)
        ).length;
    }, [showQuotaMeter, registrationsQuery.data, user?.id]);

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
        return getVisibleNavigation(user);
    }, [user]);

    const handleLogout = () => {
        logout();
        navigate('/', { replace: true });
    };

    const isActive = (targetRoute) => isNavigationItemActive(targetRoute, location.pathname, location.search);

    const initials = (user?.fullName || user?.name || roleLabel)?.[0]?.toUpperCase() || 'U';

    const closeMobileDrawer = useCallback((restoreFocus = false) => {
        setMobileDrawerOpen(false);
        if (restoreFocus) {
            const restore = () => mobileMenuButtonRef.current?.focus();
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(restore);
            } else {
                setTimeout(restore, 0);
            }
        }
    }, []);

    const handleNavigate = (path) => {
        navigate(path);
        setMobileDrawerOpen(false);
    };

    const navProps = {
        toggleCollapse,
        user,
        currentRole,
        initials,
        roleLabel,
        isVienTruong,
        showQuotaMeter,
        lecturerStudentCount,
        dashboardPath,
        profilePath,
        visibleGroups,
        isActive,
        handleNavigate,
        handleLogout,
    };

    return (
        <div className="app-layout">
            {/* Desktop Fixed OpenDesign Sidebar */}
            <aside className={`sidebar hidden lg:flex ${collapsed ? 'is-collapsed' : ''}`}>
                <NavContent isSidebarCollapsed={collapsed} {...navProps} />
            </aside>

            {/* Mobile Sliding OpenDrawer */}
            <OpenDrawer
                open={mobileDrawerOpen}
                onClose={() => closeMobileDrawer(true)}
                placement="left"
                width="280px"
                ariaLabel="Menu điều hướng"
            >
                <NavContent isSidebarCollapsed={false} {...navProps} />
            </OpenDrawer>

            {/* Main Application Area */}
            <div className="main-wrapper">
                {/* Topbar Header */}
                <header className="topbar">
                    <div className="topbar-left">
                        <button
                            ref={mobileMenuButtonRef}
                            type="button"
                            className="lg:hidden btn btn-secondary btn-sm"
                            onClick={() => setMobileDrawerOpen(true)}
                            aria-label="Mở menu điều hướng"
                            aria-expanded={mobileDrawerOpen}
                        >
                            <MenuOutlined />
                        </button>
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
                        <RouteContentBoundary>
                            {/* A new pathname reveals its local fallback during router transitions. */}
                            <Suspense key={location.pathname} fallback={<ContentSkeleton />}>
                                <Outlet />
                            </Suspense>
                        </RouteContentBoundary>
                    </div>
                </main>
            </div>

            {/* Academic Regulation AI Assistant Floating Widget */}
            <AcademicChatWidget />
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
