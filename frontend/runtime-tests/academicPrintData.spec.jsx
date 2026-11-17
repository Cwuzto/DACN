import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ConfigProvider } from 'antd';
import BM02PrintSheet from '../src/components/prints/BM02PrintSheet.jsx';
import BM02APrintSheet from '../src/components/prints/BM02APrintSheet.jsx';
import BM03PrintSheet from '../src/components/prints/BM03PrintSheet.jsx';
import BM04PrintSheet from '../src/components/prints/BM04PrintSheet.jsx';
import BM05PrintSheet from '../src/components/prints/BM05PrintSheet.jsx';
import AcademicDossierDrawer from '../src/components/prints/AcademicDossierDrawer.jsx';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import taskService from '../src/services/taskService.js';
import meetingLogService from '../src/services/meetingLogService.js';
import evaluationService from '../src/services/evaluationService.js';
import registrationService from '../src/services/registrationService.js';
import outlineService from '../src/services/outlineService.js';

let client;

beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
    vi.stubGlobal('ResizeObserver', class {
        observe() {}
        unobserve() {}
        disconnect() {}
    });
    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: 30000 }, mutations: { retry: false } });
    useAuthStore.setState({ user: { id: 701, role: 'LECTURER', permissions: [] }, isAuthenticated: true });
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

test('BM02PrintSheet renders submission fixture without fake student defaults or fake signature when verification is null', () => {
    const registration = {
        id: 202,
        status: 'BM02_SUBMITTED',
        student: {
            fullName: 'Lê Hoàng Nam',
            code: '2224802010888',
            studentProfile: {
                className: 'D22KTPM03',
                major: 'Trí tuệ nhân tạo',
                academicYear: '2023 - 2027',
                placeOfBirth: 'Bình Phước',
            },
        },
        topic: {
            title: 'Đề tài gốc từ danh mục',
            mentor: { fullName: 'TS. Phạm Thị Hương' },
        },
    };
    const submission = {
        id: 901,
        versionNo: 1,
        title: 'Ứng dụng thị giác máy tính nhận diện biển số',
        objectives: 'Xây dựng pipeline nhận diện thời gian thực.',
    };

    const { container } = render(
        <BM02PrintSheet registration={registration} submission={submission} verification={null} />
    );

    const text = container.textContent;
    expect(text).toContain('Ứng dụng thị giác máy tính nhận diện biển số');
    expect(text).toContain('Xây dựng pipeline nhận diện thời gian thực.');
    expect(text).toContain('D22KTPM03');
    expect(text).toContain('2023 - 2027');
    expect(text).toContain('Bình Phước');
    expect(text).not.toContain('D22CNTT01');
    expect(text).not.toContain('2022 - 2026');
    expect(text).not.toContain('TP. Hồ Chí Minh');
    expect(text).not.toContain('Đã xác thực');
    expect(text).not.toContain('Đã ký');
    expect(text).toContain('Chờ xác nhận');
});

test('BM03PrintSheet does not fabricate sample meetings or default passed checkpoints when unfinalized', () => {
    const registration = {
        id: 203,
        status: 'IN_PROGRESS_BM03',
        student: { fullName: 'Trần Gia Bảo', code: '2224802010777' },
        topic: { title: 'Hệ thống IoT nông nghiệp', mentor: { fullName: 'ThS. Đỗ Văn Minh' } },
    };

    const { container } = render(
        <BM03PrintSheet registration={registration} meetingLogs={[]} bm03Record={null} checkpoints={{}} />
    );

    const text = container.textContent;
    expect(text).not.toContain('D22CNTT01');
    expect(text).not.toContain('0909123456');
    expect(text).not.toContain('Gặp mặt giáo viên hướng dẫn, xác định phạm vi và tên đề tài.');
    expect(text).not.toContain('Sinh viên có tinh thần học hỏi cao');
    expect(text).not.toContain('☑');
});

