import { useMemo, useState, useEffect } from 'react';
import {
    Card,
    Table,
    Tag,
    Button,
    Typography,
    Flex,
    Progress,
    Select,
    Input,
    Row,
    Col,
    Statistic,
    Drawer,
    List,
    message,
    Spin,
    Modal,
    Form,
    DatePicker,
} from 'antd';
import {
    SearchOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    WarningOutlined,
    EyeOutlined,
    DownloadOutlined,
    FilePdfOutlined,
    PlusOutlined,
    UserOutlined,
    CheckOutlined,
    CloseOutlined,
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

const taskStatusOptions = [
    { value: 'OPEN', label: 'Mới giao' },
    { value: 'IN_PROGRESS', label: 'Đang làm' },
    { value: 'SUBMITTED', label: 'Đã nộp' },
    { value: 'COMPLETED', label: 'Hoàn thành' },
];

function ProgressTrackingPage() {
    const [loading, setLoading] = useState(true);
    const [registrations, setRegistrations] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewerOpen, setViewerOpen] = useState(false);
    const [selectedRegistration, setSelectedRegistration] = useState(null);
    const [selectedTasks, setSelectedTasks] = useState([]);
    const [taskLoading, setTaskLoading] = useState(false);
    const [updatingTaskId, setUpdatingTaskId] = useState(null);

    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [taskSubmitting, setTaskSubmitting] = useState(false);
    const [taskForm] = Form.useForm();

    const [handlingRegistration, setHandlingRegistration] = useState(false);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectingRegistration, setRejectingRegistration] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

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

    const filteredRegistrations = useMemo(() => registrations.filter((registration) => {
        if (statusFilter !== 'all' && registration.status !== statusFilter) return false;

        if (!searchText.trim()) return true;
        const search = searchText.toLowerCase();
        const studentName = registration.student?.fullName?.toLowerCase() || '';
        const studentCode = registration.student?.code?.toLowerCase() || '';
        const topicTitle = registration.topic?.title?.toLowerCase() || '';
        return studentName.includes(search) || studentCode.includes(search) || topicTitle.includes(search);
    }), [registrations, searchText, statusFilter]);

    const assignableRegistrations = useMemo(
        () => registrations.filter((registration) => ['APPROVED', 'IN_PROGRESS'].includes(registration.status)),
        [registrations],
    );

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
        if (registration && !['APPROVED', 'IN_PROGRESS'].includes(registration.status)) {
            message.warning('Chỉ giao nhiệm vụ cho sinh viên đã duyệt hoặc đang thực hiện.');
            return;
        }
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

    const handleUpdateTaskStatus = async (taskId, status) => {
        try {
            setUpdatingTaskId(taskId);
            const res = await taskService.updateTaskStatus(taskId, status);
            if (res.success) {
                setSelectedTasks((prev) => prev.map((task) => (
                    task.id === taskId ? { ...task, status } : task
                )));
                message.success('Đã cập nhật trạng thái nhiệm vụ');
            }
        } catch (error) {
            message.error(error?.message || 'Không thể cập nhật trạng thái nhiệm vụ');
        } finally {
            setUpdatingTaskId(null);
        }
    };

    const handleApproveRegistration = (record) => {
        Modal.confirm({
            title: 'Xác nhận duyệt đăng ký',
            content: `Duyệt sinh viên ${record.student?.fullName || ''} vào đề tài "${record.topic?.title || ''}"?`,
            okText: 'Duyệt',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    setHandlingRegistration(true);
                    const res = await registrationService.handleRegistration(record.id, 'APPROVE');
                    if (res.success) {
                        message.success('Đã duyệt đăng ký');
                        fetchRegistrations();
                    }
                } catch (error) {
                    message.error(error?.message || 'Không thể duyệt đăng ký');
                } finally {
                    setHandlingRegistration(false);
                }
            },
        });
    };

    const openRejectModal = (record) => {
        setRejectingRegistration(record);
        setRejectReason('');
        setRejectModalOpen(true);
    };

    const handleRejectRegistration = async () => {
        if (!rejectReason.trim()) {
            return message.warning('Vui lòng nhập lý do từ chối');
        }

        try {
            setHandlingRegistration(true);
            const res = await registrationService.handleRegistration(
                rejectingRegistration.id,
                'REJECT',
                rejectReason.trim(),
            );
            if (res.success) {
                message.success('Đã từ chối đăng ký');
                setRejectModalOpen(false);
                setRejectingRegistration(null);
                setRejectReason('');
                fetchRegistrations();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể từ chối đăng ký');
        } finally {
            setHandlingRegistration(false);
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
            render: (text, record) => (
                <Flex vertical gap={4}>
                    <Text style={{ fontSize: 13 }}>{text || 'Chưa đăng ký'}</Text>
                    {record.hasOverdueTask && (
                        <Tag color="error">Có {record.overdueTaskCount} nhiệm vụ quá hạn</Tag>
                    )}
                </Flex>
            ),
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
            title: '', key: 'action', width: 180, align: 'center',
            render: (_, record) => (
                <Flex gap={8} justify="center">
                    <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewRegistration(record)} title="Xem bài nộp" />
                    <Button
                        type="text"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => openTaskModal(record)}
                        title="Giao việc"
                        style={{ color: '#1677ff' }}
                        disabled={!['APPROVED', 'IN_PROGRESS'].includes(record.status)}
                    />
                    {record.status === 'PENDING' && (
                        <>
                            <Button
                                type="text"
                                size="small"
                                icon={<CheckOutlined />}
                                title="Duyệt đăng ký"
                                style={{ color: '#52c41a' }}
                                onClick={() => handleApproveRegistration(record)}
                                loading={handlingRegistration}
                            />
                            <Button
                                type="text"
                                size="small"
                                danger
                                icon={<CloseOutlined />}
                                title="Từ chối đăng ký"
                                onClick={() => openRejectModal(record)}
                                loading={handlingRegistration}
                            />
                        </>
                    )}
                </Flex>
            ),
        },
    ];

    const onTrack = filteredRegistrations.filter((registration) => (registration.progress || 0) >= 70).length;
    const atRisk = filteredRegistrations.filter((registration) => (registration.progress || 0) >= 30 && (registration.progress || 0) < 70).length;
    const delayed = filteredRegistrations.filter((registration) => (registration.progress || 0) < 30).length;
    const overdueCount = filteredRegistrations.filter((registration) => registration.hasOverdueTask).length;

    if (loading) {
        return <Flex justify="center" align="center" style={{ minHeight: '60vh' }}><Spin size="large" /></Flex>;
    }

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 24 }} wrap="wrap" gap={16}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Theo dõi tiến độ</Title>
                    <Text type="secondary">Tổng quan tiến độ sinh viên đang được bạn hướng dẫn</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openTaskModal()}>
                    Giao việc
                </Button>
            </Flex>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={6}>
                    <Card>
                        <Statistic
                            title="Đúng tiến độ"
                            value={onTrack}
                            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={6}>
                    <Card>
                        <Statistic
                            title="Có rủi ro"
                            value={atRisk}
                            prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
                            valueStyle={{ color: '#fa8c16' }}
                        />
                    </Card>
                </Col>
                <Col xs={6}>
                    <Card>
                        <Statistic
                            title="Trễ tiến độ"
                            value={delayed}
                            prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
                            valueStyle={{ color: '#ff4d4f' }}
                        />
                    </Card>
                </Col>
                <Col xs={6}>
                    <Card>
                        <Statistic
                            title="Có nhiệm vụ quá hạn"
                            value={overdueCount}
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
                                { value: 'DEFENDED', label: 'Đã bảo vệ' },
                                { value: 'COMPLETED', label: 'Hoàn thành' },
                                { value: 'REJECTED', label: 'Từ chối' },
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
                <Title level={5}>Danh sách nhiệm vụ và bài nộp</Title>
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
                                        <Select
                                            key="status"
                                            size="small"
                                            value={task.status}
                                            options={taskStatusOptions}
                                            loading={updatingTaskId === task.id}
                                            style={{ width: 132 }}
                                            onChange={(value) => handleUpdateTaskStatus(task.id, value)}
                                        />,
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
                            options={assignableRegistrations.map((registration) => ({
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

            <Modal
                title="Từ chối đăng ký"
                open={rejectModalOpen}
                onCancel={() => {
                    setRejectModalOpen(false);
                    setRejectingRegistration(null);
                    setRejectReason('');
                }}
                onOk={handleRejectRegistration}
                confirmLoading={handlingRegistration}
                okText="Từ chối"
                okButtonProps={{ danger: true }}
            >
                <Text>
                    Nhập lý do từ chối cho sinh viên {rejectingRegistration?.student?.fullName || ''}:
                </Text>
                <Input.TextArea
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

export default ProgressTrackingPage;
