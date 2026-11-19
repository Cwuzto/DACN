import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FEATURE_POLICIES, FEATURE_POLICY_LIST } from '../src/auth/featurePolicies.js';
import { canViewFeature, getVisibleNavigation } from '../src/auth/policyEvaluator.js';
import { NAVIGATION_REGISTRY } from '../src/config/navigationRegistry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 5 files exist and strictly adhere to UTF-8 without BOM (Rule 2.4)', () => {
    const files = [
        'src/App.jsx',
        'src/auth/featurePolicies.js',
        'src/pages/student/StudentDashboardPage.jsx',
        'src/pages/common/NotificationsPage.jsx',
        'tests/studentWorkNavigation.test.js',
        'tests/navigationRegistry.test.js',
        'tests/featurePolicyParity.test.js',
    ];

    for (const file of files) {
        const fullPath = path.join(root, file);
        assert.ok(fs.existsSync(fullPath), `File ${file} must exist`);
        const buffer = fs.readFileSync(fullPath);
        const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.equal(hasBOM, false, `File ${file} must NOT have UTF-8 BOM`);
    }
});

test('Rule 2.1 compliance: No group/groupMember/groupId in modified navigation files', () => {
    const files = [
        'src/auth/featurePolicies.js',
        'src/pages/student/StudentDashboardPage.jsx',
        'src/pages/common/NotificationsPage.jsx',
    ];

    for (const file of files) {
        const content = read(file);
        assert.equal(
            /\bgroupMember\b/i.test(content),
            false,
            `File ${file} must NOT reference groupMember (Rule 2.1)`
        );
        assert.equal(
            /\bgroupId\b/i.test(content),
            false,
            `File ${file} must NOT reference groupId (Rule 2.1)`
        );
    }
});

test('Rule 2.6 compliance: Strict button icons and pure Vietnamese labels in StudentDashboardPage', () => {
    const src = read('src/pages/student/StudentDashboardPage.jsx');
    const forbiddenSymbolsRegex = /[←→+🤖📋✓✏️👥🗑️🔓▾▴↗⚠️❌]/;
    const buttonRegex = /<(?:button|Button)\b[^>]*>([\s\S]*?)<\/(?:button|Button)>/g;
    let match;
    while ((match = buttonRegex.exec(src)) !== null) {
        const textOnly = match[1].replace(/<[^>]+>/g, '').trim();
        assert.equal(
            forbiddenSymbolsRegex.test(textOnly),
            false,
            `Button contains forbidden raw symbol: "${textOnly}"`
        );
    }
});

