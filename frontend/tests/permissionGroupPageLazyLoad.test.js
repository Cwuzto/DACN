import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageSource = fs.readFileSync(path.join(root, 'src/pages/admin/PermissionGroupPage.jsx'), 'utf8');

test('PermissionGroupPage does not call fetchGroupsData unconditionally on mount alongside fetchMatrix', () => {
    // Should NOT have both fetchMatrix() and fetchGroupsData() called together in a single unconditioned mount useEffect
    const unconditionedBothMount = /useEffect\(\s*\(\)\s*=>\s*\{\s*fetchMatrix\(\);\s*fetchGroupsData\(\);\s*\}\s*,\s*\[fetchMatrix,\s*fetchGroupsData\]\s*\)/;
    assert.equal(
        unconditionedBothMount.test(pageSource),
        false,
        'PermissionGroupPage should lazy-load groups data only when the groups tab is active'
    );
});

test('PermissionGroupPage lets query observers own request lifecycle and shows inline panel errors', () => {
    assert.match(pageSource, /usePermissionMatrix\(scope, activeTab === 'MATRIX'\)/);
    assert.match(pageSource, /usePermissionGroups\(scope, activeTab === 'GROUPS'/);
    assert.match(pageSource, /usePermissionCatalog\(scope, activeTab === 'CATALOG'/);
    assert.match(pageSource, /<QueryPanel query=\{matrixQuery\}/);
    assert.match(pageSource, /<QueryPanel query=\{groupsQuery\}/);
    assert.doesNotMatch(pageSource, /permissionService\.(getPermissionMatrix|listGroups|listPermissions)/);
});
