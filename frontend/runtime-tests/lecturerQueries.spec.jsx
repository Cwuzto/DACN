import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { ConfigProvider, Modal, message } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import { queryKeys } from '../src/query/queryKeys.js';
import useAuthStore from '../src/stores/authStore.js';

import LecturerDashboardPage from '../src/pages/lecturer/LecturerDashboardPage.jsx';
import TopicApprovalPage from '../src/pages/lecturer/TopicApprovalPage.jsx';
import TopicManagementPage from '../src/pages/lecturer/TopicManagementPage.jsx';
import ProgressTrackingPage from '../src/pages/lecturer/ProgressTrackingPage.jsx';
import GradingPage from '../src/pages/lecturer/GradingPage.jsx';
import LecturerGradingSheetPage from '../src/pages/lecturer/LecturerGradingSheetPage.jsx';
import OutlineCouncilGradingCard from '../src/pages/lecturer/components/OutlineCouncilGradingCard.jsx';

import registrationService from '../src/services/registrationService.js';
import evaluationService from '../src/services/evaluationService.js';
import meetingLogService from '../src/services/meetingLogService.js';
import notificationService from '../src/services/notificationService.js';
import { topicService } from '../src/services/topicService.js';
import { semesterService } from '../src/services/semesterService.js';
import councilService from '../src/services/councilService.js';
import taskService from '../src/services/taskService.js';
import archiveService from '../src/services/archiveService.js';
import bm02aService from '../src/services/bm02aService.js';

