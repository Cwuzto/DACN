import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { ConfigProvider, Modal, message } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import ProgressTrackingPage from '../src/pages/lecturer/ProgressTrackingPage.jsx';
import SubmissionPage from '../src/pages/student/SubmissionPage.jsx';
import BM03PrintSheet from '../src/components/prints/BM03PrintSheet.jsx';

import registrationService from '../src/services/registrationService.js';
import { semesterService } from '../src/services/semesterService.js';
import { topicService } from '../src/services/topicService.js';
import taskService from '../src/services/taskService.js';
import meetingLogService from '../src/services/meetingLogService.js';
import evaluationService from '../src/services/evaluationService.js';
import archiveService from '../src/services/archiveService.js';
import outlineService from '../src/services/outlineService.js';

let client;

const lecturerUser = {
    id: 10,
    fullName: 'TS. Nguyen Van Giang',
    email: 'giang@tdmu.edu.vn',
    role: 'LECTURER',
    permissions: [],
};

function makeRegistration(overrides = {}) {
    return {
        id: 101,
        semesterId: 1,
        status: 'IN_PROGRESS_BM03',
        progressPercent: 60,
        studentId: 201,
        student: { id: 201, fullName: 'Tran Minh Anh', code: '2224802010111' },
        topic: {
            id: 301,
            title: 'Xay dung he thong theo doi do an',
            code: 'DT01',
            semesterId: 1,
            mentor: { id: 10, fullName: 'TS. Nguyen Van Giang' },
            projectCatalog: { code: 'DATN' },
        },
        semester: {
            id: 1,
            name: 'HK1 2026-2027',
            bm03MidtermEvaluationOpenAt: '2026-12-01T00:00:00.000Z',
            bm03FinalizationOpenAt: '2027-01-15T00:00:00.000Z',
        },
        ...overrides,
    };
}

function makeBM03Record(overrides = {}) {
    return {
        id: 501,
        registrationId: 101,
        effectiveTitleSnapshot: 'Xay dung he thong theo doi do an',
        meetings: [
            {
                id: 11,
                versionNumber: 1,
                meetingDate: '2026-11-05T00:00:00.000Z',
                meetingMode: 'IN_PERSON',
                locationOrLink: 'Lab H2-502',
                discussionContent: 'Thao luan kien truc ban dau',
                studentCompletedWork: 'Hoan thanh dac ta',
                nextTasks: 'Thiet ke CSDL',
                progressRating: 'ON_TRACK',
                isLocked: true,
                advisorSignedAt: '2026-11-05T10:00:00.000Z',
                supersededBy: { id: 12, versionNumber: 2 },
            },
            {
                id: 12,
                versionNumber: 2,
                supersedesEntryId: 11,
                meetingDate: '2026-11-05T00:00:00.000Z',
                meetingMode: 'IN_PERSON',
                locationOrLink: 'Lab H2-502',
                discussionContent: 'Thao luan kien truc va chot ERD',
                studentCompletedWork: 'Hoan thanh dac ta va ERD',
                nextTasks: 'Thiet ke API',
                progressRating: 'ON_TRACK',
                isLocked: false,
                supersededBy: null,
            },
        ],
        stageEvaluations: [],
        stopReviews: [],
        ...overrides,
    };
}

function mountPage(url = '/lecturer/progress?tab=meeting-logs') {
    return render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter initialEntries={[url]}>
                    <ProgressTrackingPage />
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );
}

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
    client.setDefaultOptions({ queries: { retry: false, staleTime: 0 }, mutations: { retry: false } });
    useAuthStore.setState({ user: lecturerUser, isAuthenticated: true });

    vi.spyOn(semesterService, 'getAll').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(topicService, 'getCatalogs').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(taskService, 'getTasksByRegistration').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(meetingLogService, 'getMeetingLogs').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(evaluationService, 'getCheckpointEvaluations').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(archiveService, 'getArchiveByRegistration').mockResolvedValue({ success: true, data: { archive: null } });
});

