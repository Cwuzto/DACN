import { useState } from 'react';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import { ConfigProvider, Modal, message } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import evaluationService from '../src/services/evaluationService.js';
import RubricQuickScore from '../src/components/grading/RubricQuickScore.jsx';
import LecturerGradingSheetPage from '../src/pages/lecturer/LecturerGradingSheetPage.jsx';
import {
    DEFAULT_RUBRIC_LEVEL_POLICY,
    fillEmptyCriteria,
    getLevelForScore,
    getSuggestedScore,
} from '../src/utils/rubricLevelPolicy.js';

let client;

const lecturerUser = {
    id: 10,
    fullName: 'TS. Nguyễn Văn Giảng',
    email: 'giangnv@tdmu.edu.vn',
    role: 'LECTURER',
    permissions: ['VIEW_DEFENSE_GRADING', 'DEFENSE_SCORE_SUBMIT'],
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
                levelGoodDesc: 'Đặt vấn đề xuất sắc',
                levelFairDesc: 'Đặt vấn đề khá rõ',
                levelAverageDesc: 'Đặt vấn đề trung bình',
                levelPoorDesc: 'Đặt vấn đề yếu',
            },
            {
                code: 'C2',
                label: 'Phương pháp',
                cloCode: 'CLO2',
                description: 'Phương pháp khoa học',
                maxScore: 1.4,
                levelGoodDesc: 'Phương pháp tối ưu',
                levelFairDesc: 'Phương pháp phù hợp',
                levelAverageDesc: 'Phương pháp cơ bản',
                levelPoorDesc: 'Phương pháp chưa hợp lý',
            },
            {
                code: 'C3',
                label: 'Kết quả thực nghiệm',
                cloCode: 'CLO3',
                description: 'Độ tin cậy thực nghiệm',
                maxScore: 1.0,
                levelGoodDesc: 'Thực nghiệm toàn diện',
                levelFairDesc: 'Thực nghiệm đầy đủ',
                levelAverageDesc: 'Thực nghiệm sơ sài',
                levelPoorDesc: 'Không có thực nghiệm',
            },
        ],
    },
];

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', vi.fn(() => ({
        matches: false,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
    })));
    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
    useAuthStore.setState({ user: lecturerUser, isAuthenticated: true });
});

