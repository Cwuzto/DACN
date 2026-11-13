import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { ConfigProvider, Modal, message } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import { queryKeys } from '../src/query/queryKeys.js';
import useAuthStore from '../src/stores/authStore.js';

import StudentDashboardPage from '../src/pages/student/StudentDashboardPage.jsx';
import TopicListPage from '../src/pages/student/TopicListPage.jsx';
import SubmissionPage from '../src/pages/student/SubmissionPage.jsx';
import GradeViewPage from '../src/pages/student/GradeViewPage.jsx';

import dashboardService from '../src/services/dashboardService.js';
import registrationService from '../src/services/registrationService.js';
import outlineService from '../src/services/outlineService.js';
import evaluationService from '../src/services/evaluationService.js';
import archiveService from '../src/services/archiveService.js';
import { topicService } from '../src/services/topicService.js';
import { semesterService } from '../src/services/semesterService.js';
import taskService from '../src/services/taskService.js';
import meetingLogService from '../src/services/meetingLogService.js';

let client;
const studentUser = {
    id: 101,
    fullName: 'Nguyen Van Sinh Vien',
    email: 'sinhvien@hcmut.edu.vn',
    role: 'STUDENT',
    permissions: [],
};

const mockRegistration = {
    id: 501,
    status: 'IN_PROGRESS_BM03',
    progressPercent: 50,
    studentId: 101,
    student: { id: 101, fullName: 'Nguyen Van Sinh Vien', code: '2112001' },
    topic: {
        id: 301,
        title: 'Nghien cuu he thong giam sat IoT',
        code: 'DT01',
        mentorName: 'TS. Tran Van Huong Dan',
        mentor: { user: { fullName: 'TS. Tran Van Huong Dan' } },
    },
};

const mockDashboardStats = {
    hasRegistration: true,
    registrationDetails: mockRegistration,
    taskStatus: { total: 4, completed: 2, overdue: 0, progressPercent: 50 },
    upcomingDeadlines: [
        { id: 1, title: 'Nop BM03 tuan 4', deadline: '2026-11-20T23:59:59Z' },
    ],
    mentorFullName: 'TS. Tran Van Huong Dan',
};

