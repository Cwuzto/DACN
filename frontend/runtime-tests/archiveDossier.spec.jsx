import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ConfigProvider, message } from 'antd';
import SubmissionPage from '../src/pages/student/SubmissionPage.jsx';
import ArchiveSubmissionModal from '../src/components/forms/ArchiveSubmissionModal.jsx';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import { queryKeys } from '../src/query/queryKeys.js';
import useAuthStore from '../src/stores/authStore.js';
import api from '../src/services/api.js';
import * as archiveModule from '../src/services/archiveService.js';
import registrationService from '../src/services/registrationService.js';
import taskService from '../src/services/taskService.js';
import meetingLogService from '../src/services/meetingLogService.js';
import evaluationService from '../src/services/evaluationService.js';
import outlineService from '../src/services/outlineService.js';
import uploadService from '../src/services/uploadService.js';

let client;
let registration;
let dossier;
const archiveService = archiveModule.default;
const file = { id: 1, fileName: 'report.docx', fileUrl: '/files/report.docx', versionNumber: 2 };
beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
    const nativeStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(element => nativeStyle(element));
    client = createAppQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: 30000 }, mutations: { retry: false } });
    useAuthStore.setState({ user: { id: 6, role: 'STUDENT', permissions: [] }, isAuthenticated: true });
    registration = { id: 101, status: 'DEFENSE_PASSED', topic: { title: 'Đề tài kiểm thử' } };
    dossier = { registrationId: 101, windows: { windowClosesAt: '2026-12-01' }, currentFiles: { REPORT_WORD: file, REPORT_PDF: null, DEMO_VIDEO: null, SLIDE_PPTX: null }, linkedBm03: null, linkedBm04: null, isWindowClosed: false };
    vi.spyOn(api, 'get').mockImplementation(async url => {
        if (url.endsWith('/dossier')) return { success: true, data: dossier };
        throw new Error(`Unexpected request: ${url}`);
    });
    vi.spyOn(registrationService, 'getMyRegistration').mockImplementation(async () => ({ success: true, data: registration }));
    vi.spyOn(archiveService, 'getArchiveByRegistration').mockResolvedValue({ success: true, data: { archive: { status: 'SUBMITTED' } } });
    vi.spyOn(taskService, 'getTasksByRegistration').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(meetingLogService, 'getMeetingLogs').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(evaluationService, 'getCheckpointEvaluations').mockResolvedValue({ success: true, data: [] });
    vi.spyOn(evaluationService, 'getBM03Record').mockResolvedValue({ success: true, data: null });
    vi.spyOn(evaluationService, 'getBM04Record').mockResolvedValue({ success: true, data: null });
    vi.spyOn(outlineService, 'getMyOutline').mockResolvedValue({ success: true, data: null });
});
afterEach(() => { client.clear(); message.destroy(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function mount(children = <SubmissionPage />, entry = '/student/submissions?tab=archive') {
    return render(<ConfigProvider theme={{ token: { motion: false } }}><AppQueryProvider client={client}><MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter></AppQueryProvider></ConfigProvider>);
}

test('normalizes keyed files once, preserves null slots and projects only workflow fields', () => {
    const result = archiveModule.normalizeDefenseDossier({ ...dossier, student: { passwordHash: 'secret', phone: 'private' }, linkedBm03: { id: 3, advisorSignedAt: null, finalPdfFileUrl: null } });
    expect(result.timeWindows).toEqual({ windowClosesAt: '2026-12-01' });
    expect(result.currentFiles.REPORT_PDF).toBeNull();
    expect(result.documents).toEqual([{ ...file, documentType: 'REPORT_WORD' }]);
    expect(result.bm03Record).toEqual({ id: 3, advisorSignedAt: null, finalPdfFileUrl: null });
    expect(result.bm04Record).toBeNull();
    expect(result).not.toHaveProperty('student');
    expect(archiveModule.normalizeDefenseDossier(null).documents).toEqual([]);
});

test('raw dossier service preserves the dashboard and lecturer contract', async () => {
    dossier.defenseSnapshot = { id: 55 };
    const response = await archiveService.getDefenseDossier(101);
    expect(response.data.windows).toEqual({ windowClosesAt: '2026-12-01' });
    expect(response.data.currentFiles.REPORT_WORD).toEqual(file);
    expect(response.data).toHaveProperty('linkedBm03', null);
    expect(response.data.defenseSnapshot).toEqual({ id: 55 });
});

test('archive deep link opens the dossier and page/modal share the same cached files', async () => {
    mount();
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('report.docx')).toBeInTheDocument();
    expect(within(dialog).getByText('v2')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Chưa nộp')).toHaveLength(3);
    expect(within(dialog).getAllByText('Chưa có bản ghi')).toHaveLength(2);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    expect(screen.getAllByText('Đã tải lên')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /Quản lý hồ sơ/ }));
    expect(await screen.findByText('report.docx')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(1);
});

test('actual BM01 revision render resolves UploadOutlined', async () => {
    registration.status = 'BM01_NEEDS_REVISION';
    mount(undefined, '/student/submissions');
    expect(await screen.findByRole('button', { name: /Nộp lại đề cương v2/ })).toBeInTheDocument();
});

test('unsigned legal records never claim success and PDF availability is independent', async () => {
    dossier.linkedBm03 = { id: 3, advisorSignedAt: null, finalPdfFileUrl: '/bm03.pdf' };
    dossier.linkedBm04 = { id: 4, signedAt: null, finalPdfFileUrl: null };
    mount(<ArchiveSubmissionModal open registration={registration} />);
    expect(await screen.findAllByText('Chưa ký số')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Tải BM03' })).toHaveAttribute('href', '/bm03.pdf');
    expect(screen.queryByRole('link', { name: 'Tải BM04' })).not.toBeInTheDocument();
});

test('signed records show actual signature and download states', async () => {
    dossier.linkedBm03 = { id: 3, advisorSignedAt: '2026-11-01', finalPdfFileUrl: '/bm03.pdf' };
    dossier.linkedBm04 = { id: 4, signedAt: '2026-11-02', finalPdfFileUrl: '/bm04.pdf' };
    mount(<ArchiveSubmissionModal open registration={registration} />);
    expect(await screen.findAllByText('Đã ký số')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Tải BM04' })).toHaveAttribute('href', '/bm04.pdf');
});

test('closed window explains disabled upload controls', async () => {
    dossier.isWindowClosed = true;
    mount(<ArchiveSubmissionModal open registration={registration} />);
    expect(await screen.findByText(/Cổng nộp hồ sơ lưu chiểu đã đóng/)).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: /Tải tệp lên|Nộp version mới/ })) expect(button).toBeDisabled();
});

test('ineligible registration deep link explains why uploads are disabled', async () => {
    registration.status = 'APPROVED';
    mount();
    expect(await screen.findByText(/Trạng thái đề tài chưa đủ điều kiện/)).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: /Tải tệp lên|Nộp version mới/ })) expect(button).toBeDisabled();
});