afterEach(() => {
    cleanup();
    client.clear();
    Modal.destroyAll();
    message.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

test('before midterm open date: shows meeting logs & locked notice, hides print button', async () => {
    const reg = makeRegistration({
        semester: {
            id: 1,
            name: 'HK1',
            bm03MidtermEvaluationOpenAt: '2099-05-01T00:00:00.000Z',
            bm03FinalizationOpenAt: '2099-06-01T00:00:00.000Z',
        },
    });
    vi.spyOn(registrationService, 'getAllRegistrations').mockResolvedValue({ success: true, data: [reg] });
    vi.spyOn(meetingLogService, 'getBM03Record').mockResolvedValue({ success: true, data: makeBM03Record() });

    mountPage();

    expect(await screen.findByText(/Thao luan kien truc va chot ERD/i)).toBeInTheDocument();
    expect(screen.getByText(/Lịch sử phiên bản nhật ký đã chỉnh sửa/i)).toBeInTheDocument();
    expect(screen.getByText(/Chưa đến ngày mở đánh giá giữa kỳ BM03/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lưu đánh giá giữa kỳ/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /In Sổ tiến độ BM03/i })).not.toBeInTheDocument();
});

test('missing stage windows: shows unconfigured notices for midterm and final', async () => {
    const reg = makeRegistration({
        semester: { id: 1, name: 'HK1', bm03MidtermEvaluationOpenAt: null, bm03FinalizationOpenAt: null },
    });
    vi.spyOn(registrationService, 'getAllRegistrations').mockResolvedValue({ success: true, data: [reg] });
    vi.spyOn(meetingLogService, 'getBM03Record').mockResolvedValue({ success: true, data: makeBM03Record() });

    mountPage();

    expect(await screen.findByText(/Đợt đồ án chưa cấu hình ngày mở đánh giá giữa kỳ/i)).toBeInTheDocument();
    expect(screen.getByText(/Cần hoàn tất đánh giá giữa kỳ/i)).toBeInTheDocument();
});

test('at midterm open date: allows submitting Cho làm tiếp or Đề nghị dừng and edits meeting with supersedesEntryId', async () => {
    const user = userEvent.setup();
    const reg = makeRegistration({
        semester: {
            id: 1,
            name: 'HK1',
            bm03MidtermEvaluationOpenAt: '2020-01-01T00:00:00.000Z',
            bm03FinalizationOpenAt: '2099-06-01T00:00:00.000Z',
        },
    });
    vi.spyOn(registrationService, 'getAllRegistrations').mockResolvedValue({ success: true, data: [reg] });
    vi.spyOn(meetingLogService, 'getBM03Record').mockResolvedValue({ success: true, data: makeBM03Record() });
    const submitSpy = vi.spyOn(meetingLogService, 'submitStageEvaluation').mockResolvedValue({
        success: true,
        data: { stageEvaluation: { id: 901, stage: 'MIDTERM', decision: 'CONTINUE', comments: 'Tien do tot' } },
    });
    const createMeetingSpy = vi.spyOn(meetingLogService, 'createMeetingEntry').mockResolvedValue({
        success: true,
        data: { id: 13, versionNumber: 3, supersedesEntryId: 12 },
    });

    mountPage();

    const midtermRadio = await screen.findByRole('radio', { name: /Cho làm tiếp/i });
    expect(midtermRadio).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Đề nghị dừng/i })).toBeInTheDocument();

    const commentBox = screen.getByPlaceholderText(/Nhận xét chi tiết khối lượng thực hiện/i);
    await user.type(commentBox, 'Sinh vien thuc hien dung tien do');
    await user.click(screen.getByRole('button', { name: /Lưu đánh giá giữa kỳ/i }));

    await waitFor(() => {
        expect(submitSpy).toHaveBeenCalledWith(101, {
            stage: 'MIDTERM',
            decision: 'CONTINUE',
            comments: 'Sinh vien thuc hien dung tien do',
        });
    });

    await user.click(screen.getByRole('button', { name: /Sửa nội dung/i }));
    await user.click(screen.getByRole('button', { name: /Lưu nhật ký buổi gặp/i }));

    await waitFor(() => {
        expect(createMeetingSpy).toHaveBeenCalledWith(
            101,
            expect.objectContaining({
                supersedesEntryId: 12,
                discussionContent: 'Thao luan kien truc va chot ERD',
            })
        );
    });
});

