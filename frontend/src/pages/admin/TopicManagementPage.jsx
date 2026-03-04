import { useState, useEffect, useCallback } from 'react';
import {
    Card, Table, Tag, Button, Input, Select, Typography, Flex, Space,
    Tabs, Badge, Avatar, Tooltip, Modal, Form, message, Popconfirm, Spin,
} from 'antd';
import {
    PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
    FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined, SendOutlined,
} from '@ant-design/icons';
import { topicService } from '../../services/topicService';
import { semesterService } from '../../services/semesterService';

const { Title, Text } = Typography;
const { TextArea } = Input;

const statusConfig = {
    DRAFT: { label: 'Bản nháp', color: 'default' },
    PENDING: { label: 'Chờ duyệt', color: 'warning' },
    APPROVED: { label: 'Đã duyệt', color: 'success' },
    REJECTED: { label: 'Từ chối', color: 'error' },
};

function TopicManagementPage() {
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('all');
    const [semesters, setSemesters] = useState([]);

    // Modal states
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailTopic, setDetailTopic] = useState(null);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectingTopicId, setRejectingTopicId] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [form] = Form.useForm();

    // Fetch topics
    const fetchTopics = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            if (searchText) params.search = searchText;

            const res = await topicService.getAll(params);
            setTopics(res.data.map((t, i) => ({ ...t, key: t.id, stt: i + 1 })));
        } catch (err) {
            message.error('Không thể tải danh sách đề tài.');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, searchText]);

    // Fetch semesters for Select
    const fetchSemesters = useCallback(async () => {
        try {
            const res = await semesterService.getAll();
            if (res.success) {
                setSemesters(res.data.map(s => ({ value: s.id, label: s.name })));
            }
        } catch (err) {
            // pass
        }
    }, []);

    useEffect(() => {
        fetchTopics();
        fetchSemesters();
    }, [fetchTopics, fetchSemesters]);

    // Handle tab change -> set statusFilter
    const handleTabChange = (key) => {
        setActiveTab(key);
        if (key === 'all') setStatusFilter('all');
        else if (key === 'pending') setStatusFilter('PENDING');
        else if (key === 'draft') setStatusFilter('DRAFT');
    };

    // Open create/edit modal
    const openFormModal = (topic = null) => {
        setEditingTopic(topic);
        if (topic) {
            form.setFieldsValue({
                title: topic.title,
                description: topic.description,
                maxGroups: topic.maxGroups,
                semesterId: topic.semesterId,
                mentorId: topic.mentorId,
            });
        } else {
            form.resetFields();
            form.setFieldsValue({ maxGroups: 1, semesterId: 1 });
        }
        setFormModalOpen(true);
    };

    // Lưu nháp (Admin)
    const handleSaveDraft = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingTopic) {
                await topicService.update(editingTopic.id, { ...values, status: 'DRAFT' });
                message.success('Đã cập nhật bản nháp.');
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

    // Tạo đề tài (duyệt ngay)
    const handleCreateApproved = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            if (editingTopic) {
                await topicService.update(editingTopic.id, { ...values, status: 'PENDING' });
                message.success('Đã gửi đề tài đi phê duyệt.');
            } else {
                await topicService.create({ ...values, status: 'APPROVED' });
                message.success('Tạo đề tài thành công.');
            }
            setFormModalOpen(false);
            fetchTopics();
        } catch (err) {
            if (err?.message) message.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Approve
    const handleApprove = async (id) => {
        try {
            await topicService.changeStatus(id, { status: 'APPROVED' });
            message.success('Đã duyệt đề tài.');
            fetchTopics();
        } catch (err) {
            message.error(err?.message || 'Không thể duyệt đề tài.');
        }
    };

    // Reject
    const handleReject = async () => {
        if (!rejectReason.trim()) {
            message.warning('Vui lòng nhập lý do từ chối.');
            return;
        }
        try {
            setSubmitting(true);
            await topicService.changeStatus(rejectingTopicId, { status: 'REJECTED', rejectReason });
            message.success('Đã từ chối đề tài.');
            setRejectModalOpen(false);
            setRejectReason('');
            fetchTopics();
        } catch (err) {
            message.error(err?.message || 'Không thể từ chối đề tài.');
        } finally {
            setSubmitting(false);
        }
    };

    // Delete
    const handleDelete = async (id) => {
        try {
            await topicService.delete(id);
            message.success('Xóa đề tài thành công.');
            fetchTopics();
        } catch (err) {
            message.error(err?.message || 'Không thể xóa đề tài.');
        }
    };

    // View detail
    const handleViewDetail = async (id) => {
        try {
            const res = await topicService.getById(id);
            setDetailTopic(res.data);
            setDetailModalOpen(true);
        } catch (err) {
            message.error('Không thể xem chi tiết đề tài.');
        }
    };

    const pendingCount = topics.filter(t => t.status === 'PENDING').length;

    const tabItems = [
        { key: 'all', label: 'Tất cả đề tài' },
        { key: 'pending', label: <Badge count={pendingCount} size="small" offset={[10, 0]}>Chờ phê duyệt</Badge> },
        { key: 'draft', label: 'Bản nháp' },
    ];

    const columns = [
        { title: 'STT', dataIndex: 'stt', key: 'stt', width: 60, align: 'center' },
        {
            title: 'Tên đề tài', dataIndex: 'title', key: 'title',
            render: (text, record) => (
                <div>
                    <a style={{ fontWeight: 600 }} onClick={() => handleViewDetail(record.id)}>{text}</a>
                    <div><Text type="secondary" style={{ fontSize: 12 }}>
                        Mã: DT-{String(record.id).padStart(3, '0')} • Tối đa: {record.maxGroups} nhóm
                    </Text></div>
                </div>
            ),
        },
        {
            title: 'GVHD', dataIndex: 'mentor', key: 'mentor',
            render: (mentor) => mentor ? (
                <Flex align="center" gap={8}>
                    <Avatar size={24} icon={<FileTextOutlined />} style={{ background: '#1677FF' }} />
                    <Text strong style={{ fontSize: 13 }}>{mentor.fullName}</Text>
                </Flex>
            ) : '—',
        },
        {
            title: 'Người đề xuất', dataIndex: 'proposedBy', key: 'proposedBy',
            render: (u) => u?.fullName || '—',
        },
        {
            title: 'Đã đăng ký', key: 'registered', width: 100, align: 'center',
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
            title: 'Hành động', key: 'action', width: 180, align: 'center',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Xem chi tiết"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)} /></Tooltip>
                    {record.status === 'DRAFT' && (
                        <Tooltip title="Chỉnh sửa"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openFormModal(record)} /></Tooltip>
                    )}
                    {record.status === 'PENDING' && (
                        <>
                            <Tooltip title="Duyệt">
                                <Popconfirm title="Duyệt đề tài này?" onConfirm={() => handleApprove(record.id)}>
                                    <Button type="text" size="small" style={{ color: '#52c41a' }} icon={<CheckCircleOutlined />} />
                                </Popconfirm>
                            </Tooltip>
                            <Tooltip title="Từ chối">
                                <Button type="text" size="small" danger icon={<CloseCircleOutlined />} onClick={() => { setRejectingTopicId(record.id); setRejectModalOpen(true); }} />
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

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Quản lý Đề tài</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openFormModal()}>Thêm đề tài mới</Button>
            </Flex>

            <Card style={{ borderRadius: 10 }} styles={{ body: { padding: 0 } }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={handleTabChange}
                    items={tabItems}
                    style={{ padding: '0 24px' }}
                    tabBarStyle={{ marginBottom: 0 }}
                />

                <Flex gap={12} wrap="wrap" style={{ padding: '16px 24px' }} justify="space-between">
                    <Flex gap={12}>
                        <Select
                            value={statusFilter === 'all' && activeTab === 'all' ? 'all' : statusFilter}
                            onChange={(v) => { setStatusFilter(v); setActiveTab('all'); }}
                            style={{ width: 180 }}
                            options={[
                                { value: 'all', label: 'Tất cả trạng thái' },
                                { value: 'DRAFT', label: 'Bản nháp' },
                                { value: 'PENDING', label: 'Chờ duyệt' },
                                { value: 'APPROVED', label: 'Đã duyệt' },
                                { value: 'REJECTED', label: 'Từ chối' },
                            ]}
                        />
                    </Flex>
                    <Input
                        placeholder="Tìm đề tài..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ width: 320 }}
                        allowClear
                    />
                </Flex>

                <Table
                    dataSource={topics}
                    columns={columns}
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showTotal: (total, range) => `Hiển thị ${range[0]}-${range[1]} của ${total} đề tài`,
                        showSizeChanger: false,
                    }}
                    size="middle"
                />
            </Card>

            {/* Modal tạo/sửa đề tài */}
            <Modal
                title={editingTopic ? 'Chỉnh sửa bản nháp' : 'Thêm đề tài mới'}
                open={formModalOpen}
                onCancel={() => setFormModalOpen(false)}
                footer={
                    <Flex justify="space-between">
                        <Button onClick={() => setFormModalOpen(false)}>Hủy</Button>
                        <Space>
                            <Button onClick={handleSaveDraft} loading={submitting}>Lưu nháp</Button>
                            <Button type="primary" onClick={handleCreateApproved} loading={submitting} icon={editingTopic ? <SendOutlined /> : undefined}>
                                {editingTopic ? 'Gửi duyệt' : 'Tạo đề tài'}
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
                    <Form.Item name="description" label="Mô tả">
                        <TextArea rows={4} placeholder="Mô tả chi tiết đề tài" />
                    </Form.Item>
                    <Flex gap={16}>
                        <Form.Item name="semesterId" label="Đợt đồ án" style={{ flex: 1 }} rules={[{ required: true, message: 'Vui lòng chọn đợt đồ án' }]}>
                            <Select placeholder="Chọn đợt đồ án" options={semesters} />
                        </Form.Item>
                        <Form.Item name="maxGroups" label="Số nhóm tối đa" style={{ flex: 1 }}>
                            <Select options={[{ value: 1, label: '1 nhóm' }, { value: 2, label: '2 nhóm' }, { value: 3, label: '3 nhóm' }]} />
                        </Form.Item>
                    </Flex>
                </Form>
            </Modal>

            {/* Modal từ chối */}
            <Modal
                title="Từ chối đề tài"
                open={rejectModalOpen}
                onCancel={() => { setRejectModalOpen(false); setRejectReason(''); }}
                onOk={handleReject}
                confirmLoading={submitting}
                okText="Từ chối"
                okButtonProps={{ danger: true }}
            >
                <Text>Vui lòng nhập lý do từ chối đề tài:</Text>
                <TextArea
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Nhập lý do..."
                    style={{ marginTop: 12 }}
                />
            </Modal>

            {/* Modal xem chi tiết */}
            <Modal
                title="Chi tiết đề tài"
                open={detailModalOpen}
                onCancel={() => setDetailModalOpen(false)}
                footer={null}
                width={700}
            >
                {detailTopic && (
                    <div>
                        <Title level={4}>{detailTopic.title}</Title>
                        <Text type="secondary">{detailTopic.description || 'Chưa có mô tả.'}</Text>
                        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div><Text strong>Trạng thái: </Text><Tag color={statusConfig[detailTopic.status]?.color}>{statusConfig[detailTopic.status]?.label}</Tag></div>
                            <div><Text strong>Số nhóm tối đa: </Text><Text>{detailTopic.maxGroups}</Text></div>
                            <div><Text strong>GVHD: </Text><Text>{detailTopic.mentor?.fullName}</Text></div>
                            <div><Text strong>Người đề xuất: </Text><Text>{detailTopic.proposedBy?.fullName}</Text></div>
                            <div><Text strong>Đợt đồ án: </Text><Text>{detailTopic.semester?.name}</Text></div>
                        </div>
                        {detailTopic.rejectReason && (
                            <div style={{ marginTop: 16, padding: 12, background: '#fff2f0', borderRadius: 8 }}>
                                <Text strong style={{ color: '#ff4d4f' }}>Lý do từ chối: </Text>
                                <Text>{detailTopic.rejectReason}</Text>
                            </div>
                        )}
                        {detailTopic.groups?.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                                <Text strong>Nhóm đã đăng ký ({detailTopic.groups.length}):</Text>
                                {detailTopic.groups.map(g => (
                                    <Card key={g.id} size="small" style={{ marginTop: 8 }}>
                                        <Text strong>{g.groupName}</Text> — Trưởng nhóm: {g.leader?.fullName}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default TopicManagementPage;