let client;
const lecturerUser = {
    id: 10,
    fullName: 'TS. Tran Van B',
    email: 'b.tran@hcmut.edu.vn',
    role: 'LECTURER',
    permissions: [],
};

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
    const native = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(element => native(element));

    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: 60000 }, mutations: { retry: false } });
    useAuthStore.setState({ user: lecturerUser, isAuthenticated: true });

    // Default mock implementations
    vi.spyOn(registrationService, 'getAllRegistrations').mockResolvedValue({
        success: true,
        data: [
            {
                id: 101,
                status: 'IN_PROGRESS',
                progressPercent: 70,
                studentId: 201,
                student: { id: 201, fullName: 'Sinh Vien A', code: '2010001' },
                topic: { id: 301, title: 'He Thong Quan Ly Do An', code: 'DT01' },
                _count: { meetingLogs: 3 },
            },
        ],
    });

    vi.spyOn(registrationService, 'getPendingTitleAdjustments').mockResolvedValue({
        success: true,
        data: [],
    });

    vi.spyOn(taskService, 'getTasksByRegistration').mockResolvedValue({
        success: true,
        data: [
            { id: 1, title: 'Nhiem vu tuan 1', status: 'COMPLETED', week: 1 },
        ],
    });

    vi.spyOn(meetingLogService, 'getMeetingLogs').mockResolvedValue({
        success: true,
        data: [
            { id: 11, meetingDate: '2026-11-01', meetingContent: 'Thao luan kien truc', status: 'LOCKED' },
        ],
    });

    vi.spyOn(meetingLogService, 'getBM03Record').mockResolvedValue({
        success: true,
        data: {
            id: 501,
            registrationId: 101,
            meetings: [
                { id: 11, meetingDate: '2026-11-01', meetingContent: 'Thao luan kien truc', status: 'LOCKED' },
            ],
            stageEvaluations: [],
        },
    });

    vi.spyOn(evaluationService, 'getCheckpointEvaluations').mockResolvedValue({
        success: true,
        data: [],
    });

    vi.spyOn(archiveService, 'getArchiveByRegistration').mockResolvedValue({
        success: true,
        data: null,
    });

    vi.spyOn(evaluationService, 'getMyCouncilDefenses').mockResolvedValue({
        success: true,
        data: [
            {
                id: 801,
                name: 'Hoi dong Bao ve Khoa luan 01',
                councilType: 'DEFENSE',
                defenseDate: '2026-12-15',
                location: 'H2-502',
                members: [
                    { id: 1, lecturerId: 10, roleInCouncil: 'CHAIRMAN', lecturer: { fullName: 'TS. Tran Van B' } },
                ],
                registrations: [
                    {
                        id: 101,
                        student: { fullName: 'Sinh Vien A', code: '2010001' },
                        topic: { title: 'He Thong Quan Ly Do An' },
                        status: 'DEFENSE_READY',
                    },
                ],
            },
        ],
    });

    vi.spyOn(councilService, 'getCouncilById').mockResolvedValue({
        success: true,
        data: {
            id: 801,
            name: 'Hoi dong Bao ve Khoa luan 01',
            councilType: 'OUTLINE_REVIEW',
            members: [],
            registrations: [],
        },
    });

    vi.spyOn(evaluationService, 'getScoreSheet').mockResolvedValue({
        success: true,
        data: {
            registration: {
                id: 101,
                student: { fullName: 'Sinh Vien A', code: '2010001' },
                topic: { title: 'He Thong Quan Ly Do An' },
            },
            currentEvaluator: { id: 10, roleInCouncil: 'CHAIRMAN' },
            scoreLocked: false,
            defenseResult: { comments: '' },
            rubric: {
                version: 'v1',
                title: 'Barem danh gia',
                totalMaxScore: 10.0,
                categories: [
                    {
                        code: 'CAT1',
                        name: 'Noi dung khoa luan',
                        maxScore: 10.0,
                        criteria: [
                            { code: 'CRIT1', name: 'Chat luong bao cao', maxScore: 5.0 },
                        ],
                    },
                ],
            },
            scores: [],
        },
    });

    vi.spyOn(semesterService, 'getAll').mockResolvedValue({
        success: true,
        data: [
            { id: 1, name: 'Hoc ky 1 2026', code: 'HK1_2026', isActive: true, status: 'ACTIVE' },
        ],
    });

    vi.spyOn(topicService, 'getAll').mockResolvedValue({
        success: true,
        data: [
            {
                id: 301,
                title: 'He Thong Quan Ly Do An',
                code: 'DT01',
                status: 'APPROVED',
                proposedById: 10,
                mentorId: 10,
                _count: { registrations: 1 },
            },
        ],
    });

    vi.spyOn(bm02aService, 'getPendingQueue').mockResolvedValue({
        success: true,
        data: [],
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

test('lecturer query modules exist and export expected query hooks', async () => {
    const modules = import.meta.glob('../src/queries/*Queries.js');
    expect(modules['../src/queries/taskQueries.js']).toBeTypeOf('function');
    expect(modules['../src/queries/meetingQueries.js']).toBeTypeOf('function');
    expect(modules['../src/queries/checkpointQueries.js']).toBeTypeOf('function');

    const taskMod = await modules['../src/queries/taskQueries.js']();
    expect(taskMod.useTasksByRegistration).toBeTypeOf('function');
    expect(taskMod.useTaskMutation).toBeTypeOf('function');

    const meetingMod = await modules['../src/queries/meetingQueries.js']();
    expect(meetingMod.useMeetingLogs).toBeTypeOf('function');
    expect(meetingMod.useBM03Record).toBeTypeOf('function');
    expect(meetingMod.useMeetingMutation).toBeTypeOf('function');

    const checkpointMod = await modules['../src/queries/checkpointQueries.js']();
    expect(checkpointMod.useCheckpointEvaluations).toBeTypeOf('function');
    expect(checkpointMod.useCheckpointMutation).toBeTypeOf('function');
});

test('lecturer dashboard handles partial failure without suppressing successful students list', async () => {
    registrationService.getPendingTitleAdjustments.mockRejectedValue({
        status: 500,
        message: 'Lỗi đồng bộ đề xuất đổi tên',
    });

    mount(<LecturerDashboardPage />);

    // Supervised student from successful registration query must still display
    expect(await screen.findByText('Sinh Vien A')).toBeInTheDocument();
    // Error notification or alert should be shown for the failed section
    expect(await screen.findByRole('alert')).toHaveTextContent(/Lỗi đồng bộ đề xuất đổi tên/i);
});

test('progress tracking gates detail queries on selected student and invalidates task on mutation', async () => {
    const modules = import.meta.glob('../src/queries/*Queries.js');
    const { useTasksByRegistration, useTaskMutation } = await modules['../src/queries/taskQueries.js']();

    let taskMutation;
    function TaskObserver({ regId }) {
        useTasksByRegistration(queryKeys.scope(lecturerUser), regId);
        taskMutation = useTaskMutation(queryKeys.scope(lecturerUser), regId);
        return null;
    }

    // When regId is null, tasks query must not execute
    const view = mount(<TaskObserver regId={null} />);
    expect(taskService.getTasksByRegistration).not.toHaveBeenCalled();

    // When regId is set, tasks query executes
    view.rerender(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter>
                    <TaskObserver regId={101} />
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );

    await waitFor(() => expect(taskService.getTasksByRegistration).toHaveBeenCalledWith(101));

    // Mutating task invalidates task query
    vi.spyOn(taskService, 'createTask').mockResolvedValue({ success: true, data: { id: 2, title: 'Nhiem vu 2' } });
    await act(async () => {
        await taskMutation.mutateAsync({ action: 'createTask', args: [{ title: 'Nhiem vu 2', registrationId: 101 }] });
    });

    await waitFor(() => expect(taskService.getTasksByRegistration).toHaveBeenCalledTimes(2));
});

test('grading sheet preserves editable score draft during background query refresh', async () => {
    const userEv = userEvent.setup();

    mount(
        <Routes>
            <Route path="/lecturer/grading/:registrationId" element={<LecturerGradingSheetPage />} />
        </Routes>,
        '/lecturer/grading/101'
    );

    // Wait for the score inputs to render
    const input = await screen.findByPlaceholderText('0.00');
    expect(input).toBeInTheDocument();

    // Enter score draft
    await userEv.clear(input);
    await userEv.type(input, '4.5');
    expect(input).toHaveValue(4.5);

    // Trigger background cache refresh
    await act(async () => {
        await client.invalidateQueries();
    });

    // Score draft must be preserved and not wiped by the background query
    expect(input).toHaveValue(4.5);
});

test('council assignment gating ensures council detail query is only enabled when council id is provided', async () => {
    mount(<OutlineCouncilGradingCard council={{ id: null }} />);
    expect(councilService.getCouncilById).not.toHaveBeenCalled();
});

test('no dossier 403 regression when viewing defense dossier', async () => {
    vi.spyOn(archiveService, 'getDefenseDossier').mockRejectedValue({
        status: 403,
        message: 'Không có quyền truy cập hồ sơ lưu chiểu này',
    });

    mount(<GradingPage />);
    expect(await screen.findByText('Hoi dong Bao ve Khoa luan 01')).toBeInTheDocument();

    const dossierBtn = screen.getByRole('button', { name: /Tài liệu/i });
    const userEv = userEvent.setup();
    await userEv.click(dossierBtn);

    expect(await screen.findByText(/Không có quyền truy cập/i)).toBeInTheDocument();
});
