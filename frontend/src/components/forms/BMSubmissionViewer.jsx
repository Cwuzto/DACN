import React from 'react';
import { Tag, Typography, Button, Space, Divider, Alert } from 'antd';
import { FilePdfOutlined, DownloadOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

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
    if (!submission) {
        return (
            <div className="text-slate-400 text-sm italic py-4 text-center">
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

    return (
        <div className="space-y-4">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100 gap-2">
                <span>
                    Thời gian nộp: <strong className="text-slate-700">{submission.submittedAt ? dayjs(submission.submittedAt).format('HH:mm - DD/MM/YYYY') : '---'}</strong>
                </span>
                {submission.student && (
                    <span>
                        Sinh viên: <strong className="text-slate-700">{submission.student.fullName} ({submission.student.code})</strong>
                    </span>
                )}
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
        </div>
    );
}
