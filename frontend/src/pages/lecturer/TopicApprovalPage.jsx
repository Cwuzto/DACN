import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Typography, Flex, Space, Avatar, Tooltip, Badge, Modal, Input, message } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { topicService } from '../../services/topicService';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Xóa mockApprovals

const statusConfig = {
    PENDING: { label: 'Chờ duyệt', color: 'warning' },
    APPROVED: { label: 'Đã duyệt', color: 'success' },
    REJECTED: { label: 'Từ chối', color: 'error' },
};

const getColumns = (handleApprove, setRejectingRecord, setRejectModalOpen) => {
    return [
        {
            title: 'Nhóm', dataIndex: 'group', key: 'group', width: 100,
            render: (text) => <Tag icon={<TeamOutlined />}>{text}</Tag>,
        },
        {
            title: 'Thành viên', dataIndex: 'members', key: 'members',
            render: (members) => (
                <Flex gap={4} wrap="wrap">
                    <Avatar.Group maxCount={3} size="small">
                        {members.map((m, i) => (
                            <Tooltip key={i} title={m}>
                                <Avatar size="small" style={{ background: ['#1677FF', '#722ed1', '#13C2C2'][i % 3] }}>
                                    {m[0]}
                                </Avatar>
                            </Tooltip>
                        ))}
                    </Avatar.Group>
                    <Text type="secondary" style={{ fontSize: 12 }}>{members.length} SV</Text>
                </Flex>
            ),
        },
        {
            title: 'Đề tài đăng ký', dataIndex: 'topic', key: 'topic',
            render: (text) => <Text strong style={{ fontSize: 13 }}>{text}</Text>,
        },
        {
            title: 'Ngày nộp', dataIndex: 'createdAt', key: 'createdAt',
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
                    <Tooltip title="Xem chi tiết"><Button type="text" size="small" icon={<EyeOutlined />} /></Tooltip>
                    {record.status === 'PENDING' && (
                        <>
                            <Tooltip title="Duyệt">
                                <Button type="text" size="small" style={{ color: '#52c41a' }} icon={<CheckOutlined />} onClick={() => handleApprove(record)} />
                            </Tooltip>
                            <Tooltip title="Từ chối">
                                <Button type="text" size="small" danger icon={<CloseOutlined />} onClick={() => {
                                    setRejectingRecord(record);
                                    setRejectModalOpen(true);
                                }} />
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
                const mappedData = res.data.map(topic => {
                    const group = topic.studentGroup;
                    const members = group?.members?.map(m => m.student.fullName) || [topic.proposedBy.fullName];
                    return {
                        key: topic.id,
                        id: topic.id,
                        group: group?.groupName || 'Chưa tạo nhóm',
                        members: members,
                        topic: topic.title,
                        createdAt: topic.createdAt,
                        status: topic.status,
                    };
                });
                setApprovals(mappedData);
            }
        } catch (error) {
            message.error('Lỗi khi tải danh sách chờ duyệt: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = (record) => {
        Modal.confirm({
            title: 'Xác nhận duyệt đề tài',
            content: `Bạn duyệt hệ tài "${record.topic}" cho nhóm ${record.group}?`,
            onOk: async () => {
                try {
                    const res = await topicService.changeStatus(record.id, { status: 'APPROVED' });
                    if (res.success) {
                        message.success('Đã duyệt đề tài thành công');
                        fetchApprovals();
                    }
                } catch (error) {
                    message.error(error.message);
                }
            }
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
            message.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const pendingCount = approvals.filter(a => a.status === 'PENDING').length;

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>
                        Duyệt đề tài / Nhóm đăng ký
                        <Badge count={pendingCount} style={{ marginLeft: 12 }} />
                    </Title>
                    <Text type="secondary">Xem xét và duyệt các yêu cầu đăng ký đề tài từ sinh viên</Text>
                </div>
            </Flex>

            <Card style={{ borderRadius: 10 }} styles={{ body: { padding: 0 } }}>
                <Table
                    dataSource={approvals}
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
                <Text>Nhập lý do từ chối đề tài của nhóm {rejectingRecord?.group}:</Text>
                <TextArea
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Lý do..."
                    style={{ marginTop: 12 }}
                />
            </Modal>
        </div>
    );
}

export default TopicApprovalPage;