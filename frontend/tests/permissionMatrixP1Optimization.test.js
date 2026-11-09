import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    ACADEMIC_PROTECTED_PERMISSIONS,
    TECHNICAL_PERMISSIONS,
    CANONICAL_ALIAS_MAP,
    REVERSE_ALIAS_MAP,
    isAcademicProtected,
    isTechnical,
    isViewPermission,
    isActionPermission,
    isAliasPermission,
    getCanonicalCode,
    getAliasCode,
} from '../src/config/permissionsConfig.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageSource = fs.readFileSync(path.join(root, 'src/pages/admin/PermissionGroupPage.jsx'), 'utf8');

test('permissionsConfig accurately classifies protected, technical and alias permissions', () => {
    // 48 Academic Protected
    assert.equal(ACADEMIC_PROTECTED_PERMISSIONS.length, 48);
    assert.equal(isAcademicProtected('TOPIC_REVIEW'), true);
    assert.equal(isAcademicProtected('DEFENSE_SCORE_SUBMIT'), true);
    assert.equal(isAcademicProtected('BM04_SUBMIT'), true);
    assert.equal(isAcademicProtected('BM03_CHECKPOINT_DECIDE'), true);
    assert.equal(isAcademicProtected('SIGNATURE_APPEAL_REVIEW'), true);
    assert.equal(isAcademicProtected('CHECKPOINT_ISSUE'), true);
    assert.equal(isAcademicProtected('USER_MANAGE'), false);

    // 26 Technical Permissions
    assert.equal(TECHNICAL_PERMISSIONS.length, 26);
    assert.equal(isTechnical('USER_MANAGE'), true);
    assert.equal(isTechnical('PERMISSION_GROUP_MANAGE'), true);
    assert.equal(isTechnical('TOPIC_REVIEW'), false);

    // 10 Canonical Aliases
    const aliases = Object.keys(CANONICAL_ALIAS_MAP);
    assert.equal(aliases.length, 10);
    assert.equal(CANONICAL_ALIAS_MAP['VIEW_MENTORED_STUDENTS'], 'VIEW_MENTOR_STUDENTS');
    assert.equal(CANONICAL_ALIAS_MAP['VIEW_ASSIGNMENT_DECISIONS'], 'VIEW_TOPIC_ASSIGNMENT_DECISIONS');
    assert.equal(CANONICAL_ALIAS_MAP['VIEW_COUNCIL_ASSIGNMENTS'], 'VIEW_DEFENSE_ASSIGNMENTS');
    assert.equal(CANONICAL_ALIAS_MAP['VIEW_DEFENSE_LOCK_LEDGER'], 'VIEW_RESULT_LOCKS');
    assert.equal(CANONICAL_ALIAS_MAP['VIEW_DEFENSE_RESULT_APPROVALS'], 'VIEW_DEFENSE_RESULTS_APPROVAL');

    // Classification helpers
    assert.equal(isViewPermission('VIEW_MY_TOPICS'), true);
    assert.equal(isViewPermission('TOPIC_CREATE'), false);
    assert.equal(isActionPermission('TOPIC_CREATE'), true);
    assert.equal(isActionPermission('VIEW_MY_TOPICS'), false);
    assert.equal(isAliasPermission('VIEW_MENTORED_STUDENTS'), true);
    assert.equal(isAliasPermission('VIEW_MENTOR_STUDENTS'), false);
    assert.equal(getCanonicalCode('VIEW_MENTORED_STUDENTS'), 'VIEW_MENTOR_STUDENTS');
    assert.equal(getAliasCode('VIEW_MENTOR_STUDENTS'), 'VIEW_MENTORED_STUDENTS');
});

test('PermissionGroupPage includes module accordion, filter dimensions, and alias grouping', () => {
    // Accordion / Collapsible modules check
    assert.match(
        pageSource,
        /(openModules|expandedModules|toggleModule|expandAll|collapseAll)/i,
        'PermissionGroupPage must support accordion / expand-collapse for modules'
    );

    // Filter type (All / Action / View)
    assert.match(
        pageSource,
        /(permTypeFilter|action.*view|isActionPermission|isViewPermission)/i,
        'PermissionGroupPage must provide action vs view filtering'
    );

    // Protection category filter / indicator
    assert.match(
        pageSource,
        /(protectionFilter|isAcademicProtected|ACADEMIC_PROTECTED)/i,
        'PermissionGroupPage must identify and filter academic protected permissions'
    );

    // Canonical alias grouping / collapsing
    assert.match(
        pageSource,
        /(groupAliases|hideAliases|CANONICAL_ALIAS_MAP|isAliasPermission|getAliasCode)/i,
        'PermissionGroupPage must support grouping canonical aliases'
    );

    // Check for user academic permission check (PERMISSION_ASSIGN_ACADEMIC)
    assert.match(
        pageSource,
        /PERMISSION_ASSIGN_ACADEMIC/,
        'PermissionGroupPage must check for PERMISSION_ASSIGN_ACADEMIC capability'
    );
});

