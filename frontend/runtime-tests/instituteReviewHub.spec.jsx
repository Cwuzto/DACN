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
import { queryKeys } from '../src/query/queryKeys.js';

let client;

const semestersPayload = {
    success: true,
    data: [
        { id: 10, code: 'HK1', name: 'Học kỳ 1', status: 'ACTIVE' },
        { id: 11, code: 'HK2', name: 'Học kỳ 2', status: 'UPCOMING' },
    ],
};

const viewOnlyReviewPayload = {
    success: true,
    data: {
        tab: 'review',
        semester: { id: 10, code: 'HK1', name: 'Học kỳ 1', status: 'ACTIVE' },
        items: [
            {
                id: 'bm02-submission-1',
                kind: 'BM02_REVIEW',
                resourceId: 1,
                registrationId: 101,
                title: 'Thẩm định BM02 (Lần 1): SV001 - Nguyễn Văn A',
                subtitle: 'Đề tài AI',
                status: 'PENDING_REVIEW',
                dueAt: null,
                allowedActions: [],
            },
            {
                id: 'bm03-stop-review-2',
                kind: 'BM03_STOP_REVIEW',
                resourceId: 2,
                registrationId: 102,
                title: 'Thẩm định dừng đề tài BM03: SV002 - Trần Thị B',
                subtitle: 'Đề tài IoT',
                status: 'STOP_REVIEW_PENDING',
                dueAt: null,
                allowedActions: [],
            },
        ],
        pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
        counts: { review: 2, decisions: 0, publish: 0 },
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
    vi.spyOn(instituteOperationsService, 'getOperations').mockResolvedValue(viewOnlyReviewPayload);
    vi.spyOn(evaluationService, 'decideStopReview').mockResolvedValue({ success: true });
});

afterEach(() => {
    client.clear();
    message.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function mountHub(permissions, initialEntry = '/lecturer/institute?tab=review') {
    useAuthStore.setState({
        user: { id: 50, role: 'LECTURER', permissions, permissionVersion: 1 },
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

test('view-only actor sees review items without mutation buttons and only sees authorized tabs', async () => {
    mountHub(['VIEW_BM02_REVIEWS', 'VIEW_CHECKPOINTS']);

    expect(await screen.findByText('Thẩm định BM02 (Lần 1): SV001 - Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Thẩm định dừng đề tài BM03: SV002 - Trần Thị B')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Thẩm định BM02/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quyết định dừng/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Yêu cầu bổ sung/ })).not.toBeInTheDocument();

    // Unauthorized tabs must not appear
    expect(screen.queryByRole('tab', { name: /Quyết định/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Công bố/ })).not.toBeInTheDocument();
});

test('authorized actor can decide BM03 stop review and invalidates hub + legacy caches', async () => {
    instituteOperationsService.getOperations.mockResolvedValue({
        success: true,
        data: {
            ...viewOnlyReviewPayload.data,
            items: [
                {
                    id: 'bm03-stop-review-2',
                    kind: 'BM03_STOP_REVIEW',
                    resourceId: 2,
                    registrationId: 102,
                    title: 'Thẩm định dừng đề tài BM03: SV002 - Trần Thị B',
                    subtitle: 'Đề tài IoT',
                    status: 'STOP_REVIEW_PENDING',
                    dueAt: null,
                    allowedActions: ['REQUEST_MORE_INFO', 'DECIDE_STOP_REVIEW'],
                },
            ],
            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
            counts: { review: 1, decisions: 0, publish: 0 },
        },
    });

    mountHub(['BM03_STOP_REVIEW']);

    const decideBtn = await screen.findByRole('button', { name: /Quyết định dừng/ });
    const scope = queryKeys.scope(useAuthStore.getState().user);
    const legacyRegKey = queryKeys.registrations.lists(scope);
    client.setQueryData(legacyRegKey, { success: true, data: [] });

    await userEvent.click(decideBtn);
    await userEvent.type(await screen.findByPlaceholderText('Lý do / ghi chú quyết định...'), 'Đồng ý dừng');
    await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận quyết định' }));

    await waitFor(() => {
        expect(evaluationService.decideStopReview).toHaveBeenCalledWith(2, {
            decision: 'APPROVE_STOP',
            reason: 'Đồng ý dừng',
        });
    });

    expect(client.getQueryState(legacyRegKey).isInvalidated).toBe(true);
});

test('handles loading, error with retry, empty state, and semester switch clearing old items', async () => {
    instituteOperationsService.getOperations.mockRejectedValueOnce({
        success: false,
        message: 'Lỗi tải hàng đợi thẩm định',
    });

    mountHub(['VIEW_BM02_REVIEWS']);

    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent('Lỗi tải hàng đợi thẩm định');
    await userEvent.click(await screen.findByRole('button', { name: /Thử lại/ }));
    expect(await screen.findByText('Thẩm định BM02 (Lần 1): SV001 - Nguyễn Văn A', {}, { timeout: 5000 })).toBeInTheDocument();

    // Switch semester -> old data disappears and empty state shows when new semester is empty
    instituteOperationsService.getOperations.mockResolvedValueOnce({
        success: true,
        data: {
            tab: 'review',
            semester: { id: 11, code: 'HK2', name: 'Học kỳ 2', status: 'UPCOMING' },
            items: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
            counts: { review: 0, decisions: 0, publish: 0 },
            generatedAt: '2026-11-18T08:05:00.000Z',
        },
    });

    const semesterSelect = screen.getByRole('combobox', { name: 'Chọn học kỳ' });
    await userEvent.click(semesterSelect);
    await userEvent.click(await screen.findByText('Học kỳ 2'));

    expect(await screen.findByText('Không có hồ sơ nào cần xử lý trong hàng đợi.')).toBeInTheDocument();
    expect(screen.queryByText('Thẩm định BM02 (Lần 1): SV001 - Nguyễn Văn A')).not.toBeInTheDocument();
});
