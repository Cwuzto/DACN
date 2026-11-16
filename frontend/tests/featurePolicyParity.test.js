import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FEATURE_POLICIES } from '../src/auth/featurePolicies.js';
import {
    canViewFeature,
    canPerformFeatureAction,
    getVisibleNavigation,
    getEffectivePermissions,
} from '../src/auth/policyEvaluator.js';
import {
    NAVIGATION_REGISTRY,
    NAVIGATION_GROUPS,
} from '../src/config/navigationRegistry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSource = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');

test('FEATURE_POLICIES manifest defines valid entries with required schema', () => {
    assert.ok(FEATURE_POLICIES, 'FEATURE_POLICIES must exist');

    const policies = Array.isArray(FEATURE_POLICIES)
        ? FEATURE_POLICIES
        : Object.values(FEATURE_POLICIES);

    assert.ok(policies.length >= 25, 'Manifest must contain at least 25 policies');

    const validWorkspaces = new Set(['admin', 'lecturer', 'student']);
    const seenKeys = new Set();

    for (const policy of policies) {
        assert.ok(policy.key, 'Policy must have a non-empty key');
        assert.ok(!seenKeys.has(policy.key), `Duplicate policy key: ${policy.key}`);
        seenKeys.add(policy.key);

        assert.ok(
            validWorkspaces.has(policy.workspace),
            `Policy ${policy.key} must have valid workspace: ${policy.workspace}`
        );
        assert.ok(policy.route, `Policy ${policy.key} must have route string`);

        if (policy.menu) {
            assert.ok(policy.menu.label, `Policy ${policy.key} menu must have label`);
            assert.ok(policy.menu.icon, `Policy ${policy.key} menu must have icon`);
            assert.ok(
                NAVIGATION_GROUPS.includes(policy.menu.group),
                `Policy ${policy.key} menu group "${policy.menu.group}" must be in NAVIGATION_GROUPS`
            );
        }

        assert.ok(
            Array.isArray(policy.viewAnyOf),
            `Policy ${policy.key} viewAnyOf must be an array`
        );
    }
});

test('Parity: Every item in NAVIGATION_REGISTRY maps exactly to one FEATURE_POLICIES entry', () => {
    assert.equal(NAVIGATION_REGISTRY.length, 25, 'NAVIGATION_REGISTRY must have exactly 25 items');

    const policyMap = new Map();
    const policies = Array.isArray(FEATURE_POLICIES)
        ? FEATURE_POLICIES
        : Object.values(FEATURE_POLICIES);

    for (const p of policies) {
        policyMap.set(p.key, p);
    }

    for (const item of NAVIGATION_REGISTRY) {
        const policy = policyMap.get(item.key);
        assert.ok(policy, `Item ${item.key} in NAVIGATION_REGISTRY must exist in FEATURE_POLICIES`);
        assert.ok(policy.menu, `Policy ${item.key} must have menu metadata`);
        assert.equal(policy.menu.label, item.label, `Label mismatch for ${item.key}`);
        assert.equal(policy.menu.icon, item.icon, `Icon mismatch for ${item.key}`);
        assert.equal(policy.menu.group, item.group, `Group mismatch for ${item.key}`);
        assert.equal(policy.route, item.route, `Route mismatch for ${item.key}`);
    }
});

test('Parity: Every protected application route in App.jsx maps to a feature policy', () => {
    // Collect all featureKey props on ProtectedRoute in App.jsx
    const featureKeyMatches = [...appSource.matchAll(/<ProtectedRoute[^>]*featureKey="([^"]+)"/g)].map(m => m[1]);
    assert.ok(featureKeyMatches.length > 0, 'App.jsx must use featureKey on ProtectedRoutes');

    const policyMap = new Map();
    const policies = Array.isArray(FEATURE_POLICIES)
        ? FEATURE_POLICIES
        : Object.values(FEATURE_POLICIES);

    for (const p of policies) {
        policyMap.set(p.key, p);
    }

    for (const key of featureKeyMatches) {
        assert.ok(policyMap.has(key), `App.jsx references featureKey="${key}" which is missing in FEATURE_POLICIES`);
    }
});

test('Archive menu and route agreement: VIEW_MY_ARCHIVE allows both menu and /student/submissions route', () => {
    const archiveUser = {
        role: 'STUDENT',
        permissions: ['VIEW_MY_ARCHIVE'],
    };

    assert.equal(canViewFeature(archiveUser, 'my-archive'), true);
    assert.equal(canViewFeature(archiveUser, 'my-submissions'), true);

    const nav = getVisibleNavigation(archiveUser);
    const archiveItem = nav.flatMap(g => g.items).find(i => i.key === 'my-archive');
    assert.ok(archiveItem, 'my-archive menu item must be visible for user with VIEW_MY_ARCHIVE');
});

