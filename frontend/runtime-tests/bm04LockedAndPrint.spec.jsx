import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { ConfigProvider } from 'antd';
import BM04EvaluationModal from '../src/components/lecturer/BM04EvaluationModal.jsx';
import AcademicDossierDrawer from '../src/components/prints/AcademicDossierDrawer.jsx';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import evaluationService from '../src/services/evaluationService.js';
import registrationService from '../src/services/registrationService.js';
import taskService from '../src/services/taskService.js';
import meetingLogService from '../src/services/meetingLogService.js';

let client;

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
    client.setDefaultOptions({ queries: { retry: false, staleTime: 0 }, mutations: { retry: false } });
    useAuthStore.setState({
        user: { id: 10, fullName: 'TS. Giang', role: 'LECTURER', permissions: [] },
        isAuthenticated: true,
    });
});

afterEach(() => {
    cleanup();
    client.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

test('BM04EvaluationModal: when locked, form fields and action buttons are disabled', async () => {
    const registration = {
        id: 101,
        studentId: 201,
        semesterId: 1,
        status: 'DEFENSE_READY',
        student: { id: 201, fullName: 'Tran Minh Anh', code: '2224802010111' },
        topic: { id: 301, title: 'De tai tot nghiep test', mentorId: 10 },
        bm04Evaluation: {
            id: 88,
            isLocked: true,
            status: 'OFFICIAL',
            conclusion: 'AGREED_FOR_DEFENSE',
            thesisFormatScore: 'Tot',
            researchContentScore: 'Tot',
            applicabilityScore: 'Tot',
            attitudeScore: 'Tot',
            lecturerSignature: 'TS. Giang',
        },
    };

    vi.spyOn(evaluationService, 'getBM04Record').mockResolvedValue({
        success: true,
        data: registration.bm04Evaluation,
    });

    render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter>
                    <BM04EvaluationModal
                        open={true}
                        onClose={vi.fn()}
                        registration={registration}
                        currentLecturerName="TS. Giang"
                    />
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );

    // Verify alert message for locked form
    expect(await screen.findByText(/Phiếu nhận xét BM04 đã được ký và khóa vĩnh viễn/i)).toBeInTheDocument();

    // Verify buttons are disabled
    const saveDraftBtn = screen.getByRole('button', { name: /Lưu nháp/i });
    expect(saveDraftBtn).toBeDisabled();

    const signSubmitBtn = screen.getByRole('button', { name: /Ký và nộp/i });
    expect(signSubmitBtn).toBeDisabled();

    const aiBtn = screen.getByRole('button', { name: /AI Gợi ý từ BM03/i });
    expect(aiBtn).toBeDisabled();
});

test('AcademicDossierDrawer: blocks BM04 print when BM04 is only an unsigned draft, allows when locked/signed', async () => {
    const registration = {
        id: 102,
        studentId: 202,
        semesterId: 1,
        status: 'BM03_PASSED',
        student: { id: 202, fullName: 'Nguyen Van B', code: '2224802010222' },
        topic: { id: 302, title: 'De tai test print', mentorId: 10 },
    };

    vi.spyOn(taskService, 'getTasksByRegistration').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(meetingLogService, 'getMeetingLogs').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(evaluationService, 'getCheckpointEvaluations').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(evaluationService, 'getBM03Record').mockResolvedValue({ success: true, data: null });

    // Case 1: BM04 is draft and not locked
    const getBM04Spy = vi.spyOn(evaluationService, 'getBM04Record').mockResolvedValue({
        success: true,
        data: {
            id: 89,
            isLocked: false,
            status: 'DRAFT',
            conclusion: 'AGREED_FOR_DEFENSE',
            lecturerSignature: '',
        },
    });

    const { rerender } = render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter>
                    <AcademicDossierDrawer
                        open={true}
                        onClose={vi.fn()}
                        registration={registration}
                    />
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );

    // Click on BM04 tab in drawer
    const bm04Tab = await screen.findByRole('tab', { name: /BM04/i });
    expect(bm04Tab).toBeInTheDocument();
    fireEvent.click(bm04Tab);

    // BM04 should not be eligible to print as official document
    expect(await screen.findByText(/Phiếu nhận xét BM04 chưa được ký chính thức/i)).toBeInTheDocument();

    cleanup();
    client.clear();

    // Case 2: BM04 is officially locked & signed
    getBM04Spy.mockResolvedValue({
        success: true,
        data: {
            id: 89,
            isLocked: true,
            status: 'OFFICIAL',
            conclusion: 'AGREED_FOR_DEFENSE',
            signedAt: '2026-11-18T10:00:00Z',
            lecturerSignature: 'TS. Giang',
        },
    });

    render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter>
                    <AcademicDossierDrawer
                        open={true}
                        onClose={vi.fn()}
                        registration={registration}
                    />
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );

    // In case 2, warning should not be displayed
    await screen.findByRole('tab', { name: /BM04/i });
    expect(screen.queryByText(/Phiếu nhận xét BM04 chưa được ký chính thức/i)).not.toBeInTheDocument();
});
