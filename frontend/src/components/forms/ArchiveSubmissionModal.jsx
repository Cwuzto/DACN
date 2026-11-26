import React, { useState, useEffect } from 'react';
import {
    Modal,
    Button,
    Upload,
    Alert,
    Flex,
    Tag,
    Divider,
    Input,
    message,
} from 'antd';
import {
    CloudUploadOutlined,
    FilePdfOutlined,
    FileWordOutlined,
    FilePptOutlined,
    VideoCameraOutlined,
    ClockCircleOutlined,
    LockOutlined,
    DownloadOutlined,
    ReloadOutlined,
    ScanOutlined,
    LinkOutlined,
    ExportOutlined,
} from '@ant-design/icons';
import uploadService from '../../services/uploadService';
import { uploadGovernedAsset, getAssetDownloadUrl } from '../../services/resumableUploadService';
import { useDefenseDossier, useUploadDefenseDocument, canUploadArchive } from '../../queries/archiveQueries';
import useAuthStore from '../../stores/authStore';
import { queryKeys } from '../../query/queryKeys';
import QueryErrorState from '../common/QueryErrorState';
import ContentSkeleton from '../common/ContentSkeleton';
import ContentRefreshIndicator from '../common/ContentRefreshIndicator';
import aiService from '../../services/aiService';
import ArchivalCrossCheckModal from '../admin/ArchivalCrossCheckModal';
import ArchiveDeadlineBanner from './ArchiveDeadlineBanner';

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
        title: 'Video Demo Sản phẩm (Link HTTPS)',
        isExternalLink: true,
        icon: <VideoCameraOutlined className="text-purple-600 text-xl" />,
        desc: 'Dán đường dẫn HTTPS công khai (YouTube, Google Drive, OneDrive...) ghi hình vận hành hệ thống thực tế.',
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
    onSuccess,
}) {
    const isOpen = openProp !== undefined ? openProp : visible;
    const handleClose = onClose || onCancel;
    const regId = registration?.id || registrationId;

    const user = useAuthStore(state => state.user);
    const scope = queryKeys.scope(user);
    const dossierQuery = useDefenseDossier(scope, regId, { enabled: Boolean(isOpen) });
    const uploadMutation = useUploadDefenseDocument(scope, regId);
    const dossier = dossierQuery.data?.data;
    const loading = dossierQuery.isFetching;
    const fetchDossier = () => dossierQuery.refetch();
    const [uploadingType, setUploadingType] = useState(null);
    const [demoVideoUrlInput, setDemoVideoUrlInput] = useState('');

    // AI Archival Cross-Check state
    const [crossCheckModalOpen, setCrossCheckModalOpen] = useState(false);
    const [crossCheckLoading, setCrossCheckLoading] = useState(false);
    const [crossCheckData, setCrossCheckData] = useState(null);

    const handleRunCrossCheck = async () => {
        if (!regId) {
            message.warning('Không tìm thấy thông tin đăng ký để đối soát.');
            return;
        }
        setCrossCheckModalOpen(true);
        setCrossCheckLoading(true);
        try {
            const res = await aiService.crossCheckArchive(regId);
            if (res.success) {
                setCrossCheckData(res.data);
            } else {
                message.error(res.message || 'Không thể đối soát hồ sơ lưu chiểu với AI');
            }
        } catch (err) {
            message.error(err?.message || 'Lỗi khi gọi AI đối soát hồ sơ lưu chiểu');
        } finally {
            setCrossCheckLoading(false);
        }
    };

    const isWindowClosed = Boolean(dossier?.isWindowClosed);
    const ineligible = !canUploadArchive(registration?.status);
    const uploadDisabled = !regId || !dossier || dossierQuery.isError || dossierQuery.isFetching || isWindowClosed || ineligible;
    const docs = dossier?.documents || [];
    const bm03Record = dossier?.bm03Record;
    const bm04Record = dossier?.bm04Record;
    const bm05Record = dossier?.bm05Record || null;
    const bm05PdfUrl = bm05Record?.finalPdfFileUrl
        || registration?.defenseResult?.bm05PdfUrl
        || registration?.bm05PdfUrl
        || null;

    const existingDemoDoc = docs.find((d) => d.documentType === 'DEMO_VIDEO');
    const existingDemoUrl = existingDemoDoc?.demoVideoExternalUrl || existingDemoDoc?.fileUrl || '';

    useEffect(() => {
        if (isOpen) {
            setDemoVideoUrlInput(existingDemoUrl);
        }
    }, [isOpen, existingDemoUrl]);

    const handleSaveDemoVideoUrl = async () => {
        if (uploadDisabled) {
            message.error('Chưa thể nộp tài liệu. Vui lòng kiểm tra trạng thái đề tài và cửa sổ nộp hồ sơ.');
            return;
        }
        const trimmedUrl = demoVideoUrlInput.trim();
        let isValidHttps = false;
        if (trimmedUrl.startsWith('https://')) {
            try {
                const parsed = new URL(trimmedUrl);
                isValidHttps = parsed.protocol === 'https:';
            } catch {
                isValidHttps = false;
            }
        }
        if (!isValidHttps) {
            message.warning('Vui lòng nhập đường dẫn HTTPS hợp lệ (ví dụ: https://youtu.be/... hoặc https://drive.google.com/...).');
            return;
        }

        try {
            setUploadingType('DEMO_VIDEO');
            message.loading({ content: 'Đang lưu đường dẫn Video Demo...', key: 'DEMO_VIDEO' });
            const res = await uploadMutation.mutateAsync({
                documentType: 'DEMO_VIDEO',
                demoVideoExternalUrl: trimmedUrl,
                fileName: 'Video Demo Sản phẩm',
            });
            if (res.success) {
                message.success({ content: 'Đã lưu đường dẫn Video Demo thành công!', key: 'DEMO_VIDEO' });
                if (onSuccess) onSuccess();
            } else {
                message.error({ content: res.message || 'Lỗi khi lưu đường dẫn Video Demo', key: 'DEMO_VIDEO' });
            }
        } catch (err) {
            message.error({ content: err?.message || 'Lưu đường dẫn Video Demo thất bại', key: 'DEMO_VIDEO' });
        } finally {
            setUploadingType(null);
        }
    };

    const handleUploadFile = async (documentType, file) => {
        if (uploadDisabled) {
            message.error('Chưa thể nộp tài liệu. Vui lòng kiểm tra trạng thái đề tài và cửa sổ nộp hồ sơ.');
            return false;
        }

        try {
            setUploadingType(documentType);
            message.loading({ content: `Đang tải lên ${documentType}...`, key: documentType });

            const uploadRes = await uploadService.uploadFile(file, 'archives', { documentType, registrationId: regId });
            const fileUrl = uploadRes?.data?.url || uploadRes?.url || (uploadRes?.id ? `/api/assets/${uploadRes.id}/download` : '');
            const assetId = uploadRes?.data?.assetId || uploadRes?.assetId || uploadRes?.id || null;
            const checksum = uploadRes?.data?.checksum || uploadRes?.checksum || uploadRes?.sha256 || null;

            if (!fileUrl && !assetId) throw new Error(uploadRes?.message || 'Không thể tải tệp lên');

            const res = await uploadMutation.mutateAsync({
                documentType,
                assetId,
                fileUrl,
                fileName: file.name,
                fileSizeBytes: file.size,
                checksum,
            });

            if (res.success) {
                message.success({ content: `Đã nộp thành công: ${file.name}`, key: documentType });
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
                <Button
                    key="crosscheck"
                    icon={<ScanOutlined />}
                    onClick={handleRunCrossCheck}
                    loading={crossCheckLoading}
                    className="border-teal-500 text-teal-700 hover:text-teal-800 hover:border-teal-600 font-medium"
                >
                    AI Đối soát hồ sơ
                </Button>,
                <Button key="close" onClick={handleClose}>
                    Đóng
                </Button>,
                <Button
                    key="refresh"
                    icon={<ReloadOutlined />}
                    onClick={fetchDossier}
                    loading={loading}
                    disabled={!regId}
                >
                    Làm mới hồ sơ
                </Button>,
            ]}
            destroyOnHidden
        >
            <div className="py-2 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                {dossierQuery.isError && <QueryErrorState error={dossierQuery.error} onRetry={fetchDossier} retrying={loading} />}
                {!regId && <Alert type="warning" showIcon title="Chưa có đăng ký đề tài để nộp hồ sơ." />}
                {regId && dossierQuery.isPending && <ContentSkeleton variant="form" rows={2} />}
                {dossier && <>
                <ContentRefreshIndicator refreshing={dossierQuery.isFetching} />
                {ineligible && <Alert type="warning" showIcon title="Trạng thái đề tài chưa đủ điều kiện nộp hồ sơ lưu chiểu." />}
                {/* Time Windows, Countdown & Missing Documents Banner */}
                <ArchiveDeadlineBanner
                    dossier={dossier}
                    registrationStatus={registration?.status}
                    variant="prominent"
                    showAction={false}
                />

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

                                    {dt.isExternalLink ? (
                                        <div className="pt-2 space-y-2 border-t border-slate-200/80">
                                            <Input
                                                size="small"
                                                prefix={<LinkOutlined className="text-slate-400" />}
                                                placeholder="https://youtube.com/... hoặc https://drive.google.com/..."
                                                value={demoVideoUrlInput}
                                                onChange={(e) => setDemoVideoUrlInput(e.target.value)}
                                                disabled={uploadDisabled || Boolean(uploadingType)}
                                            />
                                            <div className="flex items-center justify-between gap-2">
                                                {(latestDoc?.demoVideoExternalUrl || latestDoc?.fileUrl) ? (
                                                    <Button
                                                        size="small"
                                                        type="link"
                                                        icon={<ExportOutlined />}
                                                        onClick={() => window.open(latestDoc.demoVideoExternalUrl || latestDoc.fileUrl, '_blank', 'noopener,noreferrer')}
                                                        className="p-0 text-xs"
                                                    >
                                                        Mở link video
                                                    </Button>
                                                ) : <span />}
                                                <Button
                                                    size="small"
                                                    type="primary"
                                                    icon={<LinkOutlined />}
                                                    loading={isCurrentlyUploading}
                                                    disabled={uploadDisabled || Boolean(uploadingType)}
                                                    onClick={handleSaveDemoVideoUrl}
                                                    className="bg-teal-700 hover:bg-teal-800"
                                                >
                                                    {latestDoc ? 'Cập nhật link' : 'Lưu link video'}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200/80">
                                            {(latestDoc?.fileUrl || latestDoc?.assetId) && (
                                                <Button
                                                    size="small"
                                                    type="link"
                                                    icon={<DownloadOutlined />}
                                                    onClick={async () => {
                                                        if (latestDoc.assetId) {
                                                            try {
                                                                const dl = await getAssetDownloadUrl(latestDoc.assetId);
                                                                window.open(dl.downloadUrl || dl.url, '_blank');
                                                                return;
                                                            } catch (err) {
                                                                // fallback to direct url
                                                            }
                                                        }
                                                        if (latestDoc.fileUrl) {
                                                            window.open(latestDoc.fileUrl, '_blank');
                                                        }
                                                    }}
                                                    className="p-0 text-xs"
                                                >
                                                    Tải về xem
                                                </Button>
                                            )}
                                            <Upload
                                                beforeUpload={(file) => handleUploadFile(dt.key, file)}
                                                showUploadList={false}
                                                accept={dt.accept}
                                                disabled={uploadDisabled || Boolean(uploadingType)}
                                            >
                                                <Button
                                                    size="small"
                                                    type="primary"
                                                    icon={<CloudUploadOutlined />}
                                                    loading={isCurrentlyUploading}
                                                    disabled={uploadDisabled || Boolean(uploadingType)}
                                                    className="bg-teal-700 hover:bg-teal-800"
                                                >
                                                    {latestDoc ? 'Nộp version mới' : 'Tải tệp lên'}
                                                </Button>
                                            </Upload>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <Divider className="my-2" />

                {/* Auto-linked Legal Records (BM03, BM04, BM05) */}
                <div className="space-y-2">
                    <div className="font-bold text-slate-800 text-sm">
                        2. Văn bản pháp lý tự động liên kết hệ thống (Chỉ đọc, không upload đè):
                    </div>

                    <div className={`grid grid-cols-1 ${bm05PdfUrl || bm05Record || registration?.defenseResult ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3`}>
                        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-emerald-900">BM03: Nhật ký hướng dẫn &amp; Tiến độ</span>
                                <Tag color={bm03Record?.advisorSignedAt ? 'success' : 'warning'}>{!bm03Record ? 'Chưa có bản ghi' : bm03Record.advisorSignedAt ? 'Đã ký số' : 'Chưa ký số'}</Tag>
                            </div>
                            <p className="text-slate-600 text-[11px]">
                                Nhật ký hướng dẫn và tiến độ được liên kết từ hồ sơ BM03 trên hệ thống.
                            </p>
                            <div className="pt-1 font-semibold text-emerald-800">
                                {bm03Record?.finalPdfFileUrl ? <Button type="link" href={bm03Record.finalPdfFileUrl} target="_blank" rel="noopener noreferrer" icon={<DownloadOutlined aria-hidden="true" />}>Tải BM03</Button> : 'Chưa có bản PDF BM03'}
                            </div>
                        </div>

                        <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-teal-900">BM04: Phiếu nhận xét của GVHD</span>
                                <Tag color={bm04Record?.signedAt ? 'success' : 'warning'}>{!bm04Record ? 'Chưa có bản ghi' : bm04Record.signedAt ? 'Đã ký số' : 'Chưa ký số'}</Tag>
                            </div>
                            <p className="text-slate-600 text-[11px]">
                                Phiếu nhận xét của GVHD được liên kết từ hồ sơ BM04 trên hệ thống.
                            </p>
                            <div className="pt-1 font-semibold text-teal-800">
                                {bm04Record?.finalPdfFileUrl ? <Button type="link" href={bm04Record.finalPdfFileUrl} target="_blank" rel="noopener noreferrer" icon={<DownloadOutlined aria-hidden="true" />}>Tải BM04</Button> : 'Chưa có bản PDF BM04'}
                            </div>
                        </div>

                        {(bm05PdfUrl || bm05Record || registration?.defenseResult) && (
                            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-indigo-900">BM05: Biên bản Hội đồng</span>
                                    <Tag color={bm05PdfUrl || bm05Record?.lockedAt || registration?.defenseResult?.scoreLocked ? 'success' : 'processing'}>
                                        {bm05PdfUrl || bm05Record?.lockedAt || registration?.defenseResult?.scoreLocked ? 'Đã chốt sổ' : 'Đang tổng hợp'}
                                    </Tag>
                                </div>
                                <p className="text-slate-600 text-[11px]">
                                    Biên bản tổng hợp điểm bảo vệ Hội đồng được tự động liên kết sau buổi bảo vệ.
                                </p>
                                <div className="pt-1 font-semibold text-indigo-800">
                                    {bm05PdfUrl ? (
                                        <Button type="link" href={bm05PdfUrl} target="_blank" rel="noopener noreferrer" icon={<DownloadOutlined aria-hidden="true" />}>
                                            Tải BM05
                                        </Button>
                                    ) : 'Chưa xuất bản PDF BM05'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                </>}
            </div>

            {/* AI Archival Cross-Check Modal */}
            <ArchivalCrossCheckModal
                open={crossCheckModalOpen}
                onClose={() => setCrossCheckModalOpen(false)}
                data={crossCheckData}
                loading={crossCheckLoading}
            />
        </Modal>
    );
}
