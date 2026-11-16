import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import { queryKeys } from '../src/query/queryKeys.js';
import useAuthStore from '../src/stores/authStore.js';
import api, { authSyncChannel, broadcastPermissionsUpdated } from '../src/services/api.js';
import { getVisibleNavigation } from '../src/config/navigationRegistry.js';
import axios from 'axios';

let client;
const initialUser = {
    id: 'user-cross-tab-1',
    fullName: 'Sinh Vien CrossTab',
    role: 'STUDENT',
    permissionVersion: 1,
    permissions: ['VIEW_MY_REGISTRATION'],
};

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    client = createAppQueryClient();
    useAuthStore.getState().setAuth('token-v1', initialUser);
});

afterEach(() => {
    cleanup();
    client.clear();
    useAuthStore.getState().logout();
    vi.restoreAllMocks();
});

describe('Task 9: Immediate Permission Refresh and Cross-Tab Consistency', () => {
    test('single-flight refreshPermissions coalesces concurrent calls into a single /auth/me request', async () => {
        let authMeCalls = 0;
        const spy = vi.spyOn(api, 'get').mockImplementation(async (url) => {
            if (url.includes('/auth/me')) {
                authMeCalls++;
                await new Promise((r) => setTimeout(r, 25));
                return {
                    success: true,
                    data: {
                        ...initialUser,
                        permissionVersion: 2,
                        permissions: ['VIEW_MY_REGISTRATION', 'VIEW_MY_SUBMISSIONS'],
                    },
                    token: 'token-v2',
                };
            }
            return { success: true };
        });

        // Trigger 3 calls simultaneously
        const [u1, u2, u3] = await Promise.all([
            useAuthStore.getState().refreshPermissions({ reason: 'call1' }),
            useAuthStore.getState().refreshPermissions({ reason: 'call2' }),
            useAuthStore.getState().refreshPermissions({ reason: 'call3' }),
        ]);

        expect(authMeCalls).toBe(1);
        expect(u1.permissionVersion).toBe(2);
        expect(u2).toBe(u1);
        expect(u3).toBe(u1);
        expect(useAuthStore.getState().user.permissionVersion).toBe(2);
        expect(useAuthStore.getState().user.permissions).toContain('VIEW_MY_SUBMISSIONS');
    });

    test('refreshPermissions with expectedVersion skips network request when already satisfied', async () => {
        useAuthStore.setState({
            user: { ...initialUser, permissionVersion: 5 },
            token: 'token-v5',
            isAuthenticated: true,
        });

        const spy = vi.spyOn(api, 'get');
        const user = await useAuthStore.getState().refreshPermissions({ expectedVersion: 5, reason: 'check' });

        expect(spy).not.toHaveBeenCalled();
        expect(user.permissionVersion).toBe(5);
    });

    test('permission refresh clears old permission-scoped query cache and updates navigation menu', async () => {
        render(
            <AppQueryProvider client={client}>
                <div>App Workspace</div>
            </AppQueryProvider>
        );

        // Populate query cache with initial scope (permissionVersion: 1)
        const oldScope = queryKeys.scope(initialUser);
        const oldQueryKey = queryKeys.topics.list(oldScope);
        client.setQueryData(oldQueryKey, [{ id: 'topic-1', title: 'Old Topic' }]);
        expect(client.getQueryData(oldQueryKey)).toBeDefined();

        // Initial navigation only has 'Đề tài đăng ký' (VIEW_MY_REGISTRATION)
        const initialNav = getVisibleNavigation(useAuthStore.getState().user);
        const initialKeys = initialNav.flatMap((g) => g.items.map((i) => i.key));
        expect(initialKeys).toContain('my-registration');
        expect(initialKeys).not.toContain('my-grades');

        // Mock /auth/me to return granted VIEW_MY_GRADES and version 2
        vi.spyOn(api, 'get').mockResolvedValueOnce({
            success: true,
            data: {
                ...initialUser,
                permissionVersion: 2,
                permissions: ['VIEW_MY_REGISTRATION', 'VIEW_MY_GRADES'],
            },
            token: 'token-v2',
        });

        // Perform refresh
        await act(async () => {
            await useAuthStore.getState().refreshPermissions({ reason: 'granted_role' });
        });

        // The old query key should be wiped from cache because permissionVersion changed to 2
        expect(client.getQueryData(oldQueryKey)).toBeUndefined();
        expect(client.getQueryCache().getAll()).toHaveLength(0);

        // Updated navigation now reflects 'my-grades' dynamically
        const updatedNav = getVisibleNavigation(useAuthStore.getState().user);
        const updatedKeys = updatedNav.flatMap((g) => g.items.map((i) => i.key));
        expect(updatedKeys).toContain('my-registration');
        expect(updatedKeys).toContain('my-grades');
    });

    test('safe GET replayed automatically on 409 PERMISSION_VERSION_STALE', async () => {
        let authMeCalled = 0;
        let getAttempts = 0;

        const originalAxiosGet = axios.get;
        vi.spyOn(axios, 'get').mockImplementation(async (url, config) => {
            if (url.includes('/auth/me')) {
                authMeCalled++;
                return {
                    data: {
                        success: true,
                        data: { ...initialUser, permissionVersion: 2 },
                        token: 'token-replayed-2',
                    },
                };
            }
            return originalAxiosGet(url, config);
        });

        const originalAdapter = api.defaults.adapter;
        api.defaults.adapter = async (config) => {
            if (config.url?.includes('/test-safe-replay')) {
                getAttempts++;
                if (getAttempts === 1) {
                    const err = new Error('409 Stale');
                    err.response = {
                        status: 409,
                        data: { error: 'PERMISSION_VERSION_STALE', message: 'Stale' },
                        config,
                    };
                    err.config = config;
                    throw err;
                }
                return {
                    status: 200,
                    data: { success: true, items: ['item-1'] },
                    headers: {},
                    config,
                };
            }
            return { status: 200, data: { success: true }, headers: {}, config };
        };

        try {
            const res = await api.get('/test-safe-replay');
            expect(authMeCalled).toBe(1);
            expect(getAttempts).toBe(2);
            expect(res.success).toBe(true);
            expect(res.items).toEqual(['item-1']);
        } finally {
            api.defaults.adapter = originalAdapter;
        }
    });

    test('unsafe mutation without Idempotency-Key rejects with requiresUserConfirmation on 409', async () => {
        let authMeCalled = 0;
        vi.spyOn(axios, 'get').mockImplementation(async (url) => {
            if (url.includes('/auth/me')) {
                authMeCalled++;
                return {
                    data: {
                        success: true,
                        data: { ...initialUser, permissionVersion: 2 },
                        token: 'token-refreshed-after-unsafe',
                    },
                };
            }
        });

        const originalAdapter = api.defaults.adapter;
        api.defaults.adapter = async (config) => {
            if (config.url?.includes('/test-unsafe-mutation')) {
                const err = new Error('409 Stale');
                err.response = {
                    status: 409,
                    data: { error: 'PERMISSION_VERSION_STALE', message: 'Stale' },
                    config,
                };
                err.config = config;
                throw err;
            }
            return { status: 200, data: { success: true }, headers: {}, config };
        };

        try {
            await expect(api.post('/test-unsafe-mutation', { data: 'val' })).rejects.toMatchObject({
                status: 409,
                code: 'PERMISSION_VERSION_STALE',
                requiresUserConfirmation: true,
            });
            expect(authMeCalled).toBe(1);
        } finally {
            api.defaults.adapter = originalAdapter;
        }
    });
});
