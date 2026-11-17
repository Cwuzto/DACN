import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import ProtectedRoute from '../src/components/common/ProtectedRoute.jsx';
import LecturerDashboardPage from '../src/pages/lecturer/LecturerDashboardPage.jsx';
import LecturerStudentsPage from '../src/pages/lecturer/LecturerStudentsPage.jsx';
import TopicManagementPage from '../src/pages/lecturer/TopicManagementPage.jsx';
import TopicApprovalPage from '../src/pages/lecturer/TopicApprovalPage.jsx';
import TitleAdjustmentPage from '../src/pages/lecturer/TitleAdjustmentPage.jsx';
import dashboardService from '../src/services/dashboardService.js';
import registrationService from '../src/services/registrationService.js';
import { semesterService } from '../src/services/semesterService.js';
import { topicService } from '../src/services/topicService.js';
import bm02aService from '../src/services/bm02aService.js';
import { FEATURE_POLICY_LIST } from '../src/auth/featurePolicies.js';
import { getVisibleNavigation } from '../src/auth/policyEvaluator.js';

let client;

const bm02aRequest42 = {
    id: 42,
    registrationId: 501,
    status: 'PENDING_ADVISOR',
    currentVersionNumber: 1,
    titleAdjustmentDeadline: '2026-11-25T10:00:00.000Z',
    registration: {
        id: 501,
        student: { id: 11, fullName: 'Nguyễn Văn A', code: 'SV001' },
        topic: {
            id: 301,
            title: 'Hệ thống AI cũ',
            mentor: { id: 201, fullName: 'TS. Trần Văn B' },
        },
    },
    versions: [
        {
            versionNumber: 1,
            payloadHash: 'hash-42-v1',
            registeredTitleSnapshot: 'Hệ thống AI cũ',
            proposedTitle: 'Hệ thống AI hỗ trợ phân loại tài liệu',
            reason: 'Cập nhật phạm vi nghiên cứu theo góp ý bộ môn',
            studentSignatureEventId: 901,
        },
    ],
};

const bm02aRequest43 = {
    id: 43,
    registrationId: 502,
    status: 'PENDING_ADVISOR',
    currentVersionNumber: 1,
    titleAdjustmentDeadline: '2026-11-26T10:00:00.000Z',
    registration: {
        id: 502,
        student: { id: 12, fullName: 'Trần Thị B', code: 'SV002' },
        topic: {
            id: 302,
            title: 'Ứng dụng IoT cũ',
            mentor: { id: 201, fullName: 'TS. Trần Văn B' },
        },
    },
    versions: [
        {
            versionNumber: 1,
            payloadHash: 'hash-43-v1',
            registeredTitleSnapshot: 'Ứng dụng IoT cũ',
            proposedTitle: 'Ứng dụng IoT giám sát nông nghiệp thông minh',
            reason: 'Bổ sung cảm biến môi trường',
            studentSignatureEventId: 902,
        },
    ],
};

function LocationProbe() {
    const location = useLocation();
    const navigate = useNavigate();
    return (
        <div>
            <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>
            <button type="button" data-testid="history-back" onClick={() => navigate(-1)}>
                Back
            </button>
            <button type="button" data-testid="history-forward" onClick={() => navigate(1)}>
                Forward
            </button>
        </div>
    );
}

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
    const native = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => native(el));

    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });

    vi.spyOn(semesterService, 'getAll').mockResolvedValue({
        success: true,
        data: [{ id: 10, name: 'HK1 2026-2027', status: 'ONGOING', isCurrent: true }],
    });
    vi.spyOn(registrationService, 'getPendingTitleAdjustments').mockResolvedValue({
        success: true,
        data: [],
    });
    vi.spyOn(registrationService, 'getAllRegistrations').mockResolvedValue({
        success: true,
        data: [],
    });
    vi.spyOn(topicService, 'getCatalogs').mockResolvedValue({
        success: true,
        data: [{ id: 1, code: 'DATN', name: 'Đồ án tốt nghiệp' }],
    });
    vi.spyOn(topicService, 'getAll').mockResolvedValue({
        success: true,
        data: [
            {
                id: 301,
                code: 'DT-301',
                title: 'Hệ thống AI cũ',
                status: 'APPROVED',
                semesterId: 10,
                mentorId: 201,
                semester: { id: 10, name: 'HK1 2026-2027' },
                projectCatalog: { code: 'DATN', name: 'Đồ án tốt nghiệp' },
                registrations: [
                    {
                        id: 501,
                        status: 'IN_PROGRESS',
                        student: { id: 11, fullName: 'Nguyễn Văn A', code: 'SV001' },
                    },
                ],
            },
        ],
    });
    vi.spyOn(dashboardService, 'getLecturerOverview').mockResolvedValue({
        success: true,
        data: {
            activeSemester: { id: 10, name: 'HK1 2026-2027' },
            semesters: [{ id: 10, name: 'HK1 2026-2027' }],
            mentorSummary: {
                supervisedCount: 2,
                maxStudents: 10,
                pendingFeedbackCount: 0,
                actionableCount: 1,
                upcomingDeadlineCount: 0,
            },
            attentionItems: [
                {
                    id: 'bm02a-42',
                    source: 'MENTOR',
                    kind: 'TITLE_ADJUSTMENT_PENDING',
                    title: 'Duyệt đổi tên BM02-A: Nguyễn Văn A',
                    description: 'Hệ thống AI hỗ trợ phân loại tài liệu',
                    priority: 'NORMAL',
                    isActionable: true,
                    target: '/lecturer/title-adjustments?requestId=42',
                    allowedAction: 'REVIEW_TITLE_ADJUSTMENT',
                },
            ],
            students: [
                {
                    registrationId: 501,
                    studentId: 11,
                    studentName: 'Nguyễn Văn A',
                    studentCode: 'SV001',
                    topicTitle: 'Hệ thống AI cũ',
                    status: 'IN_PROGRESS',
                    bm02aRequestId: 42,
                    allowedActions: [],
                },
            ],
            generatedAt: '2026-11-18T00:00:00.000Z',
        },
    });
    vi.spyOn(bm02aService, 'getPendingQueue').mockResolvedValue({
        success: true,
        data: [bm02aRequest42, bm02aRequest43],
    });
    vi.spyOn(bm02aService, 'getRequestById').mockImplementation(async (id) => {
        const numId = Number(id);
        if (numId === 43) return { success: true, data: bm02aRequest43 };
        if (numId === 42) return { success: true, data: bm02aRequest42 };
        return { success: false, message: 'Not found' };
    });
});

