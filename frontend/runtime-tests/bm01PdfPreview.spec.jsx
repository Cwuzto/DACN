import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import BMSubmissionViewer from '../src/components/forms/BMSubmissionViewer.jsx';
import OutlineReviewModal from '../src/components/lecturer/OutlineReviewModal.jsx';
import AcademicDossierDrawer from '../src/components/prints/AcademicDossierDrawer.jsx';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import * as resumableService from '../src/services/resumableUploadService';
import taskService from '../src/services/taskService.js';
import meetingLogService from '../src/services/meetingLogService.js';
import evaluationService from '../src/services/evaluationService.js';
import registrationService from '../src/services/registrationService.js';
import outlineService from '../src/services/outlineService.js';

let client;

function renderWithProviders(ui) {
    return render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <AppQueryProvider client={client}>
                <MemoryRouter>{ui}</MemoryRouter>
            </AppQueryProvider>
        </ConfigProvider>
    );
}

describe('BM01 authorized PDF preview by version & historical DOCX handling', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => ({
                matches: false,
                addListener() {},
                removeListener() {},
                addEventListener() {},
                removeEventListener() {},
            }))
        );
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        );
        client = createAppQueryClient();
        client.setDefaultOptions({ queries: { retry: false, staleTime: 30000 }, mutations: { retry: false } });
        useAuthStore.setState({ user: { id: 701, role: 'LECTURER', permissions: [] }, isAuthenticated: true });
    });

    afterEach(() => {
        client.clear();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('opens authorized PDF URL for selected BM01 version (v1 vs v2) without SimulatedDocumentViewer', async () => {
        const downloadSpy = vi.spyOn(resumableService, 'getAssetDownloadUrl').mockImplementation(async (assetId) => ({
            downloadUrl: `https://signed.example.test/${assetId}.pdf`,
        }));

        const v1 = {
            id: 1,
            versionNo: 1,
            assetId: 'asset-v1',
            fileName: 'outline_v1.pdf',
            content: JSON.stringify({ formCode: 'BM01', taskType: 'BM01_INITIAL_SUBMISSION', fields: { topicTitle: 'Đề tài v1' } }),
            submittedAt: '2026-11-01T10:00:00Z',
        };
        const v2 = {
            id: 2,
            versionNo: 2,
            assetId: 'asset-v2',
            fileName: 'outline_v2.pdf',
            content: JSON.stringify({ formCode: 'BM01', taskType: 'BM01_RESUBMISSION', fields: { topicTitle: 'Đề tài v2', revisionSummary: 'Đã sửa' } }),
            submittedAt: '2026-11-05T10:00:00Z',
        };

        render(
            <ConfigProvider theme={{ token: { motion: false } }}>
                <BMSubmissionViewer submission={v2} submissions={[v2, v1]} />
            </ConfigProvider>
        );

        expect(screen.queryByRole('button', { name: /Xem bản in A4/i })).not.toBeInTheDocument();

        const iframeV2 = await screen.findByTitle(/PDF đề cương BM01 - outline_v2\.pdf/i);
        expect(iframeV2).toHaveAttribute('src', 'https://signed.example.test/asset-v2.pdf');
        expect(downloadSpy).toHaveBeenCalledWith('asset-v2');

        await userEvent.click(screen.getByText('Phiên bản v1'));

        const iframeV1 = await screen.findByTitle(/PDF đề cương BM01 - outline_v1\.pdf/i);
        expect(iframeV1).toHaveAttribute('src', 'https://signed.example.test/asset-v1.pdf');
        expect(downloadSpy).toHaveBeenCalledWith('asset-v1');
    });

    it('shows download-only notice for historical .docx BM01 and clear error when asset access is forbidden', async () => {
        vi.spyOn(resumableService, 'getAssetDownloadUrl').mockResolvedValue({
            downloadUrl: 'https://signed.example.test/legacy.docx',
        });

        const legacyDocx = {
            id: 10,
            formCode: 'BM01',
            assetId: 'asset-docx',
            fileName: 'legacy_outline.docx',
            content: 'Legacy text',
            submittedAt: '2025-10-01T10:00:00Z',
        };

        const { rerender } = render(
            <ConfigProvider theme={{ token: { motion: false } }}>
                <BMSubmissionViewer submission={legacyDocx} />
            </ConfigProvider>
        );

        expect(await screen.findByText(/Tệp Word lịch sử: legacy_outline\.docx/i)).toBeInTheDocument();
        expect(document.querySelector('iframe')).toBeNull();
        expect(screen.getByRole('link', { name: /Tải xuống \(\.docx\)/i })).toHaveAttribute(
            'href',
            'https://signed.example.test/legacy.docx'
        );

        vi.spyOn(resumableService, 'getAssetDownloadUrl').mockRejectedValue(new Error('Bạn không có quyền truy cập tệp này'));
        rerender(
            <ConfigProvider theme={{ token: { motion: false } }}>
                <BMSubmissionViewer
                    submission={{
                        id: 11,
                        formCode: 'BM01',
                        assetId: 'asset-forbidden',
                        fileName: 'secret.pdf',
                        submittedAt: '2026-11-10T10:00:00Z',
                    }}
                />
            </ConfigProvider>
        );

        expect(await screen.findByText(/Không thể mở tệp PDF đề cương BM01/i)).toBeInTheDocument();
        expect(screen.getByText(/Bạn không có quyền truy cập tệp này/i)).toBeInTheDocument();
    });

    it('OutlineReviewModal renders BM01 PDF preview and AcademicDossierDrawer separates BM01 PDF from HTML print', async () => {
        vi.spyOn(resumableService, 'getAssetDownloadUrl').mockResolvedValue({
            downloadUrl: 'https://signed.example.test/council-v2.pdf',
        });
        vi.spyOn(taskService, 'getTasksByRegistration').mockResolvedValue({
            success: true,
            data: [{ taskType: 'BM01_INITIAL_SUBMISSION', submissions: [{ id: 1, assetId: 'asset-bm01', fileName: 'bm01.pdf' }] }],
        });
        vi.spyOn(meetingLogService, 'getMeetingLogs').mockResolvedValue({ success: true, data: [] });
        vi.spyOn(evaluationService, 'getCheckpointEvaluations').mockResolvedValue({ success: true, data: [] });
        vi.spyOn(evaluationService, 'getBM03Record').mockResolvedValue({ success: true, data: null });
        vi.spyOn(evaluationService, 'getBM04Record').mockResolvedValue({ success: true, data: null });
        vi.spyOn(registrationService, 'getTitleAdjustmentsByRegistration' in registrationService ? 'getTitleAdjustmentsByRegistration' : 'getPendingTitleAdjustments').mockResolvedValue({ success: true, data: [] });
        vi.spyOn(outlineService, 'getMyOutline').mockResolvedValue({ success: true, data: null });

        const registration = {
            id: 301,
            student: { fullName: 'Nguyễn Văn A', code: '2224802010001' },
            topic: { title: 'Đề tài kiểm thử', mentor: { fullName: 'TS. Trần B' } },
            submissions: [
                { id: 2, versionNo: 2, formCode: 'BM01', assetId: 'asset-council-v2', fileName: 'council_v2.pdf' },
            ],
        };

        renderWithProviders(
            <OutlineReviewModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} registration={registration} />
        );

        const iframe = await screen.findByTitle(/PDF đề cương BM01 - council_v2\.pdf/i);
        expect(iframe).toHaveAttribute('src', 'https://signed.example.test/council-v2.pdf');

        renderWithProviders(
            <AcademicDossierDrawer open={true} onClose={vi.fn()} registration={registration} />
        );

        expect(await screen.findByText(/BM01 là tệp PDF riêng do sinh viên tải lên/i)).toBeInTheDocument();
        await waitFor(() => {
            expect(document.querySelector('#bm01-print-sheet')).toBeNull();
        });
    });
});
