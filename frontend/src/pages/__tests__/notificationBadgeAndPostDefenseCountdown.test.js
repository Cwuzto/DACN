import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appLayoutPath = path.resolve(__dirname, '../../components/layout/AppLayout.jsx');
const studentDashboardPath = path.resolve(__dirname, '../student/StudentDashboardPage.jsx');
const projectOversightPath = path.resolve(__dirname, '../admin/ProjectOversightPage.jsx');

test('P1.2: AppLayout.jsx integrates notification badge and polling without breaking Rule 2.6', () => {
    assert.ok(fs.existsSync(appLayoutPath), 'AppLayout.jsx must exist');
    const content = fs.readFileSync(appLayoutPath, 'utf8');

    // UTF-8 no BOM check
    assert.ok(!content.startsWith('\uFEFF'), 'AppLayout.jsx must not have BOM');

    // Badge import and usage
    assert.ok(content.includes("import { Badge } from 'antd';") || content.includes('Badge'), 'Must import Badge from antd');
    assert.ok(content.includes('notificationService'), 'Must import and use notificationService');
    assert.ok(content.includes('fetchUnreadNotifications'), 'Must have fetchUnreadNotifications helper');
    assert.ok(content.includes("unreadOnly: 'true'"), 'Must query unreadOnly: true');
    assert.ok(content.includes('<Badge count={unreadCount}'), 'Must wrap notification button with Badge');

    // Rule 2.6 Button text integrity
    const buttonMatches = content.match(/<button[^>]*>([\s\S]*?)<\/button>/gi) || [];
    for (const btn of buttonMatches) {
        assert.ok(!/[←→+🤖✓⚠️⚙📋✏️👥🗑️🔓▾▴↗🎉📦🏛️]/.test(btn), `Button label should not contain raw emoji: ${btn}`);
    }
});

test('P1.2: StudentDashboardPage.jsx displays 14-day archival countdown banner and status tags', () => {
    assert.ok(fs.existsSync(studentDashboardPath), 'StudentDashboardPage.jsx must exist');
    const content = fs.readFileSync(studentDashboardPath, 'utf8');

    // UTF-8 no BOM check
    assert.ok(!content.startsWith('\uFEFF'), 'StudentDashboardPage.jsx must not have BOM');

    // Post-defense statuses supported
    assert.ok(content.includes('DEFENSE_PASSED'), 'Must handle DEFENSE_PASSED');
    assert.ok(content.includes('PENDING_INSTITUTE_SIGNATURE'), 'Must handle PENDING_INSTITUTE_SIGNATURE');
    assert.ok(content.includes('ARCHIVE_INCOMPLETE'), 'Must handle ARCHIVE_INCOMPLETE');
    assert.ok(content.includes('ARCHIVE_REJECTED'), 'Must handle ARCHIVE_REJECTED');

    // Dossier and clearance certificate integration
    assert.ok(content.includes('archiveService.getDefenseDossier'), 'Must query getDefenseDossier');
    assert.ok(content.includes('handleDownloadCertificate'), 'Must have handleDownloadCertificate');
    assert.ok(content.includes('archiveService.getClearanceCertificate'), 'Must call getClearanceCertificate');

    // Post-Defense Archival & Defense Council Session Banner
    assert.ok(content.includes('Cửa Sổ Nộp & Hoàn Thiện Hồ Sơ Lưu Chiểu') || content.includes('Cửa Sổ Nộp &amp; Hoàn Thiện Hồ Sơ Lưu Chiểu'), 'Must render archival window banner');
    assert.ok(content.includes('windowClosesAt'), 'Must calculate time remaining relative to windowClosesAt');

    // Rule 2.6 Button text integrity
    const buttonMatches = content.match(/<button[^>]*>([\s\S]*?)<\/button>/gi) || [];
    for (const btn of buttonMatches) {
        assert.ok(!/[←→+🤖✓⚠️⚙📋✏️👥🗑️🔓▾▴↗🎉📦🏛️]/.test(btn), `Button label should not contain raw emoji: ${btn}`);
    }
});

test('P1.2: ProjectOversightPage.jsx accurately renders archival and certificate signature statuses', () => {
    assert.ok(fs.existsSync(projectOversightPath), 'ProjectOversightPage.jsx must exist');
    const content = fs.readFileSync(projectOversightPath, 'utf8');

    // UTF-8 no BOM check
    assert.ok(!content.startsWith('\uFEFF'), 'ProjectOversightPage.jsx must not have BOM');

    // Check status tags in archiveColumns
    assert.ok(content.includes('PENDING_INSTITUTE_SIGNATURE'), 'Must handle PENDING_INSTITUTE_SIGNATURE in archive columns');
    assert.ok(content.includes('Chờ Viện trưởng ký'), 'Must display tag Chờ Viện trưởng ký');
    assert.ok(content.includes('ARCHIVE_INCOMPLETE'), 'Must handle ARCHIVE_INCOMPLETE in archive columns');
    assert.ok(content.includes('ARCHIVE_REJECTED'), 'Must handle ARCHIVE_REJECTED in archive columns');

    // Rule 2.6 Button text integrity
    const buttonMatches = content.match(/<Button[^>]*>([\s\S]*?)<\/Button>/gi) || [];
    for (const btn of buttonMatches) {
        assert.ok(!/[←→+🤖✓⚠️⚙📋✏️👥🗑️🔓▾▴↗🎉📦🏛️]/.test(btn), `Button label should not contain raw emoji: ${btn}`);
    }
});

