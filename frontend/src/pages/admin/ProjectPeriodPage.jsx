import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Button,
    Col,
    ConfigProvider,
    DatePicker,
    Form,
    Input,
    InputNumber,
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
    PlusOutlined,
    CalendarOutlined,
    CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import registrationService from '../../services/registrationService';
import { semesterService } from '../../services/semesterService';
import { topicService } from '../../services/topicService';
import PageHeader from '../../components/common/PageHeader';
import { PROJECT_NAME, buildSemesterName, extractSemesterMeta, formatSemesterLabel } from '../../utils/semesterDisplay';

const statusConfig = {
    ONGOING: { label: 'Đang diễn ra', color: 'green', tw: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    REGISTRATION: { label: 'Đang đăng ký', color: 'orange', tw: 'bg-amber-50 text-amber-700 border-amber-200' },
    UPCOMING: { label: 'Sắp tới', color: 'blue', tw: 'bg-blue-50 text-blue-700 border-blue-200' },
    DEFENSE: { label: 'Bảo vệ', color: 'purple', tw: 'bg-purple-50 text-purple-700 border-purple-200' },
    COMPLETED: { label: 'Hoàn thành', color: 'default', tw: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const REGISTRATION_TOGGLE_WARNING_WINDOW_DAYS = 14;

const getToggleWindowWarning = (period) => {
    const startDate = period?.rawData?.startDate;
    const registrationDeadline = period?.rawData?.registrationDeadline;

    if (!startDate || !registrationDeadline) {
        return 'Học kỳ chưa đủ mốc thời gian để đối chiếu cửa sổ khuyến nghị, hệ thống vẫn cho phép thay đổi.';
    }

    const start = dayjs(startDate);
    const deadline = dayjs(registrationDeadline);
    if (!start.isValid() || !deadline.isValid()) {
        return 'Dữ liệu ngày không hợp lệ, hệ thống vẫn cho phép thay đổi trạng thái đăng ký.';
    }

    const now = dayjs();
    const windowStart = start.subtract(REGISTRATION_TOGGLE_WARNING_WINDOW_DAYS, 'day');
    const windowEnd = deadline.add(REGISTRATION_TOGGLE_WARNING_WINDOW_DAYS, 'day');

    if (now.isBefore(windowStart) || now.isAfter(windowEnd)) {
        return `Bạn đang thay đổi ngoài khuyến nghị (${windowStart.format('DD/MM/YYYY')} - ${windowEnd.format('DD/MM/YYYY')}).`;
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
        green: '#10B981',
        orange: '#F59E0B',
        blue: '#2563EB',
        purple: '#7C3AED',
        default: '#64748B',
    };
    const activeHex = colorHexMap[statusConfig[status]?.color] || '#1E3A5F';

    return (
        <ConfigProvider theme={{ token: { colorPrimary: activeHex } }}>
            <Steps
                size="small"
                labelPlacement="vertical"
                current={currentStep}
                status={stepStatus}
                items={milestones.map((milestone) => ({
                    title: <span className="text-xs font-semibold text-slate-700">{milestone.title}</span>,
                    description: milestone.date ? (
                        <span className="text-[11px] text-slate-400 font-medium">{milestone.date}</span>
                    ) : null,
                }))}
                style={{ width: '100%', maxWidth: 580, margin: '0 auto' }}
            />
        </ConfigProvider>
    );
}

function PeriodCard({ period, onEdit, onDelete, onClone }) {
    const isCompleted = period.status === 'COMPLETED';
    const cfg = statusConfig[period.status] || statusConfig.UPCOMING;

    return (
        <div
            className={`bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-all duration-200 ${
                isCompleted ? 'opacity-80 bg-slate-50/40' : ''
            }`}
        >
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                {/* Period Identity */}
                <div className="w-full xl:w-64 shrink-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.tw}`}>
                            {cfg.label}
                        </span>
                        {period.registrationOpen && (
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                Đang mở ĐK
                            </span>
                        )}
                    </div>
                    <h4 className="text-base font-black text-slate-900 leading-snug">{period.name}</h4>
                    <p className="text-xs text-slate-400 font-medium">Mã đợt: {period.code}</p>
                </div>

                {/* Progress Steps Timeline */}
                <div className="flex-1 w-full overflow-x-auto py-2">
                    <PeriodTimeline milestones={period.milestones} status={period.status} />
                </div>

                {/* Stats & Actions Strip */}
                <div className="w-full xl:w-56 shrink-0 flex xl:flex-col items-center xl:items-end justify-between xl:justify-center gap-3 pt-3 xl:pt-0 border-t xl:border-t-0 border-slate-100">
                    {period.status === 'UPCOMING' ? (
                        <p className="text-xs text-slate-400 italic">Chưa mở đợt</p>
                    ) : isCompleted ? (
                        <p className="text-xs text-slate-400 italic">Đã kết thúc & lưu trữ</p>
                    ) : (
                        <div className="flex items-center gap-2 text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-600">
                                <strong className="text-slate-900">{period.topics}</strong> đề tài
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600">
                                <strong className="text-blue-600">{period.students}</strong> SV
                            </span>
                        </div>
                    )}

                    <Space size="small">
                        <Tooltip title="Sao chép cấu hình">
                            <Button
                                icon={<CopyOutlined />}
                                size="small"
                                onClick={() => onClone(period)}
                            />
                        </Tooltip>
                        {!isCompleted && (
                            <Tooltip title="Chỉnh sửa đợt">
                                <Button
                                    icon={<EditOutlined />}
                                    size="small"
                                    onClick={() => onEdit(period)}
                                />
                            </Tooltip>
                        )}
                        {!isCompleted && (
                            <Tooltip title="Xóa đợt">
                                <Button
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
                ...extractSemesterMeta(semester),
                key: semester.id.toString(),
                id: semester.id,
                name: formatSemesterLabel(semester),
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
        form.setFieldsValue({
            status: 'UPCOMING',
            registrationOpen: true,
            projectName: PROJECT_NAME,
            term: 1,
            academicStartYear: dayjs().year(),
        });
        setIsModalVisible(true);
    };

    const handleEdit = (period) => {
        setModalMode('edit');
        const meta = extractSemesterMeta(period.rawData);
        const startYear = Number.parseInt((meta.academicYear || '').split('-')[0], 10) || dayjs().year();
        form.setFieldsValue({
            id: period.id,
            projectName: PROJECT_NAME,
            term: meta.term,
            academicStartYear: startYear,
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
        const meta = extractSemesterMeta(period.rawData);
        const cloneStartYear = Number.parseInt((meta.academicYear || '').split('-')[0], 10) + 1;
        form.setFieldsValue({
            projectName: PROJECT_NAME,
            term: meta.term,
            academicStartYear: Number.isInteger(cloneStartYear) ? cloneStartYear : dayjs().year() + 1,
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
            title: 'Xác nhận xóa đợt đồ án',
            content: 'Hành động này chỉ xóa được nếu đợt chưa có sinh viên đăng ký đề tài hoặc phân công hội đồng.',
            okText: 'Xóa đợt',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    const response = await semesterService.delete(id);
                    if (response.success) {
                        message.success('Đã xóa đợt đồ án');
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
                name: buildSemesterName({
                    term: values.term,
                    academicYear: `${values.academicStartYear}-${values.academicStartYear + 1}`,
                }),
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
                message.success(modalMode === 'add' ? 'Khởi tạo đợt thành công' : 'Cập nhật đợt thành công');
                setIsModalVisible(false);
                fetchSemesters();
            }
        } catch (error) {
            message.error(error?.message || 'Có lỗi xảy ra');
        }
    };

    return (
        <div className="py-2 space-y-6">
            <PageHeader
                title="Quản lý Đợt Đồ án"
                subtitle={`Cấu hình học kỳ và các mốc thời gian quan trọng (${PROJECT_NAME})`}
                actions={
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAdd}
                    >
                        Tạo đợt đồ án mới
                    </Button>
                }
            />

            {/* Registration Quick Switch Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[20px]">edit_notifications</span>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">Cho phép đăng ký đề tài</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Bật/tắt mở cổng đăng ký cho học kỳ đang chọn.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                        <Switch
                            checked={!!selectedPeriod?.registrationOpen}
                            onChange={handleRegistrationToggle}
                            loading={updatingToggle}
                            disabled={!selectedPeriod}
                        />
                        {selectedPeriod && (
                            <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                    selectedPeriod.registrationOpen
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                            >
                                {selectedPeriod.registrationOpen ? 'Đang mở' : 'Đang đóng'}
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[20px]">dashboard_customize</span>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">Học kỳ đang chọn</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Cấu hình áp dụng cho đợt được chọn này.
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

            {/* List of Period Cards */}
            <div className="space-y-4">
                <div className="flex items-center justify-between pb-1">
                    <h3 className="text-base font-bold text-slate-900">
                        Danh sách Các Đợt Đồ Án
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">
                        Tổng cộng: {periods.length} đợt
                    </span>
                </div>

                <Spin spinning={loading}>
                    <div className="space-y-4 min-h-[160px]">
                        {periods.length === 0 && !loading ? (
                            <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">
                                    event_busy
                                </span>
                                <p className="text-sm text-slate-500 font-medium">Chưa có đợt đồ án nào được khởi tạo.</p>
                                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} className="mt-4">
                                    Tạo đợt đầu tiên
                                </Button>
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
            </div>

            {/* Modal Form */}
            <Modal
                title={modalMode === 'add' ? 'Tạo đợt đồ án mới' : 'Cập nhật đợt đồ án'}
                open={isModalVisible}
                onOk={handleModalSubmit}
                onCancel={() => setIsModalVisible(false)}
                okText={modalMode === 'add' ? 'Lưu và khởi tạo' : 'Cập nhật'}
                cancelText="Hủy"
                width={700}
                destroyOnClose
            >
                <Form form={form} layout="vertical" name="project_period_form" style={{ marginTop: 16 }}>
                    <Form.Item name="id" hidden>
                        <Input />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="projectName" label="Tên đồ án" initialValue={PROJECT_NAME}>
                                <Input disabled />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="term" label="Học kỳ" rules={[{ required: true, message: 'Chọn học kỳ' }]}>
                                <Select
                                    options={[
                                        { value: 1, label: 'Học kỳ 1' },
                                        { value: 2, label: 'Học kỳ 2' },
                                    ]}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="academicStartYear" label="Năm học bắt đầu" rules={[{ required: true, message: 'Nhập năm bắt đầu' }]}>
                                <InputNumber min={2000} max={2100} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="status" label="Trạng thái học kỳ" rules={[{ required: true, message: 'Chọn trạng thái học kỳ' }]}>
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
                            <Form.Item name="registrationOpen" label="Mở đăng ký đề tài" valuePropName="checked">
                                <Switch />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="registrationDeadline" label="Ngày đóng đăng ký đề tài" rules={[{ required: true, message: 'Chọn ngày' }]}>
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
                    <hr className="my-3 border-slate-100" />
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="startDate" label="Ngày khai mạc đợt" rules={[{ required: true, message: 'Chọn ngày' }]}>
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="endDate" label="Ngày kết thúc đợt" rules={[{ required: true, message: 'Chọn ngày' }]}>
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
