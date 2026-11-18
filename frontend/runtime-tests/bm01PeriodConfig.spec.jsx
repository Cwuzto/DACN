import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
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
        outlineSubmissionOpenAt: '2026-09-25T00:00:00.000Z',
        outlineSubmissionDeadline: '2026-10-10T00:00:00.000Z',
        outlineTemplateAssetId: 'asset-bm01-template-id',
        outlineTemplateFileUrl: '/api/assets/asset-bm01-template-id/download',
        registrationOpen: true,
        status: 'ONGOING',
    },
];

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
        data: [],
    });
    vi.spyOn(semesterService, 'create').mockResolvedValue({
        success: true,
        data: { id: 20, name: 'New Semester' },
    });
    vi.spyOn(semesterService, 'update').mockResolvedValue({
        success: true,
        data: { id: 10, name: 'Updated Semester' },
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

describe('BM01 Period Configuration (Fix P0.3, P0.5, P1.2)', () => {
    test('renders BM01 outline submission window and template upload in period modal', async () => {
        mount(<ProjectPeriodPage />);

        const createButton = await screen.findByRole('button', { name: /Khởi tạo Đợt Đồ án mới/i });
        fireEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Verify BM01 configuration fields are present in modal
        expect(screen.getByLabelText(/Ngày mở nộp đề cương BM01/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Hạn nộp đề cương BM01/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Tải lên mẫu đề cương/i })).toBeInTheDocument();
    });

    test('edit period pre-populates BM01 template file and submission window', async () => {
        mount(<ProjectPeriodPage />);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Học kỳ 1 - 2026-2027' })).toBeInTheDocument();
        });

        const editButton = screen.getByRole('button', { name: /Chỉnh sửa đợt/i });
        fireEvent.click(editButton);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        expect(screen.getByLabelText(/Ngày mở nộp đề cương BM01/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Hạn nộp đề cương BM01/i)).toBeInTheDocument();

        // Verify template download link / name is rendered for semester with existing template
        await waitFor(() => {
            expect(screen.getByText(/Mẫu đề cương hiện tại/i)).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: /Gỡ bỏ/i })).toBeInTheDocument();
    });
});
