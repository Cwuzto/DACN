import React from 'react';
import {
    Modal,
    Typography,
    Space,
    Tag,
    Alert,
    Card,
    Table,
    Button,
    Spin,
    Flex,
    Divider,
} from 'antd';
import {
    ScanOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    WarningOutlined,
    FileSearchOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function ArchivalCrossCheckModal({
    open,
    onClose,
    data,
    loading = false,
}) {
    const overallStatus = data?.overallStatus || 'MATCHED';
    const isMatched = overallStatus === 'MATCHED';
    const effectiveTitle = data?.effectiveOfficialTitle || '';
    const checklist = Array.isArray(data?.checklist) ? data.checklist : [];
    const discrepancies = Array.isArray(data?.discrepancies) ? data.discrepancies : [];
    const guidance = data?.academicAffairsGuidance || '';
    const provider = data?.provider || 'gemini-2.0-flash';
    const isFallback = provider === 'local_fallback';

    const columns = [
        {
            title: 'Hạng mục kiểm tra',
            dataIndex: 'field',
            key: 'field',
            width: 220,
            render: (field) => <span className="font-semibold text-xs text-slate-800">{field}</span>,
        },
        {
            title: 'Dữ liệu pháp lý (Hệ thống / BM02 / BM02-A)',
            dataIndex: 'expected',
            key: 'expected',
            render: (val) => <span className="text-xs text-teal-800 font-medium">{val || '—'}</span>,
        },
        {
            title: 'AI bóc tách từ tệp lưu chiểu',
            dataIndex: 'extracted',
            key: 'extracted',
            render: (val, row) => (
                <span className={`text-xs font-medium ${row.status === 'MISMATCH' ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                    {val || '—'}
                </span>
            ),
        },
        {
            title: 'Kết quả',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            align: 'center',
            render: (status) => {
                if (status === 'EXACT_MATCH' || status === 'CONSISTENT') {
                    return <Tag color="success" icon={<CheckCircleOutlined />}>Khớp 100%</Tag>;
                }
                return <Tag color="error" icon={<CloseCircleOutlined />}>Sai lệch</Tag>;
            },
        },
    ];

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={840}
            title={(
                <Flex align="center" justify="space-between" wrap="wrap" gap={8}>
                    <Space size="middle">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700">
                            <ScanOutlined style={{ fontSize: 18 }} />
                        </div>
                        <div>
                            <div className="font-bold text-slate-800 text-sm">
                                AI Đối Soát Hồ Sơ Lưu Chiểu Đồ Án
                            </div>
                            <div className="text-xs text-slate-500">
                                Đối chiếu tự động thông tin bìa tài liệu với Quyết định pháp lý
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
            <Spin spinning={loading} tip="AI đang đọc và đối soát trang bìa tài liệu...">
                {data ? (
                    <div className="py-2 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                        {/* Status Alert Banner */}
                        {isMatched ? (
                            <Alert
                                type="success"
                                showIcon
                                icon={<CheckCircleOutlined />}
                                message="Hồ sơ lưu chiểu hoàn toàn khớp với văn bản pháp lý"
                                description={guidance || 'Tên đề tài, thông tin sinh viên và GVHD hoàn toàn thống nhất. Đủ điều kiện để Giáo vụ duyệt thủ tục.'}
                            />
                        ) : (
                            <Alert
                                type="error"
                                showIcon
                                icon={<CloseCircleOutlined />}
                                message="Phát hiện điểm sai lệch trong hồ sơ lưu chiểu"
                                description={guidance || 'Tài liệu nộp có điểm khác biệt so với văn bản pháp lý. Vui lòng yêu cầu sinh viên kiểm tra lại.'}
                            />
                        )}

                        {/* Effective Official Title Reference */}
                        {effectiveTitle && (
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    Tên đề tài pháp lý có hiệu lực (BM02 / Phụ lục BM02-A)
                                </div>
                                <div className="text-xs font-bold text-slate-900 mt-1">
                                    {effectiveTitle}
                                </div>
                            </div>
                        )}

                        {/* Checklist Table */}
                        <div>
                            <div className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <FileSearchOutlined className="text-teal-700" />
                                <span>Bảng đối chiếu thông tin chi tiết</span>
                            </div>
                            <Table
                                size="small"
                                dataSource={checklist}
                                columns={columns}
                                rowKey={(r, idx) => r.field || idx}
                                pagination={false}
                                bordered
                                className="bg-white"
                            />
                        </div>

                        {/* Discrepancies Details if any */}
                        {discrepancies.length > 0 && (
                            <div>
                                <div className="font-bold text-rose-700 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <WarningOutlined />
                                    <span>Chi tiết các điểm sai lệch cần khắc phục</span>
                                </div>
                                <div className="space-y-1.5">
                                    {discrepancies.map((disc, idx) => (
                                        <div key={idx} className="p-2.5 rounded border border-rose-200 bg-rose-50 text-xs text-rose-800">
                                            {disc}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-12 text-center text-slate-400 text-sm">
                        Chưa có dữ liệu đối soát hồ sơ lưu chiểu.
                    </div>
                )}
            </Spin>
        </Modal>
    );
}

