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
import { EditOutlined, FormOutlined, HistoryOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
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
                message.success(`Da gui thong bao thanh cong (${response.data?.sentCount || 0} nguoi nhan)`);
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
                message.success('Da cap nhat template');
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
        if (audience === 'ALL_STUDENTS') return <Tag color="blue" icon={<UserOutlined />}>Toan bo Sinh vien</Tag>;
        if (audience === 'ALL_LECTURERS') return <Tag color="purple" icon={<TeamOutlined />}>Toan bo Giang vien</Tag>;
        if (audience === 'ALL_ADMINS') return <Tag color="red">Toan bo Admin</Tag>;
        if (audience === 'ALL_USERS') return <Tag color="magenta">Toan bo He thong</Tag>;
        if (audience === 'SPECIFIC_COUNCIL') return <Tag color="gold">Theo hoi dong</Tag>;
        return <Tag>{audience}</Tag>;
    };

    const columnsHistory = useMemo(
        () => [
            {
                title: 'Tieu de',
                dataIndex: 'title',
                key: 'title',
                width: 300,
                render: (text, record) => (
                    <div>
                        <div className="font-bold text-slate-900 leading-tight mb-1 line-clamp-2">{text}</div>
                        <code className="text-[10px] text-slate-400">{record.type}</code>
                    </div>
                ),
            },
            {
                title: 'Doi tuong',
                dataIndex: 'audience',
                key: 'audience',
                render: (value) => audienceTag(value),
            },
            {
                title: 'Thoi gian gui',
                dataIndex: 'sentAt',
                key: 'sentAt',
                render: (time) => <span className="text-sm font-medium text-slate-600">{dayjs(time).format('HH:mm DD/MM/YYYY')}</span>,
            },
            {
                title: 'Ti le doc',
                key: 'readRate',
                render: (_, record) => {
                    const denominator = record.totalAudience || 1;
                    const percent = Math.round(((record.readCount || 0) / denominator) * 100);
                    return (
                        <div className="w-full">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-500">{record.readCount || 0} / {record.totalAudience || 0} da doc</span>
                                <span className="font-bold">{percent}%</span>
                            </div>
                            <Progress percent={percent} showInfo={false} size="small" status={percent >= 80 ? 'success' : 'active'} />
                        </div>
                    );
                },
            },
        ],
        []
    );

    return (
        <div className="py-2">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">Quan ly Thong bao</h2>
                    <p className="text-sm text-slate-500 mt-1">Dieu phoi luong thong tin va gui canh bao den nguoi dung he thong.</p>
                </div>
                <Button
                    type="primary"
                    onClick={() => {
                        setIsSendModalOpen(true);
                        form.resetFields();
                    }}
                >
                    Soan thong bao moi
                </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    className="p-2 lg:px-6 py-4"
                    items={[
                        {
                            key: 'history',
                            label: <span><HistoryOutlined /> Lich su gui</span>,
                            children: (
                                <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
                                    {loadingHistory ? (
                                        <div className="p-8 text-center"><Spin /></div>
                                    ) : (
                                        <Table
                                            columns={columnsHistory}
                                            dataSource={history}
                                            rowKey="id"
                                            pagination={{ pageSize: 5 }}
                                        />
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: 'templates',
                            label: <span><FormOutlined /> Cau hinh Template</span>,
                            children: (
                                <div className="mt-4 border border-slate-200 rounded-lg p-4">
                                    {loadingTemplates ? (
                                        <div className="p-8 text-center"><Spin /></div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {templates.map((template) => (
                                                <div key={template.key} className="border border-slate-200 p-5 rounded-xl hover:shadow-md transition bg-slate-50">
                                                    <div className="flex justify-between items-start mb-3 gap-2">
                                                        <div>
                                                            <h3 className="font-bold text-slate-900">{template.name}</h3>
                                                            <code className="text-[11px] text-slate-500">{template.key}</code>
                                                        </div>
                                                        <Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => handleEditTemplate(template)} />
                                                    </div>
                                                    <div className="mb-3 flex items-center gap-2">
                                                        <Tag color="cyan">{template.autoTrigger}</Tag>
                                                        <Tag color={template.isActive ? 'green' : 'default'}>{template.isActive ? 'Active' : 'Inactive'}</Tag>
                                                    </div>
                                                    <div className="bg-white p-3 rounded border text-sm text-slate-600 whitespace-pre-wrap">
                                                        <span className="font-bold block mb-1">Tieu de: {template.title}</span>
                                                        <hr className="my-2" />
                                                        {template.content}
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
                title="Gui thong bao moi"
                open={isSendModalOpen}
                onCancel={() => setIsSendModalOpen(false)}
                onOk={handleSendNotification}
                okText="Gui thong bao"
                cancelText="Huy"
                width={700}
                confirmLoading={sending}
            >
                <Form form={form} layout="vertical" className="mt-4">
                    <Form.Item
                        name="audience"
                        label="Doi tuong nhan"
                        rules={[{ required: true, message: 'Vui long chon doi tuong' }]}
                    >
                        <Select
                            placeholder="Chon nhom nguoi dung"
                            options={[
                                { value: 'ALL_USERS', label: 'Toan bo he thong (SV + GV + Admin)' },
                                { value: 'ALL_STUDENTS', label: 'Toan bo Sinh vien' },
                                { value: 'ALL_LECTURERS', label: 'Toan bo Giang vien' },
                                { value: 'ALL_ADMINS', label: 'Toan bo Admin' },
                                { value: 'SPECIFIC_COUNCIL', label: 'Thanh vien thuoc Hoi dong cu the' },
                            ]}
                        />
                    </Form.Item>

                    {selectedAudience === 'SPECIFIC_COUNCIL' && (
                        <Form.Item
                            name="councilId"
                            label="Hoi dong"
                            rules={[{ required: true, message: 'Vui long chon hoi dong' }]}
                        >
                            <Select
                                placeholder="Chon hoi dong"
                                options={councils.map((council) => ({
                                    value: council.id,
                                    label: council.name,
                                }))}
                            />
                        </Form.Item>
                    )}

                    <Form.Item
                        name="title"
                        label="Tieu de"
                        rules={[{ required: true, message: 'Vui long nhap tieu de thong bao' }]}
                    >
                        <Input placeholder="Vi du: Lich bao tri he thong" />
                    </Form.Item>
                    <Form.Item
                        name="content"
                        label="Noi dung thong bao"
                        rules={[{ required: true, message: 'Vui long nhap noi dung thong bao' }]}
                    >
                        <Input.TextArea rows={6} placeholder="Nhap noi dung muon gui den nguoi dung..." />
                    </Form.Item>
                    <Form.Item name="isEmail" valuePropName="checked" className="mb-0">
                        <Checkbox>Dong thoi gui Email thong bao (du kien, backend chua xu ly email)</Checkbox>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Cap nhat template thong bao"
                open={isTemplateModalOpen}
                onCancel={() => {
                    setIsTemplateModalOpen(false);
                    setEditingTemplate(null);
                }}
                onOk={handleSaveTemplate}
                okText="Luu"
                cancelText="Huy"
                confirmLoading={savingTemplate}
            >
                <Form form={templateForm} layout="vertical" className="mt-4">
                    <Form.Item name="name" label="Ten template" rules={[{ required: true, message: 'Nhap ten template' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="title" label="Tieu de" rules={[{ required: true, message: 'Nhap tieu de' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="content" label="Noi dung" rules={[{ required: true, message: 'Nhap noi dung' }]}>
                        <Input.TextArea rows={4} />
                    </Form.Item>
                    <Form.Item name="autoTrigger" label="Auto trigger" rules={[{ required: true, message: 'Nhap auto trigger' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="isActive" valuePropName="checked" className="mb-0">
                        <Checkbox>Template dang hoat dong</Checkbox>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

export default NotificationCenterPage;
