import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { ConfigProvider, Modal, message } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import { queryKeys } from '../src/query/queryKeys.js';
import useAuthStore from '../src/stores/authStore.js';

import TopicManagementPage from '../src/pages/admin/TopicManagementPage.jsx';
import RubricManagementPage from '../src/pages/admin/RubricManagementPage.jsx';
import ProjectOversightPage from '../src/pages/admin/ProjectOversightPage.jsx';
import AnnouncementManagementPage from '../src/pages/admin/AnnouncementManagementPage.jsx';
import PortalContentManagementPage from '../src/pages/admin/PortalContentManagementPage.jsx';
import NotificationCenterPage from '../src/pages/admin/NotificationCenterPage.jsx';

import { topicService } from '../src/services/topicService.js';
import { semesterService } from '../src/services/semesterService.js';
import userService from '../src/services/userService.js';
import rubricService from '../src/services/rubricService.js';
import portalContentService from '../src/services/portalContentService.js';
import { announcementService } from '../src/services/announcementService.js';
import notificationService from '../src/services/notificationService.js';
import archiveService from '../src/services/archiveService.js';
import manualReviewService from '../src/services/manualReviewService.js';
import evaluationService from '../src/services/evaluationService.js';
import registrationService from '../src/services/registrationService.js';

let client;
const user = { id: 7, role: 'ADMIN', permissions: ['FINAL_DOCUMENT_REVIEW'] };

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
    const native = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(element => native(element));

    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: 60000 }, mutations: { retry: false } });
    useAuthStore.setState({ user, isAuthenticated: true });

    // Default mock resolutions
    vi.spyOn(semesterService, 'getAll').mockResolvedValue({ success: true, data: [{ id: 101, name: 'Học kỳ 1 2026', code: 'HK1_2026', status: 'ONGOING' }] });
    vi.spyOn(userService, 'getUsers').mockResolvedValue({ success: true, data: [{ id: 201, fullName: 'GV Nguyen Van A', code: 'GV01' }] });
    vi.spyOn(topicService, 'getAll').mockResolvedValue({ success: true, data: [{ id: 1, title: 'Hệ thống Quản lý Đồ án', status: 'APPROVED', semesterId: 101 }] });
    vi.spyOn(registrationService, 'getAllRegistrations').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(rubricService, 'getRubricVersions').mockResolvedValue({ success: true, data: { versions: [{ id: 1, title: 'Barem V1', isActive: true }], systemEditable: true } });
    vi.spyOn(rubricService, 'getRubricById').mockResolvedValue({ success: true, data: { id: 1, title: 'Barem V1', categories: [] } });
    vi.spyOn(portalContentService, 'getPublicContent').mockResolvedValue({ success: true, data: { templates: [] } });
    vi.spyOn(portalContentService, 'listResources').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(announcementService, 'getAnnouncements').mockResolvedValue({ success: true, data: [{ id: 1, title: 'Thông báo nộp đồ án', isPublished: true, isPinned: false }], pagination: { page: 1, limit: 10, total: 1 } });
    vi.spyOn(notificationService, 'getHistory').mockResolvedValue({ success: true, data: [{ id: 1, title: 'Nhắc nhở nộp đề cương', audience: 'ALL_STUDENTS', sentAt: new Date().toISOString(), readCount: 10, totalAudience: 10 }] });
    vi.spyOn(notificationService, 'getTemplates').mockResolvedValue({ success: true, data: [{ key: 'TPL_1', name: 'Nhắc nộp', title: 'Nhắc nộp bài', content: 'Nội dung', isActive: true }] });
    vi.spyOn(archiveService, 'getHealthRadarStats').mockResolvedValue({ success: true, data: { total: 10, completed: 8 } });
    vi.spyOn(archiveService, 'getAllArchives').mockResolvedValue({ success: true, data: { items: [] } });
    vi.spyOn(manualReviewService, 'listCases').mockResolvedValue({ success: true, data: { cases: [], pagination: { total: 0 } } });
    vi.spyOn(evaluationService, 'getCheckpointAppeals').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(evaluationService, 'listStopReviews').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(evaluationService, 'listDefenseReviews').mockResolvedValue({ success: true, data: [] });
});

