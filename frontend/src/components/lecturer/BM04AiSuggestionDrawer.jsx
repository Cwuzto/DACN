import React from 'react';
import { Drawer, Button, Tag, Space, Typography, Card, Divider } from 'antd';
import {
    RobotOutlined,
    CheckCircleOutlined,
    CloseOutlined,
    CheckOutlined,
    AuditOutlined,
    CalendarOutlined,
    TrophyOutlined,
    FileTextOutlined,
} from '@ant-design/icons';

const { Text, Title, Paragraph } = Typography;

/**
 * BM04AiSuggestionDrawer
 * Displays AI-generated evaluation suggestions for BM04 based on BM03 progress evidence.
 * Strictly adheres to AGENTS.md Rule 2.4 (UTF-8 no BOM) and Rule 2.6 (Button UI standards).
 */
export default function BM04AiSuggestionDrawer({
    open,
    onClose,
    suggestion,
    onApplyAll,
    onApplyField,
}) {
    if (!suggestion) return null;

    const evidence = suggestion.evidenceSummary || {};
    const totalMeetings = evidence.totalMeetings || 0;
    const cp1Pass = evidence.checkpoint1Status === 'PASS';
    const cp2Pass = evidence.checkpoint2Status === 'PASS';

    return (
        <Drawer
            title={
                <div className="flex items-center justify-between pr-4">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold">
                        <RobotOutlined className="text-teal-700 text-lg" />
                        <span>AI Gợi Ý Nhận Xét BM04 Từ Minh Chứng BM03</span>
                    </div>
                    <Tag color="cyan" className="font-medium m-0 text-xs">
                        {suggestion.provider?.includes('gemini') ? 'Gemini 2.0 Flash' : 'Hệ Thống Phân Tích Nội Bộ'}
                    </Tag>
                </div>
            }
            open={open}
            onClose={onClose}
            width={640}
            destroyOnHidden
            footer={
                <div className="flex justify-between items-center py-1">
                    <Button icon={<CloseOutlined />} onClick={onClose}>
                        Đóng
                    </Button>
                    <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={onApplyAll}
                        className="bg-teal-700 hover:bg-teal-800 border-teal-700"
                    >
                        Áp dụng toàn bộ vào phiếu
                    </Button>
                </div>
            }
        >
            <div className="space-y-4 text-xs">
                {/* Evidence Summary Card */}
                <div className="p-3.5 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-200 space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold text-teal-900 text-xs uppercase tracking-wide">
                        <AuditOutlined className="text-teal-700" />
                        <span>Căn Cứ Dữ Liệu Thực Tế Từ BM03</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Tag color="blue" icon={<CalendarOutlined />}>
                            {totalMeetings} buổi gặp định kỳ
                        </Tag>
                        <Tag color={cp1Pass ? 'green' : 'red'} icon={<TrophyOutlined />}>
                            Checkpoint 1: {cp1Pass ? 'ĐẠT' : 'CHƯA ĐẠT'}
                        </Tag>
                        <Tag color={cp2Pass ? 'green' : 'red'} icon={<TrophyOutlined />}>
                            Checkpoint 2: {cp2Pass ? 'ĐẠT' : 'CHƯA ĐẠT'}
                        </Tag>
                    </div>
                    <p className="text-slate-600 text-xs m-0 leading-relaxed italic">
                        {evidence.summaryText || 'Dữ liệu được tổng hợp tự động từ nhật ký các buổi gặp và các đợt đánh giá tiến độ định kỳ.'}
                    </p>
                </div>

                <div className="text-slate-500 italic text-[11px]">
                    * Thầy/Cô có thể bấm "Áp dụng mục này" cho từng tiêu chí hoặc bấm "Áp dụng toàn bộ vào phiếu" ở chân trang.
                </div>

                {/* 4 Criteria Sections */}
                <div className="space-y-3">
                    {/* Criterion 1: Hình thức */}
                    <Card
                        size="small"
                        className="border-slate-200 shadow-sm"
                        title={
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-800">
                                    1. Hình thức đáp ứng yêu cầu của Báo cáo tốt nghiệp
                                </span>
                                <Button
                                    size="small"
                                    icon={<CheckOutlined />}
                                    onClick={() => onApplyField('thesisFormatScore', suggestion.thesisFormatScore)}
                                    className="text-xs text-teal-700 border-teal-300 hover:border-teal-500"
                                >
                                    Áp dụng mục này
                                </Button>
                            </div>
                        }
                    >
                        <p className="text-slate-700 text-xs leading-relaxed m-0 whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-100">
                            {suggestion.thesisFormatScore || '(Chưa có nội dung gợi ý)'}
                        </p>
                    </Card>

                    {/* Criterion 2: Nội dung */}
                    <Card
                        size="small"
                        className="border-slate-200 shadow-sm"
                        title={
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-800">
                                    2. Nội dung nghiên cứu của đề tài
                                </span>
                                <Button
                                    size="small"
                                    icon={<CheckOutlined />}
                                    onClick={() => onApplyField('researchContentScore', suggestion.researchContentScore)}
                                    className="text-xs text-teal-700 border-teal-300 hover:border-teal-500"
                                >
                                    Áp dụng mục này
                                </Button>
                            </div>
                        }
                    >
                        <p className="text-slate-700 text-xs leading-relaxed m-0 whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-100">
                            {suggestion.researchContentScore || '(Chưa có nội dung gợi ý)'}
                        </p>
                    </Card>

                    {/* Criterion 3: Tính ứng dụng */}
                    <Card
                        size="small"
                        className="border-slate-200 shadow-sm"
                        title={
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-800">
                                    3. Tính ứng dụng và triển vọng phát triển
                                </span>
                                <Button
                                    size="small"
                                    icon={<CheckOutlined />}
                                    onClick={() => onApplyField('applicabilityScore', suggestion.applicabilityScore)}
                                    className="text-xs text-teal-700 border-teal-300 hover:border-teal-500"
                                >
                                    Áp dụng mục này
                                </Button>
                            </div>
                        }
                    >
                        <p className="text-slate-700 text-xs leading-relaxed m-0 whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-100">
                            {suggestion.applicabilityScore || '(Chưa có nội dung gợi ý)'}
                        </p>
                    </Card>

                    {/* Criterion 4: Thái độ */}
                    <Card
                        size="small"
                        className="border-slate-200 shadow-sm"
                        title={
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-800">
                                    4. Đánh giá thái độ và ý thức làm việc của sinh viên
                                </span>
                                <Button
                                    size="small"
                                    icon={<CheckOutlined />}
                                    onClick={() => onApplyField('attitudeScore', suggestion.attitudeScore)}
                                    className="text-xs text-teal-700 border-teal-300 hover:border-teal-500"
                                >
                                    Áp dụng mục này
                                </Button>
                            </div>
                        }
                    >
                        <p className="text-slate-700 text-xs leading-relaxed m-0 whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-100">
                            {suggestion.attitudeScore || '(Chưa có nội dung gợi ý)'}
                        </p>
                    </Card>
                </div>

                {/* Conclusions Suggestion Card */}
                <Card
                    size="small"
                    className="border-slate-200 bg-slate-50/50"
                    title={
                        <span className="font-semibold text-slate-800 text-xs">
                            Đề Xuất Kết Luận & Ghi Chú Tổng Quan
                        </span>
                    }
                >
                    <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-600 font-medium">Chuẩn đầu ra (CĐR):</span>
                            <Tag color={suggestion.programOutcome === 'MEETS_PROGRAM_OUTCOMES' ? 'green' : 'volcano'}>
                                {suggestion.programOutcome === 'MEETS_PROGRAM_OUTCOMES' ? 'Đạt chuẩn đầu ra' : 'Không đạt chuẩn đầu ra'}
                            </Tag>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-600 font-medium">Đề xuất ra bảo vệ:</span>
                            <Tag color={suggestion.defenseRecommendation === 'APPROVE_FOR_DEFENSE' ? 'green' : 'volcano'}>
                                {suggestion.defenseRecommendation === 'APPROVE_FOR_DEFENSE' ? 'Đồng ý cho ra bảo vệ' : 'Không đồng ý cho bảo vệ'}
                            </Tag>
                        </div>
                        {suggestion.generalNotes && (
                            <div className="pt-1">
                                <span className="text-slate-600 font-medium">Ghi chú tổng quan:</span>
                                <div className="text-slate-700 bg-white p-2 rounded border border-slate-200 mt-1">
                                    {suggestion.generalNotes}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </Drawer>
    );
}

