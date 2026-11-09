import { useEffect, useMemo, useState } from 'react';
import {
    Tabs,
    Table,
    Input,
    Select,
    Modal,
    Form,
    Checkbox,
    Tag,
    message,
    Progress,
    Button,
    Spin,
    Space,
} from 'antd';
import {
    EditOutlined,
    FormOutlined,
    HistoryOutlined,
    TeamOutlined,
    UserOutlined,
    InfoCircleOutlined,
    PlusOutlined,
    ReloadOutlined,
    SendOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import notificationService from '../../services/notificationService';
import councilService from '../../services/councilService';

function NotificationCenterPage() {
    const [history, setHistory] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [councils, setCouncils] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [sending, setSending] = useState(false);
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [activeTab, setActiveTab] = useState('history');
    const [form] = Form.useForm();
    const [templateForm] = Form.useForm();

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const response = await notificationService.getHistory();
            if (response.success) setHistory(response.data || []);
        } catch (error) {
            message.error(error?.message || 'Không thể tải lịch sử thông báo');
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchTemplates = async () => {
        setLoadingTemplates(true);
        try {
            const response = await notificationService.getTemplates();
            if (response.success) setTemplates(response.data || []);
        } catch (error) {
            message.error(error?.message || 'Không thể tải template thông báo');
        } finally {
            setLoadingTemplates(false);
        }
    };

    const fetchCouncils = async () => {
        try {
            const response = await councilService.getCouncils();
            if (response.success) setCouncils(response.data || []);
        } catch (error) {
            message.warning(error?.message || 'Không thể tải danh sách hội đồng');
        }
    };

    useEffect(() => {
        fetchHistory();
        fetchTemplates();
    }, []);

    const selectedAudience = Form.useWatch('audience', form);

    useEffect(() => {
        if (selectedAudience === 'SPECIFIC_COUNCIL' && councils.length === 0) {
            fetchCouncils();
        }
    }, [selectedAudience, councils.length]);

    const handleSendNotification = async () => {
        try {
            const values = await form.validateFields();
            setSending(true);
            const payload = {
                title: values.title,
                content: values.content,
                audience: values.audience,
                councilId: values.audience === 'SPECIFIC_COUNCIL' ? values.councilId : null,
                isEmail: Boolean(values.isEmail),
            };

            const response = await notificationService.sendBroadcast(payload);
            if (response.success) {
                message.success(`Đã gửi thông báo thành công (${response.data?.sentCount || 0} người nhận)`);
                setIsSendModalOpen(false);
                form.resetFields();
                setActiveTab('history');
                fetchHistory();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể gửi thông báo');
        } finally {
            setSending(false);
        }
    };

    const handleEditTemplate = (template) => {
        setEditingTemplate(template);
        templateForm.setFieldsValue({
            name: template.name,
            title: template.title,
            content: template.content,
            autoTrigger: template.autoTrigger,
            isActive: Boolean(template.isActive),
        });
        setIsTemplateModalOpen(true);
    };

    const handleSaveTemplate = async () => {
        if (!editingTemplate) return;
        try {
            const values = await templateForm.validateFields();
            setSavingTemplate(true);
            const response = await notificationService.updateTemplate(editingTemplate.key, values);
            if (response.success) {
                message.success('Đã cập nhật template');
                setIsTemplateModalOpen(false);
                setEditingTemplate(null);
                fetchTemplates();
            }
        } catch (error) {
            message.error(error?.message || 'Không thể cập nhật template');
        } finally {
            setSavingTemplate(false);
        }
    };

    const audienceTag = (audience) => {
        if (audience === 'ALL_STUDENTS') return <Tag color="blue" icon={<UserOutlined />}>Toàn bộ Sinh viên</Tag>;
        if (audience === 'ALL_LECTURERS') return <Tag color="purple" icon={<TeamOutlined />}>Toàn bộ Giảng viên</Tag>;
        if (audience === 'ALL_ADMINS') return <Tag color="red">Toàn bộ Quản trị viên</Tag>;
        if (audience === 'ALL_USERS') return <Tag color="geekblue">Toàn bộ Hệ thống</Tag>;
        if (audience === 'SPECIFIC_COUNCIL') return <Tag color="gold">Theo hội đồng cụ thể</Tag>;
        return <Tag>{audience}</Tag>;
    };

    const columnsHistory = useMemo(
        () => [
            {
                title: 'Tiêu đề thông báo',
                dataIndex: 'title',
                key: 'title',
                width: '38%',
                render: (text, record) => (
                    <div className="space-y-1">
                        <div className="font-bold text-slate-900 leading-snug line-clamp-2 text-sm">{text}</div>
                        <code className="text-[10px] text-slate-500 font-mono px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 inline-block">
                            {record.type || 'BROADCAST'}
                        </code>
                    </div>
                ),
            },
            {
                title: 'Đối tượng nhận',
                dataIndex: 'audience',
                key: 'audience',
                width: 200,
                render: (value) => audienceTag(value),
            },
            {
                title: 'Thời gian gửi',
                dataIndex: 'sentAt',
                key: 'sentAt',
                width: 170,
                render: (time) => (
                    <span className="text-xs font-mono text-slate-600">
                        {dayjs(time).format('HH:mm DD/MM/YYYY')}
                    </span>
                ),
            },
            {
                title: 'Tỉ lệ đã đọc',
                key: 'readRate',
                render: (_, record) => {
                    const denominator = record.totalAudience || 1;
                    const percent = Math.round(((record.readCount || 0) / denominator) * 100);
                    return (
                        <div className="w-full max-w-[200px]">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-500">
                                    {record.readCount || 0} / {record.totalAudience || 0} người
                                </span>
                                <span className="font-bold text-slate-800">{percent}%</span>
                            </div>
                            <Progress
                                percent={percent}
                                showInfo={false}
                                size="small"
                                status={percent >= 80 ? 'success' : 'active'}
                                strokeColor="#0F766E"
                            />
                        </div>
                    );
                },
            },
        ],
        []
    );

    const averageReadRate = useMemo(() => {
        if (!history.length) return 0;
        const totalPercents = history.reduce((acc, item) => {
            const denominator = item.totalAudience || 1;
            return acc + ((item.readCount || 0) / denominator) * 100;
        }, 0);
        return Math.round(totalPercents / history.length);
    }, [history]);

    const activeTemplatesCount = useMemo(() => templates.filter((t) => t.isActive).length, [templates]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p className="eyebrow">THÔNG BÁO TÀI KHOẢN NGƯỜI DÙNG</p>
                    <h1 className="h1">Gửi Thông Báo Người Dùng</h1>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            fetchHistory();
                            fetchTemplates();
                        }}
                    >
                        <ReloadOutlined />
                        <span>Làm mới</span>
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            setIsSendModalOpen(true);
                            form.resetFields();
                        }}
                    >
                        <SendOutlined />
                        <span>Gửi thông báo người dùng</span>
                    </button>
                </div>
            </div>

            {/* 3 KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Tổng lượt gửi broadcast</span>
                    <p className="h2 num" style={{ marginTop: 2 }}>{history.length}</p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--muted)' }}>Lịch sử tin nhắn toàn trường</div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Tỉ lệ đã đọc trung bình</span>
                    <p className="h2 num" style={{ marginTop: 2, color: 'var(--accent)' }}>{averageReadRate}%</p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--accent)' }}>Hiệu quả tiếp cận thông tin</div>
                </div>
                <div className="card" style={{ padding: '14px 18px' }}>
                    <span className="meta">Mẫu tự động đang kích hoạt</span>
                    <p className="h2 num" style={{ marginTop: 2, color: 'var(--success)' }}>
                        {activeTemplatesCount} / {templates.length}
                    </p>
                    <div style={{ marginTop: 6, fontSize: '11.5px', color: 'var(--success)' }}>Đang tự kích hoạt theo sự kiện</div>
                </div>
            </div>

            {/* Main Content Tabs Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    className="px-4 lg:px-6 pt-2"
                    tabBarStyle={{ marginBottom: 0, borderBottom: '1px solid #e2e8f0' }}
                    items={[
                        {
                            key: 'history',
                            label: (
                                <span className="font-semibold flex items-center gap-1.5">
                                    <HistoryOutlined /> Lịch sử gửi thông báo ({history.length})
                                </span>
                            ),
                            children: (
                                <div className="py-4 space-y-4 min-h-[400px]">
                                    {loadingHistory ? (
                                        <div className="py-12 flex justify-center">
                                            <Spin size="large" />
                                        </div>
                                    ) : (
                                        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                                            <Table
                                                columns={columnsHistory}
                                                dataSource={history}
                                                rowKey="id"
                                                pagination={{ pageSize: 8, showTotal: (t) => `Tổng ${t} lượt gửi` }}
                                                size="middle"
                                                scroll={{ x: 800 }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: 'templates',
                            label: (
                                <span className="font-semibold flex items-center gap-1.5">
                                    <FormOutlined /> Cấu hình Mẫu sự kiện tự động ({templates.length})
                                </span>
                            ),
                            children: (
                                <div className="py-4 min-h-[400px]">
                                    {loadingTemplates ? (
                                        <div className="py-12 flex justify-center">
                                            <Spin size="large" />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {templates.map((template) => (
                                                <div
                                                    key={template.key}
                                                    className="bg-white border border-slate-200 p-4 rounded-xl hover:shadow-sm hover:border-slate-300 transition-all flex flex-col gap-3"
                                                >
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div>
                                                            <h3 className="font-bold text-slate-900 text-sm mb-1">
                                                                {template.name}
                                                            </h3>
                                                            <code className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                                                {template.key}
                                                            </code>
                                                        </div>
                                                        <Button
                                                            size="small"
                                                            icon={<EditOutlined />}
                                                            onClick={() => handleEditTemplate(template)}
                                                        >
                                                            Sửa mẫu
                                                        </Button>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Tag color="cyan" className="text-[10px] font-mono font-bold uppercase m-0">
                                                            Trigger: {template.autoTrigger}
                                                        </Tag>
                                                        <Tag
                                                            color={template.isActive ? 'success' : 'default'}
                                                            className="text-[10px] font-bold uppercase m-0"
                                                        >
                                                            {template.isActive ? 'Kích hoạt' : 'Tạm tắt'}
                                                        </Tag>
                                                    </div>

                                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs flex-1 space-y-1">
                                                        <div className="font-bold text-slate-800">
                                                            Tiêu đề: {template.title}
                                                        </div>
                                                        <div className="text-slate-600 whitespace-pre-wrap leading-relaxed line-clamp-3">
                                                            {template.content}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                    ]}
                />
            </div>

            {/* Modal Soạn thông báo Broadcast */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <SendOutlined className="text-primary" />
                        Soạn Thông Báo Gửi Người Dùng (In-App Alert)
                    </div>
                }
                open={isSendModalOpen}
                onCancel={() => setIsSendModalOpen(false)}
                onOk={handleSendNotification}
                okText="Gửi thông báo ngay"
                cancelText="Hủy bỏ"
                width={680}
                confirmLoading={sending}
                centered
            >
                <div className="text-xs text-blue-700 bg-blue-50 p-2.5 rounded-lg border border-blue-200 mb-3">
                    🔔 <b>Lưu ý:</b> Tính năng này gửi tin nhắn trực tiếp đến quả chuông của tài khoản cá nhân người dùng (Sinh viên/Giảng viên/Hội đồng). Nếu bạn muốn đăng tin tức hoặc quyết định công khai lên trang chủ Portal, vui lòng dùng mục <b>Bản tin & Quyết định Portal</b>.
                </div>
                <Form form={form} layout="vertical" className="pt-1">
                    <Form.Item
                        name="audience"
                        label={<span className="text-xs font-bold text-slate-700">Đối tượng nhận thông báo</span>}
                        rules={[{ required: true, message: 'Vui lòng chọn đối tượng nhận' }]}
                    >
                        <Select
                            placeholder="Chọn nhóm người dùng nhận thông báo"
                            options={[
                                { value: 'ALL_USERS', label: 'Toàn bộ hệ thống (Sinh viên + Giảng viên + Quản trị)' },
                                { value: 'ALL_STUDENTS', label: 'Toàn bộ Sinh viên' },
                                { value: 'ALL_LECTURERS', label: 'Toàn bộ Giảng viên' },
                                { value: 'ALL_ADMINS', label: 'Toàn bộ Quản trị viên' },
                                { value: 'SPECIFIC_COUNCIL', label: 'Theo Hội đồng cụ thể' },
                            ]}
                        />
                    </Form.Item>

                    {selectedAudience === 'SPECIFIC_COUNCIL' && (
                        <Form.Item
                            name="councilId"
                            label={<span className="text-xs font-bold text-slate-700">Chọn Hội đồng bảo vệ</span>}
                            rules={[{ required: true, message: 'Vui lòng chọn hội đồng' }]}
                        >
                            <Select
                                placeholder="-- Chọn một hội đồng --"
                                options={councils.map((council) => ({
                                    value: council.id,
                                    label: council.name,
                                }))}
                            />
                        </Form.Item>
                    )}

                    <Form.Item
                        name="title"
                        label={<span className="text-xs font-bold text-slate-700">Tiêu đề thông báo</span>}
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                    >
                        <Input placeholder="VD: Thông báo về thời hạn nộp biểu mẫu BM02 giữa kỳ" maxLength={255} />
                    </Form.Item>

                    <Form.Item
                        name="content"
                        label={<span className="text-xs font-bold text-slate-700">Nội dung chi tiết</span>}
                        rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
                    >
                        <Input.TextArea
                            rows={5}
                            placeholder="Nhập nội dung đầy đủ muốn phát tới toàn bộ người dùng mục tiêu..."
                        />
                    </Form.Item>

                    <Form.Item name="isEmail" valuePropName="checked" className="mb-0">
                        <Checkbox className="text-xs text-slate-700 font-medium">
                            Đồng thời gửi Email thông báo tự động (Hệ thống sẽ xếp hàng gửi email trong nền)
                        </Checkbox>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Modal Cập nhật Mẫu thông báo sự kiện */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                        <FormOutlined className="text-primary" />
                        Cập nhật Mẫu Thông báo Sự kiện Tự động
                    </div>
                }
                open={isTemplateModalOpen}
                onCancel={() => {
                    setIsTemplateModalOpen(false);
                    setEditingTemplate(null);
                }}
                onOk={handleSaveTemplate}
                okText="Lưu thay đổi"
                cancelText="Hủy bỏ"
                confirmLoading={savingTemplate}
                width={620}
                centered
            >
                <div className="bg-blue-50 text-blue-900 p-3 rounded-xl mb-4 text-xs border border-blue-200 flex gap-2.5">
                    <InfoCircleOutlined className="text-blue-600 mt-0.5 shrink-0" />
                    <p className="m-0">
                        Mẫu thông báo được hệ thống kích hoạt tự động theo các sự kiện đào tạo (gán hội đồng, duyệt đề tài, mở đăng ký).
                    </p>
                </div>
                <Form form={templateForm} layout="vertical">
                    <Form.Item
                        name="name"
                        label={<span className="text-xs font-bold text-slate-700">Tên Mẫu hiển thị</span>}
                        rules={[{ required: true, message: 'Nhập tên mẫu!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="title"
                        label={<span className="text-xs font-bold text-slate-700">Tiêu đề gửi tới người dùng</span>}
                        rules={[{ required: true, message: 'Nhập tiêu đề!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="content"
                        label={<span className="text-xs font-bold text-slate-700">Nội dung mẫu</span>}
                        rules={[{ required: true, message: 'Nhập nội dung mẫu!' }]}
                    >
                        <Input.TextArea rows={4} />
                    </Form.Item>
                    <Form.Item
                        name="autoTrigger"
                        label={<span className="text-xs font-bold text-slate-700">Mã kích hoạt sự kiện hệ thống</span>}
                    >
                        <Input disabled className="bg-slate-50 font-mono text-xs" />
                    </Form.Item>
                    <Form.Item name="isActive" valuePropName="checked" className="mb-0">
                        <Checkbox className="text-xs text-slate-800 font-semibold">
                            Bật kích hoạt Mẫu thông báo này
                        </Checkbox>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

export default NotificationCenterPage;
