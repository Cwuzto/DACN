import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider, Modal, message } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import UserManagementPage from '../src/pages/admin/UserManagementPage.jsx';
import userService from '../src/services/userService.js';
import permissionService from '../src/services/permissionService.js';

let client;

const mockLecturer = {
    id: 101,
    code: 'GV001',
    fullName: 'TS. Nguyễn Văn Hướng Dẫn',
    email: 'gv001@tdmu.edu.vn',
    role: 'LECTURER',
    academicTitle: 'TIEN_SI',
    maxStudents: 10,
    department: 'Công nghệ Phần mềm',
    isActive: true,
};

const mockLecturerNoQuota = {
    id: 102,
    code: 'GV002',
    fullName: 'ThS. Trần Thị Hướng Dẫn',
    email: 'gv002@tdmu.edu.vn',
    role: 'LECTURER',
    academicTitle: 'THAC_SI',
    maxStudents: null,
    department: 'Mạng máy tính',
    isActive: true,
};

function mount(Component) {
    return render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter>
                    <Component />
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );
}

describe('Mentor Quota UI Verification (UserManagementPage)', () => {
    beforeEach(() => {
        vi.stubGlobal('ResizeObserver', class {
            observe() {}
            unobserve() {}
            disconnect() {}
        });
        vi.stubGlobal('matchMedia', vi.fn(() => ({
            matches: false,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
        })));

        client = createAppQueryClient();
        client.setDefaultOptions({
            queries: { retry: false, staleTime: 0 },
            mutations: { retry: false },
        });

        useAuthStore.setState({
            user: {
                id: 1,
                role: 'ADMIN',
                fullName: 'Quản trị viên Hệ thống',
                permissions: ['USER_MANAGE', 'VIEW_USERS', 'USER_IMPORT'],
            },
            isAuthenticated: true,
        });

        vi.spyOn(permissionService, 'listGroups').mockResolvedValue({ success: true, data: [] });
    });

    afterEach(() => {
        client.clear();
        Modal.destroyAll();
        message.destroy();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('renders lecturer list with quota column displaying 10 SV and header Chỉ tiêu hướng dẫn', async () => {
        vi.spyOn(userService, 'getUsers').mockImplementation(async (params) => {
            if (params.limit === 1) {
                return { success: true, data: [], pagination: { total: 1 } };
            }
            return {
                success: true,
                data: [mockLecturer],
                pagination: { page: 1, limit: 10, total: 1 },
            };
        });

        mount(UserManagementPage);

        // Header column
        const headers = await screen.findAllByText('Chỉ tiêu hướng dẫn');
        expect(headers.length).toBeGreaterThan(0);

        // Quota display
        expect(await screen.findByText('10 SV')).toBeInTheDocument();
        expect(screen.getByText('Tối đa:')).toBeInTheDocument();

        // Does not show legacy 15 or 20 quota
        expect(screen.queryByText('15 SV')).not.toBeInTheDocument();
        expect(screen.queryByText('20 SV')).not.toBeInTheDocument();
    });

    it('falls back to default 10 SV when maxStudents is null/undefined', async () => {
        vi.spyOn(userService, 'getUsers').mockImplementation(async (params) => {
            if (params.limit === 1) {
                return { success: true, data: [], pagination: { total: 1 } };
            }
            return {
                success: true,
                data: [mockLecturerNoQuota],
                pagination: { page: 1, limit: 10, total: 1 },
            };
        });

        mount(UserManagementPage);

        expect(await screen.findByText('10 SV')).toBeInTheDocument();
        expect(screen.getByText('ThS. Trần Thị Hướng Dẫn')).toBeInTheDocument();
    });

    it('displays max 10 quota and prevents 15/20 legacy quota in lecturer creation modal', async () => {
        vi.spyOn(userService, 'getUsers').mockImplementation(async (params) => {
            if (params.limit === 1) {
                return { success: true, data: [], pagination: { total: 1 } };
            }
            return {
                success: true,
                data: [mockLecturer],
                pagination: { page: 1, limit: 10, total: 1 },
            };
        });

        mount(UserManagementPage);

        // Click create button
        const createBtn = await screen.findByRole('button', { name: /Thêm Người Dùng/i });
        await userEvent.click(createBtn);

        // Modal should open
        expect(await screen.findByText('Thêm người dùng mới')).toBeInTheDocument();

        // Check maxStudents form item label
        expect(screen.getByText('Chỉ tiêu hướng dẫn tối đa')).toBeInTheDocument();

        // Legacy text should not be present
        expect(screen.queryByText(/TS 15 SV/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/PGS 20 SV/i)).not.toBeInTheDocument();
    });
});