test('when STOP_REVIEW_PENDING: locks meeting logs as read-only and blocks actions', async () => {
    const reg = makeRegistration({
        status: 'STOP_REVIEW_PENDING',
        semester: {
            id: 1,
            name: 'HK1',
            bm03MidtermEvaluationOpenAt: '2020-01-01T00:00:00.000Z',
            bm03FinalizationOpenAt: '2020-02-01T00:00:00.000Z',
        },
    });
    const record = makeBM03Record({
        stopReviews: [{ id: 88, status: 'STOP_REVIEW_PENDING' }],
        stageEvaluations: [
            { id: 901, stage: 'MIDTERM', decision: 'PROPOSE_STOP', comments: 'Khong lien lac duoc', evaluatedAt: '2026-11-10T00:00:00.000Z' },
        ],
    });
    vi.spyOn(registrationService, 'getAllRegistrations').mockResolvedValue({ success: true, data: [reg] });
    vi.spyOn(meetingLogService, 'getBM03Record').mockResolvedValue({ success: true, data: record });

    mountPage();

    expect(await screen.findByText(/Nhật ký BM03 đang ở trạng thái chỉ đọc/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ghi nhận buổi hướng dẫn mới/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Ký khóa buổi hướng dẫn/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sửa nội dung/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Đang có đề nghị dừng chờ Viện thẩm định/i)).toBeInTheDocument();
});

test('at finalization open date: allows FINAL evaluation, whole BM03 sign, and shows print only after student ack', async () => {
    const user = userEvent.setup();
    const reg = makeRegistration({
        semester: {
            id: 1,
            name: 'HK1',
            bm03MidtermEvaluationOpenAt: '2020-01-01T00:00:00.000Z',
            bm03FinalizationOpenAt: '2020-02-01T00:00:00.000Z',
        },
    });

    // Case 1: Midterm CONTINUE done, FINAL not yet done -> no print button
    const recordBeforeFinal = makeBM03Record({
        stageEvaluations: [
            { id: 901, stage: 'MIDTERM', decision: 'CONTINUE', comments: 'Dat giua ky', evaluatedAt: '2026-11-10T00:00:00.000Z' },
        ],
    });
    vi.spyOn(registrationService, 'getAllRegistrations').mockResolvedValue({ success: true, data: [reg] });
    const getRecordSpy = vi.spyOn(meetingLogService, 'getBM03Record').mockResolvedValue({ success: true, data: recordBeforeFinal });
    const submitSpy = vi.spyOn(meetingLogService, 'submitStageEvaluation').mockResolvedValue({
        success: true,
        data: { stageEvaluation: { id: 902, stage: 'FINAL', decision: 'CONTINUE_TO_BM04', comments: 'Hoan thanh' } },
    });

    mountPage();

    const finalComment = await screen.findByPlaceholderText(/Tổng kết toàn bộ quá trình thực hiện/i);
    expect(screen.queryByRole('button', { name: /In Sổ tiến độ BM03/i })).not.toBeInTheDocument();

    await user.type(finalComment, 'Hoan thanh tot do an');
    await user.click(screen.getByRole('button', { name: /Lưu đánh giá cuối kỳ/i }));

    await waitFor(() => {
        expect(submitSpy).toHaveBeenCalledWith(101, {
            stage: 'FINAL',
            decision: 'CONTINUE_TO_BM04',
            comments: 'Hoan thanh tot do an',
        });
    });

    cleanup();
    client.clear();

    // Case 2: Advisor signed, student still PENDING -> print button still hidden
    getRecordSpy.mockResolvedValue({
        success: true,
        data: makeBM03Record({
            stageEvaluations: [
                { id: 901, stage: 'MIDTERM', decision: 'CONTINUE', comments: 'Dat', evaluatedAt: '2026-11-10T00:00:00.000Z' },
                { id: 902, stage: 'FINAL', decision: 'CONTINUE_TO_BM04', comments: 'Tot', evaluatedAt: '2026-11-15T00:00:00.000Z' },
            ],
            finalConclusion: 'CONTINUE_TO_BM04',
            advisorSignedAt: '2026-11-15T10:00:00.000Z',
            studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
        }),
    });

    mountPage();
    expect(await screen.findByText(/Chờ sinh viên xác nhận toàn phiếu/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /In Sổ tiến độ BM03/i })).not.toBeInTheDocument();

    cleanup();
    client.clear();

    // Case 3: Student acknowledged -> print button appears
    getRecordSpy.mockResolvedValue({
        success: true,
        data: makeBM03Record({
            stageEvaluations: [
                { id: 901, stage: 'MIDTERM', decision: 'CONTINUE', comments: 'Dat', evaluatedAt: '2026-11-10T00:00:00.000Z' },
                { id: 902, stage: 'FINAL', decision: 'CONTINUE_TO_BM04', comments: 'Tot', evaluatedAt: '2026-11-15T00:00:00.000Z' },
            ],
            finalConclusion: 'CONTINUE_TO_BM04',
            advisorSignedAt: '2026-11-15T10:00:00.000Z',
            studentAckStatus: 'ACKNOWLEDGED',
            studentAckAt: '2026-11-16T09:00:00.000Z',
        }),
    });

    mountPage();
    expect(await screen.findAllByRole('button', { name: /In Sổ tiến độ BM03/i })).not.toHaveLength(0);
});

