import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { ConfigProvider } from 'antd';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import DecisionQueue from '../src/components/institute/DecisionQueue.jsx';
import ReviewQueue from '../src/components/institute/ReviewQueue.jsx';
import BM02APrintSheet from '../src/components/prints/BM02APrintSheet.jsx';
import bm02aService from '../src/services/bm02aService.js';
import registrationService from '../src/services/registrationService.js';
import useAuthStore from '../src/stores/authStore.js';

describe('BM02-A and BM02 Review UI Contracts (Task 3 Remediation)', () => {
    let client;

    beforeEach(() => {
        vi.stubGlobal(
            'ResizeObserver',
            class ResizeObserver {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        );
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

        useAuthStore.setState({
            user: {
                id: 1,
                role: 'ADMIN',
                permissions: [
                    'BM02_REVIEW',
                    'BM02A_FINAL_APPROVE',
                    'TITLE_ADJUSTMENT_APPENDIX_ISSUE',
                    'PROJECT_ASSIGNMENT_PUBLISH',
                ],
                permissionGroups: ['VIEN_TRUONG'],
            },
        });

        client = createAppQueryClient();
        client.setDefaultOptions({
            queries: { retry: false, staleTime: 0 },
            mutations: { retry: false },
        });
    });

    afterEach(() => {
        client.clear();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('DecisionQueue passes correct payload { decisionId, appendixNumber, bm02aRequestIds, signedDate } to createAppendix', async () => {
        const createAppendixSpy = vi.spyOn(bm02aService, 'createAppendix').mockResolvedValue({ success: true, data: { id: 99 } });

        const items = [
            {
                id: 'bm02a-request-10',
                kind: 'TITLE_ADJUSTMENT_APPENDIX',
                resourceId: 10,
                decisionId: 100,
                registrationId: 50,
                title: 'Điều chỉnh tên đề tài BM02-A: Nguyễn Văn A',
                subtitle: 'Đề tài Nghiên cứu IoT',
                status: 'APPROVED_PENDING_APPENDIX',
                allowedActions: ['CREATE_APPENDIX_DRAFT'],
            },
        ];

        render(
            <ConfigProvider>
                <AppQueryProvider client={client}>
                    <DecisionQueue
                        scope={['admin']}
                        semesterId={1}
                        items={items}
                        loading={false}
                    />
                </AppQueryProvider>
            </ConfigProvider>
        );

        const createButton = screen.getByRole('button', { name: /Tạo dự thảo phụ lục/i });
        await userEvent.click(createButton);

        // Popconfirm confirm button
        const confirmButton = await screen.findByRole('button', { name: 'Tạo dự thảo' });
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(createAppendixSpy).toHaveBeenCalled();
        });

        const callPayload = createAppendixSpy.mock.calls[0][0];
        expect(callPayload).toMatchObject({
            decisionId: 100,
            bm02aRequestIds: [10],
        });
        expect(callPayload.appendixNumber).toBeDefined();
        expect(typeof callPayload.appendixNumber).toBe('string');
        expect(callPayload.signedDate).toBeDefined();
    });

    it('DecisionQueue passes signedDate to issueAppendix when issuing appendix', async () => {
        const issueAppendixSpy = vi.spyOn(bm02aService, 'issueAppendix').mockResolvedValue({ success: true, data: { id: 88, status: 'ISSUED' } });

        const items = [
            {
                id: 'title-appendix-88',
                kind: 'TITLE_ADJUSTMENT_APPENDIX',
                resourceId: 88,
                title: 'Ban hành Phụ lục điều chỉnh tên đề tài: PL-2026-001',
                subtitle: '1 hồ sơ điều chỉnh',
                status: 'DRAFT',
                allowedActions: ['ISSUE_APPENDIX'],
            },
        ];

        render(
            <ConfigProvider>
                <AppQueryProvider client={client}>
                    <DecisionQueue
                        scope={['admin']}
                        semesterId={1}
                        items={items}
                        loading={false}
                    />
                </AppQueryProvider>
            </ConfigProvider>
        );

        const issueButton = screen.getByRole('button', { name: /Ban hành phụ lục/i });
        await userEvent.click(issueButton);

        const confirmButton = await screen.findByRole('button', { name: 'Ban hành' });
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(issueAppendixSpy).toHaveBeenCalled();
        });

        const [appendixId, payload] = issueAppendixSpy.mock.calls[0];
        expect(appendixId).toBe(88);
        expect(payload).toHaveProperty('signedDate');
    });

    it('ReviewQueue fetches real registration details via registrationService.getRegistrationById', async () => {
        const mockRegistration = {
            id: 77,
            status: 'BM02_SUBMITTED',
            student: {
                id: 15,
                fullName: 'Nguyễn Văn Học Vụ',
                code: 'SV77001',
            },
            topic: {
                id: 44,
                title: 'Hệ thống Quản lý Đồ án Tốt nghiệp Thực tế',
                mentorId: 1,
                mentor: {
                    id: 1,
                    fullName: 'ThS. Giảng Viên Hướng Dẫn',
                    department: 'Kỹ thuật phần mềm',
                },
            },
            currentBM02Submission: {
                id: 301,
                attemptNo: 1,
                versionNo: 1,
                outcome: 'PENDING_REVIEW',
            },
        };

        const getRegistrationByIdSpy = vi.spyOn(registrationService, 'getRegistrationById').mockResolvedValue({
            success: true,
            data: mockRegistration,
        });

        const items = [
            {
                id: 'bm02-77',
                kind: 'BM02_REVIEW',
                resourceId: 301,
                registrationId: 77,
                title: 'BM02: Nguyễn Văn Học Vụ',
                subtitle: 'Hệ thống Quản lý Đồ án Tốt nghiệp Thực tế',
                status: 'BM02_SUBMITTED',
                allowedActions: ['APPROVE_BM02', 'REVIEW_BM02'],
            },
        ];

        render(
            <ConfigProvider>
                <AppQueryProvider client={client}>
                    <ReviewQueue
                        scope={['admin']}
                        semesterId={1}
                        items={items}
                        loading={false}
                    />
                </AppQueryProvider>
            </ConfigProvider>
        );

        const reviewButton = screen.getByRole('button', { name: /Thẩm định/i });
        await userEvent.click(reviewButton);

        await waitFor(() => {
            expect(getRegistrationByIdSpy).toHaveBeenCalledWith(77);
        });

        // Verify that real student info appears in Drawer
        expect(await screen.findByText('Nguyễn Văn Học Vụ')).toBeInTheDocument();
        expect(screen.getByText('(SV77001)')).toBeInTheDocument();
    });

    it('BM02APrintSheet supports both adjustment and request props and reads versions schema', () => {
        const mockAdjustment = {
            id: 5,
            registrationId: 77,
            status: 'APPROVED_PENDING_APPENDIX',
            versions: [
                {
                    versionNumber: 1,
                    registeredTitleSnapshot: 'Tên Đề Tài Cũ Đã Đăng Ký',
                    proposedTitle: 'Tên Đề Tài Mới Đã Được Bộ Môn Duyệt',
                    reason: 'Bổ sung thêm phân hệ AI và Blockchain',
                    studentSignatureEventId: 101,
                    advisorSignatureEventId: 102,
                    departmentSignatureEventId: 103,
                },
            ],
            registration: {
                student: {
                    fullName: 'Trần Thị Học Viên',
                    code: 'HV99001',
                    studentProfile: {
                        className: 'D20CNTT01',
                        major: 'Công nghệ thông tin',
                    },
                },
                topic: {
                    mentor: {
                        fullName: 'PGS. TS. Trần Hướng Dẫn',
                    },
                },
            },
        };

        const { container } = render(
            <BM02APrintSheet adjustment={mockAdjustment} />
        );

        expect(container).toHaveTextContent('Tên Đề Tài Cũ Đã Đăng Ký');
        expect(container).toHaveTextContent('Tên Đề Tài Mới Đã Được Bộ Môn Duyệt');
        expect(container).toHaveTextContent('Bổ sung thêm phân hệ AI và Blockchain');
        expect(container).toHaveTextContent('Trần Thị Học Viên');
        expect(container).toHaveTextContent('HV99001');
    });
});
