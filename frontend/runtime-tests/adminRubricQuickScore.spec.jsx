import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
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

const sampleCategories = [
    {
        code: 'CAT_CONTENT',
        name: 'Nội dung nghiên cứu',
        maxScore: 3.4,
        criteria: [
            {
                code: 'C1',
                label: 'Đặt vấn đề',
                cloCode: 'CLO1',
                description: 'Xác định mục tiêu và tổng quan',
                maxScore: 1.0,
                levelGoodDesc: 'Xuất sắc',
                levelFairDesc: 'Khá rõ',
                levelAverageDesc: 'Trung bình',
                levelPoorDesc: 'Yếu',
            },
            {
                code: 'C2',
                label: 'Phương pháp',
                cloCode: 'CLO2',
                description: 'Phương pháp khoa học',
                maxScore: 1.4,
                levelGoodDesc: 'Tối ưu',
                levelFairDesc: 'Phù hợp',
                levelAverageDesc: 'Cơ bản',
                levelPoorDesc: 'Chưa hợp lý',
            },
            {
                code: 'C3',
                label: 'Kết quả thực nghiệm',
                cloCode: 'CLO3',
                description: 'Độ tin cậy thực nghiệm',
                maxScore: 1.0,
                levelGoodDesc: 'Toàn diện',
                levelFairDesc: 'Đầy đủ',
                levelAverageDesc: 'Sơ sài',
                levelPoorDesc: 'Không có',
            },
        ],
    },
];

