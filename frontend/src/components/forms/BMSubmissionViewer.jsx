import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tag, Typography, Button, Space, Alert, Spin, Radio } from 'antd';
import {
    FilePdfOutlined,
    FileWordOutlined,
    DownloadOutlined,
    CheckCircleOutlined,
    PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import SimulatedDocumentViewer from '../common/SimulatedDocumentViewer';
import { getAssetDownloadUrl } from '../../services/resumableUploadService';

const { Text } = Typography;

const FIELD_LABELS = {
    topicTitle: 'Tên đề tài',
    objectives: 'Mục tiêu & Phạm vi',
    technologies: 'Công nghệ & Phương pháp',
    deliverables: 'Sản phẩm dự kiến & Kế hoạch',
    revisionSummary: 'Tóm tắt nội dung chỉnh sửa',
    bm01ApprovedTitle: 'Tên đề tài đã duyệt (BM01)',
    bm02ProposedTitle: 'Tên đề tài đề xuất (BM02)',
    titleChangeReason: 'Lý do điều chỉnh tên đề tài',
    mainTasks: 'Tóm tắt nhiệm vụ chính',
    timelineMilestones: 'Các mốc thời gian',
    specialRequirements: 'Yêu cầu kỹ thuật đặc thù',
    progressPercent: 'Khối lượng hoàn thành',
    completedWork: 'Công việc đã làm',
    inProgressAndIssues: 'Đang làm & Vướng mắc',
    issues: 'Khó khăn & Vướng mắc',
    testingAndResults: 'Kết quả kiểm thử',
    nextStepPlan: 'Kế hoạch giai đoạn tới',
    summaryResult: 'Tóm tắt kết quả',
    demoLink: 'Liên kết Demo / Video',
    repoLink: 'Liên kết kho mã nguồn',
    studentSelfAssessment: 'Tự đánh giá',
    summary: 'Nội dung báo cáo',
};

function parseContent(content) {
    if (!content) return { parsedContent: null, rawContent: '' };
    if (typeof content === 'object') {
        return { parsedContent: content, rawContent: '' };
    }
    if (typeof content === 'string' && content.trim().startsWith('{')) {
        try {
            return { parsedContent: JSON.parse(content), rawContent: content };
        } catch {
            return { parsedContent: null, rawContent: content };
        }
    }
    return { parsedContent: null, rawContent: String(content) };
}

function getVersionLabel(sub, index) {
    if (sub?.versionNo) return `Phiên bản v${sub.versionNo}`;
    if (sub?.versionNumber) return `Phiên bản v${sub.versionNumber}`;
    if (sub?.task?.taskType === 'BM01_RESUBMISSION') return 'Phiên bản v2';
    if (sub?.task?.taskType === 'BM01_INITIAL_SUBMISSION') return 'Phiên bản v1';
    return `Phiên bản #${index + 1}`;
}

export default function BMSubmissionViewer({
    submission,
    submissions = null,
    isBM01: isBM01Prop = false,
    showFeedback = true,
}) {
    const [showPaperModal, setShowPaperModal] = useState(false);
    const [selectedId, setSelectedId] = useState(submission?.id ?? null);
    const [resolvedUrl, setResolvedUrl] = useState(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState(null);
    const [iframeError, setIframeError] = useState(false);
    const objectUrlRef = useRef(null);

    const versionList = useMemo(() => {
        if (Array.isArray(submissions) && submissions.length > 0) {
            return submissions;
        }
        return submission ? [submission] : [];
    }, [submissions, submission]);

    useEffect(() => {
        setSelectedId(submission?.id ?? versionList[0]?.id ?? null);
    }, [submission?.id, versionList]);

    const activeSubmission = useMemo(() => {
        if (versionList.length === 0) return submission || null;
        if (selectedId != null) {
            const found = versionList.find((item) => item?.id === selectedId);
            if (found) return found;
        }
        return submission || versionList[0] || null;
    }, [versionList, selectedId, submission]);

    const { parsedContent, rawContent } = useMemo(
        () => parseContent(activeSubmission?.content),
        [activeSubmission?.content]
    );

    const isBM01 = Boolean(
        isBM01Prop
        || activeSubmission?.isBM01
        || activeSubmission?.formCode === 'BM01'
        || activeSubmission?.task?.taskType?.startsWith('BM01')
        || parsedContent?.formCode === 'BM01'
        || parsedContent?.taskType?.startsWith('BM01')
    );

    const fileName = activeSubmission?.fileName || '';
    const isDocx = /\.docx?$/i.test(fileName);
    const isPdf = Boolean(
        !isDocx && (
            /\.pdf$/i.test(fileName)
            || activeSubmission?.mimeType === 'application/pdf'
            || /\.pdf(\?|$)/i.test(activeSubmission?.fileUrl || '')
            || (isBM01 && (activeSubmission?.assetId || activeSubmission?.fileUrl))
        )
    );

    const cleanupObjectUrl = () => {
        if (objectUrlRef.current && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            try {
                URL.revokeObjectURL(objectUrlRef.current);
            } catch {
                // Ignore revoke errors
            }
        }
        objectUrlRef.current = null;
    };

    useEffect(() => {
        let cancelled = false;
        cleanupObjectUrl();
        setResolvedUrl(null);
        setPdfError(null);
        setIframeError(false);

        if (!isBM01 || !activeSubmission) {
            setPdfLoading(false);
            return undefined;
        }

        const assetId = activeSubmission.assetId;
        const directUrl = activeSubmission.fileUrl;

        if (!assetId && !directUrl) {
            setPdfLoading(false);
            return undefined;
        }

        const resolveAsset = async () => {
            if (assetId) {
                setPdfLoading(true);
                try {
                    const data = await getAssetDownloadUrl(assetId);
                    if (cancelled) return;
                    const url = data?.downloadUrl || data?.url || directUrl || null;
                    if (!url) {
                        setPdfError('Không tìm thấy liên kết tải tệp đề cương hợp lệ.');
                    } else {
                        if (String(url).startsWith('blob:')) {
                            objectUrlRef.current = url;
                        }
                        setResolvedUrl(url);
                    }
                } catch (err) {
                    if (cancelled) return;
                    setPdfError(err?.message || 'Bạn không có quyền truy cập hoặc tệp đề cương không tồn tại.');
                } finally {
                    if (!cancelled) setPdfLoading(false);
                }
            } else {
                setResolvedUrl(directUrl);
                setPdfLoading(false);
            }
        };

        resolveAsset();

        return () => {
            cancelled = true;
            cleanupObjectUrl();
        };
    }, [isBM01, activeSubmission?.id, activeSubmission?.assetId, activeSubmission?.fileUrl]);

    if (!activeSubmission) {
        return (
            <div className="text-slate-500 font-medium text-sm italic py-4 text-center">
                Chưa có bản nộp nào.
            </div>
        );
    }

    const fields = parsedContent?.fields || null;
    const downloadHref = resolvedUrl || (!pdfError ? activeSubmission.fileUrl : null);

    const documentData = !isBM01 ? {
        title: activeSubmission.task?.title || 'BIỂU MẪU BÁO CÁO HỌC VỤ ĐỒ ÁN',
        documentNumber: `BM-${activeSubmission.id || 'DACN'}/TDMU-VCS`,
        date: activeSubmission.submittedAt,
        preamble: `Căn cứ theo quy chế đào tạo và đồ án tốt nghiệp Viện Công nghệ Số, Trường Đại học Thủ Dầu Một;\nSinh viên: ${activeSubmission.student?.fullName || 'Sinh viên'} - MSSV: ${activeSubmission.student?.code || ''}`,
        articles: fields
            ? Object.entries(fields).map(([k, v], idx) => ({
                  title: `Mục ${idx + 1}: ${FIELD_LABELS[k] || k}`,
                  content: typeof v === 'object' ? JSON.stringify(v) : String(v),
              }))
            : [
                  {
                      title: 'Nội dung chi tiết',
                      content: rawContent || 'Không có nội dung chi tiết',
                  },
              ],
        signerTitle: 'GIẢNG VIÊN HƯỚNG DẪN',
        signerName: 'Xác nhận số',
    } : null;

    return (
        <div className="space-y-4">
            {/* Version selector when multiple submissions exist */}
            {versionList.length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <Text className="text-xs font-semibold text-slate-600">Chọn phiên bản đề cương:</Text>
                    <Radio.Group
                        size="small"
                        value={activeSubmission.id}
                        onChange={(e) => setSelectedId(e.target.value)}
                        optionType="button"
                        buttonStyle="solid"
                        options={versionList.map((item, idx) => ({
                            label: getVersionLabel(item, idx),
                            value: item.id,
                        }))}
                    />
                </div>
            )}

            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100 gap-2">
                <span>
                    Thời gian nộp:{' '}
                    <strong className="text-slate-700">
                        {activeSubmission.submittedAt ? dayjs(activeSubmission.submittedAt).format('HH:mm - DD/MM/YYYY') : '---'}
                    </strong>
                </span>
                <div className="flex items-center gap-3">
                    {activeSubmission.student && (
                        <span>
                            Sinh viên: <strong className="text-slate-700">{activeSubmission.student.fullName} ({activeSubmission.student.code})</strong>
                        </span>
                    )}
                    {!isBM01 && (
                        <Button
                            size="small"
                            icon={<PrinterOutlined />}
                            onClick={() => setShowPaperModal(true)}
                            className="text-xs font-medium text-teal-700 border-teal-200 bg-teal-50 hover:bg-teal-100"
                        >
                            Xem bản in A4
                        </Button>
                    )}
                </div>
            </div>

            {/* Structured Fields */}
            {fields ? (
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100 space-y-3">
                    {Object.entries(fields).map(([key, value]) => {
                        if (value === undefined || value === null || value === '') return null;
                        const label = FIELD_LABELS[key] || key;
                        const isPercent = key === 'progressPercent';
                        const isLink = key === 'demoLink' && typeof value === 'string' && value.startsWith('http');

                        return (
                            <div key={key} className="text-sm">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                                    {label}
                                </div>
                                {isPercent ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-32 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min(value, 100)}%` }} />
                                        </div>
                                        <span className="font-semibold text-blue-700">{value}%</span>
                                    </div>
                                ) : isLink ? (
                                    <a href={value} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all font-medium">
                                        {value}
                                    </a>
                                ) : (
                                    <div className="text-slate-800 whitespace-pre-line bg-white/70 p-2.5 rounded-lg border border-slate-200/60">
                                        {value}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                rawContent && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm text-slate-800 whitespace-pre-line">
                        {rawContent}
                    </div>
                )
            )}

            {/* BM01 Authorized PDF Preview / Historical DOCX Download */}
            {isBM01 ? (
                <div className="space-y-3">
                    {pdfLoading && (
                        <div className="flex items-center justify-center gap-2 p-6 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600">
                            <Spin size="small" />
                            <span>Đang tải tệp đề cương BM01...</span>
                        </div>
                    )}

                    {!pdfLoading && isDocx && (
                        <Alert
                            type="info"
                            showIcon
                            icon={<FileWordOutlined />}
                            message={`Tệp Word lịch sử: ${fileName || 'de_cuong.docx'}`}
                            description="Tệp đề cương lịch sử định dạng Word (.docx) không hỗ trợ xem trước PDF trực tiếp. Vui lòng tải xuống để xem."
                            action={
                                downloadHref ? (
                                    <Button
                                        type="primary"
                                        size="small"
                                        icon={<DownloadOutlined />}
                                        href={downloadHref}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Tải xuống (.docx)
                                    </Button>
                                ) : null
                            }
                        />
                    )}

                    {!pdfLoading && !isDocx && pdfError && (
                        <Alert
                            type="error"
                            showIcon
                            message="Không thể mở tệp PDF đề cương BM01"
                            description={pdfError}
                            action={
                                activeSubmission.fileUrl && !String(pdfError).includes('quyền') ? (
                                    <Button
                                        size="small"
                                        icon={<DownloadOutlined />}
                                        href={activeSubmission.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Tải xuống PDF
                                    </Button>
                                ) : null
                            }
                        />
                    )}

                    {!pdfLoading && !isDocx && !pdfError && !resolvedUrl && (
                        <Alert
                            type="warning"
                            showIcon
                            message="Không tìm thấy tệp PDF đính kèm cho phiên bản BM01 này."
                        />
                    )}

                    {!pdfLoading && !isDocx && !pdfError && isPdf && resolvedUrl && (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50/60 border border-blue-100 rounded-xl">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                                        <FilePdfOutlined className="text-lg" />
                                    </div>
                                    <div className="truncate">
                                        <div className="text-xs text-slate-500 font-medium">Tệp PDF đề cương đã nộp</div>
                                        <div className="text-sm font-semibold text-slate-800 truncate">
                                            {fileName || 'De_cuong_BM01.pdf'}
                                        </div>
                                    </div>
                                </div>
                                <Space size="small">
                                    <Button
                                        size="small"
                                        icon={<PrinterOutlined />}
                                        href={resolvedUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Mở / In PDF
                                    </Button>
                                    <Button
                                        type="primary"
                                        ghost
                                        size="small"
                                        icon={<DownloadOutlined />}
                                        href={resolvedUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Tải xuống PDF
                                    </Button>
                                </Space>
                            </div>

                            {iframeError ? (
                                <Alert
                                    type="error"
                                    showIcon
                                    message="Trình duyệt không thể hiển thị trực tiếp tệp PDF này"
                                    description="Vui lòng nhấn nút Tải xuống PDF để mở tệp trên thiết bị."
                                />
                            ) : (
                                <iframe
                                    title={`PDF đề cương BM01 - ${fileName || activeSubmission.id || 'preview'}`}
                                    src={resolvedUrl}
                                    onError={() => setIframeError(true)}
                                    className="w-full h-[500px] rounded-lg border border-slate-200 bg-white"
                                />
                            )}
                        </div>
                    )}
                </div>
            ) : (
                activeSubmission.fileUrl && (
                    <div className="flex items-center justify-between p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                                <FilePdfOutlined className="text-lg" />
                            </div>
                            <div className="truncate">
                                <div className="text-xs text-slate-500 font-medium">Tệp đính kèm</div>
                                <div className="text-sm font-semibold text-slate-800 truncate">
                                    {activeSubmission.fileName || 'Tài liệu đính kèm'}
                                </div>
                            </div>
                        </div>
                        <Button
                            type="primary"
                            ghost
                            size="small"
                            icon={<DownloadOutlined />}
                            href={activeSubmission.fileUrl}
                            target="_blank"
                            className="rounded-lg text-xs"
                        >
                            Tải về / Mở
                        </Button>
                    </div>
                )
            )}

            {/* Lecturer Feedback */}
            {showFeedback && activeSubmission.feedback && (
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mb-1">
                        <CheckCircleOutlined />
                        Nhận xét từ GVHD ({activeSubmission.feedbackAt ? dayjs(activeSubmission.feedbackAt).format('DD/MM/YYYY HH:mm') : ''})
                    </div>
                    <div className="text-sm text-emerald-950 whitespace-pre-line pl-4 border-l-2 border-emerald-400">
                        {activeSubmission.feedback}
                    </div>
                </div>
            )}

            {/* Simulated Document Viewer Modal (non-BM01 only) */}
            {!isBM01 && documentData && (
                <SimulatedDocumentViewer
                    open={showPaperModal}
                    onClose={() => setShowPaperModal(false)}
                    documentData={documentData}
                />
            )}
        </div>
    );
}
