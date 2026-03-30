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

const templateSeed = [
    {
        id: 'tpl1',
        name: 'Nhac nho nop bao cao giua ky',
        title: '[Quan trong] Nhac nho nop bao cao giua ky',
        content: 'Han cuoi nop bao cao giua ky la {DEADLINE}. Vui long nop dung han qua he thong.',
        autoTrigger: '7_DAYS_BEFORE_MIDTERM',
    },
    {
        id: 'tpl2',
        name: 'Thong bao ket qua duyet de tai',
        title: 'Ket qua duyet de tai do an',
        content: 'De tai {TOPIC_NAME} cua ban da duoc {STATUS}.',
        autoTrigger: 'ON_TOPIC_APPROVED',
    },
];

function NotificationCenterPage() {
    const [history, setHistory] = useState([]);
    const [templates] = useState(templateSeed);
    const [councils, setCouncils] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [sending, setSending] = useState(false);
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('history');
    const [form] = Form.useForm();

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const response = await notificationService.getHistory();
            if (response.success) setHistory(response.data || []);
        } catch (error) {
            message.error(error?.message || 'Khong the tai lich su thong bao');
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchCouncils = async () => {
        try {
            const response = await councilService.getCouncils();
            if (response.success) setCouncils(response.data || []);
        } catch (error) {
            message.error(error?.message || 'Khong the tai danh sach hoi dong');
        }
    };

    useEffect(() => {
        fetchHistory();
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
            message.error(error?.message || 'Khong the gui thong bao');
        } finally {
            setSending(false);
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
                <button
                    onClick={() => {
                        setIsSendModalOpen(true);
                        form.resetFields();
                    }}
                    className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-primary-800 transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    Soan Thong bao Moi
                </button>
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
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {templates.map((template) => (
                                        <div key={template.id} className="border border-slate-200 p-5 rounded-xl hover:shadow-md transition bg-slate-50">
                                            <div className="flex justify-between items-start mb-3">
                                                <h3 className="font-bold text-slate-900">{template.name}</h3>
                                                <Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} />
                                            </div>
                                            <Tag color="cyan" className="mb-3">{template.autoTrigger}</Tag>
                                            <div className="bg-white p-3 rounded border text-sm text-slate-600 whitespace-pre-wrap">
                                                <span className="font-bold block mb-1">Tieu de: {template.title}</span>
                                                <hr className="my-2" />
                                                {template.content}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ),
                        },
                    ]}
                />
            </div>

            <Modal
                title="Gui Thong bao Moi"
                open={isSendModalOpen}
                onCancel={() => setIsSendModalOpen(false)}
                onOk={handleSendNotification}
                okText="Gui Thong bao"
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
                        rules={[{ required: true, message: 'Nhap tieu de thong bao' }]}
                    >
                        <Input placeholder="Vi du: Lich bao tri he thong" />
                    </Form.Item>
                    <Form.Item
                        name="content"
                        label="Noi dung thong bao"
                        rules={[{ required: true, message: 'Nhap noi dung thong bao' }]}
                    >
                        <Input.TextArea rows={6} placeholder="Nhap noi dung muon gui den nguoi dung..." />
                    </Form.Item>
                    <Form.Item name="isEmail" valuePropName="checked" className="mb-0">
                        <Checkbox>Dong thoi gui Email thong bao (du kien, backend chua xu ly email)</Checkbox>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

export default NotificationCenterPage;