test('BM03PrintSheet renders only active meetings, real stage evaluations, and real advisor/student signatures', () => {
    const reg = makeRegistration({ status: 'BM03_PASSED' });
    const record = makeBM03Record({
        stageEvaluations: [],
        advisorSignedAt: '2026-11-15T10:00:00.000Z',
        studentAckStatus: 'ACKNOWLEDGED_WITH_COMMENT',
        studentAckAt: '2026-11-16T08:30:00.000Z',
        studentComment: 'Em dong y voi nhan xet cua thay',
    });

    // Even with legacy checkpoints passed and status BM03_PASSED, empty stageEvaluations must NOT check ☑
    const { container, rerender } = render(
        <BM03PrintSheet
            registration={reg}
            bm03Record={record}
            checkpoints={{ cp1Passed: true, cp2Passed: true }}
        />
    );

    expect(container.textContent).toContain('Thao luan kien truc va chot ERD');
    expect(container.textContent).not.toContain('Thao luan kien truc ban dau');
    expect(container.textContent).not.toContain('☑');
    expect(container.textContent).toContain('Đã xác nhận kèm ý kiến');
    expect(container.textContent).toContain('Em dong y voi nhan xet cua thay');
    expect(container.textContent).toContain('Đã xác thực nội bộ');

    // With real stageEvaluations, ☑ appears
    rerender(
        <BM03PrintSheet
            registration={reg}
            bm03Record={{
                ...record,
                stageEvaluations: [
                    { id: 1, stage: 'MIDTERM', decision: 'CONTINUE', comments: 'Dat giua ky' },
                    { id: 2, stage: 'FINAL', decision: 'CONTINUE_TO_BM04', comments: 'Hoan thanh xuat sac' },
                ],
            }}
            checkpoints={{}}
        />
    );
    expect(container.textContent).toContain('☑');
    expect(container.textContent).toContain('Hoan thanh xuat sac');
});

