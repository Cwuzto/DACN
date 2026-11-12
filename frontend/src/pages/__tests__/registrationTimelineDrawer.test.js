import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 3: topicService and registrationService export getRegistrationHistory', () => {
    const topicServiceSrc = read('frontend/src/services/topicService.js');
    const registrationServiceSrc = read('frontend/src/services/registrationService.js');

    assert.match(
        topicServiceSrc,
        /getRegistrationHistory\s*:\s*async/,
        'topicService must export getRegistrationHistory method'
    );
    assert.match(
        registrationServiceSrc,
        /getRegistrationHistory\s*:\s*async/,
        'registrationService must export getRegistrationHistory method'
    );
});

test('Task 3: RegistrationTimelineDrawer component structure and features', () => {
    const drawerPath = 'frontend/src/components/common/RegistrationTimelineDrawer.jsx';
    assert.ok(fs.existsSync(path.join(root, drawerPath)), 'RegistrationTimelineDrawer.jsx must exist');
    const drawerSrc = read(drawerPath);

    // Export component
    assert.match(drawerSrc, /export\s+default\s+function\s+RegistrationTimelineDrawer/, 'Must export default RegistrationTimelineDrawer');

    // Ant Design imports
    assert.match(drawerSrc, /Drawer/, 'Must use Ant Design Drawer');
    assert.match(drawerSrc, /Timeline/, 'Must use Ant Design Timeline');
    assert.match(drawerSrc, /Skeleton/, 'Must use Ant Design Skeleton');
    assert.match(drawerSrc, /Empty/, 'Must use Ant Design Empty');

    // Props support
    assert.match(drawerSrc, /registrationId/, 'Must receive and use registrationId');
    assert.match(drawerSrc, /open/, 'Must receive open prop');
    assert.match(drawerSrc, /onClose/, 'Must receive onClose prop');

    // Dot colors logic
    assert.match(drawerSrc, /green/, 'Must configure green dot color');
    assert.match(drawerSrc, /blue/, 'Must configure blue dot color');
    assert.match(drawerSrc, /red/, 'Must configure red dot color');
    assert.match(drawerSrc, /gray/, 'Must configure gray dot color');

    // Date formatting DD/MM/YYYY HH:mm
    assert.match(drawerSrc, /DD\/MM\/YYYY HH:mm/, 'Must format timestamp as DD/MM/YYYY HH:mm');

    // Empty state text
    assert.match(drawerSrc, /Chưa có lịch sử chuyển trạng thái/, 'Must have Empty state with standard description');
});

test('Task 3: Integration into StudentDashboardPage, ProgressTrackingPage, and TopicApprovalPage', () => {
    const studentDashSrc = read('frontend/src/pages/student/StudentDashboardPage.jsx');
    const progressTrackingSrc = read('frontend/src/pages/lecturer/ProgressTrackingPage.jsx');

    // StudentDashboardPage integration
    assert.match(studentDashSrc, /RegistrationTimelineDrawer/, 'StudentDashboardPage must import RegistrationTimelineDrawer');
    assert.match(studentDashSrc, /HistoryOutlined/, 'StudentDashboardPage must import HistoryOutlined icon');
    assert.match(studentDashSrc, /Lịch sử tiến trình/, 'StudentDashboardPage must have button "Lịch sử tiến trình"');

    // ProgressTrackingPage integration
    assert.match(progressTrackingSrc, /RegistrationTimelineDrawer/, 'ProgressTrackingPage must import RegistrationTimelineDrawer');
    assert.match(progressTrackingSrc, /Lịch sử/, 'ProgressTrackingPage must have button or action to view history');

    // TopicApprovalPage integration
    const approvalLecturerExists = fs.existsSync(path.join(root, 'frontend/src/pages/lecturer/TopicApprovalPage.jsx'));
    const approvalAdminExists = fs.existsSync(path.join(root, 'frontend/src/pages/admin/TopicApprovalPage.jsx'));

    assert.ok(approvalLecturerExists || approvalAdminExists, 'TopicApprovalPage must exist');

    if (approvalLecturerExists) {
        const approvalSrc = read('frontend/src/pages/lecturer/TopicApprovalPage.jsx');
        assert.match(approvalSrc, /RegistrationTimelineDrawer/, 'TopicApprovalPage must import RegistrationTimelineDrawer');
    }
    if (approvalAdminExists) {
        const approvalSrc = read('frontend/src/pages/admin/TopicApprovalPage.jsx');
        assert.match(approvalSrc, /RegistrationTimelineDrawer/, 'admin/TopicApprovalPage must import RegistrationTimelineDrawer');
    }
});

test('Task 3: Strict Button standards (Rule 2.6 in AGENTS.md) across all modified files', () => {
    const rawSymbolRegex = />\s*[^<]*[←→+🤖✓✏️👥🗑️🔓▾▴↗📖🏛️⏰]\s*[^<]*<\/Button>/;

    const filesToCheck = [
        'frontend/src/components/common/RegistrationTimelineDrawer.jsx',
        'frontend/src/pages/student/StudentDashboardPage.jsx',
        'frontend/src/pages/lecturer/ProgressTrackingPage.jsx',
    ];

    if (fs.existsSync(path.join(root, 'frontend/src/pages/lecturer/TopicApprovalPage.jsx'))) {
        filesToCheck.push('frontend/src/pages/lecturer/TopicApprovalPage.jsx');
    }
    if (fs.existsSync(path.join(root, 'frontend/src/pages/admin/TopicApprovalPage.jsx'))) {
        filesToCheck.push('frontend/src/pages/admin/TopicApprovalPage.jsx');
    }

    for (const relPath of filesToCheck) {
        if (!fs.existsSync(path.join(root, relPath))) continue;
        const content = read(relPath);
        assert.ok(
            !rawSymbolRegex.test(content),
            `Rule 2.6 violation: Raw emoji or special character found in Button text in ${relPath}`
        );
    }
});
