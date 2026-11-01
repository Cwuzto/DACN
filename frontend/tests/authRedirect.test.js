import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getRoleHomePath,
    getRouteRedirect,
    hasPermissionOrGroup,
} from '../src/utils/authRedirect.js';

test('maps known roles to their own dashboard and unknown users to the portal', () => {
    assert.equal(getRoleHomePath('ADMIN'), '/admin/dashboard');
    assert.equal(getRoleHomePath({ role: 'LECTURER' }), '/lecturer/dashboard');
    assert.equal(getRoleHomePath({ role: 'STUDENT' }), '/student/dashboard');
    assert.equal(getRoleHomePath(null), '/');
});

test('redirects unauthenticated access to the public portal', () => {
    assert.equal(getRouteRedirect({ isAuthenticated: false, user: null }), '/');
});

test('redirects a signed-in user away from another role portal', () => {
    assert.equal(getRouteRedirect({
        isAuthenticated: true,
        user: { role: 'STUDENT' },
        allowedRoles: ['ADMIN'],
    }), '/student/dashboard');
});

test('allows institute routes only with the permission or institute group', () => {
    const route = {
        isAuthenticated: true,
        allowedRoles: ['LECTURER'],
        requiredPermissions: ['PROJECT_ASSIGNMENT_PUBLISH'],
        allowedPermissionGroups: ['VIEN_TRUONG'],
    };

    assert.equal(getRouteRedirect({
        ...route,
        user: { role: 'LECTURER', permissions: ['PROJECT_ASSIGNMENT_PUBLISH'] },
    }), null);
    assert.equal(getRouteRedirect({
        ...route,
        user: { role: 'LECTURER', permissionGroups: [{ code: 'VIEN_TRUONG' }] },
    }), null);
    assert.equal(getRouteRedirect({
        ...route,
        user: { role: 'LECTURER', permissionGroups: ['GVHD'], permissions: [] },
    }), '/lecturer/dashboard');
});

test('permission helper accepts either the complete permission set or an allowed group', () => {
    assert.equal(hasPermissionOrGroup(
        { permissions: ['A', 'B'] },
        ['A', 'B'],
        ['MANAGER'],
    ), true);
    assert.equal(hasPermissionOrGroup(
        { permissionGroups: ['MANAGER'] },
        ['A'],
        ['MANAGER'],
    ), true);
    assert.equal(hasPermissionOrGroup(
        { permissions: ['A'] },
        ['A', 'B'],
        ['MANAGER'],
    ), false);
});

test('route guard supports an explicit any-permission capability boundary', () => {
    const base = {
        isAuthenticated: true,
        allowedRoles: ['ADMIN'],
        requiredAnyPermissions: ['OUTLINE_COUNCIL_MANAGE', 'DEFENSE_COUNCIL_MANAGE'],
    };

    assert.equal(getRouteRedirect({
        ...base,
        user: { role: 'ADMIN', permissions: ['OUTLINE_COUNCIL_MANAGE'] },
    }), null);
    assert.equal(getRouteRedirect({
        ...base,
        user: { role: 'ADMIN', permissions: [] },
    }), '/admin/dashboard');
});
