import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import HybridBMFormModal from '../src/components/forms/HybridBMFormModal.jsx';
import * as resumableService from '../src/services/resumableUploadService';
import uploadService from '../src/services/uploadService';

describe('BM01 PDF-only policy & pre-submit preview', () => {
    const mockTask = {
        id: 101,
        title: 'Nộp đề cương đồ án tốt nghiệp (BM01)',
        taskType: 'BM01_INITIAL_SUBMISSION',
        status: 'OPEN',
        submissions: [],
    };

    const mockRegistration = {
        id: 201,
        studentId: 1,
        status: 'APPROVED',
        topic: { title: 'Hệ thống Quản lý Đồ án' },
    };

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
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/bm01-preview-1');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('accepts only .pdf files, rejects .docx and >20MB files, and previews selected PDF before submit', async () => {
        const uploadSpy = vi.spyOn(resumableService, 'uploadGovernedAsset').mockResolvedValue({
            assetId: 'asset-bm01-1',
            downloadUrl: '/api/assets/asset-bm01-1/download',
        });
        vi.spyOn(uploadService, 'uploadFile').mockResolvedValue({ success: false });

        const { unmount } = render(
            <ConfigProvider theme={{ token: { motion: false } }}>
                <HybridBMFormModal
                    visible={true}
                    onClose={vi.fn()}
                    onSubmit={vi.fn()}
                    task={mockTask}
                    registration={mockRegistration}
                />
            </ConfigProvider>
        );

        const fileInput = document.querySelector('input[type="file"]');
        expect(fileInput).not.toBeNull();
        expect(fileInput.getAttribute('accept')).toBe('.pdf,application/pdf');
        expect(screen.getByText(/Chỉ nhận PDF \(tối đa 20MB\)/i)).toBeInTheDocument();

        const submitBtn = screen.getByRole('button', { name: /Xác nhận và nộp BM01/i });
        expect(submitBtn).toBeInTheDocument();

        // Reject .docx file
        const docxFile = new File(['word-bytes'], 'de_cuong.docx', {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [docxFile] } });
        await waitFor(() => {
            expect(uploadSpy).not.toHaveBeenCalled();
        });

        // Reject >20MB PDF
        const bigPdf = new File(['x'], 'too_big.pdf', { type: 'application/pdf' });
        Object.defineProperty(bigPdf, 'size', { value: 21 * 1024 * 1024 });
        fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [bigPdf] } });
        await waitFor(() => {
            expect(uploadSpy).not.toHaveBeenCalled();
        });

        // Accept valid PDF and show preview iframe
        const validPdf = new File(['%PDF-1.7'], 'de_cuong_v1.pdf', { type: 'application/pdf' });
        fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [validPdf] } });

        await waitFor(() => {
            expect(uploadSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    documentType: 'BM01',
                })
            );
        });

        const iframe = await screen.findByTitle(/Xem trước PDF BM01/i);
        expect(iframe).toHaveAttribute('src', 'blob:http://localhost/bm01-preview-1');

        // Button text compliance (no raw emojis/symbols)
        screen.getAllByRole('button').forEach((btn) => {
            expect(btn.textContent).not.toMatch(/[←→+🤖📋✓✏️👥🗑️🔓▾▴↗]/);
        });

        unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/bm01-preview-1');
    });
});