test('SubmissionPage BM03 student view: read-only active timeline, stage evaluations, STOP_REVIEW_PENDING alert, whole-sheet ack, and print gating', async () => {
    const studentUser = {
        id: 201,
        fullName: 'Tran Minh Anh',
        email: '2224802010111@student.tdmu.edu.vn',
        role: 'STUDENT',
        permissions: ['VIEW_MY_SUBMISSIONS'],
    };
    useAuthStore.setState({ user: studentUser, isAuthenticated: true });

    const regPendingStop = makeRegistration({ status: 'STOP_REVIEW_PENDING' });
    vi.spyOn(registrationService, 'getMyRegistration').mockResolvedValue({ success: true, data: regPendingStop });
    vi.spyOn(archiveService, 'getDefenseDossier').mockResolvedValue({ success: true, data: null });
    vi.spyOn(outlineService, 'getMyOutline').mockResolvedValue({ success: true, data: null });
    vi.spyOn(evaluationService, 'getBM04Record').mockResolvedValue({ success: true, data: null });

    const getBm03Spy = vi.spyOn(meetingLogService, 'getBM03Record').mockResolvedValue({
        success: true,
        data: makeBM03Record({
            stopReviews: [{ id: 88, status: 'STOP_REVIEW_PENDING' }],
            stageEvaluations: [
                { id: 901, stage: 'MIDTERM', decision: 'PROPOSE_STOP', comments: 'Cham tien do nhieu tuan' },
            ],
        }),
    });

    const mountStudentPage = () => render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter initialEntries={['/student/submissions']}>
                    <SubmissionPage />
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );

    mountStudentPage();

    // Active meeting shown, superseded v1 hidden
    expect(await screen.findByText(/Thao luan kien truc va chot ERD/i)).toBeInTheDocument();
    expect(screen.queryByText(/Thao luan kien truc ban dau/i)).not.toBeInTheDocument();

    // Read-only: NO per-meeting sign/confirm button
    expect(screen.queryByRole('button', { name: /Ký khóa buổi hướng dẫn/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ký buổi/i })).not.toBeInTheDocument();

    // Stage evaluation & STOP_REVIEW_PENDING alert visible
    expect(screen.getByText(/STOP_REVIEW_PENDING/i)).toBeInTheDocument();
    expect(screen.getByText(/Cham tien do nhieu tuan/i)).toBeInTheDocument();

    // Print button hidden before whole BM03 is finalized
    expect(screen.queryByRole('button', { name: /In Sổ tiến độ BM03/i })).not.toBeInTheDocument();

    cleanup();
    client.clear();

    // Case 2: Advisor signed, student ack pending -> banner & button appear, print still hidden
    vi.spyOn(registrationService, 'getMyRegistration').mockResolvedValue({
        success: true,
        data: makeRegistration({ status: 'IN_PROGRESS_BM03' }),
    });
    getBm03Spy.mockResolvedValue({
        success: true,
        data: makeBM03Record({
            stageEvaluations: [
                { id: 901, stage: 'MIDTERM', decision: 'CONTINUE', comments: 'Dat giua ky' },
                { id: 902, stage: 'FINAL', decision: 'CONTINUE_TO_BM04', comments: 'Hoan thanh du dieu kien' },
            ],
            advisorSignedAt: '2026-11-15T10:00:00.000Z',
            studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
        }),
    });

    mountStudentPage();

    expect(await screen.findByText(/Hoan thanh du dieu kien/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Phản hồi phiếu BM03/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /In Sổ tiến độ BM03/i })).not.toBeInTheDocument();

    cleanup();
    client.clear();

    // Case 3: Student acknowledged whole BM03 -> print button appears
    getBm03Spy.mockResolvedValue({
        success: true,
        data: makeBM03Record({
            stageEvaluations: [
                { id: 901, stage: 'MIDTERM', decision: 'CONTINUE', comments: 'Dat giua ky' },
                { id: 902, stage: 'FINAL', decision: 'CONTINUE_TO_BM04', comments: 'Hoan thanh du dieu kien' },
            ],
            advisorSignedAt: '2026-11-15T10:00:00.000Z',
            studentAckStatus: 'ACKNOWLEDGED',
            studentAckAt: '2026-11-16T09:00:00.000Z',
        }),
    });

    mountStudentPage();
    expect(await screen.findByRole('button', { name: /In Sổ tiến độ BM03/i })).toBeInTheDocument();
});
