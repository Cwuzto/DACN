const DEFAULT_CONFIGURATION = {
    siteTitle: 'Hệ thống Quản lý Đồ án',
    institutionName: 'Viện Công nghệ Số',
    heroTitle: 'Khởi đầu Đồ án Tốt nghiệp với Quy chuẩn Học thuật Số',
    heroDescription: 'Cổng thông tin chính thức dành cho sinh viên thực hiện Khóa luận và Đồ án Chuyên ngành.',
    primaryCtaLabel: 'Tra cứu Giảng viên & Hướng NC',
    primaryCtaHref: '#faculty',
    copyrightText: '© 2026 Hệ thống Quản lý Đồ án',
};

export function getPublicPortalView(content = {}) {
    const linksByGroup = { QUICK_LINK: [], SOCIAL: [], LEGAL: [] };
    for (const link of content.links || []) {
        if (linksByGroup[link.group]) linksByGroup[link.group].push(link);
    }
    return {
        configuration: { ...DEFAULT_CONFIGURATION, ...(content.configuration || {}) },
        linksByGroup,
        templates: Array.isArray(content.templates) ? content.templates : [],
    };
}

