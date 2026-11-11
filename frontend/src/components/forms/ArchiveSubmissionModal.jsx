import React, { useState, useEffect, useCallback } from 'react';
import {
    Modal,
    Form,
    Input,
    Button,
    Upload,
    Alert,
    Typography,
    Space,
    Flex,
    Tag,
    Divider,
    Table,
    Tooltip,
    message,
    Spin,
} from 'antd';
import {
    CloudUploadOutlined,
    FilePdfOutlined,
    FileWordOutlined,
    FilePptOutlined,
    VideoCameraOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    LockOutlined,
    ExclamationCircleOutlined,
    DownloadOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import uploadService from '../../services/uploadService';
import archiveService from '../../services/archiveService';

const { Text, Title, Paragraph } = Typography;

const DOCUMENT_TYPES = [
    {
        key: 'REPORT_WORD',
        title: 'Báo cáo toàn văn (Word)',
        ext: '.doc,.docx',
        accept: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        icon: <FileWordOutlined className="text-blue-600 text-xl" />,
        desc: 'Định dạng .docx theo quy chuẩn biểu mẫu học vụ Viện.',
    },
    {
        key: 'REPORT_PDF',
        title: 'Báo cáo toàn văn (PDF)',
        ext: '.pdf',
        accept: '.pdf,application/pdf',
        icon: <FilePdfOutlined className="text-rose-600 text-xl" />,
        desc: 'Định dạng .pdf dùng lưu chiểu và kiểm tra Turnitin.',
    },
    {
        key: 'DEMO_VIDEO',
        title: 'Video Demo Sản phẩm',
        ext: '.mp4,.webm',
        accept: '.mp4,.webm,video/mp4,video/webm',
        icon: <VideoCameraOutlined className="text-purple-600 text-xl" />,
        desc: 'Video ghi hình vận hành hệ thống thực tế (tối đa 15 phút).',
    },
    {
        key: 'SLIDE_PPTX',
        title: 'Slide Báo cáo (PPTX / PDF)',
        ext: '.pptx,.ppt,.pdf',
        accept: '.pptx,.ppt,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation',
        icon: <FilePptOutlined className="text-amber-600 text-xl" />,
        desc: 'Slide trình chiếu bảo vệ trước Hội đồng chuyên môn.',
    },
];

export default function ArchiveSubmissionModal({
    visible,
    open: openProp,
    onClose,
    onCancel,
    registration,
    registrationId,
    initialArchive = null,
    onSuccess,
}) {
    const isOpen = openProp !== undefined ? openProp : visible;
    const handleClose = onClose || onCancel;
    const regId = registration?.id || registrationId;

    const [loading, setLoading] = useState(false);
    const [dossier, setDossier] = useState(null);
    const [uploadingType, setUploadingType] = useState(null);

    const fetchDossier = useCallback(async () => {
        if (!regId) return;
        try {
            setLoading(true);
            const res = await archiveService.getDefenseDossier(regId);
            if (res.success) {
                setDossier(res.data);
            }
        } catch (err) {
            message.error(err?.message || 'Không thể tải hồ sơ lưu chiểu');
        } finally {
            setLoading(false);
        }
    }, [regId]);

    useEffect(() => {
        if (isOpen && regId) {
            fetchDossier();
        }
    }, [isOpen, regId, fetchDossier]);

    const isWindowClosed = Boolean(dossier?.isWindowClosed);
    const timeWindows = dossier?.timeWindows || {};
    const docs = dossier?.documents || [];
    const bm03Record = dossier?.bm03Record || registration?.bm03Record;
    const bm04Record = dossier?.bm04Record || registration?.bm04Record;

    const handleUploadFile = async (documentType, file) => {
        if (isWindowClosed) {
            message.error('Cổng nộp lưu chiểu đã đóng vào lúc 00:00 ngày thứ 15 sau ngày bảo vệ. Không thể nộp thêm.');
            return false;
        }

        try {
            setUploadingType(documentType);
            message.loading({ content: `Đang tải lên ${documentType}...`, key: documentType });
            const uploadRes = await uploadService.uploadFile(file, 'archives');
            const fileUrl = uploadRes?.data?.url || uploadRes?.url || '';

            const res = await archiveService.uploadDefenseDocument(regId, {
                documentType,
                fileUrl,
                fileName: file.name,
                fileSize: file.size,
            });

            if (res.success) {
                message.success({ content: `Đã nộp thành công: ${file.name}`, key: documentType });
                await fetchDossier();
                if (onSuccess) onSuccess();
            } else {
                message.error({ content: res.message || 'Lỗi khi ghi nhận tài liệu', key: documentType });
            }
        } catch (err) {
            message.error({ content: err?.message || 'Tải lên thất bại', key: documentType });
        } finally {
            setUploadingType(null);
        }
        return false;
    };

    return (
        <Modal
            open={isOpen}
            onCancel={handleClose}
            width={900}
            title={(
                <Flex align="center" gap={8}>
                    <CloudUploadOutlined className="text-teal-700 text-xl" />
                    <span className="font-bold text-slate-800 text-base">
                        Nộp & Cập Nhật Hồ Sơ Lưu Chiểu Đồ Án (Kho Lưu Chiểu Số)
                    </span>
                </Flex>
            )}
            footer={[
                <Button key="close" onClick={handleClose}>
                    Đóng
                </Button>,
                <Button
                    key="refresh"
                    icon={<ReloadOutlined />}
                    onClick={fetchDossier}
                    loading={loading}
                >
                    Làm mới hồ sơ
                </Button>,
            ]}
            destroyOnClose
        >
            <div className="py-2 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                {/* Time Windows & Closing Notice */}
                {isWindowClosed ? (
                    <Alert
                        type="error"
                        showIcon
                        icon={<LockOutlined />}
                        message="Cổng nộp hồ sơ lưu chiểu đã đóng (00:00 ngày 15 sau ngày bảo vệ)"
                        description="Thời hạn 14 ngày bổ sung và hoàn thiện hồ sơ lưu chiểu đã kết thúc. Bạn không thể nộp thêm hoặc sửa đổi tài liệu lưu chiểu."
                    />
                ) : (
                    <Alert
                        type="info"
                        showIcon
                        icon={<ClockCircleOutlined />}
                        message="Cửa sổ nộp hồ sơ lưu chiểu 14 ngày"
                        description={(
                            <div className="text-xs space-y-1 mt-1">
                                <div>
                                    Hạn mềm hoàn thiện tài liệu bảo vệ: <strong>00:00 3 ngày trước ngày bảo vệ</strong>.
                                </div>
                                <div>
                                    Đóng cổng hoàn toàn lúc: <strong>00:00 ngày thứ 15 sau ngày bảo vệ</strong>. Sau thời điểm này hệ thống tự động khóa cổng vĩnh viễn.
                                </div>
                            </div>
                        )}
                    />
                )}

                {/* 4 Independent Upload Slots */}
                <div className="space-y-3">
                    <div className="font-bold text-slate-800 text-sm">
                        1. 4 Thành phần tài liệu do sinh viên nộp (Cho phép nộp lại nhiều version):
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {DOCUMENT_TYPES.map((dt) => {
                            const latestDoc = docs.find((d) => d.documentType === dt.key);
                            const isCurrentlyUploading = uploadingType === dt.key;

                            return (
                                <div
                                    key={dt.key}
                                    className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white hover:border-teal-500 transition-all flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                {dt.icon}
                                                <span className="font-bold text-slate-900 text-xs">{dt.title}</span>
                                            </div>
                                            {latestDoc ? (
                                                <Tag color="success" className="text-[10px] font-mono">
                                                    v{latestDoc.versionNumber || 1}
                                                </Tag>
                                            ) : (
                                                <Tag color="warning" className="text-[10px]">
                                                    Chưa nộp
                                                </Tag>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1 mb-2">{dt.desc}</p>

                                        {latestDoc && (
                                            <div className="p-2 bg-white rounded border border-slate-200 text-[11px] space-y-0.5 mb-2">
                                                <div className="font-medium text-slate-800 truncate" title={latestDoc.fileName}>
                                                    {latestDoc.fileName || latestDoc.fileUrl}
                                                </div>
                                                <div className="flex items-center justify-between text-slate-500 font-mono text-[10px]">
                                                    <span>SHA-256: {latestDoc.checksum ? latestDoc.checksum.slice(0, 12) + '...' : 'Chưa băm'}</span>
                                                    <span>{latestDoc.uploadedAt ? new Date(latestDoc.uploadedAt).toLocaleDateString('vi-VN') : ''}</span>
                                                </div>
                                                {latestDoc.advisorFeedback && (
                                                    <div className="text-amber-800 font-sans text-[11px] pt-1">
                                                        GVHD: {latestDoc.advisorFeedback}
                                                    </div>
                                                )}
                                                {latestDoc.academicAffairsFeedback && (
                                                    <div className="text-purple-800 font-sans text-[11px] pt-0.5">
                                                        Giáo vụ: {latestDoc.academicAffairsFeedback}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200/80">
                                        {latestDoc?.fileUrl && (
                                            <Button
                                                size="small"
                                                type="link"
                                                icon={<DownloadOutlined />}
                                                onClick={() => window.open(latestDoc.fileUrl, '_blank')}
                                                className="p-0 text-xs"
                                            >
                                                Tải về xem
                                            </Button>
                                        )}
                                        <Upload
                                            beforeUpload={(file) => handleUploadFile(dt.key, file)}
                                            showUploadList={false}
                                            accept={dt.accept}
                                            disabled={isWindowClosed || isCurrentlyUploading}
                                        >
                                            <Button
                                                size="small"
                                                type="primary"
                                                icon={<CloudUploadOutlined />}
                                                loading={isCurrentlyUploading}
                                                disabled={isWindowClosed}
                                                className="bg-teal-700 hover:bg-teal-800"
                                            >
                                                {latestDoc ? 'Nộp version mới' : 'Tải tệp lên'}
                                            </Button>
                                        </Upload>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <Divider className="my-2" />

                {/* 2 Auto-linked Legal Records (BM03 & BM04) */}
                <div className="space-y-2">
                    <div className="font-bold text-slate-800 text-sm">
                        2. 2 Văn bản pháp lý tự động liên kết hệ thống (Chỉ đọc, không upload đè):
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-emerald-900">BM03: Nhật ký hướng dẫn & Tiến độ</span>
                                <Tag color="success">Tự động liên kết</Tag>
                            </div>
                            <p className="text-slate-600 text-[11px]">
                                Toàn bộ lịch họp lab, đánh giá 2 checkpoint và biên bản đã ký số của GVHD và sinh viên.
                            </p>
                            <div className="pt-1 font-semibold text-emerald-800">
                                Trạng thái: Đã nghiệm thu học phần BM03
                            </div>
                        </div>

                        <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-teal-900">BM04: Phiếu nhận xét của GVHD</span>
                                <Tag color="success">Tự động liên kết</Tag>
                            </div>
                            <p className="text-slate-600 text-[11px]">
                                Phiếu nhận xét và kết luận ĐỒNG Ý CHO BẢO VỆ kèm chữ ký số của GVHD.
                            </p>
                            <div className="pt-1 font-semibold text-teal-800">
                                Trạng thái: Đã ký số & Cho phép bảo vệ
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
