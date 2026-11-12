import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 4: notificationService exports sendLecturerBroadcast method', () => {
    const notifServiceSrc = read('frontend/src/services/notificationService.js');
    assert.match(
        notifServiceSrc,
        /sendLecturerBroadcast\s*:\s*async\s*\(data\)\s*=>/,
        'notificationService must export sendLecturerBroadcast method'
    );
    assert.match(
        notifServiceSrc,
        /\/notifications\/lecturer-broadcast/,
        'sendLecturerBroadcast must post to /notifications/lecturer-broadcast'
    );
});

test('Task 4: GradingDefensePage connects real BM05 PDF export and eliminates mock toasts', () => {
    const pageSrc = read('frontend/src/pages/admin/GradingDefensePage.jsx');

    // Elimination of mock toast
    assert.ok(
        !pageSrc.includes('Đang tạo Biên bản bảo vệ BM05 kèm chữ ký số...'),
        'Mock BM05 PDF generation toast must be completely eliminated'
    );

    // Call to evaluationService.exportScoreSheetPdf
    assert.match(
        pageSrc,
        /evaluationService\.exportScoreSheetPdf\s*\(/,
        'GradingDefensePage must call evaluationService.exportScoreSheetPdf'
    );

    // Export loading state management
    assert.match(
        pageSrc,
        /isExportingPdf|exportingPdf/,
        'GradingDefensePage must track export PDF loading state'
    );

    // Window opening or blob handling for PDF
    assert.match(
        pageSrc,
        /window\.open\s*\(/,
        'GradingDefensePage must open generated PDF URL with window.open'
    );

    // Rule 2.6 UI Button Standards: No raw emojis or raw ASCII symbols in button labels
    assert.ok(
        !/>\s*✓\s*Xong\s*<\//.test(pageSrc),
        'Rule 2.6: Raw checkmark symbol ✓ must not be used in button label'
    );
    assert.ok(
        !/>\s*⚙\s*\{/.test(pageSrc),
        'Rule 2.6: Raw gear symbol ⚙ must not be used in button label'
    );
});

test('Task 4: LecturerDashboardPage integrates real lecturer broadcast API and eliminates setTimeout', () => {
    const dashboardSrc = read('frontend/src/pages/lecturer/LecturerDashboardPage.jsx');

    // Import notificationService
    assert.match(
        dashboardSrc,
        /import\s+notificationService\s+from\s+['"].*notificationService['"]/,
        'LecturerDashboardPage must import notificationService'
    );

    // Call notificationService.sendLecturerBroadcast
    assert.match(
        dashboardSrc,
        /notificationService\.sendLecturerBroadcast\s*\(/,
        'LecturerDashboardPage must call notificationService.sendLecturerBroadcast'
    );

    // Elimination of fake broadcast setTimeout
    assert.ok(
        !/handleSendBroadcast\s*=\s*(?:async\s*)?\(\)\s*=>\s*\{[\s\S]*?setTimeout\s*\(/m.test(dashboardSrc),
        'handleSendBroadcast must not use setTimeout mock'
    );

    // Rule 2.6 UI Button Standards: No raw symbols like '+ ' or '→' in button labels
    assert.ok(
        !/>\s*\+\s*Ghi nhận Buổi Gặp/.test(dashboardSrc),
        'Rule 2.6: Raw plus sign + must not be used inside button label text'
    );
    assert.ok(
        !/>\s*[^<]*→\s*<\/(?:button|Button)>/u.test(dashboardSrc),
        'Rule 2.6: Raw arrow → must not be used inside button label text'
    );
});
