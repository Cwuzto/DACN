import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Button,
    Col,
    ConfigProvider,
    DatePicker,
    Form,
    Input,
    message,
    Modal,
    Row,
    Select,
    Space,
    Spin,
    Steps,
    Switch,
    Tooltip,
} from 'antd';
import {
    ArrowRightOutlined,
    CopyOutlined,
    DeleteOutlined,
    EditOutlined,
    EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import registrationService from '../../services/registrationService';
import { semesterService } from '../../services/semesterService';
import { topicService } from '../../services/topicService';

const statusConfig = {
    ONGOING: { label: 'Đang diễn ra', color: 'green', tw: 'bg-green-100 text-green-700' },
    REGISTRATION: { label: 'Đang đăng ký', color: 'orange', tw: 'bg-orange-100 text-orange-700' },
    UPCOMING: { label: 'Sắp tới', color: 'blue', tw: 'bg-blue-100 text-blue-700' },
    DEFENSE: { label: 'Bảo vệ', color: 'purple', tw: 'bg-purple-100 text-purple-700' },
    COMPLETED: { label: 'Hoàn thành', color: 'default', tw: 'bg-slate-100 text-slate-600' },
};
const REGISTRATION_TOGGLE_WARNING_WINDOW_DAYS = 14;

const getToggleWindowWarning = (period) => {
    const startDate = period?.rawData?.startDate;
    const registrationDeadline = period?.rawData?.registrationDeadline;

    if (!startDate || !registrationDeadline) {
        return 'Hoc ky chua du moc thoi gian de doi chieu cua so khuyen nghi, he thong van cho phep thay doi.';
    }

    const start = dayjs(startDate);
    const deadline = dayjs(registrationDeadline);
    if (!start.isValid() || !deadline.isValid()) {
        return 'Du lieu ngay khong hop le, he thong van cho phep thay doi trang thai dang ky.';
    }

    const now = dayjs();
    const windowStart = start.subtract(REGISTRATION_TOGGLE_WARNING_WINDOW_DAYS, 'day');
    const windowEnd = deadline.add(REGISTRATION_TOGGLE_WARNING_WINDOW_DAYS, 'day');

    if (now.isBefore(windowStart) || now.isAfter(windowEnd)) {
        return `Ban dang thay doi ngoai cua so khuyen nghi (${windowStart.format('DD/MM/YYYY')} - ${windowEnd.format('DD/MM/YYYY')}).`;
    }

    return null;
};

function PeriodTimeline({ milestones, status }) {
    let currentStep = -1;
    let stepStatus = 'process';

    if (status === 'REGISTRATION') currentStep = 1;
    if (status === 'ONGOING') currentStep = 2;
    if (status === 'DEFENSE') currentStep = 3;
    if (status === 'COMPLETED') {
        currentStep = 4;
        stepStatus = 'finish';
    }

    const colorHexMap = {
        green: '#52c41a',
        orange: '#fa8c16',
        blue: '#003366',
        purple: '#722ed1',
        default: '#8c8c8c',
    };
    const activeHex = colorHexMap[statusConfig[status]?.color] || '#003366';

    return (
        <ConfigProvider theme={{ token: { colorPrimary: activeHex } }}>
            <Steps
                size="small"
                labelPlacement="vertical"
                current={currentStep}
                status={stepStatus}
                items={milestones.map((milestone) => ({
                    title: <span className="text-xs font-medium">{milestone.title}</span>,
                    description: milestone.date ? (
                        <span className="text-[11px] text-slate-400">{milestone.date}</span>
                    ) : null,
                }))}
                style={{ width: '100%', maxWidth: 600, margin: '0 auto' }}
            />
        </ConfigProvider>
    );
}

function PeriodCard({ period, onEdit, onDelete, onClone }) {
    const isCompleted = period.status === 'COMPLETED';
    const cfg = statusConfig[period.status] || statusConfig.UPCOMING;

    return (
        <div
            className={`bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all ${
                isCompleted ? 'opacity-75' : ''
            }`}
        >
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="w-60 shrink-0 space-y-2">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${cfg.tw}`}>
                        {cfg.label}
                    </span>
                    <h4 className="text-lg font-black text-slate-900">{period.name}</h4>
                    <p className="text-xs text-slate-400">Mã đợt: {period.code}</p>
                </div>

                <div className="flex-1 flex items-center justify-center min-w-[500px]">
                    <PeriodTimeline milestones={period.milestones} status={period.status} />
                </div>

                <div className="w-48 shrink-0 flex flex-col items-end gap-3">
                    {period.status === 'UPCOMING' ? (
                        <p className="text-xs text-slate-400 italic">Chưa có dữ liệu thống kê</p>
                    ) : isCompleted ? (
                        <p className="text-xs text-slate-400 italic">Đã lưu trữ</p>
                    ) : (
                        <div className="flex items-center gap-3 text-xs">
                            <span>
                                <strong>{period.topics}</strong> đề tài
                            </span>
                            <span className="text-slate-300">|</span>
                            <span>
                                <strong>{period.students}</strong> SV
                            </span>
                        </div>
                    )}

                    <Space>
                        <Tooltip title="Sao chép cấu hình">
                            <Button
                                type="text"
                                icon={<CopyOutlined />}
                                size="small"
                                onClick={() => onClone(period)}
                            />
                        </Tooltip>
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
                </div>
            </div>
        </div>
    );
}

function ProjectPeriodPage() {
    const [defaultSemesterId, setDefaultSemesterId] = useState(null);
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingToggle, setUpdatingToggle] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [form] = Form.useForm();

    const fetchSemesters = useCallback(async () => {
        try {
            setLoading(true);
            const [semesterRes, topicRes, registrationRes] = await Promise.all([
                semesterService.getAll(),
                topicService.getAll(),
                registrationService.getAllRegistrations(),
            ]);

            if (!semesterRes.success) return;

            const topicsBySemester = (topicRes?.data || []).reduce((acc, topic) => {
                acc[topic.semesterId] = (acc[topic.semesterId] || 0) + 1;
                return acc;
            }, {});

            const studentsBySemester = (registrationRes?.data || []).reduce((acc, registration) => {
                acc[registration.semesterId] = (acc[registration.semesterId] || 0) + 1;
                return acc;
            }, {});

            const mapped = semesterRes.data.map((semester) => ({
                key: semester.id.toString(),
                id: semester.id,
                name: semester.name,
                code: `HK-${semester.id}`,
                status: semester.status,
                registrationOpen:
                    typeof semester.registrationOpen === 'boolean' ? semester.registrationOpen : true,
                topics: topicsBySemester[semester.id] || 0,
                students: studentsBySemester[semester.id] || 0,
                milestones: [
                    {
                        title: 'Bắt đầu',
                        date: semester.startDate
                            ? new Date(semester.startDate).toLocaleDateString('vi-VN')
                            : '',
                    },
                    {
                        title: 'Hạn đăng ký',
                        date: semester.registrationDeadline
                            ? new Date(semester.registrationDeadline).toLocaleDateString('vi-VN')
                            : '',
                    },
                    {
                        title: 'Báo cáo giữa kỳ',
                        date: semester.midtermReportDate
                            ? new Date(semester.midtermReportDate).toLocaleDateString('vi-VN')
                            : '',
                    },
                    {
                        title: 'Bảo vệ',
                        date: semester.defenseDate
                            ? new Date(semester.defenseDate).toLocaleDateString('vi-VN')
                            : '',
                    },
                    {
                        title: 'Kết thúc',
                        date: semester.endDate
                            ? new Date(semester.endDate).toLocaleDateString('vi-VN')
                            : '',
                    },
                ],
                rawData: semester,
            }));

            setPeriods(mapped);
            if (mapped.length > 0) {
                setDefaultSemesterId((current) =>
                    current && mapped.some((period) => period.id === current) ? current : mapped[0].id
                );
            } else {
                setDefaultSemesterId(null);
            }
        } catch (error) {
            message.error(error?.message || 'Lỗi tải danh sách đợt đồ án');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSemesters();
    }, [fetchSemesters]);

    const selectedPeriod = useMemo(
        () => periods.find((period) => period.id === defaultSemesterId) || null,
        [periods, defaultSemesterId]
    );

    const handleRegistrationToggle = async (checked) => {
        if (!selectedPeriod) {
            message.warning('Vui lòng chọn học kỳ trước khi thay đổi trạng thái đăng ký.');
            return;
        }

        const localWarning = getToggleWindowWarning(selectedPeriod);
        if (localWarning) {
            message.warning(localWarning, 4);
        }

        try {
            setUpdatingToggle(true);
            const response = await semesterService.toggleRegistration(selectedPeriod.id, checked);
            if (response.success) {
                message.success(
                    checked ? 'Đã mở đăng ký đề tài cho học kỳ đã chọn.' : 'Đã đóng đăng ký đề tài cho học kỳ đã chọn.'
                );
                setPeriods((current) =>
                    current.map((period) =>
                        period.id === selectedPeriod.id
                            ? { ...period, registrationOpen: checked, rawData: { ...period.rawData, registrationOpen: checked } }
                            : period
                    )
                );
                if (response.warning) {
                    message.warning(response.warning, 4);
                }
            }
        } catch (error) {
            message.error(error?.message || 'Không thể cập nhật trạng thái đăng ký.');
        } finally {
            setUpdatingToggle(false);
        }
    };

    const handleAdd = () => {
        setModalMode('add');
        form.resetFields();
        form.setFieldsValue({ status: 'UPCOMING', registrationOpen: true });
        setIsModalVisible(true);
    };

    const handleEdit = (period) => {
        setModalMode('edit');
        form.setFieldsValue({
            id: period.id,
            name: period.rawData.name,
            status: period.rawData.status,
            registrationOpen: period.rawData.registrationOpen,
            startDate: dayjs(period.rawData.startDate),
            endDate: dayjs(period.rawData.endDate),
            registrationDeadline: period.rawData.registrationDeadline
                ? dayjs(period.rawData.registrationDeadline)
                : null,
            midtermReportDate: period.rawData.midtermReportDate
                ? dayjs(period.rawData.midtermReportDate)
                : null,
            defenseDate: period.rawData.defenseDate ? dayjs(period.rawData.defenseDate) : null,
        });
        setIsModalVisible(true);
    };

    const handleClone = (period) => {
        setModalMode('add');
        form.setFieldsValue({
            name: `${period.rawData.name} (Copy)`,
            status: 'UPCOMING',
            registrationOpen: period.rawData.registrationOpen,
            startDate: dayjs(period.rawData.startDate).add(1, 'year'),
            endDate: dayjs(period.rawData.endDate).add(1, 'year'),
            registrationDeadline: period.rawData.registrationDeadline
                ? dayjs(period.rawData.registrationDeadline).add(1, 'year')
                : null,
            midtermReportDate: period.rawData.midtermReportDate
                ? dayjs(period.rawData.midtermReportDate).add(1, 'year')
                : null,
            defenseDate: period.rawData.defenseDate
                ? dayjs(period.rawData.defenseDate).add(1, 'year')
                : null,
        });
        message.info(`Đã sao chép cấu hình từ đợt ${period.name}`);
        setIsModalVisible(true);
    };

    const handleDelete = (id) => {
        Modal.confirm({
            title: 'Xác nhận xóa',
            content: 'Chỉ xóa được nếu chưa có dữ liệu liên kết.',
            okText: 'Xóa',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    const response = await semesterService.delete(id);
                    if (response.success) {
                        message.success('Xóa thành công');
                        fetchSemesters();
                    }
                } catch (error) {
                    message.error(error?.message || 'Có lỗi xảy ra khi xóa');
                }
            },
        });
    };

    const handleModalSubmit = async () => {
        try {
            const values = await form.validateFields();
            const payload = {
                name: values.name,
                status: values.status,
                registrationOpen: !!values.registrationOpen,
                startDate: values.startDate.toISOString(),
                endDate: values.endDate.toISOString(),
                registrationDeadline: values.registrationDeadline.toISOString(),
                midtermReportDate: values.midtermReportDate
                    ? values.midtermReportDate.toISOString()
                    : null,
                defenseDate: values.defenseDate ? values.defenseDate.toISOString() : null,
            };

            const response =
                modalMode === 'add'
                    ? await semesterService.create(payload)
                    : await semesterService.update(values.id, payload);

            if (response.success) {
                message.success(modalMode === 'add' ? 'Tạo thành công' : 'Cập nhật thành công');
                setIsModalVisible(false);
                fetchSemesters();
            }
        } catch (error) {
            message.error(error?.message || 'Có lỗi xảy ra');
        }
    };

    return (
        <div className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">Quản lý Đợt Đồ án</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Thiết lập khung thời gian và cấu hình hệ thống cho toàn trường.
                    </p>
                </div>
                <button
                    onClick={handleAdd}
                    className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-primary-800 transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Tạo đợt mới
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined">edit_notifications</span>
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 cursor-pointer">Cho phép đăng ký đề tài</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Bật/tắt đăng ký theo học kỳ đang chọn ở cột bên phải.
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={!!selectedPeriod?.registrationOpen}
                        onChange={handleRegistrationToggle}
                        loading={updatingToggle}
                        disabled={!selectedPeriod}
                    />
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined">dashboard_customize</span>
                        </div>
                        <div>
                            <p className="font-bold text-slate-900">Học kỳ đang chọn</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Dùng để cấu hình trạng thái mở/đóng đăng ký.
                            </p>
                        </div>
                    </div>
                    <Select
                        value={defaultSemesterId}
                        onChange={setDefaultSemesterId}
                        style={{ width: 220 }}
                        options={periods.map((period) => ({ value: period.id, label: period.name }))}
                    />
                </div>
            </div>

            <h3 className="text-lg font-black text-slate-900 mb-4">Danh sách Đợt Đồ án</h3>
            <Spin spinning={loading}>
                <div className="space-y-4 mb-10 min-h-[200px]">
                    {periods.length === 0 && !loading ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">
                                event_busy
                            </span>
                            <p className="text-slate-500">Chưa có đợt đồ án nào.</p>
                        </div>
                    ) : (
                        periods.map((period) => (
                            <PeriodCard
                                key={period.key}
                                period={period}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onClone={handleClone}
                            />
                        ))
                    )}
                </div>
            </Spin>

            <Modal
                title={modalMode === 'add' ? 'Tạo đợt đồ án mới' : 'Cập nhật đợt đồ án'}
                open={isModalVisible}
                onOk={handleModalSubmit}
                onCancel={() => setIsModalVisible(false)}
                okText={modalMode === 'add' ? 'Lưu và khởi tạo' : 'Cập nhật'}
                cancelText="Hủy"
                width={700}
            >
                <Form form={form} layout="vertical" name="project_period_form" style={{ marginTop: 16 }}>
                    <Form.Item name="id" hidden>
                        <Input />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item
                                name="name"
                                label="Tên đợt đồ án"
                                rules={[
                                    {
                                        required: true,
                                        message: 'Nhập tên đợt (VD: Đồ án HK1 2024.1)',
                                    },
                                ]}
                            >
                                <Input placeholder="VD: Đồ án tốt nghiệp - HK1 2024-2025" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="status"
                                label="Trạng thái học kỳ"
                                rules={[{ required: true, message: 'Chọn trạng thái học kỳ' }]}
                            >
                                <Select
                                    options={[
                                        { value: 'UPCOMING', label: 'Sắp tới' },
                                        { value: 'REGISTRATION', label: 'Đang đăng ký' },
                                        { value: 'ONGOING', label: 'Đang diễn ra' },
                                        { value: 'DEFENSE', label: 'Bảo vệ' },
                                        { value: 'COMPLETED', label: 'Hoàn thành' },
                                    ]}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="registrationOpen"
                                label="Mở đăng ký"
                                valuePropName="checked"
                            >
                                <Switch />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="registrationDeadline"
                                label="Ngày đóng đăng ký đề tài"
                                rules={[{ required: true, message: 'Chọn ngày' }]}
                            >
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="midtermReportDate" label="Ngày hạn nộp báo cáo giữa kỳ">
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="defenseDate" label="Ngày dự kiến bảo vệ">
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <hr className="my-4 border-slate-100" />
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="startDate"
                                label="Ngày khai mạc đợt"
                                rules={[{ required: true, message: 'Chọn ngày' }]}
                            >
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="endDate"
                                label="Ngày kết thúc đợt"
                                rules={[{ required: true, message: 'Chọn ngày' }]}
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