afterEach(() => {
    cleanup();
    client.clear();
    Modal.destroyAll();
    message.destroy();
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

test('topic queries module exists and handles invalidation on topic mutation', async () => {
    const modules = import.meta.glob('../src/queries/*Queries.js');
    expect(modules['../src/queries/topicQueries.js']).toBeTypeOf('function');
    const { useTopics, useTopicMutation } = await modules['../src/queries/topicQueries.js']();
    vi.spyOn(topicService, 'create').mockResolvedValue({ success: true, data: { id: 2, title: 'Đề tài mới' } });

    let mutation;
    function Observer() {
        useTopics(queryKeys.scope(user), { status: 'APPROVED' });
        mutation = useTopicMutation(queryKeys.scope(user));
        return null;
    }

    mount(<Observer />);
    await waitFor(() => expect(topicService.getAll).toHaveBeenCalledTimes(1));

    await act(async () => {
        await mutation.mutateAsync({ action: 'create', args: [{ title: 'Đề tài mới' }] });
    });

    await waitFor(() => expect(topicService.getAll).toHaveBeenCalledTimes(2));
});

test('rubric queries lazy loads detail only when rubricId is provided', async () => {
    const modules = import.meta.glob('../src/queries/*Queries.js');
    expect(modules['../src/queries/rubricQueries.js']).toBeTypeOf('function');
    const { useRubricVersions, useRubricDetail } = await modules['../src/queries/rubricQueries.js']();

    function Observer({ rubricId }) {
        useRubricVersions(queryKeys.scope(user));
        useRubricDetail(queryKeys.scope(user), rubricId);
        return null;
    }

    const view = mount(<Observer rubricId={null} />);
    await waitFor(() => expect(rubricService.getRubricVersions).toHaveBeenCalledTimes(1));
    expect(rubricService.getRubricById).not.toHaveBeenCalled();

    view.rerender(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter>
                    <Observer rubricId={1} />
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );
    await waitFor(() => expect(rubricService.getRubricById).toHaveBeenCalledWith(1));
});

test('oversight queries handle independent failures and render alert rather than false empty', async () => {
    archiveService.getHealthRadarStats.mockRejectedValue({ status: 500, message: 'Health radar failed' });
    mount(<ProjectOversightPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Health radar failed');
    // Successful topics and registrations are still loaded and displayed
    expect(await screen.findByText(/Hệ thống Quản lý Đồ án/, {}, { timeout: 5000 })).toBeInTheDocument();
});

test('portal content query renders distinct error state when listResources fails', async () => {
    portalContentService.listResources.mockRejectedValue({ status: 500, message: 'Portal resources unavailable' });
    mount(<PortalContentManagementPage />);

    expect(await screen.findByText('Portal resources unavailable')).toBeInTheDocument();
    // Ensure it does not render false empty state title
    expect(screen.queryByText('Chưa có cấu hình nhận diện')).not.toBeInTheDocument();
});

test('notification center query handles distinct empty vs error states and isolates history from templates', async () => {
    notificationService.getHistory.mockRejectedValue({ status: 500, message: 'History fetch error' });
    mount(<NotificationCenterPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('History fetch error');
    // Templates still load independently
    await waitFor(() => expect(notificationService.getTemplates).toHaveBeenCalled());
});

test('announcements query supports background refresh without losing form drafts', async () => {
    const userEv = userEvent.setup();
    mount(<AnnouncementManagementPage />);

    await screen.findByText('Thông báo nộp đồ án');
    const openBtn = screen.getByRole('button', { name: /Soạn bản tin Portal/i });
    await userEv.click(openBtn);

    const input = await screen.findByPlaceholderText(/Thông báo gia hạn/i);
    await userEv.type(input, 'Bản nháp đang nhập dở');

    // Trigger background query refetch
    await act(async () => {
        client.invalidateQueries();
    });

    // Form input should keep the draft text intact
    expect(input).toHaveValue('Bản nháp đang nhập dở');
});
