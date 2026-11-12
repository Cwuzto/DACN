import React from 'react';
import {
    Drawer,
    Typography,
    Space,
    Tag,
    Alert,
    Progress,
    Card,
    List,
    Button,
    Divider,
    Spin,
    Flex,
} from 'antd';
import {
    RobotOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    CloseCircleOutlined,
    BulbOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function BM01CopilotDrawer({
    open,
    onClose,
    data,
    loading = false,
}) {
    const overallScore = typeof data?.overallScore === 'number' ? data.overallScore : null;
    const status = data?.status || 'ACCEPTABLE';
    const dimensions = Array.isArray(data?.dimensions) ? data.dimensions : [];
    const suggestions = Array.isArray(data?.actionableSuggestions) ? data.actionableSuggestions : [];
    const provider = data?.provider || 'gemini-2.0-flash';
    const isFallback = provider === 'local_fallback';

    const getScoreColor = (score) => {
        if (score >= 8.0) return '#10B981';
        if (score >= 6.5) return '#0F766E';
        if (score >= 5.0) return '#F59E0B';
        return '#EF4444';
    };

    const getStatusTag = () => {
        if (status === 'GOOD') {
            return <Tag color="success" icon={<CheckCircleOutlined />}>Đề cương đạt chuẩn</Tag>;
        }
        if (status === 'NEEDS_IMPROVEMENT') {
            return <Tag color="warning" icon={<WarningOutlined />}>Cần bổ sung hoàn thiện</Tag>;
        }
        return <Tag color="error" icon={<CloseCircleOutlined />}>Thiếu sót nghiêm trọng</Tag>;
    };

    const getDimensionIcon = (dimStatus) => {
        if (dimStatus === 'PASS') {
            return <CheckCircleOutlined style={{ color: '#10B981', fontSize: 16 }} />;
        }
        if (dimStatus === 'WARNING') {
            return <WarningOutlined style={{ color: '#F59E0B', fontSize: 16 }} />;
        }
        return <CloseCircleOutlined style={{ color: '#EF4444', fontSize: 16 }} />;
    };

    return (
        <Drawer
            open={open}
            onClose={onClose}
            width={580}
            title={(
                <Flex align="center" justify="space-between" wrap="wrap" gap={8}>
                    <Space size="middle">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700">
                            <RobotOutlined style={{ fontSize: 18 }} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-800 text-sm">
                                BM01 Copilot — Trợ Lý Đề Cương
                            </div>
                            <div className="text-xs text-slate-500">
                                Đánh giá logic &amp; tính khả thi đề cương đồ án
                            </div>
                        </div>
                    </Space>
                    <Tag color={isFallback ? 'default' : 'cyan'} className="font-mono text-[11px]">
                        {isFallback ? 'Quy tắc nội bộ (Offline)' : 'Gemini 2.0 Flash'}
                    </Tag>
                </Flex>
            )}
            footer={(
                <Flex justify="flex-end" gap={8}>
                    <Button onClick={onClose}>
                        Đóng
                    </Button>
                </Flex>
            )}
        >
            <Spin spinning={loading} tip="AI đang phân tích tính logic đề cương...">
                {data ? (
                    <div className="space-y-4">
                        {/* Overall Score & Status */}
                        <Card size="small" className="border-teal-100 bg-teal-50/30">
                            <Flex align="center" gap={16}>
                                <div className="text-center">
                                    <Progress
                                        type="circle"
                                        percent={overallScore ? Math.round(overallScore * 10) : 0}
                                        format={() => `${overallScore != null ? Number(overallScore).toFixed(1) : '—'}/10`}
                                        strokeColor={overallScore ? getScoreColor(overallScore) : '#0F766E'}
                                        size={76}
                                    />
                                    <div className="text-[11px] font-semibold text-slate-600 mt-1">
                                        Điểm hoàn thiện
                                    </div>
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div>{getStatusTag()}</div>
                                    <Paragraph className="text-xs text-slate-700 m-0 leading-relaxed">
                                        {data.summary || 'Đề cương đã được rà soát cấu trúc tổng thể.'}
                                    </Paragraph>
                                </div>
                            </Flex>
                        </Card>

                        {/* 5-Dimensional Logic Evaluation */}
                        <div>
                            <div className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <SafetyCertificateOutlined className="text-teal-700" />
                                <span>Phân tích tính logic 5 chiều</span>
                            </div>
                            <div className="space-y-2">
                                {dimensions.map((dim, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3 border rounded-lg bg-white border-slate-200 hover:border-slate-300 transition-colors"
                                    >
                                        <Flex align="flex-start" gap={10}>
                                            <div className="pt-0.5">{getDimensionIcon(dim.status)}</div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-semibold text-xs text-slate-900">
                                                        {dim.name}
                                                    </span>
                                                    <Tag
                                                        color={dim.status === 'PASS' ? 'success' : dim.status === 'WARNING' ? 'warning' : 'error'}
                                                        className="text-[10px]"
                                                    >
                                                        {dim.status === 'PASS' ? 'Đạt' : dim.status === 'WARNING' ? 'Cảnh báo' : 'Chưa đạt'}
                                                    </Tag>
                                                </div>
                                                <div className="text-xs text-slate-600 mt-1 leading-normal">
                                                    {dim.feedback}
                                                </div>
                                            </div>
                                        </Flex>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Actionable Suggestions */}
                        {suggestions.length > 0 && (
                            <div>
                                <div className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <BulbOutlined className="text-amber-500" />
                                    <span>Gợi ý cải thiện trước khi nộp chính thức</span>
                                </div>
                                <List
                                    size="small"
                                    bordered
                                    dataSource={suggestions}
                                    className="bg-amber-50/20 border-amber-200 rounded-lg"
                                    renderItem={(item, index) => (
                                        <List.Item className="text-xs text-slate-700 py-2.5">
                                            <Space align="start">
                                                <span className="font-bold text-amber-600 min-w-4 text-xs">{index + 1}.</span>
                                                <span>{item}</span>
                                            </Space>
                                        </List.Item>
                                    )}
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-12 text-center text-slate-400 text-sm">
                        Chưa có dữ liệu đánh giá. Vui lòng bấm &quot;Đánh giá đề cương với AI&quot; trong biểu mẫu.
                    </div>
                )}
            </Spin>
        </Drawer>
    );
}

