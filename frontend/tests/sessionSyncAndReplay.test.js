import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';

// Mock browser globals for Node test environment before importing modules
const createStorageMock = () => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
        get store() { return store; }
    };
};

globalThis.localStorage = createStorageMock();
globalThis.sessionStorage = createStorageMock();
globalThis.window = {
    location: {
        pathname: '/student/topics',
        replace: (url) => { globalThis.window.location._replaced = url; },
        _replaced: null,
    },
    addEventListener: () => {},
    removeEventListener: () => {},
};

// Import modules to test
import api, { authSyncChannel, authChannel } from '../src/services/api.js';
import useAuthStore from '../src/stores/authStore.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Step 1: BroadcastChannel is initialized on dacn_auth_sync channel', () => {
    assert.ok(authSyncChannel || authChannel, 'authSyncChannel or authChannel must be exported');
    const channel = authSyncChannel || authChannel;
    assert.equal(channel.name, 'dacn_auth_sync');
});

test('Step 2: 409 PERMISSION_VERSION_STALE on GET request triggers /auth/me and automatically replays GET', async () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('token', 'old-token-111');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', permissionVersion: 1 }));

    let authMeCalled = 0;
    let originalGetAttempts = 0;

    // Mock axios.get for /auth/me
    const originalAxiosGet = axios.get;
    axios.get = async (url, config) => {
        if (url.includes('/auth/me')) {
            authMeCalled++;
            assert.match(config?.headers?.Authorization || '', /Bearer old-token-111/);
            return {
                data: {
                    success: true,
                    data: { id: 'u1', fullName: 'Sinh Vien A', permissionVersion: 2, permissions: ['VIEW_MY_REGISTRATION', 'VIEW_MY_SUBMISSIONS'] },
                    token: 'new-token-222',
                },
            };
        }
        return originalAxiosGet(url, config);
    };

    // Mock api adapter to simulate 409 first, then 200 on retry
    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = async (config) => {
        if (config.url?.includes('/test-get-topics')) {
            originalGetAttempts++;
            const authHeader = config.headers?.Authorization || config.headers?.authorization;
            if (originalGetAttempts === 1) {
                // First attempt: returns 409 PERMISSION_VERSION_STALE
                const err = new Error('Request failed with status code 409');
                err.response = {
                    status: 409,
                    data: { error: 'PERMISSION_VERSION_STALE', message: 'Phiên bản quyền đã được cập nhật.' },
                    config,
                };
                err.config = config;
                throw err;
            } else {
                // Second attempt (replay): verify new token is used
                assert.match(authHeader, /Bearer new-token-222/);
                return {
                    status: 200,
                    data: { success: true, topics: [{ id: 't1', title: 'Đồ án 1' }] },
                    headers: {},
                    config,
                };
            }
        }
        return { status: 200, data: { success: true }, headers: {}, config };
    };

    try {
        const result = await api.get('/test-get-topics');
        assert.equal(authMeCalled, 1, 'GET /auth/me should be called once to refresh token');
        assert.equal(originalGetAttempts, 2, 'GET request should be attempted twice (1st failed, 2nd replayed)');
        assert.equal(result.success, true);
        assert.equal(result.topics?.[0]?.id, 't1');
        assert.equal(localStorage.getItem('token'), 'new-token-222', 'localStorage should have updated token');
    } finally {
        axios.get = originalAxiosGet;
        api.defaults.adapter = originalAdapter;
    }
});

