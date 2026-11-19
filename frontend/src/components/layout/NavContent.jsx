import { useEffect, useRef } from 'react';
import NavIcon from './NavIcon';
import QuotaMeter from '../common/QuotaMeter';

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
            <nav ref={navRef} aria-label="Điều hướng chính" className="flex-1 overflow-y-auto">
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

export default NavContent;
