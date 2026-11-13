import test from 'node:test';
import assert from 'node:assert/strict';
import { hashKey } from '@tanstack/react-query';
import { queryKeys } from '../src/query/queryKeys.js';

const domains = ['grading', 'archives', 'registrations', 'semesters', 'users', 'permissions', 'councils', 'topics', 'notifications'];

test('scope distinguishes anonymous, identities, and permission versions', () => {
    assert.deepEqual(queryKeys.scope(null), ['scope', null, null]);
    assert.deepEqual(queryKeys.scope({ id: 'u1', permissionVersion: 0 }), ['scope', 'u1', 0]);
    assert.notDeepEqual(queryKeys.scope({ id: 'u1', permissionVersion: 1 }), queryKeys.scope({ id: 'u2', permissionVersion: 1 }));
    assert.notDeepEqual(queryKeys.scope({ id: 'u1', permissionVersion: 1 }), queryKeys.scope({ id: 'u1', permissionVersion: 2 }));
});

for (const domain of domains) {
    test(`${domain} preserves scope, every filter, detail ID, and invalidation prefixes`, () => {
        const scope = ['scope', 'u1', 2];
        const filters = { semesterId: 's1', page: 1, search: '', status: ['APPROVED'], assigned: false };
        const key = queryKeys[domain].list(scope, filters);
        assert.deepEqual(key, ['scope', 'u1', 2, domain, 'list', filters]);
        assert.deepEqual(queryKeys[domain].all(scope), ['scope', 'u1', 2, domain]);
        assert.deepEqual(queryKeys[domain].lists(scope), ['scope', 'u1', 2, domain, 'list']);
        assert.deepEqual(queryKeys[domain].details(scope), ['scope', 'u1', 2, domain, 'detail']);
        assert.deepEqual(queryKeys[domain].detail(scope, 'record-1', filters), ['scope', 'u1', 2, domain, 'detail', 'record-1', filters]);
        assert.deepEqual(queryKeys[domain].list(scope), ['scope', 'u1', 2, domain, 'list', {}]);
        for (const changed of [
            { semesterId: 's2' }, { page: 2 }, { search: 'abc' },
            { status: ['PENDING'] }, { assigned: true }, { newServerFilter: 'new' },
        ]) {
            assert.notEqual(hashKey(key), hashKey(queryKeys[domain].list(scope, { ...filters, ...changed })));
        }
        assert.notEqual(hashKey(key), hashKey(queryKeys[domain].list(['scope', 'u2', 2], filters)));
        assert.notEqual(hashKey(key), hashKey(queryKeys[domain].list(['scope', 'u1', 3], filters)));
        assert.notDeepEqual(queryKeys[domain].detail(scope, 'record-1'), queryKeys[domain].detail(scope, 'record-2'));
        assert.equal(hashKey(key), hashKey(queryKeys[domain].list(scope, { assigned: false, status: ['APPROVED'], search: '', page: 1, semesterId: 's1' })));
    });
}