test('Step 3: 409 PERMISSION_VERSION_STALE on mutation WITH Idempotency-Key triggers /auth/me and replays mutation', async () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('token', 'old-token-333');

    let authMeCalled = 0;
    let mutationAttempts = 0;

    const originalAxiosGet = axios.get;
    axios.get = async (url) => {
        if (url.includes('/auth/me')) {
            authMeCalled++;
            return {
                data: {
                    success: true,
                    data: { id: 'u1', permissionVersion: 2 },
                    token: 'new-token-444',
                },
            };
        }
    };

    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = async (config) => {
        if (config.url?.includes('/registrations/register')) {
            mutationAttempts++;
            const authHeader = config.headers?.Authorization || config.headers?.authorization;
            if (mutationAttempts === 1) {
                const err = new Error('Request failed with status code 409');
                err.response = {
                    status: 409,
                    data: { error: 'PERMISSION_VERSION_STALE', message: 'Phiên bản quyền đã được cập nhật.' },
                    config,
                };
                err.config = config;
                throw err;
            } else {
                assert.match(authHeader, /Bearer new-token-444/);
                assert.equal(config.headers?.['Idempotency-Key'] || config.headers?.['idempotency-key'], 'ik-register-001');
                return {
                    status: 201,
                    data: { success: true, message: 'Đăng ký thành công' },
                    headers: {},
                    config,
                };
            }
        }
        return { status: 200, data: { success: true }, headers: {}, config };
    };

    try {
        const result = await api.post('/registrations/register', { topicId: 't1' }, {
            headers: { 'Idempotency-Key': 'ik-register-001' },
        });
        assert.equal(authMeCalled, 1);
        assert.equal(mutationAttempts, 2);
        assert.equal(result.success, true);
        assert.equal(result.message, 'Đăng ký thành công');
        assert.equal(localStorage.getItem('token'), 'new-token-444');
    } finally {
        axios.get = originalAxiosGet;
        api.defaults.adapter = originalAdapter;
    }
});

test('Step 4: 409 PERMISSION_VERSION_STALE on mutation WITHOUT Idempotency-Key refetches token but rejects with requiresUserConfirmation', async () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('token', 'old-token-555');

    let authMeCalled = 0;
    let mutationAttempts = 0;

    const originalAxiosGet = axios.get;
    axios.get = async (url) => {
        if (url.includes('/auth/me')) {
            authMeCalled++;
            return {
                data: {
                    success: true,
                    data: { id: 'u1', permissionVersion: 2 },
                    token: 'new-token-666',
                },
            };
        }
    };

    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = async (config) => {
        if (config.url?.includes('/registrations/cancel')) {
            mutationAttempts++;
            const err = new Error('Request failed with status code 409');
            err.response = {
                status: 409,
                data: { error: 'PERMISSION_VERSION_STALE', message: 'Phiên bản quyền đã được cập nhật.' },
                config,
            };
            err.config = config;
            throw err;
        }
        return { status: 200, data: { success: true }, headers: {}, config };
    };

    try {
        await api.post('/registrations/cancel', { reason: 'Muốn đổi đề tài' });
        assert.fail('Should not succeed without user confirmation');
    } catch (err) {
        assert.equal(authMeCalled, 1, '/auth/me should be called to refresh token');
        assert.equal(mutationAttempts, 1, 'Mutation should NOT be replayed automatically');
        assert.equal(err.status, 409);
        assert.equal(err.success, false);
        assert.equal(err.code, 'PERMISSION_VERSION_STALE');
        assert.equal(err.requiresUserConfirmation, true, 'Error must indicate requiresUserConfirmation: true');
        assert.match(err.message, /Vui lòng xác nhận để gửi lại thao tác/);
        assert.equal(localStorage.getItem('token'), 'new-token-666', 'Token should still be updated in storage');
    } finally {
        axios.get = originalAxiosGet;
        api.defaults.adapter = originalAdapter;
    }
});

test('Step 5: 403 Forbidden strictly preserves session and token (no logout redirect)', async () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('token', 'valid-active-token-777');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', role: 'STUDENT' }));
    globalThis.window.location._replaced = null;

    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = async (config) => {
        const err = new Error('Request failed with status code 403');
        err.response = {
            status: 403,
            data: { success: false, message: 'Bạn không có quyền truy cập hội đồng này (COI).' },
            config,
        };
        err.config = config;
        throw err;
    };

    try {
        await api.get('/evaluations/councils/c1/score-sheet');
        assert.fail('Should throw 403');
    } catch (err) {
        assert.equal(err.status, 403);
        assert.equal(err.success, false);
        assert.equal(err.message, 'Bạn không có quyền truy cập hội đồng này (COI).');
        assert.equal(localStorage.getItem('token'), 'valid-active-token-777', 'Token MUST be preserved on 403');
        assert.ok(localStorage.getItem('user'), 'User MUST be preserved on 403');
        assert.equal(globalThis.window.location._replaced, null, 'Must NOT redirect on 403');
    } finally {
        api.defaults.adapter = originalAdapter;
    }
});

