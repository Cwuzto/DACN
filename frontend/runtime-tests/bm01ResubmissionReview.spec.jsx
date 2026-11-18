import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import useAuthStore from '../src/stores/authStore.js';
import registrationService from '../src/services/registrationService.js';
import outlineService from '../src/services/outlineService.js';
import api from '../src/services/api.js';
import TopicApprovalPage from '../src/pages/lecturer/TopicApprovalPage.jsx';
import OutlineReviewModal from '../src/components/lecturer/OutlineReviewModal.jsx';

describe('BM01 Resubmission and Unified Review (Fix P0.6)', () => {
    let client;

    const mockResubmittedRegistration = {
        id: 101,
        status: 'BM01_RESUBMITTED',
        topic: { id: 50, title: 'Hệ thống Quản lý Thực tập AI' },
        student: { id: 12, fullName: 'Trần Văn B', code: 'SV001', studentProfile: { className: 'CNTT-K15' } },
        bm01Submissions: [
            {
                id: 'sub-v2',
                attemptNo: 2,
                fileName: 'de_cuong_v2.pdf',
                fileUrl: '/api/assets/asset-v2/download',
                submittedAt: '2026-11-19T01:00:00.000Z',
            },
            {
                id: 'sub-v1',
                attemptNo: 1,
                fileName: 'de_cuong_v1.pdf',
                fileUrl: '/api/assets/asset-v1/download',
                submittedAt: '2026-11-18T01:00:00.000Z',
            },
        ],
    };

    const mockInitialRegistration = {
        id: 102,
        status: 'BM01_SUBMITTED',
        topic: { id: 51, title: 'Ứng dụng Blockchain trong Logistics' },
        student: { id: 13, fullName: 'Nguyễn Thị C', code: 'SV002', studentProfile: { className: 'CNTT-K15' } },
        bm01Submissions: [
            {
                id: 'sub-v1-only',
                attemptNo: 1,
                fileName: 'de_cuong_initial.pdf',
                fileUrl: '/api/assets/asset-v1-only/download',
                submittedAt: '2026-11-18T05:00:00.000Z',
            },
        ],
    };

    beforeEach(() => {
        vi.stubGlobal('matchMedia', vi.fn(() => ({
            matches: false,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
        })));
        vi.stubGlobal('ResizeObserver', class {
            observe() {}
            unobserve() {}
            disconnect() {}
        });

        client = createAppQueryClient();
        client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });

        useAuthStore.setState({
            isAuthenticated: true,
            user: {
                id: 30,
                role: 'LECTURER',
                fullName: 'TS. Phan Chủ Tịch',
                permissions: ['OUTLINE_REVIEW', 'VIEW_OUTLINE_REVIEWS'],
            },
        });
    });

    afterEach(() => {
        cleanup();
        client.clear();
        useAuthStore.setState({ user: null, isAuthenticated: false });
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe('TopicApprovalPage Outline Tab', () => {
        it('recognizes both BM01_SUBMITTED and BM01_RESUBMITTED as pending outline reviews', async () => {
            vi.spyOn(registrationService, 'getAllRegistrations').mockImplementation(async (params) => {
                if (params?.asCouncilChairman === 'true') {
                    return {
                        success: true,
                        data: [mockResubmittedRegistration, mockInitialRegistration],
                    };
                }
                return { success: true, data: [] };
            });

            render(
                <ConfigProvider theme={{ token: { motion: false } }}>
                    <AppQueryProvider client={client}>
                        <MemoryRouter initialEntries={['/lecturer/approvals?tab=bm01']}>
                            <Routes>
                                <Route path="/lecturer/approvals" element={<TopicApprovalPage />} />
                            </Routes>
                        </MemoryRouter>
                    </AppQueryProvider>
                </ConfigProvider>
            );

            await waitFor(() => {
                expect(screen.getByText(/Hệ thống Quản lý Thực tập AI/i)).toBeInTheDocument();
                expect(screen.getByText(/Ứng dụng Blockchain trong Logistics/i)).toBeInTheDocument();
            });

            // Both registrations should display "Chờ thẩm định"
            const pendingTags = screen.getAllByText('Chờ thẩm định');
            expect(pendingTags.length).toBe(2);

            // Both should have "Thẩm định đề cương" button
            const reviewButtons = screen.getAllByRole('button', { name: /Thẩm định đề cương/i });
            expect(reviewButtons.length).toBe(2);
        });
    });

    describe('OutlineReviewModal', () => {
        it('renders FAIL option and allows reviewing BM01_RESUBMITTED with FAIL decision', async () => {
            const reviewSpy = vi.spyOn(registrationService, 'reviewOutlineTopic').mockResolvedValue({
                success: true,
                message: 'Đã ghi nhận kết quả KHÔNG ĐẠT. Đề tài chuyển sang trạng thái dừng.',
            });
            const onSuccess = vi.fn();
            const onClose = vi.fn();

            render(
                <ConfigProvider theme={{ token: { motion: false } }}>
                    <AppQueryProvider client={client}>
                        <OutlineReviewModal
                            open={true}
                            onClose={onClose}
                            onSuccess={onSuccess}
                            registration={mockResubmittedRegistration}
                        />
                    </AppQueryProvider>
                </ConfigProvider>
            );

            // Verify radio options are present
            expect(screen.getByText(/ĐẠT — Thông qua Đề cương/i)).toBeInTheDocument();
            expect(screen.getByText(/CẦN CHỈNH SỬA — Yêu Cầu Chỉnh Sửa Đề Cương/i)).toBeInTheDocument();
            expect(screen.getByText(/KHÔNG ĐẠT — Dừng đề tài/i)).toBeInTheDocument();

            // Select FAIL radio option
            const failRadio = screen.getByLabelText(/KHÔNG ĐẠT — Dừng đề tài/i);
            fireEvent.click(failRadio);

            // Fill required feedback for FAIL
            const feedbackInput = screen.getByPlaceholderText(/Nêu rõ lý do không đạt yêu cầu nghiên cứu/i);
            fireEvent.change(feedbackInput, { target: { value: 'Đề cương v2 vẫn chưa giải quyết được bài toán lý thuyết cốt lõi' } });

            // Click submit button to trigger popconfirm
            const confirmBtn = screen.getByRole('button', { name: /Gửi yêu cầu chỉnh sửa/i });
            fireEvent.click(confirmBtn);

            // Confirm in Popconfirm dialog ("Đồng ý")
            const okBtn = await screen.findByRole('button', { name: 'Đồng ý' });
            fireEvent.click(okBtn);

            await waitFor(() => {
                expect(reviewSpy).toHaveBeenCalledWith(
                    101,
                    expect.objectContaining({
                        status: 'FAIL',
                        decision: 'FAIL',
                        outcome: 'FAIL',
                        feedback: 'Đề cương v2 vẫn chưa giải quyết được bài toán lý thuyết cốt lõi',
                    })
                );
                expect(onSuccess).toHaveBeenCalled();
                expect(onClose).toHaveBeenCalled();
            });
        });

        it('submits PASSED decision for v2 resubmission', async () => {
            const reviewSpy = vi.spyOn(registrationService, 'reviewOutlineTopic').mockResolvedValue({
                success: true,
                message: 'Đã duyệt ĐẠT đề cương!',
            });
            const onSuccess = vi.fn();

            render(
                <ConfigProvider theme={{ token: { motion: false } }}>
                    <AppQueryProvider client={client}>
                        <OutlineReviewModal
                            open={true}
                            onClose={vi.fn()}
                            onSuccess={onSuccess}
                            registration={mockResubmittedRegistration}
                        />
                    </AppQueryProvider>
                </ConfigProvider>
            );

            // Default selection is PASSED
            const passRadio = screen.getByLabelText(/ĐẠT — Thông qua Đề cương/i);
            expect(passRadio).toBeChecked();

            // Click submit button
            const confirmBtn = screen.getByRole('button', { name: /Xác nhận duyệt Đạt/i });
            fireEvent.click(confirmBtn);

            // Confirm in Popconfirm
            const okBtn = await screen.findByRole('button', { name: 'Đồng ý' });
            fireEvent.click(okBtn);

            await waitFor(() => {
                expect(reviewSpy).toHaveBeenCalledWith(
                    101,
                    expect.objectContaining({
                        status: 'PASSED',
                        decision: 'PASSED',
                    })
                );
                expect(onSuccess).toHaveBeenCalled();
            });
        });
    });

    describe('outlineService.reviewOutline', () => {
        it('calls /outline/reviews/:registrationId with POST and Idempotency-Key', async () => {
            const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
                success: true,
                data: { status: 'BM01_PASSED' },
            });

            await outlineService.reviewOutline(101, { status: 'PASSED', feedback: 'Tốt' }, 'custom-review-key-99');

            expect(postSpy).toHaveBeenCalledWith(
                '/outline/reviews/101',
                { status: 'PASSED', feedback: 'Tốt' },
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Idempotency-Key': 'custom-review-key-99',
                    }),
                })
            );
        });
    });
});
