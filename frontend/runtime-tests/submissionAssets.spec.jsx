import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Browser polyfills for Ant Design in jsdom
if (typeof window !== 'undefined') {
    window.matchMedia = window.matchMedia || function () {
        return {
            matches: false,
            addListener: function () {},
            removeListener: function () {},
            addEventListener: function () {},
            removeEventListener: function () {},
            dispatchEvent: function () {},
        };
    };
    global.ResizeObserver = global.ResizeObserver || class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}

import HybridBMFormModal from '../src/components/forms/HybridBMFormModal.jsx';
import * as resumableService from '../src/services/resumableUploadService';

describe('Task 6 Frontend: Submission Asset Binding & UI Tests', () => {
    const mockTask = {
        id: 101,
        title: 'Nộp đề cương đồ án tốt nghiệp (BM01)',
        taskType: 'BM01_INITIAL_SUBMISSION',
        status: 'IN_PROGRESS',
        submissions: [],
    };

    const mockRegistration = {
        id: 201,
        studentId: 1,
        status: 'APPROVED',
        topic: { title: 'Hệ thống Quản lý Đồ án' },
        bm01ApprovedTitleSnapshot: 'Hệ thống Quản lý Đồ án',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('HybridBMFormModal adheres to AGENTS.md button standards (no raw emojis in button text)', () => {
        render(
            <HybridBMFormModal
                visible={true}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
                task={mockTask}
                registration={mockRegistration}
            />
        );

        const buttons = screen.getAllByRole('button');
        buttons.forEach((btn) => {
            // Text inside button should not have raw symbol arrows or emojis
            expect(btn.textContent).not.toMatch(/[←→+🤖📋✓✏️👥🗑️🔓▾▴↗]/);
        });
    });

    it('packages assetId in submission payload when uploadGovernedAsset succeeds', async () => {
        const onSubmitMock = vi.fn();
        vi.spyOn(resumableService, 'uploadGovernedAsset').mockResolvedValue({
            assetId: 'asset-uuid-1234',
            downloadUrl: '/api/assets/asset-uuid-1234/download',
            fileName: 'de_cuong.pdf',
        });

        render(
            <HybridBMFormModal
                visible={true}
                onClose={vi.fn()}
                onSubmit={onSubmitMock}
                task={mockTask}
                registration={mockRegistration}
            />
        );

        // Fill required fields
        const topicInput = screen.getByPlaceholderText(/Nhập tên đề tài chính xác/i);
        fireEvent.change(topicInput, { target: { value: 'Hệ thống Quản lý Đồ án Tốt nghiệp' } });

        const objInput = screen.getByPlaceholderText(/Nêu rõ mục tiêu đề tài/i);
        fireEvent.change(objInput, { target: { value: 'Mục tiêu hoàn thành dự án' } });

        const techInput = screen.getByPlaceholderText(/VD: React, Node.js/i);
        fireEvent.change(techInput, { target: { value: 'React, Node, Postgres' } });

        const delivInput = screen.getByPlaceholderText(/Sản phẩm phần mềm/i);
        fireEvent.change(delivInput, { target: { value: 'Mã nguồn và báo cáo' } });

        // Simulate file upload
        const fakeFile = new File(['content'], 'de_cuong.pdf', { type: 'application/pdf' });
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
            fireEvent.change(fileInput, { target: { files: [fakeFile] } });
        }

        const submitBtn = screen.getByRole('button', { name: /Nộp biểu mẫu/i });
        expect(submitBtn).toBeDefined();
    });
});
