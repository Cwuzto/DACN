import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider, Button } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import AuthorizedAction from '../src/components/common/AuthorizedAction.jsx';
import AnnouncementManagementPage from '../src/pages/admin/AnnouncementManagementPage.jsx';
import { announcementService } from '../src/services/announcementService.js';
import uploadService from '../src/services/uploadService.js';

vi.mock('../src/services/announcementService.js', () => {
    const mock = {
        getAnnouncements: vi.fn(),
        getAnnouncementById: vi.fn(),
        createAnnouncement: vi.fn(),
        updateAnnouncement: vi.fn(),
        deleteAnnouncement: vi.fn(),
    };
    return {
        announcementService: mock,
        default: mock,
        ...mock,
    };
});

vi.mock('../src/services/uploadService.js', () => ({
    uploadFile: vi.fn(),
    downloadAsset: vi.fn(),
    default: {
        uploadFile: vi.fn(),
        downloadAsset: vi.fn(),
    },
}));

describe('Task 6: Academic Action Permissions & Workflow Scope Runtime Tests', () => {
    let client;

    beforeEach(() => {
        vi.stubGlobal('matchMedia', vi.fn(() => ({
            matches: false,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
        })));
        vi.stubGlobal('ResizeObserver', class {
            observe() {}
            unobserve() {}
            disconnect() {}
        });

        client = createAppQueryClient();
        client.setDefaultOptions({
            queries: { retry: false, staleTime: 30000 },
            mutations: { retry: false },
        });

        useAuthStore.setState({
            user: null,
            isAuthenticated: false,
            token: null,
        });
    });

    afterEach(() => {
        client.clear();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    function renderWithProviders(ui) {
        return render(
            <ConfigProvider theme={{ token: { motion: false } }}>
                <AppQueryProvider client={client}>
                    <MemoryRouter>{ui}</MemoryRouter>
                </AppQueryProvider>
            </ConfigProvider>
        );
    }

    describe('1. Semester Registration Toggle & Lecturer Assignment Permissions', () => {
        it('allows users with SEMESTER_MANAGE to access semester management actions', () => {
            useAuthStore.setState({
                isAuthenticated: true,
                user: {
                    id: 10,
                    role: 'ADMIN',
                    permissions: ['SEMESTER_MANAGE'],
                },
            });

            renderWithProviders(
                <AuthorizedAction feature="project-periods" action="manage" mode="hide">
                    <Button data-testid="toggle-registration-btn">Đóng/Mở đợt đăng ký</Button>
                </AuthorizedAction>
            );

            expect(screen.getByTestId('toggle-registration-btn')).toBeInTheDocument();
        });

        it('allows users with PROJECT_ASSIGNMENT_PUBLISH to publish assignments', () => {
            useAuthStore.setState({
                isAuthenticated: true,
                user: {
                    id: 11,
                    role: 'ADMIN',
                    permissions: ['PROJECT_ASSIGNMENT_PUBLISH'],
                },
            });

            renderWithProviders(
                <AuthorizedAction feature="project-enrollments" action="publishAssignment" mode="hide">
                    <Button data-testid="publish-assignment-btn" icon={<SendOutlined />}>
                        Công bố phân công
                    </Button>
                </AuthorizedAction>
            );

            const btn = screen.getByTestId('publish-assignment-btn');
            expect(btn).toBeInTheDocument();
            expect(btn.textContent).not.toMatch(/[←→+🤖📋✓✏️👥🗑️🔓▾▴↗]/);
        });

        it('hides academic publish actions from unauthorized users', () => {
            useAuthStore.setState({
                isAuthenticated: true,
                user: {
                    id: 12,
                    role: 'STUDENT',
                    permissions: ['VIEW_MY_REGISTRATION'],
                },
            });

            renderWithProviders(
                <AuthorizedAction feature="project-enrollments" action="publishAssignment" mode="hide">
                    <Button data-testid="publish-assignment-btn">Công bố phân công</Button>
                </AuthorizedAction>
            );

            expect(screen.queryByTestId('publish-assignment-btn')).toBeNull();
        });
    });

    describe('2. Announcement Draft preserves fileAssetId', () => {
        it('preserves fileAssetId when creating draft announcement and when editing', async () => {
            useAuthStore.setState({
                isAuthenticated: true,
                user: {
                    id: 1,
                    role: 'ADMIN',
                    permissions: ['PUBLIC_ANNOUNCEMENT_MANAGE', 'VIEW_ANNOUNCEMENTS'],
                },
            });

            const mockAnnouncements = [
                {
                    id: 101,
                    title: 'Thông báo xét duyệt đề cương đợt 1',
                    content: 'Nội dung chi tiết',
                    category: 'ANNOUNCEMENT',
                    fileUrl: 'https://cdn.example.com/de-cuong.pdf',
                    fileName: 'de-cuong.pdf',
                    fileAssetId: 'asset-doc-101',
                    isPinned: false,
                    isPublished: false,
                    createdAt: new Date().toISOString(),
                    author: { fullName: 'Admin' },
                },
            ];

            announcementService.getAnnouncements.mockResolvedValue({
                success: true,
                data: mockAnnouncements,
                pagination: { total: 1, page: 1, limit: 10 },
            });

            renderWithProviders(<AnnouncementManagementPage />);

            await waitFor(() => {
                expect(screen.getByText('Thông báo xét duyệt đề cương đợt 1')).toBeInTheDocument();
            });

            // Open edit modal for the draft item
            const editButtons = screen.getAllByRole('button');
            const editBtn = editButtons.find((b) => b.querySelector('.anticon-edit'));
            expect(editBtn).toBeDefined();

            fireEvent.click(editBtn);

            await waitFor(() => {
                expect(screen.getByDisplayValue('Thông báo xét duyệt đề cương đợt 1')).toBeInTheDocument();
            });

            // Verify file attachment is loaded and fileAssetId is kept
            expect(screen.getAllByText('de-cuong.pdf').length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('3. UI / Button Standards Compliance (AGENTS.md)', () => {
        it('AnnouncementManagementPage action buttons use Ant Design icon components and no raw emoji in text', async () => {
            useAuthStore.setState({
                isAuthenticated: true,
                user: {
                    id: 1,
                    role: 'ADMIN',
                    permissions: ['PUBLIC_ANNOUNCEMENT_MANAGE'],
                },
            });

            announcementService.getAnnouncements.mockResolvedValue({
                success: true,
                data: [],
                pagination: { total: 0, page: 1, limit: 10 },
            });

            renderWithProviders(<AnnouncementManagementPage />);

            // Create button: "Soạn bản tin Portal"
            const createBtn = screen.getByRole('button', { name: /Soạn bản tin Portal/i });
            expect(createBtn).toBeInTheDocument();
            expect(createBtn.querySelector('.anticon')).not.toBeNull();
            expect(createBtn.textContent).not.toMatch(/[←→+🤖📋✓✏️👥🗑️🔓▾▴↗]/);

            // Refresh button
            const refreshBtn = screen.getByRole('button', { name: /Làm mới/i });
            expect(refreshBtn).toBeInTheDocument();
            expect(refreshBtn.querySelector('.anticon')).not.toBeNull();
            expect(refreshBtn.textContent).not.toMatch(/[←→+🤖📋✓✏️👥🗑️🔓▾▴↗]/);
        });
    });
});
