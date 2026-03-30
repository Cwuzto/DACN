import { useState, useEffect } from 'react';
import {
    Card, Tag, Button, Select, Steps, Switch, ConfigProvider,
    Tooltip, Space, Modal, Form, Input, DatePicker, message, Spin, Row, Col
} from 'antd';
import dayjs from 'dayjs';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, ArrowRightOutlined,
    EyeOutlined, CopyOutlined
} from '@ant-design/icons';
import { semesterService } from '../../services/semesterService';

const statusConfig = {
    ONGOING: { label: 'Đang diễn ra', color: 'green', tw: 'bg-green-100 text-green-700' },
    REGISTRATION: { label: 'Đang đăng ký', color: 'orange', tw: 'bg-orange-100 text-orange-700' },
    UPCOMING: { label: 'Sắp tới', color: 'blue', tw: 'bg-blue-100 text-blue-700' },
    DEFENSE: { label: 'Bảo vệ', color: 'purple', tw: 'bg-purple-100 text-purple-700' },
    COMPLETED: { label: 'Hoàn thành', color: 'default', tw: 'bg-slate-100 text-slate-600' },
};

/* ===== Timeline component ===== */
function PeriodTimeline({ milestones, status }) {
    let currentStep = -1;
    let stepStatus = 'process';
    switch (status) {
        case 'UPCOMING': currentStep = -1; break;
        case 'REGISTRATION': currentStep = 1; break;
        case 'ONGOING': currentStep = 2; break; // Giữa kỳ
        case 'DEFENSE': currentStep = 3; break;
        case 'COMPLETED': currentStep = 5; stepStatus = 'finish'; break;
        default: currentStep = -1;
    }

    const colorHexMap = { green: '#52c41a', orange: '#fa8c16', blue: '#003366', purple: '#722ed1', default: '#8c8c8c' };
    const activeHex = colorHexMap[statusConfig[status]?.color] || '#003366';

    return (
        <ConfigProvider theme={{ token: { colorPrimary: activeHex } }}>
            <Steps size="small" labelPlacement="vertical" current={currentStep} status={stepStatus}
                items={milestones.map((m) => ({
                    title: <span className="text-xs font-medium">{m.title}</span>,
                    description: m.date ? <span className="text-[11px] text-slate-400">{m.date}</span> : null,
                }))}
                style={{ width: '100%', maxWidth: 600, margin: '0 auto' }}
            />
        </ConfigProvider>
    );
}

