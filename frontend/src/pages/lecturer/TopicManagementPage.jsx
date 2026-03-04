import { useState, useEffect, useCallback } from 'react';
import {
    Card, Table, Tag, Button, Input, Select, Typography, Flex, Space,
    Tooltip, Modal, Form, message, Popconfirm,
} from 'antd';
import {
    PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SendOutlined,
} from '@ant-design/icons';
import { topicService } from '../../services/topicService';
import useAuthStore from '../../stores/authStore';

const { Title, Text } = Typography;
const { TextArea } = Input;

const statusConfig = {
    DRAFT: { label: 'Bản nháp', color: 'default' },
    PENDING: { label: 'Chờ duyệt', color: 'warning' },
    APPROVED: { label: 'Đã duyệt', color: 'success' },
    REJECTED: { label: 'Từ chối', color: 'error' },
};

function TopicManagementPage() {
    const user = useAuthStore((s) => s.user);
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    const fetchTopics = useCallback(async () => {
        setLoading(true);
        try {
            const params = { mentorId: user?.id };
            if (statusFilter !== 'all') params.status = statusFilter;
            if (searchText) params.search = searchText;
            const res = await topicService.getAll(params);
            setTopics(res.data.map((t, i) => ({ ...t, key: t.id, stt: i + 1 })));
        } catch {
            message.error('Không thể tải danh sách đề tài.');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, searchText, user]);

    useEffect(() => { fetchTopics(); }, [fetchTopics]);

    const openFormModal = (topic = null) => {
        setEditingTopic(topic);
        if (topic) {
            form.setFieldsValue({ title: topic.title, description: topic.description, maxGroups: topic.maxGroups, semesterId: topic.semesterId });
        } else {
            form.resetFields();
            form.setFieldsValue({ maxGroups: 1, semesterId: 1 });
        }
        setFormModalOpen(true);
    };

    // Lưu nháp
    const handleSaveDraft = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingTopic) {
                await topicService.update(editingTopic.id, { ...values, status: 'DRAFT' });
                message.success('Đã lưu bản nháp.');
            } else {
                await topicService.create({ ...values, status: 'DRAFT' });
                message.success('Đã lưu bản nháp đề tài.');
            }
            setFormModalOpen(false);
            fetchTopics();
        } catch (err) {
            if (err?.message) message.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Gửi duyệt
    const handleSubmitForApproval = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingTopic) {
                await topicService.update(editingTopic.id, { ...values, status: 'PENDING' });
            } else {
                await topicService.create({ ...values, status: 'PENDING' });
            }
            message.success('Đã gửi đề tài đi phê duyệt.');
            setFormModalOpen(false);
            fetchTopics();
        } catch (err) {
            if (err?.message) message.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Gửi DRAFT đi duyệt (từ nút trên bảng)
    const handleSendForApproval = async (id) => {
        try {
            await topicService.update(id, { status: 'PENDING' });
            message.success('Đã gửi đề tài đi phê duyệt.');
            fetchTopics();
        } catch (err) {
            message.error(err?.message || 'Có lỗi xảy ra.');
        }
    };

    const handleDelete = async (id) => {
        try {
            await topicService.delete(id);
            message.success('Đã xóa bản nháp.');
            fetchTopics();
        } catch (err) {
            message.error(err?.message || 'Không thể xóa.');
        }
    };

    const columns = [
        { title: 'STT', dataIndex: 'stt', key: 'stt', width: 60, align: 'center' },
        {
            title: 'Tên đề tài', dataIndex: 'title', key: 'title',
            render: (text, record) => (
                <div>
                    <Text strong>{text}</Text>
                    <div><Text type="secondary" style={{ fontSize: 12 }}>Mã: DT-{String(record.id).padStart(3, '0')}</Text></div>
                </div>
            ),
        },
        {
            title: 'Nhóm đăng ký', key: 'groups', align: 'center', width: 120,
            render: (_, record) => <Tag>{record._count?.groups || 0}/{record.maxGroups}</Tag>,
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
                    <Tooltip title="Xem"><Button type="text" size="small" icon={<EyeOutlined />} /></Tooltip>
                    {['DRAFT', 'REJECTED'].includes(record.status) && (
                        <>
                            <Tooltip title="Sửa"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openFormModal(record)} /></Tooltip>
                            <Tooltip title="Gửi duyệt">
                                <Popconfirm title="Gửi đề tài này đi phê duyệt?" onConfirm={() => handleSendForApproval(record.id)}>
                                    <Button type="text" size="small" style={{ color: '#722ed1' }} icon={<SendOutlined />} />
                                </Popconfirm>
                            </Tooltip>
                        </>
                    )}
                    {record.status === 'DRAFT' && (
                        <Tooltip title="Xóa">
                            <Popconfirm title="Xóa bản nháp này?" onConfirm={() => handleDelete(record.id)}>
                                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];

    // Thêm cột lý do từ chối nếu có đề tài bị từ chối
    if (statusFilter === 'REJECTED' || topics.some(t => t.status === 'REJECTED')) {
        const rejectCol = {
            title: 'Lý do từ chối', dataIndex: 'rejectReason', key: 'rejectReason', width: 200,
            render: (text) => text ? <Text type="danger" style={{ fontSize: 12 }}>{text}</Text> : '—',
        };
        // Insert trước cột hành động
        if (!columns.find(c => c.key === 'rejectReason')) {
            columns.splice(columns.length - 1, 0, rejectCol);
        }
    }

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Quản lý Đề tài</Title>
                    <Text type="secondary">Danh sách đề tài bạn đang hướng dẫn</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openFormModal()} style={{ background: '#722ed1', borderColor: '#722ed1' }}>
                    Đề xuất đề tài mới
                </Button>
            </Flex>

            <Card style={{ borderRadius: 10 }} styles={{ body: { padding: 0 } }}>
                <Flex gap={12} style={{ padding: '16px 24px' }} justify="space-between" wrap="wrap">
                    <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        style={{ width: 180 }}
                        options={[
                            { value: 'all', label: 'Tất cả trạng thái' },
                            { value: 'DRAFT', label: 'Bản nháp' },
                            { value: 'PENDING', label: 'Chờ duyệt' },
                            { value: 'APPROVED', label: 'Đã duyệt' },
                            { value: 'REJECTED', label: 'Từ chối' },
                        ]}
                    />
                    <Input
                        placeholder="Tìm kiếm đề tài..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ width: 300 }}
                        allowClear
                    />
                </Flex>
                <Table
                    dataSource={topics}
                    columns={columns}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    size="middle"
                />
            </Card>

            {/* Modal tạo/sửa đề tài */}
            <Modal
                title={editingTopic ? 'Chỉnh sửa đề tài' : 'Đề xuất đề tài mới'}
                open={formModalOpen}
                onCancel={() => setFormModalOpen(false)}
                footer={
                    <Flex justify="space-between">
                        <Button onClick={() => setFormModalOpen(false)}>Hủy</Button>
                        <Space>
                            <Button onClick={handleSaveDraft} loading={submitting}>Lưu nháp</Button>
                            <Button type="primary" onClick={handleSubmitForApproval} loading={submitting} icon={<SendOutlined />}
                                style={{ background: '#722ed1', borderColor: '#722ed1' }}>
                                Gửi phê duyệt
                            </Button>
                        </Space>
                    </Flex>
                }
                width={600}
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="title" label="Tên đề tài" rules={[{ required: true, message: 'Vui lòng nhập tên đề tài' }]}>
                        <Input placeholder="Nhập tên đề tài" />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả chi tiết">
                        <TextArea rows={4} placeholder="Mô tả nội dung, phạm vi, công nghệ sử dụng..." />
                    </Form.Item>
                    <Flex gap={16}>
                        <Form.Item name="semesterId" label="Đợt đồ án" style={{ flex: 1 }} rules={[{ required: true }]}>
                            <Select placeholder="Chọn đợt" options={[{ value: 1, label: 'Đồ án CN - HK1 2026-2027' }]} />
                        </Form.Item>
                        <Form.Item name="maxGroups" label="Số nhóm tối đa" style={{ flex: 1 }}>
                            <Select options={[{ value: 1, label: '1 nhóm' }, { value: 2, label: '2 nhóm' }, { value: 3, label: '3 nhóm' }]} />
                        </Form.Item>
                    </Flex>
                </Form>
            </Modal>
        </div>
    );
}

export default TopicManagementPage;