test('BM05PrintSheet renders summaryRecord fixture and never fakes signed status when signature events are absent', () => {
    const registration = {
        id: 205,
        status: 'DEFENDED',
        student: { fullName: 'Võ Thị Lan', code: '2224802010555' },
        topic: { title: 'Phân tích dữ liệu lớn', mentor: { fullName: 'PGS.TS Nguyễn Văn Hùng' } },
    };
    const summaryRecord = {
        councilName: 'Hội đồng KTPM-02',
        defenseDate: '2026-11-20',
        location: 'Phòng E2-301',
        finalScore: 9.2,
        comments: 'Bảo vệ xuất sắc, trả lời phản biện rõ ràng.',
        isPublished: true,
        secretaryName: 'ThS. Lê Minh Tuấn',
        chairmanName: 'TS. Nguyễn Quốc Anh',
        memberScores: [
            { evaluator: { fullName: 'TS. Nguyễn Quốc Anh' }, roleInCouncilSnapshot: 'CHAIRMAN', finalScore: 9.2, scoreLocked: true },
        ],
    };

    const { container } = render(
        <BM05PrintSheet registration={registration} summaryRecord={summaryRecord} />
    );

    const text = container.textContent;
    expect(text).toContain('Hội đồng KTPM-02');
    expect(text).toContain('Phòng E2-301');
    expect(text).toContain('9.2');
    expect(text).toContain('Bảo vệ xuất sắc, trả lời phản biện rõ ràng.');
    expect(text).toContain('ThS. Lê Minh Tuấn');
    expect(text).toContain('TS. Nguyễn Quốc Anh');
    expect(text).not.toContain('Đã ký điện tử');
    expect(text).not.toContain('Đã duyệt biên bản');
    expect(text).toContain('Chờ xác nhận');
});

test('BM02APrintSheet and BM04PrintSheet omit fake class and fake default review/reason texts', () => {
    const registration = {
        id: 206,
        student: { fullName: 'Phạm Quốc Duy', code: '2224802010666' },
        topic: { title: 'Hệ thống gợi ý học tập', mentor: { fullName: 'TS. Vũ Hải' } },
    };

    const bm02a = render(<BM02APrintSheet request={{}} registration={registration} />);
    expect(bm02a.container.textContent).not.toContain('D22CNTT01');
    expect(bm02a.container.textContent).not.toContain('2022 - 2026');
    expect(bm02a.container.textContent).not.toContain('Cập nhật lại tên đề tài cho bám sát hơn');

    const bm04 = render(<BM04PrintSheet evaluation={{}} registration={registration} />);
    expect(bm04.container.textContent).not.toContain('D22CNTT01');
    expect(bm04.container.textContent).not.toContain('Bố cục báo cáo phù hợp');
    expect(bm04.container.textContent).not.toContain('☑');
});

test('AcademicDossierDrawer separates BM01 PDF action and blocks printing unpublished BM05 / unfinalized BM03', async () => {
    vi.spyOn(taskService, 'getTasksByRegistration').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(meetingLogService, 'getMeetingLogs').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(evaluationService, 'getCheckpointEvaluations').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(evaluationService, 'getBM03Record').mockResolvedValue({ success: true, data: null });
    vi.spyOn(evaluationService, 'getBM04Record').mockResolvedValue({ success: true, data: null });
    vi.spyOn(registrationService, 'getTitleAdjustmentsByRegistration' in registrationService ? 'getTitleAdjustmentsByRegistration' : 'getPendingTitleAdjustments').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(outlineService, 'getMyOutline').mockResolvedValue({ success: true, data: null });

    const registration = {
        id: 301,
        status: 'IN_PROGRESS_BM03',
        student: { fullName: 'Ngô Thanh Tùng', code: '2224802010333' },
        topic: { id: 12, title: 'Hệ thống kiểm thử tự động', mentor: { fullName: 'TS. Lê An' } },
    };

    renderWithProviders(<AcademicDossierDrawer open onClose={() => {}} registration={registration} />);

    // Must clearly state BM01 is a separate PDF action
    expect(await screen.findByText(/BM01.*PDF riêng/i)).toBeInTheDocument();

    // Switch to BM05 tab (unpublished) -> Print current button must be disabled
    await userEvent.click(screen.getByRole('tab', { name: /BM05/i }));
    const printCurrentBtn = screen.getByRole('button', { name: /In biểu mẫu này/i });
    expect(printCurrentBtn).toBeDisabled();

    // Switch to BM03 tab (unfinalized) -> Print current button must be disabled
    await userEvent.click(screen.getByRole('tab', { name: /BM03/i }));
    expect(screen.getByRole('button', { name: /In biểu mẫu này/i })).toBeDisabled();
});
