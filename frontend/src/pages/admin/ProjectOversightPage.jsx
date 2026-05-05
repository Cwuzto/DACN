import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Card,
    Button,
    Dropdown,
    Empty,
    List,
    Input,
    message,
    Modal,
    Tag,
    Select,
    Spin,
    Space,
    Table,
    Typography,
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
import taskService from '../../services/taskService';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import StatCard from '../../components/common/StatCard';
import { STATUS_MAP } from '../../components/common/statusMap';
import { formatSemesterLabel } from '../../utils/semesterDisplay';
const { Text } = Typography;
const pickNearestLatestSemesterId = (semesterList = []) => {
    if (!Array.isArray(semesterList) || semesterList.length === 0) return null;

    const now = dayjs();
    const scored = semesterList
        .map((semester) => {
            const start = semester?.startDate ? dayjs(semester.startDate) : null;
            const deadline = semester?.registrationDeadline ? dayjs(semester.registrationDeadline) : null;

            const latestPoint =
                (start && start.isValid() && start.valueOf())
                || (deadline && deadline.isValid() && deadline.valueOf())
                || 0;

            const distanceToNow = Math.abs((latestPoint || now.valueOf()) - now.valueOf());

            return {
                semester,
                latestPoint,
                distanceToNow,
            };
        })
        .sort((a, b) => {
            if (a.distanceToNow !== b.distanceToNow) return a.distanceToNow - b.distanceToNow;
            return b.latestPoint - a.latestPoint;
        });

    return scored[0]?.semester?.id || null;
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
    const [projectNameFilter, setProjectNameFilter] = useState(null);

    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditTopic, setAuditTopic] = useState(null);

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferTopic, setTransferTopic] = useState(null);
    const [transferLecturerId, setTransferLecturerId] = useState(null);
    const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
    const [progressTopic, setProgressTopic] = useState(null);
    const [progressRegistrationId, setProgressRegistrationId] = useState(null);
    const [progressTasks, setProgressTasks] = useState([]);
    const [progressLoading, setProgressLoading] = useState(false);

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

    const currentSemesters = useMemo(() => {
        const now = dayjs();
        return semesters.filter((semester) => {
            const start = semester?.startDate ? dayjs(semester.startDate) : null;
            const end = semester?.endDate ? dayjs(semester.endDate) : null;
            if (!start || !end || !start.isValid() || !end.isValid()) return false;
            return (now.isAfter(start) || now.isSame(start)) && (now.isBefore(end) || now.isSame(end));
        });
    }, [semesters]);

    useEffect(() => {
        if (!currentSemesters.length) {
            setSemesterFilter(null);
            return;
        }

        const stillExists = currentSemesters.some((semester) => semester.id === semesterFilter);
        if (semesterFilter && stillExists) return;

        const nearestLatestSemesterId = pickNearestLatestSemesterId(currentSemesters);
        setSemesterFilter(nearestLatestSemesterId);
    }, [currentSemesters, semesterFilter]);

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
            const matchProjectName = projectNameFilter
                ? (item.projectCatalog?.name || '') === projectNameFilter
                : true;
            return matchSearch && matchStatus && matchSemester && matchProjectName;
        });
    }, [tableData, searchText, statusFilter, semesterFilter, projectNameFilter]);

    const scopedRegistrations = useMemo(
        () => (semesterFilter ? registrations.filter((item) => item.semesterId === semesterFilter) : registrations),
        [registrations, semesterFilter]
    );

    const warningStats = useMemo(() => {
        const pendingRegistrations = scopedRegistrations.filter((item) => item.status === 'PENDING').length;
        const unassignedCouncil = scopedRegistrations.filter(
            (item) => !['PENDING', 'REJECTED'].includes(item.status) && !item.councilId
        ).length;
        const overdueTaskRegistrations = scopedRegistrations.filter((item) => item.hasOverdueTask).length;

        const now = dayjs();
        const closingSoonSemesters = semesters.filter((semester) => {
            if (!semester.registrationOpen || !semester.registrationDeadline) return false;
            const deadline = dayjs(semester.registrationDeadline);
            if (!deadline.isValid()) return false;
            const daysLeft = deadline.diff(now, 'day');
            return daysLeft >= 0 && daysLeft <= 7;
        });

        const registrationStillOpenButExpired = semesters.filter((semester) => {
            if (!semester.registrationOpen || !semester.registrationDeadline) return false;
            const deadline = dayjs(semester.registrationDeadline);
            return deadline.isValid() && deadline.isBefore(now);
        });

        return {
            pendingRegistrations,
            unassignedCouncil,
            overdueTaskRegistrations,
            closingSoonSemesters,
            registrationStillOpenButExpired,
        };
    }, [scopedRegistrations, semesters]);

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

    const openProgressModal = (record) => {
        const registrationEvents = record.registrationEvents || [];
        const firstRegistrationId = registrationEvents[0]?.id || null;
        setProgressTopic(record);
        setProgressRegistrationId(firstRegistrationId);
        setProgressTasks([]);
        setIsProgressModalOpen(true);
    };

    const loadProgressTasks = async (registrationId) => {
        if (!registrationId) {
            setProgressTasks([]);
            return;
        }
        try {
            setProgressLoading(true);
            const res = await taskService.getTasksByRegistration(registrationId);
            setProgressTasks(res?.data || []);
        } catch (error) {
            message.error(error?.message || 'Không thể tải chi tiết tiến độ');
            setProgressTasks([]);
        } finally {
            setProgressLoading(false);
        }
    };

    useEffect(() => {
        if (!isProgressModalOpen) return;
        loadProgressTasks(progressRegistrationId);
    }, [isProgressModalOpen, progressRegistrationId]);

    const progressStats = useMemo(() => {
        const total = progressTasks.length;
        const submitted = progressTasks.filter((task) => task.status === 'SUBMITTED').length;
        const completed = progressTasks.filter((task) => task.status === 'COMPLETED').length;
        const overdue = progressTasks.filter((task) => {
            if (!task?.dueDate) return false;
            return new Date(task.dueDate).getTime() < Date.now() && !['COMPLETED', 'SUBMITTED'].includes(task.status);
        }).length;
        const progress = total ? Math.round(((submitted + completed) / (2 * total)) * 100) : 0;
        return { total, submitted, completed, overdue, progress };
    }, [progressTasks]);

    const progressTimelineItems = useMemo(() => {
        return progressTasks
            .flatMap((task) => {
                const submissions = task.submissions || [];
                const latest = submissions.length ? submissions[submissions.length - 1] : null;
                const base = [
                    {
                        color: 'blue',
                        time: task.createdAt || task.updatedAt,
                        children: (
                            <>
                                <Text className="text-xs text-slate-400">{dayjs(task.createdAt || task.updatedAt).format('DD/MM/YYYY HH:mm')}</Text>
                                <div className="text-sm font-medium">Giao task: {task.title}</div>
                            </>
                        ),
                    },
                ];
                if (latest) {
                    base.push({
                        color: 'green',
                        time: latest.submittedAt || latest.createdAt,
                        children: (
                            <>
                                <Text className="text-xs text-slate-400">{dayjs(latest.submittedAt || latest.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                                <div className="text-sm font-medium">Sinh viên nộp: {task.title}</div>
                            </>
                        ),
                    });
                }
                return base;
            })
            .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
            .map(({ children, color }) => ({ children, color }));
    }, [progressTasks]);

    const columns = [
        {
            title: 'STT',
            key: 'index',
            width: 72,
            align: 'center',
            render: (_, __, index) => (
                <span className="text-xs font-semibold text-slate-500">{index + 1}</span>
            ),
        },
        {
            title: 'Mã & Đề tài',
            dataIndex: 'title',
            key: 'title',
            width: 420,
            render: (text, record) => (
                <div className="space-y-1">
                    <div className="font-semibold text-slate-900 leading-6">{text}</div>
                    <code className="text-[11px] bg-slate-100 px-2 py-0.5 rounded text-primary">{record.code}</code>
                </div>
            ),
        },
        {
            title: 'GV hướng dẫn',
            key: 'lecturer',
            width: 220,
            render: (_, record) => (
                <span className="text-sm font-medium text-slate-700">{record.mentor?.fullName || 'Chua gan'}</span>
            ),
        },
        {
            title: 'Tên đồ án',
            key: 'projectName',
            width: 150,
            render: (_, record) => <span className="text-sm">{record.projectCatalog?.name || 'N/A'}</span>,
        },
        {
            title: 'Đợt đồ án',
            key: 'semester',
            width: 220,
            render: (_, record) => (
                <span className="text-sm">
                    {record.semester ? formatSemesterLabel(record.semester) : 'â€”'}
                </span>
            ),
        },
        {
            title: 'Sinh viên',
            dataIndex: 'students',
            key: 'students',
            width: 260,
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
            render: (status) => <StatusBadge status={status} />,
        },
        {
            title: 'Can thiệp',
            key: 'actions',
            width: 150,
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
                    key: 'PROGRESS',
                    icon: <HistoryOutlined style={{ color: '#722ed1' }} />,
                    label: 'Xem tiến độ',
                });
                menuItems.push({
                    key: 'AUDIT',
                    icon: <HistoryOutlined style={{ color: 'blue' }} />,
                    label: 'Xem thay đổi',
                });

                const onAction = ({ key }) => {
                    if (key === 'REJECT') handleReject(record);
                    if (key === 'APPROVE' || key === 'ACTIVATE') handleApprove(record);
                    if (key === 'TRANSFER') openTransferModal(record);
                    if (key === 'PROGRESS') openProgressModal(record);
                    if (key === 'AUDIT') {
                        setAuditTopic(record);
                        setIsAuditModalOpen(true);
                    }
                };

                return (
                    <Dropdown menu={{ items: menuItems, onClick: onAction }} trigger={['click']} placement="bottomRight">
                        <Button type="link" size="small">Thao tác {<MoreOutlined />}</Button>
                    </Dropdown>
                );
            },
        },
    ];

    const lecturerOptions = lecturers.map((lecturer) => ({
        value: lecturer.id,
        label: `${lecturer.fullName} (${lecturer.code})`,
    }));

    const semesterOptions = currentSemesters.map((semester) => ({
        value: semester.id,
        label: formatSemesterLabel(semester),
    }));
    const projectNameOptions = Array.from(new Set(tableData.map((item) => item.projectCatalog?.name).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'vi'))
        .map((name) => ({
            value: name,
            label: name,
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
            <PageHeader title="Giám sát đề tài" subtitle="Theo dõi toàn bộ đề tài, tiến độ sinh viên và xử lý nhanh các trường hợp cần can thiệp." />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                <StatCard icon="pending_actions" iconBg="bg-amber-50" iconColor="text-amber-600" label="Đang ký chờ duyệt" value={warningStats.pendingRegistrations} />
                <StatCard icon="group_off" iconBg="bg-orange-50" iconColor="text-orange-600" label="Chưa phân hồi đồng" value={warningStats.unassignedCouncil} />
                <StatCard icon="assignment_late" iconBg="bg-red-50" iconColor="text-red-600" label="SV có nhiệm vụ quá hạn" value={warningStats.overdueTaskRegistrations} />
                <StatCard icon="event_upcoming" iconBg="bg-blue-50" iconColor="text-blue-600" label="Kỳ sắp đóng đăng ký (7 ngày)" value={warningStats.closingSoonSemesters.length} />
            </div>

            <div className="space-y-3 mb-4">
                {warningStats.pendingRegistrations > 0 && (
                    <Alert
                        showIcon
                        type="warning"
                        message={`Co ${warningStats.pendingRegistrations} đăng ký đang chờ duyệt`}
                        description="Nên xử lý sớm để tránh nghẽn tiến độ giao nhiệm vụ cho sinh viên."
                    />
                )}
                {warningStats.unassignedCouncil > 0 && (
                    <Alert
                        showIcon
                        type="warning"
                        message={`Co ${warningStats.unassignedCouncil} đăng ký chưa được phân hội đồng`}
                        description="Ưu tiên phân hội đồng cho các nhóm đủ điều kiện để tránh trễ lịch bảo vệ."
                    />
                )}
                {warningStats.overdueTaskRegistrations > 0 && (
                    <Alert
                        showIcon
                        type="error"
                        message={`Co ${warningStats.overdueTaskRegistrations} sinh viên đang có nhiệm vụ quá hạn`}
                        description="Nên phối hợp giảng viên xử lý quá hạn hoặc cập nhật lại mốc nhiệm vụ."
                    />
                )}
                {warningStats.closingSoonSemesters.length > 0 && (
                    <Alert
                        showIcon
                        type="info"
                        message="Có học kỳ sắp đến hạn đóng đăng ký"
                        description={warningStats.closingSoonSemesters
                            .map((item) => `${item.name} (${dayjs(item.registrationDeadline).format('DD/MM/YYYY')})`)
                            .join(' â€¢ ')}
                    />
                )}
                {warningStats.registrationStillOpenButExpired.length > 0 && (
                    <Alert
                        showIcon
                        type="error"
                        message="Phát hiện học kỳ quá hạn nhưng vẫn mở đăng ký"
                        description={warningStats.registrationStillOpenButExpired
                            .map((item) => `${item.name} (han: ${dayjs(item.registrationDeadline).format('DD/MM/YYYY')})`)
                            .join(' â€¢ ')}
                    />
                )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm p-4 mb-4">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold text-slate-900">Bộ lọc giám sát</div>
                            <div className="text-xs text-slate-500">Lọc nhanh theo học kỳ, trạng thái, giảng viên và mã đề tài</div>
                        </div>
                        <Space>
                            <Button onClick={fetchData}>Làm mới</Button>
                        </Space>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        <Input
                            placeholder="Tìm mã, tên đồ án, hoặc giảng viên..."
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            className="w-full"
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            allowClear
                        />
                        <Select
                            placeholder="Trạng thái đề tài"
                            className="w-full"
                            allowClear
                            value={statusFilter}
                            onChange={(value) => setStatusFilter(value || null)}
                            options={['APPROVED','PENDING','REJECTED','DRAFT'].map((key) => ({
                                label: STATUS_MAP[key]?.label || key,
                                value: key,
                            }))}
                        />
                        <Select
                            placeholder="Tên đồ án"
                            className="w-full"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            value={projectNameFilter}
                            onChange={(value) => setProjectNameFilter(value || null)}
                            options={projectNameOptions}
                        />
                        <Select
                            placeholder="Đợt đồ án"
                            className="w-full"
                            allowClear
                            value={semesterFilter}
                            onChange={(value) => setSemesterFilter(value || null)}
                            options={semesterOptions}
                        />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-600">
                            Kết quả: <b>{filteredTopics.length}</b> / {tableData.length} đề tài
                        </span>
                        <span className="text-xs text-slate-500">Học kỳ: chỉ hiển thị học kỳ đang diễn ra</span>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    loading={loading}
                    dataSource={filteredTopics}
                    rowKey="id"
                    columns={columns}
                    scroll={{ x: 1380 }}
                    rowClassName={(_, index) => (index % 2 === 0 ? 'bg-white' : 'bg-slate-50/45')}
                    className="[&_.ant-table-thead_th]:!bg-slate-100 [&_.ant-table-thead_th]:!text-slate-700 [&_.ant-table-thead_th]:!font-semibold [&_.ant-table-cell]:!align-top"
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    size="middle"
                />
            </div>

            <Modal
                title="Điều chuyển đề tài"
                open={isTransferModalOpen}
                onCancel={() => setIsTransferModalOpen(false)}
                onOk={handleTransfer}
                okText="Lưu thay đổi"
                cancelText="Hủy"
                width={560}
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
                <div className="pt-4">
                    <Timeline items={auditItems} />
                </div>
            </Modal>

            <Modal
                title={`Tiến độ đề tài: ${progressTopic?.code || ''}`}
                open={isProgressModalOpen}
                onCancel={() => setIsProgressModalOpen(false)}
                footer={null}
                width={980}
            >
                <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Card size="small" className="border-slate-200">
                            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Đề tài</div>
                            <div className="font-semibold text-slate-900">{progressTopic?.title || 'N/A'}</div>
                        </Card>
                        <Card size="small" className="border-slate-200">
                            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Sinh viên</div>
                            <div className="font-semibold text-slate-900">
                                {progressTopic?.registrationEvents?.[0]?.student?.fullName || 'N/A'}
                            </div>
                            <div className="text-xs text-slate-500">
                                {progressTopic?.registrationEvents?.[0]?.student?.code || 'N/A'}
                            </div>
                        </Card>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Tag>Tổng task: {progressStats.total}</Tag>
                        <Tag color="blue">Đã nộp: {progressStats.submitted}</Tag>
                        <Tag color="success">Hoàn thành: {progressStats.completed}</Tag>
                        <Tag color={progressStats.overdue > 0 ? 'error' : 'default'}>Quá hạn: {progressStats.overdue}</Tag>
                        <Tag color="processing">Tiến độ: {progressStats.progress}%</Tag>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="lg:col-span-2 border-slate-200" size="small" title="Danh sách task">
                            <Spin spinning={progressLoading}>
                                {!progressTasks.length ? (
                                    <Empty description="Chưa có task" />
                                ) : (
                                    <List
                                        dataSource={progressTasks}
                                        renderItem={(task) => {
                                            const submissions = task.submissions || [];
                                            const latest = submissions.length ? submissions[submissions.length - 1] : null;
                                            return (
                                                <List.Item>
                                                    <div className="w-full">
                                                        <div className="font-medium text-slate-900">{task.title}</div>
                                                        <div className="text-xs text-slate-500">
                                                            Hạn nộp: {task.dueDate ? dayjs(task.dueDate).format('DD/MM/YYYY HH:mm') : 'Không có'}
                                                        </div>
                                                        <div className="mt-1">
                                                            <Tag>{task.status}</Tag>
                                                            {latest ? (
                                                                <Tag color="blue">Đã nộp: {latest.fileName || 'File'}</Tag>
                                                            ) : (
                                                                <Tag>Chưa nộp</Tag>
                                                            )}
                                                        </div>
                                                    </div>
                                                </List.Item>
                                            );
                                        }}
                                    />
                                )}
                            </Spin>
                        </Card>
                        <Card size="small" className="border-slate-200" title="Lịch sử trao đổi">
                            {progressTimelineItems.length ? (
                                <Timeline items={progressTimelineItems} />
                            ) : (
                                <Empty description="Chưa có lịch sử" />
                            )}
                        </Card>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default ProjectOversightPage;

