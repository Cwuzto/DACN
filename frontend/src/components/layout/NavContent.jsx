import { useEffect, useRef } from 'react';
import { RightOutlined } from '@ant-design/icons';
import NavIcon from './NavIcon';
import QuotaMeter from '../common/QuotaMeter';

function getRoleTheme({ currentRole, isVienTruong, roleLabel }) {
    if (isVienTruong) {
        return {
            card: 'bg-gradient-to-br from-purple-50 via-white to-amber-50/70 border-purple-200/80 hover:border-purple-300',
            avatar: 'bg-gradient-to-br from-purple-600 to-amber-500',
            badge: 'bg-purple-100/90 text-purple-800',
            label: 'Viện trưởng',
        };
    }
    if (roleLabel === 'Giáo vụ') {
        return {
            card: 'bg-gradient-to-br from-sky-50 via-white to-blue-50/70 border-sky-200/80 hover:border-sky-300',
            avatar: 'bg-gradient-to-br from-sky-600 to-blue-600',
            badge: 'bg-sky-100/90 text-sky-800',
            label: 'Giáo vụ',
        };
    }
    if (currentRole === 'ADMIN') {
        return {
            card: 'bg-gradient-to-br from-rose-50/80 via-white to-slate-50 border-rose-200/70 hover:border-rose-300',
            avatar: 'bg-gradient-to-br from-rose-600 to-slate-800',
            badge: 'bg-rose-100/90 text-rose-800',
            label: roleLabel || 'Quản trị viên',
        };
    }
    if (currentRole === 'LECTURER') {
        return {
            card: 'bg-gradient-to-br from-teal-50/90 via-white to-emerald-50/60 border-teal-200/80 hover:border-teal-300',
            avatar: 'bg-gradient-to-br from-teal-600 to-emerald-600',
            badge: 'bg-teal-100/90 text-teal-800',
            label: roleLabel || 'Giảng viên',
        };
    }
    return {
        card: 'bg-gradient-to-br from-emerald-50/90 via-white to-cyan-50/60 border-emerald-200/80 hover:border-emerald-300',
        avatar: 'bg-gradient-to-br from-emerald-600 to-cyan-600',
        badge: 'bg-emerald-100/90 text-emerald-800',
        label: roleLabel || 'Sinh viên',
    };
}

function getGroupAccent(groupName) {
    switch (groupName) {
        case 'Đăng ký & đề cương':
        case 'Đợt & đăng ký':
            return { key: 'sky', dot: 'bg-sky-500' };
        case 'Thực hiện đồ án':
        case 'Hướng dẫn & tiến độ':
            return { key: 'indigo', dot: 'bg-indigo-500' };
        case 'Hội đồng & bảo vệ':
        case 'Bảo vệ & hoàn tất':
            return { key: 'purple', dot: 'bg-purple-500' };
        case 'Kết quả & báo cáo':
        case 'Điều hành viện':
            return { key: 'amber', dot: 'bg-amber-500' };
        case 'Nội dung & hệ thống':
            return { key: 'rose', dot: 'bg-rose-500' };
        default:
            return { key: 'teal', dot: 'bg-teal-500' };
    }
}

/**
 * NavContent - Shared Sidebar Navigation Component
 * Extracted as a standalone module-level component to ensure DOM preservation
 * and prevent scroll position resets when navigating between workspace features.
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
    lecturerMaxQuota = 10,
    dashboardPath,
    profilePath,
    visibleGroups = [],
    isActive,
    handleNavigate,
    handleLogout,
}) {
    const navRef = useRef(null);

    // Preserve scroll position across route changes and soft page reloads
    useEffect(() => {
        const navEl = navRef.current;
        if (!navEl) return;

        try {
            const savedScroll = sessionStorage.getItem('sidebar_scroll_position');
            if (savedScroll !== null) {
                navEl.scrollTop = Number(savedScroll);
            }
        } catch {}

        const handleScroll = () => {
            try {
                sessionStorage.setItem('sidebar_scroll_position', String(navEl.scrollTop));
            } catch {}
        };

        navEl.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            navEl.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // Ensure currently active button is gently visible if scrolled out of view on landing
    useEffect(() => {
        const navEl = navRef.current;
        if (!navEl) return;
        const activeBtn = navEl.querySelector('.nav-item.active');
        if (activeBtn) {
            const navRect = navEl.getBoundingClientRect();
            const btnRect = activeBtn.getBoundingClientRect();
            if (btnRect.top < navRect.top || btnRect.bottom > navRect.bottom) {
                activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [visibleGroups]);

    const roleTheme = getRoleTheme({ currentRole, isVienTruong, roleLabel });

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-slate-50/90 via-white to-teal-50/25 select-none">
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

            {/* Role-Aware Profile Card */}
            {!isSidebarCollapsed && (
                <button
                    type="button"
                    onClick={() => handleNavigate(profilePath)}
                    className={`${currentRole === 'LECTURER' ? 'lecturer-chip' : 'user-chip'} ${roleTheme.card} hover:shadow-sm`}
                    title="Xem và cập nhật thông tin tài khoản"
                >
                    <div className={`${currentRole === 'LECTURER' ? 'lecturer-avatar' : 'user-avatar'} ${roleTheme.avatar} rounded-xl shadow-sm`}>
                        {initials}
                    </div>
                    <div className={currentRole === 'LECTURER' ? 'lecturer-info' : 'user-info'}>
                        <div className={currentRole === 'LECTURER' ? 'lecturer-name' : 'user-name'}>
                            {user?.fullName || user?.name || roleLabel}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none ${roleTheme.badge}`}>
                                {roleTheme.label}
                            </span>
                            {user?.code && (
                                <span className="text-[11px] text-slate-500 font-medium truncate">
                                    {user.code}
                                </span>
                            )}
                        </div>
                    </div>
                    <RightOutlined className="text-[11px] text-slate-400 shrink-0" aria-hidden="true" />
                </button>
            )}

            {/* Quota Widget (Displayed only when user has mentoring/topic capabilities) */}
            {showQuotaMeter && !isSidebarCollapsed && (
                <div className="px-4 py-2">
                    <QuotaMeter
                        current={lecturerStudentCount}
                        max={lecturerMaxQuota}
                        label="Chỉ tiêu hướng dẫn"
                        showPercentage={true}
                    />
                </div>
            )}

            {/* Navigation List */}
            <nav ref={navRef} aria-label="Điều hướng chính" className="flex-1 overflow-y-auto">
                <ul className="nav-list">
                    {/* 1. Dashboard: Fixed top-level overview */}
                    <li className="space-y-1 mb-2" role="group" aria-labelledby="nav-group-overview">
                        {!isSidebarCollapsed && (
                            <div id="nav-group-overview" className="nav-section-title uppercase">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" aria-hidden="true" />
                                <span>Tổng quan</span>
                            </div>
                        )}
                        <button
                            type="button"
                            data-accent="teal"
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
                        const accent = getGroupAccent(section.group);
                        return (
                            <li key={section.group} className="space-y-1" role="group" aria-labelledby={groupTitleId}>
                                {!isSidebarCollapsed ? (
                                    <div id={groupTitleId} className="nav-section-title uppercase">
                                        <span className={`w-1.5 h-1.5 rounded-full ${accent.dot} shrink-0`} aria-hidden="true" />
                                        <span>{section.title}</span>
                                    </div>
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
                                                data-accent={accent.key}
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
                            data-accent="slate"
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

export default NavContent;

