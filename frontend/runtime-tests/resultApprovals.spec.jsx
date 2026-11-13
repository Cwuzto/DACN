import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ConfigProvider, Modal, message } from 'antd';
import GradingDefensePage from '../src/pages/admin/GradingDefensePage.jsx';
import ProtectedRoute from '../src/components/common/ProtectedRoute.jsx';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import evaluationService from '../src/services/evaluationService.js';
import councilService from '../src/services/councilService.js';
import { semesterService } from '../src/services/semesterService.js';

const row = {
    registrationId: 101, status: 'AWAITING_FINAL_APPROVAL', workflowStage: 'COMPLETED',
    gradingStatus: 'GRADED', student: { id: 5, code: 'SV101', fullName: 'Sinh viên chờ duyệt' },
    topic: { id: 1, code: 'DT101', title: 'Đề tài chờ duyệt' },
    council: { id: 7, name: 'Hội đồng 7' }, semester: { id: 12, name: 'Học kỳ 12' },
    finalScore: 8, scoreLocked: true, memberScores: [], mentor: null,
};
const response = { success: true, data: [row, { ...row, registrationId: 102, status: 'COMPLETED', student: { code: 'SV102', fullName: 'Sinh viên đã duyệt' } }], meta: { targetSemester: { id: 12, name: 'Học kỳ 12' }, counts: {}, total: 2 } };
let client;

beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => nativeGetComputedStyle(element));
    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: 30000 }, mutations: { retry: false } });
    vi.spyOn(semesterService, 'getAll').mockResolvedValue({ success: true, data: [{ id: 12, name: 'Học kỳ 12' }] });
    vi.spyOn(councilService, 'getCouncils').mockRejectedValue({ status: 403, message: 'Forbidden council management' });
    vi.spyOn(evaluationService, 'getAdminDefenseCenter').mockResolvedValue(response);
});
afterEach(() => { client.clear(); Modal.destroyAll(); message.destroy(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mount(permissions = ['VIEW_DEFENSE_RESULT_APPROVALS']) {
    useAuthStore.setState({ user: { id: 8, permissions }, isAuthenticated: true });
    return render(<ConfigProvider theme={{ token: { motion: false } }}><AppQueryProvider client={client}><MemoryRouter initialEntries={['/admin/grading?tab=approvals']}><Routes>
        <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_DEFENSE_RESULT_APPROVALS', 'VIEW_DEFENSE_RESULTS_APPROVAL', 'DEFENSE_RESULT_APPROVE']} />}>
            <Route path="/admin/grading" element={<GradingDefensePage />} />
        </Route>
    </Routes></MemoryRouter></AppQueryProvider></ConfigProvider>);
}

test.each(['VIEW_DEFENSE_RESULT_APPROVALS', 'VIEW_DEFENSE_RESULTS_APPROVAL'])('approval deep link renders read-only rows for %s without council management or unsupported export', async (permission) => {
    mount([permission]);
    expect(await screen.findByText('Sinh viên chờ duyệt')).toBeInTheDocument();
    expect(screen.queryByText('Sinh viên đã duyệt')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Duyệt đạt|Duyệt không đạt|Trả sổ|Nhắc Chấm|Xuất Bảng Điểm Excel/ })).not.toBeInTheDocument();
    expect(councilService.getCouncils).not.toHaveBeenCalled();
    expect(screen.getByRole('option', { name: 'Hội đồng 7' })).toBeInTheDocument();
});

test('initial ledger failure offers inline retry and recovers real rows', async () => {
    evaluationService.getAdminDefenseCenter.mockRejectedValueOnce({ status: 500, message: 'Sổ điểm tạm thời gián đoạn' });
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Sổ điểm tạm thời gián đoạn');
    expect(screen.queryByText('Không có hồ sơ nào phù hợp với bộ lọc hiện tại.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    expect(await screen.findByText('Sinh viên chờ duyệt')).toBeInTheDocument();
});

test('refresh failure preserves cached approval rows and retry does not replace them with a skeleton', async () => {
    mount();
    const cachedRow = await screen.findByText('Sinh viên chờ duyệt');
    let rejectRefresh;
    evaluationService.getAdminDefenseCenter.mockImplementationOnce(() => new Promise((_, reject) => { rejectRefresh = reject; }));
    await userEvent.click(screen.getByRole('button', { name: 'Làm mới sổ điểm' }));
    expect(screen.getByText('Sinh viên chờ duyệt')).toBe(cachedRow);
    expect(screen.getByRole('status')).toHaveTextContent('Đang cập nhật');
    await act(async () => rejectRefresh({ status: 500, message: 'Không thể cập nhật sổ điểm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể cập nhật sổ điểm');
    expect(screen.getByText('Sinh viên chờ duyệt')).toBe(cachedRow);
    await userEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText('Sinh viên chờ duyệt')).toBe(cachedRow);
});

test('approval owner submits the chosen outcome and refreshes approval rows without invalidating unrelated data', async () => {
    vi.spyOn(evaluationService, 'approveDefenseResult').mockResolvedValue({ success: true });
    mount(['DEFENSE_RESULT_APPROVE']);
    await screen.findByText('Sinh viên chờ duyệt');
    client.setQueryData(['unrelated'], 'keep');
    evaluationService.getAdminDefenseCenter.mockResolvedValue({ ...response, data: [{ ...row, status: 'COMPLETED' }] });
    await userEvent.click(screen.getByRole('button', { name: 'Duyệt đạt' }));
    await userEvent.click(await screen.findByRole('button', { name: /Xác nhận phê duyệt/ }));
    await waitFor(() => expect(screen.queryByText('Sinh viên chờ duyệt')).not.toBeInTheDocument());
    expect(evaluationService.approveDefenseResult).toHaveBeenCalledWith(101, { outcome: 'PASSED' });
    expect(client.getQueryState(['unrelated']).isInvalidated).toBe(false);
});

test('a result-only viewer can filter councils using ledger data without reading return-log management data', async () => {
    vi.spyOn(evaluationService, 'getScoreBookReturnLogs').mockRejectedValue({ status: 403 });
    mount();
    await screen.findByText('Sinh viên chờ duyệt');
    await userEvent.selectOptions(screen.getByRole('option', { name: 'Hội đồng 7' }).parentElement, '7');
    await waitFor(() => expect(evaluationService.getAdminDefenseCenter).toHaveBeenCalledWith({ semesterId: 12, councilId: '7' }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
    expect(evaluationService.getScoreBookReturnLogs).not.toHaveBeenCalled();
    expect(councilService.getCouncils).not.toHaveBeenCalled();
});
