import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { ConfigProvider, Modal, message } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import RubricManagementPage from '../src/pages/admin/RubricManagementPage.jsx';
import rubricService from '../src/services/rubricService.js';
import portalContentService from '../src/services/portalContentService.js';

let client;

const adminUser = {
    id: 1,
    fullName: 'Quản trị viên Hệ thống',
    email: 'admin@tdmu.edu.vn',
    role: 'ADMIN',
    permissions: ['VIEW_RUBRIC_CONFIG', 'RUBRIC_MANAGE', 'RUBRIC_LOCK'],
};

const DEFAULT_POLICY = {
    good: { minPercent: 85, maxPercent: 100, suggestedPercent: 90 },
    fair: { minPercent: 70, maxPercent: 85, suggestedPercent: 75 },
    average: { minPercent: 50, maxPercent: 70, suggestedPercent: 60 },
    poor: { minPercent: 0, maxPercent: 50, suggestedPercent: 30 },
};

const SAMPLE_CATEGORIES = [
    {
        id: 10,
        code: 'CAT_CONTENT',
        name: '1. Nội dung nghiên cứu',
        description: 'Đánh giá chuyên môn',
        maxScore: 6.0,
        orderIndex: 1,
        criteria: [
            {
                id: 101,
                code: 'CRI_1',
                label: 'Phương pháp và giải pháp',
                description: 'Giải pháp khoa học',
                cloCode: 'CLO1',
                levelGoodDesc: 'Xuất sắc',
                levelFairDesc: 'Khá',
                levelAverageDesc: 'Trung bình',
                levelPoorDesc: 'Kém',
                maxScore: 6.0,
                orderIndex: 1,
            },
        ],
    },
    {
        id: 11,
        code: 'CAT_DEFENSE',
        name: '2. Trình bày và phản biện',
        description: 'Kỹ năng bảo vệ',
        maxScore: 4.0,
        orderIndex: 2,
        criteria: [
            {
                id: 102,
                code: 'CRI_2',
                label: 'Thuyết trình và trả lời câu hỏi',
                description: 'Rõ ràng, tự tin',
                cloCode: 'CLO2',
                levelGoodDesc: 'Xuất sắc',
                levelFairDesc: 'Khá',
                levelAverageDesc: 'Trung bình',
                levelPoorDesc: 'Kém',
                maxScore: 4.0,
                orderIndex: 1,
            },
        ],
    },
];

function mountPage() {
    return render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter>
                    <RubricManagementPage />
                </MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );
}

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
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => nativeGetComputedStyle(el));

    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
    useAuthStore.setState({ user: adminUser, isAuthenticated: true });

    vi.spyOn(portalContentService, 'getPublicContent').mockResolvedValue({
        success: true,
        data: { templates: [] },
    });
});

