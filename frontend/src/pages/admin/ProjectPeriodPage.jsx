import { useState, useEffect } from 'react';
import {
    Card,
    Row,
    Col,
    Statistic,
    Tag,
    Button,
    Typography,
    Flex,
    Switch,
    Select,
    Steps,
    ConfigProvider,
    Tooltip,
    Space,
    Divider,
    theme,
    message,
    Spin,
    Modal,
    Form,
    Input,
    DatePicker
} from 'antd';
import dayjs from 'dayjs';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ArrowRightOutlined,
    EyeOutlined,
    FolderOpenOutlined,
    PlayCircleOutlined,
    AppstoreAddOutlined,
    TeamOutlined,
    CalendarOutlined,
} from '@ant-design/icons';
import { semesterService } from '../../services/semesterService';

const { Title, Text, Paragraph } = Typography;

const statusConfig = {
    ONGOING: { label: 'Đang diễn ra', color: 'green' },
    REGISTRATION: { label: 'Đang đăng ký', color: 'orange' },
    UPCOMING: { label: 'Sắp tới', color: 'blue' },
    DEFENSE: { label: 'Bảo vệ', color: 'purple' },
    COMPLETED: { label: 'Hoàn thành', color: 'default' },
};

/* ===== Timeline component ===== */
function PeriodTimeline({ milestones, status }) {
    let currentStep = -1;
    let stepStatus = 'process';

    switch (status) {
        case 'UPCOMING':
            currentStep = -1;
            break;
        case 'REGISTRATION':
            currentStep = 0;
            break;
        case 'ONGOING':
            currentStep = 1;
            break;
        case 'DEFENSE':
            currentStep = 2;
            break;
        case 'COMPLETED':
            currentStep = 4;
            stepStatus = 'finish';
            break;
        default:
            currentStep = -1;
    }

    const colorHexMap = {
        green: '#52c41a',
        orange: '#fa8c16',
        blue: '#1677ff',
        purple: '#722ed1',
        default: '#8c8c8c',
    };
    const activeHex = colorHexMap[statusConfig[status]?.color] || '#1677ff';

    return (
        <ConfigProvider theme={{ token: { colorPrimary: activeHex } }}>
            <Steps
                className={`custom-steps-${status}`}
                size="small"
                labelPlacement="vertical"
                current={currentStep}
                status={stepStatus}
                items={milestones.map((m) => ({
                    title: (
                        <Text style={{ fontSize: 13, fontWeight: 500 }}>
                            {m.title}
                        </Text>
                    ),
                    description: (
                        <div style={{ minHeight: 18, marginTop: 4 }}>
                            {m.date ? (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {m.date}
                                </Text>
                            ) : null}
                        </div>
                    ),
                }))}
                style={{ width: '100%', maxWidth: 500, margin: '0 auto' }}
            />
        </ConfigProvider >
    );
}

/* ===== Stats badge ===== */
function PeriodStats({ topics, groups, students }) {
    return (
        <Flex gap={12} align="center" wrap="wrap">
            <Flex gap={4} align="center">
                <Text strong>{topics}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>đề tài</Text>
            </Flex>
            <Divider type="vertical" style={{ margin: 0 }} />
            <Flex gap={4} align="center">
                <Text strong>{groups}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>nhóm</Text>
            </Flex>
            <Divider type="vertical" style={{ margin: 0 }} />
            <Flex gap={4} align="center">
                <Text strong>{students}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>SV</Text>
            </Flex>
        </Flex>
    );
}

