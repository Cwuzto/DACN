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
import { semesterService } from '../../services/semesterService';
import userService from '../../services/userService';

const statusConfig = {
    APPROVED: { label: 'Đã duyệt', tw: 'bg-green-100 text-green-700' },
    PENDING: { label: 'Chờ duyệt', tw: 'bg-orange-100 text-orange-700' },
    REJECTED: { label: 'Đã từ chối', tw: 'bg-red-100 text-red-700' },
    DRAFT: { label: 'Bản nháp', tw: 'bg-slate-100 text-slate-600' },
};

function ProjectOversightPage() {
    const [loading, setLoading] = useState(true);
    const [topics, setTopics] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState(null);
    const [semesterFilter, setSemesterFilter] = useState(null);

    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditTopic, setAuditTopic] = useState(null);

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferTopic, setTransferTopic] = useState(null);
    const [transferLecturerId, setTransferLecturerId] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [topicsRes, regRes, lecturerRes, semesterRes] = await Promise.all([
                topicService.getAll(),
                registrationService.getAllRegistrations(),
                userService.getUsers({ role: 'LECTURER', status: 'active', limit: 1000 }),
                semesterService.getAll(),
            ]);

            if (topicsRes.success) setTopics(topicsRes.data || []);
            if (regRes.success) setRegistrations(regRes.data || []);
            if (lecturerRes.success) setLecturers(lecturerRes.data || []);
            if (semesterRes.success) setSemesters(semesterRes.data || []);
        } catch (error) {
            message.error(error?.message || 'Không thể tải dữ liệu giám sát');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const registrationMap = useMemo(
        () =>
            registrations.reduce((acc, item) => {
                if (!acc[item.topic?.id]) acc[item.topic?.id] = [];
                acc[item.topic?.id].push(item);
                return acc;
            }, {}),
        [registrations]
    );

    const tableData = useMemo(
        () =>
            topics.map((topic) => {
                const topicRegistrations = registrationMap[topic.id] || [];
                return {
                    ...topic,
                    code: `DT-${String(topic.id).padStart(3, '0')}`,
                    students: topicRegistrations.filter((item) => item.student).map((item) => item.student.fullName),
                    registrationEvents: topicRegistrations,
                };
            }),
        [topics, registrationMap]
    );

    const filteredTopics = useMemo(() => {
        return tableData.filter((item) => {
            const keyword = searchText.trim().toLowerCase();
            const matchSearch =
                !keyword ||
                item.title?.toLowerCase().includes(keyword) ||
                item.code.toLowerCase().includes(keyword) ||
                item.mentor?.fullName?.toLowerCase().includes(keyword);
            const matchStatus = statusFilter ? item.status === statusFilter : true;
            const matchSemester = semesterFilter ? item.semesterId === semesterFilter : true;
            return matchSearch && matchStatus && matchSemester;
        });
    }, [tableData, searchText, statusFilter, semesterFilter]);

    const handleReject = (record) => {
        Modal.confirm({
            title: 'Từ chối đề tài',
            icon: <ExclamationCircleOutlined style={{ color: 'red' }} />,
            content: `Bạn chắc chắn muốn từ chối đề tài "${record.title}"?`,
            okText: 'Từ chối',
            cancelText: 'Hủy',
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
                    message.success(`Đã cập nhật trạng thái đề tài ${record.code}`);
                    fetchData();
                } catch (error) {
                    message.error(error?.message || 'Không thể cập nhật trạng thái đề tài');
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
            message.success(`Đã duyệt đề tài ${record.code}`);
            fetchData();
        } catch (error) {
            message.error(error?.message || 'Không thể duyệt đề tài');
        }
    };

    const openTransferModal = (record) => {
        setTransferTopic(record);
        setTransferLecturerId(record.mentorId || null);
        setIsTransferModalOpen(true);
    };

    const handleTransfer = async () => {
        if (!transferTopic || !transferLecturerId) {
            message.warning('Vui lòng chọn giảng viên hướng dẫn mới');
            return;
        }
        try {
            await topicService.update(transferTopic.id, { mentorId: transferLecturerId });
            message.success(`Đã điều chuyển đề tài ${transferTopic.code}`);
            setIsTransferModalOpen(false);
            fetchData();
        } catch (error) {
            message.error(error?.message || 'Không thể điều chuyển đề tài');
        }
    };

    const columns = [
        {
            title: 'Mã & Đề tài',
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
            title: 'GV Hướng dẫn',
            key: 'lecturer',
            render: (_, record) => (
                <span className="text-sm font-medium text-slate-700">{record.mentor?.fullName || 'Chưa gắn'}</span>
            ),
        },
        {
            title: 'Sinh viên',
            dataIndex: 'students',
            key: 'students',
            render: (students) =>
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
                ) : (
                    <span className="text-xs text-slate-400 italic">Chưa có SV đăng ký</span>
                ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status) => {
                const config = statusConfig[status] || { label: status, tw: 'bg-slate-100 text-slate-600' };
                return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${config.tw}`}>{config.label}</span>;
            },
        },
        {
            title: 'Can thiệp (Admin)',
            key: 'actions',
            width: 160,
            align: 'right',
            render: (_, record) => {
                const menuItems = [];

                if (record.status === 'PENDING') {
                    menuItems.push({
                        key: 'APPROVE',
                        icon: <CheckCircleOutlined style={{ color: 'green' }} />,
                        label: 'Duyệt đề tài',
                    });
                }

                if (record.status !== 'REJECTED') {
                    menuItems.push({
                        key: 'REJECT',
                        danger: true,
                        icon: <StopOutlined />,
                        label: 'Từ chối đề tài',
                    });
                }

                if (record.status === 'REJECTED') {
                    menuItems.push({
                        key: 'ACTIVATE',
                        icon: <CheckCircleOutlined style={{ color: 'green' }} />,
                        label: 'Mở lại đề tài',
                    });
                }

                menuItems.push({
                    key: 'TRANSFER',
                    icon: <SwapOutlined style={{ color: '#FAAD14' }} />,
                    label: 'Đổi GV hướng dẫn',
                });
                menuItems.push({ type: 'divider' });
                menuItems.push({
                    key: 'AUDIT',
                    icon: <HistoryOutlined style={{ color: 'blue' }} />,
                    label: 'Xem thay đổi',
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
                    <Dropdown menu={{ items: menuItems, onClick: onAction }} trigger={['click']} placement="bottomRight">
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

    const semesterOptions = semesters.map((semester) => ({
        value: semester.id,
        label: semester.name,
    }));

    const auditItems = useMemo(() => {
        if (!auditTopic) return [];

        const items = [
            {
                color: 'gray',
                children: (
                    <>
                        <p className="text-xs text-slate-400">{dayjs(auditTopic.createdAt).format('DD/MM/YYYY HH:mm')}</p>
                        <p className="text-sm font-medium">Khởi tạo đề tài</p>
                    </>
                ),
            },
            {
                color: 'blue',
                children: (
                    <>
                        <p className="text-xs text-slate-400">{dayjs(auditTopic.updatedAt).format('DD/MM/YYYY HH:mm')}</p>
                        <p className="text-sm font-medium">Cập nhật lần cuối: {auditTopic.status}</p>
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
                            {event.student?.fullName || 'Sinh viên'} đăng ký ({event.status})
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
                    <h2 className="text-2xl font-black text-slate-900">Giám sát & Can thiệp</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Theo dõi toàn bộ đề tài và xử lý nhanh các trường hợp cần can thiệp.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        <Input
                            placeholder="Tìm mã, tên đề tài, hoặc giảng viên..."
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            style={{ maxWidth: 360, minWidth: 240 }}
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            allowClear
                        />
                        <Select
                            placeholder="Trạng thái đề tài"
                            style={{ minWidth: 180 }}
                            allowClear
                            value={statusFilter}
                            onChange={(value) => setStatusFilter(value || null)}
                            options={Object.keys(statusConfig).map((key) => ({
                                label: statusConfig[key].label,
                                value: key,
                            }))}
                        />
                        <Select
                            placeholder="Học kỳ"
                            style={{ minWidth: 220 }}
                            allowClear
                            value={semesterFilter}
                            onChange={(value) => setSemesterFilter(value || null)}
                            options={semesterOptions}
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
                title="Điều chuyển Đề tài"
                open={isTransferModalOpen}
                onCancel={() => setIsTransferModalOpen(false)}
                onOk={handleTransfer}
                okText="Lưu thay đổi"
                cancelText="Hủy"
            >
                {transferTopic && (
                    <div className="space-y-4 pt-4">
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <p className="text-orange-800 text-sm font-medium">Đề tài đang chọn:</p>
                            <p className="font-bold text-slate-900 mt-1">{transferTopic.title}</p>
                            <p className="text-xs text-orange-600 mt-1">
                                GV hiện tại: {transferTopic.mentor?.fullName || 'Chưa gắn'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-700 mb-2">
                                Chọn GV hướng dẫn mới <span className="text-red-500">*</span>
                            </p>
                            <Select
                                showSearch
                                placeholder="Nhập tên giảng viên"
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
                title={`Lịch sử thay đổi: ${auditTopic?.code || ''}`}
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