const buildLedgerRow = (overrides = {}) => ({
    registrationId: 201,
    status: 'AWAITING_SCORES',
    workflowStage: 'AWAITING_GRADING',
    gradingStatus: 'PENDING',
    student: { id: 50, code: '22000501', fullName: 'Nguyễn Minh Tâm' },
    topic: { id: 15, code: 'DT-2026-015', title: 'Ứng dụng AI trong quản lý luận văn' },
    mentor: { id: 9, fullName: 'TS. Lê Văn Hướng' },
    council: {
        id: 8,
        name: 'Hội đồng CNTT 08',
        location: 'P.405',
        defenseDate: '2026-11-20',
        allowFourthScoringMember: true,
        members: [
            { lecturerId: 11, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
            { lecturerId: 12, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
            { lecturerId: 13, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
            { lecturerId: 14, roleInCouncil: 'MEMBER', isActive: true, isScoringMember: true },
            { lecturerId: 15, roleInCouncil: 'MEMBER', isActive: true, isScoringMember: false },
            { lecturerId: 16, roleInCouncil: 'REVIEWER', isActive: false, isScoringMember: true },
        ],
    },
    semester: { id: 12, name: 'HK1 2026-2027' },
    finalScore: null,
    scoreLocked: false,
    memberScores: [
        { evaluatorId: 11, evaluator: { id: 11, fullName: 'TS. Chủ Tịch' }, role: 'Chủ tịch', finalScore: 8.5, scoreLocked: true },
        { evaluatorId: 12, evaluator: { id: 12, fullName: 'ThS. Thư Ký' }, role: 'Thư ký', finalScore: 8.0, scoreLocked: true },
        { evaluatorId: 13, evaluator: { id: 13, fullName: 'TS. Phản Biện' }, role: 'Phản biện', finalScore: 8.2, scoreLocked: true },
        { evaluatorId: 14, evaluator: { id: 14, fullName: 'TS. Ủy Viên 4' }, role: 'Ủy viên', finalScore: null, scoreLocked: false },
        { evaluatorId: 15, evaluator: { id: 15, fullName: 'TS. Quan Sát' }, role: 'Ủy viên', finalScore: 9.9, scoreLocked: true, isScoringMember: false },
        { evaluatorId: 16, evaluator: { id: 16, fullName: 'TS. Đã Thay' }, role: 'Phản biện', finalScore: 7.0, scoreLocked: true, isActive: false },
    ],
    activeScorerCount: 4,
    lockedScorerCount: 3,
    ...overrides,
});

const buildScoreSheetResponse = (overrides = {}) => ({
    success: true,
    data: {
        registration: {
            id: 201,
            status: 'AWAITING_SCORES',
            student: { id: 50, code: '22000501', fullName: 'Nguyễn Minh Tâm' },
            topic: { id: 15, code: 'DT-2026-015', title: 'Ứng dụng AI trong quản lý luận văn' },
            councilId: 8,
        },
        currentEvaluator: { id: 14, fullName: 'TS. Ủy Viên 4', roleInCouncil: 'MEMBER' },
        scoreLocked: false,
        defenseResult: { comments: '' },
        activeScorerCount: 4,
        lockedScorerCount: 3,
        memberScores: [
            { evaluatorId: 11, evaluatorName: 'TS. Chủ Tịch', role: 'Chủ tịch', finalScore: 8.5, scoreLocked: true },
            { evaluatorId: 12, evaluatorName: 'ThS. Thư Ký', role: 'Thư ký', finalScore: 8.0, scoreLocked: true },
            { evaluatorId: 13, evaluatorName: 'TS. Phản Biện', role: 'Phản biện', finalScore: 8.2, scoreLocked: true },
            { evaluatorId: 14, evaluatorName: 'TS. Ủy Viên 4', role: 'Ủy viên', finalScore: null, scoreLocked: false },
            { evaluatorId: 15, evaluatorName: 'TS. Quan Sát', role: 'Ủy viên', finalScore: 9.9, scoreLocked: true, isScoringMember: false },
            { evaluatorId: 16, evaluatorName: 'TS. Đã Thay', role: 'Phản biện', finalScore: 7.0, scoreLocked: true, isEffective: false },
        ],
        rubric: {
            version: 'v3_pinned',
            title: 'Rubric bảo vệ 2026',
            totalMaxScore: 3.4,
            scoreLevelPolicy: {
                good: { minPercent: 85, maxPercent: 100, suggestedPercent: 95 },
                fair: { minPercent: 70, maxPercent: 85, suggestedPercent: 75 },
                average: { minPercent: 50, maxPercent: 70, suggestedPercent: 60 },
                poor: { minPercent: 0, maxPercent: 50, suggestedPercent: 30 },
            },
            categories: sampleCategories,
        },
        scores: [],
        ...overrides,
    },
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

describe('GradingDefensePage quick rubric scoring and dynamic scorer counters', () => {
    test('new sheet starts empty (no 85% prefill), uses pinned policy, preserves 0 and manual edits on group fill, and blocks lock until complete', async () => {
        const userEv = userEvent.setup();
        vi.spyOn(evaluationService, 'getAdminDefenseCenter').mockResolvedValue({
            success: true,
            data: [buildLedgerRow()],
            meta: { targetSemester: { id: 12, name: 'HK1 2026-2027' }, counts: {}, total: 1 },
        });
        vi.spyOn(evaluationService, 'getScoreSheet').mockResolvedValue(buildScoreSheetResponse());
        const saveSpy = vi.spyOn(evaluationService, 'saveScoreSheet').mockResolvedValue({ success: true, data: {} });
        const lockSpy = vi.spyOn(evaluationService, 'lockMemberScoreSheet').mockResolvedValue({ success: true, data: {} });

        mountPage();

        // Table row counter displays 3/4 (excluding inactive/non-scoring members) and council lock button stays disabled
        const rowCounter = await screen.findByTestId('row-scorer-counter-201');
        expect(rowCounter).toHaveTextContent('3/4 phiếu đã khóa');
        expect(screen.queryByText(/TS\. Quan Sát/)).not.toBeInTheDocument();
        expect(screen.queryByText(/TS\. Đã Thay/)).not.toBeInTheDocument();

        const councilLockBtn = screen.getByRole('button', { name: 'Khóa sổ điểm hội đồng' });
        expect(councilLockBtn).toBeDisabled();

        // Open drawer
        await userEv.click(screen.getByRole('button', { name: 'Mở Sổ Điểm' }));

        const drawerCounter = await screen.findByTestId('drawer-scorer-counter');
        expect(drawerCounter).toHaveTextContent('3/4 phiếu đã khóa');

        const c1Input = await screen.findByRole('spinbutton', { name: 'Điểm Đặt vấn đề' });
        const c2Input = screen.getByRole('spinbutton', { name: 'Điểm Phương pháp' });
        const c3Input = screen.getByRole('spinbutton', { name: 'Điểm Kết quả thực nghiệm' });

        // Opening a new sheet leaves all criteria empty (no 85% prefill)
        expect(c1Input).toHaveValue(null);
        expect(c2Input).toHaveValue(null);
        expect(c3Input).toHaveValue(null);

        const drawer = screen.getByTestId('drawer-scorer-counter').closest('aside');
        const memberLockBtn = within(drawer).getByRole('button', { name: /Khóa phiếu chấm/i });
        const draftSaveBtn = within(drawer).getByRole('button', { name: /Lưu Điểm Nháp/i });

        // Incomplete sheet cannot lock
        expect(memberLockBtn).toBeDisabled();

        // Empty draft save sends scores: [] (never converts null to 0)
        await userEv.click(draftSaveBtn);
        await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
        expect(saveSpy).toHaveBeenLastCalledWith(201, expect.objectContaining({
            scores: [],
        }));

        // Score C1 manually to 0.72 and C2 to 0
        await userEv.type(c1Input, '0.72');
        await userEv.type(c2Input, '0');
        expect(c1Input).toHaveValue(0.72);
        expect(c2Input).toHaveValue(0);

        // Still incomplete because C3 is empty => cannot lock
        expect(memberLockBtn).toBeDisabled();

        // Partial draft save sends only C1 and C2 (preserving 0, omitting empty C3)
        await userEv.click(draftSaveBtn);
        await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(2));
        expect(saveSpy).toHaveBeenLastCalledWith(201, expect.objectContaining({
            scores: [
                { criterionCode: 'C1', score: 0.72, comment: undefined },
                { criterionCode: 'C2', score: 0, comment: undefined },
            ],
        }));

        // Group fill Tốt uses pinned policy (suggestedPercent: 95 => 0.95 for C3) and keeps C1=0.72 and C2=0
        const groupBar = within(drawer).getByRole('group', { name: /Chọn mức cho các mục chưa chấm/i });
        await userEv.click(within(groupBar).getByRole('button', { name: /Tốt/i }));

        expect(c1Input).toHaveValue(0.72);
        expect(c2Input).toHaveValue(0);
        expect(c3Input).toHaveValue(0.95);

        // Now complete => member lock button enabled
        expect(memberLockBtn).toBeEnabled();
        await userEv.click(memberLockBtn);
        const confirmBtn = await screen.findByRole('button', { name: /Xác nhận khóa/i });
        await userEv.click(confirmBtn);

        await waitFor(() => expect(lockSpy).toHaveBeenCalledTimes(1));
        expect(lockSpy).toHaveBeenCalledWith(expect.objectContaining({
            registrationId: 201,
            targetRubricVersion: 'v3_pinned',
            scores: [
                { criterionCode: 'C1', score: 0.72, comment: undefined },
                { criterionCode: 'C2', score: 0, comment: undefined },
                { criterionCode: 'C3', score: 0.95, comment: undefined },
            ],
        }));
    });

    test('renders 4/4 effective scorers excluding inactive/non-scoring members and enforces read-only when member sheet is locked', async () => {
        const userEv = userEvent.setup();
        const fullLockedRow = buildLedgerRow({
            activeScorerCount: undefined,
            lockedScorerCount: undefined,
            memberScores: [
                { evaluatorId: 11, evaluator: { id: 11, fullName: 'TS. Chủ Tịch' }, role: 'Chủ tịch', finalScore: 8.5, scoreLocked: true },
                { evaluatorId: 12, evaluator: { id: 12, fullName: 'ThS. Thư Ký' }, role: 'Thư ký', finalScore: 8.0, scoreLocked: true },
                { evaluatorId: 13, evaluator: { id: 13, fullName: 'TS. Phản Biện' }, role: 'Phản biện', finalScore: 8.2, scoreLocked: true },
                { evaluatorId: 14, evaluator: { id: 14, fullName: 'TS. Ủy Viên 4' }, role: 'Ủy viên', finalScore: 8.4, scoreLocked: true },
                { evaluatorId: 15, evaluator: { id: 15, fullName: 'TS. Quan Sát' }, role: 'Ủy viên', finalScore: 9.9, scoreLocked: false },
                { evaluatorId: 16, evaluator: { id: 16, fullName: 'TS. Đã Thay' }, role: 'Phản biện', finalScore: 7.0, scoreLocked: false },
            ],
        });

        vi.spyOn(evaluationService, 'getAdminDefenseCenter').mockResolvedValue({
            success: true,
            data: [fullLockedRow],
            meta: { targetSemester: { id: 12, name: 'HK1 2026-2027' }, counts: {}, total: 1 },
        });
        vi.spyOn(evaluationService, 'getScoreSheet').mockResolvedValue(
            buildScoreSheetResponse({
                scoreLocked: true,
                activeScorerCount: 4,
                lockedScorerCount: 4,
                scores: [
                    { criterionCode: 'C1', score: 0.95 },
                    { criterionCode: 'C2', score: 1.05 },
                    { criterionCode: 'C3', score: 0 },
                ],
            })
        );

        mountPage();

        // Derived from council.members: 4 effective scorers, excluding inactive (16) and non-scoring (15)
        const rowCounter = await screen.findByTestId('row-scorer-counter-201');
        expect(rowCounter).toHaveTextContent('4/4 phiếu đã khóa');
        expect(screen.getByRole('button', { name: 'Khóa sổ điểm hội đồng' })).toBeEnabled();

        await userEv.click(screen.getByRole('button', { name: 'Mở Sổ Điểm' }));

        const drawerCounter = await screen.findByTestId('drawer-scorer-counter');
        expect(drawerCounter).toHaveTextContent('4/4 phiếu đã khóa');

        const c1Input = await screen.findByRole('spinbutton', { name: 'Điểm Đặt vấn đề' });
        expect(c1Input).toBeDisabled();
        expect(screen.getByRole('spinbutton', { name: 'Điểm Kết quả thực nghiệm' })).toHaveValue(0);
        expect(screen.getByRole('radio', { name: 'Đặt vấn đề - Tốt' })).toBeDisabled();

        const drawer = drawerCounter.closest('aside');
        expect(within(drawer).getByRole('button', { name: /Lưu Điểm Nháp/i })).toBeDisabled();
        expect(within(drawer).getByRole('button', { name: /Khóa phiếu chấm/i })).toBeDisabled();
    });
});
