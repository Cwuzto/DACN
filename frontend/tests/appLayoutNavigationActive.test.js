import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isNavigationItemActive } from '../src/auth/policyEvaluator.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appLayoutSource = fs.readFileSync(path.join(root, 'src/components/layout/AppLayout.jsx'), 'utf8') +
    fs.readFileSync(path.join(root, 'src/components/layout/NavContent.jsx'), 'utf8');

test('AppLayout uses isNavigationItemActive from policyEvaluator and sets aria-current="page"', () => {
    assert.match(
        appLayoutSource,
        /import\s*\{[^}]*isNavigationItemActive[^}]*\}\s*from\s*['"][^'"]*policyEvaluator['"]/,
        'AppLayout must import isNavigationItemActive from policyEvaluator'
    );
    assert.match(
        appLayoutSource,
        /isNavigationItemActive\(targetRoute,\s*location\.pathname,\s*location\.search\)/,
        'AppLayout isActive must delegate to isNavigationItemActive'
    );
    assert.match(
        appLayoutSource,
        /aria-current=\{[^}]*'page'[^}]*\}/,
        'AppLayout must set aria-current="page" on active navigation items'
    );
});

test('isNavigationItemActive matches pathname + normalized tab regardless of unrelated params or param order', () => {
    assert.equal(
        isNavigationItemActive('/admin/grading?tab=approvals', '/admin/grading', '?semesterId=2&tab=approvals'),
        true
    );
    assert.equal(
        isNavigationItemActive('/admin/grading?tab=approvals', '/admin/grading', '?tab=approvals&semesterId=2'),
        true
    );
    assert.equal(
        isNavigationItemActive('/admin/grading?tab=approvals', '/admin/grading', '?tab=APPROVALS&semesterId=2'),
        true
    );
    assert.equal(
        isNavigationItemActive('/admin/grading?tab=publish', '/admin/grading', '?semesterId=2&tab=approvals'),
        false
    );
    assert.equal(
        isNavigationItemActive('/admin/grading', '/admin/grading', '?semesterId=2&tab=approvals'),
        false,
        'Base route without tab must not be active when a registered sibling tab matches'
    );
    assert.equal(
        isNavigationItemActive('/admin/grading', '/admin/grading', '?semesterId=2'),
        true,
        'Base route without tab remains active when only unrelated params are present'
    );
});

test('isNavigationItemActive handles lecturer approvals tabs and default mentor tab', () => {
    assert.equal(
        isNavigationItemActive('/lecturer/approvals?tab=mentor', '/lecturer/approvals', '?tab=mentor'),
        true
    );
    assert.equal(
        isNavigationItemActive('/lecturer/approvals?tab=mentor', '/lecturer/approvals', ''),
        true
    );
    assert.equal(
        isNavigationItemActive('/lecturer/approvals?tab=bm01', '/lecturer/approvals', '?tab=mentor'),
        false
    );
    assert.equal(
        isNavigationItemActive('/lecturer/approvals?tab=bm01', '/lecturer/approvals', '?tab=bm01&semesterId=5'),
        true
    );
});
