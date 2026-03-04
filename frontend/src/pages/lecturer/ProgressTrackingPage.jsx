import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Typography, Flex, Progress, Avatar, Select, Input, Row, Col, Statistic, theme, Drawer, List, message, Empty, Spin, Modal, Form, DatePicker } from 'antd';
import {
    SearchOutlined, TeamOutlined, CheckCircleOutlined, ClockCircleOutlined,
    WarningOutlined, EyeOutlined, DownloadOutlined, FilePdfOutlined, PlusOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import taskService from '../../services/taskService';

const { Title, Text } = Typography;

const statusConfig = {
    onTrack: { label: 'Đúng tiến độ', color: 'success' },
    atRisk: { label: 'Có rủi ro', color: 'warning' },
    delayed: { label: 'Trễ tiến độ', color: 'error' },
};

const columns = [
    {
        title: 'Nhóm', dataIndex: 'groupName', key: 'groupName', width: 100,
        render: (text) => <Tag icon={<TeamOutlined />}>{text}</Tag>,
    },
    {
        title: 'Đề tài', dataIndex: ['topic', 'title'], key: 'topic',
        render: (text) => <Text strong style={{ fontSize: 13 }}>{text || 'Chưa đăng ký'}</Text>,
    },
    {
        title: 'SV', dataIndex: 'members', key: 'members', width: 60, align: 'center',
        render: (members) => <Text>{members?.filter(m => m.status === 'ACCEPTED').length || 0}</Text>,
    },
    {
        title: 'Tiến độ', dataIndex: 'progress', key: 'progress', width: 180,
        render: (val) => <Progress percent={val || 0} size="small" status={val === 100 ? 'success' : 'active'} />,
    },
    {
        title: 'Cập nhật', dataIndex: 'updatedAt', key: 'updatedAt',
        render: (text) => <Text type="secondary" style={{ fontSize: 12 }}>{new Date(text).toLocaleDateString('vi-VN')}</Text>,
    }
];

function ProgressTrackingPage() {
    const [loading, setLoading] = useState(true);
    const [groups, setGroups] = useState([]);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [selectedTasks, setSelectedTasks] = useState([]);
    const [taskLoading, setTaskLoading] = useState(false);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const res = await api.get('/groups');
            setGroups(res.data?.data || []);
        } catch (error) {
            console.error('Error fetching groups:', error);
            message.error(error?.response?.data?.message || 'Lỗi khi tải danh sách nhóm');
        } finally {
            setLoading(false);
        }
    };

    const handleViewGroup = async (record) => {
        setSelectedGroup(record);
        setViewerOpen(true);
        setTaskLoading(true);
        try {
            const res = await taskService.getTasksByGroup(record.id);
            if (res.success) {
                setSelectedTasks(res.data);
            }
        } catch (error) {
            message.error('Lỗi khi tải báo cáo của nhóm');
        } finally {
            setTaskLoading(false);
        }
    };

    // Task Assignment Logic
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [taskSubmitting, setTaskSubmitting] = useState(false);
    const [taskForm] = Form.useForm();

    const openTaskModal = (group = null) => {
        taskForm.resetFields();
        if (group) {
            taskForm.setFieldsValue({ groupId: group.id });
        }
        setTaskModalOpen(true);
    };

    const handleCreateTask = async (values) => {
        try {
            setTaskSubmitting(true);
            const payload = {
                groupId: values.groupId,
                title: values.title,
                content: values.content,
                dueDate: values.dueDate ? values.dueDate.toISOString() : null
            };
            const res = await taskService.createTask(payload);
            if (res.success) {
                message.success('Giao việc thành công!');
                setTaskModalOpen(false);
                fetchGroups(); // Refresh tiến độ
            }
        } catch (error) {
            message.error(error.message || 'Lỗi khi giao việc');
        } finally {
            setTaskSubmitting(false);
        }
    };

    const extColumns = [
        ...columns,
        {
            title: 'Trạng thái', dataIndex: 'trackingStatus', key: 'trackingStatus', width: 120,
            render: (status) => {
                const conf = statusConfig[status] || statusConfig.onTrack;
                return <Tag color={conf.color}>{conf.label}</Tag>;
            }
        },
        {
            title: '', key: 'action', width: 100, align: 'center',
            render: (_, record) => (
                <Flex gap={8} justify="center">
                    <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewGroup(record)} title="Xem báo cáo" />
                    <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => openTaskModal(record)} title="Giao việc" style={{ color: '#1677ff' }} />
                </Flex>
            ),
        }
    ];

    const onTrack = groups.filter(g => g.trackingStatus === 'onTrack').length || 0;
    const atRisk = groups.filter(g => g.trackingStatus === 'atRisk').length || 0;
    const delayed = groups.filter(g => g.trackingStatus === 'delayed').length || 0;

    if (loading) {
        return <Flex justify="center" align="center" style={{ minHeight: '60vh' }}><Spin size="large" /></Flex>;
    }

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }} wrap="wrap" gap={16}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Theo dõi Tiến độ</Title>
                    <Text type="secondary">Tổng quan tiến độ các nhóm đang hướng dẫn</Text>
                </div>
                <Flex gap={12}>
                    <Select
                        defaultValue="2023-2024-1"
                        style={{ width: 180 }}
                        options={[
                            { value: '2023-2024-1', label: 'HK1 - 2023-2024' },
                            { value: '2023-2024-2', label: 'HK2 - 2023-2024' },
                        ]}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openTaskModal()}>
                        Giao việc
                    </Button>
                </Flex>
            </Flex>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={8}>
                    <Card>
                        <Statistic
                            title="Đúng tiến độ"
                            value={onTrack}
                            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={8}>
                    <Card>
                        <Statistic
                            title="Có rủi ro"
                            value={atRisk}
                            prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
                            valueStyle={{ color: '#fa8c16' }}
                        />
                    </Card>
                </Col>
                <Col xs={8}>
                    <Card>
                        <Statistic
                            title="Trễ tiến độ"
                            value={delayed}
                            prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
                            valueStyle={{ color: '#ff4d4f' }}
                        />
                    </Card>
                </Col>
            </Row>

            <Card
                title="Danh sách nhóm"
                extra={<Input placeholder="Tìm kiếm..." prefix={<SearchOutlined />} style={{ width: 250 }} />}
                style={{ borderRadius: 10 }}
                styles={{ body: { padding: 0 } }}
            >
                <Table
                    dataSource={groups}
                    rowKey="id"
                    columns={extColumns}
                    pagination={{ pageSize: 10 }}
                    size="middle"
                />
            </Card>

            {/* Chi tiết Bài nộp của Nhóm */}
            <Drawer
                title={`Bài nộp - ${selectedGroup?.groupName} (${selectedGroup?.topic?.title || 'Chưa ĐK'})`}
                width={500}
                onClose={() => setViewerOpen(false)}
                open={viewerOpen}
            >
                <Title level={5}>Danh sách báo cáo</Title>
                <Spin spinning={taskLoading}>
                    <List
                        dataSource={selectedTasks}
                        renderItem={task => {
                            const submissions = task.submissions || [];
                            const latestSub = submissions.length > 0 ? submissions[submissions.length - 1] : null;

                            return (
                                <List.Item
                                    actions={[
                                        latestSub && latestSub.fileUrl ? (
                                            <Button
                                                key="download"
                                                type="link"
                                                icon={<DownloadOutlined />}
                                                href={latestSub.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Tải về
                                            </Button>
                                        ) : (
                                            <Text type="secondary" key="no-file">Chưa nộp</Text>
                                        )
                                    ]}
                                >
                                    <List.Item.Meta
                                        avatar={<Avatar icon={<FilePdfOutlined />} style={{ backgroundColor: latestSub ? '#ff4d4f' : '#d9d9d9' }} />}
                                        title={task.title}
                                        description={
                                            latestSub
                                                ? `File: ${latestSub.fileName} - Nộp: ${new Date(latestSub.submittedAt).toLocaleDateString('vi-VN')}`
                                                : `Hạn: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : 'Không'}`
                                        }
                                    />
                                    {latestSub && latestSub.score && <Tag color="blue">Điểm: {latestSub.score}</Tag>}
                                </List.Item>
                            );
                        }}
                    />
                </Spin>
            </Drawer>

            {/* Modal Giao Việc */}
            <Modal
                title="Giao việc cho nhóm"
                open={taskModalOpen}
                onCancel={() => setTaskModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <Form
                    form={taskForm}
                    layout="vertical"
                    onFinish={handleCreateTask}
                    style={{ marginTop: 16 }}
                >
                    <Form.Item
                        name="groupId"
                        label="Nhóm thực hiện"
                        rules={[{ required: true, message: 'Vui lòng chọn nhóm' }]}
                    >
                        <Select
                            placeholder="Chọn nhóm"
                            options={groups.map(g => ({ value: g.id, label: `${g.groupName} - ${g.topic?.title || 'Chưa ĐK'}` }))}
                        />
                    </Form.Item>
                    <Form.Item
                        name="title"
                        label="Tiêu đề công việc"
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                    >
                        <Input placeholder="Ví dụ: Nộp báo cáo tuần 1" />
                    </Form.Item>
                    <Form.Item name="content" label="Nội dung chi tiết (Tùy chọn)">
                        <Input.TextArea rows={4} placeholder="Mô tả cụ thể những gì nhóm cần hoàn thành..." />
                    </Form.Item>
                    <Form.Item name="dueDate" label="Hạn nộp (Tùy chọn)">
                        <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} placeholder="Chọn hạn nộp" />
                    </Form.Item>
                    <Flex justify="flex-end" gap={12}>
                        <Button onClick={() => setTaskModalOpen(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit" loading={taskSubmitting}>Giao việc</Button>
                    </Flex>
                </Form>
            </Modal>
        </div>
    );
}

export default ProgressTrackingPage;