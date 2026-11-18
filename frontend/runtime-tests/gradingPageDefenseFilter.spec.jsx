import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { ConfigProvider } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import GradingPage from '../src/pages/lecturer/GradingPage.jsx';
import evaluationService from '../src/services/evaluationService.js';

let client;

const secretaryUser = {
    id: 2,
    fullName: 'ThS. Nguyễn Văn An',
    email: 'gv002@tdmu.edu.vn',
    role: 'LECTURER',
    permissions: ['VIEW_DEFENSE_GRADING', 'DEFENSE_SCORE_SUBMIT'],
};

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', vi.fn(() => ({
        matches: false,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
    })));
    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
});

afterEach(() => {
    cleanup();
    client.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

test('GradingPage hides finished defense councils and renders Vietnamese council role label instead of raw SECRETARY', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    vi.spyOn(evaluationService, 'getMyCouncilDefenses').mockResolvedValue({
        success: true,
        data: [
            {
                id: 1,
                name: 'Hội đồng đã xong kỳ cũ',
                councilType: 'DEFENSE_COUNCIL',
                defenseDate: pastDate,
                scoreBookLocked: true,
                myRole: 'SECRETARY',
                semester: { id: 1, name: 'HK1-2025-2026', status: 'COMPLETED' },
                members: [{ lecturerId: 2, roleInCouncil: 'SECRETARY', lecturer: { fullName: 'ThS. Nguyễn Văn An' } }],
                registrations: [
                    { id: 11, status: 'COMPLETED', isScoreBookLocked: true, defenseResult: { finalScore: 8.5, scoreLocked: true } },
                ],
            },
            {
                id: 2,
                name: 'Hội đồng chuẩn bị bảo vệ 01',
                councilType: 'DEFENSE_COUNCIL',
                defenseDate: futureDate,
                location: 'Phòng B2.01',
                scoreBookLocked: false,
                myRole: 'SECRETARY',
                semester: { id: 3, name: 'HK1-2026-2027', status: 'ONGOING' },
                members: [{ lecturerId: 2, roleInCouncil: 'SECRETARY', lecturer: { fullName: 'ThS. Nguyễn Văn An' } }],
                registrations: [
                    {
                        id: 22,
                        status: 'DEFENSE_SCHEDULED',
                        defenseShift: 'MORNING',
                        orderInShift: 1,
                        student: { fullName: 'Trần Minh Khôi', code: '22000201' },
                        topic: { title: 'Hệ thống AI hỗ trợ học tập', mentor: { fullName: 'TS. Lê Bảo' } },
                        defenseResult: null,
                        memberScores: [],
                    },
                ],
            },
        ],
    });

    useAuthStore.setState({ user: secretaryUser, isAuthenticated: true });
    render(
        <ConfigProvider>
            <AppQueryProvider client={client}>
                <MemoryRouter>
                    <GradingPage />
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );

    await waitFor(() => {
        expect(screen.getByText('Hội đồng chuẩn bị bảo vệ 01')).toBeInTheDocument();
    });

    expect(screen.queryByText('Hội đồng đã xong kỳ cũ')).not.toBeInTheDocument();
    expect(screen.getByText(/Vai trò:\s*Thư ký Hội đồng/)).toBeInTheDocument();
    expect(screen.queryByText(/Vai trò:\s*SECRETARY/)).not.toBeInTheDocument();
    expect(screen.getByText('Trần Minh Khôi')).toBeInTheDocument();
});