afterEach(() => {
    cleanup();
    client.clear();
    useAuthStore.setState({ user: null, isAuthenticated: false });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const gvhdWithBm02aUser = {
    id: 201,
    fullName: 'TS. Trần Văn B',
    role: 'LECTURER',
    permissions: [
        'VIEW_MY_TOPICS',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_MENTOR_STUDENTS',
        'MENTOR_REQUEST_REVIEW',
        'BM02A_ADVISOR_SIGN',
    ],
};

function renderWithRoutes(initialEntries = ['/lecturer/dashboard'], userOverrides = {}) {
    useAuthStore.setState({
        isAuthenticated: true,
        user: {
            ...gvhdWithBm02aUser,
            ...userOverrides,
        },
    });

    return render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter initialEntries={initialEntries}>
                    <LocationProbe />
                    <Routes>
                        <Route path="/lecturer/dashboard" element={<LecturerDashboardPage />} />
                        <Route path="/lecturer/students" element={<LecturerStudentsPage />} />
                        <Route path="/lecturer/topics" element={<TopicManagementPage />} />
                        <Route path="/lecturer/approvals" element={<TopicApprovalPage />} />
                        <Route
                            element={(
                                <ProtectedRoute
                                    requiredAnyPermissions={[
                                        'BM02A_ADVISOR_SIGN',
                                        'BM02A_FINAL_APPROVE',
                                        'TITLE_ADJUSTMENT_APPENDIX_ISSUE',
                                        'DECISION_AMENDMENT_SIGN',
                                    ]}
                                />
                            )}
                        >
                            <Route path="/lecturer/title-adjustments" element={<TitleAdjustmentPage />} />
                        </Route>
                        <Route path="/student/dashboard" element={<div data-testid="student-home">Student Home</div>} />
                    </Routes>
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>,
    );
}

describe('BM02-A TitleAdjustmentPage profile-entry navigation (Task 6 Step 3)', () => {
    it('navigates from LecturerDashboard REVIEW_TITLE_ADJUSTMENT card to /lecturer/title-adjustments?requestId=42 and renders the request', async () => {
        renderWithRoutes(['/lecturer/dashboard']);

        expect(await screen.findByText('Duyệt đổi tên BM02-A: Nguyễn Văn A')).toBeInTheDocument();
        const userEv = userEvent.setup();
        await userEv.click(screen.getByRole('button', { name: /Xử lý đổi tên/ }));

        await waitFor(() => {
            expect(screen.getByTestId('location-probe').textContent).toBe('/lecturer/title-adjustments?requestId=42');
        });
        expect(await screen.findByText('Phiếu BM02-A #42 — Nguyễn Văn A')).toBeInTheDocument();
        expect(screen.getAllByText('Hệ thống AI hỗ trợ phân loại tài liệu').length).toBeGreaterThanOrEqual(1);
    });

    it('navigates from LecturerStudentsPage "Đổi tên BM02-A" button to /lecturer/title-adjustments?requestId=42', async () => {
        renderWithRoutes(['/lecturer/students']);

        const btn = await screen.findByRole('button', { name: /Đổi tên BM02-A/ });
        const userEv = userEvent.setup();
        await userEv.click(btn);

        await waitFor(() => {
            expect(screen.getByTestId('location-probe').textContent).toBe('/lecturer/title-adjustments?requestId=42');
        });
        expect(await screen.findByText('Phiếu BM02-A #42 — Nguyễn Văn A')).toBeInTheDocument();
    });

    it('navigates from TopicManagementPage "Duyệt đổi tên" button to /lecturer/title-adjustments?requestId=42', async () => {
        renderWithRoutes(['/lecturer/topics']);

        const btn = await screen.findByRole('button', { name: /Duyệt đổi tên/ });
        const userEv = userEvent.setup();
        await userEv.click(btn);

        await waitFor(() => {
            expect(screen.getByTestId('location-probe').textContent).toBe('/lecturer/title-adjustments?requestId=42');
        });
        expect(await screen.findByText('Phiếu BM02-A #42 — Nguyễn Văn A')).toBeInTheDocument();
    });

    it('redirects legacy /lecturer/approvals?tab=bm02a&requestId=42 to /lecturer/title-adjustments?requestId=42', async () => {
        renderWithRoutes(['/lecturer/approvals?tab=bm02a&requestId=42']);

        await waitFor(() => {
            expect(screen.getByTestId('location-probe').textContent).toBe('/lecturer/title-adjustments?requestId=42');
        });
        expect(await screen.findByText('Phiếu BM02-A #42 — Nguyễn Văn A')).toBeInTheDocument();
    });

    it('updates ?requestId when selecting another request and restores selection on Back/Forward', async () => {
        renderWithRoutes(['/lecturer/title-adjustments?requestId=42']);

        expect(await screen.findByText('Phiếu BM02-A #42 — Nguyễn Văn A')).toBeInTheDocument();

        const userEv = userEvent.setup();
        await userEv.click(screen.getByText(/#43 · Trần Thị B/));

        await waitFor(() => {
            expect(screen.getByTestId('location-probe').textContent).toBe('/lecturer/title-adjustments?requestId=43');
        });
        expect(await screen.findByText('Phiếu BM02-A #43 — Trần Thị B')).toBeInTheDocument();

        await userEv.click(screen.getByTestId('history-back'));
        await waitFor(() => {
            expect(screen.getByTestId('location-probe').textContent).toBe('/lecturer/title-adjustments?requestId=42');
        });
        expect(await screen.findByText('Phiếu BM02-A #42 — Nguyễn Văn A')).toBeInTheDocument();

        await userEv.click(screen.getByTestId('history-forward'));
        await waitFor(() => {
            expect(screen.getByTestId('location-probe').textContent).toBe('/lecturer/title-adjustments?requestId=43');
        });
        expect(await screen.findByText('Phiếu BM02-A #43 — Trần Thị B')).toBeInTheDocument();
    });

    it('blocks actor without BM02-A permissions from /lecturer/title-adjustments via ProtectedRoute', async () => {
        renderWithRoutes(['/lecturer/title-adjustments?requestId=42'], {
            role: 'LECTURER',
            permissions: ['VIEW_MY_TOPICS'],
        });

        await waitFor(() => {
            expect(screen.getByTestId('location-probe').textContent).toBe('/lecturer/dashboard');
        });
        expect(screen.queryByText(/Xử lý điều chỉnh tên đề tài \(BM02-A\)/)).not.toBeInTheDocument();
    });

    it('does not render BM02-A tab or content on /lecturer/approvals?tab=mentor', async () => {
        renderWithRoutes(['/lecturer/approvals?tab=mentor']);

        expect(await screen.findByText(/Nguyện Vọng Đăng Ký Hướng Dẫn/)).toBeInTheDocument();
        expect(screen.queryByText(/Duyệt phiếu đổi tên BM02-A/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Xử lý điều chỉnh tên đề tài \(BM02-A\)/)).not.toBeInTheDocument();
    });

    it('does not include a permanent BM02-A item in sidebar featurePolicies or visible navigation', () => {
        const hasBm02aPolicy = FEATURE_POLICY_LIST.some(
            (policy) => policy.menu && (policy.route?.includes('title-adjustments') || /BM02-A/i.test(policy.menu.label)),
        );
        expect(hasBm02aPolicy).toBe(false);

        const lecturerNav = getVisibleNavigation(gvhdWithBm02aUser);
        const hasBm02aNav = lecturerNav.some(
            (item) => item.route?.includes('title-adjustments') || /BM02-A|đổi tên/i.test(item.label),
        );
        expect(hasBm02aNav).toBe(false);
    });
});