test('Step 6: 401 Unauthorized or ACCOUNT_DISABLED clears storage and redirects', async () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('token', 'expired-token-888');
    localStorage.setItem('user', JSON.stringify({ id: 'u1' }));
    globalThis.window.location._replaced = null;

    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = async (config) => {
        const err = new Error('Request failed with status code 401');
        err.response = {
            status: 401,
            data: { success: false, error: 'ACCOUNT_DISABLED', message: 'Tài khoản đã bị vô hiệu hoá.' },
            config,
        };
        err.config = config;
        throw err;
    };

    try {
        await api.get('/student/profile');
        assert.fail('Should throw 401');
    } catch (err) {
        assert.equal(err.status, 401);
        assert.equal(err.code, 'ACCOUNT_DISABLED');
        assert.equal(localStorage.getItem('token'), null, 'Token should be cleared on 401');
        assert.equal(localStorage.getItem('user'), null, 'User should be cleared on 401');
        assert.equal(globalThis.window.location._replaced, '/', 'Should redirect to / on 401');
    } finally {
        api.defaults.adapter = originalAdapter;
    }
});

test('Step 7: authStore implements refreshSession and updates state', async () => {
    assert.equal(typeof useAuthStore.getState().refreshSession, 'function', 'authStore must have refreshSession');

    localStorage.setItem('token', 'token-999');
    localStorage.setItem('user', JSON.stringify({ id: 'u999', permissionVersion: 1, permissions: [] }));

    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = async (config) => {
        if (config.url?.includes('/auth/me')) {
            return {
                status: 200,
                data: {
                    success: true,
                    data: { id: 'u999', fullName: 'Nguyen Van B', permissionVersion: 2, permissions: ['VIEW_USERS', 'USER_MANAGE'] },
                    token: 'token-refreshed-999',
                },
                headers: {},
                config,
            };
        }
        return { status: 200, data: { success: true }, headers: {}, config };
    };

    try {
        await useAuthStore.getState().refreshSession();
        const updatedUser = useAuthStore.getState().user;
        assert.equal(updatedUser?.id, 'u999');
        assert.equal(updatedUser?.fullName, 'Nguyen Van B');
        assert.deepEqual(updatedUser?.permissions, ['VIEW_USERS', 'USER_MANAGE']);
    } finally {
        api.defaults.adapter = originalAdapter;
    }
});

test('Step 8: AppLayout integrates window.focus, visibilitychange, and BroadcastChannel for session sync', () => {
    const layoutSource = read('src/components/layout/AppLayout.jsx');
    assert.match(layoutSource, /refreshSession/, 'AppLayout should use refreshSession');
    assert.match(layoutSource, /visibilitychange/, 'AppLayout should listen to visibilitychange');
    assert.match(layoutSource, /focus/, 'AppLayout should listen to window.focus');
    assert.match(layoutSource, /dacn_auth_sync/, 'AppLayout should listen on dacn_auth_sync BroadcastChannel');
    assert.match(layoutSource, /PERMISSION_VERSION_UPDATED|PERMISSIONS_UPDATED/, 'AppLayout should handle permission update messages');
});

// Exercise the HTTP boundary without replacing the response interceptor itself.
for (const status of [409, 500]) {
    test(`HTTP ${status} rejection retains backend metadata`, async (t) => {
        const originalAdapter = api.defaults.adapter;
        t.after(() => { api.defaults.adapter = originalAdapter; });
        api.defaults.adapter = async (config) => {
            throw Object.assign(new Error('HTTP failure'), {
                config, response: { status, data: { message: 'Backend failure', details: { id: 'r1' }, errors: ['invalid'] } },
            });
        };
        await assert.rejects(api.get('/metadata'), (error) => {
            assert.equal(error.success, false);
            assert.equal(error.status, status);
            assert.equal(error.message, 'Backend failure');
            assert.deepEqual(error.details, { id: 'r1' });
            assert.deepEqual(error.errors, ['invalid']);
            return true;
        });
    });
}

