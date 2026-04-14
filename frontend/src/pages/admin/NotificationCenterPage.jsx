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
} from 'antd';
import { EditOutlined, FormOutlined, HistoryOutlined, TeamOutlined, UserOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import notificationService from '../../services/notificationService';
import councilService from '../../services/councilService';
import PageHeader from '../../components/common/PageHeader';

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
            message.error(error?.message || 'Không thể tải danh sách hội đồng');
        }
    };

    useEffect(() => {
        fetchHistory();
        fetchTemplates();
        fetchCouncils();
    }, []);

    const selectedAudience = Form.useWatch('audience', form);

    const handleSendNotification = async () => {
        try {
            const values = await form.validateFields();
            setSending(true);
            const payload = {
                title: values.title,
                content: values.content,
                audience: values.audience,
                councilId: values.audience === 'SPECIFIC_COUNCIL' ? values.councilId : null,
                isEmail: !!values.isEmail,
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
            isActive: !!template.isActive,
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
        if (audience === 'ALL_ADMINS') return <Tag color="red">Toàn bộ Admin</Tag>;
        if (audience === 'ALL_USERS') return <Tag color="magenta">Toàn bộ Hệ thống</Tag>;
        if (audience === 'SPECIFIC_COUNCIL') return <Tag color="gold">Theo hội đồng</Tag>;
        return <Tag>{audience}</Tag>;
    };

    const columnsHistory = useMemo(
        () => [
            {
                title: 'Tiêu đề',
                dataIndex: 'title',
                key: 'title',
                width: '35%',
                render: (text, record) => (
                    <div>
                        <div className="font-bold text-slate-900 leading-tight mb-1 line-clamp-2">{text}</div>
                        <code className="text-[10px] text-slate-400 font-mono px-1 py-0.5 bg-slate-50 rounded border border-slate-100">{record.type}</code>
                    </div>
                ),
            },
            {
                title: 'Đối tượng',
                dataIndex: 'audience',
                key: 'audience',
                render: (value) => audienceTag(value),
            },
            {
                title: 'Thời gian gửi',
                dataIndex: 'sentAt',
                key: 'sentAt',
                render: (time) => <span className="text-sm font-medium text-slate-600">{dayjs(time).format('HH:mm DD/MM/YYYY')}</span>,
            },
            {
                title: 'Tỉ lệ đọc',
                key: 'readRate',
                render: (_, record) => {
                    const denominator = record.totalAudience || 1;
                    const percent = Math.round(((record.readCount || 0) / denominator) * 100);
                    return (
                        <div className="w-full pr-4">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-500">{record.readCount || 0} / {record.totalAudience || 0} đã đọc</span>
                                <span className="font-bold text-slate-700">{percent}%</span>
                            </div>
                            <Progress percent={percent} showInfo={false} size="small" status={percent >= 80 ? 'success' : 'active'} strokeColor="#0066cc" />
                        </div>
                    );
                },
            },
        ],
        []
    );

    return (
        <div className="py-2">
            <PageHeader
                title="Quản lý Thông báo"
                subtitle="Điều phối thông tin và gửi cảnh báo đến người dùng hệ thống."
                actions={
                    <Button
                        type="primary"
                        onClick={() => {
                            setIsSendModalOpen(true);
                            form.resetFields();
                        }}
                        className="h-[38px] px-5"
                    >
                        Soạn thông báo mới
                    </Button>
                }
            />

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    className="px-6 pt-4"
                    tabBarStyle={{ marginBottom: 0, borderBottom: '1px solid #f1f5f9' }}
                    items={[
                        {
                            key: 'history',
                            label: <span className="font-medium"><HistoryOutlined className="mr-1.5" /> Lịch sử gửi</span>,
                            children: (
                                <div className="py-6 min-h-[400px]">
                                    {loadingHistory ? (
                                        <div className="py-12 flex justify-center"><Spin size="large" /></div>
                                    ) : (
                                        <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                                            <Table
                                                columns={columnsHistory}
                                                dataSource={history}
                                                rowKey="id"
                                                pagination={{ pageSize: 8 }}
                                                className="ant-table-striped"
                                            />
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: 'templates',
                            label: <span className="font-medium"><FormOutlined className="mr-1.5" /> Cấu hình Mẫu thông báo</span>,
                            children: (
                                <div className="py-6 min-h-[400px]">
                                    {loadingTemplates ? (
                                        <div className="py-12 flex justify-center"><Spin size="large" /></div>
                                    ) : (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {templates.map((template) => (
                                                <div key={template.key} className="bg-white border border-slate-200 p-5 rounded-xl hover:shadow-md hover:border-slate-300 transition-all shadow-sm flex flex-col gap-4">
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div>
                                                            <h3 className="font-bold text-slate-800 text-base mb-1">{template.name}</h3>
                                                            <code className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{template.key}</code>
                                                        </div>
                                                        <Button size="small" icon={<EditOutlined />} onClick={() => handleEditTemplate(template)}>Sửa</Button>
                                                    </div>
                                                    
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded bg-cyan-100 text-cyan-800">{template.autoTrigger}</span>
                                                        <span className={`text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded ${template.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                            {template.isActive ? 'Hoạt động' : 'Vô hiệu'}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100/80 text-sm flex-1">
                                                        <div className="font-semibold text-slate-800 mb-1.5 pb-1.5 border-b border-slate-200/60">Tiêu đề: {template.title}</div>
                                                        <div className="text-slate-600 whitespace-pre-wrap leading-relaxed">{template.content}</div>
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

            <Modal
                title={<div className="text-lg font-bold">Gửi thông báo mới</div>}
                open={isSendModalOpen}
                onCancel={() => setIsSendModalOpen(false)}
                onOk={handleSendNotification}
                okText="Gửi thông báo ngay"
                cancelText="Hủy bỏ"
                width={700}
                confirmLoading={sending}
                className="custom-modal"
            >
                <Form form={form} layout="vertical" className="mt-6">
                    <Form.Item
                        name="audience"
                        label={<span className="font-semibold text-slate-700">Đối tượng nhận</span>}
                        rules={[{ required: true, message: 'Vui lòng chọn đối tượng' }]}
                    >
                        <Select
                            size="large"
                            placeholder="Chọn nhóm người dùng mục tiêu"
                            options={[
                                { value: 'ALL_USERS', label: 'Toàn bộ hệ thống (SV + GV + Admin)' },
                                { value: 'ALL_STUDENTS', label: 'Toàn bộ Sinh viên' },
                                { value: 'ALL_LECTURERS', label: 'Toàn bộ Giảng viên' },
                                { value: 'ALL_ADMINS', label: 'Toàn bộ Quản trị viên' },
                                { value: 'SPECIFIC_COUNCIL', label: 'Thành viên thuộc Hội đồng đánh giá' },
                            ]}
                        />
                    </Form.Item>

                    {selectedAudience === 'SPECIFIC_COUNCIL' && (
                        <Form.Item
                            name="councilId"
                            label={<span className="font-semibold text-slate-700">Chọn Hội đồng</span>}
                            rules={[{ required: true, message: 'Vui lòng chọn hội đồng' }]}
                        >
                            <Select
                                size="large"
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
                        label={<span className="font-semibold text-slate-700">Tiêu đề thông báo</span>}
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                    >
                        <Input size="large" placeholder="Ví dụ: Lịch bảo trì hệ thống" />
                    </Form.Item>
                    <Form.Item
                        name="content"
                        label={<span className="font-semibold text-slate-700">Nội dung chi tiết</span>}
                        rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
                    >
                        <Input.TextArea rows={6} placeholder="Nhập nội dung đầy đủ muốn gửi đến người dùng..." className="text-base" />
                    </Form.Item>
                    <Form.Item name="isEmail" valuePropName="checked" className="mb-0">
                        <Checkbox className="text-slate-600">Đồng thời gửi Email thông báo (hệ thống sẽ tự động queue email)</Checkbox>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={<div className="text-lg font-bold">Cập nhật Mẫu thông báo</div>}
                open={isTemplateModalOpen}
                onCancel={() => {
                    setIsTemplateModalOpen(false);
                    setEditingTemplate(null);
                }}
                onOk={handleSaveTemplate}
                okText="Lưu thay đổi"
                cancelText="Hủy bỏ"
                confirmLoading={savingTemplate}
                width={650}
            >
                <div className="bg-blue-50 text-blue-800 p-3 rounded-lg mb-6 text-sm border border-blue-100 flex gap-3">
                    <InfoCircleOutlined className="mt-0.5" />
                    <p className="m-0">Mẫu thông báo được hệ thống trigger tự động dựa theo sự kiện. Không nên thay đổi nội dung nếu bạn không chắc chắn về các biến số có thể dùng.</p>
                </div>
                <Form form={templateForm} layout="vertical">
                    <Form.Item name="name" label={<span className="font-semibold text-slate-700">Tên Mẫu (Hiển thị Admin)</span>} rules={[{ required: true }]}>
                        <Input size="large" />
                    </Form.Item>
                    <Form.Item name="title" label={<span className="font-semibold text-slate-700">Tiêu đề (Hiển thị User)</span>} rules={[{ required: true }]}>
                        <Input size="large" />
                    </Form.Item>
                    <Form.Item name="content" label={<span className="font-semibold text-slate-700">Nội dung thông báo</span>} rules={[{ required: true }]}>
                        <Input.TextArea rows={5} />
                    </Form.Item>
                    <Form.Item name="autoTrigger" label={<span className="font-semibold text-slate-700">Mã Trigger (System Code)</span>} rules={[{ required: true }]}>
                        <Input disabled className="bg-slate-50" />
                    </Form.Item>
                    <Form.Item name="isActive" valuePropName="checked" className="mb-0 mt-2">
                        <Checkbox className="text-slate-700 font-medium">Bật / Tắt kích hoạt Mẫu thông báo này</Checkbox>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

export default NotificationCenterPage;