const mockOutline = {
    id: 401,
    registrationId: 501,
    topicTitle: 'Nghien cuu he thong giam sat IoT',
    status: 'BM01_PASSED',
    outlineCouncil: {
        id: 701,
        name: 'Hoi dong xet duyet de cuong so 1',
        defenseDate: '2026-11-25T09:00:00Z',
        defenseLocation: 'H6-202',
        defenseMode: 'OFFLINE',
    },
};

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
    const native = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(element => native(element));

    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: 60000 }, mutations: { retry: false } });
    useAuthStore.setState({ user: studentUser, isAuthenticated: true });

    // Service mocks
    vi.spyOn(dashboardService, 'getStudentStats').mockResolvedValue({
        success: true,
        data: mockDashboardStats,
    });

    vi.spyOn(outlineService, 'getMyOutline').mockResolvedValue({
        success: true,
        data: mockOutline,
    });

    vi.spyOn(registrationService, 'getMyRegistration').mockResolvedValue({
        success: true,
        data: mockRegistration,
    });

    vi.spyOn(registrationService, 'getAllowedActions').mockResolvedValue({
        success: true,
        data: { allowedActions: ['CANCEL_REGISTRATION', 'ADJUST_TITLE'] },
    });

    vi.spyOn(registrationService, 'getMyProjectEnrollments').mockResolvedValue({
        success: true,
        data: [{ id: 1, studentId: 101, projectCatalogId: 10, status: 'ACTIVE', projectCatalog: { id: 10, name: 'KLTN KHDL', isActive: true } }],
        meta: { accountRestricted: false },
    });

    vi.spyOn(semesterService, 'getAll').mockResolvedValue({
        success: true,
        data: [{ id: 1, name: 'Hoc ky 1 2026', code: 'HK1_2026', registrationOpen: true, status: 'REGISTRATION' }],
    });

    vi.spyOn(topicService, 'getAll').mockResolvedValue({
        success: true,
        data: [
            {
                id: 301,
                title: 'Nghien cuu he thong giam sat IoT',
                code: 'DT01',
                status: 'APPROVED',
                mentorId: 201,
                mentor: { fullName: 'TS. Tran Van Huong Dan' },
                projectCatalog: { name: 'KLTN KHDL' },
                _count: { registrations: 1 },
            },
            {
                id: 302,
                title: 'He thong Blockchain cho chuoi cung ung',
                code: 'DT02',
                status: 'APPROVED',
                mentorId: 202,
                mentor: { fullName: 'PGS. Le Van Mentor' },
                projectCatalog: { name: 'KLTN KHDL' },
                _count: { registrations: 0 },
            },
        ],
    });

    vi.spyOn(topicService, 'getMentors').mockResolvedValue({
        success: true,
        data: [{ id: 201, fullName: 'TS. Tran Van Huong Dan' }],
    });

    vi.spyOn(taskService, 'getTasksByRegistration').mockResolvedValue({
        success: true,
        data: [
            { id: 1, title: 'BM01_INITIAL_SUBMISSION', status: 'COMPLETED' },
        ],
    });

    vi.spyOn(meetingLogService, 'getMeetingLogs').mockResolvedValue({
        success: true,
        data: [
            { id: 10, meetingDate: '2026-11-10', meetingContent: 'Hop dinh ky tuan 1', status: 'LOCKED' },
        ],
    });

    vi.spyOn(evaluationService, 'getCheckpointEvaluations').mockResolvedValue({
        success: true,
        data: [],
    });

    vi.spyOn(evaluationService, 'getBM03Record').mockResolvedValue({
        success: true,
        data: { id: 901, registrationId: 501, status: 'IN_PROGRESS', meetings: [] },
    });

    vi.spyOn(evaluationService, 'getBM04Record').mockResolvedValue({
        success: true,
        data: null,
    });

    vi.spyOn(archiveService, 'getArchiveByRegistration').mockResolvedValue({
        success: true,
        data: { archive: { id: 801, registrationId: 501, status: 'SUBMITTED' } },
    });

    vi.spyOn(archiveService, 'getDefenseDossier').mockResolvedValue({
        success: true,
        data: {
            registrationId: 501,
            documents: [],
            missingTypes: ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'],
            currentFiles: {},
        },
    });

    vi.spyOn(archiveService, 'getClearanceCertificate').mockResolvedValue({
        success: true,
        data: {
            registrationId: 501,
            pdfUrl: 'https://example.com/cert.pdf',
            issuedAt: '2026-11-12T10:00:00Z',
        },
    });

    vi.spyOn(evaluationService, 'getMyGrades').mockResolvedValue({
        success: true,
        data: [
            {
                id: 501,
                status: 'DEFENDED',
                finalScore: 8.5,
                defenseResult: { totalScore: 8.5, outcome: 'PASSED' },
                topic: { title: 'Nghien cuu he thong giam sat IoT' },
            },
        ],
    });

    vi.spyOn(evaluationService, 'getMyPublishedResult').mockResolvedValue({
        success: true,
        data: {
            id: 501,
            finalScore: 8.5,
            gradeLetter: 'A',
            isPublished: true,
        },
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

test('student query modules exist and export expected query hooks', async () => {
    const modules = import.meta.glob('../src/queries/*Queries.js');
    expect(modules['../src/queries/studentDashboardQueries.js']).toBeTypeOf('function');
    expect(modules['../src/queries/outlineQueries.js']).toBeTypeOf('function');

    const dashMod = await modules['../src/queries/studentDashboardQueries.js']();
    expect(dashMod.useStudentStats).toBeTypeOf('function');
    expect(dashMod.useAllowedActions).toBeTypeOf('function');

    const outlineMod = await modules['../src/queries/outlineQueries.js']();
    expect(outlineMod.useMyOutline).toBeTypeOf('function');

    const gradingMod = await modules['../src/queries/gradingQueries.js']();
    expect(gradingMod.useMyGrades).toBeTypeOf('function');
    expect(gradingMod.useMyPublishedResult).toBeTypeOf('function');

    const archiveMod = await modules['../src/queries/archiveQueries.js']();
    expect(archiveMod.useClearanceCertificate).toBeTypeOf('function');
});

test('student dashboard renders stats and handles outline panel error without blanking', async () => {
    outlineService.getMyOutline.mockRejectedValue({
        status: 500,
        message: 'Loi ket noi de cuong nghien cuu',
    });

    mount(<StudentDashboardPage />);

    // Registration info from stats query must still render
    expect(await screen.findByText(/Nghien cuu he thong giam sat IoT/i)).toBeInTheDocument();
    // Error notification or alert should be shown for the outline section
    expect(await screen.findByRole('alert')).toHaveTextContent(/Loi ket noi de cuong nghien cuu/i);
});

test('topic availability invalidation after registration', async () => {
    const modules = import.meta.glob('../src/queries/*Queries.js');
    const { useTopics } = await modules['../src/queries/topicQueries.js']();
    const { useStudentRegistrationMutation } = await modules['../src/queries/studentDashboardQueries.js']();

    let regMutation;
    function TopicObserver() {
        useTopics(queryKeys.scope(studentUser), { semesterId: 1 });
        regMutation = useStudentRegistrationMutation(queryKeys.scope(studentUser));
        return null;
    }

    mount(<TopicObserver />);
    await waitFor(() => expect(topicService.getAll).toHaveBeenCalled());

    vi.spyOn(registrationService, 'registerTopic').mockResolvedValue({
        success: true,
        data: { id: 502, status: 'PENDING' },
    });

    await act(async () => {
        await regMutation.mutateAsync({ topicId: 302, semesterId: 1 });
    });

    // Topic list cache must be invalidated and refetched
    await waitFor(() => expect(topicService.getAll).toHaveBeenCalledTimes(2));
});

test('submission page gates registration-dependent queries on registration id', async () => {
    mount(<SubmissionPage />);

    expect(await screen.findByText(/Quy Trình Giao Nộp Biểu Mẫu/i)).toBeInTheDocument();
    await waitFor(() => {
        expect(taskService.getTasksByRegistration).toHaveBeenCalledWith(501);
        expect(meetingLogService.getMeetingLogs).toHaveBeenCalledWith(501);
    });
});

test('grade view page renders published results and reuses archive cache without duplicate fetch', async () => {
    // Populate archive cache beforehand
    client.setQueryData(
        queryKeys.archives.detail(queryKeys.scope(studentUser), 501),
        { success: true, data: { archive: { id: 801, registrationId: 501, status: 'SUBMITTED' } } }
    );

    mount(<GradeViewPage />);

    expect(await screen.findByText(/KẾT QUẢ ĐỒ ÁN TỐT NGHIỆP/i)).toBeInTheDocument();
    // Since archive was already cached, getArchiveByRegistration should not be called again
    expect(archiveService.getArchiveByRegistration).not.toHaveBeenCalled();
});

test('topic list page preserves search filter during background query refresh', async () => {
    const userEv = userEvent.setup();
    mount(<TopicListPage />);

    const searchInput = await screen.findByPlaceholderText(/Tìm kiếm tên đề tài/i);
    expect(searchInput).toBeInTheDocument();

    await userEv.type(searchInput, 'Blockchain');
    expect(searchInput).toHaveValue('Blockchain');

    // Trigger background cache refresh
    await act(async () => {
        await client.invalidateQueries();
    });

    // Filter value must still be preserved
    expect(searchInput).toHaveValue('Blockchain');
});