afterEach(() => {
    cleanup();
    client.clear();
    Modal.destroyAll();
    message.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function mountWithRouter(ui, initialUrl = '/lecturer/grading/101') {
    return render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter initialEntries={[initialUrl]}>
                    {ui}
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );
}

describe('rubricLevelPolicy utility', () => {
    test('exports default policy, avoids floating point drift at boundaries, and distinguishes 0 from empty', () => {
        expect(DEFAULT_RUBRIC_LEVEL_POLICY).toEqual({
            good: { minPercent: 85, maxPercent: 100, suggestedPercent: 90 },
            fair: { minPercent: 70, maxPercent: 85, suggestedPercent: 75 },
            average: { minPercent: 50, maxPercent: 70, suggestedPercent: 60 },
            poor: { minPercent: 0, maxPercent: 50, suggestedPercent: 30 },
        });

        expect(getLevelForScore(null, 1)).toBeNull();
        expect(getLevelForScore(undefined, 1)).toBeNull();
        expect(getLevelForScore('', 1)).toBeNull();
        expect(getLevelForScore('   ', 1)).toBeNull();
        expect(getLevelForScore(0, 1)).toBe('poor');
        expect(getLevelForScore(0.49, 1)).toBe('poor');
        expect(getLevelForScore(0.5, 1)).toBe('average');
        expect(getLevelForScore(0.69, 1)).toBe('average');
        expect(getLevelForScore(0.7, 1)).toBe('fair');
        expect(getLevelForScore(0.84, 1)).toBe('fair');
        expect(getLevelForScore(0.85, 1)).toBe('good');
        expect(getLevelForScore(1.0, 1)).toBe('good');

        // 1.19 / 1.4 === 0.8499999999999999 in IEEE 754 float
        expect(getLevelForScore(1.19, 1.4)).toBe('good');
        expect(getLevelForScore(0.17, 0.2)).toBe('good');
        expect(getLevelForScore(0.35, 0.5)).toBe('fair');
        expect(getLevelForScore(0.25, 0.5)).toBe('average');
    });

    test('calculates suggested scores rounded to 0.01 and preserves 0 + existing scores on group fill', () => {
        expect(getSuggestedScore(1, 'good')).toBe(0.9);
        expect(getSuggestedScore(1, 'fair')).toBe(0.75);
        expect(getSuggestedScore(1, 'average')).toBe(0.6);
        expect(getSuggestedScore(1, 'poor')).toBe(0.3);
        expect(getSuggestedScore(0.25, 'good')).toBe(0.23);

        const criteria = sampleCategories[0].criteria;
        const { nextScoresMap, filledCount, keptCount } = fillEmptyCriteria(
            criteria,
            { C1: 0, C2: 1.05, C3: null },
            'good',
            DEFAULT_RUBRIC_LEVEL_POLICY
        );

        expect(filledCount).toBe(1);
        expect(keptCount).toBe(2);
        expect(nextScoresMap.C1).toBe(0);
        expect(nextScoresMap.C2).toBe(1.05);
        expect(nextScoresMap.C3).toBe(0.9);
    });
});

describe('RubricQuickScore component', () => {
    function ControlledSheet({ initialScores = {}, disabled = false, policy = DEFAULT_RUBRIC_LEVEL_POLICY }) {
        const [scoresMap, setScoresMap] = useState(initialScores);
        return (
            <ConfigProvider theme={{ token: { motion: false } }}>
                <RubricQuickScore
                    categories={sampleCategories}
                    policy={policy}
                    scoresMap={scoresMap}
                    disabled={disabled}
                    onScoresChange={setScoresMap}
                />
            </ConfigProvider>
        );
    }

    test('radio selection, manual 0.75 edit switching level to Khá, blank clearing level, and progress/subtotals', async () => {
        const userEv = userEvent.setup();
        render(<ControlledSheet />);

        expect(screen.getByTestId('rubric-progress-text')).toHaveTextContent('0/3 mục đã chấm');
        expect(screen.getByText('CLO1')).toBeInTheDocument();
        expect(screen.getByText('Đặt vấn đề xuất sắc')).toBeInTheDocument();

        // Click Tốt on 1-point criterion C1 => 0.90
        const c1GoodRadio = screen.getByRole('radio', { name: 'Đặt vấn đề - Tốt' });
        await userEv.click(c1GoodRadio);

        const c1Input = screen.getByRole('spinbutton', { name: 'Điểm Đặt vấn đề' });
        expect(c1Input).toHaveValue(0.9);
        expect(c1GoodRadio).toBeChecked();
        expect(screen.getByTestId('rubric-progress-text')).toHaveTextContent('1/3 mục đã chấm');
        expect(screen.getByTestId('rubric-group-subtotal-CAT_CONTENT')).toHaveTextContent('0.90 / 3.40đ');
        expect(screen.getByTestId('rubric-total-preview')).toHaveTextContent('0.90 / 3.40đ');

        // Edit numeric input to 0.75 => switches radio to Khá
        await userEv.clear(c1Input);
        await userEv.type(c1Input, '0.75');
        expect(c1Input).toHaveValue(0.75);
        expect(screen.getByRole('radio', { name: 'Đặt vấn đề - Khá' })).toBeChecked();
        expect(c1GoodRadio).not.toBeChecked();
        expect(screen.getByTestId('rubric-group-subtotal-CAT_CONTENT')).toHaveTextContent('0.75 / 3.40đ');

        // Clearing numeric input clears level and resets progress
        await userEv.clear(c1Input);
        expect(c1Input).toHaveValue(null);
        expect(screen.getByRole('radio', { name: 'Đặt vấn đề - Khá' })).not.toBeChecked();
        expect(screen.getByTestId('rubric-progress-text')).toHaveTextContent('0/3 mục đã chấm');
        expect(screen.getByTestId('rubric-group-subtotal-CAT_CONTENT')).toHaveTextContent('0.00 / 3.40đ');
    });

    test('group quick-fill preserves 0 and manual scores, fills only empty items, and announces counts', async () => {
        const userEv = userEvent.setup();
        render(<ControlledSheet initialScores={{ C1: 0, C2: 1.05 }} />);

        expect(screen.getByTestId('rubric-progress-text')).toHaveTextContent('2/3 mục đã chấm');
        expect(screen.getByTestId('rubric-group-subtotal-CAT_CONTENT')).toHaveTextContent('1.05 / 3.40đ');

        const groupBar = screen.getByRole('group', { name: /Chọn mức cho các mục chưa chấm/i });
        const fillGoodBtn = within(groupBar).getByRole('button', { name: /Tốt/i });
        await userEv.click(fillGoodBtn);

        expect(screen.getByRole('spinbutton', { name: 'Điểm Đặt vấn đề' })).toHaveValue(0);
        expect(screen.getByRole('spinbutton', { name: 'Điểm Phương pháp' })).toHaveValue(1.05);
        expect(screen.getByRole('spinbutton', { name: 'Điểm Kết quả thực nghiệm' })).toHaveValue(0.9);
        expect(screen.getByTestId('rubric-progress-text')).toHaveTextContent('3/3 mục đã chấm');
        expect(screen.getByTestId('rubric-group-subtotal-CAT_CONTENT')).toHaveTextContent('1.95 / 3.40đ');
        expect(screen.getByRole('status')).toHaveTextContent('Đã điền 1 mục trống (Tốt), giữ nguyên 2 mục đã chấm.');
    });

    test('supports keyboard radio selection and disables all controls when locked', async () => {
        const userEv = userEvent.setup();
        const { unmount } = render(<ControlledSheet />);

        const c1GoodRadio = screen.getByRole('radio', { name: 'Đặt vấn đề - Tốt' });
        c1GoodRadio.focus();
        await userEv.keyboard('{ArrowDown}');

        expect(screen.getByRole('radio', { name: 'Đặt vấn đề - Khá' })).toBeChecked();
        expect(screen.getByRole('spinbutton', { name: 'Điểm Đặt vấn đề' })).toHaveValue(0.75);

        unmount();

        render(<ControlledSheet initialScores={{ C1: 0.9 }} disabled={true} />);
        expect(screen.getByRole('spinbutton', { name: 'Điểm Đặt vấn đề' })).toBeDisabled();
        expect(screen.getByRole('radio', { name: 'Đặt vấn đề - Tốt' })).toBeDisabled();
        const groupBar = screen.getByRole('group', { name: /Chọn mức cho các mục chưa chấm/i });
        expect(within(groupBar).getByRole('button', { name: /Tốt/i })).toBeDisabled();
    });
});

describe('LecturerGradingSheetPage quick-scoring integration', () => {
    const buildSheetPayload = (overrides = {}) => ({
        success: true,
        data: {
            registration: {
                id: 101,
                student: { fullName: 'Trần Minh Khôi', code: '22000201' },
                topic: { title: 'Hệ thống AI chấm đồ án' },
                council: { name: 'Hội đồng CNTT 01', defenseLocation: 'P.402' },
            },
            currentEvaluator: { id: 10, fullName: 'TS. Nguyễn Văn Giảng', roleInCouncil: 'CHAIRMAN' },
            scoreLocked: false,
            defenseResult: { comments: '' },
            rubric: {
                version: 'v2_policy',
                title: 'Barem chuẩn',
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

    test('uses rubric scoreLevelPolicy, allows partial draft save without fabricating 0s, and gates lock until all scored (including 0)', async () => {
        const userEv = userEvent.setup();
        vi.spyOn(evaluationService, 'getScoreSheet').mockResolvedValue(buildSheetPayload());
        const saveSpy = vi.spyOn(evaluationService, 'saveScoreSheet').mockResolvedValue({ success: true, data: {} });
        const lockSpy = vi.spyOn(evaluationService, 'lockMemberScoreSheet').mockResolvedValue({ success: true, data: {} });

        mountWithRouter(
            <Routes>
                <Route path="/lecturer/grading/:registrationId" element={<LecturerGradingSheetPage />} />
            </Routes>
        );

        const c1Input = await screen.findByRole('spinbutton', { name: 'Điểm Đặt vấn đề' });
        const c2Input = screen.getByRole('spinbutton', { name: 'Điểm Phương pháp' });
        const c3Input = screen.getByRole('spinbutton', { name: 'Điểm Kết quả thực nghiệm' });

        // Starts blank (no prefill / no 0s)
        expect(c1Input).toHaveValue(null);
        expect(c2Input).toHaveValue(null);
        expect(c3Input).toHaveValue(null);

        // Rule 2.6 back button & level descriptions
        expect(screen.getByRole('button', { name: /Quay lại danh sách Hội đồng/i })).toBeInTheDocument();
        expect(screen.getByText('Đặt vấn đề xuất sắc')).toBeInTheDocument();

        const lockBtn = screen.getByRole('button', { name: /Nộp & Khóa phiếu cá nhân/i });
        const saveBtn = screen.getByRole('button', { name: /Lưu Điểm Nháp/i });
        expect(lockBtn).toBeDisabled();

        // Save when completely empty => sends scores: []
        await userEv.click(saveBtn);
        await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
        expect(saveSpy).toHaveBeenLastCalledWith('101', {
            scores: [],
            generalComment: '',
        });

        // Score C1 using custom policy Tốt (suggestedPercent: 95 => 0.95) and C2 = 0
        await userEv.click(screen.getByRole('radio', { name: 'Đặt vấn đề - Tốt' }));
        expect(c1Input).toHaveValue(0.95);
        await userEv.type(c2Input, '0');
        expect(c2Input).toHaveValue(0);

        // Still incomplete (C3 blank): lock disabled, partial draft save sends only C1 and C2
        expect(lockBtn).toBeDisabled();
        await userEv.click(saveBtn);
        await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(2));
        expect(saveSpy).toHaveBeenLastCalledWith('101', {
            scores: [
                { criterionCode: 'C1', score: 0.95, comment: null },
                { criterionCode: 'C2', score: 0, comment: null },
            ],
            generalComment: '',
        });

        // Fill remaining C3 with group fill Kém => 0.30, keeps C1=0.95 and C2=0
        const groupBar = screen.getByRole('group', { name: /Chọn mức cho các mục chưa chấm/i });
        await userEv.click(within(groupBar).getByRole('button', { name: /Kém/i }));
        expect(c3Input).toHaveValue(0.3);
        expect(c2Input).toHaveValue(0);

        // Now complete => lock button enabled
        expect(lockBtn).toBeEnabled();
        await userEv.click(lockBtn);
        const confirmBtn = await screen.findByRole('button', { name: /Xác nhận khóa/i });
        await userEv.click(confirmBtn);

        await waitFor(() => expect(lockSpy).toHaveBeenCalledTimes(1));
        expect(lockSpy).toHaveBeenCalledWith({
            registrationId: 101,
            scores: [
                { criterionCode: 'C1', score: 0.95, comment: null },
                { criterionCode: 'C2', score: 0, comment: null },
                { criterionCode: 'C3', score: 0.3, comment: null },
            ],
            generalComment: '',
            targetRubricVersion: 'v2_policy',
        });
    });

    test('renders read-only controls when member sheet is locked', async () => {
        vi.spyOn(evaluationService, 'getScoreSheet').mockResolvedValue(
            buildSheetPayload({
                scoreLocked: true,
                scores: [
                    { criterionCode: 'C1', score: 0.95 },
                    { criterionCode: 'C2', score: 1.05 },
                    { criterionCode: 'C3', score: 0 },
                ],
            })
        );

        mountWithRouter(
            <Routes>
                <Route path="/lecturer/grading/:registrationId" element={<LecturerGradingSheetPage />} />
            </Routes>
        );

        const c1Input = await screen.findByRole('spinbutton', { name: 'Điểm Đặt vấn đề' });
        expect(c1Input).toBeDisabled();
        expect(screen.getByRole('spinbutton', { name: 'Điểm Kết quả thực nghiệm' })).toHaveValue(0);
        expect(screen.getByRole('radio', { name: 'Đặt vấn đề - Tốt' })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Lưu Điểm Nháp/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Nộp & Khóa phiếu cá nhân/i })).toBeDisabled();
    });
});