test('REPORT_VIEW: User with only REPORT_VIEW can view academic-reports and route /admin/reports', () => {
    const reportUser = {
        role: 'LECTURER',
        permissions: ['REPORT_VIEW'],
    };

    assert.equal(canViewFeature(reportUser, 'academic-reports'), true);

    const nav = getVisibleNavigation(reportUser);
    const reportItem = nav.flatMap(g => g.items).find(i => i.key === 'academic-reports');
    assert.ok(reportItem, 'academic-reports menu item must be visible for user with REPORT_VIEW');
});

test('No synthetic permissions injected for GIAO_VU in policy evaluator or navigation', () => {
    // User with group GIAO_VU but WITHOUT VIEW_PROJECT_ENROLLMENTS in permissions
    const giaoVuWithoutPerm = {
        role: 'LECTURER',
        permissions: ['VIEW_ALL_TOPICS'],
        permissionGroups: ['GIAO_VU'],
    };

    assert.equal(
        canViewFeature(giaoVuWithoutPerm, 'project-enrollments'),
        false,
        'GIAO_VU without explicit VIEW_PROJECT_ENROLLMENTS capability must NOT view project-enrollments'
    );

    const nav = getVisibleNavigation(giaoVuWithoutPerm);
    const allItems = nav.flatMap(g => g.items);
    assert.ok(
        !allItems.some(i => i.key === 'project-enrollments'),
        'project-enrollments must NOT be synthesized for GIAO_VU'
    );
});

test('No Admin bypass: Admin without council capabilities cannot view councils or grading', () => {
    const adminWithoutCouncil = {
        role: 'ADMIN',
        permissions: ['VIEW_USERS', 'VIEW_PERMISSIONS'],
        hasDefenseCouncilAssignment: false,
        hasOutlineCouncilAssignment: false,
    };

    assert.equal(canViewFeature(adminWithoutCouncil, 'outline-councils'), false);
    assert.equal(canViewFeature(adminWithoutCouncil, 'defense-councils'), false);
    assert.equal(canViewFeature(adminWithoutCouncil, 'defense-grading'), false);

    const nav = getVisibleNavigation(adminWithoutCouncil);
    const allItems = nav.flatMap(g => g.items);
    assert.ok(!allItems.some(i => i.key === 'outline-councils'));
    assert.ok(!allItems.some(i => i.key === 'defense-councils'));
    assert.ok(!allItems.some(i => i.key === 'defense-grading'));
});

