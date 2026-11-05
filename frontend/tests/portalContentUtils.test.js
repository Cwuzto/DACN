import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildAnnouncementPayload,
    getPortalEmptyState,
} from '../src/pages/admin/portal/portalContentUtils.js';
import { getPublicPortalView } from '../src/utils/portalContent.js';

test('buildAnnouncementPayload produces mutually-exclusive PDF payload', () => {
    assert.deepEqual(buildAnnouncementPayload({
        title: 'Lịch bảo vệ',
        announcementType: 'PDF',
        fileUrl: 'https://example.edu/notice.pdf',
        fileName: 'notice.pdf',
        richContentHtml: '<p>ignored</p>',
    }), {
        title: 'Lịch bảo vệ',
        type: 'PDF',
        fileUrl: 'https://example.edu/notice.pdf',
        fileName: 'notice.pdf',
    });
});

test('buildAnnouncementPayload produces mutually-exclusive sanitized rich-text intent', () => {
    assert.deepEqual(buildAnnouncementPayload({
        title: 'Nhắc hạn',
        announcementType: 'RICH_TEXT',
        richContentHtml: '<p>Nộp BM01 trước thứ Sáu.</p>',
        fileUrl: 'https://example.edu/ignored.pdf',
    }), {
        title: 'Nhắc hạn',
        type: 'RICH_TEXT',
        richContentHtml: '<p>Nộp BM01 trước thứ Sáu.</p>',
    });
});

test('empty-state mapping is neutral and never falls back to sample portal content', () => {
    assert.deepEqual(getPortalEmptyState('ANNOUNCEMENT'), {
        title: 'Chưa có thông báo đã công bố',
        description: 'Tạo bản nháp đầu tiên để bắt đầu biên tập nội dung Portal.',
    });
});

test('public portal view uses published configuration and groups links safely', () => {
    const view = getPublicPortalView({
        configuration: { siteTitle: 'Portal DACN', heroTitle: 'Đồ án số', email: 'portal@example.edu' },
        links: [
            { id: 1, label: 'Quy chế', href: '/rules', group: 'LEGAL' },
            { id: 2, label: 'Facebook', href: 'https://example.edu', group: 'SOCIAL' },
        ],
    });
    assert.deepEqual(view.linksByGroup, {
        QUICK_LINK: [],
        SOCIAL: [{ id: 2, label: 'Facebook', href: 'https://example.edu', group: 'SOCIAL' }],
        LEGAL: [{ id: 1, label: 'Quy chế', href: '/rules', group: 'LEGAL' }],
    });
    assert.equal(view.configuration.siteTitle, 'Portal DACN');
    assert.equal(view.configuration.heroTitle, 'Đồ án số');
    assert.equal(view.configuration.email, 'portal@example.edu');
});
