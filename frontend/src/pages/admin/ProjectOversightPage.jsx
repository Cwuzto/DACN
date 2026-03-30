import { useEffect, useMemo, useState } from 'react';
import {
    Button,
    Dropdown,
    Input,
    message,
    Modal,
    Select,
    Table,
    Timeline,
} from 'antd';
import {
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    HistoryOutlined,
    MoreOutlined,
    StopOutlined,
    SwapOutlined,
    SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { topicService } from '../../services/topicService';
import registrationService from '../../services/registrationService';
import userService from '../../services/userService';

const statusConfig = {
    APPROVED: { label: 'Da duyet', tw: 'bg-green-100 text-green-700' },
    PENDING: { label: 'Cho duyet', tw: 'bg-orange-100 text-orange-700' },
    REJECTED: { label: 'Da tu choi', tw: 'bg-red-100 text-red-700' },
    DRAFT: { label: 'Ban nhap', tw: 'bg-slate-100 text-slate-600' },
};

function ProjectOversightPage() {
    const [loading, setLoading] = useState(true);
    const [topics, setTopics] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState(null);

    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditTopic, setAuditTopic] = useState(null);

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferTopic, setTransferTopic] = useState(null);
    const [transferLecturerId, setTransferLecturerId] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [topicsRes, regRes, lecturerRes] = await Promise.all([
                topicService.getAll(),
                registrationService.getAllRegistrations(),
                userService.getUsers({ role: 'LECTURER', status: 'active', limit: 1000 }),
            ]);

            if (topicsRes.success) setTopics(topicsRes.data || []);
            if (regRes.success) setRegistrations(regRes.data || []);
            if (lecturerRes.success) setLecturers(lecturerRes.data || []);
        } catch (error) {
            message.error(error?.message || 'Khong the tai du lieu giam sat');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const registrationMap = useMemo(() => {
        return registrations.reduce((acc, item) => {
            if (!acc[item.topic?.id]) acc[item.topic?.id] = [];
            acc[item.topic?.id].push(item);
            return acc;
        }, {});
    }, [registrations]);

    const tableData = useMemo(() => {
        return topics.map((topic) => {
            const topicRegistrations = registrationMap[topic.id] || [];
            return {
                ...topic,
                code: `DT-${String(topic.id).padStart(3, '0')}`,
                students: topicRegistrations
                    .filter((item) => item.student)
                    .map((item) => item.student.fullName),
                registrationEvents: topicRegistrations,
            };
        });
    }, [topics, registrationMap]);

    const filteredTopics = useMemo(() => {
        return tableData.filter((item) => {
            const keyword = searchText.trim().toLowerCase();
            const matchSearch = !keyword ||
                item.title?.toLowerCase().includes(keyword) ||
                item.code.toLowerCase().includes(keyword) ||
                item.mentor?.fullName?.toLowerCase().includes(keyword);
            const matchStatus = statusFilter ? item.status === statusFilter : true;
            return matchSearch && matchStatus;
        });
    }, [tableData, searchText, statusFilter]);

    const handleReject = (record) => {
        Modal.confirm({
            title: 'Tu choi de tai',
            icon: <ExclamationCircleOutlined style={{ color: 'red' }} />,
            content: `Ban chac chan muon tu choi de tai "${record.title}"?`,
            okText: 'Tu choi',
            cancelText: 'Huy',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    if (record.status === 'PENDING') {
                        await topicService.changeStatus(record.id, {
                            status: 'REJECTED',
                            rejectReason: 'Rejected by admin oversight',
                        });
                    } else {
                        await topicService.update(record.id, { status: 'REJECTED' });
                    }
                    message.success(`Da cap nhat trang thai de tai ${record.code}`);
                    fetchData();
                } catch (error) {
                    message.error(error?.message || 'Khong the cap nhat trang thai de tai');
                }
            },
        });
    };

    const handleApprove = async (record) => {
        try {
            if (record.status === 'PENDING') {
                await topicService.changeStatus(record.id, { status: 'APPROVED' });
            } else {
                await topicService.update(record.id, { status: 'APPROVED' });
            }
            message.success(`Da duyet de tai ${record.code}`);
            fetchData();
        } catch (error) {
            message.error(error?.message || 'Khong the duyet de tai');
        }
    };

    const openTransferModal = (record) => {
        setTransferTopic(record);
        setTransferLecturerId(record.mentorId || null);
        setIsTransferModalOpen(true);
    };

    const handleTransfer = async () => {
        if (!transferTopic || !transferLecturerId) {
            message.warning('Vui long chon giang vien huong dan moi');
            return;
        }
        try {
            await topicService.update(transferTopic.id, { mentorId: transferLecturerId });
            message.success(`Da dieu chuyen de tai ${transferTopic.code}`);
            setIsTransferModalOpen(false);
            fetchData();
        } catch (error) {
            message.error(error?.message || 'Khong the dieu chuyen de tai');
        }
    };

    const columns = [
        {
            title: 'Ma & De tai',
            dataIndex: 'title',
            key: 'title',
            width: 360,
            render: (text, record) => (
                <div>
                    <div className="font-bold text-slate-900 leading-tight mb-1">{text}</div>
                    <code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-primary">{record.code}</code>
                </div>
            ),
        },
        {
            title: 'GV Huong dan',
            key: 'lecturer',
            render: (_, record) => (
                <span className="text-sm font-medium text-slate-700">
                    {record.mentor?.fullName || 'Chua gan'}
                </span>
            ),
        },
        {
            title: 'Sinh vien',
            dataIndex: 'students',
            key: 'students',
            render: (students) => (
                students.length > 0 ? (
                    <div className="flex flex-col gap-1">
                        {students.map((name, idx) => (
                            <span
                                key={`${name}-${idx}`}
                                className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full inline-block w-fit"
                            >
                                {name}
                            </span>
                        ))}
                    </div>
                ) : <span className="text-xs text-slate-400 italic">Chua co SV dang ky</span>
            ),
        },
        {
            title: 'Trang thai',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status) => {
                const config = statusConfig[status] || { label: status, tw: 'bg-slate-100 text-slate-600' };
                return (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${config.tw}`}>
                        {config.label}
                    </span>
                );
            },
        },
        {
            title: 'Can thiep (Admin)',
            key: 'actions',
            width: 160,
            align: 'right',
            render: (_, record) => {
                const menuItems = [];

                if (record.status === 'PENDING') {
                    menuItems.push({
                        key: 'APPROVE',
                        icon: <CheckCircleOutlined style={{ color: 'green' }} />,
                        label: 'Duyet de tai',
                    });
                }

                if (record.status !== 'REJECTED') {
                    menuItems.push({
                        key: 'REJECT',
                        danger: true,
                        icon: <StopOutlined />,
                        label: 'Tu choi de tai',
                    });
                }

                if (record.status === 'REJECTED') {
                    menuItems.push({
                        key: 'ACTIVATE',
                        icon: <CheckCircleOutlined style={{ color: 'green' }} />,
                        label: 'Mo lai de tai',
                    });
                }

                menuItems.push({
                    key: 'TRANSFER',
                    icon: <SwapOutlined style={{ color: '#FAAD14' }} />,
                    label: 'Doi GV huong dan',
                });
                menuItems.push({ type: 'divider' });
                menuItems.push({
                    key: 'AUDIT',
                    icon: <HistoryOutlined style={{ color: 'blue' }} />,
                    label: 'Xem thay doi',
                });

                const onAction = ({ key }) => {
                    if (key === 'REJECT') handleReject(record);
                    if (key === 'APPROVE' || key === 'ACTIVATE') handleApprove(record);
                    if (key === 'TRANSFER') openTransferModal(record);
                    if (key === 'AUDIT') {
                        setAuditTopic(record);
                        setIsAuditModalOpen(true);
                    }
                };

                return (
                    <Dropdown
                        menu={{ items: menuItems, onClick: onAction }}
                        trigger={['click']}
                        placement="bottomRight"
                    >
                        <Button type="text" icon={<MoreOutlined />} />
                    </Dropdown>
                );
            },
        },
    ];

    const lecturerOptions = lecturers.map((lecturer) => ({
        value: lecturer.id,
        label: `${lecturer.fullName} (${lecturer.code})`,
    }));

    const auditItems = useMemo(() => {
        if (!auditTopic) return [];

        const items = [
            {
                color: 'gray',
                children: (
                    <>
                        <p className="text-xs text-slate-400">
                            {dayjs(auditTopic.createdAt).format('DD/MM/YYYY HH:mm')}
                        </p>
                        <p className="text-sm font-medium">Khoi tao de tai</p>
                    </>
                ),
            },
            {
                color: 'blue',
                children: (
                    <>
                        <p className="text-xs text-slate-400">
                            {dayjs(auditTopic.updatedAt).format('DD/MM/YYYY HH:mm')}
                        </p>
                        <p className="text-sm font-medium">Cap nhat lan cuoi: {auditTopic.status}</p>
                    </>
                ),
            },
        ];

        (auditTopic.registrationEvents || []).slice(0, 3).forEach((event) => {
            items.push({
                color: 'green',
                children: (
                    <>
                        <p className="text-xs text-slate-400">{dayjs(event.createdAt).format('DD/MM/YYYY HH:mm')}</p>
                        <p className="text-sm font-medium">
                            {event.student?.fullName || 'Sinh vien'} dang ky ({event.status})
                        </p>
                    </>
                ),
            });
        });

        return items;
    }, [auditTopic]);

    return (
        <div className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">Giam sat & Can thiep</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Theo doi toan bo de tai va xu ly nhanh cac truong hop can can thiep.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        <Input
                            placeholder="Tim ma, ten de tai, hoac giang vien..."
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            style={{ maxWidth: 360, minWidth: 240 }}
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            allowClear
                        />
                        <Select
                            placeholder="Trang thai de tai"
                            style={{ minWidth: 180 }}
                            allowClear
                            value={statusFilter}
                            onChange={(value) => setStatusFilter(value || null)}
                            options={Object.keys(statusConfig).map((key) => ({
                                label: statusConfig[key].label,
                                value: key,
                            }))}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    loading={loading}
                    dataSource={filteredTopics}
                    rowKey="id"
                    columns={columns}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    size="middle"
                />
            </div>

            <Modal
                title="Dieu chuyen De tai"
                open={isTransferModalOpen}
                onCancel={() => setIsTransferModalOpen(false)}
                onOk={handleTransfer}
                okText="Luu thay doi"
                cancelText="Huy"
            >
                {transferTopic && (
                    <div className="space-y-4 pt-4">
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <p className="text-orange-800 text-sm font-medium">De tai dang chon:</p>
                            <p className="font-bold text-slate-900 mt-1">{transferTopic.title}</p>
                            <p className="text-xs text-orange-600 mt-1">
                                GV hien tai: {transferTopic.mentor?.fullName || 'Chua gan'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-700 mb-2">
                                Chon GV huong dan moi <span className="text-red-500">*</span>
                            </p>
                            <Select
                                showSearch
                                placeholder="Nhap ten giang vien"
                                className="w-full"
                                value={transferLecturerId}
                                onChange={setTransferLecturerId}
                                options={lecturerOptions}
                                optionFilterProp="label"
                            />
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                title={`Lich su thay doi: ${auditTopic?.code || ''}`}
                open={isAuditModalOpen}
                onCancel={() => setIsAuditModalOpen(false)}
                footer={null}
                width={520}
            >
                <div className="pt-6">
                    <Timeline items={auditItems} />
                </div>
            </Modal>
        </div>
    );
}

export default ProjectOversightPage;
