import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider } from 'antd';
import AppLayout from '../src/components/layout/AppLayout.jsx';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import notificationService from '../src/services/notificationService.js';
import { semesterService } from '../src/services/semesterService.js';

let client;

beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
    vi.spyOn(notificationService, 'getMyNotifications').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(semesterService, 'getAll').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(semesterService, 'getPublic').mockResolvedValue({ success: true, data: [] });
    localStorage.clear();
});

afterEach(() => {
    cleanup();
    client.clear();
    useAuthStore.setState({ user: null, isAuthenticated: false });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function mountLayout(initialEntries, user) {
    useAuthStore.setState({
        isAuthenticated: true,
        user,
        refreshPermissions: vi.fn().mockResolvedValue(undefined),
    });

    return render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter initialEntries={initialEntries}>
                    <Routes>
                        <Route path="/admin" element={<AppLayout role="ADMIN" />}>
                            <Route path="grading" element={<div>Grading View</div>} />
                            <Route path="users" element={<div>Users View</div>} />
                        </Route>
                    </Routes>
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );
}

describe('Sidebar active state, accessibility, mobile drawer, and permission revocation', () => {
    const adminUser = {
        id: 10,
        role: 'ADMIN',
        fullName: 'Giáo vụ',
        permissions: [
            'VIEW_DEFENSE_LOCK_LEDGER',
            'VIEW_DEFENSE_RESULT_APPROVALS',
            'VIEW_RESULT_PUBLICATIONS',
            'VIEW_USERS',
        ],
    };

    it('marks active item with aria-current="page" regardless of unrelated query params or order', () => {
        const { unmount } = mountLayout(['/admin/grading?semesterId=2&tab=approvals'], adminUser);
        const approvalBtn = screen.getByRole('button', { name: 'Phê duyệt kết quả' });
        expect(approvalBtn).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('button', { name: 'Công bố kết quả học kỳ' })).not.toHaveAttribute('aria-current');
        expect(screen.getByRole('button', { name: 'Sổ điểm bảo vệ' })).not.toHaveAttribute('aria-current');
        unmount();

        mountLayout(['/admin/grading?tab=publish&semesterId=2'], adminUser);
        expect(screen.getByRole('button', { name: 'Công bố kết quả học kỳ' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('button', { name: 'Phê duyệt kết quả' })).not.toHaveAttribute('aria-current');
    });

    it('preserves accessible labels when collapsed and restores focus on mobile drawer Escape', async () => {
        const user = userEvent.setup();
        mountLayout(['/admin/users'], adminUser);

        const toggleBtn = screen.getByRole('button', { name: 'Thu gọn thanh bên' });
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(toggleBtn);
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Mở rộng thanh bên' })).toHaveAttribute('aria-expanded', 'false');
        });
        expect(screen.getByRole('button', { name: 'Người dùng' })).toBeInTheDocument();

        const mobileTrigger = screen.getByRole('button', { name: 'Mở menu điều hướng' });
        await user.click(mobileTrigger);
        expect(screen.getByRole('dialog', { name: 'Menu điều hướng' })).toBeInTheDocument();

        await user.keyboard('{Escape}');
        await waitFor(() => {
            expect(screen.queryByRole('dialog', { name: 'Menu điều hướng' })).not.toBeInTheDocument();
        });
        await waitFor(() => {
            expect(document.activeElement).toBe(mobileTrigger);
        });
    });

    it('removes menu item immediately when permissions are revoked in store', async () => {
        mountLayout(['/admin/users'], adminUser);
        expect(screen.getByRole('button', { name: 'Người dùng' })).toBeInTheDocument();

        act(() => {
            useAuthStore.setState({
                user: {
                    ...adminUser,
                    permissions: ['VIEW_DEFENSE_LOCK_LEDGER'],
                },
            });
        });

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Người dùng' })).not.toBeInTheDocument();
        });
    });
});
