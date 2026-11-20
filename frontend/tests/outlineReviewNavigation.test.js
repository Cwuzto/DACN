import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FEATURE_POLICIES } from '../src/auth/featurePolicies.js';
import { NAVIGATION_REGISTRY } from '../src/config/navigationRegistry.js';
import { getVisibleNavigation, canViewFeature } from '../src/auth/policyEvaluator.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Navigation files exist and are valid UTF-8 without BOM (Rule 2.4)', () => {
    const files = [
        'src/App.jsx',
        'src/auth/featurePolicies.js',
        'src/pages/lecturer/LecturerDashboardPage.jsx',
        'src/pages/common/NotificationsPage.jsx',
        'tests/outlineReviewNavigation.test.js',
    ];

    for (const rel of files) {
        const filePath = path.join(root, rel);
        assert.ok(fs.existsSync(filePath), `File ${rel} must exist`);
        const buffer = fs.readFileSync(filePath);
        const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.equal(hasBOM, false, `File ${rel} must not have UTF-8 BOM`);
    }
});

test('Navigation files adhere to Rule 2.1 (TopicRegistration model, no group/groupMember)', () => {
    const files = [
        'src/App.jsx',
        'src/auth/featurePolicies.js',
        'src/pages/lecturer/LecturerDashboardPage.jsx',
        'src/pages/common/NotificationsPage.jsx',
    ];

    for (const rel of files) {
        const src = read(rel);
        assert.doesNotMatch(src, /\bgroupMember\b/i, `${rel} must not use legacy groupMember`);
        assert.doesNotMatch(src, /\bgroupMembers\b/i, `${rel} must not use legacy groupMembers`);
    }
});

