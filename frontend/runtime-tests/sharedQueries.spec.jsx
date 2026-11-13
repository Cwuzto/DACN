import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { ConfigProvider, Modal, message } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import { queryKeys } from '../src/query/queryKeys.js';
import useAuthStore from '../src/stores/authStore.js';

import NotificationsPage from '../src/pages/common/NotificationsPage.jsx';
import ProfilePage from '../src/pages/common/ProfilePage.jsx';
import HomePage from '../src/pages/common/HomePage.jsx';
import AppLayout from '../src/components/layout/AppLayout.jsx';

import MentorTransferModal from '../src/components/admin/MentorTransferModal.jsx';
import RegistrationTimelineDrawer from '../src/components/common/RegistrationTimelineDrawer.jsx';
import BM04EvaluationModal from '../src/components/lecturer/BM04EvaluationModal.jsx';
import TitleAdjustmentModal from '../src/components/student/TitleAdjustmentModal.jsx';

import notificationService from '../src/services/notificationService.js';
import authService from '../src/services/authService.js';
import userService from '../src/services/userService.js';
import portalContentService from '../src/services/portalContentService.js';
import { semesterService } from '../src/services/semesterService.js';
import registrationService from '../src/services/registrationService.js';
import evaluationService from '../src/services/evaluationService.js';
import bm02aService from '../src/services/bm02aService.js';

let client;
const mockStudentUser = {
    id: 101,
    fullName: 'Nguyen Van Sinh Vien',
    email: 'sinhvien@hcmut.edu.vn',
    role: 'STUDENT',
    code: 'SV2026',
    phone: '0901234567',
    avatarUrl: 'https://example.com/avatar.png',
    permissions: [],
    studentProfile: {
        className: 'CC01',
        major: 'Khoa học Máy tính',
    },
};

const mockLecturerUser = {
    id: 201,
    fullName: 'TS. Tran Van Huong Dan',
    email: 'giangvien@hcmut.edu.vn',
    role: 'LECTURER',
    code: 'GV2026',
    department: 'Khoa học và Kỹ thuật Máy tính',
    permissions: [],
};

const mockNotifications = [
    {
        id: 1,
        title: 'Nhắc nhở nộp báo cáo tiến độ',
        content: 'Hạn chót nộp báo cáo đợt 1 là 23:59 ngày mai.',
        type: 'TASK_REMINDER',
        isRead: false,
        createdAt: '2026-11-13T10:00:00Z',
    },
    {
        id: 2,
        title: 'Hồ sơ đề tài đã được duyệt',
        content: 'Giảng viên đã chấp thuận đề tài của bạn.',
        type: 'APPROVAL',
        isRead: true,
        createdAt: '2026-11-12T08:00:00Z',
    },
];

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
    const native = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => native(element));

    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: 60000 }, mutations: { retry: false } });
    useAuthStore.setState({ user: mockStudentUser, isAuthenticated: true });

    vi.spyOn(authService, 'getMe').mockResolvedValue({ success: true, data: mockStudentUser });
    vi.spyOn(notificationService, 'getMyNotifications').mockResolvedValue({ success: true, data: mockNotifications });
    vi.spyOn(notificationService, 'markRead').mockResolvedValue({ success: true });
    vi.spyOn(notificationService, 'markAllRead').mockResolvedValue({ success: true });
    vi.spyOn(notificationService, 'deleteNotification').mockResolvedValue({ success: true });

    vi.spyOn(semesterService, 'getPublic').mockResolvedValue({
        success: true,
        data: [{ id: 10, name: 'Học kỳ 1 2026-2027', code: 'HK1_2026', status: 'ONGOING' }],
    });
    vi.spyOn(semesterService, 'getAll').mockResolvedValue({
        success: true,
        data: [{ id: 10, name: 'Học kỳ 1 2026-2027', code: 'HK1_2026', status: 'ONGOING' }],
    });
    vi.spyOn(userService, 'getPublicLecturers').mockResolvedValue({
        success: true,
        data: [{ id: 201, fullName: 'TS. Tran Van Huong Dan', email: 'hd@hcmut.edu.vn', department: 'CSE' }],
    });
    vi.spyOn(userService, 'getUsers').mockResolvedValue({
        success: true,
        data: [
            { id: 201, fullName: 'TS. Tran Van Huong Dan', role: 'LECTURER', isActive: true },
            { id: 202, fullName: 'PGS. TS. Le Thi B', role: 'LECTURER', isActive: true },
        ],
    });
    vi.spyOn(portalContentService, 'getPublicContent').mockResolvedValue({
        success: true,
        data: {
            templates: [],
            announcements: [
                { id: 'tb-01', title: 'Thông báo mở đợt đăng ký đề tài HK1 2026', category: 'ANNOUNCEMENT', date: '10/11/2026' },
            ],
        },
    });
    vi.spyOn(registrationService, 'getAllRegistrations').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(registrationService, 'getRegistrationHistory').mockResolvedValue({
        success: true,
        data: [
            { id: 1, toStatus: 'PROPOSED', createdAt: '2026-11-01T08:00:00Z', actor: { fullName: 'SV', role: 'STUDENT' } },
        ],
    });
    vi.spyOn(evaluationService, 'getBM04Record').mockResolvedValue({
        success: true,
        data: {
            thesisFormatScore: 9,
            researchContentScore: 8.5,
            applicabilityScore: 8,
            attitudeScore: 9,
            programOutcome: 'MEETS_PROGRAM_OUTCOMES',
            defenseRecommendation: 'APPROVE_FOR_DEFENSE',
            lecturerSignature: 'TS. Tran Van Huong Dan',
        },
    });
    vi.spyOn(bm02aService, 'getRequestsByRegistration').mockResolvedValue({
        success: true,
        data: [
            { id: 1, currentVersionNumber: 1, versions: [{ versionNumber: 1, proposedTitle: 'De tai moi' }], status: 'PENDING_LECTURER' },
        ],
    });
});

