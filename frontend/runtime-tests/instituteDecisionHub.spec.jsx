import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ConfigProvider, message } from 'antd';
import InstituteOperationsPage from '../src/pages/lecturer/InstituteOperationsPage.jsx';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import instituteOperationsService from '../src/services/instituteOperationsService.js';
import { semesterService } from '../src/services/semesterService.js';
import evaluationService from '../src/services/evaluationService.js';
import delegationService from '../src/services/delegationService.js';

let client;

const semestersPayload = {
    success: true,
    data: [{ id: 12, code: 'HK12', name: 'Học kỳ 12', status: 'ACTIVE' }],
};

const decisionsQueuePayload = {
    success: true,
    data: {
        tab: 'decisions',
        semester: { id: 12, code: 'HK12', name: 'Học kỳ 12', status: 'ACTIVE' },
        items: [
            {
                id: 'defense-result-approval-101',
                kind: 'DEFENSE_RESULT_APPROVAL',
                resourceId: 101,
                registrationId: 101,
                title: 'Phê duyệt kết quả bảo vệ: SV101 - Lê Văn C',
                subtitle: 'Đề tài Cloud',
                status: 'AWAITING_FINAL_APPROVAL',
                dueAt: null,
                allowedActions: [],
            },
        ],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        counts: { review: 0, decisions: 1, publish: 0 },
        generatedAt: '2026-11-18T08:00:00.000Z',
    },
};

beforeEach(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class ResizeObserver {
            observe() {}
            unobserve() {}
            disconnect() {}
        }
    );
    vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({
            matches: false,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
        }))
    );
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => nativeGetComputedStyle(el));
    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: 0 }, mutations: { retry: false } });
    vi.spyOn(semesterService, 'getAll').mockResolvedValue(semestersPayload);
    vi.spyOn(instituteOperationsService, 'getOperations').mockResolvedValue(decisionsQueuePayload);
    vi.spyOn(evaluationService, 'approveDefenseResult').mockResolvedValue({ success: true });
    vi.spyOn(delegationService, 'getDelegations').mockResolvedValue({ success: true, data: [] });
});

afterEach(() => {
    client.clear();
    message.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function mountHub(permissions, initialEntry = '/lecturer/institute?tab=decisions') {
    useAuthStore.setState({
        user: { id: 51, role: 'LECTURER', permissions, permissionVersion: 1 },
        isAuthenticated: true,
    });
    return render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter initialEntries={[initialEntry]}>
                    <Routes>
                        <Route path="/lecturer/institute" element={<InstituteOperationsPage />} />
                    </Routes>
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );
}

test('view-only decision actor sees items without mutation buttons and cannot open delegations', async () => {
    mountHub(['VIEW_DEFENSE_RESULT_APPROVALS'], '/lecturer/institute?tab=periods');

    expect(await screen.findByText('Phê duyệt kết quả bảo vệ: SV101 - Lê Văn C', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Phê duyệt kết quả/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ủy quyền chuyên môn/ })).not.toBeInTheDocument();
    expect(delegationService.getDelegations).not.toHaveBeenCalled();
});

test('authorized decision actor approves defense result and refreshes queue', async () => {
    instituteOperationsService.getOperations.mockResolvedValue({
        success: true,
        data: {
            ...decisionsQueuePayload.data,
            items: [
                {
                    ...decisionsQueuePayload.data.items[0],
                    allowedActions: ['APPROVE_DEFENSE_RESULT'],
                },
            ],
        },
    });

    mountHub(['DEFENSE_RESULT_APPROVE']);

    const approveBtn = await screen.findByRole('button', { name: /Phê duyệt kết quả/ }, { timeout: 5000 });
    await userEvent.click(approveBtn);
    await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận phê duyệt' }));

    await waitFor(() => {
        expect(evaluationService.approveDefenseResult).toHaveBeenCalledWith(101, { outcome: 'PASSED' });
    });
});

test('?tab=delegations opens delegation drawer only when actor has delegation permission', async () => {
    mountHub(['VIEW_DEFENSE_RESULT_APPROVALS', 'PERMISSION_ASSIGN_ACADEMIC'], '/lecturer/institute?tab=delegations');

    expect(await screen.findByText('Ủy quyền chuyên môn theo ngữ cảnh')).toBeInTheDocument();
    expect(delegationService.getDelegations).toHaveBeenCalled();
});