/* ===== Period Card ===== */
function PeriodCard({ period, onEdit, onDelete }) {
    const { token } = theme.useToken();
    const isCompleted = period.status === 'COMPLETED';
    const cfg = statusConfig[period.status];

    return (
        <Card
            hoverable
            style={{
                opacity: isCompleted ? 0.85 : 1,
                borderRadius: token.borderRadiusLG,
            }}
            styles={{
                body: { padding: '20px 24px' },
            }}
        >
            <Flex
                vertical={false}
                gap={24}
                align="center"
                justify="space-between"
                wrap="wrap"
            >
                {/* Left: Info */}
                <Flex vertical gap={8} style={{ width: 250, flexShrink: 0 }}>
                    <div>
                        <Tag color={cfg.color}>{cfg.label}</Tag>
                    </div>
                    <Title level={5} style={{ margin: 0 }}>
                        {period.name}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                        Mã đợt: {period.code}
                    </Text>
                </Flex>

                {/* Middle: Timeline */}
                <Flex
                    flex={1}
                    align="center"
                    justify="center"
                    style={{ minWidth: 400 }}
                >
                    <PeriodTimeline
                        milestones={period.milestones}
                        status={period.status}
                    />
                </Flex>

                {/* Right: Stats & Actions */}
                <Flex vertical align="flex-end" justify="center" gap={12} style={{ width: 190, flexShrink: 0 }}>
                    {period.status === 'UPCOMING' ? (
                        <Text type="secondary" italic style={{ fontSize: 13 }}>
                            Chưa có dữ liệu thống kê
                        </Text>
                    ) : isCompleted ? (
                        <Text type="secondary" italic style={{ fontSize: 12 }}>
                            Đã lưu trữ 4 tháng trước
                        </Text>
                    ) : (
                        <PeriodStats
                            topics={period.topics}
                            groups={period.groups}
                            students={period.students}
                        />
                    )}
                    <Space>
                        {!isCompleted && (
                            <Tooltip title="Chỉnh sửa">
                                <Button
                                    type="text"
                                    icon={<EditOutlined />}
                                    size="small"
                                    onClick={() => onEdit(period)}
                                />
                            </Tooltip>
                        )}
                        <Button
                            type={isCompleted ? 'text' : 'default'}
                            size="small"
                            icon={isCompleted ? <EyeOutlined /> : <ArrowRightOutlined />}
                        >
                            {isCompleted ? 'Xem lại' : 'Chi tiết'}
                        </Button>
                        {!isCompleted && (
                            <Tooltip title="Xóa">
                                <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    size="small"
                                    onClick={() => onDelete(period.id)}
                                />
                            </Tooltip>
                        )}
                    </Space>
                </Flex>
            </Flex>
        </Card>
    );
}

