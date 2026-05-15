import { useEffect, useMemo, useState } from 'react';
import {
    Badge,
    Button,
    Card,
    Flex,
    Input,
    Modal,
    Table,
    Tag,
    Typography,
    message,
} from 'antd';
import {
    CheckOutlined,
    CloseOutlined,
    ReloadOutlined,
    SearchOutlined,
    UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import registrationService from '../../services/registrationService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';

const { Text } = Typography;
const { TextArea } = Input;

function TopicApprovalPage() {
    const [pendingRegistrations, setPendingRegistrations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');

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
            message.error(error?.message || 'Không thể tải danh sách chờ duyệt');
        } finally {
            setLoading(false);
        }
    };

    const filteredRegistrations = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();
        if (!keyword) return pendingRegistrations;
        return pendingRegistrations.filter((record) => {
            const studentName = record.student?.fullName?.toLowerCase() || '';
            const studentCode = record.student?.code?.toLowerCase() || '';
            const topicTitle = record.topic?.title?.toLowerCase() || '';
            return studentName.includes(keyword) || studentCode.includes(keyword) || topicTitle.includes(keyword);
        });
    }, [pendingRegistrations, searchText]);

    const handleApproveRegistration = (record) => {
        Modal.confirm({
            title: 'Xác nhận duyệt đăng ký',
            content: `Duyệt ${record.student?.fullName || 'sinh viên'} vào đề tài "${record.topic?.title || ''}"?`,
            okText: 'Duyệt',
            cancelText: 'Hủy',
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
            title: 'Sinh viên',
            dataIndex: 'student',
            key: 'student',
            width: 250,
            render: (student) => (
                <Flex gap={8} align="center">
                    <Tag icon={<UserOutlined />} className="!px-2 !py-1 !text-xs">
                        {student?.code || 'N/A'}
                    </Tag>
                    <Text strong>{student?.fullName || 'Sinh viên'}</Text>
                </Flex>
            ),
        },
        {
            title: 'Đề tài',
            dataIndex: ['topic', 'title'],
            key: 'topic',
            render: (title) => <Text strong className="text-slate-800">{title || 'N/A'}</Text>,
        },
        {
            title: 'Ngày đăng ký',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 160,
            render: (text) => (
                <Flex vertical gap={0}>
                    <Text>{dayjs(text).format('DD/MM/YYYY')}</Text>
                    <Text type="secondary" className="text-xs">{dayjs(text).format('HH:mm')}</Text>
                </Flex>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status) => <StatusBadge status={status} />,
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 190,
            align: 'right',
            render: (_, record) => (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        size="small"
                        type="primary"
                        icon={<CheckOutlined />}
                        onClick={() => handleApproveRegistration(record)}
                    >
                        Duyệt
                    </Button>
                    <Button
                        size="small"
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
        <div className="py-2">
            <PageHeader
                title="Duyệt đăng ký đề tài"
                subtitle="Xem nhanh các yêu cầu đăng ký đề tài của sinh viên"
                actions={pendingRegistrations.length > 0 ? <Badge count={pendingRegistrations.length} /> : null}
            />

            <Card className="!rounded-2xl" styles={{ body: { padding: 16 } }}>
                <div className="flex flex-col gap-3 mb-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-800">
                            Danh sách chờ duyệt ({filteredRegistrations.length}/{pendingRegistrations.length})
                        </div>
                        <Button icon={<ReloadOutlined />} onClick={fetchData}>Làm mới</Button>
                    </div>
                    <Input
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        placeholder="Tìm theo tên SV, mã SV hoặc tên đề tài..."
                        prefix={<SearchOutlined className="text-slate-400" />}
                        allowClear
                    />
                </div>

                <Table
                    dataSource={filteredRegistrations}
                    rowKey="id"
                    columns={registrationColumns}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    size="middle"
                    loading={loading}
                    rowClassName={(_, index) => (index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}
                    locale={{ emptyText: 'Không có đăng ký đề tài cho duyệt' }}
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
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
            >
                <Text>
                    Nhập lý do từ chối cho sinh viên <b>{rejectingRecord?.student?.fullName || ''}</b>:
                </Text>
                <TextArea
                    rows={4}
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="Lý do từ chối..."
                    style={{ marginTop: 12 }}
                />
            </Modal>
        </div>
    );
}

export default TopicApprovalPage;
