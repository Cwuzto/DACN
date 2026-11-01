import React, { useState } from 'react';
import { Tag, Typography, Button, Space, Divider, Alert } from 'antd';
import { FilePdfOutlined, DownloadOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import SimulatedDocumentViewer from '../common/SimulatedDocumentViewer';

const { Text, Title } = Typography;

const FIELD_LABELS = {
    topicTitle: 'Tên đề tài',
    objectives: 'Mục tiêu & Phạm vi',
    technologies: 'Công nghệ & Phương pháp',
    deliverables: 'Sản phẩm dự kiến & Kế hoạch',
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
    repoLink: 'Liên kết mã nguồn (Repo)',
    studentSelfAssessment: 'Tự đánh giá',
    summary: 'Nội dung báo cáo',
};

export default function BMSubmissionViewer({ submission, showFeedback = true }) {
    const [showPaperModal, setShowPaperModal] = useState(false);

    if (!submission) {
        return (
            <div className="text-slate-500 font-medium text-sm italic py-4 text-center">
                Chưa có bản nộp nào.
            </div>
        );
    }

    let parsedContent = null;
    let rawContent = submission.content || '';

    try {
        if (submission.content && submission.content.startsWith('{')) {
            parsedContent = JSON.parse(submission.content);
        }
    } catch {
        parsedContent = null;
    }

    const fields = parsedContent?.fields || null;

    const documentData = {
        title: submission.task?.title || 'BIỂU MẪU BÁO CÁO HỌC VỤ ĐỒ ÁN',
        documentNumber: `BM-${submission.id || 'DACN'}/TDMU-VCS`,
        date: submission.submittedAt,
        preamble: `Căn cứ theo quy chế đào tạo và đồ án tốt nghiệp Viện Công nghệ Số, Trường Đại học Thủ Dầu Một;
Sinh viên: ${submission.student?.fullName || 'Sinh viên'} - MSSV: ${submission.student?.code || ''}`,
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
    };

    return (
        <div className="space-y-4">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100 gap-2">
                <span>
                    Thời gian nộp: <strong className="text-slate-700">{submission.submittedAt ? dayjs(submission.submittedAt).format('HH:mm - DD/MM/YYYY') : '---'}</strong>
                </span>
                <div className="flex items-center gap-3">
                    {submission.student && (
                        <span>
                            Sinh viên: <strong className="text-slate-700">{submission.student.fullName} ({submission.student.code})</strong>
                        </span>
                    )}
                    <Button
                        size="small"
                        icon={<PrinterOutlined />}
                        onClick={() => setShowPaperModal(true)}
                        className="text-xs font-medium text-teal-700 border-teal-200 bg-teal-50 hover:bg-teal-100"
                    >
                        Xem bản in A4
                    </Button>
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

            {/* Attached file */}
            {submission.fileUrl && (
                <div className="flex items-center justify-between p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                            <FilePdfOutlined className="text-lg" />
                        </div>
                        <div className="truncate">
                            <div className="text-xs text-slate-500 font-medium">Tệp đính kèm</div>
                            <div className="text-sm font-semibold text-slate-800 truncate">
                                {submission.fileName || 'Tài liệu đính kèm'}
                            </div>
                        </div>
                    </div>
                    <Button
                        type="primary"
                        ghost
                        size="small"
                        icon={<DownloadOutlined />}
                        href={submission.fileUrl}
                        target="_blank"
                        className="rounded-lg text-xs"
                    >
                        Tải về / Mở
                    </Button>
                </div>
            )}

            {/* Lecturer Feedback */}
            {showFeedback && submission.feedback && (
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mb-1">
                        <CheckCircleOutlined />
                        Nhận xét từ GVHD ({submission.feedbackAt ? dayjs(submission.feedbackAt).format('DD/MM/YYYY HH:mm') : ''})
                    </div>
                    <div className="text-sm text-emerald-950 whitespace-pre-line pl-4 border-l-2 border-emerald-400">
                        {submission.feedback}
                    </div>
                </div>
            )}

            {/* Simulated Document Viewer Modal */}
            <SimulatedDocumentViewer
                open={showPaperModal}
                onClose={() => setShowPaperModal(false)}
                documentData={documentData}
            />
        </div>
    );
}