test('initial dossier failure exposes inline retry', async () => {
    api.get.mockRejectedValueOnce({ status: 500, message: 'Dossier gián đoạn' });
    mount(<ArchiveSubmissionModal open registration={registration} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Dossier gián đoạn');
    expect(screen.queryByText('Chưa nộp')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    expect(await screen.findByText('report.docx')).toBeInTheDocument();
});

test('queries do not request an archive or dossier without a registration ID', async () => {
    registrationService.getMyRegistration.mockResolvedValue({ success: true, data: null });
    mount();
    await screen.findByText(/Bạn chưa đăng ký/);
    expect(api.get).not.toHaveBeenCalled();
    expect(archiveService.getArchiveByRegistration).not.toHaveBeenCalled();
});

test('successful file upload refreshes exact dossier/archive/registration caches only', async () => {
    mount();
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('report.docx');
    const scope = queryKeys.scope(useAuthStore.getState().user);
    const otherKey = queryKeys.archives.detail(scope, 202);
    client.setQueryData(otherKey, { untouched: true });
    client.setQueryData(['unrelated'], 'keep');
    vi.spyOn(uploadService, 'uploadFile').mockResolvedValue({ success: true, data: { url: '/files/new.docx' } });
    vi.spyOn(api, 'post').mockImplementation(async () => {
        dossier = { ...dossier, currentFiles: { ...dossier.currentFiles, REPORT_WORD: { ...file, fileName: 'new.docx', fileUrl: '/files/new.docx', versionNumber: 3 } } };
        return { success: true };
    });
    const invalidation = vi.spyOn(client, 'invalidateQueries');
    const input = dialog.querySelector('input[type="file"]');
    await userEvent.upload(input, new File(['report'], 'new.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    expect(await within(dialog).findByText('new.docx')).toBeInTheDocument();
    expect(invalidation.mock.calls.map(([arg]) => arg)).toEqual(expect.arrayContaining([
        { queryKey: queryKeys.archives.detail(scope, 101), exact: true },
        { queryKey: queryKeys.archives.dossier(scope, 101), exact: true },
        { queryKey: queryKeys.registrations.current(scope), exact: true },
    ]));
    expect(client.getQueryState(otherKey).isInvalidated).toBe(false);
    expect(client.getQueryState(['unrelated']).isInvalidated).toBe(false);
});

test('registration failure is retryable instead of showing an empty registration', async () => {
    registrationService.getMyRegistration.mockRejectedValueOnce({ status: 500, message: 'Đăng ký gián đoạn' });
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Đăng ký gián đoạn');
    expect(screen.queryByText(/Bạn chưa đăng ký/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    expect(await screen.findByText('report.docx')).toBeInTheDocument();
});

test('archive summary failure is retryable without hiding a successful dossier', async () => {
    archiveService.getArchiveByRegistration.mockRejectedValueOnce({ status: 500, message: 'Tóm tắt gián đoạn' });
    mount(undefined, '/student/submissions');
    expect(await screen.findByText('Tóm tắt gián đoạn')).toBeInTheDocument();
    expect(await screen.findByText('Đã tải lên')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    await waitFor(() => expect(screen.queryByText('Tóm tắt gián đoạn')).not.toBeInTheDocument());
});

test('failed dossier refresh retains files, disables uploads and recovers on inline retry', async () => {
    mount(<ArchiveSubmissionModal open registration={registration} />);
    const report = await screen.findByText('report.docx');
    api.get.mockRejectedValueOnce({ status: 500, message: 'Cập nhật gián đoạn' });
    await act(async () => client.invalidateQueries({ queryKey: queryKeys.archives.dossier(queryKeys.scope(useAuthStore.getState().user), 101), exact: true }));
    expect(await screen.findByText('Cập nhật gián đoạn')).toBeInTheDocument();
    expect(screen.getByText('report.docx')).toBe(report);
    expect(screen.getByRole('button', { name: /Nộp version mới/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Thử lại/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Nộp version mới/ })).toBeEnabled());
});

test('failed upload preserves current files and exact caches until a successful retry', async () => {
    mount(<ArchiveSubmissionModal open registration={registration} />);
    await screen.findByText('report.docx');
    vi.spyOn(uploadService, 'uploadFile').mockResolvedValue({ success: true, data: { url: '/new.docx' } });
    vi.spyOn(api, 'post').mockRejectedValueOnce({ status: 500, message: 'Lưu phiên bản thất bại' });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const input = screen.getByRole('dialog').querySelector('input[type="file"]');
    await userEvent.upload(input, new File(['report'], 'new.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    expect(await screen.findByText('Lưu phiên bản thất bại')).toBeInTheDocument();
    expect(screen.getByText('report.docx')).toBeInTheDocument();
    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Nộp version mới/ })).toBeEnabled();
});

test('archive query caches only the workflow archive rather than the returned registration', async () => {
    archiveService.getArchiveByRegistration.mockResolvedValue({ success: true, data: { archive: null, registration: { student: { phone: 'private', passwordHash: 'secret' } } } });
    mount(undefined, '/student/submissions');
    await screen.findByText('Đã tải lên');
    const cached = client.getQueryData(queryKeys.archives.detail(queryKeys.scope(useAuthStore.getState().user), 101));
    expect(cached.data).toEqual({ archive: null });
});