/* ===== Main Page ===== */
function ProjectPeriodPage() {
    const [topicRegistrationOpen, setTopicRegistrationOpen] = useState(true);
    const [defaultPeriod, setDefaultPeriod] = useState(null);
    const { token } = theme.useToken();
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSemesters();
    }, []);

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [form] = Form.useForm();

    const fetchSemesters = async () => {
        try {
            setLoading(true);
            const res = await semesterService.getAll();
            if (res.success) {
                const mapped = res.data.map(p => ({
                    key: p.id.toString(),
                    id: p.id,
                    name: p.name,
                    code: `HK-${p.id}`,
                    status: p.status,
                    topics: 0, // Mock
                    groups: 0, // Mock
                    students: 0, // Mock
                    milestones: [
                        { title: 'Bắt đầu', date: new Date(p.startDate).toLocaleDateString('vi-VN') },
                        { title: 'Hạn ĐK', date: p.registrationDeadline ? new Date(p.registrationDeadline).toLocaleDateString('vi-VN') : '' },
                        { title: 'Bảo vệ', date: p.defenseDate ? new Date(p.defenseDate).toLocaleDateString('vi-VN') : '' },
                        { title: 'Kết thúc', date: new Date(p.endDate).toLocaleDateString('vi-VN') },
                    ],
                    progress: 0,
                    rawData: p
                }));
                setPeriods(mapped);
                if (mapped.length > 0 && !defaultPeriod) {
                    setDefaultPeriod(mapped[0].code);
                }
            }
        } catch (error) {
            message.error('Lỗi tải danh sách đợt đồ án: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setModalMode('add');
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (period) => {
        setModalMode('edit');
        form.setFieldsValue({
            id: period.id,
            name: period.rawData.name,
            startDate: dayjs(period.rawData.startDate),
            endDate: dayjs(period.rawData.endDate),
            registrationDeadline: period.rawData.registrationDeadline ? dayjs(period.rawData.registrationDeadline) : null,
            defenseDate: period.rawData.defenseDate ? dayjs(period.rawData.defenseDate) : null,
        });
        setIsModalVisible(true);
    };

    const handleDelete = (id) => {
        Modal.confirm({
            title: 'Xác nhận xóa',
            content: 'Bạn có chắc chắn muốn xóa đợt đồ án này? Chỉ có thể xóa nếu chưa có dữ liệu liên kết.',
            okText: 'Xóa',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    const res = await semesterService.delete(id);
                    if (res.success) {
                        message.success('Xóa đợt đồ án thành công');
                        fetchSemesters();
                    }
                } catch (error) {
                    message.error(error.response?.data?.message || 'Có lỗi xảy ra khi xóa');
                }
            }
        });
    };

    const handleModalSubmit = async () => {
        try {
            const values = await form.validateFields();
            const payload = {
                name: values.name,
                startDate: values.startDate.toISOString(),
                endDate: values.endDate.toISOString(),
                registrationDeadline: values.registrationDeadline.toISOString(),
                defenseDate: values.defenseDate ? values.defenseDate.toISOString() : null,
            };

            if (modalMode === 'add') {
                const res = await semesterService.create(payload);
                if (res.success) {
                    message.success('Tạo đợt đồ án thành công');
                    setIsModalVisible(false);
                    fetchSemesters();
                }
            } else {
                const res = await semesterService.update(values.id, payload);
                if (res.success) {
                    message.success('Cập nhật đợt đồ án thành công');
                    setIsModalVisible(false);
                    fetchSemesters();
                }
            }
        } catch (error) {
            if (error.response) {
                message.error(error.response.data?.message || 'Có lỗi xảy ra');
            }
        }
    };

    const totalPeriods = periods.length;
    const activePeriods = periods.filter((p) => p.status === 'ONGOING').length;
    const registeringPeriods = periods.filter((p) => p.status === 'REGISTRATION').length;
    const totalStudents = periods.reduce((sum, p) => sum + p.students, 0);

    return (
        <div>
            {/* Header */}
            <Flex justify="space-between" align="center" wrap="wrap" gap={16} style={{ marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>
                        Quản lý Đợt Đồ án
                    </Title>
                    <Text type="secondary">
                        Theo dõi tiến độ và cấu hình các đợt bảo vệ đồ án
                    </Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} size="large" style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={handleAdd}>
                    Tạo đợt mới
                </Button>
            </Flex>

            {/* Stats */}
            <style>{`
                .stat-card {
                    transition: all 0.3s ease;
                }
                .stat-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 8px 16px rgba(0,0,0,0.08);
                }
                .stat-card .anticon {
                    transition: transform 0.3s ease;
                }
                .stat-card:hover .anticon {
                    transform: scale(1.15) rotate(5deg);
                }
            `}</style>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} md={6}>
                    <Card hoverable className="stat-card">
                        <Statistic
                            title="Tổng số đợt"
                            value={totalPeriods}
                            prefix={<FolderOpenOutlined style={{ color: '#1677ff' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} md={6}>
                    <Card hoverable className="stat-card">
                        <Statistic
                            title="Đang diễn ra"
                            value={activePeriods}
                            prefix={<PlayCircleOutlined style={{ color: '#52c41a' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} md={6}>
                    <Card hoverable className="stat-card">
                        <Statistic
                            title="Đang đăng ký"
                            value={registeringPeriods}
                            prefix={<AppstoreAddOutlined style={{ color: '#fa8c16' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} md={6}>
                    <Card hoverable className="stat-card">
                        <Statistic
                            title="Sinh viên tham gia"
                            value={totalStudents}
                            prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Period Cards */}
            <Spin spinning={loading}>
                <Flex vertical gap={16} style={{ marginBottom: 40, minHeight: 200 }}>
                    {periods.length === 0 && !loading ? (
                        <Card><Text type="secondary">Chưa có đợt đồ án nào.</Text></Card>
                    ) : (
                        periods.map((period) => (
                            <PeriodCard key={period.key} period={period} onEdit={handleEdit} onDelete={handleDelete} />
                        ))
                    )}
                </Flex>
            </Spin>

            {/* Quick Config Section */}
            <Divider />
            <Title level={4} style={{ marginBottom: 16 }}>
                Cài đặt Đợt hiện tại (Quick Config)
            </Title>
            <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                    <Card>
                        <Flex justify="space-between" align="center" gap={16}>
                            <Flex gap={16} align="center">
                                <div
                                    style={{
                                        padding: 8,
                                        borderRadius: 8,
                                        background: '#e6f4ff',
                                        color: '#1677ff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <CalendarOutlined style={{ fontSize: 20 }} />
                                </div>
                                <div>
                                    <Text strong>Mở đăng ký đề tài</Text>
                                    <br />
                                    <Text type="secondary" style={{ fontSize: 13 }}>
                                        Cho phép sinh viên và GV đăng ký đề tài mới cho đợt đang hoạt động
                                    </Text>
                                </div>
                            </Flex>
                            <Switch
                                checked={topicRegistrationOpen}
                                onChange={setTopicRegistrationOpen}
                            />
                        </Flex>
                    </Card>
                </Col>
                <Col xs={24} md={12}>
                    <Card>
                        <Flex justify="space-between" align="center" gap={16}>
                            <Flex gap={16} align="center">
                                <div
                                    style={{
                                        padding: 8,
                                        borderRadius: 8,
                                        background: '#f9f0ff',
                                        color: '#722ed1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <AppstoreAddOutlined style={{ fontSize: 20 }} />
                                </div>
                                <div>
                                    <Text strong>Đợt mặc định</Text>
                                    <br />
                                    <Text type="secondary" style={{ fontSize: 13 }}>
                                        Chọn đợt hiển thị chính trên trang chủ sinh viên
                                    </Text>
                                </div>
                            </Flex>
                            <Select
                                value={defaultPeriod}
                                onChange={setDefaultPeriod}
                                style={{ width: 180 }}
                                options={periods.map(p => ({ value: p.code, label: p.name }))}
                            />
                        </Flex>
                    </Card>
                </Col>
            </Row>

            {/* Modal Create/Edit */}
            <Modal
                title={modalMode === 'add' ? 'Tạo đợt đồ án mới' : 'Cập nhật đợt đồ án'}
                open={isModalVisible}
                onOk={handleModalSubmit}
                onCancel={() => setIsModalVisible(false)}
                okText={modalMode === 'add' ? 'Tạo mới' : 'Cập nhật'}
                cancelText="Hủy"
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    name="project_period_form"
                >
                    <Form.Item name="id" hidden>
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="name"
                        label="Tên đợt đồ án"
                        rules={[{ required: true, message: 'Vui lòng nhập tên đợt đồ án' }]}
                    >
                        <Input placeholder="VD: Đồ án Chuyên ngành - HK1 2026-2027" />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="startDate"
                                label="Ngày bắt đầu"
                                rules={[{ required: true, message: 'Vui lòng chọn ngày bắt đầu' }]}
                            >
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="endDate"
                                label="Ngày kết thúc (Dự kiến)"
                                rules={[{ required: true, message: 'Vui lòng chọn ngày kết thúc' }]}
                            >
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="registrationDeadline"
                                label="Hạn đăng ký đề tài"
                                rules={[{ required: true, message: 'Vui lòng chọn hạn đăng ký' }]}
                            >
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="defenseDate"
                                label="Ngày bảo vệ (Dự kiến)"
                            >
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </div>
    );
}

export default ProjectPeriodPage;