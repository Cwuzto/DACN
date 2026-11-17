import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import HybridBMFormModal from '../src/components/forms/HybridBMFormModal.jsx';
import outlineService from '../src/services/outlineService.js';
import api from '../src/services/api.js';
import * as resumableService from '../src/services/resumableUploadService';

describe('BM01 submit persists content JSON and assetId', () => {
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
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/bm01-submit-1');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('outlineService sends content, fileData.assetId, and Idempotency-Key for v1 and v2', async () => {
        const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ success: true, data: { id: 1 } });

        await outlineService.submitInitialOutline({
            registrationId: 55,
            fileData: { assetId: 'asset-v1', fileUrl: '/api/assets/asset-v1/download', fileName: 'v1.pdf' },
            content: JSON.stringify({ formCode: 'BM01', taskType: 'BM01_INITIAL_SUBMISSION', fields: { topicTitle: 'A' } }),
            idempotencyKey: 'idem-bm01-v1-key',
        });

        expect(postSpy).toHaveBeenCalledWith(
            '/outline/submissions',
            {
                registrationId: 55,
                fileData: { assetId: 'asset-v1', fileUrl: '/api/assets/asset-v1/download', fileName: 'v1.pdf' },
                content: JSON.stringify({ formCode: 'BM01', taskType: 'BM01_INITIAL_SUBMISSION', fields: { topicTitle: 'A' } }),
            },
            { headers: { 'Idempotency-Key': 'idem-bm01-v1-key' } }
        );

        await outlineService.submitResubmission({
            registrationId: 55,
            fileData: { assetId: 'asset-v2', fileUrl: '/api/assets/asset-v2/download', fileName: 'v2.pdf' },
            content: JSON.stringify({ formCode: 'BM01', taskType: 'BM01_RESUBMISSION', fields: { topicTitle: 'A', revisionSummary: 'Fixed' } }),
            idempotencyKey: 'idem-bm01-v2-key',
        });

        expect(postSpy).toHaveBeenCalledWith(
            '/outline/resubmissions',
            {
                registrationId: 55,
                fileData: { assetId: 'asset-v2', fileUrl: '/api/assets/asset-v2/download', fileName: 'v2.pdf' },
                content: JSON.stringify({ formCode: 'BM01', taskType: 'BM01_RESUBMISSION', fields: { topicTitle: 'A', revisionSummary: 'Fixed' } }),
            },
            { headers: { 'Idempotency-Key': 'idem-bm01-v2-key' } }
        );
    });

    it('HybridBMFormModal packages structured BM01 fields and uploaded assetId on submit', async () => {
        const onSubmit = vi.fn();
        vi.spyOn(resumableService, 'uploadGovernedAsset').mockResolvedValue({
            assetId: 'asset-uuid-bm01',
            downloadUrl: '/api/assets/asset-uuid-bm01/download',
        });

        render(
            <ConfigProvider theme={{ token: { motion: false } }}>
                <HybridBMFormModal
                    visible={true}
                    onClose={vi.fn()}
                    onSubmit={onSubmit}
                    task={{ id: 101, taskType: 'BM01_INITIAL_SUBMISSION', status: 'OPEN', submissions: [] }}
                    registration={{ id: 201, status: 'APPROVED', topic: { title: 'Đề tài AI' } }}
                />
            </ConfigProvider>
        );

        fireEvent.change(screen.getByPlaceholderText(/Nhập tên đề tài chính xác/i), {
            target: { value: 'Hệ thống AI hỗ trợ học tập' },
        });
        fireEvent.change(screen.getByPlaceholderText(/Nêu rõ mục tiêu đề tài/i), {
            target: { value: 'Xây dựng hệ thống gợi ý học tập' },
        });
        fireEvent.change(screen.getByPlaceholderText(/VD: React, Node.js/i), {
            target: { value: 'React, Node.js, PostgreSQL' },
        });
        fireEvent.change(screen.getByPlaceholderText(/Sản phẩm phần mềm/i), {
            target: { value: 'Ứng dụng web và báo cáo' },
        });

        const fileInput = document.querySelector('input[type="file"]');
        const pdfFile = new File(['%PDF-1.7'], 'bm01_v1.pdf', { type: 'application/pdf' });
        fireEvent.change(fileInput, { target: { files: [pdfFile] } });

        await screen.findByText('bm01_v1.pdf');

        fireEvent.click(screen.getByRole('button', { name: /Xác nhận và nộp BM01/i }));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledTimes(1);
        });

        const payload = onSubmit.mock.calls[0][0];
        expect(payload.assetId).toBe('asset-uuid-bm01');
        expect(payload.fileName).toBe('bm01_v1.pdf');
        const parsed = JSON.parse(payload.content);
        expect(parsed.formCode).toBe('BM01');
        expect(parsed.taskType).toBe('BM01_INITIAL_SUBMISSION');
        expect(parsed.fields).toEqual({
            topicTitle: 'Hệ thống AI hỗ trợ học tập',
            objectives: 'Xây dựng hệ thống gợi ý học tập',
            technologies: 'React, Node.js, PostgreSQL',
            deliverables: 'Ứng dụng web và báo cáo',
        });
    });
});
