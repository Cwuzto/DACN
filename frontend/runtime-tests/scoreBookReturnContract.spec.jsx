import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import { ConfigProvider, Modal, message } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import evaluationService from '../src/services/evaluationService.js';
import { semesterService } from '../src/services/semesterService.js';
import GradingDefensePage from '../src/pages/admin/GradingDefensePage.jsx';

let client;

const adminUser = {
    id: 1,
    fullName: 'Quản trị viên Đào tạo',
    email: 'admin@tdmu.edu.vn',
    role: 'ADMIN',
    permissions: [
        'VIEW_DEFENSE_LOCK_LEDGER',
        'DEFENSE_SCORE_VIEW',
        'DEFENSE_SCORE_SUBMIT',
        'RESULT_LOCK',
    ],
};

const buildGradingCenterRow = (overrides = {}) => ({
    id: 201,
    registrationId: 201,
    status: 'AWAITING_FINAL_APPROVAL',
    workflowStage: 'DEFENDED',
    gradingStatus: 'GRADED',
    student: { id: 50, code: '22000501', fullName: 'Nguyễn Minh Tâm' },
    topic: { id: 15, code: 'DT-2026-015', title: 'Ứng dụng AI trong quản lý luận văn' },
    mentor: { id: 9, fullName: 'TS. Hướng Dẫn' },
    council: {
        id: 8,
        name: 'Hội đồng CNTT 08',
        location: 'P.405',
        defenseDate: '2026-11-20',
        allowFourthScoringMember: false,
        members: [
            { lecturerId: 11, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
            { lecturerId: 12, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
            { lecturerId: 13, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
        ],
    },
    semester: { id: 12, name: 'HK1 2026-2027' },
    defenseResult: {
        id: 88,
        finalScore: 8.5,
        rawAverageScore: 8.5,
        roundedFinalScore: 8.5,
        attendanceStatus: 'PRESENT',
        absentMinutesText: null,
        scoreLocked: true,
        pdfUrl: null,
    },
    memberScores: [
        { id: 301, evaluatorId: 11, evaluator: { id: 11, fullName: 'TS. Chủ Tịch' }, role: 'Chủ tịch', finalScore: 8.5, scoreLocked: true },
        { id: 302, evaluatorId: 12, evaluator: { id: 12, fullName: 'ThS. Thư Ký' }, role: 'Thư ký', finalScore: 8.5, scoreLocked: true },
        { id: 303, evaluatorId: 13, evaluator: { id: 13, fullName: 'TS. Phản Biện' }, role: 'Phản biện', finalScore: 8.5, scoreLocked: true },
    ],
    finalScore: 8.5,
    rawAverageScore: 8.5,
    roundedFinalScore: 8.5,
    attendanceStatus: 'PRESENT',
    absentMinutesText: null,
    scoreLocked: true,
    isScoreBookLocked: true,
    activeScorerCount: 3,
    lockedScorerCount: 3,
    ...overrides,
});

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', vi.fn(() => ({
        matches: false,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
    })));
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => nativeGetComputedStyle(element));

    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
    useAuthStore.setState({ user: adminUser, isAuthenticated: true });
    vi.spyOn(semesterService, 'getAll').mockResolvedValue({
        success: true,
        data: [{ id: 12, name: 'HK1 2026-2027' }],
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

function mountPage() {
    return render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter initialEntries={['/admin/grading']}>
                    <Routes>
                        <Route path="/admin/grading" element={<GradingDefensePage />} />
                    </Routes>
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );
}

describe('Task 4: ScoreBook Return Contract & Grading Defense Center (P0.19, P1.9)', () => {
    test('1. Return scorebook modal sends valid numeric registration ID and non-empty valid member score IDs (never undefined)', async () => {
        const userEv = userEvent.setup();
        const row = buildGradingCenterRow();

        vi.spyOn(evaluationService, 'getAdminDefenseCenter').mockResolvedValue({
            success: true,
            data: [row],
            meta: { targetSemester: { id: 12, name: 'HK1 2026-2027' }, counts: {}, total: 1 },
        });

        const returnSpy = vi.spyOn(evaluationService, 'returnScoreBook').mockResolvedValue({
            success: true,
            message: 'Đã trả sổ điểm thành công',
            data: {},
        });

        mountPage();

        // Find and click the "Trả sổ về Hội đồng" button
        const returnBtn = await screen.findByRole('button', { name: /Trả sổ về Hội đồng/i });
        expect(returnBtn).toBeInTheDocument();
        await userEv.click(returnBtn);

        // Modal should open with student name
        expect(await screen.findByText(/Trả Sổ Điểm Về Hội Đồng: Nguyễn Minh Tâm/i)).toBeInTheDocument();

        // Check that checkboxes rendered for member scores
        expect(screen.getByText(/TS\. Chủ Tịch/i)).toBeInTheDocument();
        expect(screen.getByText(/ThS\. Thư Ký/i)).toBeInTheDocument();
        expect(screen.getByText(/TS\. Phản Biện/i)).toBeInTheDocument();

        // Enter return reason
        const reasonInput = screen.getByPlaceholderText(/Nhập lý do trả sổ điểm về hội đồng/i);
        await userEv.type(reasonInput, 'Giám khảo cần rà soát lại tiêu chí nghiên cứu');

        // Click confirm
        const confirmBtn = screen.getByRole('button', { name: /Xác nhận trả sổ điểm/i });
        await userEv.click(confirmBtn);

        // Verify evaluationService.returnScoreBook was called with valid numeric registrationId and valid IDs array
        await waitFor(() => {
            expect(returnSpy).toHaveBeenCalledTimes(1);
        });

        const [calledRegId, calledPayload] = returnSpy.mock.calls[0];
        expect(calledRegId).toBe(201); // Numeric ID, NOT undefined!
        expect(calledPayload).toEqual({
            reason: 'Giám khảo cần rà soát lại tiêu chí nghiên cứu',
            reopenMemberScoreIds: [301, 302, 303], // Numeric array, NOT [undefined]!
        });
        expect(calledPayload.reopenMemberScoreIds).not.toContain(undefined);
    });

    test('2. Absent student displays ABSENT tag without fake numerical scores', async () => {
        const absentRow = buildGradingCenterRow({
            id: 202,
            registrationId: 202,
            student: { id: 51, code: '22000502', fullName: 'Trần Văn Vắng' },
            attendanceStatus: 'ABSENT',
            rawAverageScore: null,
            roundedFinalScore: null,
            finalScore: null,
            defenseResult: {
                id: 89,
                finalScore: null,
                rawAverageScore: null,
                roundedFinalScore: null,
                attendanceStatus: 'ABSENT',
                absentMinutesText: 'Sinh viên vắng mặt có biên bản.',
                scoreLocked: true,
            },
            memberScores: [],
        });

        vi.spyOn(evaluationService, 'getAdminDefenseCenter').mockResolvedValue({
            success: true,
            data: [absentRow],
            meta: { targetSemester: { id: 12, name: 'HK1 2026-2027' }, counts: {}, total: 1 },
        });

        mountPage();

        expect(await screen.findByText('Trần Văn Vắng')).toBeInTheDocument();
        expect(screen.getByText('VẮNG MẶT')).toBeInTheDocument();
        expect(screen.getByText('ABSENT')).toBeInTheDocument();
    });
});