afterEach(() => {
    cleanup();
    client.clear();
    Modal.destroyAll();
    message.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function renderWithClient(ui, initialEntries = ['/']) {
    return render(
        <AppQueryProvider client={client}>
            <ConfigProvider>
                <MemoryRouter initialEntries={initialEntries}>
                    {ui}
                </MemoryRouter>
            </ConfigProvider>
        </AppQueryProvider>
    );
}

test('NotificationsPage renders notifications and handles mark as read mutation', async () => {
    renderWithClient(<NotificationsPage />);

    // Should display notification items
    await waitFor(() => {
        expect(screen.getByText('Nhắc nhở nộp báo cáo tiến độ')).toBeInTheDocument();
        expect(screen.getByText('Hồ sơ đề tài đã được duyệt')).toBeInTheDocument();
    });

    // Unread count should reflect 1 unread
    expect(screen.getByText('1 thông báo chưa đọc')).toBeInTheDocument();

    // Mark single notification as read
    const unreadItem = screen.getByText('Nhắc nhở nộp báo cáo tiến độ');
    await userEvent.click(unreadItem);
    await waitFor(() => {
        expect(notificationService.markRead).toHaveBeenCalledWith(1);
    });
});

test('NotificationsPage displays empty state when notifications list is empty', async () => {
    vi.spyOn(notificationService, 'getMyNotifications').mockResolvedValue({ success: true, data: [] });
    renderWithClient(<NotificationsPage />);

    await waitFor(() => {
        expect(screen.getByText('Bạn hiện không có thông báo nào trong mục này.')).toBeInTheDocument();
        expect(screen.getByText('0 thông báo chưa đọc')).toBeInTheDocument();
    });
});

test('ProfilePage displays student profile and restricts editing of academic fields', async () => {
    renderWithClient(<ProfilePage />);

    await waitFor(() => {
        expect(screen.getByText('Hồ sơ cá nhân')).toBeInTheDocument();
        expect(screen.getAllByText('Nguyen Van Sinh Vien').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/CC01/).length).toBeGreaterThan(0);
        expect(screen.getAllByText('Khoa học Máy tính').length).toBeGreaterThan(0);
    });

    // Enter edit mode
    const editBtn = screen.getByRole('button', { name: /Chỉnh sửa hồ sơ/ });
    await userEvent.click(editBtn);

    // In edit mode, student can edit phone
    expect(screen.getByDisplayValue('0901234567')).toBeInTheDocument();

    // But class and major remain non-editable divs (not inputs)
    expect(screen.queryByRole('textbox', { name: /Lớp/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Ngành/i })).not.toBeInTheDocument();
});

test('HomePage loads public portal data through queries without manual service effects', async () => {
    renderWithClient(<HomePage />);

    await waitFor(() => {
        expect(screen.getByText('Thông báo mở đợt đăng ký đề tài HK1 2026')).toBeInTheDocument();
    });
});

test('MentorTransferModal queries lecturers only when open', async () => {
    const { rerender } = renderWithClient(
        <MentorTransferModal
            open={false}
            registration={{ id: 501, topic: { mentorId: 201 } }}
            onClose={() => {}}
        />
    );

    // When closed, should not fetch lecturers
    expect(userService.getUsers).not.toHaveBeenCalled();

    rerender(
        <AppQueryProvider client={client}>
            <ConfigProvider>
                <MemoryRouter>
                    <MentorTransferModal
                        open={true}
                        registration={{ id: 501, topic: { mentorId: 201 } }}
                        onClose={() => {}}
                    />
                </MemoryRouter>
            </ConfigProvider>
        </AppQueryProvider>
    );

    await waitFor(() => {
        expect(userService.getUsers).toHaveBeenCalled();
    });
});

test('RegistrationTimelineDrawer queries timeline history only when open', async () => {
    const { rerender } = renderWithClient(
        <RegistrationTimelineDrawer
            open={false}
            registrationId={501}
            onClose={() => {}}
        />
    );

    expect(registrationService.getRegistrationHistory).not.toHaveBeenCalled();

    rerender(
        <AppQueryProvider client={client}>
            <ConfigProvider>
                <MemoryRouter>
                    <RegistrationTimelineDrawer
                        open={true}
                        registrationId={501}
                        onClose={() => {}}
                    />
                </MemoryRouter>
            </ConfigProvider>
        </AppQueryProvider>
    );

    await waitFor(() => {
        expect(registrationService.getRegistrationHistory).toHaveBeenCalledWith(501);
    });
});
