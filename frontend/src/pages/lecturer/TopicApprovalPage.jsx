import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Typography, Flex, Space, Tooltip, Badge, Modal, Input, message } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { topicService } from '../../services/topicService';

const { Title, Text } = Typography;
const { TextArea } = Input;

const statusConfig = {
    PENDING: { label: 'Chờ duyệt', color: 'warning' },
    APPROVED: { label: 'Đã duyệt', color: 'success' },
    REJECTED: { label: 'Từ chối', color: 'error' },
};

const getColumns = (handleApprove, setRejectingRecord, setRejectModalOpen) => {
    return [
        {
            title: 'Sinh viên đề xuất', dataIndex: 'proposedBy', key: 'proposedBy', width: 220,
            render: (proposedBy) => (
                <Flex gap={8} align="center">
                    <Tag icon={<UserOutlined />}>{proposedBy?.code || 'N/A'}</Tag>
                    <Text strong>{proposedBy?.fullName || 'Sinh viên'}</Text>
                </Flex>
            ),
        },
        {
            title: 'Đề tài đề xuất', dataIndex: 'title', key: 'title',
            render: (title) => <Text strong style={{ fontSize: 13 }}>{title}</Text>,
        },
        {
            title: 'GV hướng dẫn', dataIndex: ['mentor', 'fullName'], key: 'mentor',
            render: (name) => <Text>{name || 'Chưa có'}</Text>,
        },
        {
            title: 'Ngày nộp', dataIndex: 'createdAt', key: 'createdAt', width: 120,
            render: (text) => <Text type="secondary">{dayjs(text).format('DD/MM/YYYY')}</Text>,
        },
        {
            title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 130,
            render: (status) => {
                const cfg = statusConfig[status] || { label: status, color: 'default' };
                return <Tag color={cfg.color}>{cfg.label}</Tag>;
            },
        },
        {
            title: 'Hành động', key: 'action', width: 160, align: 'center',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Xem chi tiết">
                        <Button type="text" size="small" icon={<EyeOutlined />} />
                    </Tooltip>
                    {record.status === 'PENDING' && (
                        <>
                            <Tooltip title="Duyệt">
                                <Button type="text" size="small" style={{ color: '#52c41a' }} icon={<CheckOutlined />} onClick={() => handleApprove(record)} />
                            </Tooltip>
                            <Tooltip title="Từ chối">
                                <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<CloseOutlined />}
                                    onClick={() => {
                                        setRejectingRecord(record);
                                        setRejectModalOpen(true);
                                    }}
                                />
                            </Tooltip>
                        </>
                    )}
                </Space>
            ),
        },
    ];
};

function TopicApprovalPage() {
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectingRecord, setRejectingRecord] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchApprovals();
    }, []);

    const fetchApprovals = async () => {
        try {
            setLoading(true);
            const res = await topicService.getApprovals();
            if (res.success) {
                setApprovals(res.data || []);
            }
        } catch (error) {
            message.error('Lỗi khi tải danh sách chờ duyệt: ' + (error?.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = (record) => {
        Modal.confirm({
            title: 'Xác nhận duyệt đề tài',
            content: `Bạn duyệt đề tài "${record.title}" của sinh viên ${record.proposedBy?.fullName || ''}?`,
            onOk: async () => {
                try {
                    const res = await topicService.changeStatus(record.id, { status: 'APPROVED' });
                    if (res.success) {
                        message.success('Đã duyệt đề tài thành công');
                        fetchApprovals();
                    }
                } catch (error) {
                    message.error(error?.message || 'Không thể duyệt đề tài');
                }
            },
        });
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) return message.warning('Vui lòng nhập lý do từ chối');
        try {
            setSubmitting(true);
            const res = await topicService.changeStatus(rejectingRecord.id, { status: 'REJECTED', rejectReason });
            if (res.success) {
                message.success('Đã từ chối đề tài');
                setRejectModalOpen(false);
                setRejectReason('');
                setRejectingRecord(null);
                fetchApprovals();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể từ chối đề tài');
        } finally {
            setSubmitting(false);
        }
    };

    const pendingCount = approvals.filter((approval) => approval.status === 'PENDING').length;

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>
                        Duyệt đề tài sinh viên đề xuất
                        <Badge count={pendingCount} style={{ marginLeft: 12 }} />
                    </Title>
                    <Text type="secondary">Xem xét và duyệt các đề tài do sinh viên đề xuất</Text>
                </div>
            </Flex>

            <Card style={{ borderRadius: 10 }} styles={{ body: { padding: 0 } }}>
                <Table
                    dataSource={approvals}
                    rowKey="id"
                    columns={getColumns(handleApprove, setRejectingRecord, setRejectModalOpen)}
                    pagination={{ pageSize: 10 }}
                    size="middle"
                    loading={loading}
                />
            </Card>

            <Modal
                title="Từ chối đề tài"
                open={rejectModalOpen}
                onCancel={() => {
                    setRejectModalOpen(false);
                    setRejectReason('');
                    setRejectingRecord(null);
                }}
                onOk={handleReject}
                confirmLoading={submitting}
                okText="Từ chối"
                okButtonProps={{ danger: true }}
            >
                <Text>Nhập lý do từ chối đề tài của sinh viên {rejectingRecord?.proposedBy?.fullName || ''}:</Text>
                <TextArea
                    rows={4}
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="Lý do..."
                    style={{ marginTop: 12 }}
                />
            </Modal>
        </div>
    );
}

export default TopicApprovalPage;