test('Five-Persona navigation and view policy consistency', () => {
    // 1. Sinh viên
    const studentUser = {
        role: 'STUDENT',
        permissions: ['VIEW_MY_REGISTRATION', 'VIEW_MY_SUBMISSIONS', 'VIEW_MY_ARCHIVE', 'VIEW_MY_GRADES'],
    };
    assert.equal(canViewFeature(studentUser, 'my-registration'), true);
    assert.equal(canViewFeature(studentUser, 'my-submissions'), true);
    assert.equal(canViewFeature(studentUser, 'my-archive'), true);
    assert.equal(canViewFeature(studentUser, 'my-grades'), true);
    assert.equal(canViewFeature(studentUser, 'users'), false);
    assert.equal(canViewFeature(studentUser, 'my-topics'), false);

    // 2. GVHD without defense assignment
    const gvhdUser = {
        role: 'LECTURER',
        permissions: ['VIEW_MY_TOPICS', 'VIEW_MENTORED_STUDENTS', 'VIEW_CHECKPOINTS', 'VIEW_DEFENSE_GRADING'],
        hasDefenseCouncilAssignment: false,
    };
    assert.equal(canViewFeature(gvhdUser, 'my-topics'), true);
    assert.equal(canViewFeature(gvhdUser, 'mentored-students'), true);
    assert.equal(canViewFeature(gvhdUser, 'progress-checkpoints'), true);
    assert.equal(canViewFeature(gvhdUser, 'defense-grading'), false, 'defense-grading requires defense council assignment');

    // 3. GVHD with defense assignment
    const gvhdWithCouncil = {
        role: 'LECTURER',
        permissions: ['VIEW_MY_TOPICS', 'VIEW_MENTORED_STUDENTS', 'VIEW_CHECKPOINTS', 'VIEW_DEFENSE_GRADING'],
        hasDefenseCouncilAssignment: true,
    };
    assert.equal(canViewFeature(gvhdWithCouncil, 'defense-grading'), true);

    // 4. Viện trưởng
    const vienTruongUser = {
        role: 'LECTURER',
        permissions: [
            'VIEW_MY_TOPICS', 'VIEW_MENTORED_STUDENTS', 'VIEW_CHECKPOINTS',
            'VIEW_OUTLINE_REVIEWS', 'OUTLINE_COUNCIL_MANAGE', 'DEFENSE_COUNCIL_MANAGE',
            'VIEW_DEFENSE_GRADING', 'VIEW_DEFENSE_LOCK_LEDGER', 'VIEW_DEFENSE_RESULT_APPROVALS',
            'VIEW_RESULT_PUBLICATIONS', 'VIEW_RUBRIC_CONFIG', 'VIEW_PROJECT_PERIODS',
        ],
        hasDefenseCouncilAssignment: true,
        hasOutlineCouncilAssignment: true,
    };
    assert.equal(canViewFeature(vienTruongUser, 'outline-reviews'), true);
    assert.equal(canViewFeature(vienTruongUser, 'outline-councils'), true);
    assert.equal(canViewFeature(vienTruongUser, 'defense-councils'), true);
    assert.equal(canViewFeature(vienTruongUser, 'defense-result-approvals'), true);
    assert.equal(canViewFeature(vienTruongUser, 'result-publications'), true);

    // 5. Admin kỹ thuật
    const adminUser = {
        role: 'ADMIN',
        permissions: ['VIEW_USERS', 'VIEW_PERMISSIONS', 'VIEW_ANNOUNCEMENTS', 'VIEW_PORTAL_CONTENT', 'VIEW_NOTIFICATIONS', 'VIEW_PROJECT_PERIODS'],
    };
    assert.equal(canViewFeature(adminUser, 'users'), true);
    assert.equal(canViewFeature(adminUser, 'permissions'), true);
    assert.equal(canViewFeature(adminUser, 'announcements'), true);
    assert.equal(canViewFeature(adminUser, 'outline-reviews'), false);
    assert.equal(canViewFeature(adminUser, 'my-registration'), false);
});

test('Action-Level authorization: canPerformFeatureAction separates VIEW from ACTION', () => {
    // View-only user
    const viewOnlyUser = {
        role: 'ADMIN',
        permissions: ['VIEW_USERS'],
    };
    assert.equal(canViewFeature(viewOnlyUser, 'users'), true);
    assert.equal(canPerformFeatureAction(viewOnlyUser, 'users', 'create'), false);
    assert.equal(canPerformFeatureAction(viewOnlyUser, 'users', 'import'), false);
    assert.equal(canPerformFeatureAction(viewOnlyUser, 'users', 'edit'), false);

    // Action user
    const actionUser = {
        role: 'ADMIN',
        permissions: ['VIEW_USERS', 'USER_MANAGE', 'USER_IMPORT'],
    };
    assert.equal(canPerformFeatureAction(actionUser, 'users', 'create'), true);
    assert.equal(canPerformFeatureAction(actionUser, 'users', 'import'), true);
    assert.equal(canPerformFeatureAction(actionUser, 'users', 'edit'), true);
    assert.equal(canPerformFeatureAction(actionUser, 'users', 'delete'), true);
});

test('Scoped delegation: canViewFeature and canPerformFeatureAction respect semesterId and department context', () => {
    const delegatedUser = {
        role: 'LECTURER',
        permissions: ['VIEW_ALL_TOPICS'],
        basePermissions: ['VIEW_ALL_TOPICS'],
        activeDelegations: [
            {
                capabilityCode: 'TOPIC_REVIEW',
                semesterId: 'sem-2026-1',
                department: 'CNTT',
                status: 'ACTIVE',
            },
        ],
    };

    // Within matching semester & department
    assert.equal(
        canPerformFeatureAction(delegatedUser, 'all-topics', 'review', { semesterId: 'sem-2026-1', department: 'CNTT' }),
        true
    );

    // Mismatched semester
    assert.equal(
        canPerformFeatureAction(delegatedUser, 'all-topics', 'review', { semesterId: 'sem-2026-2', department: 'CNTT' }),
        false
    );

    // Mismatched department
    assert.equal(
        canPerformFeatureAction(delegatedUser, 'all-topics', 'review', { semesterId: 'sem-2026-1', department: 'KTPM' }),
        false
    );
});