test('App.jsx declares lazy OutlineReviewPage and registers protected route outline-evaluations with outline-reviews guard', () => {
    const appSrc = read('src/App.jsx');

    // 1. Lazy import of OutlineReviewPage
    assert.match(
        appSrc,
        /const\s+OutlineReviewPage\s*=\s*lazy\(\(\)\s*=>\s*import\(['"]\.\/pages\/lecturer\/OutlineReviewPage['"]\)\);?/,
        'App.jsx must lazy import OutlineReviewPage'
    );

    // 2. Route outline-evaluations wrapped by featureKey="outline-reviews"
    assert.match(
        appSrc,
        /<Route[^>]*featureKey=["']outline-reviews["'][^>]*>[\s\S]*?<Route\s+path=["']outline-evaluations["']\s+element=\{<OutlineReviewPage\s*\/>\}[\s\S]*?<\/Route>/,
        'App.jsx must register outline-evaluations route protected by outline-reviews featureKey and rendering OutlineReviewPage'
    );
});

test('featurePolicies.js configures outline-reviews with route /lecturer/outline-evaluations', () => {
    const policy = FEATURE_POLICIES['outline-reviews'];
    assert.ok(policy, 'FEATURE_POLICIES must define outline-reviews');
    assert.equal(policy.key, 'outline-reviews');
    assert.equal(policy.workspace, 'lecturer');
    assert.equal(policy.route, '/lecturer/outline-evaluations');
    assert.equal(policy.assignment, 'outlineCouncil');
    assert.ok(
        policy.viewAnyOf.includes('VIEW_OUTLINE_REVIEWS'),
        'outline-reviews viewAnyOf must include VIEW_OUTLINE_REVIEWS'
    );
    assert.ok(
        policy.viewAnyOf.includes('OUTLINE_REVIEW'),
        'outline-reviews viewAnyOf must include OUTLINE_REVIEW'
    );
    assert.ok(
        policy.viewAnyOf.includes('OUTLINE_APPROVE'),
        'outline-reviews viewAnyOf must include OUTLINE_APPROVE'
    );
    assert.equal(policy.actions?.review, 'OUTLINE_REVIEW');
    assert.equal(policy.actions?.approve, 'OUTLINE_APPROVE');
});

test('Sidebar menu "Thẩm định đề cương" points to /lecturer/outline-evaluations in registry and visible navigation', () => {
    // 1. In NAVIGATION_REGISTRY projection
    const regItem = NAVIGATION_REGISTRY.find((item) => item.key === 'outline-reviews');
    assert.ok(regItem, 'outline-reviews must exist in NAVIGATION_REGISTRY');
    assert.equal(regItem.label, 'Thẩm định đề cương');
    assert.equal(regItem.route, '/lecturer/outline-evaluations');
    assert.equal(regItem.requiresOutlineCouncil, true);

    // 2. Visible navigation for lecturer with council assignment
    const councilLecturer = {
        role: 'LECTURER',
        permissions: ['VIEW_MY_TOPICS', 'VIEW_MENTORED_STUDENTS', 'VIEW_OUTLINE_REVIEWS', 'OUTLINE_REVIEW'],
        hasOutlineCouncilAssignment: true,
        hasDefenseCouncilAssignment: false,
    };

    const visibleGroups = getVisibleNavigation(councilLecturer);
    const allItems = visibleGroups.flatMap((g) => g.items);
    const outlineItem = allItems.find((i) => i.key === 'outline-reviews');

    assert.ok(outlineItem, 'Council lecturer must see outline-reviews in navigation');
    assert.equal(outlineItem.label, 'Thẩm định đề cương');
    assert.equal(outlineItem.route, '/lecturer/outline-evaluations');
});

test('LecturerDashboardPage navigates outline review CTA to /lecturer/outline-evaluations and does not use legacy /lecturer/approvals?tab=bm01', () => {
    const dashboardSrc = read('src/pages/lecturer/LecturerDashboardPage.jsx');

    assert.doesNotMatch(
        dashboardSrc,
        /\/lecturer\/approvals\?tab=bm01/,
        'LecturerDashboardPage must not link to legacy /lecturer/approvals?tab=bm01'
    );

    assert.match(
        dashboardSrc,
        /\/lecturer\/outline-evaluations/,
        'LecturerDashboardPage must navigate to /lecturer/outline-evaluations for outline evaluations'
    );

    // Rule 2.6: Buttons must use Ant Design icon prop and pure Vietnamese labels
    const forbidden = /[🖨️←→+📋✓✏️👥🗑️🔓▾▴↗✕🤖]/;
    const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
    let match;
    while ((match = btnRegex.exec(dashboardSrc)) !== null) {
        const label = match[1].replace(/<[^>]+>/g, '').trim();
        if (label) {
            assert.ok(!forbidden.test(label), `Dashboard button "${label}" violates Rule 2.6`);
        }
    }
});

test('NotificationsPage routes outline evaluation notifications to /lecturer/outline-evaluations', () => {
    const notifSrc = read('src/pages/common/NotificationsPage.jsx');

    assert.doesNotMatch(
        notifSrc,
        /\/lecturer\/approvals\?tab=outline/,
        'NotificationsPage must not route outline notifications to legacy /lecturer/approvals?tab=outline'
    );

    assert.match(
        notifSrc,
        /\(text\.includes\(['"]đề cương['"]\)\s*\|\|\s*text\.includes\(['"]bm01['"]\)\)\s*return\s*['"]\/lecturer\/outline-evaluations['"]/,
        'NotificationsPage must route outline notifications to /lecturer/outline-evaluations'
    );
});

test('Backward compatibility: TopicApprovalPage redirects legacy ?tab=bm01 and ?tab=outline to /lecturer/outline-evaluations', () => {
    const approvalSrc = read('src/pages/lecturer/TopicApprovalPage.jsx');

    assert.match(
        approvalSrc,
        /tabParam === ['"]bm01['"]\s*\|\|\s*tabParam === ['"]outline['"]|tabParam === ['"]outline['"]\s*\|\|\s*tabParam === ['"]bm01['"]/,
        'TopicApprovalPage must intercept ?tab=bm01 and ?tab=outline'
    );

    assert.match(
        approvalSrc,
        /Navigate\s+to=\{`\/lecturer\/outline-evaluations/,
        'TopicApprovalPage must redirect to /lecturer/outline-evaluations'
    );
});
