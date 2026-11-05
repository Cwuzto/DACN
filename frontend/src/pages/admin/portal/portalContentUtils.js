export function buildAnnouncementPayload(values) {
    const title = String(values.title || '').trim();
    if (values.announcementType === 'PDF') {
        return {
            title,
            type: 'PDF',
            fileUrl: values.fileUrl,
            fileName: values.fileName,
        };
    }
    return {
        title,
        type: 'RICH_TEXT',
        richContentHtml: values.richContentHtml || '',
    };
}

export function getPortalEmptyState(resourceType) {
    const labels = {
        CONFIGURATION: 'cấu hình Portal',
        LINK: 'liên kết',
        TEMPLATE: 'biểu mẫu',
        ANNOUNCEMENT: 'thông báo',
    };
    const label = labels[resourceType] || 'nội dung';
    return {
        title: `Chưa có ${label} đã công bố`,
        description: 'Tạo bản nháp đầu tiên để bắt đầu biên tập nội dung Portal.',
    };
}

export function selectEditableRevision(resource) {
    return resource?.revisions?.find((revision) => revision.status === 'DRAFT')
        || resource?.revisions?.find((revision) => revision.status === 'PUBLISHED')
        || null;
}
