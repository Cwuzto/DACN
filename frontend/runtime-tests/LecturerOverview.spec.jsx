import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { ConfigProvider } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import LecturerDashboardPage from '../src/pages/lecturer/LecturerDashboardPage.jsx';
import dashboardService from '../src/services/dashboardService.js';
import registrationService from '../src/services/registrationService.js';
import { semesterService } from '../src/services/semesterService.js';

let client;

const baseLecturer = {
    id: 10,
    fullName: 'TS. Trần Văn B',
    email: 'b.tran@tdmu.edu.vn',
    role: 'LECTURER',
    permissions: ['VIEW_MY_TOPICS', 'REPORT_VIEW'],
};

const directorUser = {
    id: 88,
    fullName: 'PGS.TS Viện Trưởng',
    email: 'vientruong@tdmu.edu.vn',
    role: 'LECTURER',
    permissions: ['VIEW_MY_TOPICS', 'REPORT_VIEW', 'BM02_REVIEW', 'DEFENSE_COUNCIL_MANAGE'],
};

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
    const native = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => native(el));

    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });

    vi.spyOn(semesterService, 'getAll').mockResolvedValue({
        success: true,
        data: [{ id: 10, name: 'HK1 2026-2027', status: 'ONGOING' }],
    });
    vi.spyOn(registrationService, 'getPendingTitleAdjustments').mockResolvedValue({
        success: true,
        data: [],
    });
});

afterEach(() => {
    cleanup();
    client.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function mountDashboard(user) {
    useAuthStore.setState({ user, isAuthenticated: true });
    return render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter>
                    <LecturerDashboardPage />
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );
}

test('GVHD sees only MENTOR items and supervised students with zero fake metrics', async () => {
    vi.spyOn(dashboardService, 'getLecturerOverview').mockResolvedValue({
        success: true,
        data: {
            activeSemester: { id: 10, name: 'HK1 2026-2027' },
            mentorSummary: {
                supervisedCount: 1,
                maxStudents: 10,
                pendingFeedbackCount: 2,
                actionableCount: 3,
                upcomingDeadlineCount: 1,
            },
            attentionItems: [
                {
                    id: 'mentor-reg-1',
                    source: 'MENTOR',
                    kind: 'REGISTRATION_PENDING',
                    title: 'Duyệt đăng ký đề tài: Nguyễn Văn A',
                    description: 'Hệ thống AI',
                    priority: 'NORMAL',
                    isActionable: true,
                    target: '/lecturer/topics',
                    allowedAction: 'REVIEW_REGISTRATION',
                },
            ],
            students: [
                {
                    registrationId: 101,
                    studentId: 201,
                    studentName: 'Nguyễn Văn A',
                    studentCode: 'SV001',
                    topicTitle: 'Hệ thống AI',
                    status: 'IN_PROGRESS',
                    nextMilestone: 'Nộp chương 2',
                    nextMilestoneAt: '2026-11-20T10:00:00.000Z',
                    allowedActions: [],
                },
            ],
            generatedAt: '2026-11-17T10:00:00.000Z',
        },
    });

    mountDashboard(baseLecturer);

    expect(await screen.findByText('Duyệt đăng ký đề tài: Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('1 / 10')).toBeInTheDocument();

    // Zero fake metrics or director hub
    expect(screen.queryByText(/82%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/75%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/4\/7/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2 Hội đồng/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Viện trưởng/)).not.toBeInTheDocument();
});

test('Institute Director sees MENTOR and INSTITUTE_DIRECTOR items in one unified queue without view toggle', async () => {
    vi.spyOn(dashboardService, 'getLecturerOverview').mockResolvedValue({
        success: true,
        data: {
            activeSemester: { id: 10, name: 'HK1 2026-2027' },
            mentorSummary: {
                supervisedCount: 0,
                maxStudents: 10,
                pendingFeedbackCount: 0,
                actionableCount: 2,
                upcomingDeadlineCount: 1,
            },
            attentionItems: [
                {
                    id: 'inst-bm02-201',
                    source: 'INSTITUTE_DIRECTOR',
                    kind: 'BM02_REVIEW_PENDING',
                    title: 'Thẩm định BM02: Lê Thị C',
                    description: 'Đề tài KTPM',
                    priority: 'OVERDUE',
                    dueAt: '2026-11-16T10:00:00.000Z',
                    isActionable: true,
                    target: '/lecturer/institute',
                    allowedAction: 'REVIEW_BM02',
                },
                {
                    id: 'mentor-sub-1',
                    source: 'MENTOR',
                    kind: 'SUBMISSION_FEEDBACK_PENDING',
                    title: 'Phản hồi bài nộp: Chương 1',
                    description: 'SV001',
                    priority: 'NORMAL',
                    isActionable: true,
                    target: '/lecturer/submissions',
                    allowedAction: 'PROVIDE_FEEDBACK',
                },
            ],
            students: [],
            generatedAt: '2026-11-17T10:00:00.000Z',
        },
    });

    mountDashboard(directorUser);

    expect(await screen.findByText('Thẩm định BM02: Lê Thị C')).toBeInTheDocument();
    expect(screen.getByText('Phản hồi bài nộp: Chương 1')).toBeInTheDocument();
    expect(screen.getByText('Viện trưởng')).toBeInTheDocument();
    expect(screen.getByText('GVHD')).toBeInTheDocument();
    expect(screen.getByText(/Chưa có sinh viên trong đợt/i)).toBeInTheDocument();
});

test('renders empty queue state and error state with retry button', async () => {
    vi.spyOn(dashboardService, 'getLecturerOverview')
        .mockRejectedValueOnce({ success: false, message: 'Mất kết nối máy chủ' })
        .mockResolvedValueOnce({
            success: true,
            data: {
                activeSemester: { id: 10, name: 'HK1 2026-2027' },
                mentorSummary: {
                    supervisedCount: 0,
                    maxStudents: 10,
                    pendingFeedbackCount: 0,
                    actionableCount: 0,
                    upcomingDeadlineCount: 0,
                },
                attentionItems: [],
                students: [],
                generatedAt: '2026-11-17T10:00:00.000Z',
            },
        });

    mountDashboard(baseLecturer);

    expect(await screen.findByText(/Mất kết nối máy chủ/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    const userEv = userEvent.setup();
    await userEv.click(retryBtn);

    await waitFor(() => expect(screen.getByText(/Không có việc cần xử lý/i)).toBeInTheDocument());
    expect(screen.getByText(/Chưa có sinh viên trong đợt/i)).toBeInTheDocument();
});