/* ===== Period Card ===== */
function PeriodCard({ period, onEdit, onDelete, onClone }) {
    const isCompleted = period.status === 'COMPLETED';
    const cfg = statusConfig[period.status];

    return (
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all ${isCompleted ? 'opacity-75' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-6">
                {/* Left: Info */}
                <div className="w-60 shrink-0 space-y-2">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${cfg.tw}`}>{cfg.label}</span>
                    <h4 className="text-lg font-black text-slate-900">{period.name}</h4>
                    <p className="text-xs text-slate-400">Mã đợt: {period.code}</p>
                </div>

                {/* Middle: Timeline */}
                <div className="flex-1 flex items-center justify-center min-w-[500px]">
                    <PeriodTimeline milestones={period.milestones} status={period.status} />
                </div>

                {/* Right: Stats & Actions */}
                <div className="w-48 shrink-0 flex flex-col items-end gap-3">
                    {period.status === 'UPCOMING' ? (
                        <p className="text-xs text-slate-400 italic">Chưa có dữ liệu thống kê</p>
                    ) : isCompleted ? (
                        <p className="text-xs text-slate-400 italic">Đã lưu trữ</p>
                    ) : (
                        <div className="flex items-center gap-3 text-xs">
                            <span><strong>{period.topics}</strong> đề tài</span>
                            <span className="text-slate-300">|</span>
                            <span><strong>{period.groups}</strong> nhóm</span>
                            <span className="text-slate-300">|</span>
                            <span><strong>{period.students}</strong> SV</span>
                        </div>
                    )}
                    <Space>
                        <Tooltip title="Sao chép cấu hình"><Button type="text" icon={<CopyOutlined />} size="small" onClick={() => onClone(period)} /></Tooltip>
                        {!isCompleted && <Tooltip title="Chỉnh sửa"><Button type="text" icon={<EditOutlined />} size="small" onClick={() => onEdit(period)} /></Tooltip>}
                        <Button type={isCompleted ? 'text' : 'default'} size="small" icon={isCompleted ? <EyeOutlined /> : <ArrowRightOutlined />}>{isCompleted ? 'Xem lại' : 'Chi tiết'}</Button>
                        {!isCompleted && <Tooltip title="Xóa"><Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => onDelete(period.id)} /></Tooltip>}
                    </Space>
                </div>
            </div>
        </div>
    );
}

/* ===== Main Page ===== */
function ProjectPeriodPage() {
    const [topicRegistrationOpen, setTopicRegistrationOpen] = useState(true);
    const [defaultPeriod, setDefaultPeriod] = useState(null);
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [form] = Form.useForm();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchSemesters(); }, []);

    const fetchSemesters = async () => {
        try {
            setLoading(true);
            const res = await semesterService.getAll();
            if (res.success) {
                const mapped = res.data.map(p => ({
                    key: p.id.toString(), id: p.id, name: p.name, code: `HK-${p.id}`, status: p.status,
                    topics: 0, groups: 0, students: 0,
                    milestones: [
                        { title: 'Bắt đầu', date: new Date(p.startDate).toLocaleDateString('vi-VN') },
                        { title: 'Hạn ĐK', date: p.registrationDeadline ? new Date(p.registrationDeadline).toLocaleDateString('vi-VN') : '' },
                        { title: 'Báo cáo giữa kỳ', date: p.midtermReportDate ? new Date(p.midtermReportDate).toLocaleDateString('vi-VN') : '' },
                        { title: 'Bảo vệ', date: p.defenseDate ? new Date(p.defenseDate).toLocaleDateString('vi-VN') : '' },
                        { title: 'Kết thúc', date: new Date(p.endDate).toLocaleDateString('vi-VN') },
                    ],
                    rawData: p
                }));
                // Thêm một field ảo nếu midtermReportDate chưa có trong API backend
                setPeriods(mapped);
                if (mapped.length > 0 && !defaultPeriod) setDefaultPeriod(mapped[0].code);
            }
        } catch (error) { message.error('Lỗi tải danh sách đợt đồ án: ' + error.message); }
        finally { setLoading(false); }
    };

    const handleAdd = () => { setModalMode('add'); form.resetFields(); setIsModalVisible(true); };

    const handleEdit = (period) => {
        setModalMode('edit');
        form.setFieldsValue({
            id: period.id, name: period.rawData.name, startDate: dayjs(period.rawData.startDate), endDate: dayjs(period.rawData.endDate),
            registrationDeadline: period.rawData.registrationDeadline ? dayjs(period.rawData.registrationDeadline) : null,
            midtermReportDate: period.rawData.midtermReportDate ? dayjs(period.rawData.midtermReportDate) : null,
            defenseDate: period.rawData.defenseDate ? dayjs(period.rawData.defenseDate) : null,
        });
        setIsModalVisible(true);
    };

    const handleClone = (period) => {
        setModalMode('add'); // Clone is basically prepopulating Add
        form.setFieldsValue({
            name: period.rawData.name + ' (Copy)',
            startDate: dayjs(period.rawData.startDate).add(1, 'year'),
            endDate: dayjs(period.rawData.endDate).add(1, 'year'),
            registrationDeadline: period.rawData.registrationDeadline ? dayjs(period.rawData.registrationDeadline).add(1, 'year') : null,
            midtermReportDate: period.rawData.midtermReportDate ? dayjs(period.rawData.midtermReportDate).add(1, 'year') : null,
            defenseDate: period.rawData.defenseDate ? dayjs(period.rawData.defenseDate).add(1, 'year') : null,
        });
        message.info('Đã sao chép cấu hình từ đợt ' + period.name);
        setIsModalVisible(true);
    };

    const handleDelete = (id) => {
        Modal.confirm({
            title: 'Xác nhận xóa', content: 'Chỉ xóa được nếu chưa có dữ liệu liên kết.',
            okText: 'Xóa', okType: 'danger', cancelText: 'Hủy',
            onOk: async () => {
                try { const res = await semesterService.delete(id); if (res.success) { message.success('Xóa thành công'); fetchSemesters(); } }
                catch (error) { message.error(error?.message || 'Có lỗi xảy ra khi xóa'); }
            }
        });
    };

    const handleModalSubmit = async () => {
        try {
            const values = await form.validateFields();
            const payload = {
                name: values.name, startDate: values.startDate.toISOString(), endDate: values.endDate.toISOString(),
                registrationDeadline: values.registrationDeadline.toISOString(),
                midtermReportDate: values.midtermReportDate ? values.midtermReportDate.toISOString() : null,
                defenseDate: values.defenseDate ? values.defenseDate.toISOString() : null,
            };
            if (modalMode === 'add') { const res = await semesterService.create(payload); if (res.success) { message.success('Tạo thành công'); setIsModalVisible(false); fetchSemesters(); } }
            else { const res = await semesterService.update(values.id, payload); if (res.success) { message.success('Cập nhật thành công'); setIsModalVisible(false); fetchSemesters(); } }
        } catch (error) { message.error(error?.message || 'Có lỗi xảy ra'); }
    };

    return (
        <div className="py-2">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">Quản lý Đợt Đồ án</h2>
                    <p className="text-sm text-slate-500 mt-1">Thiết lập khung thời gian và cấu hình hệ thống cho toàn trường.</p>
                </div>
                <button onClick={handleAdd} className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-primary-800 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Tạo đợt mới
                </button>
            </div>

            {/* Quick Config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined">edit_notifications</span>
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 cursor-pointer">Cho phép Đăng ký đề tài</p>
                            <p className="text-xs text-slate-500 mt-0.5">Mở/Đóng đăng ký đề tài cho Sinh viên & Giảng viên trên hệ thống</p>
                        </div>
                    </div>
                    <Switch checked={topicRegistrationOpen} onChange={setTopicRegistrationOpen} />
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined">dashboard_customize</span>
                        </div>
                        <div>
                            <p className="font-bold text-slate-900">Đợt kích hoạt mặc định</p>
                            <p className="text-xs text-slate-500 mt-0.5">Đợt đang được hiển thị mặc định trên trang chủ SV/GV.</p>
                        </div>
                    </div>
                    <Select value={defaultPeriod} onChange={setDefaultPeriod} style={{ width: 180 }}
                        options={periods.map(p => ({ value: p.code, label: p.name }))}
                    />
                </div>
            </div>

            {/* Period Cards */}
            <h3 className="text-lg font-black text-slate-900 mb-4">Danh sách Đợt Đồ án</h3>
            <Spin spinning={loading}>
                <div className="space-y-4 mb-10 min-h-[200px]">
                    {periods.length === 0 && !loading ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">event_busy</span>
                            <p className="text-slate-500">Chưa có đợt đồ án nào.</p>
                        </div>
                    ) : (
                        periods.map((period) => <PeriodCard key={period.key} period={period} onEdit={handleEdit} onDelete={handleDelete} onClone={handleClone} />)
                    )}
                </div>
            </Spin>

            {/* Modal Create/Edit */}
            <Modal title={modalMode === 'add' ? 'Tạo đợt đồ án mới' : 'Cập nhật đợt đồ án'}
                open={isModalVisible} onOk={handleModalSubmit} onCancel={() => setIsModalVisible(false)}
                okText={modalMode === 'add' ? 'Lưu & Khởi tạo' : 'Cập nhật'} cancelText="Hủy" width={700}>
                <Form form={form} layout="vertical" name="project_period_form" style={{ marginTop: 16 }}>
                    <Form.Item name="id" hidden><Input /></Form.Item>
                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item name="name" label="Tên đợt đồ án" rules={[{ required: true, message: 'Nhập tên đợt (VD: Đồ án HK1 2024.1)' }]}>
                                <Input placeholder="VD: Đồ án Tốt nghiệp - HK1 2024-2025" />
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
                            <Form.Item name="midtermReportDate" label="Ngày hạn nộp Báo cáo giữa kỳ">
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
