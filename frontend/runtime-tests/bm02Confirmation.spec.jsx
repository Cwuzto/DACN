import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import HybridBMFormModal from '../src/components/forms/HybridBMFormModal.jsx';
import BM02PrintSheet from '../src/components/prints/BM02PrintSheet.jsx';
import registrationService from '../src/services/registrationService.js';
import api from '../src/services/api.js';

describe('BM02 Student Online Submission & Verification', () => {
    const mockBM02Task = {
        id: 202,
        title: 'Nộp đơn đăng ký đề tài chính thức (BM02)',
        taskType: 'BM02',
        status: 'OPEN',
        submissions: [],
    };

    const mockRegistration = {
        id: 305,
        status: 'BM01_PASSED',
        bm01ApprovedTitleSnapshot: 'Hệ thống Quản lý Khóa luận',
        topic: { title: 'Hệ thống Quản lý Khóa luận', mentor: { fullName: 'TS. Nguyễn Văn C' } },
        student: { fullName: 'Lê Thị D', code: '2224802010999' },
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
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('renders BM02 online form without scan upload, enforces titleChangeReason when title changes, and submits online', async () => {
        const onSubmit = vi.fn();

        render(
            <ConfigProvider theme={{ token: { motion: false } }}>
                <HybridBMFormModal
                    visible={true}
                    onClose={vi.fn()}
                    onSubmit={onSubmit}
                    task={mockBM02Task}
                    registration={mockRegistration}
                />
            </ConfigProvider>
        );

        // No file upload input for BM02
        expect(document.querySelector('input[type="file"]')).toBeNull();
        expect(screen.getByText(/Không cần tải lên bản scan có chữ ký tay/i)).toBeInTheDocument();

        const submitBtn = screen.getByRole('button', { name: /Xác nhận và nộp BM02/i });
        expect(submitBtn).toBeInTheDocument();

        // Button standards check
        screen.getAllByRole('button').forEach((btn) => {
            expect(btn.textContent).not.toMatch(/[←→+🤖📋✓✏️👥🗑️🔓▾▴↗]/);
        });

        // Change proposed title without reason -> validation blocks submit
        fireEvent.change(screen.getByPlaceholderText(/Cập nhật cách diễn đạt tên đề tài/i), {
            target: { value: 'Hệ thống Quản lý Khóa luận Tốt nghiệp' },
        });
        fireEvent.change(screen.getByPlaceholderText(/Liệt kê các nhiệm vụ nghiên cứu/i), {
            target: { value: 'Phân tích, thiết kế, cài đặt và kiểm thử' },
        });
        fireEvent.change(screen.getByPlaceholderText(/Giai đoạn 1: Thiết kế/i), {
            target: { value: 'Tuần 1-4 thiết kế, tuần 5-12 lập trình' },
        });

        fireEvent.click(submitBtn);

        expect(await screen.findByText(/Lý do điều chỉnh tên đề tài là bắt buộc/i)).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();

        // Provide titleChangeReason -> submits cleanly without fileData
        fireEvent.change(screen.getByPlaceholderText(/Bắt buộc khi tên đề xuất khác/i), {
            target: { value: 'Làm rõ phạm vi khóa luận theo góp ý Hội đồng' },
        });

        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledTimes(1);
        });

        const payload = onSubmit.mock.calls[0][0];
        expect(payload.registrationId).toBe(305);
        expect(payload.fileUrl).toBeNull();
        expect(payload.assetId).toBeNull();
        expect(payload.bm02ProposedTitle).toBe('Hệ thống Quản lý Khóa luận Tốt nghiệp');
        expect(payload.titleChangeReason).toBe('Làm rõ phạm vi khóa luận theo góp ý Hội đồng');
    });

    it('registrationService.getBM02Verification normalizes verification DTO for BM02PrintSheet', async () => {
        vi.spyOn(api, 'get').mockResolvedValue({
            success: true,
            data: {
                versionNo: 1,
                payloadHash: 'hash-123',
                student: { signed: true, valid: true, signer: { fullName: 'Lê Thị D' }, signedAt: '2026-11-18T08:00:00Z' },
                advisor: { signed: true, valid: true, signer: { fullName: 'TS. Nguyễn Văn C' }, signedAt: '2026-11-18T09:00:00Z' },
                department: { signed: false, valid: false, status: 'NOT_SIGNED', signer: null, signedAt: null },
            },
        });

        const res = await registrationService.getBM02Verification(901);
        expect(api.get).toHaveBeenCalledWith('/bm02/applications/901/verification');
        expect(res.data.student.verified).toBe(true);
        expect(res.data.mentor.verified).toBe(true);
        expect(res.data.departmentHead.verified).toBe(false);

        const { container } = render(
            <BM02PrintSheet
                registration={mockRegistration}
                submission={{ id: 901, versionNo: 1, title: 'Hệ thống Quản lý Khóa luận' }}
                verification={res.data}
            />
        );

        expect(container.textContent).toContain('Đã xác thực nội bộ');
        expect(container.textContent).toContain('Lê Thị D');
        expect(container.textContent).toContain('TS. Nguyễn Văn C');
        expect(container.textContent).toContain('Chờ xác nhận');
    });
});
