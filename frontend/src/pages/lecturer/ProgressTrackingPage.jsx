import { useMemo, useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Typography, Flex, Progress, Select, Input, Row, Col, Statistic, Drawer, List, message, Spin, Modal, Form, DatePicker } from 'antd';
import {
    SearchOutlined, CheckCircleOutlined, ClockCircleOutlined,
    WarningOutlined, EyeOutlined, DownloadOutlined, FilePdfOutlined, PlusOutlined, UserOutlined
} from '@ant-design/icons';
import registrationService from '../../services/registrationService';
import taskService from '../../services/taskService';

const { Title, Text } = Typography;

const registrationStatusConfig = {
    PENDING: { label: 'Chờ duyệt', color: 'gold' },
    APPROVED: { label: 'Đã duyệt', color: 'green' },
    IN_PROGRESS: { label: 'Đang thực hiện', color: 'blue' },
    SUBMITTED: { label: 'Đã nộp', color: 'cyan' },
    DEFENDED: { label: 'Đã bảo vệ', color: 'purple' },
    COMPLETED: { label: 'Hoàn thành', color: 'success' },
    REJECTED: { label: 'Từ chối', color: 'error' },
};

function ProgressTrackingPage() {
    const [loading, setLoading] = useState(true);
    const [registrations, setRegistrations] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewerOpen, setViewerOpen] = useState(false);
    const [selectedRegistration, setSelectedRegistration] = useState(null);
    const [selectedTasks, setSelectedTasks] = useState([]);
    const [taskLoading, setTaskLoading] = useState(false);

    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [taskSubmitting, setTaskSubmitting] = useState(false);
    const [taskForm] = Form.useForm();

    useEffect(() => {
        fetchRegistrations();
    }, []);

    const fetchRegistrations = async () => {
        try {
            setLoading(true);
            const res = await registrationService.getAllRegistrations();
            if (res.success) {
                setRegistrations(res.data || []);
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi tải danh sách sinh viên đăng ký');
        } finally {
            setLoading(false);
        }
    };

    const filteredRegistrations = useMemo(() => {
        return registrations.filter((registration) => {
            if (statusFilter !== 'all' && registration.status !== statusFilter) return false;

            if (!searchText.trim()) return true;
            const search = searchText.toLowerCase();
            const studentName = registration.student?.fullName?.toLowerCase() || '';
            const studentCode = registration.student?.code?.toLowerCase() || '';
            const topicTitle = registration.topic?.title?.toLowerCase() || '';
            return studentName.includes(search) || studentCode.includes(search) || topicTitle.includes(search);
        });
    }, [registrations, searchText, statusFilter]);

    const handleViewRegistration = async (record) => {
        setSelectedRegistration(record);
        setViewerOpen(true);
        setTaskLoading(true);
        try {
            const res = await taskService.getTasksByRegistration(record.id);
            if (res.success) {
                setSelectedTasks(res.data || []);
            }
        } catch {
            message.error('Lỗi khi tải danh sách bài nộp');
        } finally {
            setTaskLoading(false);
        }
    };

    const openTaskModal = (registration = null) => {
        taskForm.resetFields();
        if (registration) {
            taskForm.setFieldsValue({ registrationId: registration.id });
        }
        setTaskModalOpen(true);
    };

    const handleCreateTask = async (values) => {
        try {
            setTaskSubmitting(true);
            const payload = {
                registrationId: values.registrationId,
                title: values.title,
                content: values.content,
                dueDate: values.dueDate ? values.dueDate.toISOString() : null,
            };
            const res = await taskService.createTask(payload);
            if (res.success) {
                message.success('Giao việc thành công');
                setTaskModalOpen(false);
                fetchRegistrations();
                if (selectedRegistration?.id === values.registrationId) {
                    handleViewRegistration(selectedRegistration);
                }
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi khi giao việc');
        } finally {
            setTaskSubmitting(false);
        }
    };

    const columns = [
        {
            title: 'Sinh viên', dataIndex: 'student', key: 'student', width: 220,
            render: (student) => (
                <Flex gap={8} align="center">
                    <Tag icon={<UserOutlined />}>{student?.code || 'N/A'}</Tag>
                    <Text strong>{student?.fullName || 'Sinh viên'}</Text>
                </Flex>
            ),
        },
        {
            title: 'Đề tài', dataIndex: ['topic', 'title'], key: 'topic',
            render: (text) => <Text style={{ fontSize: 13 }}>{text || 'Chưa đăng ký'}</Text>,
        },
        {
            title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 130,
            render: (status) => {
                const conf = registrationStatusConfig[status] || { label: status, color: 'default' };
                return <Tag color={conf.color}>{conf.label}</Tag>;
            },
        },
        {
            title: 'Tiến độ', dataIndex: 'progress', key: 'progress', width: 180,
            render: (value) => <Progress percent={value || 0} size="small" status={value === 100 ? 'success' : 'active'} />,
        },
        {
            title: 'Cập nhật', dataIndex: 'updatedAt', key: 'updatedAt', width: 120,
            render: (text) => <Text type="secondary" style={{ fontSize: 12 }}>{new Date(text).toLocaleDateString('vi-VN')}</Text>,
        },
        {
            title: '', key: 'action', width: 100, align: 'center',
            render: (_, record) => (
                <Flex gap={8} justify="center">
                    <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewRegistration(record)} title="Xem bài nộp" />
                    <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => openTaskModal(record)} title="Giao việc" style={{ color: '#1677ff' }} />
                </Flex>
            ),
        },
    ];

    const onTrack = filteredRegistrations.filter((registration) => (registration.progress || 0) >= 70).length;
    const atRisk = filteredRegistrations.filter((registration) => (registration.progress || 0) >= 30 && (registration.progress || 0) < 70).length;
    const delayed = filteredRegistrations.filter((registration) => (registration.progress || 0) < 30).length;

    if (loading) {
        return <Flex justify="center" align="center" style={{ minHeight: '60vh' }}><Spin size="large" /></Flex>;
    }

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }} wrap="wrap" gap={16}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Theo dõi Tiến độ</Title>
                    <Text type="secondary">Tổng quan tiến độ sinh viên đang được bạn hướng dẫn</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openTaskModal()}>
                    Giao việc
                </Button>
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
                title="Danh sách sinh viên đăng ký"
                extra={(
                    <Flex gap={8}>
                        <Select
                            value={statusFilter}
                            onChange={setStatusFilter}
                            style={{ width: 150 }}
                            options={[
                                { value: 'all', label: 'Tất cả' },
                                { value: 'PENDING', label: 'Chờ duyệt' },
                                { value: 'APPROVED', label: 'Đã duyệt' },
                                { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
                                { value: 'SUBMITTED', label: 'Đã nộp' },
                                { value: 'COMPLETED', label: 'Hoàn thành' },
                            ]}
                        />
                        <Input
                            placeholder="Tìm kiếm..."
                            prefix={<SearchOutlined />}
                            style={{ width: 260 }}
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            allowClear
                        />
                    </Flex>
                )}
                style={{ borderRadius: 10 }}
                styles={{ body: { padding: 0 } }}
            >
                <Table
                    dataSource={filteredRegistrations}
                    rowKey="id"
                    columns={columns}
                    pagination={{ pageSize: 10 }}
                    size="middle"
                />
            </Card>

            <Drawer
                title={`Bài nộp - ${selectedRegistration?.student?.fullName || 'Sinh viên'} (${selectedRegistration?.topic?.title || 'Chưa đăng ký'})`}
                width={560}
                onClose={() => setViewerOpen(false)}
                open={viewerOpen}
            >
                <Title level={5}>Danh sách nhiệm vụ & bài nộp</Title>
                <Spin spinning={taskLoading}>
                    <List
                        dataSource={selectedTasks}
                        locale={{ emptyText: 'Chưa có nhiệm vụ nào' }}
                        renderItem={(task) => {
                            const submissions = task.submissions || [];
                            const latestSubmission = submissions.length > 0 ? submissions[submissions.length - 1] : null;

                            return (
                                <List.Item
                                    actions={[
                                        latestSubmission?.fileUrl ? (
                                            <Button
                                                key="download"
                                                type="link"
                                                icon={<DownloadOutlined />}
                                                href={latestSubmission.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Tải về
                                            </Button>
                                        ) : (
                                            <Text type="secondary" key="no-file">Chưa nộp</Text>
                                        ),
                                    ]}
                                >
                                    <List.Item.Meta
                                        avatar={<FilePdfOutlined style={{ color: latestSubmission ? '#ff4d4f' : '#d9d9d9' }} />}
                                        title={task.title}
                                        description={
                                            latestSubmission
                                                ? `File: ${latestSubmission.fileName} • Nộp: ${new Date(latestSubmission.submittedAt).toLocaleDateString('vi-VN')}`
                                                : `Hạn: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : 'Không'}`
                                        }
                                    />
                                </List.Item>
                            );
                        }}
                    />
                </Spin>
            </Drawer>

            <Modal
                title="Giao việc cho sinh viên"
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
                        name="registrationId"
                        label="Sinh viên thực hiện"
                        rules={[{ required: true, message: 'Vui lòng chọn sinh viên' }]}
                    >
                        <Select
                            placeholder="Chọn sinh viên"
                            options={registrations.map((registration) => ({
                                value: registration.id,
                                label: `${registration.student?.fullName || 'Sinh viên'} (${registration.student?.code || 'N/A'}) - ${registration.topic?.title || 'Chưa đăng ký'}`,
                            }))}
                            showSearch
                            optionFilterProp="label"
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
                        <Input.TextArea rows={4} placeholder="Mô tả cụ thể những gì sinh viên cần hoàn thành..." />
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