test('HTTP success with success:false remains a rejected business failure', async (t) => {
    const originalAdapter = api.defaults.adapter;
    t.after(() => { api.defaults.adapter = originalAdapter; });
    api.defaults.adapter = async (config) => ({
        status: 200, headers: {}, config,
        data: { success: false, message: 'Validation failed', errors: ['invalid'] },
    });
    await assert.rejects(api.get('/business-failure'), (error) => {
        assert.equal(error.success, false);
        assert.equal(error.status, 200);
        assert.deepEqual(error.errors, ['invalid']);
        return true;
    });
});

test('network rejection retains its transport code', async (t) => {
    const originalAdapter = api.defaults.adapter;
    t.after(() => { api.defaults.adapter = originalAdapter; });
    api.defaults.adapter = async (config) => {
        throw Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK', config });
    };
    await assert.rejects(api.get('/offline'), (error) => {
        assert.equal(error.success, false);
        assert.equal(error.code, 'ERR_NETWORK');
        return true;
    });
});

for (const [label, modulePath, method, args] of [
    ['archive', '../src/services/archiveService.js', 'getArchiveByRegistration', ['r1']],
    ['evaluation', '../src/services/evaluationService.js', 'getMyGrades', []],
]) {
    test(`${label} wrapper preserves error metadata and successful response contracts`, async (t) => {
        const service = (await import(modulePath)).default;
        const originalAdapter = api.defaults.adapter;
        t.after(() => { api.defaults.adapter = originalAdapter; });
        api.defaults.adapter = async (config) => {
            throw Object.assign(new Error('HTTP failure'), {
                config, response: { status: 503, data: { message: 'Unavailable', errors: ['retry later'] } },
            });
        };
        await assert.rejects(service[method](...args), (error) => {
            assert.equal(error.success, false);
            assert.equal(error.status, 503);
            assert.equal(error.message, 'Unavailable');
            assert.deepEqual(error.errors, ['retry later']);
            return true;
        });
        api.defaults.adapter = async (config) => ({ status: 200, headers: {}, config, data: { success: true, data: ['r1'] } });
        assert.deepEqual(await service[method](...args), { success: true, data: ['r1'] });

        const originalGet = api.get;
        t.after(() => { api.get = originalGet; });
        api.get = async () => {
            throw Object.assign(new Error('Axios message'), {
                response: { status: 422, data: { message: 'Validation failed', errors: ['invalid'] } },
            });
        };
        await assert.rejects(service[method](...args), (error) => {
            assert.equal(error.status, 422);
            assert.equal(error.message, 'Validation failed');
            assert.deepEqual(error.errors, ['invalid']);
            return true;
        });
    });
}

for (const scenario of ['second stale response', 'refresh failure']) {
    test(`${scenario} retains failure status after session refresh`, async (t) => {
        const originalAdapter = api.defaults.adapter;
        const originalAxiosGet = axios.get;
        t.after(() => { api.defaults.adapter = originalAdapter; axios.get = originalAxiosGet; });
        axios.get = async () => {
            if (scenario === 'refresh failure') {
                throw Object.assign(new Error('Refresh failed'), { response: { status: 500, data: { message: 'Refresh unavailable' } } });
            }
            return { data: { token: 'fresh-token', data: { id: 'u1' } } };
        };
        let attempts = 0;
        api.defaults.adapter = async (config) => {
            attempts++;
            throw Object.assign(new Error('Stale session'), {
                config, response: { status: 409, data: { error: 'PERMISSION_VERSION_STALE' } },
            });
        };
        await assert.rejects(api.get('/stale-again'), (error) => {
            assert.equal(error.success, false);
            assert.equal(error.status, scenario === 'refresh failure' ? 500 : 409);
            return true;
        });
        assert.equal(attempts, scenario === 'refresh failure' ? 1 : 2);
    });
}
