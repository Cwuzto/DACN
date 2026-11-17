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
import councilService from '../src/services/councilService.js';

let client;

const semestersPayload = {
    success: true,
    data: [{ id: 12, code: 'HK12', name: 'Học kỳ 12', status: 'ACTIVE' }],
};

const publishQueuePayload = {
    success: true,
    data: {
        tab: 'publish',
        semester: { id: 12, code: 'HK12', name: 'Học kỳ 12', status: 'ACTIVE' },
        items: [
            {
                id: 'eligible-defense-list-12',
                kind: 'DEFENSE_ELIGIBLE_LIST_PUBLICATION',
                resourceId: 12,
                registrationId: null,
                title: 'Công bố danh sách đủ điều kiện bảo vệ (HK12)',
                subtitle: '15 sinh viên đủ điều kiện',
                status: 'READY_TO_PUBLISH',
                dueAt: null,
                allowedActions: [],
            },
            {
                id: 'result-publication-candidate-50',
                kind: 'RESULT_PUBLICATION',
                resourceId: 50,
                registrationId: 101,
                title: 'Công bố kết quả bảo vệ: SV101 - Phạm Văn D',
                subtitle: 'Đề tài Blockchain',
                status: 'APPROVED_PENDING_PUBLICATION',
                dueAt: null,
                allowedActions: [],
            },
        ],
        pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
        counts: { review: 1, decisions: 0, publish: 2 },
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
    vi.spyOn(instituteOperationsService, 'getOperations').mockResolvedValue(publishQueuePayload);
    vi.spyOn(evaluationService, 'previewResultPublication').mockResolvedValue({
        success: true,
        data: { eligible: [] },
    });
    vi.spyOn(evaluationService, 'getResultPublicationHistory').mockResolvedValue({
        success: true,
        data: [],
    });
    vi.spyOn(evaluationService, 'publishDefenseResults').mockResolvedValue({ success: true });
    vi.spyOn(councilService, 'publishEligibleDefenseList').mockResolvedValue({ success: true });
});

afterEach(() => {
    client.clear();
    message.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function mountHub(permissions, initialEntry = '/lecturer/institute?tab=publish') {
    useAuthStore.setState({
        user: { id: 52, role: 'LECTURER', permissions, permissionVersion: 1 },
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

test('view-only publication actor sees preview/history without publish actions or unpublished BM05 scores', async () => {
    mountHub(['VIEW_RESULT_PUBLICATIONS']);

    expect(await screen.findByText('Công bố kết quả bảo vệ: SV101 - Phạm Văn D')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Công bố kết quả/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Công bố DS đủ ĐK/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Xem trước công bố/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Lịch sử công bố/ })).toBeInTheDocument();
});

test('publisher actor sees publish action and opens publication modal', async () => {
    instituteOperationsService.getOperations.mockResolvedValue({
        success: true,
        data: {
            ...publishQueuePayload.data,
            items: [
                {
                    ...publishQueuePayload.data.items[1],
                    allowedActions: ['PUBLISH_DEFENSE_RESULTS'],
                },
            ],
        },
    });

    mountHub(['RESULT_PUBLICATION_PUBLISH']);

    const publishBtn = await screen.findByRole('button', { name: /Công bố kết quả/ });
    await userEvent.click(publishBtn);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
});

test('legacy deep link ?tab=bm02Queue maps to review tab and switching tabs updates query cleanly', async () => {
    mountHub(['VIEW_BM02_REVIEWS', 'VIEW_RESULT_PUBLICATIONS'], '/lecturer/institute?tab=bm02Queue');

    await waitFor(() => {
        expect(instituteOperationsService.getOperations).toHaveBeenCalledWith(
            expect.objectContaining({ tab: 'review' }),
            expect.anything()
        );
    });

    await userEvent.click(screen.getByRole('tab', { name: /Công bố/ }));

    await waitFor(() => {
        expect(instituteOperationsService.getOperations).toHaveBeenCalledWith(
            expect.objectContaining({ tab: 'publish' }),
            expect.anything()
        );
    });
});
