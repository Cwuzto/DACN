import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRouteRedirect } from '../src/utils/authRedirect.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appPath = path.join(root, 'src/App.jsx');
const appSource = fs.readFileSync(appPath, 'utf8');

test('App.jsx strictly guards /student workspace and role dashboards against cross-role navigation', () => {
    // 1. /student routes are protected with allowedRoles={['STUDENT']}
    assert.match(
        appSource,
        /<Route\s+element=\{<ProtectedRoute\s+allowedRoles=\{\['STUDENT'\]\}\s*\/>\}>[\s\S]*?<Route\s+path="\/student"/,
        '/student workspace must be enclosed by ProtectedRoute with allowedRoles={["STUDENT"]}'
    );

    // 2. /admin dashboard is protected with allowedRoles={['ADMIN']}
    assert.match(
        appSource,
        /<Route\s+element=\{<ProtectedRoute\s+[^>]*allowedRoles=\{\['ADMIN'\]\}[^>]*\/>\}>[\s\S]*?<Route\s+path="dashboard"\s+element=\{<DashboardPage/,
        '/admin dashboard must be protected with allowedRoles={["ADMIN"]}'
    );

    // 3. /lecturer dashboard is protected with allowedRoles={['LECTURER']}
    assert.match(
        appSource,
        /<Route\s+element=\{<ProtectedRoute\s+[^>]*allowedRoles=\{\['LECTURER'\]\}[^>]*\/>\}>[\s\S]*?<Route\s+path="dashboard"\s+element=\{<LecturerDashboardPage/,
        '/lecturer dashboard must be protected with allowedRoles={["LECTURER"]}'
    );
});

test('getRouteRedirect redirects ADMIN away from /student workspace back to /admin/dashboard', () => {
    const adminUser = {
        id: 1,
        role: 'ADMIN',
        permissions: ['VIEW_USERS', 'PERMISSION_GROUP_MANAGE'],
    };

    const redirectPath = getRouteRedirect({
        isAuthenticated: true,
        user: adminUser,
        allowedRoles: ['STUDENT'],
    });

    assert.equal(
        redirectPath,
        '/admin/dashboard',
        'ADMIN attempting to access student space must redirect to /admin/dashboard'
    );
});

test('getRouteRedirect redirects LECTURER away from /student workspace back to /lecturer/dashboard', () => {
    const lecturerUser = {
        id: 2,
        role: 'LECTURER',
        permissions: ['VIEW_MY_TOPICS', 'TOPIC_CREATE'],
    };

    const redirectPath = getRouteRedirect({
        isAuthenticated: true,
        user: lecturerUser,
        allowedRoles: ['STUDENT'],
    });

    assert.equal(
        redirectPath,
        '/lecturer/dashboard',
        'LECTURER attempting to access student space must redirect to /lecturer/dashboard'
    );
});

test('getRouteRedirect allows legitimate STUDENT to access /student workspace', () => {
    const studentUser = {
        id: 3,
        role: 'STUDENT',
        permissions: ['VIEW_MY_REGISTRATION', 'VIEW_MY_SUBMISSIONS'],
    };

    const redirectPath = getRouteRedirect({
        isAuthenticated: true,
        user: studentUser,
        allowedRoles: ['STUDENT'],
    });

    assert.equal(
        redirectPath,
        null,
        'STUDENT must be allowed to access /student workspace without redirection'
    );
});

test('getRouteRedirect redirects STUDENT away from /admin and /lecturer dashboards to /student/dashboard', () => {
    const studentUser = {
        id: 3,
        role: 'STUDENT',
        permissions: ['VIEW_MY_REGISTRATION'],
    };

    const adminRedirect = getRouteRedirect({
        isAuthenticated: true,
        user: studentUser,
        allowedRoles: ['ADMIN'],
    });
    assert.equal(adminRedirect, '/student/dashboard', 'STUDENT accessing /admin/dashboard must redirect to /student/dashboard');

    const lecturerRedirect = getRouteRedirect({
        isAuthenticated: true,
        user: studentUser,
        allowedRoles: ['LECTURER'],
    });
    assert.equal(lecturerRedirect, '/student/dashboard', 'STUDENT accessing /lecturer/dashboard must redirect to /student/dashboard');
});