afterEach(() => {
    cleanup();
    client?.cancelQueries();
    client?.clear();
    useAuthStore.getState().logout();
    Modal.destroyAll();
    message.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

test('create flow initializes default scoreLevelPolicy and submits it in createRubric payload', async () => {
    const userEv = userEvent.setup();

    vi.spyOn(rubricService, 'getRubricVersions').mockResolvedValue({
        success: true,
        data: { versions: [], systemEditable: true },
    });
    vi.spyOn(rubricService, 'getRubricById').mockResolvedValue({
        success: true,
        data: {
            id: 99,
            version: 'v1',
            title: 'Barem đánh giá bảo vệ đồ án tốt nghiệp khóa mới',
            status: 'DRAFT',
            isActive: false,
            isLocked: false,
            isLockedByGrading: false,
            scoreLevelPolicy: DEFAULT_POLICY,
            categories: SAMPLE_CATEGORIES,
        },
    });
    const createSpy = vi.spyOn(rubricService, 'createRubric').mockResolvedValue({
        success: true,
        data: {
            id: 99,
            version: 'v1',
            title: 'Barem đánh giá bảo vệ đồ án tốt nghiệp khóa mới',
            status: 'DRAFT',
            isActive: false,
            scoreLevelPolicy: DEFAULT_POLICY,
            categories: SAMPLE_CATEGORIES,
        },
    });

    mountPage();

    await userEv.click(await screen.findByRole('button', { name: /Thêm Phiên Bản Mới/i }));

    expect(await screen.findByText(/Chính sách quy đổi 4 mức điểm/i)).toBeInTheDocument();

    expect(screen.getByLabelText('Tốt - Biên dưới (%)')).toHaveValue(85);
    expect(screen.getByLabelText('Tốt - Biên trên (%)')).toHaveValue(100);
    expect(screen.getByLabelText('Tốt - Điểm gợi ý (%)')).toHaveValue(90);

    expect(screen.getByLabelText('Khá - Biên dưới (%)')).toHaveValue(70);
    expect(screen.getByLabelText('Khá - Biên trên (%)')).toHaveValue(85);
    expect(screen.getByLabelText('Khá - Điểm gợi ý (%)')).toHaveValue(75);

    expect(screen.getByLabelText('Trung bình - Biên dưới (%)')).toHaveValue(50);
    expect(screen.getByLabelText('Trung bình - Biên trên (%)')).toHaveValue(70);
    expect(screen.getByLabelText('Trung bình - Điểm gợi ý (%)')).toHaveValue(60);

    expect(screen.getByLabelText('Kém - Biên dưới (%)')).toHaveValue(0);
    expect(screen.getByLabelText('Kém - Biên trên (%)')).toHaveValue(50);
    expect(screen.getByLabelText('Kém - Điểm gợi ý (%)')).toHaveValue(30);

    await userEv.click(screen.getByRole('button', { name: /Lưu Cấu Hình Rubric/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({
            scoreLevelPolicy: DEFAULT_POLICY,
        })
    );
});

test('cloning an existing rubric inherits its scoreLevelPolicy (and falls back to default when missing)', async () => {
    const userEv = userEvent.setup();
    const customPolicy = {
        good: { minPercent: 80, maxPercent: 100, suggestedPercent: 92 },
        fair: { minPercent: 65, maxPercent: 80, suggestedPercent: 72 },
        average: { minPercent: 50, maxPercent: 65, suggestedPercent: 58 },
        poor: { minPercent: 0, maxPercent: 50, suggestedPercent: 25 },
    };

    vi.spyOn(rubricService, 'getRubricVersions').mockResolvedValue({
        success: true,
        data: {
            versions: [
                {
                    id: 1,
                    version: 'v1_custom',
                    title: 'Barem tùy chỉnh 2026',
                    status: 'ACTIVE',
                    isActive: true,
                    scoreLevelPolicy: customPolicy,
                    categories: SAMPLE_CATEGORIES,
                },
                {
                    id: 2,
                    version: 'v0_legacy',
                    title: 'Barem cũ không có policy',
                    status: 'ARCHIVED',
                    isActive: false,
                    categories: SAMPLE_CATEGORIES,
                },
            ],
            systemEditable: true,
        },
    });
    vi.spyOn(rubricService, 'getRubricById').mockImplementation(async (id) => ({
        success: true,
        data: Number(id) === 10
            ? {
                id: 10,
                version: 'v3',
                title: 'Bản sao của Barem tùy chỉnh 2026',
                status: 'DRAFT',
                isActive: false,
                isLocked: false,
                isLockedByGrading: false,
                scoreLevelPolicy: customPolicy,
                categories: SAMPLE_CATEGORIES,
            }
            : {
                id: 1,
                version: 'v1_custom',
                title: 'Barem tùy chỉnh 2026',
                status: 'ACTIVE',
                isActive: true,
                scoreLevelPolicy: customPolicy,
                categories: SAMPLE_CATEGORIES,
            },
    }));
    const createSpy = vi.spyOn(rubricService, 'createRubric').mockResolvedValue({
        success: true,
        data: {
            id: 10,
            version: 'v3',
            title: 'Bản sao của Barem tùy chỉnh 2026',
            status: 'DRAFT',
            isActive: false,
            scoreLevelPolicy: customPolicy,
            categories: SAMPLE_CATEGORIES,
        },
    });

    mountPage();

    await userEv.click(await screen.findByRole('button', { name: /3\. Lịch sử Phiên bản/i }));
    const customRow = (await screen.findByText('Barem tùy chỉnh 2026')).closest('tr');
    await userEv.click(within(customRow).getByRole('button', { name: 'Nhân bản' }));

    expect(await screen.findByText(/Chính sách mức điểm kế thừa từ phiên bản gốc/i)).toBeInTheDocument();
    expect(screen.getByText(/80% – 100% · Gợi ý 92%/i)).toBeInTheDocument();

    await userEv.click(screen.getByRole('button', { name: /Nhân bản & Chỉnh sửa/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({
            cloneFromId: 1,
            scoreLevelPolicy: customPolicy,
        })
    );

    expect(await screen.findByLabelText('Tốt - Biên dưới (%)')).toHaveValue(80);
    expect(screen.getByLabelText('Tốt - Điểm gợi ý (%)')).toHaveValue(92);
    expect(screen.getByLabelText('Khá - Biên dưới (%)')).toHaveValue(65);
    expect(screen.getByLabelText('Kém - Điểm gợi ý (%)')).toHaveValue(25);

    // Clone legacy rubric missing scoreLevelPolicy -> falls back to DEFAULT_POLICY
    await userEv.click(screen.getByRole('button', { name: /3\. Lịch sử Phiên bản/i }));
    const legacyRow = (await screen.findByText('Barem cũ không có policy')).closest('tr');
    await userEv.click(within(legacyRow).getByRole('button', { name: 'Nhân bản' }));
    await userEv.click(screen.getByRole('button', { name: /Nhân bản & Chỉnh sửa/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(2));
    expect(createSpy.mock.calls[1][0]).toEqual(
        expect.objectContaining({
            cloneFromId: 2,
            scoreLevelPolicy: DEFAULT_POLICY,
        })
    );
});

test('submitting an invalid scoreLevelPolicy range surfaces the backend validation error', async () => {
    const userEv = userEvent.setup();
    const backendErrorMsg = 'Khoảng mức Khá và Tốt không được chồng lấn hoặc để trống khoảng điểm.';

    vi.spyOn(rubricService, 'getRubricVersions').mockResolvedValue({
        success: true,
        data: {
            versions: [
                {
                    id: 5,
                    version: 'v2_draft',
                    title: 'Barem nháp chỉnh sửa được',
                    status: 'DRAFT',
                    isActive: false,
                    isLocked: false,
                    isLockedByGrading: false,
                    scoreLevelPolicy: DEFAULT_POLICY,
                },
            ],
            systemEditable: true,
        },
    });
    vi.spyOn(rubricService, 'getRubricById').mockResolvedValue({
        success: true,
        data: {
            id: 5,
            version: 'v2_draft',
            title: 'Barem nháp chỉnh sửa được',
            status: 'DRAFT',
            isActive: false,
            isLocked: false,
            isLockedByGrading: false,
            scoreLevelPolicy: DEFAULT_POLICY,
            categories: SAMPLE_CATEGORIES,
        },
    });
    const updateSpy = vi.spyOn(rubricService, 'updateRubric').mockRejectedValue(new Error(backendErrorMsg));

    mountPage();

    await userEv.click(await screen.findByRole('button', { name: /2\. Biên tập Tiêu chuẩn Rubric Đánh giá/i }));

    const fairMaxInput = await screen.findByLabelText('Khá - Biên trên (%)');
    expect(fairMaxInput).not.toBeDisabled();

    await userEv.clear(fairMaxInput);
    await userEv.type(fairMaxInput, '95');

    await userEv.click(screen.getByRole('button', { name: /Lưu Cấu Hình Rubric/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy.mock.calls[0][0]).toBe(5);
    expect(updateSpy.mock.calls[0][1].scoreLevelPolicy.fair.maxPercent).toBe(95);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(backendErrorMsg);
});

test('used and locked rubrics display scoreLevelPolicy values in read-only mode', async () => {
    const userEv = userEvent.setup();
    const usedPolicy = {
        good: { minPercent: 88, maxPercent: 100, suggestedPercent: 94 },
        fair: { minPercent: 72, maxPercent: 88, suggestedPercent: 78 },
        average: { minPercent: 50, maxPercent: 72, suggestedPercent: 60 },
        poor: { minPercent: 0, maxPercent: 50, suggestedPercent: 30 },
    };

    vi.spyOn(rubricService, 'getRubricVersions').mockResolvedValue({
        success: true,
        data: {
            versions: [
                {
                    id: 7,
                    version: 'v1_used',
                    title: 'Barem đã phát sinh điểm',
                    status: 'DRAFT',
                    isActive: false,
                    isLocked: false,
                    isLockedByGrading: true,
                    totalGradedSubmissions: 4,
                    scoreLevelPolicy: usedPolicy,
                },
                {
                    id: 8,
                    version: 'v1_locked',
                    title: 'Barem đã khóa chính thức',
                    status: 'ACTIVE',
                    isActive: true,
                    isLocked: true,
                    isLockedByGrading: false,
                    scoreLevelPolicy: DEFAULT_POLICY,
                },
            ],
            systemEditable: true,
        },
    });
    vi.spyOn(rubricService, 'getRubricById').mockImplementation(async (id) => ({
        success: true,
        data: Number(id) === 7
            ? {
                id: 7,
                version: 'v1_used',
                title: 'Barem đã phát sinh điểm',
                status: 'DRAFT',
                isActive: false,
                isLocked: false,
                isLockedByGrading: true,
                totalGradedSubmissions: 4,
                scoreLevelPolicy: usedPolicy,
                categories: SAMPLE_CATEGORIES,
            }
            : {
                id: 8,
                version: 'v1_locked',
                title: 'Barem đã khóa chính thức',
                status: 'ACTIVE',
                isActive: true,
                isLocked: true,
                isLockedByGrading: false,
                scoreLevelPolicy: DEFAULT_POLICY,
                categories: SAMPLE_CATEGORIES,
            },
    }));

    mountPage();

    // Active version (id: 8, locked/active) is auto-selected first
    await userEv.click(await screen.findByRole('button', { name: /2\. Biên tập Tiêu chuẩn Rubric Đánh giá/i }));
    expect(await screen.findByText('Chỉ đọc')).toBeInTheDocument();
    expect(screen.getByLabelText('Tốt - Biên dưới (%)')).toHaveValue(85);
    expect(screen.getByLabelText('Tốt - Biên dưới (%)')).toBeDisabled();
    expect(screen.getByLabelText('Tốt - Điểm gợi ý (%)')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Khôi phục ngưỡng mặc định/i })).not.toBeInTheDocument();

    // Switch to used draft rubric (id: 7, isLockedByGrading: true)
    await userEv.click(screen.getByRole('button', { name: /3\. Lịch sử Phiên bản/i }));
    const usedRow = (await screen.findByText('Barem đã phát sinh điểm')).closest('tr');
    await userEv.click(within(usedRow).getByRole('button', { name: 'Xem / Sửa' }));

    expect(await screen.findByText(/88% – 100% · Gợi ý 94%/i)).toBeInTheDocument();
    expect(screen.getByText(/đã được sử dụng để chấm điểm nên chính sách mức điểm ở chế độ chỉ đọc/i)).toBeInTheDocument();

    const readOnlyInputs = [
        screen.getByLabelText('Tốt - Biên dưới (%)'),
        screen.getByLabelText('Tốt - Biên trên (%)'),
        screen.getByLabelText('Tốt - Điểm gợi ý (%)'),
        screen.getByLabelText('Khá - Biên dưới (%)'),
        screen.getByLabelText('Khá - Biên trên (%)'),
        screen.getByLabelText('Khá - Điểm gợi ý (%)'),
        screen.getByLabelText('Trung bình - Biên dưới (%)'),
        screen.getByLabelText('Trung bình - Biên trên (%)'),
        screen.getByLabelText('Trung bình - Điểm gợi ý (%)'),
        screen.getByLabelText('Kém - Biên dưới (%)'),
        screen.getByLabelText('Kém - Biên trên (%)'),
        screen.getByLabelText('Kém - Điểm gợi ý (%)'),
    ];

    for (const input of readOnlyInputs) {
        expect(input).toBeDisabled();
        expect(input).toHaveAttribute('readonly');
    }
});
