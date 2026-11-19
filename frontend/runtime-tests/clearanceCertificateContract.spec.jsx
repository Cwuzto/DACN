import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ConfigProvider } from 'antd';
import ClearanceCertificateModal from '../src/components/forms/ClearanceCertificateModal.jsx';

describe('ClearanceCertificateModal Contract', () => {
    beforeEach(() => {
        vi.stubGlobal('matchMedia', vi.fn(() => ({
            matches: false,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
        })));
    });

    const mockCertData = {
        certificateNumber: 'XNHT-20261119-101',
        verificationHash: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
        issueDate: '2026-11-19T08:00:00.000Z',
        pdfUrl: 'https://storage.example.com/certs/cert-101.pdf',
        effectiveTopicTitle: 'Hệ thống Quản lý Đồ án Tốt nghiệp Thông minh',
        student: {
            fullName: 'Nguyễn Văn Sinh Viên',
            code: '21000001',
            department: 'Khoa Công Nghệ Thông Tin',
        },
        topic: {
            title: 'Hệ thống Quản lý Đề tài Cũ',
            effectiveTopicTitle: 'Hệ thống Quản lý Đồ án Tốt nghiệp Thông minh',
            courseName: 'Khóa luận tốt nghiệp',
            academicYear: '2025 - 2026',
        },
        mentor: {
            fullName: 'TS. Nguyễn Văn Hướng Dẫn',
            academicTitle: 'Tiến sĩ',
        },
        council: {
            name: 'Hội đồng Chuyên môn Kỹ thuật phần mềm 01',
        },
        evaluation: {
            finalScore: 9.2,
            roundedFinalScore: 9.2,
            letterGrade: 'A',
            rankingText: 'Xuất sắc / Giỏi',
        },
        archive: {
            reviewerName: 'TS. Nguyễn Văn Hướng Dẫn',
        },
        instituteDirectorName: 'PGS. TS. Trần Viện Trưởng',
        instituteSignedAt: '2026-11-19T10:00:00.000Z',
    };

    test('renders effective topic title rather than stale topic title', () => {
        render(
            <ConfigProvider theme={{ token: { motion: false } }}>
                <ClearanceCertificateModal open certificate={mockCertData} />
            </ConfigProvider>
        );

        expect(screen.getByText('Hệ thống Quản lý Đồ án Tốt nghiệp Thông minh')).toBeInTheDocument();
        expect(screen.queryByText('Hệ thống Quản lý Đề tài Cũ')).not.toBeInTheDocument();
    });

    test('displays verification hash and certificate number', () => {
        render(
            <ConfigProvider theme={{ token: { motion: false } }}>
                <ClearanceCertificateModal open certificate={mockCertData} />
            </ConfigProvider>
        );

        expect(screen.getAllByText(/XNHT-20261119-101/)[0]).toBeInTheDocument();
        expect(screen.getByText(/9A8B7C6D5E4F3A2B/)).toBeInTheDocument();
    });

    test('displays Institute Director digital signature and student score', () => {
        render(
            <ConfigProvider theme={{ token: { motion: false } }}>
                <ClearanceCertificateModal open certificate={mockCertData} />
            </ConfigProvider>
        );

        expect(screen.getByText('VIỆN TRƯỞNG VIỆN CÔNG NGHỆ SỐ')).toBeInTheDocument();
        expect(screen.getByText('ĐÃ KÝ SỐ XÁC NHẬN')).toBeInTheDocument();
        expect(screen.getByText('PGS. TS. Trần Viện Trưởng')).toBeInTheDocument();
        expect(screen.getByText(/9\.2 \/ 10/)).toBeInTheDocument();
    });

    test('provides PDF download button when pdfUrl exists', () => {
        render(
            <ConfigProvider theme={{ token: { motion: false } }}>
                <ClearanceCertificateModal open certificate={mockCertData} />
            </ConfigProvider>
        );

        expect(screen.getByRole('button', { name: /Tải Giấy xác nhận PDF/ })).toBeInTheDocument();
    });
});
