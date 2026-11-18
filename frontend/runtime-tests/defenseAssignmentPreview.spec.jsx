import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, test, expect, vi, describe } from 'vitest';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import DefenseAssignmentPreview from '../src/components/admin/DefenseAssignmentPreview.jsx';
import councilService from '../src/services/councilService.js';

let client;

const adminUser = {
    id: 1,
    role: 'ADMIN',
    fullName: 'Quản trị viên Hệ thống',
    permissions: ['DEFENSE_COUNCIL_MANAGE'],
};

const giaoVuUser = {
    id: 2,
    role: 'GIAO_VU',
    fullName: 'Giáo vụ Khoa',
    permissions: ['VIEW_DEFENSE_GRADING'],
};

const makeMockStudents = (count, startId = 1) => {
    return Array.from({ length: count }, (_, i) => {
        const id = startId + i;
        return {
            id,
            registrationId: id,
            studentId: 2000 + id,
            studentCode: `SV2026${String(id).padStart(3, '0')}`,
            studentName: `Sinh viên ${id}`,
            topicId: 3000 + id,
            topicTitle: `Đề tài nghiên cứu số ${id}`,
            mentorId: 4000 + (id % 5),
            mentorName: `GVHD Người hướng dẫn ${(id % 5) + 1}`,
            acceptedExpertise: ['AI', 'Software Engineering'],
            matchedExpertise: ['AI'],
            matchedRole: 'REVIEWER',
            matchedLecturerId: 103,
            explanation: `Phân vào Hội đồng 1 (Phòng P.301): Khớp chuyên môn [AI] với Phản biện.`,
        };
    });
};

const mockFeasible22Preview = {
    status: 'FEASIBLE',
    fingerprint: 'sha256-feasible-fingerprint-22',
    date: '2026-12-20',
    coverage: {
        totalEligible: 22,
        assigned: 22,
        coverageRate: 1.0,
        unassigned: 0,
    },
    explanations: ['Hội đồng 1 (Phòng P.301): 22 sinh viên (Sáng: 11, Chiều: 11).'],
    councils: [
        {
            id: null,
            name: 'Hội đồng 1',
            date: '2026-12-20',
            defenseDate: '2026-12-20',
            location: 'P.301',
            studentCount: 22,
            members: [
                { role: 'CHAIRMAN', lecturerId: 101, fullName: 'TS. Nguyễn Văn A', expertiseAreas: ['Security', 'Cloud'] },
                { role: 'SECRETARY', lecturerId: 102, fullName: 'ThS. Trần Thị B', expertiseAreas: ['Database', 'Web'] },
                { role: 'REVIEWER', lecturerId: 103, fullName: 'PGS. TS. Lê Văn C', expertiseAreas: ['AI', 'Data Mining'] },
            ],
            morningShift: {
                time: '07:00 - 11:00',
                students: makeMockStudents(11, 1),
            },
            afternoonShift: {
                time: '13:00 - 17:00',
                students: makeMockStudents(11, 12),
            },
        },
    ],
};

const mockFeasible23Preview = {
    status: 'FEASIBLE',
    fingerprint: 'sha256-feasible-fingerprint-23',
    date: '2026-12-20',
    coverage: {
        totalEligible: 23,
        assigned: 23,
        coverageRate: 1.0,
        unassigned: 0,
    },
    explanations: ['Hội đồng 1 (Phòng P.301): 23 sinh viên (Sáng: 12, Chiều: 11).'],
    councils: [
        {
            id: null,
            name: 'Hội đồng 1',
            date: '2026-12-20',
            defenseDate: '2026-12-20',
            location: 'P.301',
            studentCount: 23,
            members: [
                { role: 'CHAIRMAN', lecturerId: 101, fullName: 'TS. Nguyễn Văn A', expertiseAreas: ['Security'] },
                { role: 'SECRETARY', lecturerId: 102, fullName: 'ThS. Trần Thị B', expertiseAreas: ['Database'] },
                { role: 'REVIEWER', lecturerId: 103, fullName: 'PGS. TS. Lê Văn C', expertiseAreas: ['AI'] },
            ],
            morningShift: {
                time: '07:00 - 11:00',
                students: makeMockStudents(12, 1),
            },
            afternoonShift: {
                time: '13:00 - 17:00',
                students: makeMockStudents(11, 13),
            },
        },
    ],
};

const mockInfeasiblePreview = {
    status: 'INFEASIBLE',
    reasons: [
        'Số phòng khả dụng không đủ cho số hội đồng dự kiến',
        'Không có giảng viên khớp chuyên môn cho đề tài: "Bảo mật mạng lượng tử"',
    ],
    coverage: {
        totalEligible: 22,
        assigned: 0,
        coverageRate: 0,
    },
    councils: [],
};

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
        queries: { retry: false, staleTime: 60000 },
        mutations: { retry: false },
    });

    useAuthStore.setState({ user: adminUser, isAuthenticated: true });
});

afterEach(() => {
    cleanup();
    client?.clear();
    vi.restoreAllMocks();
});

