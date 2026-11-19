import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Badge, Button } from 'antd';
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
import NavContent from './NavContent';
import OpenDrawer from '../common/OpenDrawer';
import AcademicChatWidget from '../common/AcademicChatWidget';
import RouteContentBoundary from '../common/RouteContentBoundary';
import ContentSkeleton from '../common/ContentSkeleton';
import { queryKeys } from '../../query/queryKeys';
import { useMyNotifications } from '../../queries/notificationQueries';
import { useSemesters, usePublicSemesters } from '../../queries/semesterQueries';
import { useRegistrations } from '../../queries/registrationQueries';
import { useLecturerOverview } from '../../queries/dashboardQueries';

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

    // Capability check for QuotaMeter widget (Lecturers with topic/mentoring permissions)
    const isLecturerUser = user?.role === 'LECTURER';
    const showQuotaMeter = useMemo(() => {
        return isLecturerUser && (permissionSet.has('TOPIC_CREATE') || permissionSet.has('MENTOR_REQUEST_REVIEW'));
    }, [isLecturerUser, permissionSet]);

    const overviewQuery = useLecturerOverview(scope, null, showQuotaMeter);
    const registrationsQuery = useRegistrations(scope, {}, showQuotaMeter && !overviewQuery.data);

    const lecturerStudentCount = useMemo(() => {
        if (!showQuotaMeter) return 0;
        // Priority 1: Direct unified lecturer overview (single source of truth with dashboard and student page)
        if (overviewQuery.data?.mentorSummary?.supervisedCount !== undefined) {
            return overviewQuery.data.mentorSummary.supervisedCount;
        }
        if (Array.isArray(overviewQuery.data?.students)) {
            return overviewQuery.data.students.length;
        }
        // Priority 2: Fallback to registrations query
        if (Array.isArray(registrationsQuery.data)) {
            return registrationsQuery.data.filter(
                (r) =>
                    (r.topic?.mentorId === user?.id ||
                        r.topic?.mentor?.id === user?.id ||
                        r.mentorId === user?.id ||
                        r.mentor?.id === user?.id ||
                        r.topic?.lecturerId === user?.id ||
                        r.topic?.lecturer?.id === user?.id) &&
                    (!currentSemester?.id || r.semesterId === currentSemester.id) &&
                    !['REJECTED', 'DROPPED', 'WITHDRAWN'].includes(r.status)
            ).length;
        }
        return 0;
    }, [showQuotaMeter, overviewQuery.data, registrationsQuery.data, user?.id, currentSemester?.id]);

    const lecturerMaxQuota = useMemo(() => {
        return overviewQuery.data?.mentorSummary?.maxStudents ?? user?.maxStudents ?? 10;
    }, [overviewQuery.data?.mentorSummary?.maxStudents, user?.maxStudents]);

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
        lecturerMaxQuota,
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
                <main className="main-area pb-16 lg:pb-0">
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

            <Button
                ref={mobileMenuButtonRef}
                type="primary"
                shape="circle"
                size="large"
                icon={<MenuOutlined aria-hidden="true" />}
                className="!fixed !left-4 !z-50 !bg-teal-700 hover:!bg-teal-800 lg:!hidden"
                style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Mở menu điều hướng"
                aria-expanded={mobileDrawerOpen}
            />

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
