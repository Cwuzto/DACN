import React from 'react';
import {
    Modal,
    Typography,
    Space,
    Tag,
    Alert,
    Progress,
    Card,
    Table,
    List,
    Button,
    Divider,
    Spin,
    Flex,
} from 'antd';
import {
    AuditOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    CloseCircleOutlined,
    BulbOutlined,
    CheckOutlined,
    BookOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function TopicSimilarityModal({
    open,
    onClose,
    data,
    loading = false,
    onSelectTitle,
}) {
    const similarityScore = typeof data?.maxSimilarityPercentage === 'number' ? data.maxSimilarityPercentage : 0;
    const riskLevel = data?.riskLevel || 'NOVEL';
    const verdict = data?.verdict || '';
    const matchedTopics = Array.isArray(data?.matchedTopics) ? data.matchedTopics : [];
    const suggestions = Array.isArray(data?.refinedTitleSuggestions) ? data.refinedTitleSuggestions : [];
    const provider = data?.provider || 'gemini-2.0-flash';
    const isFallback = provider === 'local_fallback';

    const getProgressStatus = (score) => {
        if (score >= 70) return 'exception';
        if (score >= 40) return 'normal';
        return 'success';
    };

    const getRiskTag = () => {
        if (riskLevel === 'HIGH_DUPLICATE_RISK') {
            return <Tag color="error" icon={<CloseCircleOutlined />}>Nguy cơ trùng lặp cao</Tag>;
        }
        if (riskLevel === 'MODERATE_SIMILARITY') {
            return <Tag color="warning" icon={<WarningOutlined />}>Tương đồng vừa phải</Tag>;
        }
        return <Tag color="success" icon={<CheckCircleOutlined />}>Đề tài có tính mới cao</Tag>;
    };

    const matchedColumns = [
        {
            title: 'Tên đề tài đã thực hiện',
            dataIndex: 'title',
            key: 'title',
            width: 260,
            render: (title, row) => (
                <div>
                    <div className="font-semibold text-xs text-slate-900">{title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                        {row.mentorName ? `GVHD: ${row.mentorName}` : ''}
                        {row.semester ? ` · ${row.semester}` : ''}
                    </div>
                </div>
            ),
        },
        {
            title: 'Tương đồng',
            dataIndex: 'similarityPercentage',
            key: 'similarityPercentage',
            width: 100,
            align: 'center',
            render: (pct) => (
                <Tag color={pct >= 70 ? 'error' : pct >= 40 ? 'warning' : 'success'} className="font-bold text-xs">
                    {pct}%
                </Tag>
            ),
        },
        {
            title: 'Điểm tương đồng & Khác biệt',
            key: 'details',
            render: (_, row) => (
                <div className="text-xs space-y-1">
                    {row.similarities && (
                        <div>
                            <span className="font-semibold text-slate-700">Giống: </span>
                            <span className="text-slate-600">{row.similarities}</span>
                        </div>
                    )}
                    {row.differences && (
                        <div>
                            <span className="font-semibold text-teal-700">Khác biệt: </span>
                            <span className="text-slate-600">{row.differences}</span>
                        </div>
                    )}
                </div>
            ),
        },
    ];

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={780}
            title={(
                <Flex align="center" justify="space-between" wrap="wrap" gap={8}>
                    <Space size="middle">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700">
                            <AuditOutlined style={{ fontSize: 18 }} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-800 text-sm">
                                Kiểm Tra Tính Mới &amp; Tương Đồng Đề Tài (AI)
                            </div>
                            <div className="text-xs text-slate-500">
                                Đối chiếu ngữ nghĩa với kho đề tài lịch sử trong CSDL
                            </div>
                        </div>
                    </Space>
                    <Tag color={isFallback ? 'default' : 'cyan'} className="font-mono text-[11px]">
                        {isFallback ? 'Quy tắc nội bộ (Offline)' : 'Gemini 2.0 Flash'}
                    </Tag>
                </Flex>
            )}
            footer={[
                <Button key="close" onClick={onClose}>
                    Đóng
                </Button>,
            ]}
        >
            <Spin spinning={loading} tip="AI đang so khớp ngữ nghĩa với kho đề tài...">
                {data ? (
                    <div className="py-2 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                        {/* Similarity Score Metric */}
                        <Card size="small" className="border-slate-200 bg-slate-50/50">
                            <Flex align="center" justify="space-between" wrap="wrap" gap={12}>
                                <div className="space-y-1">
                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Mức độ tương đồng cao nhất
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl font-bold font-mono text-slate-900">
                                            {similarityScore}%
                                        </span>
                                        {getRiskTag()}
                                    </div>
                                </div>
                                <div className="w-48 sm:w-64">
                                    <Progress
                                        percent={similarityScore}
                                        status={getProgressStatus(similarityScore)}
                                        strokeWidth={10}
                                        showInfo={false}
                                    />
                                </div>
                            </Flex>
                            {verdict && (
                                <Paragraph className="text-xs text-slate-600 mt-2 mb-0 leading-relaxed">
                                    {verdict}
                                </Paragraph>
                            )}
                        </Card>

                        {/* Matched Topics Table */}
                        {matchedTopics.length > 0 && (
                            <div>
                                <div className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <BookOutlined className="text-teal-700" />
                                    <span>Các đề tài có điểm tương đồng trong kho CSDL ({matchedTopics.length})</span>
                                </div>
                                <Table
                                    size="small"
                                    dataSource={matchedTopics}
                                    columns={matchedColumns}
                                    rowKey={(r, idx) => r.topicId || idx}
                                    pagination={false}
                                    bordered
                                    className="bg-white"
                                />
                            </div>
                        )}

                        {/* Refined Title Suggestions */}
                        {suggestions.length > 0 && (
                            <div>
                                <div className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <BulbOutlined className="text-amber-500" />
                                    <span>Gợi ý điều chỉnh tên đề tài tăng tính mới &amp; tính khoa học</span>
                                </div>
                                <div className="space-y-2">
                                    {suggestions.map((sug, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 border border-slate-200 rounded-lg bg-white flex items-center justify-between gap-3 hover:border-teal-400 transition-colors"
                                        >
                                            <div className="text-xs text-slate-800 font-medium">
                                                <span className="font-bold text-teal-700 mr-2">{idx + 1}.</span>
                                                {sug}
                                            </div>
                                            {onSelectTitle && (
                                                <Button
                                                    size="small"
                                                    type="primary"
                                                    ghost
                                                    icon={<CheckOutlined />}
                                                    onClick={() => onSelectTitle(sug)}
                                                >
                                                    Áp dụng tên này
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-12 text-center text-slate-400 text-sm">
                        Chưa có dữ liệu phân tích tính mới đề tài.
                    </div>
                )}
            </Spin>
        </Modal>
    );
}