describe('DefenseAssignmentPreview Component', () => {
    test('1. Test hiển thị preview FEASIBLE và các số liệu thống kê', () => {
        render(
            <AppQueryProvider client={client}>
                <DefenseAssignmentPreview
                    previewData={mockFeasible22Preview}
                    semesterId={10}
                    userRole="ADMIN"
                />
            </AppQueryProvider>
        );

        // Trạng thái badge FEASIBLE
        expect(screen.getByText(/Khả thi \(FEASIBLE\)/i)).toBeInTheDocument();

        // Thống kê bao phủ
        expect(screen.getAllByText('22 SV').length).toBe(2);
        expect(screen.getByText('100%')).toBeInTheDocument();
        expect(screen.getByText('2026-12-20')).toBeInTheDocument();

        // Hội đồng và thành viên
        expect(screen.getByText('Hội đồng 1')).toBeInTheDocument();
        expect(screen.getByText('TS. Nguyễn Văn A')).toBeInTheDocument();
        expect(screen.getByText('ThS. Trần Thị B')).toBeInTheDocument();
        expect(screen.getByText('PGS. TS. Lê Văn C')).toBeInTheDocument();
    });

    test('2. Test hiển thị preview INFEASIBLE với danh sách nguyên nhân và ẩn nút xác nhận', () => {
        render(
            <AppQueryProvider client={client}>
                <DefenseAssignmentPreview
                    previewData={mockInfeasiblePreview}
                    semesterId={10}
                    userRole="ADMIN"
                />
            </AppQueryProvider>
        );

        // Badge INFEASIBLE
        expect(screen.getByText(/Không khả thi \(INFEASIBLE\)/i)).toBeInTheDocument();

        // Hiển thị các lý do lỗi
        expect(screen.getByText(/Số phòng khả dụng không đủ cho số hội đồng dự kiến/i)).toBeInTheDocument();
        expect(screen.getByText(/Không có giảng viên khớp chuyên môn cho đề tài/i)).toBeInTheDocument();

        // Nút xác nhận phân công KHÔNG xuất hiện
        expect(screen.queryByText('Xác nhận phân công hội đồng')).not.toBeInTheDocument();
    });

    test('3. Test phân chia 2 ca (11/11 cho 22 SV, 12/11 cho 23 SV)', () => {
        // Render 22 SV (11 Sáng, 11 Chiều)
        const { unmount } = render(
            <AppQueryProvider client={client}>
                <DefenseAssignmentPreview
                    previewData={mockFeasible22Preview}
                    semesterId={10}
                    userRole="ADMIN"
                />
            </AppQueryProvider>
        );

        expect(screen.getByText(/Ca Sáng \(07:00 – 11:00\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Ca Chiều \(13:00 – 17:00\)/i)).toBeInTheDocument();
        // Có 2 badge '11 sinh viên' (1 cho ca sáng, 1 cho ca chiều)
        const badges22 = screen.getAllByText('11 sinh viên');
        expect(badges22.length).toBe(2);

        unmount();

        // Render 23 SV (12 Sáng, 11 Chiều)
        render(
            <AppQueryProvider client={client}>
                <DefenseAssignmentPreview
                    previewData={mockFeasible23Preview}
                    semesterId={10}
                    userRole="ADMIN"
                />
            </AppQueryProvider>
        );

        // Ca Sáng có 12 SV, Ca Chiều có 11 SV
        expect(screen.getByText('12 sinh viên')).toBeInTheDocument();
        expect(screen.getByText('11 sinh viên')).toBeInTheDocument();
    });

    test('4. Test nút xác nhận chỉ khả dụng cho ADMIN khi status FEASIBLE', () => {
        // Trường hợp ADMIN: có nút xác nhận
        const { unmount } = render(
            <AppQueryProvider client={client}>
                <DefenseAssignmentPreview
                    previewData={mockFeasible22Preview}
                    semesterId={10}
                    userRole="ADMIN"
                />
            </AppQueryProvider>
        );

        const confirmBtn = screen.getByText('Xác nhận phân công hội đồng');
        expect(confirmBtn).toBeInTheDocument();

        unmount();

        // Trường hợp GIAO_VU: không có nút xác nhận, hiển thị banner chỉ đọc
        render(
            <AppQueryProvider client={client}>
                <DefenseAssignmentPreview
                    previewData={mockFeasible22Preview}
                    semesterId={10}
                    userRole="GIAO_VU"
                />
            </AppQueryProvider>
        );

        expect(screen.queryByText('Xác nhận phân công hội đồng')).not.toBeInTheDocument();
        expect(screen.getByText(/Chế độ xem dành cho Giáo vụ/i)).toBeInTheDocument();
    });

    test('5. Test xử lý lỗi 409 Conflict hiển thị thông báo và nút Tạo lại xem trước', async () => {
        const handleRegenerate = vi.fn();
        const user = userEvent.setup();

        vi.spyOn(councilService, 'confirmDefenseAssignment').mockRejectedValue({
            status: 409,
            code: 'STALE_PREVIEW',
            message: 'Dữ liệu nguồn đã thay đổi. Vui lòng tạo lại bản xem trước.',
        });

        render(
            <AppQueryProvider client={client}>
                <DefenseAssignmentPreview
                    previewData={mockFeasible22Preview}
                    semesterId={10}
                    userRole="ADMIN"
                    onRegeneratePreview={handleRegenerate}
                />
            </AppQueryProvider>
        );

        const confirmBtn = screen.getByText('Xác nhận phân công hội đồng');
        await user.click(confirmBtn);

        // Thông báo lỗi 409 xuất hiện
        await waitFor(() => {
            expect(screen.getByText(/Dữ liệu nguồn đã thay đổi \(Xung đột 409\)/i)).toBeInTheDocument();
        });

        // Nút Tạo lại xem trước có thể bấm
        const regenerateButtons = screen.getAllByText('Tạo lại xem trước');
        expect(regenerateButtons.length).toBeGreaterThan(0);

        await user.click(regenerateButtons[0]);
        expect(handleRegenerate).toHaveBeenCalled();
    });
});
