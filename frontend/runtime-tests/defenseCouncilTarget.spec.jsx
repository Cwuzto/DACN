import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, test, expect, vi, describe } from 'vitest';
import { ConfigProvider } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import ProjectPeriodPage from '../src/pages/admin/ProjectPeriodPage.jsx';
import { semesterService } from '../src/services/semesterService.js';
import { topicService } from '../src/services/topicService.js';
import registrationService from '../src/services/registrationService.js';

let client;
const adminUser = {
    id: 1,
    role: 'ADMIN',
    fullName: 'Admin User',
    permissions: ['SEMESTER_MANAGE', 'PROJECT_ASSIGNMENT_PUBLISH'],
};

const mockSemesters = [
    {
        id: 10,
        name: 'Đợt 1 Học kỳ 1 2026-2027',
        code: 'DATN-HK1-2026-27',
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2027-01-15T00:00:00.000Z',
        registrationDeadline: '2026-09-20T00:00:00.000Z',
        midtermReportDate: null,
        defenseDate: '2027-01-10T00:00:00.000Z',
        defenseCouncilTargetSize: 22,
        registrationOpen: true,
        status: 'ONGOING',
    },
];

// Generate 100 eligible unassigned students for semester 10
const mock100EligibleRegistrations = Array.from({ length: 100 }, (_, i) => ({
    id: 1000 + i,
    semesterId: 10,
    status: 'DEFENSE_READY',
    studentId: 2000 + i,
    student: { id: 2000 + i, fullName: `Sinh vien ${i + 1}`, code: `SV${1000 + i}` },
    topicId: 3000 + i,
    topic: { id: 3000 + i, title: `De tai ${i + 1}` },
    defenseCouncilId: null,
    councilId: null,
}));

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
    const native = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => native(el));

    client = createAppQueryClient();
    client.setDefaultOptions({
        queries: { retry: false, staleTime: 60000 },
        mutations: { retry: false },
    });

    useAuthStore.setState({ user: adminUser, isAuthenticated: true });

    vi.spyOn(semesterService, 'getAll').mockResolvedValue({
        success: true,
        data: mockSemesters,
    });
    vi.spyOn(topicService, 'getAll').mockResolvedValue({
        success: true,
        data: [],
    });
    vi.spyOn(registrationService, 'getAllRegistrations').mockResolvedValue({
        success: true,
        data: mock100EligibleRegistrations,
    });
    vi.spyOn(semesterService, 'create').mockResolvedValue({
        success: true,
        data: { id: 20, name: 'New Semester', defenseCouncilTargetSize: 22 },
    });
    vi.spyOn(semesterService, 'update').mockResolvedValue({
        success: true,
        data: { id: 10, name: 'Updated Semester', defenseCouncilTargetSize: 25 },
    });
});

afterEach(() => {
    cleanup();
    client.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function mount(children, url = '/') {
    return render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter initialEntries={[url]}>
                    {children}
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );
}

describe('Frontend - Defense Council Target Size and Estimate', () => {
    test('create modal opens with default target size 22', async () => {
        mount(<ProjectPeriodPage />);

        const createButton = await screen.findByRole('button', { name: /Khởi tạo Đợt Đồ án mới/i });
        fireEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const targetInput = screen.getByLabelText(/Quy mô mục tiêu HĐ bảo vệ/i);
        expect(targetInput).toBeInTheDocument();
        expect(targetInput).toHaveValue('22');
        expect(targetInput).toHaveAttribute('aria-valuemin', '1');
        expect(targetInput).toHaveAttribute('aria-valuemax', '30');
    });

    test('edit modal loads existing target size and calculates 5 councils for 100 students at target 22', async () => {
        mount(<ProjectPeriodPage />);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Học kỳ 1 - 2026-2027' })).toBeInTheDocument();
        });

        const editButton = screen.getByRole('button', { name: /Chỉnh sửa đợt/i });
        fireEvent.click(editButton);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const targetInput = screen.getByLabelText(/Quy mô mục tiêu HĐ bảo vệ/i);
        expect(targetInput).toBeInTheDocument();
        expect(targetInput).toHaveValue('22');

        // With 100 remaining students and target 22, ceil(100 / 22) = 5 councils
        const estimateText = await screen.findByTestId('defense-council-estimate');
        expect(estimateText).toHaveTextContent(/Ước tính số hội đồng cần lập/i);
        expect(estimateText).toHaveTextContent(/5/);
        expect(estimateText).toHaveTextContent(/100 sinh viên còn cần xếp/i);
    });

    test('changing target size updates estimated councils dynamically', async () => {
        mount(<ProjectPeriodPage />);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Học kỳ 1 - 2026-2027' })).toBeInTheDocument();
        });

        const editButton = screen.getByRole('button', { name: /Chỉnh sửa đợt/i });
        fireEvent.click(editButton);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const targetInput = screen.getByLabelText(/Quy mô mục tiêu HĐ bảo vệ/i);

        // Change target to 25 -> ceil(100 / 25) = 4 councils
        fireEvent.change(targetInput, { target: { value: '25' } });

        const estimateText = await screen.findByTestId('defense-council-estimate');
        await waitFor(() => {
            expect(estimateText).toHaveTextContent(/4/);
        });

        // Change target to 1 -> ceil(100 / 1) = 100 councils
        fireEvent.change(targetInput, { target: { value: '1' } });
        await waitFor(() => {
            expect(estimateText).toHaveTextContent(/100/);
        });

        // Change target to 30 -> ceil(100 / 30) = 4 councils
        fireEvent.change(targetInput, { target: { value: '30' } });
        await waitFor(() => {
            expect(estimateText).toHaveTextContent(/4/);
        });
    });

    test('saving edit form submits defenseCouncilTargetSize', async () => {
        mount(<ProjectPeriodPage />);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Học kỳ 1 - 2026-2027' })).toBeInTheDocument();
        });

        const editButton = screen.getByRole('button', { name: /Chỉnh sửa đợt/i });
        fireEvent.click(editButton);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const targetInput = screen.getByLabelText(/Quy mô mục tiêu HĐ bảo vệ/i);
        fireEvent.change(targetInput, { target: { value: '25' } });

        const submitButton = screen.getByRole('button', { name: /Cập nhật/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(semesterService.update).toHaveBeenCalledWith(
                10,
                expect.objectContaining({
                    defenseCouncilTargetSize: 25,
                })
            );
        });
    });
});
