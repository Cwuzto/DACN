import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Badge, Modal, Input, message, Typography, Flex } from 'antd';
import { CheckOutlined, CloseOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import registrationService from '../../services/registrationService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

const { TextArea } = Input;
const { Text } = Typography;

function TopicApprovalPage() {
    const [pendingRegistrations, setPendingRegistrations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectingRecord, setRejectingRecord] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const registrationRes = await registrationService.getAllRegistrations({ status: 'PENDING' });
            if (registrationRes.success) {
                setPendingRegistrations(registrationRes.data || []);
            }
        } catch (error) {
            message.error(`Lỗi khi tải danh sách chờ duyệt: ${error?.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleApproveRegistration = (record) => {
        Modal.confirm({
            title: 'Xác nhận duyệt đăng ký',
            content: `Duyệt sinh viên ${record.student?.fullName || ''} vào đề tài "${record.topic?.title || ''}"?`,
            onOk: async () => {
                try {
                    const res = await registrationService.handleRegistration(record.id, 'APPROVE');
                    if (res.success) {
                        message.success('Đã duyệt đăng ký thành công');
                        fetchData();
                    }
                } catch (error) {
                    message.error(error?.message || 'Không thể duyệt đăng ký');
                }
            },
        });
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            return message.warning('Vui lòng nhập lý do từ chối');
        }

        try {
            setSubmitting(true);
            const res = await registrationService.handleRegistration(
                rejectingRecord.id,
                'REJECT',
                rejectReason.trim(),
            );

            if (res?.success) {
                message.success('Đã từ chối đăng ký');
                setRejectModalOpen(false);
                setRejectReason('');
                setRejectingRecord(null);
                fetchData();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể từ chối đăng ký');
        } finally {
            setSubmitting(false);
        }
    };

    const registrationColumns = [
        {
            title: 'Sinh viên đăng ký', dataIndex: 'student', key: 'student', width: 230,
            render: (student) => (
                <Flex gap={8} align="center">
                    <Tag icon={<UserOutlined />}>{student?.code || 'N/A'}</Tag>
                    <Text strong>{student?.fullName || 'Sinh viên'}</Text>
                </Flex>
            ),
        },
        {
            title: 'Đề tài', dataIndex: ['topic', 'title'], key: 'topic',
            render: (title) => <Text strong style={{ fontSize: 13 }}>{title || 'N/A'}</Text>,
        },
        {
            title: 'Ngày đăng ký', dataIndex: 'createdAt', key: 'createdAt', width: 120,
            render: (text) => <Text type="secondary">{dayjs(text).format('DD/MM/YYYY')}</Text>,
        },
        {
            title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 120,
            render: (status) => <StatusBadge status={status} />,
        },
        {
            title: 'Hành động', key: 'action', width: 160, align: 'center',
            render: (_, record) => (
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button size="small" className="text-xs font-medium border-green-200 text-green-700 shadow-sm bg-green-50/50 hover:text-green-800 hover:border-green-300 hover:bg-green-100" icon={<CheckOutlined />} onClick={() => handleApproveRegistration(record)}>
                        Duyệt
                    </Button>
                    <Button
                        size="small"
                        className="text-xs font-medium border-red-200 text-red-600 shadow-sm bg-red-50/50 hover:text-red-700 hover:border-red-300 hover:bg-red-100"
                        danger
                        icon={<CloseOutlined />}
                        onClick={() => {
                            setRejectingRecord(record);
                            setRejectReason('');
                            setRejectModalOpen(true);
                        }}
                    >
                        Từ chối
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div>
            <PageHeader
                title="Duyệt đăng ký đề tài"
                subtitle="Xử lý các đăng ký đề tài chờ duyệt của sinh viên"
                actions={pendingRegistrations.length > 0 ? <Badge count={pendingRegistrations.length} /> : null}
            />

            <Card title={`Đăng ký đề tài chờ duyệt (${pendingRegistrations.length})`} style={{ borderRadius: 10 }} styles={{ body: { padding: 0 } }}>
                <Table
                    dataSource={pendingRegistrations}
                    rowKey="id"
                    columns={registrationColumns}
                    pagination={{ pageSize: 8 }}
                    size="middle"
                    loading={loading}
                    locale={{ emptyText: 'Không có đăng ký đề tài chờ duyệt' }}
                />
            </Card>

            <Modal
                title="Từ chối đăng ký"
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
                <Text>
                    Nhập lý do từ chối đăng ký của sinh viên {rejectingRecord?.student?.fullName || ''}:
                </Text>
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