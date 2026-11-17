import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider } from 'antd';
import LecturerStudentsPage from '../src/pages/lecturer/LecturerStudentsPage.jsx';
import TopicApprovalPage from '../src/pages/lecturer/TopicApprovalPage.jsx';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import dashboardService from '../src/services/dashboardService.js';
import registrationService from '../src/services/registrationService.js';
import bm02aService from '../src/services/bm02aService.js';

let client;

function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
    vi.spyOn(registrationService, 'getAllRegistrations').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(bm02aService, 'getPendingQueue').mockResolvedValue({ success: true, data: [] });
});

afterEach(() => {
    cleanup();
    client.clear();
    useAuthStore.setState({ user: null, isAuthenticated: false });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function renderLecturerApp(initialEntries = ['/lecturer/students'], userOverrides = {}) {
    useAuthStore.setState({
        isAuthenticated: true,
        user: {
            id: 201,
            role: 'LECTURER',
            permissions: ['VIEW_MENTORED_STUDENTS', 'MENTOR_REQUEST_REVIEW', 'VIEW_OUTLINE_REVIEWS'],
            hasOutlineCouncilAssignment: true,
            ...userOverrides,
        },
    });
    return render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter initialEntries={initialEntries}>
                    <LocationProbe />
                    <Routes>
                        <Route path="/lecturer/students" element={<LecturerStudentsPage />} />
                        <Route path="/lecturer/approvals" element={<TopicApprovalPage />} />
                    </Routes>
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );
}

describe('LecturerStudentsPage and TopicApprovalPage navigation', () => {
    it('renders only mentor-scoped students from lecturer overview without asInstituteDirector fetch', async () => {
        vi.spyOn(dashboardService, 'getLecturerOverview').mockResolvedValue({
            success: true,
            data: {
                activeSemester: { id: 10, name: 'HK1 2026-2027' },
                semesters: [{ id: 10, name: 'HK1 2026-2027' }],
                students: [
                    { registrationId: 1, studentId: 11, studentName: 'Nguyễn Văn A', studentCode: 'SV001', topicTitle: 'Đề tài A', status: 'IN_PROGRESS' },
                    { registrationId: 2, studentId: 12, studentName: 'Trần Thị B', studentCode: 'SV002', topicTitle: 'Đề tài B', status: 'BM01_SUBMITTED' },
                ],
            },
        });

        renderLecturerApp(['/lecturer/students'], {
            permissionGroups: ['GVHD', 'VIEN_TRUONG'],
        });

        expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
        expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
        expect(screen.getByText('2 sinh viên')).toBeInTheDocument();
        expect(registrationService.getAllRegistrations).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', { name: /Duyệt nguyện vọng/ }));
        await waitFor(() => {
            expect(screen.getByTestId('location-probe').textContent).toBe('/lecturer/approvals?tab=mentor');
        });
    });

    it('renders distinct empty and error states on LecturerStudentsPage', async () => {
        vi.spyOn(dashboardService, 'getLecturerOverview').mockResolvedValueOnce({
            success: true,
            data: {
                activeSemester: { id: 10, name: 'HK1 2026-2027' },
                semesters: [{ id: 10, name: 'HK1 2026-2027' }],
                students: [],
            },
        });

        const { unmount } = renderLecturerApp(['/lecturer/students']);
        expect(await screen.findByText('Chưa có sinh viên trong đợt')).toBeInTheDocument();
        unmount();

        vi.spyOn(dashboardService, 'getLecturerOverview').mockRejectedValueOnce(new Error('Lỗi tải dữ liệu'));
        renderLecturerApp(['/lecturer/students']);
        expect(await screen.findByText('Không thể tải danh sách sinh viên đang hướng dẫn')).toBeInTheDocument();
    });

    it('synchronizes TopicApprovalPage tabs with query params without BM02-A tab', async () => {
        renderLecturerApp(['/lecturer/approvals?tab=bm01']);
        expect(await screen.findByText(/Hội Đồng Thẩm Định Đề Cương Chi Tiết/)).toBeInTheDocument();
        expect(screen.queryByText(/Duyệt phiếu đổi tên BM02-A/)).not.toBeInTheDocument();

        await userEvent.click(screen.getByText(/Nguyện Vọng Đăng Ký Hướng Dẫn/));
        await waitFor(() => {
            expect(screen.getByTestId('location-probe').textContent).toBe('/lecturer/approvals?tab=mentor');
        });
    });
});