test('App.jsx mounts StudentWorkHubPage for /student/submissions route', () => {
    const appSrc = read('src/App.jsx');

    // Must lazy load StudentWorkHubPage
    assert.match(
        appSrc,
        /const StudentWorkHubPage = lazy\(\(\) => import\(['"]\.\/pages\/student\/StudentWorkHubPage['"]\)\);/,
        'App.jsx must lazy import StudentWorkHubPage'
    );

    // Route /student/submissions must render StudentWorkHubPage
    assert.match(
        appSrc,
        /<Route path="submissions" element=\{<StudentWorkHubPage \/>\} \/>/,
        'App.jsx route submissions must render <StudentWorkHubPage />'
    );

    // my-submissions route guard must include archival permissions
    assert.match(
        appSrc,
        /featureKey="my-submissions"[^>]*'VIEW_MY_ARCHIVE'/,
        'App.jsx my-submissions route guard must include VIEW_MY_ARCHIVE'
    );
});

test('Student menu displays "Việc của tôi" and eliminates separate "Lưu chiểu" menu entry', () => {
    const studentUser = {
        role: 'STUDENT',
        permissions: [
            'VIEW_MY_REGISTRATION',
            'VIEW_MY_SUBMISSIONS',
            'VIEW_MY_ARCHIVE',
            'VIEW_MY_GRADES',
            'REGISTER_TOPIC',
            'SUBMIT_BM01',
            'SUBMIT_BM02',
            'SUBMIT_TASK',
            'SUBMIT_PRE_DEFENSE_ARCHIVE',
            'SUBMIT_FINAL_ARCHIVE',
        ],
    };

    const nav = getVisibleNavigation(studentUser);
    const visibleItems = nav.flatMap((g) => g.items);

    // my-submissions must be labeled "Việc của tôi"
    const submissionsItem = visibleItems.find((i) => i.key === 'my-submissions');
    assert.ok(submissionsItem, 'my-submissions must be present in visible navigation');
    assert.equal(submissionsItem.label, 'Việc của tôi');
    assert.equal(submissionsItem.route, '/student/submissions');

    // my-archive must NOT exist as a standalone menu item
    const archiveItem = visibleItems.find((i) => i.key === 'my-archive');
    assert.equal(archiveItem, undefined, 'my-archive must NOT appear as a separate menu item');

    // Exactly 3 menu items for student: Tìm & đăng ký đề tài, Việc của tôi, Kết quả & điểm đồ án
    assert.deepEqual(
        visibleItems.map((i) => ({ key: i.key, label: i.label, route: i.route })),
        [
            { key: 'my-registration', label: 'Tìm & đăng ký đề tài', route: '/student/topics' },
            { key: 'my-submissions', label: 'Việc của tôi', route: '/student/submissions' },
            { key: 'my-grades', label: 'Kết quả & điểm đồ án', route: '/student/grades' },
        ]
    );

    // Total registry items is now 26 (down from 27)
    assert.equal(NAVIGATION_REGISTRY.length, 26, 'NAVIGATION_REGISTRY must have 26 items without my-archive menu');
});

test('Archival permissions VIEW_MY_ARCHIVE and SUBMIT_FINAL_ARCHIVE remain active in policy system', () => {
    const archiveOnlyStudent = {
        role: 'STUDENT',
        permissions: ['VIEW_MY_ARCHIVE', 'SUBMIT_FINAL_ARCHIVE'],
    };

    // Can still view policy 'my-archive'
    assert.equal(canViewFeature(archiveOnlyStudent, 'my-archive'), true);
    // Can view policy 'my-submissions'
    assert.equal(canViewFeature(archiveOnlyStudent, 'my-submissions'), true);

    const fullStudent = {
        role: 'STUDENT',
        permissions: ['VIEW_MY_SUBMISSIONS', 'SUBMIT_PRE_DEFENSE_ARCHIVE', 'SUBMIT_FINAL_ARCHIVE'],
    };
    assert.equal(canViewFeature(fullStudent, 'my-submissions'), true);
});

test('StudentDashboardPage CTAs link directly to /student/submissions?work=<KIND>', () => {
    const dashSrc = read('src/pages/student/StudentDashboardPage.jsx');

    // Step 2 outline deep link
    assert.match(dashSrc, /\/student\/submissions\?work=BM01_INITIAL/, 'Step 2 must navigate to ?work=BM01_INITIAL');

    // Step 4 progress deep link
    assert.match(dashSrc, /\/student\/submissions\?work=BM03_ACK/, 'Step 4 must navigate to ?work=BM03_ACK');

    // Step 5 advisor review deep link
    assert.match(dashSrc, /\/student\/submissions\?work=BM04/, 'Step 5 must navigate to ?work=BM04');

    // Checkpoint action banner deep links
    assert.match(dashSrc, /\/student\/submissions\?work=BM03_APPEAL/, 'Checkpoint appeal must link ?work=BM03_APPEAL');

    // Archive banner deep link
    assert.match(dashSrc, /\/student\/submissions\?work=SUBMIT_ARCHIVE/, 'Archive banner must link ?work=SUBMIT_ARCHIVE');
});

test('NotificationsPage resolves student notifications to /student/submissions?work=<KIND>', () => {
    const notifSrc = read('src/pages/common/NotificationsPage.jsx');

    // BM01 notification routing
    assert.match(notifSrc, /\/student\/submissions\?work=BM01_INITIAL/, 'Must route BM01 notifications to ?work=BM01_INITIAL');
    assert.match(notifSrc, /\/student\/submissions\?work=BM01_RESUBMIT/, 'Must route BM01 resubmission notifications to ?work=BM01_RESUBMIT');

    // BM02 notification routing
    assert.match(notifSrc, /\/student\/submissions\?work=BM02/, 'Must route BM02 notifications to ?work=BM02');

    // BM03 and Checkpoint notification routing
    assert.match(notifSrc, /\/student\/submissions\?work=BM03_ACK/, 'Must route BM03 notifications to ?work=BM03_ACK');
    assert.match(notifSrc, /\/student\/submissions\?work=BM03_APPEAL/, 'Must route BM03 appeal notifications to ?work=BM03_APPEAL');

    // Archival notification routing
    assert.match(notifSrc, /\/student\/submissions\?work=SUBMIT_ARCHIVE/, 'Must route archive notifications to ?work=SUBMIT_ARCHIVE');
});

test('StudentWorkHubPage backward compatibility: maps ?tab=archive to SUBMIT_ARCHIVE', () => {
    const hubSrc = read('src/pages/student/StudentWorkHubPage.jsx');

    // Search params handling
    assert.match(hubSrc, /useSearchParams\(\)/);
    assert.match(hubSrc, /searchParams\.get\(['"]work['"]\)/);
    assert.match(hubSrc, /searchParams\.get\(['"]tab['"]\)/);

    // Legacy tab=archive mapping
    assert.match(
        hubSrc,
        /tabParam === ['"]archive['"] \? ['"]SUBMIT_ARCHIVE['"] : workParam/,
        'StudentWorkHubPage must map tab=archive to SUBMIT_ARCHIVE'
    );
});
