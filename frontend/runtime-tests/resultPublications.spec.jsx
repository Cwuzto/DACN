import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ConfigProvider, message } from 'antd';
import GradingDefensePage from '../src/pages/admin/GradingDefensePage.jsx';
import ProtectedRoute from '../src/components/common/ProtectedRoute.jsx';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import evaluationService from '../src/services/evaluationService.js';
import councilService from '../src/services/councilService.js';
import { semesterService } from '../src/services/semesterService.js';
import { queryKeys } from '../src/query/queryKeys.js';

const preview = { success: true, data: { eligible: [{ id: 301, registrationId: 101, outcome: 'PASSED', finalScoreSnapshot: 8, registration: { student: { code: 'SV101', fullName: 'Sinh viên công bố' }, topic: { title: 'Đề tài công bố' } } }] } };
const history = { success: true, data: [{ id: 21, type: 'INITIAL', publishedAt: '2026-11-01T08:00:00Z', reason: 'Đợt đầu tiên', items: [{ id: 300, registrationId: 99, studentCodeSnapshot: 'SV099', studentNameSnapshot: 'Sinh viên đã công bố', topicTitleSnapshot: 'Đề tài niêm phong', finalScoreSnapshot: 7, outcomeSnapshot: 'PASSED' }] }] };
let client;

beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => nativeGetComputedStyle(element));
    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: 30000 }, mutations: { retry: false } });
    vi.spyOn(semesterService, 'getAll').mockResolvedValue({ success: true, data: [{ id: 12, name: 'Học kỳ 12' }] });
    vi.spyOn(councilService, 'getCouncils').mockRejectedValue({ status: 403 });
    vi.spyOn(evaluationService, 'getAdminDefenseCenter').mockRejectedValue({ status: 403 });
    vi.spyOn(evaluationService, 'previewResultPublication').mockResolvedValue(preview);
    vi.spyOn(evaluationService, 'getResultPublicationHistory').mockResolvedValue(history);
    vi.spyOn(evaluationService, 'publishDefenseResults').mockResolvedValue({ success: true });
});
afterEach(() => { client.clear(); message.destroy(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mount(permissions = ['VIEW_RESULT_PUBLICATIONS']) {
    useAuthStore.setState({ user: { id: 8, permissions }, isAuthenticated: true });
    return render(<ConfigProvider theme={{ token: { motion: false } }}><AppQueryProvider client={client}><MemoryRouter initialEntries={['/admin/grading?tab=publish']}><Routes>
        <Route element={<ProtectedRoute requiredAnyPermissions={['VIEW_RESULT_PUBLICATIONS', 'RESULT_PUBLICATION_PUBLISH']} />}>
            <Route path="/admin/grading" element={<GradingDefensePage />} />
        </Route>
    </Routes></MemoryRouter></AppQueryProvider></ConfigProvider>);
}

test('publication viewer deep link reads preview and history without mutation controls or unauthorized ledger/council requests', async () => {
    mount();
    expect(await screen.findByText('Sinh viên công bố')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ký & Ban Hành/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Công bố Đính chính')).not.toBeInTheDocument();
    expect(councilService.getCouncils).not.toHaveBeenCalled();
    expect(evaluationService.getAdminDefenseCenter).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Đóng' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lịch sử công bố' }));
    expect(await screen.findByText('Sinh viên đã công bố')).toBeInTheDocument();
    expect(evaluationService.publishDefenseResults).not.toHaveBeenCalled();
});

test('publisher submits a snapshot and refreshes exact history/preview caches only', async () => {
    mount(['RESULT_PUBLICATION_PUBLISH']);
    await screen.findByText('Sinh viên công bố');
    client.setQueryData(['unrelated'], 'keep');
    const scope = queryKeys.scope(useAuthStore.getState().user);
    const ledgerKey = queryKeys.grading.defenseResults(scope, { semesterId: 12, councilId: 7, search: 'SV' });
    const otherSemesterKey = queryKeys.grading.defenseResults(scope, { semesterId: 13 });
    client.setQueryData(ledgerKey, { success: true, data: [] });
    client.setQueryData(otherSemesterKey, { success: true, data: [] });
    await userEvent.type(screen.getByPlaceholderText('Ví dụ: Công bố chính thức đợt 1...'), 'Quyết định 12');
    await userEvent.click(screen.getByRole('button', { name: /Ký & Ban Hành/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(evaluationService.publishDefenseResults).toHaveBeenCalledWith(12, { type: 'INITIAL', reason: 'Quyết định 12', previousPublicationId: undefined }, expect.any(String));
    expect(client.getQueryState(['unrelated']).isInvalidated).toBe(false);
    expect(client.getQueryState(ledgerKey).isInvalidated).toBe(true);
    expect(client.getQueryState(otherSemesterKey).isInvalidated).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Lịch sử công bố' }));
    expect(await screen.findByText('Sinh viên đã công bố')).toBeInTheDocument();
    expect(evaluationService.getResultPublicationHistory).toHaveBeenCalledTimes(2);
    expect(evaluationService.previewResultPublication).toHaveBeenCalledTimes(2);
});

test('failed publication preserves type, input, and idempotency key for retry', async () => {
    evaluationService.publishDefenseResults.mockRejectedValueOnce({ status: 500, message: 'Chưa thể ban hành' });
    mount(['RESULT_PUBLICATION_PUBLISH']);
    await screen.findByText('Sinh viên công bố');
    await userEvent.type(screen.getByPlaceholderText('Ví dụ: Công bố chính thức đợt 1...'), 'Giữ nguyên ghi chú');
    await userEvent.click(screen.getByRole('button', { name: /Ký & Ban Hành/ }));
    await waitFor(() => expect(evaluationService.publishDefenseResults).toHaveBeenCalledOnce());
    expect(screen.getByPlaceholderText('Ví dụ: Công bố chính thức đợt 1...')).toHaveValue('Giữ nguyên ghi chú');
    const firstKey = evaluationService.publishDefenseResults.mock.calls[0][2];
    await userEvent.click(screen.getByRole('button', { name: /Ký & Ban Hành/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(evaluationService.publishDefenseResults.mock.calls[1][2]).toBe(firstKey);
});

test('initial preview failure is retryable and does not masquerade as an empty eligible list', async () => {
    evaluationService.previewResultPublication.mockRejectedValueOnce({ status: 500, message: 'Preview gián đoạn' });
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Preview gián đoạn');
    await userEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    expect(await screen.findByText('Sinh viên công bố')).toBeInTheDocument();
});

test('history refresh error preserves selected snapshot and exposes retry', async () => {
    mount();
    await screen.findByText('Sinh viên công bố');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Đóng' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lịch sử công bố' }));
    const cachedRow = await screen.findByText('Sinh viên đã công bố');
    let rejectRefresh;
    evaluationService.getResultPublicationHistory.mockImplementationOnce(() => new Promise((_, reject) => { rejectRefresh = reject; }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Làm mới' }));
    expect(screen.getByText('Sinh viên đã công bố')).toBe(cachedRow);
    await act(async () => rejectRefresh({ status: 500, message: 'Lịch sử gián đoạn' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Lịch sử gián đoạn');
    expect(screen.getByText('Sinh viên đã công bố')).toBe(cachedRow);
    await userEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

test('history failure does not hide a successful publication preview', async () => {
    evaluationService.getResultPublicationHistory.mockRejectedValueOnce({ status: 500, message: 'Chưa tải được lịch sử' });
    mount();
    expect(await screen.findByText('Chưa tải được lịch sử')).toBeInTheDocument();
    expect(await screen.findByText('Sinh viên công bố')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    await waitFor(() => expect(screen.queryByText('Chưa tải được lịch sử')).not.toBeInTheDocument());
});

test('preview refresh failure retains eligible rows and publisher input while disabling stale publication', async () => {
    mount(['RESULT_PUBLICATION_PUBLISH']);
    await screen.findByText('Sinh viên công bố');
    const input = screen.getByPlaceholderText('Ví dụ: Công bố chính thức đợt 1...');
    await userEvent.type(input, 'Ghi chú đang soạn');
    evaluationService.previewResultPublication.mockRejectedValueOnce({ status: 500, message: 'Preview chưa cập nhật' });
    await act(async () => client.invalidateQueries({ queryKey: queryKeys.grading.publicationPreview(queryKeys.scope(useAuthStore.getState().user), 12), exact: true }));
    await waitFor(() => expect(screen.getByText('Preview chưa cập nhật').closest('[role="alert"]')).toBeInTheDocument());
    expect(screen.getByText('Sinh viên công bố')).toBeInTheDocument();
    expect(input).toHaveValue('Ghi chú đang soạn');
    expect(screen.getByRole('button', { name: /Ký & Ban Hành/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Ký & Ban Hành/ })).toBeEnabled());
    expect(input).toHaveValue('Ghi chú đang soạn');
});

test('legacy publisher alias grants no mutation controls even when accompanied by publication read permission', async () => {
    mount(['VIEW_RESULT_PUBLICATIONS', 'RESULT_PUBLISH']);
    await screen.findByText('Sinh viên công bố');
    expect(screen.queryByRole('button', { name: /Ký & Ban Hành/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Công bố Đính chính')).not.toBeInTheDocument();
    expect(evaluationService.publishDefenseResults).not.toHaveBeenCalled();
});
